# TrendGuesser Seed Data

This directory contains the seed data files used to populate the database for TrendGuesser.

## Files

- **data.csv** - Original CSV data file containing search terms with their categories and volumes
- **terms.json** - Converted JSON version of the CSV data (generated automatically)

## Format

### CSV Format

The CSV file has the following columns:
```
Keyword,Category,Monthly Search Volume
```

Example:
```
YouTube,Technology,1200000000
Facebook,Technology,724500000
WhatsApp Web,Technology,521000000
```

### JSON Format

The JSON file contains an array of term objects with the following structure:
```json
[
  {
    "id": "youtube",
    "term": "YouTube",
    "volume": 1200000000,
    "category": "technology",
    "imageUrl": "/api/image?term=YouTube",
    "timestamp": "2023-04-14T00:00:00.000Z"
  },
  ...
]
```

## Usage

These files are used automatically during:

1. **Development**: When running `npm run dev`, the CSV is converted to JSON
2. **Deployment**: When deploying with `npm run deploy`
3. **Database Initialization**: When running `npm run db:init`

You can manually convert the CSV to JSON with:
```
npm run convert-csv
```

## Modifying the Data

To modify the seed data:

1. Edit `data.csv` with your additions or changes
2. Run `npm run convert-csv` to update the JSON file
3. The changes will be used next time the database is initialized

Note: If you only want to make a few changes, you can directly edit `terms.json`, but any
changes will be overwritten the next time `convert-csv` is run.