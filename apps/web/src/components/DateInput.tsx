interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  isClearable?: boolean;
  onBlur?: () => void;
}

export default function DateInput({ value, onChange, className, disabled, onBlur }: DateInputProps) {
  return <input type="date" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} className={className || 'w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#111844]'} />;
}
