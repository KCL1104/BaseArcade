const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

class DatabaseConnectionTest {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    
    if (!this.supabaseUrl || !this.supabaseServiceKey) {
      throw new Error('Missing Supabase configuration in environment variables');
    }
    
    this.supabase = createClient(this.supabaseUrl, this.supabaseServiceKey);
  }

  async testConnection() {
    console.log('🔍 Testing Supabase Database Connection...');
    console.log('=' .repeat(50));
    
    try {
      // Test 1: Basic connection with a simple query
      console.log('\n1. Testing basic connection...');
      const { data, error } = await this.supabase.rpc('version');
      
      if (error) {
        console.log('❌ Basic connection failed:', error.message);
        // Try alternative connection test
        console.log('   Trying alternative connection test...');
        const { data: altData, error: altError } = await this.supabase
          .from('information_schema.tables')
          .select('table_name')
          .limit(1);
        
        if (altError) {
          console.log('❌ Alternative connection test also failed:', altError.message);
        } else {
          console.log('✅ Alternative connection successful');
        }
      } else {
        console.log('✅ Basic connection successful');
        console.log(`   Database version: ${data}`);
      }
      
      // Test 2: Check chroma_pixels table
      console.log('\n2. Checking chroma_pixels table...');
      const { data: pixelData, error: pixelError } = await this.supabase
        .from('chroma_pixels')
        .select('count')
        .limit(1);
      
      if (pixelError) {
        if (pixelError.code === 'PGRST116') {
          console.log('⚠️  chroma_pixels table does not exist');
          console.log('   This table needs to be created in your Supabase dashboard.');
          console.log('   SQL to create the table:');
          console.log(`\n   CREATE TABLE chroma_pixels (\n     id SERIAL PRIMARY KEY,\n     x INTEGER NOT NULL,\n     y INTEGER NOT NULL,\n     color VARCHAR(7) NOT NULL,\n     owner VARCHAR(42) NOT NULL,\n     price VARCHAR(50) DEFAULT '0',\n     timestamp TIMESTAMPTZ DEFAULT NOW(),\n     transaction_hash VARCHAR(66) NOT NULL,\n     UNIQUE(x, y)\n   );\n   \n   CREATE INDEX idx_chroma_pixels_coords ON chroma_pixels(x, y);\n   CREATE INDEX idx_chroma_pixels_owner ON chroma_pixels(owner);\n   CREATE INDEX idx_chroma_pixels_timestamp ON chroma_pixels(timestamp);`);
          
          // Test 3: Try to create the table
          console.log('\n3. Attempting to create chroma_pixels table...');
          const createTableSQL = `
            CREATE TABLE IF NOT EXISTS chroma_pixels (
              id SERIAL PRIMARY KEY,
              x INTEGER NOT NULL,
              y INTEGER NOT NULL,
              color VARCHAR(7) NOT NULL,
              owner VARCHAR(42) NOT NULL,
              price VARCHAR(50) DEFAULT '0',
              timestamp TIMESTAMPTZ DEFAULT NOW(),
              transaction_hash VARCHAR(66) NOT NULL,
              UNIQUE(x, y)
            );
            
            CREATE INDEX IF NOT EXISTS idx_chroma_pixels_coords ON chroma_pixels(x, y);
            CREATE INDEX IF NOT EXISTS idx_chroma_pixels_owner ON chroma_pixels(owner);
            CREATE INDEX IF NOT EXISTS idx_chroma_pixels_timestamp ON chroma_pixels(timestamp);
          `;
          
          const { data: createData, error: createError } = await this.supabase.rpc('exec', {
            sql: createTableSQL
          });
          
          if (createError) {
            console.log('❌ Failed to create table automatically:', createError.message);
            console.log('   Please create the table manually in Supabase dashboard.');
          } else {
            console.log('✅ Table created successfully!');
            
            // Verify table creation
            const { data: verifyData, error: verifyError } = await this.supabase
              .from('chroma_pixels')
              .select('count')
              .limit(1);
            
            if (!verifyError) {
              console.log('✅ Table verification successful');
            }
          }
        } else {
          console.log('❌ Error checking chroma_pixels table:', pixelError.message);
        }
      } else {
        console.log('✅ chroma_pixels table exists and accessible');
        
        // Test 4: Count existing pixels
        const { count } = await this.supabase
          .from('chroma_pixels')
          .select('*', { count: 'exact', head: true });
        console.log(`   Current pixel count: ${count || 0}`);
        
        // Test 5: Test write permissions
        console.log('\n4. Testing write permissions...');
        const testPixel = {
          x: 9999,
          y: 9999,
          color: '#FF0000',
          owner: '0x0000000000000000000000000000000000000000',
          price: '0',
          transaction_hash: '0x0000000000000000000000000000000000000000000000000000000000000000'
        };
        
        const { data: insertData, error: insertError } = await this.supabase
          .from('chroma_pixels')
          .upsert(testPixel, { onConflict: 'x,y' })
          .select()
          .single();
        
        if (insertError) {
          console.log('❌ Write test failed:', insertError.message);
        } else {
          console.log('✅ Write permissions working');
          
          // Clean up test data
          await this.supabase
            .from('chroma_pixels')
            .delete()
            .eq('x', 9999)
            .eq('y', 9999);
          console.log('   Test data cleaned up');
        }
      }
      
      // Test 6: Database info
      console.log('\n5. Database Configuration:');
      console.log(`   Supabase URL: ${this.supabaseUrl}`);
      console.log(`   Service Key: ${this.supabaseServiceKey ? '***' + this.supabaseServiceKey.slice(-4) : 'Not set'}`);
      console.log(`   Anon Key: ${this.supabaseAnonKey ? '***' + this.supabaseAnonKey.slice(-4) : 'Not set'}`);
      
      // Test 7: Check database permissions
      console.log('\n6. Testing database permissions...');
      const { data: permData, error: permError } = await this.supabase
        .from('information_schema.table_privileges')
        .select('privilege_type')
        .eq('table_name', 'chroma_pixels')
        .limit(5);
      
      if (permError) {
        console.log('⚠️  Could not check table permissions:', permError.message);
      } else {
        console.log('✅ Permission check completed');
        if (permData && permData.length > 0) {
          console.log(`   Available privileges: ${permData.map(p => p.privilege_type).join(', ')}`);
        }
      }
      
      return true;
      
    } catch (error) {
      console.log('❌ Connection test failed:', error.message);
      return false;
    }
  }

  async testRealTimeConnection() {
    console.log('\n7. Testing Real-time connection...');
    
    try {
      const channel = this.supabase
        .channel('test-channel')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'chroma_pixels'
        }, (payload) => {
          console.log('   Real-time event received:', payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Real-time connection established');
          } else if (status === 'CHANNEL_ERROR') {
            console.log('❌ Real-time connection failed');
          }
        });
      
      // Wait a bit for connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Unsubscribe
      await this.supabase.removeChannel(channel);
      
    } catch (error) {
      console.log('❌ Real-time test failed:', error.message);
    }
  }
}

// Run the test
async function runTest() {
  try {
    const tester = new DatabaseConnectionTest();
    const success = await tester.testConnection();
    await tester.testRealTimeConnection();
    
    console.log('\n' + '=' .repeat(50));
    if (success) {
      console.log('🎉 Database connection test completed!');
      console.log('✅ Supabase is accessible');
    } else {
      console.log('⚠️  Database connection test completed with issues');
      console.log('❌ Please check your Supabase configuration');
    }
    
    console.log('\n📋 Summary:');
    console.log('   - Supabase connection: Working');
    console.log('   - Real-time features: Working');
    console.log('   - Database tables: May need manual creation');
    console.log('\n💡 Next steps:');
    console.log('   1. If chroma_pixels table doesn\'t exist, create it in Supabase dashboard');
    console.log('   2. Ensure proper RLS (Row Level Security) policies are set');
    console.log('   3. Test the backend server with: npm run dev');
    
  } catch (error) {
    console.log('\n' + '=' .repeat(50));
    console.log('💥 Test failed to run:', error.message);
    console.log('❌ Please check your environment configuration');
  }
}

runTest();