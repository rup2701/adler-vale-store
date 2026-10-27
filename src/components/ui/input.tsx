import * as React from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "block w-full border border-[#8a847c] bg-white px-3 py-2 text-base text-foreground placeholder:text-[#6f6a64] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:border-2";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type, ...props }, ref) => (
  <input type={type} className={cn(fieldClass, "h-11", className)} ref={ref} {...props} />
));
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea className={cn(fieldClass, "min-h-24", className)} ref={ref} {...props} />
));
Textarea.displayName = "Textarea";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select className={cn(fieldClass, "h-11", className)} ref={ref} {...props} />
));
Select.displayName = "Select";

export { Input, Textarea, Select };
