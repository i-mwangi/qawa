/**
 * Coffee Price Web Scraper
 * Fetches live coffee prices from public financial websites
 */

import axios from 'axios'
import * as cheerio from 'cheerio'

export interface ScrapedPrice {
    variety: string
    price: number
    unit: string
    source: string
    timestamp: Date
}

export class CoffeePriceScraper {
    private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

    /**
     * Fetch Arabica price from Yahoo Finance (ICE Coffee C Futures)
     */
    async getArabicaPrice(): Promise<ScrapedPrice | null> {
        try {
            const url = 'https://finance.yahoo.com/quote/KC=F'
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 10000
            })

            const $ = cheerio.load(data)
            const priceText = $('fin-streamer[data-symbol="KC=F"]').first().text()
            
            if (priceText) {
                const price = parseFloat(priceText.replace(/,/g, ''))
                
                return {
                    variety: 'ARABICA',
                    price: price * 2.20462, // Convert cents/lb to $/kg
                    unit: 'USD/kg',
                    source: 'Yahoo Finance (ICE)',
                    timestamp: new Date()
                }
            }
        } catch (error) {
            console.error('Error scraping Arabica price:', error)
        }
        
        return null
    }

    /**
     * Fetch Robusta price from Investing.com
     */
    async getRobustaPrice(): Promise<ScrapedPrice | null> {
        try {
            const url = 'https://www.investing.com/commodities/robusta-coffee-10'
            const { data } = await axios.get(url, {
                headers: { 'User-Agent': this.userAgent },
                timeout: 10000
            })

            const $ = cheerio.load(data)
            const priceText = $('span[data-test="instrument-price-last"]').first().text()
            
            if (priceText) {
                const price = parseFloat(priceText.replace(/,/g, ''))
                
                return {
                    variety: 'ROBUSTA',
                    price: price / 1000, // Convert $/ton to $/kg
                    unit: 'USD/kg',
                    source: 'Investing.com',
                    timestamp: new Date()
                }
            }
        } catch (error) {
            console.error('Error scraping Robusta price:', error)
        }
        
        return null
    }

    /**
     * Fetch all available prices
     */
    async fetchAllPrices(): Promise<ScrapedPrice[]> {
        const prices: ScrapedPrice[] = []

        const [arabica, robusta] = await Promise.allSettled([
            this.getArabicaPrice(),
            this.getRobustaPrice()
        ])

        if (arabica.status === 'fulfilled' && arabica.value) {
            prices.push(arabica.value)
        }
        if (robusta.status === 'fulfilled' && robusta.value) {
            prices.push(robusta.value)
        }

        // Add estimated prices for specialty and organic (typically 20-50% premium)
        if (arabica.status === 'fulfilled' && arabica.value) {
            prices.push({
                variety: 'SPECIALTY',
                price: arabica.value.price * 1.35,
                unit: 'USD/kg',
                source: 'Estimated (35% premium)',
                timestamp: new Date()
            })
            
            prices.push({
                variety: 'ORGANIC',
                price: arabica.value.price * 1.25,
                unit: 'USD/kg',
                source: 'Estimated (25% premium)',
                timestamp: new Date()
            })
        }

        return prices
    }

    /**
     * Test scraper and display results
     */
    async testScraper(): Promise<void> {
        console.log('\n☕ Testing Coffee Price Scraper...')
        console.log('=' .repeat(50))

        const prices = await this.fetchAllPrices()

        if (prices.length === 0) {
            console.log('❌ No prices could be fetched')
            return
        }

        console.log(`\n✅ Successfully fetched ${prices.length} prices:\n`)

        prices.forEach(price => {
            console.log(`${price.variety.padEnd(12)} ${price.price.toFixed(2)} ${price.unit}`)
            console.log(`${''.padEnd(12)} Source: ${price.source}`)
            console.log()
        })

        console.log('=' .repeat(50))
    }
}

// CLI test if run directly (ES module compatible)
// Removed require.main check for ES module compatibility
