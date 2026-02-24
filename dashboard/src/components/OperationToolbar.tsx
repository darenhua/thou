export type OperationType = 'generate' | 'decompose' | 'variant' | 'join'

interface OperationToolbarProps {
  selectedCount: number
  onOperation: (type: OperationType) => void
}

const BUTTONS: {
  type: OperationType
  label: string
  icon: string
  bg: string
  hover: string
  requires: number
  disabledTooltip: string
}[] = [
    {
      type: 'generate',
      label: 'Generate',
      icon: '+',
      bg: 'bg-sky-600',
      hover: 'hover:bg-sky-700',
      requires: -1,
      disabledTooltip: '',
    },
    {
      type: 'decompose',
      label: 'Decompose',
      icon: '\u2193',
      bg: 'bg-teal-600',
      hover: 'hover:bg-teal-700',
      requires: 1,
      disabledTooltip: 'Select one node to decompose',
    },
    {
      type: 'variant',
      label: 'Variant',
      icon: '~',
      bg: 'bg-amber-600',
      hover: 'hover:bg-amber-700',
      requires: 1,
      disabledTooltip: 'Select one node to create variant',
    },
    {
      type: 'join',
      label: 'Join',
      icon: '\u2295',
      bg: 'bg-violet-600',
      hover: 'hover:bg-violet-700',
      requires: 2,
      disabledTooltip: 'Select exactly two nodes to join',
    },
  ]

function isEnabled(requires: number, selectedCount: number): boolean {
  if (requires === -1) return true
  return selectedCount === requires
}

export default function OperationToolbar({
  selectedCount,
  onOperation,
}: OperationToolbarProps) {
  return (
    <div className="flex gap-2 bg-white rounded-xl shadow-lg border border-gray-200 px-4 py-3">
      {BUTTONS.map(btn => {
        const enabled = isEnabled(btn.requires, selectedCount)
        return (
          <button
            key={btn.type}
            type="button"
            disabled={!enabled}
            title={enabled ? btn.label : btn.disabledTooltip}
            onClick={() => onOperation(btn.type)}
            className={`
              flex items-center gap-1.5 px-3 font-bold py-1.5 w-30 rounded-lg text-sm text-white
              transition-all duration-150
              ${enabled ? `${btn.bg} ${btn.hover} cursor-pointer` : 'bg-gray-300 cursor-not-allowed'}
            `}
          >
            {/* <span className="text-base leading-none">{btn.icon}</span> */}
            {btn.label}
          </button>
        )
      })}
    </div>
  )
}
