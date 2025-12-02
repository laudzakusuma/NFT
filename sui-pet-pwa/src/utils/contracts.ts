export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID!;
export const SHOP_ID = process.env.NEXT_PUBLIC_SHOP_ID!;
export const PET_TYPE = `${PACKAGE_ID}::core::Pet`;
export const FOOD_TYPE = `${PACKAGE_ID}::core::Food`;

console.log("Contract Config:", { PACKAGE_ID, PET_TYPE });