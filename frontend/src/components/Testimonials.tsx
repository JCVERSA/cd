import { motion } from 'framer-motion';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: 'Alex Chen',
    role: 'DevOps Engineer',
    avatar: 'AC',
    content: 'Pi-Cloud replaced five different SaaS subscriptions for me. Running everything on my Raspberry Pi cluster with PM2 has been rock-solid for over a year.',
    rating: 5,
  },
  {
    name: 'Sarah Mitchell',
    role: 'Privacy Advocate',
    avatar: 'SM',
    content: 'Finally, a self-hosted solution that doesn\'t feel like a compromise. The vault service alone is worth it — I trust my passwords to no one but my own hardware.',
    rating: 5,
  },
  {
    name: 'James Rodriguez',
    role: 'Full-Stack Developer',
    avatar: 'JR',
    content: 'The microservice architecture is brilliant. When I needed to scale mc-files, I just spun up another instance. PM2 made it seamless. Zero downtime.',
    rating: 5,
  },
  {
    name: 'Emily Watson',
    role: 'Photographer',
    avatar: 'EW',
    content: 'The gallery service is incredible for managing my portfolio. EXIF extraction, smart albums, and the fact that my 50K+ photos never leave my network — perfection.',
    rating: 5,
  },
  {
    name: 'Marcus Kim',
    role: 'Security Researcher',
    avatar: 'MK',
    content: 'I audited the entire codebase. JWT auth with refresh token rotation, AES-256 vault encryption, and proper RBAC — this is how security should be done.',
    rating: 5,
  },
  {
    name: 'Lisa Park',
    role: 'Startup Founder',
    avatar: 'LP',
    content: 'We deployed Pi-Cloud for our small team of 8. The notes and bookmarks services have become our knowledge base. All for the cost of a single server.',
    rating: 5,
  },
];

export default function Testimonials() {
  const { ref, isVisible } = useScrollReveal(0.1);

  return (
    <section ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-surface-950 via-surface-900/30 to-surface-950" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Loved by{' '}
            <span className="gradient-text">Developers</span>
          </h2>
          <p className="mt-4 text-lg text-surface-400">
            Join thousands of engineers and teams who've taken back control of their data.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isVisible ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.08, duration: 0.6 }}
              className="group glass-light rounded-2xl p-6 lg:p-8 hover:border-brand-500/20 transition-all duration-500"
            >
              <Quote className="w-8 h-8 text-brand-500/20 mb-4" />
              
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                ))}
              </div>

              <p className="text-surface-300 leading-relaxed mb-6 text-sm lg:text-base">
                "{testimonial.content}"
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-surface-700/30">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white text-xs font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                  <p className="text-xs text-surface-500">{testimonial.role}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
