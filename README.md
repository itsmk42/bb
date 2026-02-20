# builderballery.com

Practical authority website for residential construction guidance.

## Structure

- `/index.html`: Main website with 4 sections (Home, Videos, Consultation, Documents)
- `/assets/styles.css`: Main styles (mobile-first, minimal)
- `/assets/app.js`: Data loader and section rendering
- `/content/site.json`: Core profile and form config
- `/content/videos.json`: Video entries
- `/content/documents.json`: Document entries
- `/documents`: PDF storage
- `/admin/index.html`: Simple content manager for JSON updates

## Form to email setup

This project uses a configurable endpoint in `/content/site.json`:

```json
"inquiryEndpoint": "https://formsubmit.co/YOUR_EMAIL@example.com"
```

Replace with your final email endpoint before launch.

Example using FormSubmit:

```json
"inquiryEndpoint": "https://formsubmit.co/yourname@example.com"
```

## Add videos

Edit `/content/videos.json` or use `/admin/index.html` and export.

Schema:

```json
[
  {
    "title": "Column Layout Mistakes",
    "category": "Structural",
    "reelUrl": "https://www.instagram.com/reel/XXXXXXXXXXX/",
    "summary": "Explains how wrong column placement affects planning and load path. Shows a practical site check before slab casting.",
    "relatedDocumentIds": ["doc-001"]
  }
]
```

## Add documents

1. Upload PDF to `/documents`.
2. Add metadata in `/content/documents.json`.

Schema:

```json
[
  {
    "id": "doc-001",
    "title": "BBMP Plan Approval Checklist",
    "description": "Checklist of plan approval items for residential submission and review.",
    "date": "2026-02-20",
    "downloadUrl": "/documents/bbmp-plan-approval-checklist.pdf"
  }
]
```

## SEO

- Page title and description are already set.
- `robots.txt` and `sitemap.xml` included.
- Person schema included in `index.html`.

Update personal details inside `/content/site.json` and `index.html` JSON-LD if needed.
