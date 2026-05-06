"use client";

import { TripErrorFallback } from "@/components/trips/TripErrorFallback";

export default function Error({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <TripErrorFallback onRetry={unstable_retry} />;
}
