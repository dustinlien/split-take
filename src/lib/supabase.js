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

// ── Duplicate Test ────────────────────────────────────────────────────────────

export async function duplicateTest(testId) {
  // 1. Fetch the full test with variants and changes
  const { data: source, error: e0 } = await supabase
    .from('tests')
    .select('*, variants!variants_test_id_fkey(*, variant_changes(*))')
    .eq('id', testId)
    .single()
  if (e0) throw e0

  // 2. Create the new test as draft
  const { data: newTest, error: e1 } = await supabase
    .from('tests')
    .insert({ name: source.name + ' (copy)', url: source.url, status: 'draft' })
    .select()
    .single()
  if (e1) throw e1

  // 3. Duplicate each variant and its changes
  for (const variant of (source.variants ?? [])) {
    const { data: newVariant, error: e2 } = await supabase
      .from('variants')
      .insert({ test_id: newTest.id, label: variant.label, traffic_weight: variant.traffic_weight, is_control: variant.is_control })
      .select()
      .single()
    if (e2) throw e2

    for (const change of (variant.variant_changes ?? [])) {
      const { error: e3 } = await supabase
        .from('variant_changes')
        .insert({ variant_id: newVariant.id, element_id: change.element_id, change_type: change.change_type, new_value: change.new_value })
      if (e3) throw e3
    }
  }

  // 4. Return the full new test
  const { data: full, error: e4 } = await supabase
    .from('tests')
    .select('*, variants!variants_test_id_fkey(*, variant_changes(*))')
    .eq('id', newTest.id)
    .single()
  if (e4) throw e4
  return full
}

// ── Results ───────────────────────────────────────────────────────────────────

export async function fetchResults(testId) {
  async function fetchAll(table, columns) {
    const pageSize = 1000
    let from = 0
    let all = []
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq('test_id', testId)
        .range(from, from + pageSize - 1)
      if (error) throw error
      all = all.concat(data)
      if (data.length < pageSize) break
      from += pageSize
    }
    return all
  }

  const [visits, conversions] = await Promise.all([
    fetchAll('visits', 'variant_id, visitor_token'),
    fetchAll('conversions', 'variant_id, visitor_token, revenue'),
  ])
  return { visits, conversions }
}
