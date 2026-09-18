import { createClient } from '@supabase/supabase-js';

export default async function Home() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let dbStatus = 'NOT_CONFIGURED';

  if (url && key) {
    try {
      const supabase = createClient(url, key);
      const { error } = await supabase.from('tjsl_programs').select('id').limit(1);
      dbStatus = error ? 'CONNECTED_WITH_QUERY_ERROR' : 'CONNECTED';
    } catch {
      dbStatus = 'CONNECTION_ERROR';
    }
  }

  return (
    <main style={{fontFamily:'Arial',maxWidth:1100,margin:'40px auto',padding:20}}>
      <p style={{color:'#5d6b7a'}}>NORTAGO · TJSL IMPACT CONTROL TOWER</p>
      <h1>Staging Control Tower</h1>
      <p>Environment: <b>{process.env.TJSL_ENV || 'unknown'}</b></p>
      <p>Supabase: <b>{dbStatus}</b></p>
      <hr/>
      <h2>Release Gates</h2>
      <ol>
        <li>Authentication + RLS</li>
        <li>OCT transaction ingestion + idempotency</li>
        <li>Evidence private storage + verification</li>
        <li>SROI Gate + server-side calculation</li>
        <li>Executive report + audit trail</li>
      </ol>
      <p style={{color:'#5d6b7a'}}>This staging shell intentionally contains no credentials and no production data.</p>
    </main>
  );
}