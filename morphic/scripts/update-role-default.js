const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://cuxjllkszuymhzdeekqj.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const query = `
  ALTER TABLE users ALTER COLUMN role DROP DEFAULT; 
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check; 
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'management', 'sales', 'support', 'operations', 'accounting', 'unassigned')); 
  ALTER TABLE users ALTER COLUMN role SET DEFAULT 'unassigned';
`;

// There might not be an execute_sql RPC, so we may need the user to run this in the Supabase UI.
supabase.rpc('execute_sql', { query })
    .then(console.log)
    .catch(console.error);
