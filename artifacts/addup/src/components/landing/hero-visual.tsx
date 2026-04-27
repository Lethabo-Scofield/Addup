import React from "react";
import { motion } from "framer-motion";
import { Database, Filter, GitMerge, AlertCircle, CheckCircle2 } from "lucide-react";

export function HeroVisual() {
  const nodes = [
    { id: "bank", label: "Bank data", icon: Database, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { id: "clean", label: "Cleaned data", icon: Filter, color: "text-indigo-500", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
    { id: "match", label: "Matched transactions", icon: GitMerge, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    { id: "exception", label: "Exceptions", icon: AlertCircle, color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    { id: "verified", label: "Verified books", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  ];

  return (
    <div className="w-full max-w-md mx-auto relative rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl shadow-2xl p-6 lg:p-8">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none" />
      
      <div className="relative flex flex-col gap-6">
        {nodes.map((node, i) => (
          <div key={node.id} className="relative z-10 flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.5, ease: "easeOut" }}
              className={`flex-shrink-0 flex h-12 w-12 items-center justify-center rounded-xl border ${node.border} ${node.bg} shadow-sm backdrop-blur-sm`}
            >
              <node.icon className={`h-5 w-5 ${node.color}`} />
            </motion.div>
            
            <motion.div
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 + i * 0.15, duration: 0.5 }}
              className="flex-1 h-12 rounded-xl border border-border/50 bg-background/60 backdrop-blur-sm flex items-center px-4 shadow-sm relative overflow-hidden group"
            >
              <motion.div
                animate={{ x: ["-100%", "200%"] }}
                transition={{ repeat: Infinity, duration: 3, ease: "linear", delay: i * 0.4 }}
                className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 dark:via-white/5 to-transparent skew-x-12"
              />
              <span className="text-sm font-medium text-foreground/80">{node.label}</span>
              
              {/* Fake data sparklines for some nodes */}
              {i === 2 && (
                <div className="ml-auto flex items-center gap-1">
                  {[40, 70, 45, 90, 60].map((h, j) => (
                    <motion.div 
                      key={j}
                      animate={{ height: ["40%", `${h}%`, "40%"] }}
                      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: j * 0.2 }}
                      className="w-1 rounded-full bg-purple-500/40"
                    />
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        ))}

        {/* Connectors */}
        <svg className="absolute left-6 top-[3rem] bottom-12 w-8 -z-10 pointer-events-none" viewBox="0 0 32 300" preserveAspectRatio="none">
          <motion.path
            d="M0,0 L0,300"
            stroke="currentColor"
            strokeWidth="2"
            className="text-border"
            strokeDasharray="4 4"
          />
          <motion.path
            d="M0,0 L0,300"
            stroke="url(#pulse)"
            strokeWidth="3"
          />
          <defs>
            <linearGradient id="pulse" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(59, 130, 246, 0)" />
              <stop offset="50%" stopColor="rgba(59, 130, 246, 0.5)" />
              <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
