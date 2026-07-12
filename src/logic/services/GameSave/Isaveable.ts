export interface ISaveable{
        serializeForSave(): Record<string, any>;
        deserialize(data: Record<string, any>): void;
}