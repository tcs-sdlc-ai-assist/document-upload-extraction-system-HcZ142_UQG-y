import { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import theme from '../../config/theme';

const Header = () => {
  const { user, isAuthenticated, logout, isLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Upload', href: '/upload' },
    { label: 'Health Check', href: '/health' },
  ];

  const currentPath = window.location.pathname;

  const handleLogout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    } finally {
      setIsLoggingOut(false);
    }
  }, [logout, isLoggingOut]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleNavClick = useCallback((href) => {
    setMobileMenuOpen(false);
    window.location.href = href;
  }, []);

  const isActiveLink = (href) => {
    if (href === '/dashboard') {
      return currentPath === '/' || currentPath === '/dashboard';
    }
    return currentPath === href || currentPath.startsWith(href + '/');
  };

  return (
    <header style={{
      height: theme.components.header.height,
      background: theme.components.header.background,
      borderBottom: theme.components.header.border,
      boxShadow: theme.components.header.shadow,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `0 ${theme.spacing[6]}`,
      position: 'sticky',
      top: 0,
      zIndex: theme.zIndex.sticky,
      fontFamily: theme.typography.fontFamily.sans,
    }}>
      {/* Logo */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing[2],
        cursor: 'pointer',
        flexShrink: 0,
      }} onClick={() => handleNavClick('/dashboard')}>
        <div style={{
          width: '2rem',
          height: '2rem',
          background: theme.colors.primary[600],
          borderRadius: theme.borderRadius.lg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.text.inverse,
          fontSize: theme.typography.fontSize.sm,
          fontWeight: theme.typography.fontWeight.bold,
        }}>
          D
        </div>
        <span style={{
          fontSize: theme.typography.fontSize.lg,
          fontWeight: theme.typography.fontWeight.semibold,
          color: theme.colors.text.primary,
          letterSpacing: theme.typography.letterSpacing.tight,
        }}>
          DocExtract
        </span>
      </div>

      {/* Desktop Navigation */}
      {isAuthenticated && (
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[1],
        }} className="header-desktop-nav">
          {navLinks.map((link) => {
            const active = isActiveLink(link.href);
            return (
              <button
                key={link.href}
                onClick={() => handleNavClick(link.href)}
                style={{
                  background: active ? theme.colors.primary[50] : 'transparent',
                  color: active ? theme.colors.primary[700] : theme.colors.text.secondary,
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: active ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium,
                  fontFamily: theme.typography.fontFamily.sans,
                  cursor: 'pointer',
                  transition: theme.transitions.default,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.target.style.background = theme.colors.neutral[100];
                    e.target.style.color = theme.colors.text.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.target.style.background = 'transparent';
                    e.target.style.color = theme.colors.text.secondary;
                  }
                }}
              >
                {link.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Desktop User Info & Logout */}
      {isAuthenticated && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[4],
          flexShrink: 0,
        }} className="header-desktop-user">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
          }}>
            <div style={{
              width: '2rem',
              height: '2rem',
              borderRadius: theme.borderRadius.full,
              background: theme.colors.primary[100],
              color: theme.colors.primary[700],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: theme.typography.fontSize.xs,
              fontWeight: theme.typography.fontWeight.semibold,
              textTransform: 'uppercase',
              flexShrink: 0,
            }}>
              {user && user.username ? user.username.charAt(0) : 'U'}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
            }}>
              <span style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.primary,
                lineHeight: theme.typography.lineHeight.tight,
              }}>
                {user ? user.username : ''}
              </span>
              {user && user.role && (
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

          <button
            onClick={handleLogout}
            disabled={isLoggingOut || isLoading}
            style={{
              background: theme.components.button.secondary.background,
              color: theme.colors.text.secondary,
              border: theme.components.button.secondary.border,
              borderRadius: theme.components.button.secondary.borderRadius,
              padding: `${theme.spacing[1]} ${theme.spacing[3]}`,
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.components.button.secondary.fontWeight,
              fontFamily: theme.typography.fontFamily.sans,
              cursor: isLoggingOut || isLoading ? 'not-allowed' : 'pointer',
              transition: theme.transitions.default,
              opacity: isLoggingOut || isLoading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing[1],
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!isLoggingOut && !isLoading) {
                e.currentTarget.style.background = theme.components.button.secondary.hoverBackground;
                e.currentTarget.style.color = theme.colors.text.primary;
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoggingOut && !isLoading) {
                e.currentTarget.style.background = theme.components.button.secondary.background;
                e.currentTarget.style.color = theme.colors.text.secondary;
              }
            }}
          >
            {isLoggingOut && (
              <span style={{
                display: 'inline-block',
                width: '0.75rem',
                height: '0.75rem',
                border: '2px solid rgba(0, 0, 0, 0.15)',
                borderTopColor: theme.colors.text.secondary,
                borderRadius: '50%',
                animation: 'headerLogoutSpin 0.8s linear infinite',
              }} />
            )}
            {isLoggingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      )}

      {/* Mobile Hamburger Button */}
      {isAuthenticated && (
        <button
          onClick={toggleMobileMenu}
          className="header-mobile-menu-btn"
          style={{
            display: 'none',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: theme.spacing[2],
            borderRadius: theme.borderRadius.md,
            transition: theme.transitions.default,
            flexShrink: 0,
          }}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          <div style={{
            width: '1.25rem',
            height: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '4px',
            position: 'relative',
          }}>
            <span style={{
              display: 'block',
              width: '100%',
              height: '2px',
              background: theme.colors.text.primary,
              borderRadius: theme.borderRadius.full,
              transition: theme.transitions.default,
              transform: mobileMenuOpen ? 'rotate(45deg) translateY(6px)' : 'none',
            }} />
            <span style={{
              display: 'block',
              width: '100%',
              height: '2px',
              background: theme.colors.text.primary,
              borderRadius: theme.borderRadius.full,
              transition: theme.transitions.default,
              opacity: mobileMenuOpen ? 0 : 1,
            }} />
            <span style={{
              display: 'block',
              width: '100%',
              height: '2px',
              background: theme.colors.text.primary,
              borderRadius: theme.borderRadius.full,
              transition: theme.transitions.default,
              transform: mobileMenuOpen ? 'rotate(-45deg) translateY(-6px)' : 'none',
            }} />
          </div>
        </button>
      )}

      {/* Mobile Menu Overlay */}
      {isAuthenticated && mobileMenuOpen && (
        <div
          className="header-mobile-overlay"
          style={{
            position: 'fixed',
            top: theme.components.header.height,
            left: 0,
            right: 0,
            bottom: 0,
            background: theme.components.modal.overlayBackground,
            zIndex: theme.zIndex.overlay,
          }}
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Dropdown */}
      {isAuthenticated && mobileMenuOpen && (
        <div
          className="header-mobile-menu"
          style={{
            position: 'fixed',
            top: theme.components.header.height,
            left: 0,
            right: 0,
            background: theme.colors.background.primary,
            borderBottom: `1px solid ${theme.colors.border.light}`,
            boxShadow: theme.shadows.lg,
            zIndex: theme.zIndex.modal,
            padding: theme.spacing[4],
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing[2],
          }}
        >
          {/* Mobile User Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[3],
            padding: `${theme.spacing[2]} ${theme.spacing[3]}`,
            borderBottom: `1px solid ${theme.colors.border.light}`,
            paddingBottom: theme.spacing[4],
            marginBottom: theme.spacing[2],
          }}>
            <div style={{
              width: '2.5rem',
              height: '2.5rem',
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
              {user && user.username ? user.username.charAt(0) : 'U'}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
            }}>
              <span style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.semibold,
                color: theme.colors.text.primary,
              }}>
                {user ? user.username : ''}
              </span>
              {user && user.role && (
                <span style={{
                  fontSize: theme.typography.fontSize.xs,
                  color: theme.colors.text.tertiary,
                  textTransform: 'capitalize',
                }}>
                  {user.role}
                </span>
              )}
            </div>
          </div>

          {/* Mobile Nav Links */}
          {navLinks.map((link) => {
            const active = isActiveLink(link.href);
            return (
              <button
                key={link.href}
                onClick={() => handleNavClick(link.href)}
                style={{
                  background: active ? theme.colors.primary[50] : 'transparent',
                  color: active ? theme.colors.primary[700] : theme.colors.text.secondary,
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  padding: `${theme.spacing[3]} ${theme.spacing[3]}`,
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: active ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium,
                  fontFamily: theme.typography.fontFamily.sans,
                  cursor: 'pointer',
                  transition: theme.transitions.default,
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                {link.label}
              </button>
            );
          })}

          {/* Mobile Logout */}
          <div style={{
            borderTop: `1px solid ${theme.colors.border.light}`,
            paddingTop: theme.spacing[3],
            marginTop: theme.spacing[2],
          }}>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut || isLoading}
              style={{
                background: 'transparent',
                color: theme.colors.error[600],
                border: 'none',
                borderRadius: theme.borderRadius.md,
                padding: `${theme.spacing[3]} ${theme.spacing[3]}`,
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                fontFamily: theme.typography.fontFamily.sans,
                cursor: isLoggingOut || isLoading ? 'not-allowed' : 'pointer',
                transition: theme.transitions.default,
                opacity: isLoggingOut || isLoading ? 0.6 : 1,
                textAlign: 'left',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing[2],
              }}
            >
              {isLoggingOut && (
                <span style={{
                  display: 'inline-block',
                  width: '0.75rem',
                  height: '0.75rem',
                  border: `2px solid ${theme.colors.error[200]}`,
                  borderTopColor: theme.colors.error[600],
                  borderRadius: '50%',
                  animation: 'headerLogoutSpin 0.8s linear infinite',
                }} />
              )}
              {isLoggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes headerLogoutSpin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .header-desktop-nav {
            display: none !important;
          }
          .header-desktop-user {
            display: none !important;
          }
          .header-mobile-menu-btn {
            display: flex !important;
          }
        }

        @media (min-width: 769px) {
          .header-mobile-menu-btn {
            display: none !important;
          }
          .header-mobile-overlay {
            display: none !important;
          }
          .header-mobile-menu {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
};

export default Header;