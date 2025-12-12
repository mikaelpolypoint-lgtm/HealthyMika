import { twMerge } from "tailwind-merge";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={twMerge("bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow", className)}>
            {children}
        </div>
    );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
            {children}
        </h3>
    );
}
