import { initials } from "@cybernetic/utils";

interface PersonAvatarProps {
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
};

export function PersonAvatar({
  firstName,
  lastName,
  avatarUrl,
  size = "md",
}: PersonAvatarProps) {
  const cls = sizeClasses[size];

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${firstName} ${lastName}`}
        className={`${cls} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${cls} rounded-full bg-blue-600 flex items-center justify-center text-white font-medium`}
    >
      {initials(firstName, lastName)}
    </div>
  );
}
