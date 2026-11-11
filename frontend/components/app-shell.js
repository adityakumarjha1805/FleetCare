"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { fetchCurrentUser, logoutUser } from "../lib/auth-api";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/notifications-api";

const navigationItems = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Vehicles", href: "/vehicles", icon: "vehicles" },
  { label: "Diagnostics", href: "/diagnostics", icon: "diagnostics" },
  {
    label: "AI Diagnostic Agent",
    href: "/ai-diagnostic-agent",
    icon: "agent",
  },
  { label: "Maintenance", href: "/maintenance", icon: "maintenance" },
  { label: "Service Requests", href: "/service-requests", icon: "requests" },
  { label: "Parts", href: "/parts", icon: "parts" },
  { label: "Reports", href: "/reports", icon: "reports" },
  {
    label: "Admin Panel",
    href: "/admin",
    icon: "organization",
    adminOnly: true,
  },
];

function NavigationIcon({ name }) {
  const commonProps = {
    className: "nav-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...commonProps}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="4" rx="1.5" />
          <rect x="13.5" y="10.5" width="7" height="10" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "vehicles":
      return (
        <svg {...commonProps}>
          <path d="M4 14.5h16l-1.6-6a2 2 0 0 0-1.9-1.5h-9a2 2 0 0 0-1.9 1.5L4 14.5Z" />
          <path d="M4 14.5v3h2m14-3v3h-2M7 17.5h10M7 11h10" />
          <circle cx="7.5" cy="17.5" r="1" />
          <circle cx="16.5" cy="17.5" r="1" />
        </svg>
      );
    case "diagnostics":
      return (
        <svg {...commonProps}>
          <path d="M3.5 12h4l2.2-6 4.5 12 2.2-6h4" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "agent":
      return (
        <svg {...commonProps}>
          <path d="M12 3.5v3m-6.1 1.1L3.8 5.5m14.1 2.1 2.1-2.1M4 13h3l1.5-3 3 7 1.5-4h7" />
          <path d="M5 19.5h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2Z" />
        </svg>
      );
    case "organization":
      return (
        <svg {...commonProps}>
          <circle cx="8" cy="8" r="3" />
          <circle cx="16" cy="8" r="3" />
          <path d="M3.5 19c.6-3 2-4.5 4.5-4.5s3.9 1.5 4.5 4.5m0 0c.6-3 2-4.5 4.5-4.5s3.9 1.5 4.5 4.5" />
        </svg>
      );
    case "parts":
      return (
        <svg {...commonProps}>
          <path d="M5 5.5h14v13H5z" />
          <path d="M8 9h8m-8 3h8m-8 3h5" />
        </svg>
      );
    case "reports":
      return (
        <svg {...commonProps}>
          <path d="M4 19.5h16M6.5 17V9.5m5.5 7.5V5m5.5 12V8" />
        </svg>
      );
    case "maintenance":
      return (
        <svg {...commonProps}>
          <path d="M14.2 6.1a5 5 0 0 0-6.3 6.3l-4.1 4.1a2.1 2.1 0 0 0 3 3l4.1-4.1a5 5 0 0 0 6.3-6.3l-3 3-3-3 3-3Z" />
        </svg>
      );
    default:
      return (
        <svg {...commonProps}>
          <path d="M7 3.5h7l4 4v13H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
          <path d="M14 3.5v4h4m-9 4h6m-6 4h6" />
        </svg>
      );
  }
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path
          d="M4 16.5h16l-1.7-6.2a2 2 0 0 0-1.9-1.5H7.6a2 2 0 0 0-1.9 1.5L4 16.5Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M6 16.5v2m12-2v2M7.5 13h9"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function notificationPath(notification) {
  const paths = {
    PartsRequest: "/parts",
    ServiceRequest: "/service-requests",
    MaintenanceRecord: "/maintenance",
  };
  return paths[notification.relatedResource?.type] || null;
}

function NotificationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 12h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  async function loadNotifications() {
    setIsLoading(true);
    setError("");
    try {
      const [items, count] = await Promise.all([
        fetchNotifications(),
        fetchUnreadNotificationCount(),
      ]);
      setNotifications(items);
      setUnreadCount(count);
    } catch (requestError) {
      if (requestError.status !== 401) {
        setError(requestError.message || "Unable to load notifications.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(loadNotifications, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function markRead(notification) {
    if (notification.read) return;
    try {
      const updated = await markNotificationRead(notification.id);
      setNotifications((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (requestError) {
      setError(requestError.message || "Unable to update notification.");
    }
  }

  async function markAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, read: true })),
      );
      setUnreadCount(0);
      setActionMessage("All notifications marked as read.");
    } catch (requestError) {
      setError(requestError.message || "Unable to update notifications.");
    }
  }

  function openNotification(notification) {
    markRead(notification);
    const path = notificationPath(notification);
    if (path) {
      setIsOpen(false);
      window.location.assign(path);
    }
  }

  return (
    <div className="notification-center">
      <button
        className="notification-toggle"
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={isOpen}
        aria-controls="notification-panel"
        onClick={() => {
          setIsOpen((open) => !open);
          setActionMessage("");
          if (!isOpen) loadNotifications();
        }}
      >
        <NotificationIcon />
        {unreadCount > 0 && (
          <span className="notification-count" aria-label={`${unreadCount} unread`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {isOpen && (
        <section className="notification-panel" id="notification-panel" aria-label="Notifications">
          <div className="notification-panel-heading">
            <h2>Notifications</h2>
            <button type="button" onClick={markAllRead} disabled={!unreadCount}>
              Mark all read
            </button>
          </div>
          {error && <p className="notification-error" role="alert">{error}</p>}
          {actionMessage && <p className="notification-success" role="status">{actionMessage}</p>}
          {isLoading ? (
            <p className="notification-feedback" role="status">Loading notifications…</p>
          ) : notifications.length === 0 ? (
            <p className="notification-feedback">You’re all caught up.</p>
          ) : (
            <div className="notification-list">
              {notifications.map((notification) => (
                <button
                  className={`notification-item${notification.read ? "" : " notification-item-unread"}`}
                  type="button"
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                >
                  <span className="notification-item-dot" aria-hidden="true" />
                  <span>
                    <strong>{notification.title}</strong>
                    <span>{notification.message}</span>
                    <small>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(notification.createdAt))}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function AppShell({
  children,
  title = "Dashboard",
  showPageHeading = true,
  onNavigate,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [user, setUser] = useState(null);
  const mobileToggleRef = useRef(null);
  const desktopToggleRef = useRef(null);
  const firstNavigationLinkRef = useRef(null);
  const sidebarRef = useRef(null);
  const wasMobileNavOpenRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetchCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const desktopViewport = window.matchMedia("(min-width: 761px)");

    function closeDrawerOnDesktop(event) {
      if (event.matches) setIsMobileNavOpen(false);
    }

    desktopViewport.addEventListener("change", closeDrawerOnDesktop);
    return () =>
      desktopViewport.removeEventListener("change", closeDrawerOnDesktop);
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) {
      if (wasMobileNavOpenRef.current) {
        wasMobileNavOpenRef.current = false;
        const focusTarget = window.matchMedia("(min-width: 761px)").matches
          ? desktopToggleRef.current
          : mobileToggleRef.current;
        focusTarget?.focus();
      }

      return undefined;
    }

    wasMobileNavOpenRef.current = true;
    firstNavigationLinkRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
        return;
      }

      if (event.key === "Tab") {
        const focusableElements = sidebarRef.current?.querySelectorAll(
          'a[href], button:not([disabled])',
        );
        const visibleElements = Array.from(focusableElements ?? []).filter(
          (element) => element.getClientRects().length > 0,
        );
        const firstElement = visibleElements[0];
        const lastElement = visibleElements[visibleElements.length - 1];

        if (
          event.shiftKey &&
          (document.activeElement === firstElement ||
            !sidebarRef.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          lastElement?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === lastElement ||
            !sidebarRef.current?.contains(document.activeElement))
        ) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileNavOpen]);

  function closeMobileNav() {
    setIsMobileNavOpen(false);
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setLogoutError("");
    try {
      await logoutUser();
      router.replace("/login");
    } catch (error) {
      setLogoutError(error.message || "Unable to sign out. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div
      className={`app-shell${isCollapsed ? " sidebar-collapsed" : ""}${isMobileNavOpen ? " mobile-nav-open" : ""}`}
    >
      <a
        className="skip-link"
        href="#main-content"
        tabIndex={isMobileNavOpen ? -1 : undefined}
        inert={isMobileNavOpen}
      >
        Skip to content
      </a>

      <aside
        className="sidebar"
        id="primary-navigation"
        ref={sidebarRef}
        role={isMobileNavOpen ? "dialog" : undefined}
        aria-modal={isMobileNavOpen ? true : undefined}
        aria-label={
          isMobileNavOpen ? "Primary navigation menu" : "FleetCare navigation"
        }
      >
        <div className="sidebar-header">
          <Link
            className="brand"
            href="/dashboard"
            aria-label="FleetCare home"
            onClick={onNavigate}
          >
            <BrandMark />
            <span className="brand-name">FleetCare</span>
          </Link>
          <button
            className="sidebar-close"
            type="button"
            onClick={closeMobileNav}
            aria-label="Close navigation menu"
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <p className="sidebar-label">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Primary navigation">
          {navigationItems
            .filter(
              (item) =>
                !item.adminOnly || user?.role === "admin",
            )
            .map((item, index) => (
            <Link
              className="nav-link"
              href={item.href}
              key={item.href}
              aria-label={item.label}
              aria-current={
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                    ? "page"
                    : undefined
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "page"
                    : undefined
              }
              onClick={() => {
                setIsMobileNavOpen(false);
                onNavigate?.();
              }}
              title={isCollapsed ? item.label : undefined}
              ref={index === 0 ? firstNavigationLinkRef : undefined}
            >
              <NavigationIcon name={item.icon} />
              <span className="nav-label">{item.label}</span>
            </Link>
            ))}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-footer-mark" aria-hidden="true" />
          <span className="sidebar-footer-text">Fleet operations workspace</span>
        </div>
      </aside>

      {isMobileNavOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={closeMobileNav}
        />
      )}

      <div className="workspace" inert={isMobileNavOpen}>
        <header className="topbar">
          <div className="topbar-start">
            <button
              className="icon-button desktop-toggle"
              type="button"
              ref={desktopToggleRef}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-controls="primary-navigation"
              aria-expanded={!isCollapsed}
              onClick={() => setIsCollapsed((collapsed) => !collapsed)}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect
                  x="3.5"
                  y="4.5"
                  width="17"
                  height="15"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="M9 5v14m4-10h4m-4 4h4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              className="icon-button mobile-toggle"
              type="button"
              ref={mobileToggleRef}
              aria-label="Open navigation menu"
              aria-controls="primary-navigation"
              aria-expanded={isMobileNavOpen}
              onClick={() => setIsMobileNavOpen(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M4 6.5h16M4 12h16M4 17.5h16"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <span className="topbar-context">{title}</span>
          </div>
          <div className="topbar-end">
            <span className="workspace-label">
              {user?.role === "admin"
                ? "Platform admin"
                : "Fleet operations workspace"}
            </span>
            <NotificationCenter />
            {logoutError && (
              <span className="logout-error" role="alert">
                {logoutError}
              </span>
            )}
            <button
              className="logout-button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              type="button"
            >
              {isLoggingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </header>

        <main className="main-content" id="main-content" tabIndex="-1">
          <div className="page-container">
            {showPageHeading && <h1 className="page-heading">{title}</h1>}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
