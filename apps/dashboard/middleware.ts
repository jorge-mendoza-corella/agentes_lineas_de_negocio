import { type NextRequest, NextResponse } from 'next/server';
import { actualizarSesion } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Las rutas /api/ manejan su propia autenticación — el middleware no debe
  // redirigirlas ni interferir (evita que fetch() del cliente siga un redirect
  // a /login silenciosamente y el handler nunca reciba la petición).
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next({ request });
  }
  return await actualizarSesion(request);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
