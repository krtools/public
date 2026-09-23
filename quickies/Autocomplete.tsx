import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useCombobox, useMultipleSelection, type UseComboboxPropGetters } from 'downshift'

export type ItemSource<T> =
  | {
      items: readonly T[]
      /** Local filter. Default: case-insensitive substring match on itemToString. */
      filter?: (items: readonly T[], query: string) => T[]
      getItems?: never
      debounceMs?: never
      minQueryLength?: never
    }
  | {
      /** Called with the typed text. The signal aborts when a newer query starts or the component unmounts. */
      getItems: (query: string, signal: AbortSignal) => Promise<T[]>
      /** Wait this long after typing stops before calling getItems. Default: 250. */
      debounceMs?: number
      /** Don't call getItems below this length. Default: 1. */
      minQueryLength?: number
      items?: never
      filter?: never
    }

export type AutocompleteSlot =
  | 'root'
  | 'label'
  | 'control'
  | 'input'
  | 'menu'
  | 'item'
  | 'message'
  | 'highlight'
  | 'chip'
  | 'chipRemove'

export interface ItemRenderState {
  query: string
  active: boolean
  selected: boolean
}

export type AutocompleteBaseProps<T> = ItemSource<T> & {
  itemToString: (item: T) => string
  itemToKey: (item: T) => string
  label: ReactNode
  placeholder?: string
  disabled?: boolean
  id?: string
  renderItem?: (item: T, state: ItemRenderState) => ReactNode
  emptyMessage?: ReactNode
  loadingMessage?: ReactNode
  errorMessage?: ReactNode | ((error: unknown) => ReactNode)
  /** Tailwind classes per part. A slot you pass replaces that slot's defaults. */
  classNames?: Partial<Record<AutocompleteSlot, string>>
}

export type AutocompleteProps<T> = AutocompleteBaseProps<T> & {
  value: T | null
  onChange: (value: T | null) => void
}

export type MultiAutocompleteProps<T> = AutocompleteBaseProps<T> & {
  value: T[]
  onChange: (value: T[]) => void
  /** Leave selected items out of the list. Default: true. */
  hideSelected?: boolean
  renderChip?: (item: T, remove: () => void) => ReactNode
}

// State styling uses data attributes (`data-active:`, `data-selected:`) so the
// class strings stay static and callers can override them per slot.
const DEFAULT_CLASSES: Record<AutocompleteSlot, string> = {
  root: 'relative',
  label: 'mb-1.5 block text-sm font-semibold',
  control:
    'flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2 py-1.5 focus-within:border-blue-600 focus-within:ring-3 focus-within:ring-blue-600/20',
  input: 'min-w-20 flex-[1_1_120px] bg-transparent p-1 outline-none disabled:cursor-not-allowed',
  menu: 'absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-zinc-300 bg-white p-1 shadow-lg',
  item: 'flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 data-active:bg-blue-50',
  message: 'px-3 py-2.5 text-sm text-zinc-500',
  highlight: 'rounded-xs bg-yellow-200 text-inherit',
  chip: 'inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-zinc-100 py-0.5 pr-1 pl-2 text-sm',
  chipRemove:
    'cursor-pointer rounded-full px-1 text-base leading-none text-zinc-500 hover:bg-zinc-300 hover:text-zinc-900',
}

type Classes = (slot: AutocompleteSlot) => string

function useClasses(classNames: AutocompleteBaseProps<unknown>['classNames']): Classes {
  return (slot) => classNames?.[slot] ?? DEFAULT_CLASSES[slot]
}

export function HighlightMatch({ text, query, className }: { text: string; query: string; className?: string }) {
  const q = query.trim()
  const start = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1
  if (start < 0) return <>{text}</>
  const end = start + q.length
  return (
    <>
      {text.slice(0, start)}
      <mark className={className ?? DEFAULT_CLASSES.highlight}>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface ItemsState<T> {
  items: T[]
  status: Status
  error: unknown
}

/**
 * Resolves the visible items for either source. `open` gates async fetching so
 * the single input filling in the selected label doesn't trigger a request.
 */
function useItems<T>(props: AutocompleteBaseProps<T>, query: string, open: boolean): ItemsState<T> {
  const { items, filter, getItems, debounceMs = 250, minQueryLength = 1, itemToString } = props
  const isAsync = getItems !== undefined

  // Callers usually pass inline functions; keep the latest without refetching on every render.
  const getItemsRef = useRef(getItems)
  getItemsRef.current = getItems

  const [asyncState, setAsyncState] = useState<ItemsState<T>>({ items: [], status: 'idle', error: undefined })

  useEffect(() => {
    const load = getItemsRef.current
    if (!load || !open) return
    if (query.length < minQueryLength) {
      setAsyncState({ items: [], status: 'idle', error: undefined })
      return
    }
    // Previous results stay visible (with aria-busy) until the new ones land.
    setAsyncState((s) => ({ ...s, status: 'loading', error: undefined }))
    const controller = new AbortController()
    const timer = setTimeout(() => {
      load(query, controller.signal).then(
        (result) => {
          if (!controller.signal.aborted) setAsyncState({ items: result, status: 'ready', error: undefined })
        },
        (error: unknown) => {
          // A rejection caused by our own abort is expected, not an error.
          if (!controller.signal.aborted) setAsyncState({ items: [], status: 'error', error })
        },
      )
    }, debounceMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [isAsync, open, query, debounceMs, minQueryLength])

  const localItems = useMemo(() => {
    if (!items) return []
    if (filter) return filter(items, query)
    const q = query.trim().toLowerCase()
    return items.filter((item) => itemToString(item).toLowerCase().includes(q))
  }, [items, filter, query, itemToString])

  return isAsync ? asyncState : { items: localItems, status: 'ready', error: undefined }
}

interface MenuProps<T> extends Pick<UseComboboxPropGetters<T>, 'getMenuProps' | 'getItemProps'> {
  base: AutocompleteBaseProps<T>
  isOpen: boolean
  highlightedIndex: number
  query: string
  state: ItemsState<T>
  isSelected: (item: T) => boolean
  cls: Classes
}

function Menu<T>({ base, isOpen, highlightedIndex, query, state, isSelected, cls, getMenuProps, getItemProps }: MenuProps<T>) {
  const { items, status, error } = state
  const {
    itemToString,
    itemToKey,
    renderItem,
    emptyMessage = 'No results',
    loadingMessage = 'Loading…',
    errorMessage = "Couldn't load results",
  } = base

  // Async sources below minQueryLength report 'idle': keep the menu closed rather than "No results".
  const visible = isOpen && status !== 'idle'
  let message: ReactNode = null
  if (status === 'error') message = typeof errorMessage === 'function' ? errorMessage(error) : errorMessage
  else if (items.length === 0) message = status === 'loading' ? loadingMessage : emptyMessage

  return (
    <ul className={cls('menu')} {...getMenuProps({ 'aria-busy': status === 'loading' })} hidden={!visible}>
      {visible &&
        (message !== null ? (
          <li className={cls('message')} role="status">
            {message}
          </li>
        ) : (
          items.map((item, index) => {
            const active = highlightedIndex === index
            const selected = isSelected(item)
            return (
              <li
                key={itemToKey(item)}
                className={cls('item')}
                data-active={active || undefined}
                data-selected={selected || undefined}
                {...getItemProps({ item, index })}
              >
                {renderItem ? (
                  renderItem(item, { query, active, selected })
                ) : (
                  <>
                    <span className="flex-1">
                      <HighlightMatch text={itemToString(item)} query={query} className={cls('highlight')} />
                    </span>
                    {selected && <span aria-hidden="true">✓</span>}
                  </>
                )}
              </li>
            )
          })
        ))}
    </ul>
  )
}

export function Autocomplete<T>(props: AutocompleteProps<T>) {
  const { value, onChange, itemToString, itemToKey, label, placeholder, disabled, id, classNames } = props
  const cls = useClasses(classNames)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const state = useItems(props, query, open)

  const { isOpen, highlightedIndex, getLabelProps, getInputProps, getMenuProps, getItemProps } = useCombobox<T>({
    items: state.items,
    itemToString: (item) => (item ? itemToString(item) : ''),
    itemToKey: (item) => (item ? itemToKey(item) : null),
    inputId: id,
    selectedItem: value,
    onSelectedItemChange: ({ selectedItem }) => onChange(selectedItem),
    onInputValueChange: ({ inputValue }) => setQuery(inputValue),
    onIsOpenChange: ({ isOpen }) => setOpen(isOpen),
  })

  const selectedKey = value === null ? null : itemToKey(value)

  return (
    <div className={cls('root')}>
      <label className={cls('label')} {...getLabelProps()}>
        {label}
      </label>
      <div className={cls('control')}>
        <input className={cls('input')} placeholder={placeholder} {...getInputProps({ disabled })} />
      </div>
      <Menu
        base={props}
        isOpen={isOpen}
        highlightedIndex={highlightedIndex}
        query={query}
        state={state}
        isSelected={(item) => itemToKey(item) === selectedKey}
        cls={cls}
        getMenuProps={getMenuProps}
        getItemProps={getItemProps}
      />
    </div>
  )
}

export function MultiAutocomplete<T>(props: MultiAutocompleteProps<T>) {
  const {
    value,
    onChange,
    itemToString,
    itemToKey,
    label,
    placeholder,
    disabled,
    id,
    classNames,
    hideSelected = true,
    renderChip,
  } = props
  const cls = useClasses(classNames)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const source = useItems(props, query, open)

  const selectedKeys = useMemo(() => new Set(value.map(itemToKey)), [value, itemToKey])
  const state = hideSelected
    ? { ...source, items: source.items.filter((item) => !selectedKeys.has(itemToKey(item))) }
    : source

  const { getSelectedItemProps, getDropdownProps, removeSelectedItem } = useMultipleSelection<T>({
    selectedItems: value,
    itemToKey: (item) => (item ? itemToKey(item) : null),
    // Covers Backspace in an empty input and Backspace/Delete on a focused chip.
    onSelectedItemsChange: ({ selectedItems }) => onChange(selectedItems),
  })

  const { isOpen, highlightedIndex, getLabelProps, getInputProps, getMenuProps, getItemProps } = useCombobox<T>({
    items: state.items,
    itemToString: (item) => (item ? itemToString(item) : ''),
    itemToKey: (item) => (item ? itemToKey(item) : null),
    inputId: id,
    inputValue: query,
    // Selection lives in useMultipleSelection; the combobox itself never holds one.
    selectedItem: null,
    onIsOpenChange: ({ isOpen }) => setOpen(isOpen),
    stateReducer: (_state, { changes, type }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
          // Keep the menu open for further picks.
          return { ...changes, isOpen: true }
        default:
          return changes
      }
    },
    onStateChange: ({ type, selectedItem, inputValue }) => {
      switch (type) {
        case useCombobox.stateChangeTypes.InputKeyDownEnter:
        case useCombobox.stateChangeTypes.ItemClick:
        case useCombobox.stateChangeTypes.InputBlur:
          if (selectedItem) {
            const key = itemToKey(selectedItem)
            onChange(
              selectedKeys.has(key) ? value.filter((i) => itemToKey(i) !== key) : [...value, selectedItem],
            )
            setQuery('')
          }
          break
        case useCombobox.stateChangeTypes.InputChange:
          setQuery(inputValue ?? '')
          break
      }
    },
  })

  return (
    <div className={cls('root')}>
      <label className={cls('label')} {...getLabelProps()}>
        {label}
      </label>
      <div className={cls('control')}>
        {value.map((item, index) => {
          const remove = () => removeSelectedItem(item)
          return (
            <span
              key={itemToKey(item)}
              className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue-600/50"
              {...getSelectedItemProps({ selectedItem: item, index })}
            >
              {renderChip ? (
                renderChip(item, remove)
              ) : (
                <span className={cls('chip')}>
                  {itemToString(item)}
                  <button
                    type="button"
                    className={cls('chipRemove')}
                    aria-label={`Remove ${itemToString(item)}`}
                    disabled={disabled}
                    // Keep focus in the input so the click doesn't count as a blur.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      // Don't let the click reach the chip's selection handler.
                      e.stopPropagation()
                      remove()
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </span>
          )
        })}
        <input
          className={cls('input')}
          placeholder={value.length === 0 ? placeholder : undefined}
          {...getInputProps(getDropdownProps({ disabled }))}
        />
      </div>
      <Menu
        base={props}
        isOpen={isOpen}
        highlightedIndex={highlightedIndex}
        query={query}
        state={state}
        isSelected={(item) => selectedKeys.has(itemToKey(item))}
        cls={cls}
        getMenuProps={getMenuProps}
        getItemProps={getItemProps}
      />
    </div>
  )
}
