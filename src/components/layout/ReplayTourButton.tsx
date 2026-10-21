"use client";

import { PlayCircle } from "lucide-react";
import { START_TOUR_EVENT } from "./ProductTour";

/** Help Center: start the walkthrough again. */
export function ReplayTourButton() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.dispatchEvent(new Event(START_TOUR_EVENT))}>
      <PlayCircle className="h-4 w-4" /> Replay the guided tour
    </button>
  );
}
