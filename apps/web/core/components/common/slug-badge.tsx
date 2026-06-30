interface SlugBadgeProps {
  id: string;
}

export function SlugBadge({ id }: SlugBadgeProps) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono font-medium bg-gray-100 text-gray-600">
      {id}
    </span>
  );
}
