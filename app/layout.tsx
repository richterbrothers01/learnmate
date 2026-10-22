
import type { Metadata, Viewport } from "next";
import React from "react";

export const metadata: Metadata = {
  title: {
    default: "LearnMate",
    template: "%s | LearnMate",
  },
  description:
    "Learn smarter with LearnMate — your personal learning space for courses, lessons, quizzes, and progress tracking.",
  applicationName: "LearnMate",
  appleWebApp: {
    capable: true,
    title: "LearnMate",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}