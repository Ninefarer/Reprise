import { platform } from "reprise:platform";
import { Icon } from "./navigation";
import type { View } from "./model";

const tabs: { view: View; label: string }[] = [
  { view: "Home", label: "Home" },
  { view: "Inbox", label: "Inbox" },
  { view: "Daily Review", label: "Review" },
];

export function PhoneChrome({
  view,
  more,
  notificationsOpen,
  onNavigate,
  onMore,
  onAlerts,
}: {
  view: View;
  more: boolean;
  notificationsOpen: boolean;
  onNavigate: (view: View) => void;
  onMore: (open: boolean) => void;
  onAlerts: () => void;
}) {
  if (platform.kind !== "web") return null;
  return (
    <>
      <button
        type="button"
        className="phone-backdrop"
        aria-label="Close navigation"
        hidden={!more}
        onClick={() => onMore(false)}
      />
      <nav className="phone-tabbar" aria-label="Sections">
        {tabs.map((tab) => (
          <button
            key={tab.view}
            type="button"
            aria-current={view === tab.view ? "page" : undefined}
            onClick={() => onNavigate(tab.view)}
          >
            <Icon name={tab.view} />
            <span>{tab.label}</span>
          </button>
        ))}
        <button
          type="button"
          aria-pressed={notificationsOpen}
          onClick={onAlerts}
        >
          <Icon name="Notification History" />
          <span>Alerts</span>
        </button>
        <button
          type="button"
          aria-expanded={more}
          aria-controls="phone-more"
          onClick={() => onMore(!more)}
        >
          <Icon name="All Tasks" />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
