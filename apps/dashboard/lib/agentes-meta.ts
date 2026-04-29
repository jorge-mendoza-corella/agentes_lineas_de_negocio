export const AGENTES_META: Record<string, { emoji: string; nombre: string; area: string }> = {
  'pm-global':          { emoji: '🎯', nombre: 'PM Global',              area: 'Sistemas'    },
  'dev-pm':             { emoji: '📊', nombre: 'PM Desarrollo',          area: 'Desarrollo'  },
  'dev-analista':       { emoji: '🔍', nombre: 'Analista',               area: 'Desarrollo'  },
  'dev-backend':        { emoji: '⚙️',  nombre: 'Backend',                area: 'Desarrollo'  },
  'dev-bd':             { emoji: '🗄️',  nombre: 'Base de Datos',          area: 'Desarrollo'  },
  'dev-frontend':       { emoji: '🎨', nombre: 'Frontend',               area: 'Desarrollo'  },
  'dev-devops':         { emoji: '🚀', nombre: 'DevOps',                 area: 'Desarrollo'  },
  'dev-testing':        { emoji: '🧪', nombre: 'QA / Testing',           area: 'Desarrollo'  },
  'dev-diseno':         { emoji: '✏️',  nombre: 'Diseño UI/UX',           area: 'Desarrollo'  },
  'dev-documentador':   { emoji: '📝', nombre: 'Documentador',           area: 'Desarrollo'  },
  'dev-seguridad':      { emoji: '🔒', nombre: 'Seguridad',              area: 'Desarrollo'  },
  'dev-ciberseguridad': { emoji: '🛡️',  nombre: 'Ciberseguridad',         area: 'Desarrollo'  },
  'dev-redes':          { emoji: '🌐', nombre: 'Redes',                  area: 'Desarrollo'  },
  'dev-soporte':        { emoji: '🎧', nombre: 'Soporte',                area: 'Desarrollo'  },
  'dev-imagenes':       { emoji: '🖼️',  nombre: 'Generación de Imágenes', area: 'Desarrollo'  },
  'dev-presentaciones': { emoji: '📑', nombre: 'Presentaciones',         area: 'Desarrollo'  },
  'dev-videojuegos':    { emoji: '🎮', nombre: 'Videojuegos',            area: 'Desarrollo'  },
};

export function agenteLabel(nombre: string): string {
  const m = AGENTES_META[nombre];
  return m ? `${m.emoji} ${m.nombre}` : nombre;
}
