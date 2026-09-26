export const CURRENCY_SYMBOL = '₹';

/**
 * Format a number to Indian Rupee (INR) representation using standard en-IN locale
 * e.g., ₹1,50,000.00 or ₹25,000
 */
export const formatINR = (
  amount: number,
  options?: {
    showDecimals?: boolean;
    compact?: boolean;
  }
): string => {
  const absVal = Math.abs(amount);
  const showDecimals = options?.showDecimals ?? true;

  if (options?.compact && absVal >= 10000000) {
    return `${CURRENCY_SYMBOL}${(absVal / 10000000).toFixed(1)}Cr`;
  }
  if (options?.compact && absVal >= 100000) {
    return `${CURRENCY_SYMBOL}${(absVal / 100000).toFixed(1)}L`;
  }
  if (options?.compact && absVal >= 1000) {
    return `${CURRENCY_SYMBOL}${(absVal / 1000).toFixed(1)}k`;
  }

  const formatted = absVal.toLocaleString('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  return `${CURRENCY_SYMBOL}${formatted}`;
};
