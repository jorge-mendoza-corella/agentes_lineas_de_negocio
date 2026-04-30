import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Servicios Agénticos — Dashboard',
  description: 'Panel de control de agentes y aprobaciones',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
