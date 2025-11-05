import express from 'express';
import { 
    CoffeeGroveAnalytics, 
    InvestorPortfolioAnalytics, 
    FarmerEarningsAnalytics, 
    MarketTrendAnalytics,
    PlatformAnalytics 
} from '../lib/coffee-analytics';

const router = express.Router();

/**
 * Grove Performance Analytics Endpoints
 */

// Get grove performance analysis
router.get('/grove/:groveId/performance', async (req, res) => {
    try {
        const groveId = parseInt(req.params.groveId);
        const { startDate, endDate } = req.query;
        
        let timeframe;
        if (startDate && endDate) {
            timeframe = {
                start: parseInt(startDate as string),
                end: parseInt(endDate as string)
            };
        }
        
        const performance = await CoffeeGroveAnalytics.getGrovePerformance(groveId, timeframe);
        res.json(performance);
    } catch (error) {
        console.error('Error fetching grove performance:', error);
        res.status(500).json({ error: 'Failed to fetch grove performance data' });
    }
});

// Get grove health analytics
router.get('/grove/:groveId/health', async (req, res) => {
    try {
        const groveId = parseInt(req.params.groveId);
        const days = parseInt(req.query.days as string) || 30;
        
        const healthAnalytics = await CoffeeGroveAnalytics.getGroveHealthAnalytics(groveId, days);
        res.json(healthAnalytics);
    } catch (error) {
        console.error('Error fetching grove health analytics:', error);
        res.status(500).json({ error: 'Failed to fetch grove health data' });
    }
});

// Get grove maintenance analytics
router.get('/grove/:groveId/maintenance', async (req, res) => {
    try {
        const groveId = parseInt(req.params.groveId);
        const { startDate, endDate } = req.query;
        
        let timeframe;
        if (startDate && endDate) {
            timeframe = {
                start: parseInt(startDate as string),
                end: parseInt(endDate as string)
            };
        }
        
        const maintenance = await CoffeeGroveAnalytics.getMaintenanceAnalytics(groveId, timeframe);
        res.json(maintenance);
    } catch (error) {
        console.error('Error fetching maintenance analytics:', error);
        res.status(500).json({ error: 'Failed to fetch maintenance data' });
    }
});

/**
 * Investor Portfolio Analytics Endpoints
 */

// Get investor portfolio overview
router.get('/investor/:address/portfolio', async (req, res) => {
    try {
        const investorAddress = req.params.address;
        const portfolio = await InvestorPortfolioAnalytics.getInvestorPortfolio(investorAddress);
        res.json(portfolio);
    } catch (error) {
        console.error('Error fetching investor portfolio:', error);
        res.status(500).json({ error: 'Failed to fetch investor portfolio data' });
    }
});

// Get investor return projections
router.get('/investor/:address/projections', async (req, res) => {
    try {
        const investorAddress = req.params.address;
        const projections = await InvestorPortfolioAnalytics.getReturnProjections(investorAddress);
        res.json(projections);
    } catch (error) {
        console.error('Error fetching return projections:', error);
        res.status(500).json({ error: 'Failed to fetch return projections' });
    }
});

/**
 * Farmer Earnings Analytics Endpoints
 */

// Get farmer earnings overview
router.get('/farmer/:address/earnings', async (req, res) => {
    try {
        const farmerAddress = req.params.address;
        const { startDate, endDate } = req.query;
        
        let timeframe;
        if (startDate && endDate) {
            timeframe = {
                start: parseInt(startDate as string),
                end: parseInt(endDate as string)
            };
        }
        
        const earnings = await FarmerEarningsAnalytics.getFarmerEarnings(farmerAddress, timeframe);
        res.json(earnings);
    } catch (error) {
        console.error('Error fetching farmer earnings:', error);
        res.status(500).json({ error: 'Failed to fetch farmer earnings data' });
    }
});

// Get farmer performance metrics
router.get('/farmer/:address/performance', async (req, res) => {
    try {
        const farmerAddress = req.params.address;
        const performance = await FarmerEarningsAnalytics.getFarmerPerformanceMetrics(farmerAddress);
        res.json(performance);
    } catch (error) {
        console.error('Error fetching farmer performance:', error);
        res.status(500).json({ error: 'Failed to fetch farmer performance data' });
    }
});

/**
 * Market Trend Analytics Endpoints
 */

// Get coffee price trends
router.get('/market/price-trends', async (req, res) => {
    try {
        const variety = parseInt(req.query.variety as string) || 1;
        const grade = parseInt(req.query.grade as string) || 1;
        const days = parseInt(req.query.days as string) || 90;
        
        const trends = await MarketTrendAnalytics.getCoffeePriceTrends(variety, grade, days);
        res.json(trends);
    } catch (error) {
        console.error('Error fetching price trends:', error);
        res.status(500).json({ error: 'Failed to fetch price trend data' });
    }
});

// Get yield-price correlation analysis
router.get('/market/yield-price-correlation', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        let timeframe;
        if (startDate && endDate) {
            timeframe = {
                start: parseInt(startDate as string),
                end: parseInt(endDate as string)
            };
        }
        
        const correlation = await MarketTrendAnalytics.getYieldPriceCorrelation(timeframe);
        res.json(correlation);
    } catch (error) {
        console.error('Error fetching yield-price correlation:', error);
        res.status(500).json({ error: 'Failed to fetch correlation data' });
    }
});

// Get market insights and recommendations
router.get('/market/insights', async (req, res) => {
    try {
        const insights = await MarketTrendAnalytics.getMarketInsights();
        res.json(insights);
    } catch (error) {
        console.error('Error fetching market insights:', error);
        res.status(500).json({ error: 'Failed to fetch market insights' });
    }
});

/**
 * Platform Analytics Endpoints
 */

// Get platform-wide statistics
router.get('/platform/stats', async (req, res) => {
    try {
        const stats = await PlatformAnalytics.getPlatformStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching platform stats:', error);
        res.status(500).json({ error: 'Failed to fetch platform statistics' });
    }
});

// Get platform growth metrics
router.get('/platform/growth', async (req, res) => {
    try {
        const days = parseInt(req.query.days as string) || 90;
        const growth = await PlatformAnalytics.getPlatformGrowthMetrics(days);
        res.json(growth);
    } catch (error) {
        console.error('Error fetching platform growth:', error);
        res.status(500).json({ error: 'Failed to fetch platform growth data' });
    }
});

/**
 * Comparative Analytics Endpoints
 */

// Compare multiple groves
router.post('/compare/groves', async (req, res) => {
    try {
        const { groveIds, timeframe } = req.body;
        
        if (!Array.isArray(groveIds) || groveIds.length === 0) {
            return res.status(400).json({ error: 'Grove IDs array is required' });
        }
        
        const comparisons = await Promise.all(
            groveIds.map(async (groveId: number) => {
                try {
                    return await CoffeeGroveAnalytics.getGrovePerformance(groveId, timeframe);
                } catch (error) {
                    console.error(`Error fetching data for grove ${groveId}:`, error);
                    return null;
                }
            })
        );
        
        // Filter out failed requests
        const validComparisons = comparisons.filter(c => c !== null);
        
        res.json({
            comparisons: validComparisons,
            summary: {
                totalGroves: validComparisons.length,
                avgYieldEfficiency: validComparisons.reduce((sum, c) => sum + (c?.performance?.yieldEfficiency || 0), 0) / validComparisons.length,
                totalRevenue: validComparisons.reduce((sum, c) => sum + Number(c?.performance?.totalRevenue || 0), 0),
                avgQuality: validComparisons.reduce((sum, c) => sum + Number(c?.performance?.averageQuality || 0), 0) / validComparisons.length
            }
        });
    } catch (error) {
        console.error('Error comparing groves:', error);
        res.status(500).json({ error: 'Failed to compare groves' });
    }
});

// Compare investor portfolios (anonymized)
router.post('/compare/investors', async (req, res) => {
    try {
        const { investorAddresses } = req.body;
        
        if (!Array.isArray(investorAddresses) || investorAddresses.length === 0) {
            return res.status(400).json({ error: 'Investor addresses array is required' });
        }
        
        const portfolios = await Promise.all(
            investorAddresses.map(async (address: string, index: number) => {
                try {
                    const portfolio = await InvestorPortfolioAnalytics.getInvestorPortfolio(address);
                    // Anonymize the data
                    return {
                        id: `investor_${index + 1}`,
                        summary: portfolio.summary,
                        monthlyEarnings: portfolio.monthlyEarnings
                    };
                } catch (error) {
                    console.error(`Error fetching portfolio for ${address}:`, error);
                    return null;
                }
            })
        );
        
        const validPortfolios = portfolios.filter(p => p !== null);
        
        res.json({
            portfolios: validPortfolios,
            benchmarks: {
                avgTotalInvestment: validPortfolios.reduce((sum, p) => sum + (p?.summary?.totalInvestment || 0), 0) / validPortfolios.length,
                avgReturnPercentage: validPortfolios.reduce((sum, p) => sum + (p?.summary?.returnPercentage || 0), 0) / validPortfolios.length,
                avgActiveGroves: validPortfolios.reduce((sum, p) => sum + (p?.summary?.activeGroves || 0), 0) / validPortfolios.length
            }
        });
    } catch (error) {
        console.error('Error comparing investor portfolios:', error);
        res.status(500).json({ error: 'Failed to compare investor portfolios' });
    }
});

/**
 * Export/Reporting Endpoints
 */

// Export grove performance report
router.get('/export/grove/:groveId/report', async (req, res) => {
    try {
        const groveId = parseInt(req.params.groveId);
        const format = req.query.format as string || 'json';
        
        const performance = await CoffeeGroveAnalytics.getGrovePerformance(groveId);
        const health = await CoffeeGroveAnalytics.getGroveHealthAnalytics(groveId);
        const maintenance = await CoffeeGroveAnalytics.getMaintenanceAnalytics(groveId);
        
        const report = {
            grove: performance.grove,
            performance: performance.performance,
            health: health,
            maintenance: maintenance,
            generatedAt: new Date().toISOString()
        };
        
        if (format === 'csv') {
            // Convert to CSV format (simplified)
            const csv = convertToCSV(report);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="grove_${groveId}_report.csv"`);
            res.send(csv);
        } else {
            res.json(report);
        }
    } catch (error) {
        console.error('Error generating grove report:', error);
        res.status(500).json({ error: 'Failed to generate grove report' });
    }
});

// Export investor portfolio report
router.get('/export/investor/:address/report', async (req, res) => {
    try {
        const investorAddress = req.params.address;
        const format = req.query.format as string || 'json';
        
        const portfolio = await InvestorPortfolioAnalytics.getInvestorPortfolio(investorAddress);
        const projections = await InvestorPortfolioAnalytics.getReturnProjections(investorAddress);
        
        const report = {
            investor: investorAddress,
            portfolio: portfolio,
            projections: projections,
            generatedAt: new Date().toISOString()
        };
        
        if (format === 'csv') {
            const csv = convertToCSV(report);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="investor_${investorAddress}_report.csv"`);
            res.send(csv);
        } else {
            res.json(report);
        }
    } catch (error) {
        console.error('Error generating investor report:', error);
        res.status(500).json({ error: 'Failed to generate investor report' });
    }
});

/**
 * Helper function to convert JSON to CSV (simplified)
 */
function convertToCSV(data: any): string {
    // This is a simplified CSV conversion
    // In production, you'd want to use a proper CSV library
    const flattenObject = (obj: any, prefix = ''): any => {
        let flattened: any = {};
        for (const key in obj) {
            if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                Object.assign(flattened, flattenObject(obj[key], `${prefix}${key}_`));
            } else {
                flattened[`${prefix}${key}`] = obj[key];
            }
        }
        return flattened;
    };
    
    const flattened = flattenObject(data);
    const headers = Object.keys(flattened).join(',');
    const values = Object.values(flattened).map(v => 
        typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v
    ).join(',');
    
    return `${headers}\n${values}`;
}

export default router;