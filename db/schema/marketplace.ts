import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { coffeeGroves } from "./index";

export const marketplaceListings = sqliteTable("marketplace_listings", {
    id: text("id").primaryKey().notNull(),
    sellerAddress: text("seller_address").notNull(),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    tokenAddress: text("token_address").notNull(),
    tokenAmount: integer("token_amount").notNull(),
    pricePerToken: integer("price_per_token").notNull(), // USDC cents
    totalPrice: integer("total_price").notNull(), // USDC cents
    status: text("status").notNull().default("active"), // active, sold, cancelled, expired
    createdAt: integer("created_at").notNull().default(Date.now()),
    expiresAt: integer("expires_at"),
    soldAt: integer("sold_at"),
    buyerAddress: text("buyer_address"),
    transactionHash: text("transaction_hash")
}, (table) => ({
    sellerIdx: index("idx_marketplace_listings_seller").on(table.sellerAddress),
    groveIdx: index("idx_marketplace_listings_grove").on(table.groveId),
    statusIdx: index("idx_marketplace_listings_status").on(table.status),
    createdIdx: index("idx_marketplace_listings_created").on(table.createdAt)
}));

export const marketplaceTrades = sqliteTable("marketplace_trades", {
    id: text("id").primaryKey().notNull(),
    listingId: text("listing_id").notNull().references(() => marketplaceListings.id),
    sellerAddress: text("seller_address").notNull(),
    buyerAddress: text("buyer_address").notNull(),
    groveId: integer("grove_id").notNull().references(() => coffeeGroves.id),
    tokenAddress: text("token_address").notNull(),
    tokenAmount: integer("token_amount").notNull(),
    pricePerToken: integer("price_per_token").notNull(),
    totalPrice: integer("total_price").notNull(),
    transactionHash: text("transaction_hash"),
    blockExplorerUrl: text("block_explorer_url"),
    tradedAt: integer("traded_at").notNull().default(Date.now())
}, (table) => ({
    sellerIdx: index("idx_marketplace_trades_seller").on(table.sellerAddress),
    buyerIdx: index("idx_marketplace_trades_buyer").on(table.buyerAddress),
    groveIdx: index("idx_marketplace_trades_grove").on(table.groveId),
    dateIdx: index("idx_marketplace_trades_date").on(table.tradedAt)
}));

export const marketplaceEscrow = sqliteTable("marketplace_escrow", {
    id: text("id").primaryKey().notNull(),
    listingId: text("listing_id").notNull().unique().references(() => marketplaceListings.id),
    sellerAddress: text("seller_address").notNull(),
    tokenAddress: text("token_address").notNull(),
    tokenAmount: integer("token_amount").notNull(),
    status: text("status").notNull().default("held"), // held, released, returned
    createdAt: integer("created_at").notNull().default(Date.now()),
    releasedAt: integer("released_at")
}, (table) => ({
    sellerIdx: index("idx_marketplace_escrow_seller").on(table.sellerAddress),
    statusIdx: index("idx_marketplace_escrow_status").on(table.status)
}));
