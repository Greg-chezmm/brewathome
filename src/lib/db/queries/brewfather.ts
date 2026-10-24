import type { BrewfatherCredentials } from '@/lib/brewfather/types'
import { supabase } from '@/lib/supabase/client'

export async function getBrewfatherAccount(): Promise<BrewfatherCredentials | null> {
  const { data, error } = await supabase.from('brewfather_accounts').select('brewfather_user_id, api_key').maybeSingle()
  if (error) throw error
  return data ? { userId: data.brewfather_user_id as string, apiKey: data.api_key as string } : null
}

/** Un compte Brewfather est-il relié ? Ne lit pas la clé d'API : à utiliser partout où elle n'est pas nécessaire. */
export async function hasBrewfatherAccount(): Promise<boolean> {
  const { data, error } = await supabase.from('brewfather_accounts').select('brewfather_user_id').maybeSingle()
  if (error) throw error
  return data !== null
}

export async function saveBrewfatherAccount(userId: string, credentials: BrewfatherCredentials): Promise<void> {
  const { error } = await supabase.from('brewfather_accounts').upsert({
    user_id: userId,
    brewfather_user_id: credentials.userId.trim(),
    api_key: credentials.apiKey.trim(),
  })
  if (error) throw error
}

export async function deleteBrewfatherAccount(userId: string): Promise<void> {
  const { error } = await supabase.from('brewfather_accounts').delete().eq('user_id', userId)
  if (error) throw error
}
