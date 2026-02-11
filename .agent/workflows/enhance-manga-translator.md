---
description: Integrate Advanced AI Capabilities
---

# Integrate Advanced AI Capabilities

This workflow orchestrates the integration of imported AI skills into your Manga Translator project.

## 1. Prerequisite: Python Check

The `ui-ux-pro-max` skill requires Python.

```bash
python --version
```

_If this fails, please install Python from python.org or the Microsoft Store._

## 2. Generate Design System

Generates a premium design system based on your project requirements.
**Action**: Runs the UI/UX script to create a design manifest.

```bash
# Ensure you are in the project root
python .agent/skills/ui-ux-pro-max/scripts/search.py "Manga Translator Modern Dark Clean" --design-system -p "MG Translator" > components/ui/design-system.md
```

## 3. Scaffolding RAG Glossary

Sets up the structure for the Series Glossary using RAG principles.

```bash
mkdir -p lib/glossary
```

**Task**: Create `lib/glossary/types.ts`

```typescript
export interface GlossaryTerm {
  term: string;
  definition: string;
  context: string;
  embedding?: number[];
}
```

## 4. Structuring Translation Prompts

Applies Prompt Engineering best practices to your translation logic.

```bash
mkdir -p lib/prompts
```

**Task**: Create `lib/prompts/translation.ts`

```typescript
// Implements Chain-of-Thought prompting
export const TRANSLATION_SYSTEM_PROMPT = `
You are an expert manga translator.
1. Analyze the context of the bubble.
2. Identify any specific terms from the glossary.
3. Translate the text preserving nuance and tone.
4. Output only the final translation.
`;
```

## 5. Vision Pipeline Guidelines

Prepares the codebase for advanced image processing.

**Task**: Review `lib/vision/pipeline.ts` (to be created) and align with `.agent/skills/computer-vision-expert/SKILL.md`.
