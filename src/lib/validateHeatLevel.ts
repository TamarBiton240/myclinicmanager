export const validateHeatLevel = (value: string): number => {
  const num = parseFloat(value);
  if (isNaN(num)) {
    throw new Error("רמת חום חייבת להיות מספר תקין");
  }
  if (num < 0 || num > 100) {
    throw new Error("רמת חום חייבת להיות בין 0 ל-100");
  }
  return num;
};
