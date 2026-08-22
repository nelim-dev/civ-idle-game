import { useGameStore } from "@/store/gameStore";
import { ResourceData } from "@/logic/services/Economy/ResourceSystem/Resource";
import Decimal from "break_infinity.js";

interface ResourceItemProps {
    resource: ResourceData;
}

export function ResourceItem({ resource }: ResourceItemProps) {
    const balanceHistory = useGameStore((state) => state.economy.balanceHistory[resource.id]);
    const lastEntry = balanceHistory?.[balanceHistory.length - 1];

    const storage = new Decimal(resource.storage);
    const count = new Decimal(resource.count);
    const percent = storage.gt(new Decimal(0)) ? (count.dividedBy(storage).times(new Decimal(100))) : new Decimal(0);
    let clampedPercent: Decimal;
    if (percent.gt(new Decimal(100))) {
        clampedPercent = new Decimal(100);
    } else {
        clampedPercent = percent;
    }
    const balanceTooltip = lastEntry
        ? `Доход: ${lastEntry.income} | Расход: ${lastEntry.expense}`
        : 'Нет данных';

    return (
        <div className="flex flex-col gap-1 p-2 bg-black rounded shadow-sm">
            <div className="flex justify-between items-center">
                <span className="font-medium" title={resource.description}> {resource.name}</span>
                <span className="text-sm text-black-600" title={balanceTooltip}>{resource.count}</span>
            </div>
            <div className="relative w-full h-6 bg-gray-200 rounded overflow-hidden">
                <div
                    className="h-full bg-blue-500 transition-all"
                    style={{ width: `${clampedPercent.toNumber()}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white [text-shadow:_0_1px_2px_rgb(0_0_0_/_0.8)]">
                    {resource.count} / {resource.storage === '0' ? '∞' : resource.storage}
                </div>
            </div>
        </div>
    )
}