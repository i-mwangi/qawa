/**
 * Vercel Serverless Function Entry Point
 * Single entry point for all API routes to stay within Hobby plan limits
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// For now, return a simple response
// TODO: Refactor server.ts to export a request handler instead of creating HTTP server
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';

  // Health check endpoint
  if (url.includes('/health')) {
    return res.status(200).json({ 
      success: true, 
      message: 'API is running',
      timestamp: new Date().toISOString()
    });
  }

  // Groves endpoint - return empty array so frontend uses hardcoded data
  if (url.includes('/groves')) {
    return res.status(200).json({ 
      success: true,
      groves: [],
      message: 'Using client-side grove data'
    });
  }

  // Market overview endpoint - return mock data
  if (url.includes('/market/overview')) {
    return res.status(200).json({
      success: true,
      totalGroves: 42,
      totalInvestors: 156,
      totalFarmers: 89,
      totalValueLocked: 2450000,
      averageYield: 8.5
    });
  }

  // Market prices endpoint - return mock data
  if (url.includes('/market/prices')) {
    return res.status(200).json({
      success: true,
      prices: {
        coffee: 4.25,
        arabica: 4.50,
        robusta: 2.80
      },
      lastUpdated: new Date().toISOString()
    });
  }

  // Return 501 for other routes until full migration
  return res.status(501).json({ 
    error: 'API migration in progress',
    message: 'This endpoint is being migrated to serverless architecture'
  });
}
