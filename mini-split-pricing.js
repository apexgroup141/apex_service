export const MINI_SPLIT_PRICE_RANGES = {
  "1": { good: "$5,000–$6,000", better: "$6,000–$7,000", best: "$7,000+" },
  "2": { good: "$6,500–$8,000", better: "$8,000–$9,500", best: "$9,500–$11,000" },
  "3": { good: "$8,000–$9,500", better: "$9,500–$11,000", best: "$11,000–$13,000" },
  "4_plus": { good: "From $11,000", better: "From $13,000", best: "From $15,000" }
};

export const getMiniSplitPriceRanges = (zones) => MINI_SPLIT_PRICE_RANGES[zones] || null;
