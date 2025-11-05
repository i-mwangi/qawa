# Coffee Market Data Integration

This module provides comprehensive coffee market data integration for the Coffee Tree Tokenization platform. It connects to multiple external coffee commodity price feeds and provides real-time market data, price validation, and automated alerts for farmers.

## Features

### 🌐 Multi-Source Price Feeds
- **ICE (Intercontinental Exchange)**: Coffee C futures (Arabica) and Robusta futures
- **CME Group**: Coffee market data and derivatives
- **Coffee Exchange API**: Specialty and organic coffee pricing with regional data

### 📊 Market Data Services
- Real-time price fetching from multiple sources
- Price history tracking and trend analysis
- Market condition assessment (Bullish/Bearish/Stable)
- Volatility calculations and risk assessment
- Price validation against market rates

### 🚨 Alert System
- Automated price spike/drop alerts
- Volatility monitoring and notifications
- Market condition change alerts
- Customizable farmer notification preferences
- Multiple notification channels (Email, SMS)

### 🔄 Automatic Updates
- Scheduled price updates every 30 minutes
- Smart contract price synchronization
- Fallback pricing when APIs are unavailable
- Error handling and retry mechanisms

## Components

### CoffeeMarketProvider
Main service for fetching and managing coffee market data.

```typescript
import { CoffeeMarketProvider, CoffeeVariety } from './coffee-market-provider'

const provider = new CoffeeMarketProvider('0.0.contractId')

// Fetch latest prices
const prices = await provider.fetchAllPrices()

// Validate a reported price
const validation = provider.validatePrice(CoffeeVariety.ARABICA, 1, 4.50)

// Get market conditions
const conditions = provider.getMarketConditions(CoffeeVariety.ARABICA)

// Start automatic updates
provider.startPriceUpdates(30) // Every 30 minutes
```

### MarketAlertService
Handles farmer notifications and market alerts.

```typescript
import { MarketAlertService } from './market-alert-service'

const alertService = new MarketAlertService(marketProvider)

// Update farmer preferences
await alertService.updateFarmerPreferences({
    farmerAddress: '0.0.farmer123',
    emailNotifications: true,
    priceAlerts: true,
    priceChangeThreshold: 5,
    varieties: [CoffeeVariety.ARABICA, CoffeeVariety.ROBUSTA]
})

// Start periodic market updates
alertService.startPeriodicUpdates(24) // Every 24 hours
```

## API Endpoints

### Market Data
- `GET /api/market/prices` - Get current coffee prices
- `GET /api/market/price-history` - Get price history for a variety
- `GET /api/market/conditions` - Get market conditions and recommendations
- `GET /api/market/overview` - Get market overview for all varieties

### Price Validation
- `POST /api/market/validate-price` - Validate a price against market rates

### Alerts & Notifications
- `GET /api/market/alerts/:farmerAddress` - Get alerts for a farmer
- `POST /api/market/alerts/:alertId/acknowledge` - Acknowledge an alert
- `PUT /api/market/preferences/:farmerAddress` - Update notification preferences

### Administration
- `POST /api/market/update-prices` - Trigger manual price update

## Configuration

### Environment Variables
```bash
# API Keys for external services
ICE_API_KEY=your_ice_api_key
CME_API_KEY=your_cme_api_key
COFFEE_EXCHANGE_API_KEY=your_coffee_exchange_api_key

# Contract configuration
COFFEE_ORACLE_CONTRACT_ID=0.0.123456
```

### API Configuration
```typescript
const COFFEE_APIS = {
    ICE: {
        baseUrl: 'https://api.ice.com/v1',
        endpoints: {
            arabica: '/futures/coffee-c',
            robusta: '/futures/coffee-robusta'
        }
    },
    CME: {
        baseUrl: 'https://api.cmegroup.com/v1',
        endpoints: {
            coffee: '/market-data/coffee'
        }
    },
    COFFEE_EXCHANGE: {
        baseUrl: 'https://api.coffeeexchange.com/v2',
        endpoints: {
            prices: '/prices',
            historical: '/historical'
        }
    }
}
```

## Data Models

### Coffee Varieties
```typescript
enum CoffeeVariety {
    ARABICA = 0,    // Premium coffee variety
    ROBUSTA = 1,    // Hardy, high-caffeine variety
    SPECIALTY = 2,  // High-quality specialty coffee
    ORGANIC = 3     // Organically grown coffee
}
```

### Market Price
```typescript
interface CoffeeMarketPrice {
    variety: CoffeeVariety
    grade: number
    pricePerKg: number
    currency: string
    timestamp: Date
    source: string
    region?: string
}
```

### Market Alert
```typescript
interface MarketAlert {
    variety: CoffeeVariety
    grade: number
    alertType: 'PRICE_SPIKE' | 'PRICE_DROP' | 'VOLATILITY' | 'SEASONAL_CHANGE'
    currentPrice: number
    previousPrice: number
    changePercent: number
    timestamp: Date
    message: string
}
```

## Database Schema

### Price History
```sql
CREATE TABLE price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    variety INTEGER NOT NULL,
    grade INTEGER NOT NULL,
    price INTEGER NOT NULL, -- Price in cents
    source TEXT NOT NULL,
    region TEXT,
    timestamp INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

### Market Alerts
```sql
CREATE TABLE market_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    farmer_address TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    variety INTEGER NOT NULL,
    grade INTEGER NOT NULL,
    current_price INTEGER NOT NULL,
    previous_price INTEGER NOT NULL,
    change_percent INTEGER NOT NULL,
    message TEXT NOT NULL,
    sent_at INTEGER NOT NULL,
    channel TEXT NOT NULL,
    acknowledged INTEGER DEFAULT false
);
```

## Error Handling

### API Failures
- Automatic fallback to cached prices
- Graceful degradation when external APIs are unavailable
- Retry mechanisms with exponential backoff
- Comprehensive error logging

### Price Validation
- Deviation thresholds (default: 20% from market rate)
- Historical price comparison
- Source reliability scoring
- Outlier detection and filtering

### Alert Delivery
- Multiple notification channels
- Delivery confirmation tracking
- Failed delivery retry logic
- Farmer preference management

## Testing

### Unit Tests
```bash
pnpm test tests/market-provider-basic.spec.ts --run
pnpm test tests/market-api-basic.spec.ts --run
```

### Integration Tests
The system includes comprehensive tests for:
- Price fetching from multiple sources
- Market condition analysis
- Alert generation and delivery
- API endpoint validation
- Error handling scenarios

## Usage Examples

### Basic Price Fetching
```typescript
// Initialize the market provider
const provider = new CoffeeMarketProvider('0.0.123456')

// Fetch current prices
const prices = await provider.fetchAllPrices()
console.log(`Found ${prices.length} prices from various sources`)

// Get specific variety history
const arabicaHistory = provider.getPriceHistory(CoffeeVariety.ARABICA)
console.log(`Arabica price history: ${arabicaHistory.length} entries`)
```

### Market Analysis
```typescript
// Get market conditions
const conditions = provider.getMarketConditions(CoffeeVariety.ARABICA)
console.log(`Arabica market is ${conditions.trend}`)
console.log(`Recommendation: ${conditions.recommendation}`)

// Validate a farmer's reported price
const validation = provider.validatePrice(CoffeeVariety.ARABICA, 1, 4.75)
if (!validation.isValid) {
    console.log(`Price validation failed: ${validation.message}`)
}
```

### Alert Management
```typescript
// Set up alert service
const alertService = new MarketAlertService(provider)

// Subscribe to alerts
provider.subscribeToAlerts((alert) => {
    console.log(`Alert: ${alert.message}`)
    // Send notification to farmers
})

// Update farmer preferences
await alertService.updateFarmerPreferences({
    farmerAddress: '0.0.farmer123',
    priceChangeThreshold: 3, // Alert on 3% price changes
    varieties: [CoffeeVariety.ARABICA] // Only Arabica alerts
})
```

## Requirements Fulfilled

This implementation fulfills the following requirements from the specification:

### Requirement 7.1
✅ **Market Data Display**: System displays current coffee prices, historical trends, and regional market information

### Requirement 7.2
✅ **Automatic Price Updates**: Coffee prices are automatically updated and revenue calculations are adjusted

### Requirement 7.4
✅ **Market Condition Notifications**: System notifies farmers of market condition changes and optimization opportunities

## Performance Considerations

- **Caching**: Price data is cached to reduce API calls
- **Rate Limiting**: Respects API rate limits with intelligent request spacing
- **Batch Processing**: Multiple price updates are batched for efficiency
- **Database Indexing**: Optimized queries for price history and alerts

## Security

- **API Key Management**: Secure storage and rotation of external API keys
- **Input Validation**: All user inputs are validated and sanitized
- **Access Control**: Farmer-specific data access controls
- **Audit Logging**: Comprehensive logging of all market data operations

## Monitoring

- **Health Checks**: Regular API endpoint health monitoring
- **Performance Metrics**: Response time and success rate tracking
- **Alert Delivery**: Notification delivery success monitoring
- **Data Quality**: Price data accuracy and consistency checks