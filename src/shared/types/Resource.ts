/**
 * Wire-формат ресурса: то, что приходит из JSON-данных или сейва.
 * Все числовые поля — строки, потому что Decimal сериализуется в строку.
 * Тип используется и логикой, и store/UI, поэтому живёт в shared.
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
    renewRate: string
}
