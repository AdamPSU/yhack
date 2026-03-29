"use client";

import { AnimatePresence, motion } from "motion/react";

interface SimLoadingScreenProps {
  isVisible: boolean;
}

export function SimLoadingScreen({ isVisible }: SimLoadingScreenProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 z-[200] flex items-center justify-center font-pixel"
          style={{ background: "#1a1208" }}
        >
          <div className="flex flex-col items-center text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 1.2 }}
              className="text-[14px] font-pixel uppercase tracking-[0.3em]"
              style={{
                color: "#D4A520",
                textShadow:
                  "0 0 8px rgba(212,165,32,0.5), 0 0 16px rgba(212,165,32,0.25)",
              }}
            >
              {"\u2605"} Pelican Town {"\u2605"}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 1.0 }}
              className="text-[20px] font-pixel uppercase tracking-wide"
              style={{ color: "#E8D5A3" }}
            >
              Day 1 {"\u2014"} Spring
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0.6, 1] }}
              transition={{
                delay: 1.5,
                duration: 2,
                repeat: Number.POSITIVE_INFINITY,
              }}
              className="text-[10px] font-mono uppercase tracking-[0.3em]"
              style={{ color: "#8B7355" }}
            >
              Preparing simulation...
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8, duration: 0.8 }}
              className="w-64"
            >
              <div
                className="h-4 overflow-hidden rounded-sm"
                style={{
                  background: "#E8D5A3",
                  border: "2px solid #6B4226",
                  boxShadow:
                    "inset 1px 1px 0 rgba(196,164,108,.4), 2px 2px 0 rgba(61,37,16,.3)",
                }}
              >
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "92%" }}
                  transition={{
                    delay: 2.2,
                    duration: 4,
                    ease: "easeInOut",
                  }}
                  className="h-full rounded-sm progress-glow"
                  style={{
                    background: "linear-gradient(90deg, #D4A520, #C97D1A)",
                  }}
                />
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
