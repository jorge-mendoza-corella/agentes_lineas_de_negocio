'use client';
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-sm text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
    >
      🖨 Imprimir
    </button>
  );
}
