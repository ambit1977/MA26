import type { ButtonHTMLAttributes, ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/classNames";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-slate-200 bg-white shadow-soft", className)} {...props} />;
}

export function Button({
  className,
  variant = "solid",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "outline" | "ghost" }) {
  return (
    <button
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
        variant === "solid" && "bg-slate-950 text-white hover:bg-slate-800",
        variant === "outline" && "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
        variant === "ghost" && "bg-transparent text-slate-700 hover:bg-slate-100",
        className
      )}
      {...props}
    />
  );
}

export function SectionTitle({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ElementType;
  title: string;
  subtitle?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-800 ring-1 ring-cyan-100">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p>}
      </div>
    </div>
  );
}

export function Pill({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "min-h-10 shrink-0 rounded-full px-4 text-sm font-bold transition active:scale-[0.98]",
        active ? "bg-slate-950 text-white shadow-sm" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      )}
    >
      {children}
    </button>
  );
}
