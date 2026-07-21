import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import SocialProof from "./components/SocialProof";
import ServiceShowcase from "./components/ServiceShowcase";
import Features from "./components/Features";
import Benefits from "./components/Benefits";
import Pricing from "./components/Pricing";
import Testimonials from "./components/Testimonials";
import FAQ from "./components/FAQ";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

function Root() {
  // We determine whether to render the dashboard (App) or the landing page based on URL path.
  // The gateway proxies /app and /app/* to public/app/index.html,
  // while / (landing) goes to public/index.html.
  // By maintaining two builds we don't strictly need path checking here,
  // but to make it foolproof we can render the app or landing appropriately.
  const isApp = window.location.pathname.startsWith('/app');

  if (isApp) {
    return <App />;
  }

  return (
    <div className="min-h-screen bg-surface-950 text-surface-200">
      <Navbar />
      <Hero />
      <SocialProof />
      <ServiceShowcase />
      <Features />
      <Benefits />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTA />
      <Footer />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
