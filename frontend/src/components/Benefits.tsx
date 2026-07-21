import { motion } from 'framer-motion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { Server, ShieldCheck, Gauge, Code2, RefreshCcw, Eye } from 'lucide-react';

const benefits = [
  {
    icon: Server,
    title: 'True Self-Hosting',
    description: 'Run everything on your own hardware. No vendor lock-in, no surprise bills, no data leaving your network.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy First',
    description: 'Your data lives on your infrastructure. No third-party access, no data mining, no compromises on privacy.',
  },
  {
    icon: Gauge,
    title: 'Blazing Performance',
    description: 'Optimized Node.js services with sub-50ms response times. Direct hardware access means zero cloud overhead.',
  },
  {
    icon: Code2,
    title: 'Fully Extensible',
    description: 'Open architecture lets you add custom services, integrate APIs, and modify anything to your exact needs.',
  },
  {
    icon: RefreshCcw,
    title: 'Auto-Recovery',
    description: 'PM2 monitors every service and auto-restarts on failure. Zero-downtime deployments keep you always online.',
  },
  {
    icon: Eye,
    title: 'Full Transparency',
    description: 'Monitor every process, view real-time logs, track resource usage. Complete visibility into your infrastructure.',
  },
];

export default function Benefits() {
  const { ref, isVisible } = useScrollReveal(0.1);

  return (
    <section id="benefits" ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 grid-pattern" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-brand-600/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16 lg:mb-20"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Why Choose{' '}
            <span className="gradient-text">Pi-Cloud?</span>
          </h2>
          <p className="mt-4 text-lg text-surface-400 leading-relaxed">
            Built for people who believe their data should remain theirs. 
            Pi-Cloud gives you enterprise-grade capabilities without the enterprise price tag.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {benefits.map((benefit, i) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="group relative"
            >
              <div className="relative p-8 rounded-2xl bg-gradient-to-b from-surface-800/50 to-surface-900/30 border border-surface-700/30 hover:border-brand-500/20 transition-all duration-500 h-full">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10">
                  <div className="w-12 h-12 rounded-xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center mb-5 group-hover:bg-brand-600/20 group-hover:border-brand-500/30 transition-all duration-300">
                    <benefit.icon className="w-6 h-6 text-brand-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{benefit.title}</h3>
                  <p className="text-sm text-surface-400 leading-relaxed">{benefit.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
