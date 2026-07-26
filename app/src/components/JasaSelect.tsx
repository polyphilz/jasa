import { Select } from "@base-ui-components/react/select";
import { cn } from "../lib/cn";
import { CheckIcon } from "./icons";

export type JasaSelectOption<Value extends string> = {
  value: Value;
  label: string;
};

/**
 * jasa's dropdown: Base UI Select for keyboard/focus/ARIA behavior, styled
 * after dara's trigger + popover listbox pattern.
 */
export const JasaSelect = <Value extends string>({
  ariaLabel,
  value,
  onChange,
  options,
  triggerClassName,
}: {
  ariaLabel: string;
  value: Value;
  onChange: (value: Value) => void;
  options: readonly JasaSelectOption<Value>[];
  triggerClassName?: string;
}) => (
  <Select.Root
    items={options}
    value={value}
    onValueChange={(next) => {
      if (typeof next === "string") {
        onChange(next as Value);
      }
    }}
  >
    <Select.Trigger
      aria-label={ariaLabel}
      className={cn(
        "inline-flex min-w-24 cursor-pointer items-center justify-between gap-1.5 rounded-md border border-line bg-surface/70 py-1 pr-1.5 pl-2 text-xs font-semibold text-ink transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent data-[popup-open]:border-accent data-[popup-open]:bg-accent-soft",
        triggerClassName,
      )}
    >
      <Select.Value />
      <Select.Icon className="flex text-muted">
        <svg aria-hidden="true" viewBox="0 0 10 6" className="h-1.5 w-2.5">
          <path
            d="M1 1 5 5 9 1"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50 outline-none">
        <Select.Popup className="flex max-h-64 min-w-[var(--anchor-width)] flex-col gap-0.5 overflow-y-auto rounded-[10px] border border-line-strong bg-surface p-1 shadow-2xl">
          {options.map((option) => (
            <Select.Item
              key={option.value}
              value={option.value}
              className="flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-3 pl-2 text-xs font-semibold text-ink/90 outline-none select-none data-highlighted:bg-accent-soft data-highlighted:text-ink"
            >
              <Select.ItemIndicator
                keepMounted
                className="w-3.5 text-accent opacity-0 data-selected:opacity-100"
              >
                <CheckIcon className="size-3" />
              </Select.ItemIndicator>
              <Select.ItemText>{option.label}</Select.ItemText>
            </Select.Item>
          ))}
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
);
