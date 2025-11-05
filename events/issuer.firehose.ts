import issuerContract from "../abi/Issuer.json" assert { type: "json" }
import { issuerFireStore } from "../lib/stores.js"
import { eventReader } from "./utils.js"

const ISSUER_CONTRACT_ID = process.env.Issuer!

console.log("STARTED ISSUER FIREHOSE")
console.log("Issuer contract", ISSUER_CONTRACT_ID)

const LIMIT = 10

await eventReader({
    store: issuerFireStore,
    abi: issuerContract.abi,
    contract_id: ISSUER_CONTRACT_ID,
    limit: LIMIT
})

console.log("ENDED ISSUER FIREHOSE")
