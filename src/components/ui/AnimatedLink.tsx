import { cn } from "@/lib/utils";

type AnimatedLinkProps = {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  target?: string;
  href?: string;
};

export const AnimatedLink: React.FC<AnimatedLinkProps> = ({
  children,
  onClick,
  className,
  target,
  href,
}) => {
  const baseClasses =
    "text-natural-50 cursor-pointer relative group transition-all duration-300 ease-in-out hover:text-primary-300";

  const content = (
    <span className="relative text-sm font-['NotesESA']">
      {children}
      <span className="absolute -bottom-1 right-0 w-0 h-0.5 bg-primary-300 transition-all duration-300 ease-in-out group-hover:w-full group-hover:left-0"></span>
    </span>
  );

  if (href) {
    return (
      <a
        href={href}
        className={cn(baseClasses, className)}
        onClick={onClick}
        target={target}
      >
        {content}
      </a>
    );
  }

  return (
    <span className={cn(baseClasses, className)} onClick={onClick}>
      {content}
    </span>
  );
};
