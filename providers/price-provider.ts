import "dotenv/config"
import { ContractExecuteTransaction, ContractFunctionParameters, EvmAddress, TokenId } from "@hashgraph/sdk"
import { getClient, getEnv } from "../utils.js"
import { db } from "../db/index.js"
import { assets, prices } from "../db/schema/index.js"
import { generateId } from "../lib/utils.js"

const client = getClient()
const admin = getEnv()
const PRICE_CONTRACT_ID = process.env.PriceOracle!

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

function getNextPrice(asset: string){
    // TODO: do some custom logic here to get the next price in USDC - default will be 100 for now
    const price_variations = [100, 150, 110, 90, 120, 130, 140, 83, 85, 90, 104]
    const randomIndex = Math.floor(Math.random() * price_variations.length)
    const price = price_variations[randomIndex] ?? 100
    return price
}

interface UpdateOptions {
    asset: string
}

export async function updatePrice(options: UpdateOptions){
    const { asset } = options
    
    
    try {
        const price = getNextPrice(asset)
        
        console.log("Updating price for", asset, "with price", price)

        const tx = await new ContractExecuteTransaction()
        .setContractId(PRICE_CONTRACT_ID)
        .setGas(1000000)
        .setFunction("updatePrice", 
            new ContractFunctionParameters()
            .addAddress( EvmAddress.fromString(asset))
                .addUint64(price * 1_000_000)
        )
        .freezeWith(client)
        .sign(admin.PRIVATE_KEY)

        const response = await tx.execute(client)
        const receipt = await response.getReceipt(client)

        console.log("Price updated for", asset, "with price", price)


        try {   
            await db.insert(prices).values({
                id: generateId(`price_${asset}`),
                price,
                timestamp: Date.now(),
                token: asset
            })
        }
        catch (e)
        {
            console.log("Something went wrong updating offchain data", e)
        }

    }
    catch (e)
    {
        console.log("Something went wrong", e)
    }

}


async function priceProvider(){
    // return 0; 
    const assets = await db.query.assets.findMany()

    // while (true) {
    //     await sleep(60_000)
    //     console.log("RUNNING PRICE PROVIDER")
    // }

    while (true) {

        if (process.env.NO_PRICE_UPDATE == "true") {
            await sleep(120_000)
            continue
        }
        for (const asset of assets) {
            try {
                await updatePrice({ asset: asset.token })

            }
            catch (e) {
                console.log("Unable to update pricing", e)
                continue
            }

        }

        await sleep(60_000)
    }
}

await priceProvider()