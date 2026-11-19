export interface Saveable{
        serializeForSave(): Record<string, any>;
        deserializeForSave(data: Record<string, any>): void;
}