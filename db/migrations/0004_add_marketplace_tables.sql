-- Secondary Marketplace Tables
-- Enables peer-to-peer trading of grove tokens

-- Marketplace Listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
    id TEXT PRIMARY KEY NOT NULL,
    seller_address TEXT NOT NULL,
    grove_id INTEGER NOT NULL,
    token_address TEXT NOT NULL,
    token_amount INTEGER NOT NULL,
    price_per_token INTEGER NOT NULL, -- Price in USDC cents
    total_price INTEGER NOT NULL, -- Total price in USDC cents
    status TEXT NOT NULL DEFAULT 'active', -- active, sold, cancelled, expired
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER, -- Optional expiration timestamp
    sold_at INTEGER,
    buyer_address TEXT,
    transaction_hash TEXT,
    FOREIGN KEY (grove_id) REFERENCES coffee_groves(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_seller ON marketplace_listings(seller_address);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_grove ON marketplace_listings(grove_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_status ON marketplace_listings(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_listings_created ON marketplace_listings(created_at);

-- Marketplace Trades (completed transactions)
CREATE TABLE IF NOT EXISTS marketplace_trades (
    id TEXT PRIMARY KEY NOT NULL,
    listing_id TEXT NOT NULL,
    seller_address TEXT NOT NULL,
    buyer_address TEXT NOT NULL,
    grove_id INTEGER NOT NULL,
    token_address TEXT NOT NULL,
    token_amount INTEGER NOT NULL,
    price_per_token INTEGER NOT NULL,
    total_price INTEGER NOT NULL,
    transaction_hash TEXT,
    block_explorer_url TEXT,
    traded_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE,
    FOREIGN KEY (grove_id) REFERENCES coffee_groves(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketplace_trades_seller ON marketplace_trades(seller_address);
CREATE INDEX IF NOT EXISTS idx_marketplace_trades_buyer ON marketplace_trades(buyer_address);
CREATE INDEX IF NOT EXISTS idx_marketplace_trades_grove ON marketplace_trades(grove_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_trades_date ON marketplace_trades(traded_at);

-- Marketplace Escrow (tokens held during listing)
CREATE TABLE IF NOT EXISTS marketplace_escrow (
    id TEXT PRIMARY KEY NOT NULL,
    listing_id TEXT NOT NULL UNIQUE,
    seller_address TEXT NOT NULL,
    token_address TEXT NOT NULL,
    token_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'held', -- held, released, returned
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    released_at INTEGER,
    FOREIGN KEY (listing_id) REFERENCES marketplace_listings(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_marketplace_escrow_seller ON marketplace_escrow(seller_address);
CREATE INDEX IF NOT EXISTS idx_marketplace_escrow_status ON marketplace_escrow(status);
