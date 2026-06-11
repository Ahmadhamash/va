"use client";

import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { languageLabels, useLanguageStore } from "@/store/use-language-store";

export function LanguageToggle() {
  const { language, toggleLanguage } = useLanguageStore();
  const labels = languageLabels[language];

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={toggleLanguage}
      aria-label={labels.switchLanguage}
    >
      <Languages className="h-4 w-4" />
      <span className="hidden sm:inline">{labels.switchLanguage}</span>
    </Button>
  );
}
