import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env and fill in your Supabase credentials.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)

// ── Auth helpers ────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
}

export async function signOut() {
  return supabase.auth.signOut()
}

/** Returns the session user, or null. Verifies @curednutrition.com domain. */
export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  if (!user.email?.endsWith('@curednutrition.com')) {
    await supabase.auth.signOut()
    return null
  }
  return user
}

// ── Tests ────────────────────────────────────────────────────────────────────

export async function fetchTests() {
  const { data, error } = await supabase
    .from('tests')
    .select('*, variants!variants_test_id_fkey(*, variant_changes(*))')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function fetchTest(id) {
  const { data, error } = await supabase
    .from('tests')
    .select('*, variants!variants_test_id_fkey(*, variant_changes(*))')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createTest({ name, url }) {
  const { data, error } = await supabase
    .from('tests')
    .insert({ name, url, status: 'draft' })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTestStatus(id, status) {
  const { error } = await supabase
    .from('tests')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

export async function endTest(testId, winnerVariantId) {
  const { error } = await supabase
    .from('tests')
    .update({ status: 'ended', winner_variant_id: winnerVariantId })
    .eq('id', testId)
  if (error) throw error
}

// ── Variants ─────────────────────────────────────────────────────────────────

export async function upsertVariant({ id, test_id, label, traffic_weight, is_control }) {
  const payload = { test_id, label, traffic_weight, is_control }
  if (id) {
    const { data, error } = await supabase
      .from('variants')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('variants')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteVariant(id) {
  const { error } = await supabase.from('variants').delete().eq('id', id)
  if (error) throw error
}

// ── Variant Changes ───────────────────────────────────────────────────────────

export async function upsertChange({ id, variant_id, element_id, change_type, new_value }) {
  const payload = { variant_id, element_id, change_type, new_value }
  if (id) {
    const { data, error } = await supabase
      .from('variant_changes')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('variant_changes')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

export async function deleteChange(id) {
  const { error } = await supabase.from('variant_changes').delete().eq('id', id)
  if (error) throw error
}

// ── Results ───────────────────────────────────────────────────────────────────

export async function fetchResults(testId) {
  const [{ data: visits, error: e1 }, { data: conversions, error: e2 }] = await Promise.all([
    supabase
      .from('visits')
      .select('variant_id, visitor_token')
      .eq('test_id', testId),
    supabase
      .from('conversions')
      .select('variant_id, visitor_token')
      .eq('test_id', testId),
  ])
  if (e1) throw e1
  if (e2) throw e2
  return { visits, conversions }
}
