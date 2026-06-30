interface PersonAvatarProps {
  email?: string;
  avatarUrl?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

function emailInitials(email?: string): string {
  if (!email) return "?";
  return email[0]?.toUpperCase() ?? "?";
}

export function PersonAvatar({
  email,
  avatarUrl,
  size = "md",
}: PersonAvatarProps) {
  const cls = sizeClasses[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={email ?? "User avatar"}
        className={`${cls} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${cls} rounded-full bg-blue-600 flex items-center justify-center text-white font-medium`}
    >
      {emailInitials(email)}
    </div>
  );
}
