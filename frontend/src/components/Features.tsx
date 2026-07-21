import { motion } from 'framer-motion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import {
  Globe, Shield, FileText, HardDrive, Image, Lock, Bookmark, Layers, Cpu, RefreshCcw
} from 'lucide-react';

const features = [
  {
    icon: Globe,
    title: 'API Gateway',
    service: 'mc-gateway',
    description: 'Unified entry point with intelligent routing, rate limiting, and request validation across all services.',
    color: 'from-blue-500 to-cyan-500',
    shadowColor: 'shadow-blue-500/20',
  },
  {
    icon: Shield,
    title: 'Authentication',
    service: 'mc-auth',
    description: 'JWT-based auth with multi-factor authentication, session management, and role-based access control.',
    color: 'from-emerald-500 to-teal-500',
    shadowColor: 'shadow-emerald-500/20',
  },
  {
    icon: FileText,
    title: 'Notes',
    service: 'mc-notes',
    description: 'Rich-text notes with markdown support, real-time sync, tagging, and full-text search capabilities.',
    color: 'from-amber-500 to-orange-500',
    shadowColor: 'shadow-amber-500/20',
  },
  {
    icon: HardDrive,
    title: 'File Storage',
    service: 'mc-files',
    description: 'Secure file storage with chunked uploads, versioning, sharing controls, and automatic backups.',
    color: 'from-violet-500 to-purple-500',
    shadowColor: 'shadow-violet-500/20',
  },
  {
    icon: Image,
    title: 'Gallery',
    service: 'mc-gallery',
    description: 'Photo & video management with AI-powered organization, EXIF extraction, and album sharing.',
    color: 'from-pink-500 to-rose-500',
    shadowColor: 'shadow-pink-500/20',
  },
  {
    icon: Lock,
    title: 'Vault',
    service: 'mc-vault',
    description: 'AES-256 encrypted password vault with auto-generation, breach detection, and secure sharing.',
    color: 'from-red-500 to-orange-500',
    shadowColor: 'shadow-red-500/20',
  },
  {
    icon: Bookmark,
    title: 'Bookmarks',
    service: 'mc-bookmarks',
    description: 'Smart bookmarking with auto-categorization, preview snapshots, tags, and cross-device sync.',
    color: 'from-indigo-500 to-blue-500',
    shadowColor: 'shadow-indigo-500/20',
  },
];

export default function Features() {
  const { ref, isVisible } = useScrollReveal(0.05);

  return (
    <section id="features" ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 grid-pattern" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16 lg:mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-light text-xs font-semibold text-brand-400 uppercase tracking-wider mb-4">
            <Layers className="w-3.5 h-3.5" />
            Core Services
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Seven Services.{' '}
            <span className="gradient-text">One Platform.</span>
          </h2>
          <p className="mt-4 text-lg text-surface-400 leading-relaxed">
            Every service runs as an independent microservice managed by PM2, giving you 
            unmatched reliability, scalability, and complete data sovereignty.
          </p>
        </motion.div>

        {/* Feature cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.service}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.08, duration: 0.6 }}
              className={`group relative p-6 lg:p-8 glass-light rounded-2xl hover:border-brand-500/20 transition-all duration-500 hover:-translate-y-1 ${
                i === 6 ? 'sm:col-span-2 lg:col-span-1' : ''
              }`}
            >
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              
              <div className="relative z-10">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-5 shadow-lg ${feature.shadowColor} group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                </div>

                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-800/80 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <code className="text-xs text-surface-400">{feature.service}</code>
                </div>

                <p className="text-sm text-surface-400 leading-relaxed">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Architecture highlight */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8, duration: 0.7 }}
          className="mt-12 lg:mt-16 glass rounded-2xl p-6 lg:p-10 glow-sm"
        >
          <div className="flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Microservice Architecture</h3>
              </div>
              <p className="text-surface-400 leading-relaxed">
                Each service operates independently with its own process, memory allocation, and restart policy. 
                PM2 ensures zero-downtime deployments and automatic recovery — if a service crashes, 
                it's back online in milliseconds.
              </p>
            </div>
            <div className="flex-1 w-full">
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {features.map((f, i) => (
                  <motion.div
                    key={f.service}
                    initial={{ scale: 0 }}
                    animate={isVisible ? { scale: 1 } : {}}
                    transition={{ delay: 1 + i * 0.08, type: 'spring', stiffness: 200 }}
                    className="relative group/arch"
                  >
                    <div className={`aspect-square rounded-xl bg-gradient-to-br ${f.color} opacity-15 group-hover/arch:opacity-30 transition-opacity flex items-center justify-center`}>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <f.icon className="w-4 h-4 sm:w-5 sm:h-5 text-white/70" />
                    </div>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={isVisible ? { scale: 1 } : {}}
                  transition={{ delay: 1.6, type: 'spring', stiffness: 200 }}
                  className="aspect-square rounded-xl border border-dashed border-surface-600 flex items-center justify-center"
                >
                  <RefreshCcw className="w-4 h-4 sm:w-5 sm:h-5 text-surface-500" />
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
