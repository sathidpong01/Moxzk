# Moxzk Rights and Third-Party Notice

Moxzk source code is licensed under the MIT License. See `LICENSE`.

The MIT License applies to the app source code and project documentation unless a file states a different license. It does not automatically grant rights to materials that are not part of the app source code.

The following materials are not covered by the Moxzk MIT source-code license:

- The Moxzk name, logo, branding, visual identity, and product marks.
- Manga images, covers, translated pages, exports, drafts, album contents, and user-provided files.
- Magga website content, manga content, translations, branding, and community data.
- Third-party tools, models, datasets, fonts, packages, and services used with or by Moxzk.
- Private deployment configuration, secrets, accounts, and local runtime data.

Third-party dependencies keep their own licenses. Notable external dependencies and services include:

- PanelCleaner / `pcleaner-cli`: external GPLv3 dependency. Moxzk may install or start it as a separate local tool, but this repository does not vendor PanelCleaner code.
- Ollama and Ollama models: external app, service, and model artifacts. Their use is governed by Ollama's terms and the license of each selected model.
- Electron, React, Vite, Konva, Cloudflare tooling, and npm packages: governed by their own package licenses.

If a future distribution bundles additional third-party binaries, model files, fonts, or assets, add their notices before release.
