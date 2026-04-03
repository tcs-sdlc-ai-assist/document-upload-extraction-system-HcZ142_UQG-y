import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';

const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'D',
  },
  {
    label: 'Upload Documents',
    href: '/upload',
    icon: 'U',
  },
  {
    label: 'Atlas View',
    href: '/atlas',
    icon: 'A',
  },
  {
    label: 'Health Check',
    href: '/health',
    icon: 'H',
  },
  {
    label: 'Audit Logs',
    href: '/logs',
    icon: 'L',
  },
];

const Sidebar = () => {
  const { user, isAuthenticated } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentPath = window.location.pathname;

  const isActiveLink = useCallback((href) => {
    if (href === '/dashboard') {
      return currentPath === '/' || currentPath === '/dashboard';
    }
    return currentPath === href || currentPath.startsWith(href + '/');
  }, [currentPath]);

  const handleNavClick = useCallback((href) => {
    setMobileOpen(false);
    window.location.href = href;
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const toggleMobileOpen = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isAuthenticated) {
    return null;
  }

  const sidebarWidth = collapsed
    ? theme.components.sidebar.collapsedWidth
    : theme.components.sidebar.width;

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        className="sidebar-mobile-toggle"
        onClick={toggleMobileOpen}
        aria-label={mobileOpen ? 'Close sidebar' : 'Open sidebar'}
        style={{
          display: 'none',
          position: 'fixed',
          bottom: theme.spacing[4],
          left: theme.spacing[4],
          zIndex: theme.zIndex.fixed,
          width: '3rem',
          height: '3rem',
          borderRadius: theme.borderRadius.full,
          background: theme.components.button.primary.background,
          color: theme.components.button.primary.color,
          border: 'none',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: theme.shadows.lg,
          fontFamily: theme.typography.fontFamily.sans,
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.bold,
          transition: theme.transitions.default,
        }}
      >
        {mobileOpen ? '✕' : '☰'}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-mobile-overlay"
          onClick={() => setMobileOpen(false)}
          style={{
            display: 'none',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: theme.components.modal.overlayBackground,
            zIndex: theme.zIndex.overlay,
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar-container ${mobileOpen ? 'sidebar-mobile-open' : ''}`}
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          height: '100%',
          background: theme.components.sidebar.background,
          borderRight: theme.components.sidebar.border,
          display: 'flex',
          flexDirection: 'column',
          transition: theme.transitions.default,
          overflow: 'hidden',
          fontFamily: theme.typography.fontFamily.sans,
          position: 'relative',
          zIndex: theme.zIndex.sticky,
        }}
      >
        {/* Collapse Toggle */}
        <div
          className="sidebar-collapse-toggle"
          style={{
            display: 'flex',
            justifyContent: collapsed ? 'center' : 'flex-end',
            padding: `${theme.spacing[3]} ${theme.spacing[3]}`,
            borderBottom: `1px solid ${theme.colors.border.light}`,
          }}
        >
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: theme.spacing[2],
              borderRadius: theme.borderRadius.md,
              color: theme.colors.text.tertiary,
              fontSize: theme.typography.fontSize.sm,
              fontFamily: theme.typography.fontFamily.sans,
              transition: theme.transitions.default,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2rem',
              height: '2rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.colors.neutral[100];
              e.currentTarget.style.color = theme.colors.text.primary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = theme.colors.text.tertiary;
            }}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>

        {/* User Info (when not collapsed) */}
        {!collapsed && user && (
          <div style={{
            padding: `${theme.spacing[4]} ${theme.spacing[4]}`,
            borderBottom: `1px solid ${theme.colors.border.light}`,
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
          }}>
            <div style={{
              width: '2.25rem',
              height: '2.25rem',
              borderRadius: theme.borderRadius.full,
              background: theme.colors.primary[100],
              color: theme.colors.primary[700],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              {user.username ? user.username.charAt(0) : 'U'}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <span style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.primary,
                lineHeight: theme.typography.lineHeight.tight,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {user.username}
              </span>
              {user.role && (
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.tertiary,
                  lineHeight: theme.typography.lineHeight.tight,
                  textTransform: 'capitalize',
                }}>
                  {user.role}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Collapsed User Avatar */}
        {collapsed && user && (
          <div style={{
            padding: `${theme.spacing[3]} 0`,
            borderBottom: `1px solid ${theme.colors.border.light}`,
            display: 'flex',
            justifyContent: 'center',
          }}>
            <div style={{
              width: '2.25rem',
              height: '2.25rem',
              borderRadius: theme.borderRadius.full,
              background: theme.colors.primary[100],
              color: theme.colors.primary[700],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.semibold,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              {user.username ? user.username.charAt(0) : 'U'}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{
          flex: 1,
          padding: `${theme.spacing[3]} ${collapsed ? theme.spacing[1] : theme.spacing[3]}`,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing[1],
          overflowY: 'auto',
        }}>
          {navItems.map((item) => {
            const active = isActiveLink(item.href);
            return (
              <button
                key={item.href}
                onClick={() => handleNavClick(item.href)}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing[3],
                  padding: collapsed
                    ? `${theme.spacing[2]} 0`
                    : `${theme.spacing[2]} ${theme.spacing[3]}`,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: active ? theme.colors.primary[50] : 'transparent',
                  color: active ? theme.colors.primary[700] : theme.colors.text.secondary,
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: active
                    ? theme.typography.fontWeight.semibold
                    : theme.typography.fontWeight.medium,
                  fontFamily: theme.typography.fontFamily.sans,
                  cursor: 'pointer',
                  transition: theme.transitions.default,
                  width: '100%',
                  textAlign: 'left',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = theme.colors.neutral[100];
                    e.currentTarget.style.color = theme.colors.text.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = theme.colors.text.secondary;
                  }
                }}
              >
                {/* Icon */}
                <span style={{
                  width: '1.75rem',
                  height: '1.75rem',
                  borderRadius: theme.borderRadius.md,
                  background: active ? theme.colors.primary[100] : theme.colors.neutral[100],
                  color: active ? theme.colors.primary[700] : theme.colors.text.tertiary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.bold,
                  flexShrink: 0,
                  transition: theme.transitions.default,
                }}>
                  {item.icon}
                </span>

                {/* Label */}
                {!collapsed && (
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {item.label}
                  </span>
                )}

                {/* Active Indicator */}
                {active && (
                  <span style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '3px',
                    height: '60%',
                    borderRadius: theme.borderRadius.full,
                    background: theme.colors.primary[600],
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{
          padding: `${theme.spacing[3]} ${collapsed ? theme.spacing[1] : theme.spacing[3]}`,
          borderTop: `1px solid ${theme.colors.border.light}`,
          display: 'flex',
          justifyContent: 'center',
        }}>
          {!collapsed ? (
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.disabled,
              textAlign: 'center',
            }}>
              DocExtract v1.0
            </span>
          ) : (
            <span style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.disabled,
              textAlign: 'center',
            }}>
              v1
            </span>
          )}
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .sidebar-mobile-toggle {
            display: flex !important;
          }

          .sidebar-mobile-overlay {
            display: block !important;
          }

          .sidebar-container {
            position: fixed !important;
            top: ${theme.components.header.height};
            left: 0;
            bottom: 0;
            z-index: ${theme.zIndex.modal} !important;
            transform: translateX(-100%);
            box-shadow: none;
            width: ${theme.components.sidebar.width} !important;
            min-width: ${theme.components.sidebar.width} !important;
          }

          .sidebar-container.sidebar-mobile-open {
            transform: translateX(0);
            box-shadow: ${theme.shadows.xl};
          }

          .sidebar-collapse-toggle {
            display: none !important;
          }
        }

        @media (min-width: 769px) {
          .sidebar-mobile-toggle {
            display: none !important;
          }

          .sidebar-mobile-overlay {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default Sidebar;