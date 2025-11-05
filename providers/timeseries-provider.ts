import { db } from "../db/index.js"
import { prices, realwordAssetTimeseries } from "../db/schema/index.js"
import { generateId } from "../lib/utils.js"
import { desc } from "drizzle-orm"


async function getNextTimeSeriesData(asset: string){
    // TODO: intergrate with live data feed from secondary data provider

    const lastPriceUpdate = await db.query.realwordAssetTimeseries.findMany({
        where: (prices, { eq }) => eq(prices.asset, asset),
        orderBy: desc(prices.timestamp),
        limit: 1
    })

    const lastCandle = lastPriceUpdate[0]
    let lastTimestamp = Date.now()

    if (lastCandle) {
        lastTimestamp = lastCandle.timestamp
    } else {
        const lastPrice = await db.query.prices.findFirst({
            where: (prices, { eq }) => eq(prices.token, asset),
            orderBy: desc(prices.timestamp)
        })

        if (lastPrice) {
            lastTimestamp = lastPrice.timestamp
        }
        else {
            return []
        }
    }
    const currentTime = Date.now()
    const timeDiff = currentTime - lastTimestamp

    const slots = Math.ceil(timeDiff / 60_000) // 1 minute slots

    const seriesData = await Promise.all(Array.from({ length: slots }, async (_, i) => {
        const pricesInSlotQuery = await db.query.prices.findMany({
            where: (prices, { eq, and, gt, gte, lte }) => and(
                eq(prices.token, asset),
                gte(prices.timestamp, lastTimestamp + i * 60_000),
                lte(prices.timestamp, lastTimestamp + (i + 1) * 60_000)
            )
        })

        const pricesInSlot = pricesInSlotQuery.map(price => price.price)
        if (!pricesInSlot) return null
        const open = pricesInSlot[0] ?? 0
        const close = pricesInSlot[pricesInSlot.length - 1] ?? 0
        const high = Math.max(...pricesInSlot, open)
        const low = Math.min(...pricesInSlot, open)
        const net = close - open
        const gross = pricesInSlot.reduce((acc, price) => acc + price, 0)
        return {
            open,
            close,
            high,
            low,
            net,
            gross,
            timestamp: lastTimestamp + i * 60_000
        }
    }))

    return seriesData?.filter(data => data !== null) as Array<{
        open: number
        close: number
        high: number
        low: number
        net: number
        gross: number
        timestamp: number
    }>
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface UpdateTimeSeriesOptions {
    asset: string
}

async function updateTimeSeriesData(options: UpdateTimeSeriesOptions) {
    const { asset } = options

    try {
        const seriesData = await getNextTimeSeriesData(asset)

        try {
            for (const data of seriesData) {
                await db.insert(realwordAssetTimeseries).values({
                    id: generateId(`price_${asset}`),
                    ...data,
                    asset: asset
                })
            }


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


async function timeSeriesProvider(){
    // return 0;
    const assets = await db.query.assets.findMany()

    while (true) {
        if (process.env.NO_PRICE_UPDATE == "true") {
            await sleep(120_000)
            continue
        }

        for (const asset of assets) {
            await updateTimeSeriesData({ asset: asset.token })
        }

        await sleep(120_000)
    }

    // while (true) {
    //     await sleep(60_000)
    //     console.log("RUNNING TIME SERIES PROVIDER")
    // }
}


await timeSeriesProvider() 