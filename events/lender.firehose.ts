import lenderContract from "../abi/CoffeeLendingPool.json" assert { type: "json" }
import { lenderFireStore } from "../lib/stores.js"
import { eventReader } from "./utils.js"

const LIMIT = 10
const LENDER_CONTRACT_ID = process.env.CoffeeLendingPool || process.env.Lender!
console.log("STARTED LENDER FIREHOSE")
console.log("Lender contract", LENDER_CONTRACT_ID)

await eventReader({
    store: lenderFireStore,
    abi: lenderContract.abi,
    contract_id: LENDER_CONTRACT_ID,
    limit: LIMIT
})
console.log("ENDED LENDER FIREHOSE")
