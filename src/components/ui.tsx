import * as Select from '@radix-ui/react-select'
import type { KeyboardEvent, ReactNode } from 'react'
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
      {hint && <span className="faint" style={{ fontSize: 11 }}>{hint}</span>}
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
      {label && <span style={{ fontSize: 12 }}>{label}</span>}
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
        <Select.Icon>▾</Select.Icon>
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

export function ConsentBadge({ consent }: { consent: Consent }) {
  return <span className={`badge badge-${consent}`}>{consent}</span>
}

export function CertaintyBadge({ certainty }: { certainty: Certainty }) {
  return <span className={`badge badge-${certainty}`}>{certainty}</span>
}

const KIND_LABEL: Record<SourceKind, string> = {
  photograph: 'PHOTO',
  'video-link': 'VIDEO',
  document: 'DOC',
  testimony: 'TESTIMONY',
  audio: 'AUDIO',
}

export function KindBadge({ kind }: { kind: SourceKind }) {
  return (
    <span className="row-sub" style={{ margin: 0 }}>
      <span className="kind-dot" />
      {KIND_LABEL[kind]}
    </span>
  )
}

// Shared option lists.
export const CONSENT_OPTIONS: EnumOption<Consent>[] = [
  { value: 'public', label: 'PUBLIC' },
  { value: 'restricted', label: 'RESTRICTED' },
  { value: 'embargoed', label: 'EMBARGOED' },
]

export const CERTAINTY_OPTIONS: EnumOption<Certainty>[] = [
  { value: 'attested', label: 'ATTESTED' },
  { value: 'probable', label: 'PROBABLE' },
  { value: 'uncertain', label: 'UNCERTAIN' },
]

export const PRECISION_OPTIONS = [
  { value: 'minute', label: 'MIN' },
  { value: 'hour', label: 'HOUR' },
  { value: 'day', label: 'DAY' },
  { value: 'approximate', label: 'APPROX' },
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
