---
description: Deploy Enhanced Manga Translator Capabilities
---

# Deploy Enhanced Manga Translator Capabilities

This workflow guides you through using the newly imported skills to enhance the Manga Translator project.

## 1. UI/UX Design System Generation

Use `ui-ux-pro-max` to generate a premium design system for the translator interface.

```bash
# Generate a design system for a "Manga Translation Tool" with "Modern, Clean, Dark Mode" aesthetics
python .agent/skills/ui-ux-pro-max/scripts/search.py "Manga Translation Tool Modern Clean Dark Mode" --design-system -p "MG Translator"
```

## 2. Prompt Engineering for Translation

Use `prompt-engineering` principles to refine the translation prompts.

- Reference `.agent/skills/prompt-engineering/SKILL.md` for "Chain-of-Thought" and "Few-Shot" patterns.
- Apply these patterns to `lib/gemini.ts` or wherever the translation logic resides.

## 3. RAG Implementation for Glossary

Use `rag-implementation` to build the Series Glossary and Context Sliding Window.

- Reference `.agent/skills/rag-implementation/SKILL.md`.
- Implement a vector store (e.g., Chroma or local FAISS) to store glossary terms and past context.

## 4. Computer Vision Optimization

Use `computer-vision-expert` guidelines to improve image processing.

- Reference `.agent/skills/computer-vision-expert/SKILL.md`.
- Review current image processing code (e.g., in `app/actions` or `lib`) and optimize using the suggested "Deployment-First Design" or "Text-Guided Vision Pipelines".
