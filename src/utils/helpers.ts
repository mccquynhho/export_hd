/**
 * Sleep utility function
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry logic with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(delay * Math.pow(2, i)); // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Get i18n message
 */
export const getMessage = (key: string, substitutions?: string | string[]): string => {
  return chrome.i18n.getMessage(key, substitutions) || key;
};


/**
 * Get the last completed quarter date range
 * Current time: 2026-01-29, so last completed quarter is Q4 2025 (Oct 1 - Dec 31, 2025)
 */
export function getLastQuarterRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-11
  const currentYear = now.getFullYear();

  // Determine which quarter we're in and calculate last completed quarter
  let lastQuarter: number;
  let year: number;

  if (currentMonth < 3) {
    // Q1 (Jan-Mar) -> Last completed is Q4 of previous year
    lastQuarter = 4;
    year = currentYear - 1;
  } else if (currentMonth < 6) {
    // Q2 (Apr-Jun) -> Last completed is Q1
    lastQuarter = 1;
    year = currentYear;
  } else if (currentMonth < 9) {
    // Q3 (Jul-Sep) -> Last completed is Q2
    lastQuarter = 2;
    year = currentYear;
  } else {
    // Q4 (Oct-Dec) -> Last completed is Q3
    lastQuarter = 3;
    year = currentYear;
  }

  // Calculate start and end months for the quarter
  const startMonth = (lastQuarter - 1) * 3; // 0, 3, 6, 9
  const endMonth = startMonth + 2; // 2, 5, 8, 11

  // Create dates
  const startDate = new Date(year, startMonth, 1);
  const endDate = new Date(year, endMonth + 1, 0); // Last day of end month

  // Format as YYYY-MM-DD
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
}