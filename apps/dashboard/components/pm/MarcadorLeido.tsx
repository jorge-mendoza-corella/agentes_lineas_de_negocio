'use client';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  conversacionId: string;
  userId: string;
}

export default function MarcadorLeido({ conversacionId, userId }: Props) {
  useEffect(() => {
    const supabase = createClient();
    (supabase as any)
      .from('conversaciones_pm')
      .update({ leido_en: new Date().toISOString() })
      .eq('id', conversacionId)
      .eq('usuario_id', userId)
      .then(() => {});
  }, [conversacionId, userId]);

  return null;
}
