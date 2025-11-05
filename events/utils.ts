import axios from "axios"
import {Interface, decodeBytes32String} from "ethers"
import { indexingStore } from "../lib/stores.js"
import Store from "../lib/store.js"

const MIRROR_NODE_BASE_API = process.env.NETWORK == "testnet" ? "https://testnet.mirrornode.hedera.com" : "http://127.0.0.1:5551"

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const stringifyWithBigInts = (key: any, value: any) => {
    if (typeof value === "bigint") {
        return Number(value)
    }
    return value
}

interface EventOptions {_next_url?: string, contract_id?: string, limit?: number, abi: any}

async function readEventLogs (args: EventOptions) {

    const { _next_url: nrl, contract_id, limit, abi } = args
    let _next_url = nrl 
    const intfc = new Interface(abi)

    const lastRecordedEvent = indexingStore.getObject<{timestamp: number, index: number}>(`${contract_id}_lastRecordedEvent`)
    console.log("Last Recorded Event", lastRecordedEvent)
    if(lastRecordedEvent){
        _next_url = `/api/v1/contracts/${contract_id}/results/logs?order=asc&limit=${limit}&timestamp=gte:${lastRecordedEvent.timestamp}&index=gt:${lastRecordedEvent.index}`
        console.log("Updated last recorded event ::", _next_url)
    }

    let next_url = _next_url ?? `/api/v1/contracts/${contract_id}/results/logs`

    const url = `${MIRROR_NODE_BASE_API}${next_url}`

    console.log("DATA URL::", url)

    const response = await axios.get(url, {
        params: {
            order: "asc",
            limit: limit
        }
    })
    const logs = response.data.logs ?? []
    const last = logs[logs.length - 1]

    if(logs.length === 0){
        return {next: next_url, events: [], emptyNext: true}
    }

    if(last){
        console.log("Setting last recorded to::", last)
        indexingStore.setObject(`${contract_id}_lastRecordedEvent`, { timestamp: parseFloat(last.timestamp), index: last.index }) // TODO: turn this back on when production ready
    }

    let next = response.data.links.next
    let emptyNext = false
    if(last && !next){
        next = `/api/v1/contracts/${contract_id}/results/logs?order=asc&limit=${limit}&timestamp=gte:${last.timestamp}&index=gt:${last.index}`
        emptyNext = true
    }

    



    const events: Array<Record<string, any>> = []

    for (const log of logs) {
        const decodedLog = intfc.parseLog(log)

        const eventData: any = {}
        let index = 0
        for (const input of (decodedLog?.fragment?.inputs ?? [])){
            if(input.type === "bytes32"){
                eventData[input.name] = decodeBytes32String(decodedLog?.args[index])
            }else{
                eventData[input.name] = decodedLog?.args[index]
            }

            index++
        }

        eventData["type"] = decodedLog?.name
        eventData["timestamp"] = parseFloat(log.timestamp) * 1000
        eventData["block"] = log.block_number
        eventData["topic"] = decodedLog?.topic
        eventData["hash"] = log.transaction_hash

        console.debug(eventData)

        events.push(eventData)
    }

    return {next, events, emptyNext}
}

export async function eventReader(args: EventOptions & { store: Store, nukeFirst?: boolean}){
    const { abi, _next_url, contract_id, limit, store, nukeFirst } = args

    if(nukeFirst){
        store.dump()
    }

    let next_url: string | undefined = _next_url ?? `/api/v1/contracts/${contract_id}/results/logs`

    console.log("Next URL::", next_url)

    do {
        const result = await readEventLogs({
            abi,
            _next_url: next_url,
            contract_id,
            limit
        })
        console.log("Results ::", result)
        next_url = result.next

        for (const event of result.events){
            const id = `${event.block}_${event.timestamp}_${event.hash}_${event.type}`
            const existing = store.getObject(id)
            if(!existing){
                store.setObject(id, event)
            }
            console.log(`Completed recording ${id}`)
        }

        if(result.emptyNext){
            console.log("No more events to read will wait") // maybe wait for a minute before trying again
            await sleep(60000)
        }
    } while (next_url)

    // console.log("Events ::", events)

}

interface IndexerOptions {
    store: Store,
    contract: string,
    processor: (key: string, data: any) => Promise<void>,
    nukeFirst?: boolean
    ignoreLastCommit?: boolean
}
export async function indexFirestore(options: IndexerOptions){
    const { store, processor, contract, nukeFirst, ignoreLastCommit } = options
    if(nukeFirst){
        store.dump()
    }
    const lastCommitedKey = indexingStore.get(`lastCommitedKey_${contract}`) ?? null
    console.log("Last Commited key ::", lastCommitedKey)
    const stream = store.createStream({
        batchSize: 10,
        start_slot: ignoreLastCommit  ? undefined : lastCommitedKey
    })

    for await (const chunk of stream.iterator()){
        const data = chunk.value
        try {
            await processor(chunk.key, data)
        } catch (e) {
            console.log("Error processing chunk", e)
        }
        indexingStore.set(`lastCommitedKey_${contract}`, chunk.key)
    }
}