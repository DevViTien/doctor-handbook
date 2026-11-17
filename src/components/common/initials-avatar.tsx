import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/text/initials";
import { cn } from "@/lib/utils";

type InitialsAvatarProps = {
  name: string;
  /** Signed URL of a private image; falls back to initials while loading or when absent. */
  src?: string | null;
  className?: string;
};

/** Person avatar with Vietnamese-aware initials as the default (idea.md §10.1). */
export function InitialsAvatar({ name, src, className }: InitialsAvatarProps) {
  return (
    <Avatar className={cn("size-10", className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className="font-medium">{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
