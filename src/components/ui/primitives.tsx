import {
  Dialog,
  DialogPanel,
  DialogTitle,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from '@headlessui/react'
import { Check, ChevronDown, X } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'ai' | 'ghost' | 'soft' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const variantClass: Record<ButtonVariant, string> = {
  primary: 'mg-button-primary',
  ai: 'mg-button-ai',
  ghost: 'mg-button-ghost',
  soft: 'mg-button-soft',
  danger: 'mg-button-danger',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'mg-button-sm',
  md: '',
  lg: 'mg-button-lg',
}

export function Button({
  variant = 'soft',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      {...props}
      className={cn('mg-button', variantClass[variant], sizeClass[size], className)}
    />
  )
}

export function IconButton({
  label,
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      {...props}
      aria-label={label}
      title={props.title ?? label}
      className={cn('mg-icon-button', active && 'mg-tool-active', className)}
    />
  )
}

export function ToolButton({
  label,
  active,
  shortcut,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  active?: boolean
  shortcut?: string
}) {
  return (
    <button
      {...props}
      aria-label={shortcut ? `${label} (${shortcut})` : label}
      title={shortcut ? `${label} (${shortcut})` : label}
      className={cn('mg-tool relative', active && 'mg-tool-active', className)}
    >
      {children}
      {shortcut && (
        <span className="absolute -right-1 -top-1 rounded bg-black/70 px-1 text-[8px] font-bold text-white/70">
          {shortcut}
        </span>
      )}
    </button>
  )
}

export function Panel({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return <div className={cn('mg-panel', className)}>{children}</div>
}

export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn('mg-pill', className)}>{children}</span>
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: ReactNode
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('mg-field', className)}>
      {label && <span className="mg-label">{label}</span>}
      {children}
      {hint && <span className="text-xs text-[var(--mg-dim)]">{hint}</span>}
    </label>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn('mg-control', className)} />
}

export function TextareaField({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('mg-control min-h-20 resize-y', className)} />
}

export interface OptionItem<T extends string = string> {
  value: T
  label: ReactNode
}

export function SelectField<T extends string>({
  value,
  options,
  onChange,
  className,
  buttonClassName,
}: {
  value: T
  options: Array<OptionItem<T>>
  onChange: (value: T) => void
  className?: string
  buttonClassName?: string
}) {
  const selected = options.find((option) => option.value === value) ?? options[0]

  return (
    <Listbox value={value} onChange={onChange}>
      <div className={cn('relative', className)}>
        <ListboxButton className={cn('mg-control flex items-center justify-between gap-2 text-left', buttonClassName)}>
          <span className="truncate">{selected?.label}</span>
          <ChevronDown size={14} className="shrink-0 text-[var(--mg-muted)]" aria-hidden="true" />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          className="mg-popover-list w-[var(--button-width)]"
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              className="mg-popover-item cursor-default"
            >
              {({ selected }) => (
                <>
                  <Check size={13} className={selected ? 'opacity-100' : 'opacity-0'} aria-hidden="true" />
                  <span className="truncate">{option.label}</span>
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  )
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  className,
}: {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-[200]">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 overflow-y-auto p-4">
        <div className="flex min-h-full items-center justify-center">
          <DialogPanel className={cn('mg-panel w-full max-w-lg p-5', className)}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
              <IconButton label="Close" onClick={onClose}>
                <X size={16} />
              </IconButton>
            </div>
            {children}
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  )
}

export function DropdownMenu({
  trigger,
  children,
  className,
}: {
  trigger: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <Menu>
      <MenuButton as="div">{trigger}</MenuButton>
      <MenuItems anchor="bottom end" className={cn('mg-popover-list', className)}>
        {children}
      </MenuItems>
    </Menu>
  )
}

export function DropdownItem({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  return (
    <MenuItem>
      <button className={cn('mg-popover-item', className)} onClick={onClick}>
        {children}
      </button>
    </MenuItem>
  )
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  children,
}: {
  value: T
  options: Array<OptionItem<T>>
  onChange: (value: T) => void
  children: ReactNode
}) {
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  return (
    <TabGroup selectedIndex={selectedIndex} onChange={(index) => onChange(options[index].value)}>
      <TabList className="inline-flex rounded-[8px] border border-[var(--mg-border)] bg-white/5 p-1">
        {options.map((option) => (
          <Tab
            key={option.value}
            className="rounded-[6px] px-3 py-1 text-xs font-bold text-[var(--mg-muted)] data-[selected]:bg-white/10 data-[selected]:text-[var(--mg-text)]"
          >
            {option.label}
          </Tab>
        ))}
      </TabList>
      <TabPanels>{children}</TabPanels>
    </TabGroup>
  )
}

export { TabPanel }
