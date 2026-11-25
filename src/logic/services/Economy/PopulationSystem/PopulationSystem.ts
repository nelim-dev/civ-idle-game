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
    "open": boolean,
    "era": string
}

interface GrowthData{
      "baseRate": string,
      "foodBonus": string,
      "housingBonus": string,
      "maxGrowthRate": string
}

interface MortalityData{
      "baseRate": string,
      "foodPenalty": string,
      "waterPenalty": string,
      "housingPenalty": string,
      "maxMortalityRate": string
}

interface RebellionData{
      "threshold": string,
      "civilWarThreshold": string,
      "foodPenalty": string,
      "housingPenalty": string,
      "waterPenalty": string,
      "reliefRate": string,
      "strikeWorkerFactor": string,
      "civilWarChance": string,
      "civilWarLoss": string,
      "civilWarCooldown": string
}
