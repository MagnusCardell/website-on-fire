import { useState, useCallback } from 'react';

export const useTmux = () => {
  // Number of panes in the tmux session
  const [panes] = useState([0, 1]); // Two panes by default
  
  // Index of the currently active pane (0-based)
  const [activePane, setActivePane] = useState(0);

  // Toggle between panes
  const togglePane = useCallback((index: number) => {
    if (index >= 0 && index < panes.length) {
      setActivePane(index);
    }
  }, [panes]);

  // Move to next pane
  const nextPane = useCallback(() => {
    setActivePane((prev) => (prev + 1) % panes.length);
  }, [panes]);

  // Move to previous pane
  const prevPane = useCallback(() => {
    setActivePane((prev) => (prev - 1 + panes.length) % panes.length);
  }, [panes]);

  return {
    panes,
    activePane,
    togglePane,
    nextPane,
    prevPane,
  };
};
