import {
  MessageCircle,
  Film,
  Globe,
  Gamepad2,
  CalendarDays,
  Camera,
  Rocket,
  Crown,
  Settings,
} from 'lucide-react';

export type NavTab =
  | 'chats'
  | 'people'
  | 'games'
  | 'events'
  | 'status'
  | 'projects'
  | 'leaders'
  | 'settings';

interface RightNavProps {
  tab: NavTab;
  onChange: (tab: NavTab) => void;
  onOpenReels: () => void;
}

const items: { key: NavTab; label: string; icon: typeof MessageCircle }[] = [
  { key: 'chats', label: 'Chats', icon: MessageCircle },
  { key: 'people', label: 'People', icon: Globe },
  { key: 'games', label: 'Games', icon: Gamepad2 },
  { key: 'events', label: 'Events', icon: CalendarDays },
  { key: 'status', label: 'Status', icon: Camera },
  { key: 'projects', label: 'Projects', icon: Rocket },
  { key: 'leaders', label: 'Leaders', icon: Crown },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const RightNav = ({ tab, onChange, onOpenReels }: RightNavProps) => {
  return (
    <nav
      aria-label="Main sections"
      className="order-last flex w-[74px] flex-shrink-0 flex-col items-center gap-1 overflow-y-auto border-l border-border bg-app-panel py-3 no-scrollbar"
    >
      <NavItem
        label="Reels"
        icon={Film}
        active={false}
        highlight
        onClick={onOpenReels}
      />
      {items.map((it) => (
        <NavItem
          key={it.key}
          label={it.label}
          icon={it.icon}
          active={tab === it.key}
          onClick={() => onChange(it.key)}
        />
      ))}
    </nav>
  );
};

const NavItem = ({
  label,
  icon: Icon,
  active,
  highlight,
  onClick,
}: {
  label: string;
  icon: typeof MessageCircle;
  active: boolean;
  highlight?: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    title={label}
    className={`flex w-[62px] flex-col items-center gap-1 rounded-xl px-1 py-2 transition-colors ${
      active
        ? 'bg-primary/15 text-primary'
        : highlight
        ? 'text-accent hover:bg-muted/40'
        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
    }`}
  >
    <Icon size={19} />
    <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
  </button>
);

export default RightNav;
