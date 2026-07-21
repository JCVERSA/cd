import { motion } from 'framer-motion';
import { ArrowRight, Shield, Zap, CheckCircle2 } from 'lucide-react';

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 grid-pattern" />
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-brand-600/8 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/6 rounded-full blur-[100px] animate-float-delayed" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-500/4 rounded-full blur-[150px]" />
      </div>

      {/* Floating orbs */}
      <div className="absolute top-32 right-[15%] w-3 h-3 bg-brand-400 rounded-full animate-float opacity-40" />
      <div className="absolute top-48 left-[20%] w-2 h-2 bg-purple-400 rounded-full animate-float-delayed opacity-30" />
      <div className="absolute bottom-32 right-[25%] w-2 h-2 bg-brand-300 rounded-full animate-float-slow opacity-25" />
      <div className="absolute bottom-48 left-[10%] w-4 h-4 bg-brand-500/30 rounded-full animate-float opacity-20" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center max-w-5xl mx-auto"
        >
          {/* Badge */}
          <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-light mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-sm font-medium text-surface-300">All 8 processes operational</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </motion.div>

          {/* Heading */}
          <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black tracking-tight leading-[0.9]">
            <span className="text-white">Your Private</span>
            <br />
            <span className="gradient-text">MiniCloud Suite</span>
          </motion.h1>

          {/* Subheading */}
          <motion.p variants={itemVariants} className="mt-6 lg:mt-8 text-lg sm:text-xl lg:text-2xl text-surface-400 max-w-3xl mx-auto leading-relaxed font-light">
            Eight robust microservices. One seamless self-hosted platform. Take full control of your
            <span className="text-white font-medium"> files</span>,
            <span className="text-white font-medium"> notes</span>,
            <span className="text-white font-medium"> photos</span>,
            <span className="text-white font-medium"> passwords</span>, and
            <span className="text-white font-medium"> bookmarks</span>.
          </motion.p>

          {/* CTA buttons */}
          <motion.div variants={itemVariants} className="mt-10 lg:mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/app"
              className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-2xl transition-all duration-300 shadow-2xl shadow-brand-600/30 hover:shadow-brand-500/40 hover:-translate-y-1"
            >
              Sign In To App
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-brand-400/0 via-white/10 to-brand-400/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </a>
            <a
              href="#features"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-semibold text-surface-300 glass hover:text-white rounded-2xl transition-all duration-300 hover:-translate-y-1"
            >
              Explore Features
            </a>
          </motion.div>

          {/* Trust indicators */}
          <motion.div variants={itemVariants} className="mt-12 lg:mt-16 flex flex-wrap items-center justify-center gap-6 lg:gap-10">
            <div className="flex items-center gap-2 text-surface-400">
              <Shield className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-medium">AES-256-GCM Encrypted</span>
            </div>
            <div className="flex items-center gap-2 text-surface-400">
              <Zap className="w-4 h-4 text-brand-400" />
              <span className="text-sm font-medium">Self-Hosted Directory</span>
            </div>
            <div className="flex items-center gap-2 text-surface-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium">99.9% Uptime</span>
            </div>
          </motion.div>

          {/* Terminal preview */}
          <motion.div
            variants={itemVariants}
            className="mt-16 lg:mt-20 max-w-2xl mx-auto"
          >
            <div className="glass rounded-2xl overflow-hidden glow">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-700/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-surface-500 font-mono ml-2">pm2 status — minicloud</span>
              </div>
              <div className="p-4 sm:p-6 font-mono text-xs sm:text-sm space-y-1.5 text-left">
                <TerminalLine name="mc-gateway" id={0} delay={0.3} />
                <TerminalLine name="mc-auth" id={1} delay={0.5} />
                <TerminalLine name="mc-files" id={2} delay={0.7} />
                <TerminalLine name="mc-notes" id={3} delay={0.9} />
                <TerminalLine name="mc-gallery" id={4} delay={1.1} />
                <TerminalLine name="mc-vault" id={5} delay={1.3} />
                <TerminalLine name="mc-bookmarks" id={6} delay={1.5} />
                <TerminalLine name="mc-admin" id={7} delay={1.7} />
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-surface-950 to-transparent" />
    </section>
  );
}

function TerminalLine({ name, id, delay }: { name: string; id: number; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: delay + 0.8, duration: 0.4 }}
      className="flex items-center gap-2 sm:gap-3"
    >
      <span className="text-surface-500">[PM2]</span>
      <span className="text-brand-400">[{name}]</span>
      <span className="text-surface-600">({id})</span>
      <motion.span
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: delay + 1.2, duration: 0.3 }}
        className="text-emerald-400"
      >
        ✓
      </motion.span>
    </motion.div>
  );
}
