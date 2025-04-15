
          import { initializeDatabase } from '../.next/server/app/db.js';
          
          initializeDatabase()
            .then(() => {
              console.log('Database initialized successfully with ESM import!');
              process.exit(0);
            })
            .catch(err => {
              console.error('ESM initialization failed:', err);
              process.exit(1);
            });
        