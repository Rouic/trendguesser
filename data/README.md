# TrendGuesser Data Directory

This directory contains the JSON data files used by TrendGuesser:

- **terms.json**: Contains all search terms with their volumes and categories
- **games.json**: Stores active and past game sessions
- **players.json**: Stores player data including high scores
- **leaderboard.json**: Stores global leaderboard data by category

## Data Organization

### terms.json
```json
[
  {
    "id": "unique-id",
    "term": "Search Term",
    "volume": 123456,
    "category": "technology",
    "imageUrl": "/api/image?term=Search+Term",
    "timestamp": "2025-04-14T12:00:00.000Z"
  },
  ...
]
```

### games.json
```json
{
  "GAMEID": {
    "id": "GAMEID",
    "createdAt": "2025-04-14T12:00:00.000Z",
    "createdBy": "player-uid",
    "gameType": "trendguesser",
    "status": "active",
    "__trendguesser.state": {
      "currentRound": 1,
      "category": "technology",
      "started": true,
      "finished": false,
      ...
    },
    "player-uid": {
      "uid": "player-uid",
      "name": "Player",
      "score": 5
    }
  },
  ...
}
```

### players.json
```json
{
  "player-uid": {
    "uid": "player-uid",
    "name": "Player",
    "score": 0,
    "highScores": {
      "technology": 10,
      "sports": 5,
      ...
    }
  },
  ...
}
```

### leaderboard.json
```json
{
  "technology": {
    "player-uid": {
      "uid": "player-uid",
      "name": "Player",
      "score": 10,
      "highScores": {
        "technology": 10
      }
    },
    ...
  },
  ...
}
```

## Data Migration

Data is initialized from the CSV file in functions/src/data.csv using the migration script:

```bash
npm run migrate-data
```

This script parses the CSV and creates the initial terms.json file and empty structure for the other data files.