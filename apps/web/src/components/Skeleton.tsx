interface SkeletonProps {
  className?: string;
  count?: number;
}

export default function Skeleton({ className = '', count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={`ui-skeleton ${className}`} aria-hidden="true" />
      ))}
    </>
  );
}
