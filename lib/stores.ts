import Store from "./store";



export const indexingStore = Store.init("indexing")

export const issuerFireStore = Store.init("issuerFire")
export const lenderFireStore = Store.init("lenderFire")

// Coffee-specific stores
export const coffeeTreeFireStore = Store.init("coffeeTreeFire")
export const farmerVerificationFireStore = Store.init("farmerVerificationFire")
export const treeHealthFireStore = Store.init("treeHealthFire")