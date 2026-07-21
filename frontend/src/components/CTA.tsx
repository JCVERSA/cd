import { motion } from 'framer-motion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ArrowRight, Cloud, Terminal } from 'lucide-react';

export default function CTA() {
  const { ref, isVisible } = useScrollReveal(0.2);

  return (
    <section ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950 via-surface-950 to-purple-950" />
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 mb-8 shadow-2xl shadow-brand-600/30">
            <Cloud className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            Ready to Own Your
            <br />
            <span className="gradient-text">Digital Life?</span>
          </h2>

          <p className="mt-6 text-lg lg:text-xl text-surface-400 max-w-2xl mx-auto leading-relaxed">
            Deploy Pi-Cloud in minutes and never look back. Your notes, files, photos, 
            passwords, and bookmarks — all under your control.
          </p>

          {/* Terminal command */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-8 inline-flex items-center gap-3 px-5 py-3 glass rounded-xl"
          >
            <Terminal className="w-4 h-4 text-brand-400" />
            <code className="text-sm text-surface-300">
              <span className="text-brand-400">$</span> npx create-pi-cloud@latest
            </code>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <a
              href="#pricing"
              className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 px-10 py-4 text-base font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-2xl transition-all duration-300 shadow-2xl shadow-brand-600/30 hover:shadow-brand-500/40 hover:-translate-y-1"
            >
              Deploy Now — It's Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-surface-300 hover:text-white transition-colors"
            >
              View Documentation
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
