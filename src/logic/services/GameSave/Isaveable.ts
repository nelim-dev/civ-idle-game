export interface ISaveable{
        serializeForSave(): Record<string, any>;
        deserializeForSave(data: Record<string, any>): void;
}