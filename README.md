# Tokyo MLE Map

Interactive map of ML engineers and AI companies in Tokyo, showcasing Japan's machine learning ecosystem.

## Quick Start

```bash
live-server --port=8080 --no-browser --watch=css,js,data
```

Then open http://localhost:8080

## Prerequisites

- Node.js installed
- Install live-server: `npm install -g live-server`

## Development

Live-server watches `css/`, `js/`, and `data/` directories and auto-reloads the page on any changes.

## File Structure

```
tokyo-mle-map/
├── index.html
├── css/style.css
├── js/app.js
└── data/companies.json
```

## Editing Company Data

Edit `data/companies.json`. Each company entry uses this schema:

```json
{
  "id": 1,
  "name_en": "Company Name",
  "name_jp": "会社名",
  "description_en": "English description",
  "description_jp": "日本語の説明",
  "lat": 35.6895,
  "lng": 139.6925,
  "category": "AI/ML",
  "type": "established",
  "origin": "domestic",
  "website": "https://preferred.jp"
}
```

### Field Options

| Field | Options |
|-------|---------|
| `category` | `"AI/ML"` or `""` |
| `type` | `"startup"` or `"established"` |
| `origin` | `"domestic"` or `"foreign"` |

## Features

- Interactive Leaflet map with CartoDB tiles
- Filter by category, company type, and origin
- Search by name or description
- English / Japanese language toggle
- Responsive design
