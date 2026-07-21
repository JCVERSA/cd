import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Cloud } from 'lucide-react';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Services', href: '#services' },
  { label: 'Benefits', href: '#benefits' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled ? 'glass shadow-lg shadow-brand-500/5' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <a href="#" className="flex items-center gap-2.5 group">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/25 group-hover:shadow-brand-500/40 transition-shadow duration-300">
                <Cloud className="w-5 h-5 text-white" />
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                Mini<span className="text-brand-400">Cloud</span>
              </span>
            </a>

            {/* Desktop nav */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="relative px-4 py-2 text-sm font-medium text-surface-300 hover:text-white transition-colors duration-300 group"
                >
                  {link.label}
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-brand-500 rounded-full group-hover:w-6 transition-all duration-300" />
                </a>
              ))}
            </div>

            {/* CTA -> pointing directly to /app route! */}
            <div className="hidden lg:flex items-center gap-3">
              <a href="/app" className="text-sm font-medium text-surface-300 hover:text-white transition-colors px-4 py-2">
                Log in
              </a>
              <a
                href="/app"
                className="relative px-5 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-xl transition-all duration-300 shadow-lg shadow-brand-600/25 hover:shadow-brand-500/40 hover:-translate-y-0.5"
              >
                Access App
              </a>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-surface-300 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-x-0 top-16 z-40 glass border-t border-brand-500/10 lg:hidden"
          >
            <div className="px-4 py-6 space-y-1">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="block px-4 py-3 text-base font-medium text-surface-300 hover:text-white hover:bg-surface-800/50 rounded-xl transition-all"
                >
                  {link.label}
                </motion.a>
              ))}
              <div className="pt-4 border-t border-surface-700/50">
                <a
                  href="/app"
                  onClick={() => setMobileOpen(false)}
                  className="block w-full text-center px-5 py-3 text-base font-semibold text-white bg-brand-600 rounded-xl shadow-lg shadow-brand-600/25"
                >
                  Sign In
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
