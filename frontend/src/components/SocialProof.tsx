import { motion } from 'framer-motion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { useCountUp } from '../hooks/useCountUp';

const stats = [
  { value: 10000, suffix: '+', label: 'Active Deployments' },
  { value: 99.9, suffix: '%', label: 'Uptime Guarantee', isDecimal: true },
  { value: 7, suffix: '', label: 'Core Services' },
  { value: 50, suffix: 'ms', label: 'Avg Response Time' },
];

export default function SocialProof() {
  const { ref, isVisible } = useScrollReveal(0.2);

  return (
    <section ref={ref} className="relative py-20 lg:py-28 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-surface-950 via-surface-900/50 to-surface-950" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="text-center p-6 lg:p-8 glass-light rounded-2xl group hover:border-brand-500/20 transition-all duration-500"
            >
              <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-2">
                <StatNumber end={stat.value} isDecimal={stat.isDecimal} start={isVisible} />
                <span className="text-brand-400">{stat.suffix}</span>
              </div>
              <p className="text-sm lg:text-base text-surface-400 font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Trusted by */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isVisible ? { opacity: 1 } : {}}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="mt-16 text-center"
        >
          <p className="text-sm font-medium text-surface-500 uppercase tracking-wider mb-8">
            Trusted by developers & teams worldwide
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-14 opacity-40">
            {['Raspberry Pi', 'Docker', 'Node.js', 'PM2', 'Nginx'].map((brand) => (
              <span key={brand} className="text-lg lg:text-xl font-bold text-surface-400 tracking-wider">
                {brand}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function StatNumber({ end, isDecimal, start }: { end: number; isDecimal?: boolean; start: boolean }) {
  const count = useCountUp(isDecimal ? Math.floor(end * 10) : end, 2000, start);
  if (isDecimal) return <>{(count / 10).toFixed(1)}</>;
  return <>{count.toLocaleString()}</>;
}
