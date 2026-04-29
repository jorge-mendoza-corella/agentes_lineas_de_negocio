interface Props {
  titulo: string;
  valor: number;
  color: 'yellow' | 'green' | 'red' | 'blue';
}

const colores = {
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  green:  'bg-green-50 border-green-200 text-green-800',
  red:    'bg-red-50 border-red-200 text-red-800',
  blue:   'bg-blue-50 border-blue-200 text-blue-800',
};

export default function TarjetaEstadisticas({ titulo, valor, color }: Props) {
  return (
    <div className={`rounded-2xl border p-6 ${colores[color]}`}>
      <p className="text-sm font-medium opacity-75">{titulo}</p>
      <p className="text-4xl font-bold mt-1">{valor}</p>
    </div>
  );
}
