import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { ChevronDown } from 'lucide-react';

const faqs = [
  {
    q: 'What hardware do I need to run Pi-Cloud?',
    a: 'Pi-Cloud is optimized for Raspberry Pi 4/5 and above, but runs on any Linux system with Node.js 18+. A machine with at least 2GB RAM and 32GB storage is recommended for all 7 services.',
  },
  {
    q: 'How does PM2 manage the microservices?',
    a: 'PM2 acts as the process manager for all services. It handles automatic restarts on failure, load balancing, log management, and zero-downtime deployments. Each service runs as an independent process with its own memory allocation and restart policy.',
  },
  {
    q: 'Is my data encrypted?',
    a: 'Yes. The mc-vault service uses AES-256 encryption for passwords and secrets. All inter-service communication goes through the mc-gateway with JWT authentication. You can also configure TLS for all endpoints.',
  },
  {
    q: 'Can I run Pi-Cloud alongside other services?',
    a: 'Absolutely. Each microservice uses its own port, and the mc-gateway handles routing. You can run Pi-Cloud alongside any other services on your machine without conflicts.',
  },
  {
    q: 'How do I back up my data?',
    a: 'Pi-Cloud supports automated backups for all services. You can configure backup schedules, retention policies, and remote backup destinations. The mc-files service also supports incremental backups to minimize storage usage.',
  },
  {
    q: 'Can multiple users access Pi-Cloud?',
    a: 'Yes. The mc-auth service supports multi-user access with role-based permissions. The free tier supports a single user, while Pro and Team plans support 5 and unlimited users respectively.',
  },
  {
    q: 'What happens if a service crashes?',
    a: 'PM2 automatically detects crashes and restarts the affected service within milliseconds. Other services continue running unaffected thanks to the microservice architecture. You\'ll receive notifications for any restart events.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'Pi-Cloud provides a fully responsive progressive web app (PWA) that works beautifully on any device. You can install it on your home screen for a native app-like experience. Native apps for iOS and Android are on the roadmap.',
  },
];

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const { ref, isVisible } = useScrollReveal(0.1);

  return (
    <section id="faq" ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-surface-950 via-surface-900/20 to-surface-950" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Frequently{' '}
            <span className="gradient-text">Asked</span>
          </h2>
          <p className="mt-4 text-lg text-surface-400">
            Everything you need to know about Pi-Cloud.
          </p>
        </motion.div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.05, duration: 0.5 }}
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className={`w-full glass-light rounded-xl p-5 text-left transition-all duration-300 ${
                  openIndex === i ? 'border-brand-500/20' : 'hover:border-surface-600/50'
                }`}
                aria-expanded={openIndex === i}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm lg:text-base font-semibold text-white">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-surface-400 flex-shrink-0 transition-transform duration-300 ${
                      openIndex === i ? 'rotate-180 text-brand-400' : ''
                    }`}
                  />
                </div>
                <AnimatePresence>
                  {openIndex === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="mt-3 text-sm text-surface-400 leading-relaxed">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
