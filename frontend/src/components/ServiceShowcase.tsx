import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import {
  Globe, Shield, FileText, HardDrive, Image, Lock, Bookmark,
  Check
} from 'lucide-react';

const services = [
  {
    id: 'mc-gateway',
    pid: 0,
    icon: Globe,
    name: 'Gateway',
    headline: 'Intelligent API Gateway',
    description: 'The front door to your cloud. Routes requests, handles CORS, rate limits abuse, and provides a unified API interface for all microservices.',
    features: ['Smart request routing', 'Built-in rate limiting', 'CORS management', 'Health monitoring', 'Request logging'],
    color: 'from-blue-500 to-cyan-500',
    metrics: { requests: '2.4M/day', latency: '12ms', uptime: '99.99%' },
  },
  {
    id: 'mc-auth',
    pid: 1,
    icon: Shield,
    name: 'Auth',
    headline: 'Zero-Trust Authentication',
    description: 'Secure your entire platform with JWT tokens, refresh token rotation, and granular permissions. Supports 2FA and SSO.',
    features: ['JWT + Refresh tokens', 'Two-factor auth', 'Role-based access', 'Session management', 'Brute-force protection'],
    color: 'from-emerald-500 to-teal-500',
    metrics: { sessions: '12K active', blocked: '847 threats', uptime: '99.99%' },
  },
  {
    id: 'mc-notes',
    pid: 3,
    icon: FileText,
    name: 'Notes',
    headline: 'Your Digital Brain',
    description: 'Capture thoughts, write documentation, plan projects. Full markdown support with real-time preview, tagging, and instant search.',
    features: ['Rich markdown editor', 'Full-text search', 'Tags & categories', 'Version history', 'Export to PDF'],
    color: 'from-amber-500 to-orange-500',
    metrics: { notes: '24.7K', searches: '1.2K/day', uptime: '99.98%' },
  },
  {
    id: 'mc-files',
    pid: 2,
    icon: HardDrive,
    name: 'Files',
    headline: 'Cloud Storage, Redefined',
    description: 'Upload, organize, and share files with chunked uploads for reliability. Automatic deduplication saves storage space.',
    features: ['Chunked uploads', 'File deduplication', 'Sharing & permissions', 'Preview support', 'Auto-backup'],
    color: 'from-violet-500 to-purple-500',
    metrics: { stored: '1.2 TB', files: '89K', uptime: '99.99%' },
  },
  {
    id: 'mc-gallery',
    pid: 4,
    icon: Image,
    name: 'Gallery',
    headline: 'Photo Library at Home',
    description: 'Organize your memories with smart albums, EXIF data extraction, and beautiful gallery views. Your photos stay yours.',
    features: ['Smart albums', 'EXIF extraction', 'Thumbnail generation', 'Slideshow mode', 'Shared albums'],
    color: 'from-pink-500 to-rose-500',
    metrics: { photos: '47K', albums: '234', uptime: '99.97%' },
  },
  {
    id: 'mc-vault',
    pid: 5,
    icon: Lock,
    name: 'Vault',
    headline: 'Secrets Under Lock & Key',
    description: 'Military-grade AES-256 encryption for passwords, API keys, and sensitive notes. Generate strong passwords with one click.',
    features: ['AES-256 encryption', 'Password generator', 'Breach monitoring', 'Secure sharing', 'Auto-fill ready'],
    color: 'from-red-500 to-orange-500',
    metrics: { entries: '1.4K', strength: '98% strong', uptime: '99.99%' },
  },
  {
    id: 'mc-bookmarks',
    pid: 6,
    icon: Bookmark,
    name: 'Bookmarks',
    headline: 'Never Lose a Link Again',
    description: 'Save, organize, and rediscover web content with smart categorization, preview snapshots, and powerful search.',
    features: ['Auto-categorization', 'Link previews', 'Tag system', 'Full-text search', 'Import/export'],
    color: 'from-indigo-500 to-blue-500',
    metrics: { bookmarks: '5.2K', tags: '189', uptime: '99.98%' },
  },
];

export default function ServiceShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const { ref, isVisible } = useScrollReveal(0.1);
  const active = services[activeIndex];

  return (
    <section id="services" ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-surface-950 via-surface-900/30 to-surface-950" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Deep Dive Into{' '}
            <span className="gradient-text">Each Service</span>
          </h2>
          <p className="mt-4 text-lg text-surface-400">
            Explore what makes each microservice powerful on its own, yet seamless together.
          </p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
          {/* Service tabs */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isVisible ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="lg:w-64 flex-shrink-0"
          >
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-hide">
              {services.map((service, i) => (
                <button
                  key={service.id}
                  onClick={() => setActiveIndex(i)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left whitespace-nowrap transition-all duration-300 flex-shrink-0 ${
                    i === activeIndex
                      ? 'glass border-brand-500/30 text-white shadow-lg shadow-brand-500/10'
                      : 'text-surface-400 hover:text-white hover:bg-surface-800/30'
                  }`}
                >
                  <service.icon className={`w-4 h-4 flex-shrink-0 ${i === activeIndex ? 'text-brand-400' : ''}`} />
                  <span className="text-sm font-medium">{service.name}</span>
                  <span className={`ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === activeIndex ? 'bg-emerald-400' : 'bg-surface-600'}`} />
                </button>
              ))}
            </div>
          </motion.div>

          {/* Service detail */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={isVisible ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="flex-1 min-w-0"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="glass rounded-2xl p-6 lg:p-10 glow-sm"
              >
                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${active.color} flex items-center justify-center shadow-xl`}>
                    <active.icon className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-2xl font-bold text-white">{active.headline}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <code className="text-xs text-emerald-400">{active.id}</code>
                      </span>
                      <span className="text-xs text-surface-500">PID: {active.pid}</span>
                    </div>
                  </div>
                </div>

                <p className="text-surface-400 leading-relaxed mb-8">{active.description}</p>

                {/* Features list */}
                <div className="grid sm:grid-cols-2 gap-3 mb-8">
                  {active.features.map((feature, i) => (
                    <motion.div
                      key={feature}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-center gap-2.5"
                    >
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${active.color} flex items-center justify-center flex-shrink-0`}>
                        <Check className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm text-surface-300">{feature}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-surface-900/50 border border-surface-700/30">
                  {Object.entries(active.metrics).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <p className="text-lg font-bold text-white">{value}</p>
                      <p className="text-xs text-surface-500 capitalize">{key}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
