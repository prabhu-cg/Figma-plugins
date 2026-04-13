# 🪄 Layout Genie — Figma Plugin

A Figma plugin that generates multiple responsive web page layouts for inspiration and rapid prototyping.

---

## ✨ Features

- **4 layout types**: Hero + Features, Magazine/Editorial, Dashboard/App, Portfolio/Creative
- **Fully customizable**: Primary & accent color, dark/light mode, page name
- **Modern UI**: Tab-based interface with live color pickers, mini SVG previews, and progress indicator
- **Results panel**: Focus or delete individual generated layouts from within the plugin
- **Works on ALL Figma plans** (Starter, Professional, Organisation, Enterprise)
- **Auto Layout powered** — all frames use Figma Auto Layout for responsive-ready designs

---

## 🚀 Installation (Development / Local)

1. Open **Figma Desktop App** (required for plugin development)
2. Go to **Plugins → Development → Import plugin from manifest…**
3. Navigate to and select the `manifest.json` file in this folder
4. The plugin will appear under **Plugins → Development → Layout Genie**

---

## 📁 File Structure

```
layout-genie/
├── manifest.json   — Plugin metadata
├── code.js         — Plugin backend (runs in Figma sandbox)
├── ui.html         — Plugin UI (runs in iframe)
└── README.md       — This file
```

---

## 🎨 Layout Types

| Layout | Description | Best For |
|--------|-------------|----------|
| **Hero + Features** | Nav, hero with CTA, feature cards section | SaaS, startups, product launches |
| **Magazine / Editorial** | Asymmetric grid, article cards, trending ticker | News, blogs, content platforms |
| **Dashboard / App** | Sidebar nav, stat cards, charts, activity feed | Admin panels, analytics tools |
| **Portfolio / Creative** | Large typography hero, work grid | Personal sites, agencies, freelancers |

---

## 🛣️ Roadmap / Future Ideas

- [ ] Mobile & tablet responsive frames (375px / 768px) auto-generated
- [ ] AI-powered content fill (realistic copy via LLM)
- [ ] Theme presets (Monochrome, Neon, Earthy, Pastel)
- [ ] More layouts: E-commerce, Pricing page, Auth screens, Waitlist
- [ ] Section Randomiser — mix sections across layout types
- [ ] Component Library Sync — detect & reuse local components
- [ ] Export to HTML/Tailwind/React

---

## 🔧 Technical Notes

- Uses **Figma Plugin API v1** — compatible with all Figma plans
- All layout frames placed on the **current page** at spaced X positions
- Fonts loaded: **Inter** (Regular, Medium, SemiBold, Bold) — built into Figma
- No external dependencies or network requests required
