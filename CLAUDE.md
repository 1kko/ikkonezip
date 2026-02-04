# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/claude-code) when working with code in this repository.

## Project Overview

IkkoNezip (이코네Zip) is a web application that fixes Korean filename encoding issues when transferring files from macOS to Windows. It converts NFD (Normalization Form Decomposed) filenames to NFC (Normalization Form Composed) and creates ZIP archives.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI based)
- **ZIP Library**: @zip.js/zip.js (supports AES-256 encryption)
- **Deployment**: Docker with Nginx

## Project Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components (button, card, badge, etc.)
│   ├── Header.tsx       # App header with logo, title, feature badges
│   ├── FileUploader.tsx # Drag-and-drop file/folder upload
│   ├── FileList.tsx     # Uploaded files display
│   └── DownloadButton.tsx # ZIP download with password option
├── hooks/
│   └── useFileProcessor.ts # File state management and processing
├── utils/
│   ├── normalizeFilename.ts # NFD→NFC conversion
│   └── zipFiles.ts      # ZIP creation with @zip.js/zip.js
├── lib/
│   └── utils.ts         # Utility functions (cn for classnames)
├── App.tsx              # Main application component
├── main.tsx             # Entry point
└── index.css            # Tailwind CSS + custom animations
```

## Key Features

1. **NFD → NFC Conversion**: Uses `String.prototype.normalize('NFC')`
2. **System File Exclusion**: Automatically excludes `.DS_Store`, `Thumbs.db`, `desktop.ini`
3. **AES-256 Encryption**: Password-protected ZIP compatible with Windows
4. **Date Prefix**: Downloads include `YYMMDD_` prefix
5. **Folder Name Detection**: ZIP filename defaults to uploaded folder name

## Common Commands

```bash
# Development
npm run dev

# Build
npm run build

# Preview production build
npm run preview

# Docker
docker-compose up --build
```

## Environment Variables

- `VITE_APP_NAME`: Application name (default: "맥윈집")

## Styling Notes

- Uses Tailwind CSS v4 with `@theme` directive
- Custom gradient animations: `.gradient-bg`, `.gradient-title`, `.gradient-button`
- System dark mode via `prefers-color-scheme: dark`
