export interface Population{
    "id": string,
    "name": string,
    "icon": string,
    "description": string,
    "count": string,
    "housingRequired": string,
    "consumes": Record<string,string>,
    "growth": GrowthData,
    "mortality": MortalityData,
    "rebellion": RebellionData,
    "open": boolean
}

interface GrowthData{
      "currentGrowth": string,
      "baseRate": string,
      "foodBonus": string,
      "housingBonus": string,
      "maxGrowthRate": string
}

interface MortalityData{
      "currentMortality": string,
      "baseRate": string,
      "foodPenalty": string,
      "waterPenalty": string,
      "housingPenalty": string,
      "maxMortalityRate": string
}

interface RebellionData{
      "currentRebellion": string, 
      "threshold": string,
      "foodPenalty": string,
      "housingPenalty": string,
      "waterPenalty": string
}