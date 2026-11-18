import { AvatarPhoto } from "@/components/common/avatar-photo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/text/initials";
import { cn } from "@/lib/utils";

type InitialsAvatarProps = {
  name: string;
  /** App URL of a private picture; the initials show while it loads, when absent or broken. */
  src?: string | null;
  className?: string;
};

/**
 * Person avatar with Vietnamese-aware initials as the default (idea.md §10.1).
 * Decorative: the name is always shown next to it, so screen readers skip the initials.
 */
export function InitialsAvatar({ name, src, className }: InitialsAvatarProps) {
  return (
    <Avatar aria-hidden className={cn("size-10", className)}>
      <AvatarFallback className="font-medium">{getInitials(name)}</AvatarFallback>
      {src ? <AvatarPhoto src={src} /> : null}
    </Avatar>
  );
}
