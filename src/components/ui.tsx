import * as Select from '@radix-ui/react-select'
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import {
  dirOf,
  type Certainty,
  type Consent,
  type SourceKind,
} from '../core'

/**
 * Make a clickable row keyboard-activatable like a button: focusable, with Enter
 * or Space triggering the action. Spread onto the row element:
 *   <div className="row" {...rowButton(() => select(id))}>
 * A keypress that bubbles up from a nested control (a real button inside the
 * row) is ignored via the target/currentTarget guard, so secondary buttons keep
 * their own behaviour.
 */
export function rowButton(onActivate: () => void) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    onClick: onActivate,
    onKeyDown: (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
        e.preventDefault()
        onActivate()
      }
    },
  }
}

/** A stat readout: a bold count followed by its noun, pluralized to match. */
export function Count({ n, noun }: { n: number; noun: string }) {
  return (
    <>
      <b>{n}</b> {n === 1 ? noun : `${noun}s`}
    </>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="field">
      <label className="label">{label}</label>
      {children}
      {hint && <span className="faint" style={{ fontSize: 13 }}>{hint}</span>}
    </div>
  )
}

/** Text that picks its own direction (and Arabic font) from its content. */
export function Dir({
  text,
  className,
  title,
}: {
  text: string
  className?: string
  title?: string
}) {
  return (
    <span dir={dirOf(text)} className={className} title={title}>
      {text}
    </span>
  )
}

export interface EnumOption<T extends string> {
  value: T
  label: string
}

/** A compact segmented control for short enums (precision, certainty, consent). */
export function EnumSeg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: EnumOption<T>[]
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
}) {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      data-on={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track">
        <span className="switch-thumb" />
      </span>
      {label && <span style={{ fontSize: 14 }}>{label}</span>}
    </button>
  )
}

/** Themed Radix Select for longer enums (source kind, incident type). */
export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: EnumOption<T>[]
  onChange: (v: T) => void
  ariaLabel?: string
}) {
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <Select.Trigger className="select-trigger" aria-label={ariaLabel}>
        <Select.Value />
        <Select.Icon>
          <span className="select-chevron" aria-hidden="true" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="select-content" position="popper" sideOffset={4}>
          <Select.Viewport>
            {options.map((o) => (
              <Select.Item key={o.value} value={o.value} className="select-item">
                <Select.ItemText>{o.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

const CONSENT_WORD: Record<Consent, string> = {
  public: 'Public',
  restricted: 'Restricted',
  embargoed: 'Embargoed',
}
const CERTAINTY_WORD: Record<Certainty, string> = {
  attested: 'Attested',
  probable: 'Probable',
  uncertain: 'Uncertain',
}

/** Consent as a word in the running text; withheld states read in the alert colour. */
export function ConsentBadge({ consent }: { consent: Consent }) {
  return <span className={`badge badge-${consent}`}>{CONSENT_WORD[consent]}</span>
}

export function CertaintyBadge({ certainty }: { certainty: Certainty }) {
  return <span className={`badge badge-${certainty}`}>{CERTAINTY_WORD[certainty]}</span>
}

const KIND_LABEL: Record<SourceKind, string> = {
  photograph: 'Photograph',
  'video-link': 'Video',
  document: 'Document',
  testimony: 'Testimony',
  audio: 'Audio',
}

export function kindLabel(kind: SourceKind): string {
  return KIND_LABEL[kind]
}

export function KindBadge({ kind }: { kind: SourceKind }) {
  return <span>{KIND_LABEL[kind]}</span>
}

/** Words joined with a middle dot, skipping the empty ones: "Photograph · Public". */
export function Meta({ parts }: { parts: ReactNode[] }) {
  const kept = parts.filter((p) => p !== null && p !== undefined && p !== false && p !== '')
  return (
    <>
      {kept.map((p, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {p}
        </span>
      ))}
    </>
  )
}

const CONSENT_MEANING: Record<Consent, string> = {
  public: 'Published with the reconstruction.',
  restricted: 'Kept in the project; never published.',
  embargoed: 'Held for the account only; never published.',
}

/** Consent as a choice, each option with its meaning beside it. */
export function ConsentChoice({ value, onChange }: { value: Consent; onChange: (c: Consent) => void }) {
  return (
    <div className="choice" role="radiogroup" aria-label="Who may see this">
      {(Object.keys(CONSENT_WORD) as Consent[]).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          className="choice-item"
          aria-checked={value === c}
          data-tone={c === 'public' ? undefined : 'alert'}
          onClick={() => onChange(c)}
        >
          <span className="choice-dot" aria-hidden="true" />
          <span>
            <span className="choice-name">{CONSENT_WORD[c]}</span>
            <span className="choice-desc">{CONSENT_MEANING[c]}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

export interface MenuEntry {
  label: string
  hint?: string
  onSelect?: () => void
  checked?: boolean
  danger?: boolean
  heading?: boolean
  separator?: boolean
}

/**
 * A small accessible menu: a button that opens a list of actions. Escape and a
 * click outside close it; arrow keys move between items.
 */
export function Menu({
  label,
  entries,
  align = 'right',
}: {
  label: string
  entries: MenuEntry[]
  /** Which edge of the button the list lines up with. */
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement | null>(null)
  const button = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    const first = wrap.current?.querySelector<HTMLButtonElement>('.menu-item')
    first?.focus()
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false)
      button.current?.focus()
      return
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const items = Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>('.menu-item') ?? [])
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
    items[next]?.focus()
  }

  return (
    <div className="menu-wrap" ref={wrap} onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        className="menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <div className={`menu menu-${align}`} role="menu" aria-label={label}>
          {entries.map((e, i) =>
            e.separator ? (
              <div key={i} className="menu-sep" role="separator" />
            ) : e.heading ? (
              <div key={i} className="menu-heading">
                {e.label}
              </div>
            ) : (
              <button
                key={i}
                type="button"
                role={e.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={e.checked}
                className={`menu-item${e.danger ? ' danger' : ''}`}
                onClick={() => {
                  setOpen(false)
                  e.onSelect?.()
                }}
              >
                <span>{e.label}</span>
                {e.hint && <span className="hint">{e.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}

// Shared option lists.
export const CONSENT_OPTIONS: EnumOption<Consent>[] = [
  { value: 'public', label: 'Public' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'embargoed', label: 'Embargoed' },
]

export const CERTAINTY_OPTIONS: EnumOption<Certainty>[] = [
  { value: 'attested', label: 'Attested' },
  { value: 'probable', label: 'Probable' },
  { value: 'uncertain', label: 'Uncertain' },
]

export const PRECISION_OPTIONS = [
  { value: 'second', label: 'Second' },
  { value: 'minute', label: 'Minute' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'approximate', label: 'Approximate' },
] as const

export const KIND_OPTIONS: EnumOption<SourceKind>[] = [
  { value: 'photograph', label: 'Photograph (file)' },
  { value: 'document', label: 'Document (file)' },
  { value: 'video-link', label: 'Video (link)' },
  { value: 'testimony', label: 'Testimony' },
  { value: 'audio', label: 'Audio (file)' },
]

export const INCIDENT_TYPE_OPTIONS = [
  { value: 'shelling', label: 'Shelling' },
  { value: 'fire', label: 'Fire' },
  { value: 'raid', label: 'Raid' },
  { value: 'demolition', label: 'Demolition' },
  { value: 'protest', label: 'Protest' },
  { value: 'looting', label: 'Looting' },
  { value: 'destruction-of-work', label: 'Destruction of a work' },
  { value: 'dispersal', label: 'Dispersal of images' },
  { value: 'other', label: 'Other' },
] as const
