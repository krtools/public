export interface RowLineProps {
  up?: boolean;
  down?: boolean;
  dotClassName?: string;
  lineClassName?: string;
};

export function RowLine({
  up,
  down,
  dotClassName = 'bg-slate-600',
  lineClassName = 'bg-slate-400',
}: RowLineProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {up && (
        <div
          className={`absolute top-0 bottom-1/2 w-px ${lineClassName}`}
        />
      )}

      {down && (
        <div
          className={`absolute top-1/2 bottom-0 w-px ${lineClassName}`}
        />
      )}

      <div
        className={`w-2 h-2 rounded-full z-10 ${dotClassName}`}
      />
    </div>
  );
}
