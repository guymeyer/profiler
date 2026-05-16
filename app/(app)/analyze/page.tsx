"use client";
import { Suspense } from "react";
import { AnalyzeForm } from "@/components/analyzer/analyze-form";

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzeForm />
    </Suspense>
  );
}
