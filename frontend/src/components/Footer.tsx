import { Cloud, Heart } from 'lucide-react';

const footerLinks = {
  Product: ['Features', 'Services', 'Pricing', 'Changelog', 'Roadmap'],
  Resources: ['Documentation', 'API Reference', 'Guides', 'Blog', 'Community'],
  Company: ['About', 'Careers', 'Press', 'Partners', 'Contact'],
  Legal: ['Privacy', 'Terms', 'Security', 'GDPR', 'Cookies'],
};

export default function Footer() {
  return (
    <footer className="relative border-t border-surface-800/50">
      <div className="absolute inset-0 bg-gradient-to-b from-surface-950 to-surface-900/50" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main footer */}
        <div className="py-12 lg:py-16 grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <a href="#" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                <Cloud className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                Pi<span className="text-brand-400">-Cloud</span>
              </span>
            </a>
            <p className="text-sm text-surface-500 leading-relaxed mb-6">
              Your private cloud platform. Seven services, one mission: data sovereignty.
            </p>
            <div className="flex items-center gap-3">
              <a href="#" className="w-9 h-9 rounded-lg bg-surface-800 hover:bg-surface-700 flex items-center justify-center text-surface-400 hover:text-white transition-all" aria-label="GitHub">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-surface-800 hover:bg-surface-700 flex items-center justify-center text-surface-400 hover:text-white transition-all" aria-label="Twitter">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-white mb-4">{category}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-surface-500 hover:text-brand-400 transition-colors duration-200">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-6 border-t border-surface-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-surface-600">
            © {new Date().getFullYear()} Pi-Cloud. All rights reserved.
          </p>
          <p className="text-xs text-surface-600 flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-500 fill-red-500" /> for the self-hosting community
          </p>
        </div>
      </div>
    </footer>
  );
}
