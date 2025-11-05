import "dotenv/config"
import path from "path"
import fs from "fs"
import { AccountId, Client, EvmAddress, PrivateKey } from "@hashgraph/sdk"

type SHARED_KEYS = {
    FILE_ID: string | null
    CONTRACT_ID: string | null
    USDC_TOKEN_ID: string | null
}
export function updateShared(fileId: string, contractId: string, usdcTokenId?: string) {
    const shared: SHARED_KEYS = {
        FILE_ID: fileId,
        CONTRACT_ID: contractId,
        USDC_TOKEN_ID: usdcTokenId ?? null
    }

    const location = path.join(process.cwd(), "shared.json")

    fs.writeFileSync(location, JSON.stringify(shared, null, 2)) 

}

export function getShared(): SHARED_KEYS {
    const location = path.join(process.cwd(), "shared.json")

    if(!fs.existsSync
    (location)){
        return {
            FILE_ID: null,
            CONTRACT_ID: null,
            USDC_TOKEN_ID: null
        }
    }

    const shared = fs.readFileSync(location
    , "utf-8")
    return JSON.parse(shared)
}

export function getEnv(){
    // Support both old and new environment variable names
    const network = process.env.NETWORK || process.env.HEDERA_NETWORK || 'testnet'
    
    const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.HEDERA_OPERATOR_KEY
    const ACCOUNT_ID = process.env.ACCOUNT_ID || process.env.HEDERA_OPERATOR_ID
    const ADDRESS = process.env.ADDRESS

    const TPRIVATE_KEY = process.env.TPRIVATE_KEY || process.env.HEDERA_OPERATOR_KEY
    const TACCOUNT_ID = process.env.TACCOUNT_ID || process.env.HEDERA_OPERATOR_ID
    const TADDRESS = process.env.TADDRESS

    if(!PRIVATE_KEY || !ACCOUNT_ID){
        throw new Error("HEDERA_OPERATOR_KEY and HEDERA_OPERATOR_ID must be set in .env file")
    }

    if (network == 'localnet'){
        return {
            PRIVATE_KEY: PrivateKey.fromStringECDSA(PRIVATE_KEY!),
            ACCOUNT_ID: AccountId.fromString(ACCOUNT_ID!),
            ADDRESS: ADDRESS ? EvmAddress.fromString(ADDRESS!) : undefined,
            NETWORK: network
        }
    }
    else 
    {
        return {
            PRIVATE_KEY: PrivateKey.fromStringECDSA(TPRIVATE_KEY!),
            ACCOUNT_ID: AccountId.fromString(TACCOUNT_ID!),
            ADDRESS: TADDRESS ? EvmAddress.fromString(TADDRESS!) : undefined,
            NETWORK: network
        }
    }
}

export const getClient = () => {
    const env = getEnv()

    if(env.NETWORK == "localnet"){
        const client = Client.forLocalNode()
        client.setOperator(env.ACCOUNT_ID, env.PRIVATE_KEY)
        return client
    }else{
        const client = Client.forTestnet()
        client.setOperator(env.ACCOUNT_ID, env.PRIVATE_KEY)
        return client
    }
}

export const getTestUser = () => {
    const PRIVATE_KEY = process.env.USER_PRIVATE_KEY!
    const ADDRESS = process.env.USER_ADDRESS!
    const ACCOUNT_ID = process.env.USER_ACCOUNT_ID!

    const TPRIVATE_KEY = process.env.TUSER_PRIVATE_KEY!
    const TADDRESS = process.env.TUSER_ADDRESS!
    const TACCOUNT_ID = process.env.TUSER_ACCOUNT_ID!

    const network = process.env.NETWORK

    if (network == 'testnet') {
        return {
            PRIVATE_KEY: PrivateKey.fromStringECDSA(TPRIVATE_KEY),
            ADDRESS: EvmAddress.fromString(TADDRESS),
            ACCOUNT_ID: AccountId.fromString(TACCOUNT_ID)
        }
    }

    return {
        PRIVATE_KEY: PrivateKey.fromStringECDSA(PRIVATE_KEY),
        ADDRESS: EvmAddress.fromString(ADDRESS),
        ACCOUNT_ID: AccountId.fromString(ACCOUNT_ID)
    }
}

export const getSecondUser = () => {
    const PRIVATE_KEY = process.env.USER2_PRIVATE_KEY!
    const ADDRESS = process.env.USER2_ADDRESS!
    const ACCOUNT_ID = process.env.USER2_ACCOUNT_ID!

    console.log(PRIVATE_KEY, ADDRESS, ACCOUNT_ID)

    return {
        PRIVATE_KEY: PrivateKey.fromStringECDSA(PRIVATE_KEY),
        ADDRESS: EvmAddress.fromString(ADDRESS),
        ACCOUNT_ID: AccountId.fromString(ACCOUNT_ID)
    }
}