import { twMerge } from "tailwind-merge";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={twMerge("bg-white border border-slate-200 rounded-xl p-4 md:p-6 shadow-sm hover:shadow-md transition-shadow", className)}>
            {children}
        </div>
    );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <h3 className={twMerge("text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2", className)}>
            {children}
        </h3>
    );
}
// Basic Button Component
export function Button({
    children,
    onClick,
    className,
    variant = 'primary',
    size = 'md',
    disabled = false
}: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
}) {
    const baseStyles = "font-bold rounded-lg transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center";

    const variants = {
        primary: "bg-brand-primary text-white hover:bg-sky-900 shadow-lg shadow-sky-900/10",
        secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
        outline: "bg-white border-2 border-slate-200 text-slate-600 hover:border-brand-primary hover:text-brand-primary",
        danger: "bg-red-50 text-red-600 hover:bg-red-100",
        ghost: "bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"
    };

    const sizes = {
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
        lg: "px-6 py-3 text-base"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={twMerge(baseStyles, variants[variant], sizes[size], className)}
        >
            {children}
        </button>
    );
}
