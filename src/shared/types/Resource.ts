/**
 * Wire-формат ресурса: то, что приходит из JSON-данных или сейва.
 * Все числовые поля — строки, потому что Decimal сериализуется в строку.
 * Тип используется и логикой, и store/UI, поэтому живёт в shared.
 *
 * spoilRate, era и unlockResearch — контентные поля с документированными
 * значениями по умолчанию (0.01, 1 и null). Они необязательны в wire-формате,
 * чтобы старые сейвы и фикстуры оставались совместимыми.
 */
export interface ResourceData {
    id: string,
    name: string,
    description: string,
    count: string,
    storage: string,
    icon: string,
    open: boolean,
    owner: string,
    renewable: boolean,
    renewRate: string,
    spoilRate?: string,
    era?: string,
    unlockResearch?: string | null
}
