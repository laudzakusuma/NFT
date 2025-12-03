export const PACKAGE_ID = "0xa9e4cdb2e367b3fb6abbe4d0dcb42b768f2387426f12c5c1d4c6623305d9098e"; 
export const SHOP_ID = process.env.NEXT_PUBLIC_SHOP_ID || "0x030a6840d2d07b74d34dd2e86d2a13c912279eb68a4c8eb46252ddff31997186"; 
export const PET_TYPE = `${PACKAGE_ID}::core::Pet`;
export const FOOD_TYPE = `${PACKAGE_ID}::core::Food`;

console.log("Contract Config:", { PACKAGE_ID, PET_TYPE });