import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set. Please create a .env file based on .env.example');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Fetch all boxes, auto-reset is_evacuated if last_evacuated_at > 2 months ago
export async function fetchBoxes() {
  const { data, error } = await supabase
    .from('boxes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  const toReset = data.filter(
    (box) =>
      box.is_evacuated &&
      box.last_evacuated_at &&
      new Date(box.last_evacuated_at) < twoMonthsAgo
  );

  if (toReset.length > 0) {
    const ids = toReset.map((b) => b.id);
    await supabase
      .from('boxes')
      .update({ is_evacuated: false, updated_at: new Date().toISOString() })
      .in('id', ids);

    return data.map((box) => {
      if (ids.includes(box.id)) {
        return { ...box, is_evacuated: false };
      }
      return box;
    });
  }

  return data;
}

export async function createBox(boxData) {
  const { data, error } = await supabase
    .from('boxes')
    .insert([{ ...boxData, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateBox(id, updates) {
  const { data, error } = await supabase
    .from('boxes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteBox(id) {
  const { error } = await supabase.from('boxes').delete().eq('id', id);
  if (error) throw error;
}

export async function markEvacuated(id, isEvacuated) {
  const updates = {
    is_evacuated: isEvacuated,
    updated_at: new Date().toISOString(),
  };
  if (isEvacuated) {
    updates.last_evacuated_at = new Date().toISOString();
  }
  return updateBox(id, updates);
}
