# SurveyCanvas

A visual questionnaire builder for research and survey teams.

## Features
- Visual question builder with drag-to-reorder
- Single choice, multiple choice, short/long text, dropdown, number, rating and matrix questions
- Editable question text, descriptions, variable names, answer options and required settings
- Conditional display logic with equals, does-not-equal and contains operators
- Live respondent preview with branching, validation and response export
- Local autosave and questionnaire JSON export
- Undo and redo

## Run locally
```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy
Import this repository into Vercel. The project uses Next.js and requires no environment variables for the demo experience.

SurveyCanvas stores the draft in browser localStorage. JSON exports can be used as portable questionnaire definitions.
