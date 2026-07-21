import { motion } from 'framer-motion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { Check, ArrowRight } from 'lucide-react';

const plans = [
  {
    name: 'Standard Instance',
    price: 'Free',
    period: 'Self-Hosted',
    description: 'Perfect for self-hosted instances under your control.',
    features: [
      'All 8 MiniCloud services',
      'stateless JWT auth (HttpOnly cookie)',
      '100 MB default quota / user',
      'Fully customizable configuration',
      'Local server monitoring',
    ],
    cta: 'Access MiniCloud App',
    href: '/app',
    highlighted: true,
  }
];

export default function Pricing() {
  const { ref, isVisible } = useScrollReveal(0.1);

  return (
    <section id="pricing" ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 grid-pattern" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-600/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Designed to be{' '}
            <span className="gradient-text">100% Free & Self-Hosted</span>
          </h2>
          <p className="mt-4 text-lg text-surface-400">
            No subscription fees. No third-party servers. Your own private space.
          </p>
        </motion.div>

        <div className="max-w-md mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.12, duration: 0.6 }}
              className="relative rounded-2xl glass border-brand-500/30 glow p-6 lg:p-8 flex flex-col"
            >
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-sm text-surface-400 mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl lg:text-5xl font-black text-white">{plan.price}</span>
                  <span className="text-surface-400 text-sm ml-1">({plan.period})</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 bg-brand-600/20">
                      <Check className="w-3 h-3 text-brand-400" />
                    </div>
                    <span className="text-sm text-surface-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                className="group w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/25 hover:shadow-brand-500/40 hover:-translate-y-0.5"
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
