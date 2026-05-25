export interface MotionLikeProps {
  initial: false | Record<string, number>;
  animate: Record<string, number | string>;
  exit?: Record<string, number>;
  transition: {
    duration: number;
    ease?: string;
  };
}

export function panelMotionProps(reducedMotion: boolean): MotionLikeProps {
  if (reducedMotion) {
    return {
      initial: false,
      animate: { opacity: 1 },
      transition: { duration: 0 }
    };
  }

  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 6 },
    transition: { duration: 0.16, ease: "easeOut" }
  };
}

export function progressMotionProps(reducedMotion: boolean, percent: number): MotionLikeProps {
  const width = `${Math.max(0, Math.min(100, percent))}%`;
  if (reducedMotion) {
    return {
      initial: false,
      animate: { width },
      transition: { duration: 0 }
    };
  }

  return {
    initial: { opacity: 0, width: 0 },
    animate: { opacity: 1, width },
    transition: { duration: 0.24, ease: "easeOut" }
  };
}
