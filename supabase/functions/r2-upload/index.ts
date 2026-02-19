/**
 * Supabase Edge Function: r2-upload
 * Handles uploading images to Cloudflare R2 and deleting them.
 *
 * POST: Upload file to R2
 * DELETE: Remove file from R2
 *
 * Environment variables (set in Supabase Dashboard > Edge Functions > Secrets):
 *   CF_R2_ACCOUNT_ID, CF_R2_ACCESS_KEY, CF_R2_SECRET_KEY, CF_R2_BUCKET_NAME
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.18'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

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

    const aws = getR2Client()

    // ── DELETE ──
    if (req.method === 'DELETE') {
      const { key } = await req.json()
      if (!key || !key.startsWith(user.id + '/')) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const r2Res = await aws.fetch(r2Endpoint(key), { method: 'DELETE' })
      if (!r2Res.ok) {
        throw new Error(`R2 delete failed: ${r2Res.status} ${await r2Res.text()}`)
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── POST (upload) ──
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const key = formData.get('key') as string | null

    if (!file || !key) {
      return new Response(JSON.stringify({ error: 'Missing file or key' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!key.startsWith(user.id + '/')) {
      return new Response(JSON.stringify({ error: 'Forbidden: key must start with your user ID' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const arrayBuffer = await file.arrayBuffer()

    const r2Res = await aws.fetch(r2Endpoint(key), {
      method: 'PUT',
      body: arrayBuffer,
      headers: { 'Content-Type': file.type || 'image/webp' },
    })

    if (!r2Res.ok) {
      throw new Error(`R2 upload failed: ${r2Res.status} ${await r2Res.text()}`)
    }

    return new Response(
      JSON.stringify({ success: true, key, size: arrayBuffer.byteLength }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[r2-upload] Error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
