/**
 * Supabase Edge Function: r2-url
 * Generates presigned download URLs for R2 objects.
 *
 * POST { key: string } → { url: string }
 *
 * Environment variables (set in Supabase Dashboard > Edge Functions > Secrets):
 *   CF_R2_ACCOUNT_ID, CF_R2_ACCESS_KEY, CF_R2_SECRET_KEY, CF_R2_BUCKET_NAME
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

const URL_EXPIRY_SECONDS = 3600 // 1 hour

function getR2Client() {
  return new AwsClient({
    accessKeyId: Deno.env.get('CF_R2_ACCESS_KEY')!,
    secretAccessKey: Deno.env.get('CF_R2_SECRET_KEY')!,
    service: 's3',
    region: 'auto',
  })
}

function r2Endpoint(key: string) {
  const accountId = Deno.env.get('CF_R2_ACCOUNT_ID')!
  const bucket = Deno.env.get('CF_R2_BUCKET_NAME') || 'mg-translater'
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`
}

function getSupabaseClient(authHeader: string) {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = getSupabaseClient(authHeader)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { key } = await req.json()
    if (!key || typeof key !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing key' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!key.startsWith(user.id + '/')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Generate presigned URL using aws4fetch
    const aws = getR2Client()
    const url = r2Endpoint(key)
    const signed = await aws.sign(
      new Request(url, { method: 'GET' }),
      { aws: { signQuery: true }, expiresIn: URL_EXPIRY_SECONDS },
    )

    return new Response(
      JSON.stringify({ url: signed.url, expiresIn: URL_EXPIRY_SECONDS }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[r2-url] Error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
