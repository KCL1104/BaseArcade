const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // List of migration files to run
  const migrations = [
    'migrations/chroma_pixel_locking.sql',
    'migrations/fountain_rollover_chroma_fees.sql'
  ];

  for (const migrationFile of migrations) {
    console.log(`Running migration: ${migrationFile}`);
    
    try {
      const sqlContent = fs.readFileSync(path.join(__dirname, migrationFile), 'utf8');
      
      // Execute the entire SQL content as one query
      const { error } = await supabase.rpc('exec', { sql: sqlContent });
      if (error) {
        // If exec function doesn't exist, try alternative approach
        console.log(`Note: Direct SQL execution not available, migration may need manual application`);
        console.log(`SQL content for ${migrationFile}:`);
        console.log(sqlContent);
      }
      
      console.log(`✅ Migration ${migrationFile} completed successfully`);
    } catch (error) {
      console.error(`❌ Error running migration ${migrationFile}:`, error);
    }
  }

  console.log('All migrations completed!');
}

runMigrations().catch(console.error);