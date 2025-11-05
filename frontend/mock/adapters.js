// Mock adapters file to resolve missing import issue
// This is a workaround for the missing @reown/appkit/adapters export

console.warn('Using mock adapters file for @reown/appkit/adapters');

// Export proper classes to prevent inheritance errors
export class AdapterBlueprint {
  constructor(params) {
    // Mock implementation
  }
}

export class UniversalAdapter {
  // Mock implementation
}

export const WcHelpersUtil = {};

export default {};