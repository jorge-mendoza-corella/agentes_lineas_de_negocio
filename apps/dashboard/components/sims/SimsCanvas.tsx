'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { moverAvatarADescanso, reanudarTrabajo } from '@/lib/actions/avatares';

type EstadoAnim = 'idle' | 'caminando' | 'trabajando' | 'hablando' | 'celebrando';
type HairStyle  = 'profesional' | 'casual' | 'spiky' | 'hoodie' | 'bun' | 'creativo' | 'short';
type Accessory  = 'none' | 'glasses' | 'headset' | 'cap' | 'tie' | 'beret';
type RoleTool   = 'clipboard' | 'magnifier' | 'wrench' | 'screwdriver' | 'antenna' | 'palette' | 'paintbrush' | 'book' | 'shield' | 'database' | 'server' | 'none';
type LoungeAct  = 'playing' | 'sleeping' | 'chatting' | 'drinking' | 'idle';

interface Avatar  { id: string; agente_nombre: string | null; estado_animacion: EstadoAnim }
interface Entrada { id: string; agente: string; accion: string; creado_en: string; tarea_id?: string | null }
interface Tarea   { id: string; agente_asignado: string; descripcion: string; estado: string; notas: string | null; plan_ejecucion?: string | null }
interface Props   { avatoresIniciales: Avatar[]; bitacoraInicial: Entrada[]; tareasIniciales: Tarea[] }

interface PersonajeCfg {
  nombre: string; titulo: string; personalidad: string;
  color: string; colorDark: string; accent: string;
  deskRow: 0|1|2; deskCol: 0|1|2|3; loungeSlot: number;
  skinColor: string; hairColor: string;
  hairStyle: HairStyle; accessory: Accessory;
  tool: RoleTool; roleEmoji: string;
}

const PERSONAJES: Record<string, PersonajeCfg> = {
  'pm-global':          { nombre:'PM Global',   titulo:'Director Ejecutivo',   personalidad:'Visionario · Estratégico',  color:'#8b5cf6', colorDark:'#3b0764', accent:'#ddd6fe', deskRow:0, deskCol:0, loungeSlot:0,  skinColor:'#fcd7b0', hairColor:'#1a1a1a', hairStyle:'profesional', accessory:'tie',     tool:'clipboard',  roleEmoji:'🎯' },
  'dev-pm':             { nombre:'Dev PM',       titulo:'Project Manager',      personalidad:'Organizado · Metódico',     color:'#a855f7', colorDark:'#4a044e', accent:'#e9d5ff', deskRow:0, deskCol:1, loungeSlot:1,  skinColor:'#d4956a', hairColor:'#3b2005', hairStyle:'casual',     accessory:'none',    tool:'book',       roleEmoji:'👨‍💼' },
  'dev-backend':        { nombre:'Backend',      titulo:'Ing. Backend',         personalidad:'Analítico · Preciso',       color:'#3b82f6', colorDark:'#1e1b4b', accent:'#bfdbfe', deskRow:0, deskCol:2, loungeSlot:2,  skinColor:'#f1c27d', hairColor:'#2d2d2d', hairStyle:'spiky',      accessory:'glasses', tool:'server',     roleEmoji:'⚙️' },
  'dev-bd':             { nombre:'BD',           titulo:'DBA Supabase',         personalidad:'Estructurado · Ordenado',   color:'#22c55e', colorDark:'#052e16', accent:'#bbf7d0', deskRow:0, deskCol:3, loungeSlot:3,  skinColor:'#e8c99a', hairColor:'#5c3317', hairStyle:'short',      accessory:'none',    tool:'database',   roleEmoji:'🗄️' },
  'dev-frontend':       { nombre:'Frontend',     titulo:'Desarrollador UI',     personalidad:'Creativo · Detallista',     color:'#ec4899', colorDark:'#500724', accent:'#fbcfe8', deskRow:1, deskCol:0, loungeSlot:4,  skinColor:'#f0c9a0', hairColor:'#e11d48', hairStyle:'creativo',   accessory:'none',    tool:'paintbrush', roleEmoji:'🎨' },
  'dev-devops':         { nombre:'DevOps',       titulo:'Ing. Infraestructura', personalidad:'Eficiente · Automatizador', color:'#f97316', colorDark:'#431407', accent:'#fed7aa', deskRow:1, deskCol:1, loungeSlot:5,  skinColor:'#8d5524', hairColor:'#1a1a1a', hairStyle:'short',      accessory:'cap',     tool:'wrench',     roleEmoji:'🚀' },
  'dev-testing':        { nombre:'Testing',      titulo:'QA Engineer',          personalidad:'Riguroso · Meticuloso',     color:'#eab308', colorDark:'#422006', accent:'#fef08a', deskRow:1, deskCol:2, loungeSlot:6,  skinColor:'#fad7c0', hairColor:'#c8860a', hairStyle:'profesional', accessory:'glasses', tool:'magnifier',  roleEmoji:'🧪' },
  'dev-diseno':         { nombre:'Diseño',       titulo:'UX/UI Designer',       personalidad:'Empático · Visual',         color:'#f43f5e', colorDark:'#4c0519', accent:'#fecdd3', deskRow:1, deskCol:3, loungeSlot:7,  skinColor:'#d4956a', hairColor:'#2d1b0e', hairStyle:'bun',        accessory:'beret',   tool:'palette',    roleEmoji:'✏️' },
  'dev-documentador':   { nombre:'Docs',         titulo:'Documentador',         personalidad:'Claro · Comunicativo',      color:'#14b8a6', colorDark:'#042f2e', accent:'#ccfbf1', deskRow:2, deskCol:0, loungeSlot:8,  skinColor:'#f8d5b4', hairColor:'#7a7a7a', hairStyle:'casual',     accessory:'glasses', tool:'book',       roleEmoji:'📚' },
  'dev-ciberseguridad': { nombre:'Seguridad',    titulo:'Cyber Especialista',   personalidad:'Vigilante · Cauteloso',     color:'#ef4444', colorDark:'#450a0a', accent:'#fecaca', deskRow:2, deskCol:1, loungeSlot:9,  skinColor:'#6b3a2a', hairColor:'#0d0d0d', hairStyle:'hoodie',     accessory:'none',    tool:'shield',     roleEmoji:'🛡️' },
  'dev-redes':          { nombre:'Redes',        titulo:'Ing. de Redes',        personalidad:'Conectado · Ágil',          color:'#06b6d4', colorDark:'#083344', accent:'#cffafe', deskRow:2, deskCol:2, loungeSlot:10, skinColor:'#e5b48a', hairColor:'#3b2005', hairStyle:'short',      accessory:'headset', tool:'antenna',    roleEmoji:'📡' },
  'dev-soporte':        { nombre:'Soporte',      titulo:'Esp. Soporte',         personalidad:'Amable · Resolutivo',       color:'#6366f1', colorDark:'#1e1b4b', accent:'#c7d2fe', deskRow:2, deskCol:3, loungeSlot:11, skinColor:'#c68642', hairColor:'#1a1a1a', hairStyle:'casual',     accessory:'headset', tool:'screwdriver',roleEmoji:'🎧' },
};

const LOUNGE_POS = [
  {x:46, y:40},{x:68, y:40},{x:46, y:62},{x:68, y:62},
  {x:14, y:68},{x:28, y:68},
  {x:14, y:48},{x:28, y:48},
  {x:88, y:28},{x:88, y:52},
  {x:55, y:18},{x:18, y:24},
];

const DESK_POS = [
  {x:12,y:20},{x:37,y:20},{x:63,y:20},{x:88,y:20},
  {x:12,y:52},{x:37,y:52},{x:63,y:52},{x:88,y:52},
  {x:12,y:82},{x:37,y:82},{x:63,y:82},{x:88,y:82},
];

function atDesk(e: EstadoAnim) { return e === 'trabajando' || e === 'hablando' || e === 'celebrando'; }

function getLoungeActivity(slot: number): LoungeAct {
  if (slot <= 3) return 'playing';
  if (slot <= 5) return 'sleeping';
  if (slot <= 7) return 'chatting';
  if (slot <= 9) return 'drinking';
  return 'idle';
}

// ── Tool SVG shapes ───────────────────────────────────────────────────────────
function ToolShape({ tool, color, accent }: { tool: RoleTool; color: string; accent: string }) {
  switch (tool) {
    case 'clipboard':
      return (
        <g>
          <rect x="-5" y="36" width="14" height="19" rx="2" fill="#fef3c7" stroke="#d97706" strokeWidth="0.6"/>
          <rect x="0.5" y="33.5" width="4" height="5" rx="2" fill="#d97706"/>
          <line x1="-2" y1="43" x2="7" y2="43" stroke="#92400e" strokeWidth="0.9"/>
          <line x1="-2" y1="47" x2="7" y2="47" stroke="#92400e" strokeWidth="0.9"/>
          <line x1="-2" y1="51" x2="4" y2="51" stroke="#92400e" strokeWidth="0.9"/>
        </g>
      );
    case 'book':
      return (
        <g>
          <rect x="-7" y="37" width="14" height="17" rx="2" fill="#1d4ed8" stroke="#1e40af" strokeWidth="0.5"/>
          <line x1="-0.5" y1="37" x2="-0.5" y2="54" stroke="#1e40af" strokeWidth="0.8"/>
          <rect x="-5" y="42" width="4" height="1.5" rx="0.5" fill="rgba(255,255,255,0.5)"/>
          <rect x="-5" y="46" width="4" height="1.5" rx="0.5" fill="rgba(255,255,255,0.5)"/>
          <rect x="-5" y="50" width="3" height="1.5" rx="0.5" fill="rgba(255,255,255,0.5)"/>
        </g>
      );
    case 'magnifier':
      return (
        <g>
          <circle cx="44" cy="43" r="6.5" stroke="#e5e7eb" strokeWidth="2" fill="rgba(220,240,255,0.14)"/>
          <path d="M41 40 Q43.5 38.5 46 40" stroke="white" strokeWidth="0.8" fill="none" opacity="0.5"/>
          <line x1="49" y1="48" x2="55" y2="54" stroke="#9ca3af" strokeWidth="3" strokeLinecap="round"/>
        </g>
      );
    case 'wrench':
      return (
        <g transform="rotate(-20 40 48)">
          <rect x="38" y="44" width="4" height="11" rx="2" fill="#d1d5db"/>
          <path d="M36 44 Q37.5 38.5 40.5 38.5 Q43.5 38.5 44 42 Q41 41 40 44 Z" fill="#d1d5db"/>
          <path d="M36 55 Q37.5 60.5 40.5 60.5 Q43.5 60.5 44 57 Q41 58 40 55 Z" fill="#d1d5db"/>
        </g>
      );
    case 'screwdriver':
      return (
        <g transform="rotate(-28 40 48)">
          <rect x="38" y="40" width="4.5" height="3.5" rx="0.5" fill="#f97316"/>
          <rect x="39.3" y="43.5" width="1.8" height="13" rx="1" fill="#d1d5db"/>
          <path d="M38.8 56.5 L42 56.5 L42.5 58.5 L38.3 58.5 Z" fill="#374151"/>
        </g>
      );
    case 'antenna':
      return (
        <g>
          <line x1="26" y1="2.5" x2="33" y2="-12" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round"/>
          <circle cx="33" cy="-13.5" r="2.8" fill={color} stroke={accent} strokeWidth="0.5"/>
          <line x1="29.5" y1="-6" x2="36" y2="-6" stroke="#9ca3af" strokeWidth="1.1"/>
        </g>
      );
    case 'palette':
      return (
        <g>
          <ellipse cx="42" cy="46" rx="8" ry="6.5" fill="#f8fafc" stroke="#9ca3af" strokeWidth="0.8"/>
          <circle cx="39" cy="44" r="1.9" fill="#ef4444"/>
          <circle cx="43.5" cy="42.5" r="1.9" fill="#3b82f6"/>
          <circle cx="46" cy="47" r="1.9" fill="#22c55e"/>
          <circle cx="43.5" cy="51" r="1.9" fill="#f59e0b"/>
          <ellipse cx="39" cy="48.5" rx="2.2" ry="3" fill="#f9fafb" stroke="#9ca3af" strokeWidth="0.4"/>
        </g>
      );
    case 'paintbrush':
      return (
        <g transform="rotate(28 40 47)">
          <rect x="38.5" y="37" width="3" height="12" rx="1.5" fill="#c4a882"/>
          <ellipse cx="40" cy="49" rx="3.2" ry="5.5" fill={color}/>
          <ellipse cx="40" cy="49" rx="1.5" ry="2.5" fill={accent} opacity="0.6"/>
        </g>
      );
    case 'shield':
      return (
        <g>
          <path d="M16 30 L20.5 31 L25 30 L25 39 Q25 45 20.5 47 Q16 45 16 39 Z" fill={color} opacity="0.88"/>
          <path d="M18.5 37 L20 40.5 L24 33.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.9"/>
        </g>
      );
    case 'database':
      return (
        <g>
          <ellipse cx="-3" cy="37" rx="7" ry="2.8" fill={color} opacity="0.9"/>
          <rect x="-10" y="37" width="14" height="15" fill={color} opacity="0.75"/>
          <ellipse cx="-3" cy="52" rx="7" ry="2.8" fill={color}/>
          <ellipse cx="-3" cy="43" rx="7" ry="2" fill="none" stroke={accent} strokeWidth="0.9" opacity="0.65"/>
          <ellipse cx="-3" cy="48" rx="7" ry="2" fill="none" stroke={accent} strokeWidth="0.9" opacity="0.65"/>
        </g>
      );
    case 'server':
      return (
        <g>
          <rect x="-11" y="35" width="14" height="20" rx="2" fill="#1e293b" stroke={color} strokeWidth="0.9"/>
          <rect x="-9" y="38" width="10" height="3" rx="1" fill={color} opacity="0.55"/>
          <rect x="-9" y="43" width="10" height="3" rx="1" fill={color} opacity="0.55"/>
          <rect x="-9" y="48" width="10" height="3" rx="1" fill={color} opacity="0.55"/>
          <circle cx="-4" cy="51.5" r="1.2" fill="#22c55e"/>
        </g>
      );
    default:
      return null;
  }
}

// ── Figura humana SVG mejorada ───────────────────────────────────────────────
function HumanFigure({ cfg, estado }: { cfg: PersonajeCfg; estado: EstadoAnim }) {
  const { skinColor, hairColor, hairStyle, accessory, color, colorDark, accent, tool } = cfg;
  const isActive      = atDesk(estado);
  const isCelebrating = estado === 'celebrando';
  const isWorking     = estado === 'trabajando';
  const isTalking     = estado === 'hablando';

  const shadowColor   = 'rgba(0,0,0,0.12)';
  const eyeColor      = skinColor.startsWith('#6b') ? '#5b8dd9' : '#3d6bb5';

  const mouthCurve  = isCelebrating ? 'M13 20 Q20 26 27 20'
    : isWorking ? 'M14.5 20 Q20 22 25.5 20'
    : 'M13.5 20.5 Q20 24 26.5 20.5';

  const leftBrow  = isWorking ? 'M12 11 Q16 9.5 20 11' : isCelebrating ? 'M12 9.5 Q16 8 20 9.5' : 'M12 11 Q16 10 20 11';
  const rightBrow = isWorking ? 'M20 11 Q24 9.5 28 11' : isCelebrating ? 'M20 9.5 Q24 8 28 9.5' : 'M20 11 Q24 10 28 11';

  return (
    <svg width="40" height="56" viewBox="0 0 40 56" style={{ overflow: 'visible' }}>

      {/* Sombra suelo */}
      {isActive && <ellipse cx="20" cy="57" rx="14" ry="3" fill={color} opacity="0.28" />}

      {/* ── Herramienta de rol ── */}
      <ToolShape tool={tool} color={color} accent={accent} />

      {/* Brazo izquierdo */}
      <path d="M6 37 Q1 45 2 53" stroke={color} strokeWidth="5.5" strokeLinecap="round" fill="none" />
      {/* Mano izquierda */}
      <circle cx="2" cy="53" r="3" fill={skinColor} />

      {/* Brazo derecho */}
      <path d="M34 37 Q39 45 38 53" stroke={color} strokeWidth="5.5" strokeLinecap="round" fill="none" />
      {/* Mano derecha */}
      <circle cx="38" cy="53" r="3" fill={skinColor} />

      {/* Cuerpo / camisa */}
      <path d="M5 57 L5 38 Q9 29 17 28 L23 28 Q31 29 35 38 L35 57 Z" fill={color} />
      {/* Sombra lateral cuerpo */}
      <path d="M5 57 L5 38 Q8 30 16 28 L16 57 Z" fill="rgba(0,0,0,0.09)" />
      {/* Detalle cuello de camisa */}
      <path d="M16 28 L20 35 L24 28" fill="white" opacity="0.15" />

      {/* Cuello */}
      <rect x="17" y="25" width="6" height="6" rx="2.5" fill={skinColor} />
      <rect x="17" y="28" width="6" height="3" rx="1" fill={shadowColor} />

      {/* Cabeza */}
      <circle cx="20" cy="14" r="13" fill={skinColor} />
      {/* Sombra natural pómulos y mentón */}
      <ellipse cx="20" cy="24" rx="7.5" ry="3.5" fill={shadowColor} />
      <ellipse cx="8.5" cy="16" rx="3" ry="2.5" fill={shadowColor} opacity="0.5" />
      <ellipse cx="31.5" cy="16" rx="3" ry="2.5" fill={shadowColor} opacity="0.5" />

      {/* Orejas */}
      <ellipse cx="7" cy="15" rx="2.5" ry="3" fill={skinColor} />
      <ellipse cx="33" cy="15" rx="2.5" ry="3" fill={skinColor} />

      {/* ── Cabello ── */}
      {hairStyle === 'profesional' && (
        <path d="M7 14 Q7 1 20 1 Q33 1 33 14 Q31 5 20 4 Q9 5 7 14" fill={hairColor} />
      )}
      {hairStyle === 'casual' && (
        <path d="M7 16 Q6 0 20 0 Q34 0 33 16 Q31 4 20 3 Q9 4 7 16" fill={hairColor} />
      )}
      {hairStyle === 'spiky' && (
        <g fill={hairColor}>
          <path d="M7 14 Q9 3 20 2 Q31 3 33 14 Q30 6 20 5 Q10 6 7 14" />
          <path d="M10 8 L12 0 L14 8" />
          <path d="M17 6 L20 -1 L23 6" />
          <path d="M26 8 L28 0 L30 8" />
        </g>
      )}
      {hairStyle === 'hoodie' && (
        <g fill={colorDark}>
          <path d="M4 18 Q5 -1 20 -1 Q35 -1 36 18 Q33 4 20 3 Q7 4 4 18" />
          <path d="M4 18 Q3 13 5 9" opacity="0.5" fill="none" stroke={colorDark} strokeWidth="3"/>
        </g>
      )}
      {hairStyle === 'bun' && (
        <g>
          <path d="M7 16 Q7 5 20 4 Q33 5 33 16 Q31 8 20 7 Q9 8 7 16" fill={hairColor} />
          <circle cx="20" cy="1.5" r="5.5" fill={hairColor} />
          <path d="M15 3 Q20 0.5 25 3" stroke={hairColor} strokeWidth="2" fill="none" />
        </g>
      )}
      {hairStyle === 'creativo' && (
        <g>
          <path d="M6 16 Q4 0 20 0 Q36 0 34 16 Q31 4 20 3 Q9 4 6 16" fill={hairColor} />
          <path d="M6 13 Q3 8 4 4 Q6 1 10 4 Q8 9 6 13" fill={hairColor} />
          <path d="M34 13 Q37 8 36 4 Q34 1 30 4 Q32 9 34 13" fill={hairColor} />
        </g>
      )}
      {hairStyle === 'short' && (
        <path d="M7 14 Q8 4 20 3 Q32 4 33 14 Q31 7 20 6 Q9 7 7 14" fill={hairColor} />
      )}

      {/* Mejillas al hablar o celebrar */}
      {(isCelebrating || isTalking) && (
        <>
          <circle cx="11" cy="17" r="3.5" fill="#ff8fab" opacity="0.28" />
          <circle cx="29" cy="17" r="3.5" fill="#ff8fab" opacity="0.28" />
        </>
      )}

      {/* Cejas */}
      <path d={leftBrow}  stroke={hairColor} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d={rightBrow} stroke={hairColor} strokeWidth="1.4" fill="none" strokeLinecap="round" />

      {/* Ojos: blanco + iris + pupila + reflejo */}
      <ellipse cx="15" cy="15" rx="3.5" ry="2.8" fill="white" opacity="0.97" />
      <ellipse cx="25" cy="15" rx="3.5" ry="2.8" fill="white" opacity="0.97" />
      <circle cx="15" cy="15" r="2.2" fill={eyeColor} />
      <circle cx="25" cy="15" r="2.2" fill={eyeColor} />
      <circle cx="15" cy="15" r="1.35" fill="#1a1a2e" />
      <circle cx="25" cy="15" r="1.35" fill="#1a1a2e" />
      <circle cx="15.7" cy="14.2" r="0.72" fill="white" opacity="0.9" />
      <circle cx="25.7" cy="14.2" r="0.72" fill="white" opacity="0.9" />

      {/* Nariz (puntos sutiles) */}
      <circle cx="18.7" cy="18.8" r="0.7" fill={shadowColor} opacity="1.2" />
      <circle cx="21.3" cy="18.8" r="0.7" fill={shadowColor} opacity="1.2" />

      {/* Boca */}
      <path d={mouthCurve} stroke="#c2774d" strokeWidth="1.5" fill={isCelebrating ? 'rgba(255,150,100,0.2)' : 'none'} strokeLinecap="round" />

      {/* ── Accesorios ── */}
      {accessory === 'glasses' && (
        <g stroke="#4a4a4a" strokeWidth="0.9" fill="none" opacity="0.9">
          <circle cx="15" cy="15" r="4.5" />
          <circle cx="25" cy="15" r="4.5" />
          <line x1="19.5" y1="15" x2="20.5" y2="15" />
          <line x1="7" y1="15" x2="10.5" y2="15" />
          <line x1="29.5" y1="15" x2="33" y2="15" />
        </g>
      )}
      {accessory === 'headset' && (
        <g fill={color} stroke={color} strokeWidth="0.4">
          <path d="M7 14 Q20 2 33 14" fill="none" strokeWidth="2.2" />
          <ellipse cx="7"  cy="15" rx="3"   ry="3.5" />
          <ellipse cx="33" cy="15" rx="3"   ry="3.5" />
          <path d="M7 18 Q3 22 3 25"  fill="none" strokeWidth="1.6" />
          <circle cx="3" cy="25" r="1.8" />
        </g>
      )}
      {accessory === 'cap' && (
        <g fill={colorDark}>
          <path d="M7 14 Q8 3 20 3 Q32 3 33 14 Q31 7 20 6 Q9 7 7 14" />
          <path d="M7 14 Q3 15 2 19" fill="none" stroke={colorDark} strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="20" cy="3.5" r="1.8" fill={accent} />
        </g>
      )}
      {accessory === 'tie' && (
        <path d="M17.5 28 L14.5 44 L20 40 L25.5 44 L22.5 28 L20 30 Z" fill={colorDark} />
      )}
      {accessory === 'beret' && (
        <g>
          <ellipse cx="20" cy="7" rx="14" ry="9" fill={color} opacity="0.8" />
          <path d="M6 11 L34 11" stroke={hairColor} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="29" cy="3" r="2.5" fill={accent} />
        </g>
      )}
    </svg>
  );
}

// ── Card de agente con actividad lounge ──────────────────────────────────────
function AgenteCard({
  id, cfg, estado, selected, onClick,
}: { id: string; cfg: PersonajeCfg; estado: EstadoAnim; selected: boolean; onClick: () => void }) {
  const activo      = atDesk(estado);
  const enLounge    = !activo && estado !== 'caminando';
  const loungeAct   = enLounge ? getLoungeActivity(cfg.loungeSlot) : 'idle';

  return (
    <div className="relative cursor-pointer group select-none flex flex-col items-center" onClick={onClick} style={{ width: 62 }}>

      {/* Globo de diálogo */}
      {estado === 'hablando' && (
        <div className="absolute z-40 pointer-events-none" style={{ bottom: '100%', marginBottom: 4, left: '50%', transform: 'translateX(-50%)' }}>
          <div className="sims-burbuja text-[9px] px-2 py-1 rounded-xl font-semibold whitespace-nowrap"
            style={{ background: cfg.color, color: '#fff', boxShadow: `0 2px 8px ${cfg.color}66` }}>
            💬 · · ·
          </div>
          <div className="mx-auto" style={{ width:0, height:0, borderLeft:'5px solid transparent', borderRight:'5px solid transparent', borderTop:`5px solid ${cfg.color}` }} />
        </div>
      )}

      {/* Confeti al celebrar */}
      {estado === 'celebrando' && (
        <div className="absolute pointer-events-none sims-confeti text-base" style={{ bottom: '100%', left:'50%', transform:'translateX(-50%)', marginBottom:2 }}>
          🎉
        </div>
      )}

      {/* Indicador activo */}
      {activo && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border border-slate-900 animate-pulse z-30"
          style={{ background: cfg.color }} />
      )}

      {/* Actividades lounge */}
      {enLounge && loungeAct === 'sleeping' && (
        <div className="absolute pointer-events-none flex gap-0.5" style={{ bottom: '100%', left: '55%', marginBottom: 0 }}>
          <span className="sims-zzz text-[9px]">z</span>
          <span className="sims-zzz sims-zzz-2 text-[11px]">z</span>
          <span className="sims-zzz sims-zzz-3 text-[13px]">Z</span>
        </div>
      )}
      {enLounge && loungeAct === 'drinking' && (
        <div className="absolute pointer-events-none" style={{ right: -6, bottom: 10, fontSize: 14 }}>
          <span className="sims-bebiendo">🥤</span>
        </div>
      )}
      {enLounge && loungeAct === 'playing' && (
        <div className="absolute pointer-events-none" style={{ right: -8, bottom: 8, fontSize: 14 }}>
          <span className="sims-jugando">🏓</span>
        </div>
      )}
      {enLounge && loungeAct === 'chatting' && (
        <div className="absolute pointer-events-none" style={{ right: -6, bottom: 12, fontSize: 12 }}>
          <span className="sims-tomando-cafe">☕</span>
        </div>
      )}

      {/* Figura principal */}
      <div className={`sims-avatar-${estado}`}>
        <HumanFigure cfg={cfg} estado={estado} />
      </div>

      {/* Badge nombre */}
      <div className="mt-0.5 px-1.5 py-0.5 rounded-lg text-center" style={{
        background: activo ? `${cfg.color}30` : 'rgba(0,0,0,0.6)',
        border: selected ? `1px solid ${cfg.color}` : 'none',
        maxWidth: 62,
      }}>
        <p className="text-[8px] font-bold truncate" style={{ color: activo ? cfg.accent : '#94a3b8' }}>
          {cfg.nombre}
        </p>
      </div>

      {/* Tooltip hover */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 w-48 pointer-events-none">
        <div className="rounded-2xl p-3 shadow-2xl border" style={{ background:'#0f172a', borderColor:`${cfg.color}55` }}>
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-8 h-8 rounded-xl flex-none flex items-center justify-center" style={{ background:`${cfg.color}22`, border:`1px solid ${cfg.color}44` }}>
              <span style={{ fontSize: 16 }}>{cfg.roleEmoji}</span>
            </div>
            <div>
              <p className="text-[11px] font-bold text-white">{cfg.nombre}</p>
              <p className="text-[9px] text-slate-400">{cfg.titulo}</p>
            </div>
          </div>
          <p className="text-[9px] text-slate-500 italic mb-1.5">{cfg.personalidad}</p>
          <span className="inline-block text-[9px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background:`${cfg.color}25`, color:cfg.accent }}>
            {estado === 'idle' ? '✦ Disponible' : estado === 'caminando' ? '🚶 En camino' : estado === 'trabajando' ? '⚡ Trabajando' : estado === 'hablando' ? '💬 Comunicando' : '🎉 ¡Completado!'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Decoraciones del Lounge ───────────────────────────────────────────────────
function LoungeDecorations() {
  return (
    <>
      {/* Label zona */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-center" style={{ height:30, borderBottom:'1px solid rgba(251,191,36,0.08)', zIndex:1 }}>
        <p style={{ color:'rgba(251,191,36,0.3)', fontSize:7, fontWeight:700, letterSpacing:4, textTransform:'uppercase' }}>
          🏠 Lounge
        </p>
      </div>

      {/* ── Alfombra central ── */}
      <div className="absolute" style={{ left:'8%', bottom:55, width:'84%', height:80, borderRadius:18,
        background:'radial-gradient(ellipse at center, rgba(120,53,15,0.22) 0%, rgba(80,30,5,0.1) 100%)',
        border:'1px solid rgba(180,100,30,0.14)' }} />

      {/* ── Sofá grande con respaldo y brazos ── */}
      <div className="absolute" style={{ left:'4%', bottom:60 }}>
        {/* Respaldo */}
        <div style={{ width:82, height:22, background:'linear-gradient(160deg,rgba(146,64,14,0.82),rgba(92,40,10,0.9))',
          border:'1px solid rgba(200,90,20,0.4)', borderRadius:'8px 8px 0 0',
          boxShadow:'0 -2px 8px rgba(0,0,0,0.4)', position:'relative' }}>
          {/* Detalle costura */}
          <div style={{ position:'absolute', top:5, left:8, right:8, height:1, borderRadius:1, background:'rgba(220,130,40,0.2)' }} />
          <div style={{ position:'absolute', top:12, left:8, right:8, height:1, borderRadius:1, background:'rgba(220,130,40,0.2)' }} />
        </div>
        {/* Asiento */}
        <div style={{ width:82, height:16, background:'linear-gradient(180deg,rgba(160,75,20,0.78),rgba(110,50,10,0.88))',
          border:'1px solid rgba(200,90,20,0.35)', position:'relative', zIndex:2 }}>
          {/* Cojines */}
          <div className="flex gap-1 px-1.5 pt-1">
            {[0,1,2].map(i => (
              <div key={i} style={{ flex:1, height:10, background:'rgba(180,100,30,0.5)',
                border:'1px solid rgba(230,130,40,0.25)', borderRadius:'3px 3px 0 0' }} />
            ))}
          </div>
        </div>
        {/* Brazos */}
        <div style={{ position:'absolute', left:-7, top:5, width:9, height:28, background:'rgba(120,55,12,0.85)',
          border:'1px solid rgba(180,90,20,0.4)', borderRadius:'5px 0 0 5px' }} />
        <div style={{ position:'absolute', right:-7, top:5, width:9, height:28, background:'rgba(120,55,12,0.85)',
          border:'1px solid rgba(180,90,20,0.4)', borderRadius:'0 5px 5px 0' }} />
        {/* Patas */}
        <div className="flex justify-between px-2">
          {[0,1].map(i => (
            <div key={i} style={{ width:4, height:7, background:'rgba(60,25,5,0.9)', borderRadius:'0 0 2px 2px' }} />
          ))}
        </div>
        {/* Mesa de café */}
        <div style={{ width:70, height:8, background:'linear-gradient(135deg,rgba(92,40,10,0.65),rgba(70,30,5,0.7))',
          border:'1px solid rgba(140,60,15,0.35)', borderRadius:3, marginTop:10, marginLeft:6,
          boxShadow:'0 3px 0 rgba(0,0,0,0.35)', position:'relative' }}>
          {/* Objetos sobre la mesa */}
          <span style={{ position:'absolute', top:-7, left:5, fontSize:9 }}>☕</span>
          <span style={{ position:'absolute', top:-7, left:24, fontSize:9 }}>📱</span>
        </div>
        <div style={{ width:55, height:3, margin:'0 auto', background:'rgba(50,22,3,0.65)' }} />
        <div className="flex justify-between" style={{ padding:'0 14px' }}>
          {[0,1].map(i => <div key={i} style={{ width:3, height:6, background:'rgba(40,18,2,0.8)' }} />)}
        </div>
      </div>

      {/* ── Mesa de futbolito grande ── */}
      <div className="absolute" style={{ left:'35%', top:'18%' }}>
        {/* Bordes/estructura */}
        <div style={{ width:108, height:8, background:'linear-gradient(90deg,rgba(120,53,15,0.9),rgba(92,40,10,0.85))',
          borderRadius:'4px 4px 0 0', border:'1px solid rgba(180,90,20,0.5)' }} />
        {/* Superficie verde */}
        <div style={{ width:108, height:68, background:'linear-gradient(160deg,#166534,#15803d)',
          border:'2px solid rgba(74,222,128,0.22)', position:'relative',
          boxShadow:'inset 0 0 16px rgba(0,0,0,0.3), 0 4px 0 rgba(0,0,0,0.45)' }}>
          {/* Líneas campo */}
          <div style={{ position:'absolute', left:'50%', top:4, bottom:4, width:1, background:'rgba(74,222,128,0.35)' }} />
          <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:20, height:20, border:'1px solid rgba(74,222,128,0.3)', borderRadius:'50%' }} />
          {/* Porterías */}
          <div style={{ position:'absolute', left:2, top:'25%', width:5, height:'50%', background:'rgba(253,224,71,0.4)', borderRadius:1 }} />
          <div style={{ position:'absolute', right:2, top:'25%', width:5, height:'50%', background:'rgba(253,224,71,0.4)', borderRadius:1 }} />
          {/* Barras */}
          {[16,32,54,72,90].map((x,i) => (
            <div key={i} style={{ position:'absolute', left:x, top:-8, bottom:-8, width:2.5, background:'rgba(200,200,200,0.5)', borderRadius:1 }}>
              {[14,36,58].slice(0, i%2===0 ? 3 : 2).map((y,j) => (
                <div key={j} style={{ position:'absolute', top:y, left:-4, width:10, height:10, borderRadius:'50%',
                  background: i<3 ? 'rgba(59,130,246,0.85)' : 'rgba(239,68,68,0.85)',
                  border:'1px solid rgba(255,255,255,0.3)', boxShadow:'0 1px 3px rgba(0,0,0,0.4)' }} />
              ))}
            </div>
          ))}
          {/* Pelota */}
          <div style={{ position:'absolute', left:'47%', top:'44%', width:7, height:7, borderRadius:'50%', background:'white', boxShadow:'0 0 4px rgba(0,0,0,0.5)' }} />
        </div>
        {/* Base */}
        <div style={{ width:108, height:10, background:'linear-gradient(90deg,rgba(100,45,10,0.88),rgba(80,35,8,0.9))',
          borderRadius:'0 0 4px 4px', border:'1px solid rgba(160,80,15,0.4)', boxShadow:'0 3px 6px rgba(0,0,0,0.35)' }} />
        {/* Patas */}
        <div className="flex justify-between px-3">
          {[0,1].map(i => <div key={i} style={{ width:6, height:16, background:'rgba(70,30,5,0.9)', borderRadius:'0 0 3px 3px', boxShadow:'2px 0 4px rgba(0,0,0,0.3)' }} />)}
        </div>
      </div>

      {/* ── Vending Machine grande ── */}
      <div className="absolute" style={{ right:8, top:'8%' }}>
        <div style={{ width:46, height:84, background:'linear-gradient(180deg,#1e293b,#0f172a)',
          border:'2px solid rgba(99,102,241,0.45)', borderRadius:7, position:'relative',
          boxShadow:'4px 4px 0 rgba(0,0,0,0.5), 0 8px 20px rgba(0,0,0,0.4)' }}>
          {/* Luz superior */}
          <div style={{ height:6, margin:'4px 4px 0', background:'linear-gradient(90deg,rgba(99,102,241,0.5),rgba(139,92,246,0.6))',
            borderRadius:'4px 4px 2px 2px', boxShadow:'0 0 8px rgba(99,102,241,0.4)' }} />
          {/* Pantalla/display */}
          <div style={{ margin:'4px 4px 0', height:26, background:'linear-gradient(135deg,#1e3a5f,#0d2137)',
            border:'1px solid rgba(59,130,246,0.5)', borderRadius:4,
            display:'flex', flexWrap:'wrap', gap:3, padding:3, justifyContent:'center', alignItems:'center' }}>
            {['☕','🥤','🍵','🧃'].map((e,i) => (
              <span key={i} style={{ fontSize:8 }}>{e}</span>
            ))}
          </div>
          {/* Botones */}
          <div style={{ margin:'5px 7px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:3.5 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ height:7, background: i===0||i===3 ? 'rgba(99,102,241,0.65)' : 'rgba(51,65,85,0.7)',
                borderRadius:2, border:'1px solid rgba(255,255,255,0.1)' }} />
            ))}
          </div>
          {/* Ranura monedas */}
          <div style={{ margin:'6px auto 0', width:18, height:2.5, background:'rgba(0,0,0,0.7)',
            borderRadius:1, border:'1px solid rgba(148,163,184,0.3)' }} />
          {/* Indicador LED */}
          <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', width:6, height:6,
            borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 8px #22c55e99' }} />
          {/* Ranura producto */}
          <div style={{ position:'absolute', bottom:4, left:5, right:5, height:12, background:'rgba(0,0,0,0.55)',
            borderRadius:'0 0 5px 5px', border:'1px solid rgba(148,163,184,0.18)' }} />
        </div>
      </div>

      {/* ── Planta grande ── */}
      <div className="absolute" style={{ right:58, bottom:14 }}>
        <div style={{ position:'relative' }}>
          <div style={{ width:14, height:20, background:'rgba(34,197,94,0.5)', borderRadius:'50% 50% 20% 20%', marginBottom:1 }} />
          <div style={{ width:10, height:8, background:'rgba(21,128,61,0.4)', borderRadius:'50% 50% 20% 20%', position:'absolute', top:-5, left:8, transform:'rotate(30deg)' }} />
          <div style={{ width:10, height:8, background:'rgba(21,128,61,0.4)', borderRadius:'50% 50% 20% 20%', position:'absolute', top:-4, left:-4, transform:'rotate(-25deg)' }} />
          <div style={{ width:12, height:10, background:'rgba(120,53,15,0.7)', borderRadius:'2px 2px 4px 4px', margin:'0 auto' }} />
        </div>
      </div>

      {/* ── Lámpara de pie ── */}
      <div className="absolute" style={{ left:'5%', top:'14%' }}>
        <div style={{ width:22, height:14, background:'linear-gradient(180deg,rgba(251,191,36,0.18),rgba(251,191,36,0.06))',
          borderRadius:'50% 50% 30% 30%', border:'1px solid rgba(251,191,36,0.25)',
          boxShadow:'0 0 16px rgba(251,191,36,0.12)', marginBottom:0 }} />
        <div style={{ width:2, height:34, background:'rgba(148,163,184,0.4)', margin:'0 auto' }} />
        <div style={{ width:18, height:3, background:'rgba(100,116,139,0.5)', borderRadius:2, margin:'0 auto' }} />
        {/* Halo de luz en el suelo */}
        <div style={{ position:'absolute', bottom:-4, left:'50%', transform:'translateX(-50%)', width:32, height:6,
          background:'radial-gradient(ellipse at center, rgba(251,191,36,0.1) 0%, transparent 70%)', borderRadius:'50%' }} />
      </div>
    </>
  );
}

// ── Pasos del plan de ejecución ───────────────────────────────────────────────
function parsePlanSteps(plan: string): string[] {
  if (!plan) return [];
  // Eliminar secciones de encabezado tipo "=== ALGO ==="
  const sinEncabezados = plan.replace(/^===.*===\s*$/gm, '');
  return sinEncabezados
    .split('\n')
    .map(l => l.trim())
    // Aceptar: "1." "1)" "1-" "- " "* " "• " "**1.**" "Paso 1" "Step 1"
    .filter(l =>
      /^\d+[\.\)\-]\s+\S/.test(l)        ||
      /^\*\*\d+[\.\)]\*?\*?\s+\S/.test(l) ||
      /^[-*•]\s+\S/.test(l)               ||
      /^Paso\s+\d+/i.test(l)              ||
      /^Step\s+\d+/i.test(l)
    )
    .map(l => l
      .replace(/^\d+[\.\)\-]\s*/, '')
      .replace(/^\*\*\d+[\.\)]\*?\*?\s*/, '')
      .replace(/^[-*•]\s*/, '')
      .replace(/^Paso\s+\d+[\.\:\-]?\s*/i, '')
      .replace(/^Step\s+\d+[\.\:\-]?\s*/i, '')
      .replace(/\*\*/g, '')
      .trim()
    )
    .filter(l => l.length > 4);
}

// ── Interfaz papel volador ────────────────────────────────────────────────────
interface Papel { id: string; de: string; para: string; ts: number }

// ── Componente principal ──────────────────────────────────────────────────────
export default function SimsCanvas({ avatoresIniciales, bitacoraInicial, tareasIniciales }: Props) {
  const supabase = createClient();

  const [estados, setEstados]        = useState<Record<string, EstadoAnim>>({});
  const targetRef                    = useRef<Record<string, EstadoAnim>>({});
  const [bitacora, setBitacora]      = useState<Entrada[]>(bitacoraInicial);
  const [tareas, setTareas]          = useState<Tarea[]>(tareasIniciales);
  const [selId, setSelId]            = useState<string | null>(null);
  const [papeles, setPapeles]        = useState<Papel[]>([]);
  const [avatarPending, startAvatar] = useTransition();
  const [dragId, setDragId]          = useState<string | null>(null);
  const dragIdRef                    = useRef<string | null>(null);
  const [dragOver, setDragOver]      = useState<'lounge' | 'sala' | 'pasillo' | null>(null);
  const dragEnterCount               = useRef<Record<string, number>>({});
  const [expandedTareaId, setExpandedTareaId] = useState<string | null>(null);

  useEffect(() => {
    const map: Record<string, EstadoAnim> = {};
    avatoresIniciales.forEach(av => {
      if (av.agente_nombre) {
        map[av.agente_nombre] = av.estado_animacion;
        targetRef.current[av.agente_nombre] = av.estado_animacion;
      }
    });
    setEstados(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canal = supabase.channel('sims-v5')
      .on('postgres_changes', { event: '*', schema:'public', table:'avatares' }, payload => {
        if (payload.eventType !== 'UPDATE' && payload.eventType !== 'INSERT') return;
        const av = payload.new as Avatar;
        if (!av.agente_nombre) return;
        const prev = targetRef.current[av.agente_nombre];
        targetRef.current[av.agente_nombre] = av.estado_animacion;
        setEstados(p => ({ ...p, [av.agente_nombre!]: 'caminando' }));
        setTimeout(() => setEstados(p => ({ ...p, [av.agente_nombre!]: av.estado_animacion })), 1200);
        if (prev && !atDesk(prev) && av.estado_animacion === 'trabajando') {
          const papel: Papel = { id: crypto.randomUUID(), de:'pm-global', para: av.agente_nombre!, ts: Date.now() };
          setPapeles(p => [...p, papel]);
          setTimeout(() => setPapeles(p => p.filter(x => x.id !== papel.id)), 2400);
        }
      })
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'bitacora_actividad' }, payload => {
        setBitacora(p => [payload.new as Entrada, ...p].slice(0, 30));
      })
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'tareas' }, payload => {
        setTareas(p => [payload.new as Tarea, ...p].slice(0, 50));
      })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'tareas' }, payload => {
        const updated = payload.new as Tarea;
        setTareas(p => p.map(t => t.id === updated.id ? updated : t));
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getEstado(id: string): EstadoAnim { return estados[id] ?? 'idle'; }

  const selCfg    = selId ? PERSONAJES[selId] : null;
  const selTareas = tareas.filter(t => t.agente_asignado === selId);

  const agentesIds = Object.keys(PERSONAJES);
  const enLounge   = agentesIds.filter(id => !atDesk(getEstado(id)) && getEstado(id) !== 'caminando');
  const enPasillo  = agentesIds.filter(id => getEstado(id) === 'caminando');
  const enSala     = agentesIds.filter(id => atDesk(getEstado(id)));

  return (
    <div className="space-y-4">

      {/* ── Escena principal ── */}
      <div className="rounded-3xl overflow-hidden" style={{
        background:'#07091a',
        border:'1px solid rgba(99,102,241,0.18)',
        boxShadow:'0 0 60px rgba(99,102,241,0.06)',
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom:'1px solid rgba(99,102,241,0.1)', background:'rgba(10,15,30,0.95)' }}>
          <div className="flex items-center gap-3">
            <span className="text-lg">🏢</span>
            <div>
              <p className="text-sm font-bold text-white">Servicios Agénticos</p>
              <p className="text-[10px] text-slate-500">
                {enSala.length} trabajando · {enPasillo.length} en tránsito · {enLounge.length} en lounge
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            En vivo
          </div>
        </div>

        {/* Tres zonas */}
        <div className="flex" style={{ height:500 }}>

          {/* ═══ ZONA 1: LOUNGE ═══ */}
          <div
            className="relative flex-shrink-0 transition-all"
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDragEnter={e => {
              e.preventDefault();
              dragEnterCount.current['lounge'] = (dragEnterCount.current['lounge'] ?? 0) + 1;
              setDragOver('lounge');
            }}
            onDragLeave={() => {
              dragEnterCount.current['lounge'] = (dragEnterCount.current['lounge'] ?? 1) - 1;
              if ((dragEnterCount.current['lounge'] ?? 0) <= 0) { dragEnterCount.current['lounge'] = 0; setDragOver(null); }
            }}
            onDrop={e => {
              e.preventDefault();
              dragEnterCount.current['lounge'] = 0;
              setDragOver(null);
              const id = dragIdRef.current || e.dataTransfer.getData('text/plain');
              if (!id) return;
              startAvatar(async () => { await moverAvatarADescanso(id); });
            }}
            style={{
              width:'23%',
              background: dragOver === 'lounge'
                ? 'linear-gradient(160deg, #2d1000 0%, #1a0c00 55%, #0a0a1a 100%)'
                : 'linear-gradient(160deg, #170800 0%, #0f0700 55%, #0a0a1a 100%)',
              borderRight:`1px solid ${dragOver === 'lounge' ? 'rgba(251,191,36,0.4)' : 'rgba(251,191,36,0.1)'}`,
              outline: dragOver === 'lounge' ? '2px dashed rgba(251,191,36,0.3)' : 'none',
            }}>
            <div className="absolute inset-0 pointer-events-none" style={{
              background:'radial-gradient(ellipse at 50% 115%, rgba(251,191,36,0.06) 0%, transparent 65%)',
            }} />
            {dragOver === 'lounge' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                <span style={{ fontSize:28, opacity:0.6 }}>🛋️</span>
              </div>
            )}
            <LoungeDecorations />
            {enLounge.map(id => {
              const cfg = PERSONAJES[id];
              if (!cfg) return null;
              const pos = LOUNGE_POS[cfg.loungeSlot] ?? { x:50, y:50 };
              return (
                <div key={id} className="absolute transition-all duration-1200"
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; dragIdRef.current = id; setDragId(id); }}
                  onDragEnd={() => { dragIdRef.current = null; setDragId(null); }}
                  style={{ left:`${pos.x}%`, top:`${pos.y + 5}%`, transform:'translate(-50%, -100%)', zIndex:10, opacity: dragId === id ? 0.5 : 1, cursor:'grab' }}>
                  <AgenteCard id={id} cfg={cfg} estado={getEstado(id)} selected={selId===id} onClick={() => setSelId(selId===id ? null : id)} />
                </div>
              );
            })}
          </div>

          {/* ═══ ZONA 2: PASILLO ═══ */}
          <div
            className="relative flex-shrink-0 flex flex-col items-center transition-all"
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDragEnter={e => {
              e.preventDefault();
              dragEnterCount.current['pasillo'] = (dragEnterCount.current['pasillo'] ?? 0) + 1;
              setDragOver('pasillo');
            }}
            onDragLeave={() => {
              dragEnterCount.current['pasillo'] = (dragEnterCount.current['pasillo'] ?? 1) - 1;
              if ((dragEnterCount.current['pasillo'] ?? 0) <= 0) { dragEnterCount.current['pasillo'] = 0; setDragOver(null); }
            }}
            onDrop={e => {
              e.preventDefault();
              dragEnterCount.current['pasillo'] = 0;
              setDragOver(null);
              const id = dragIdRef.current || e.dataTransfer.getData('text/plain');
              if (!id) return;
              if (!atDesk(getEstado(id)) && getEstado(id) !== 'caminando') {
                startAvatar(async () => { await reanudarTrabajo(id); });
              } else if (atDesk(getEstado(id))) {
                startAvatar(async () => { await moverAvatarADescanso(id); });
              }
            }}
            style={{
              width:'6%',
              background:'linear-gradient(180deg, #080c14 0%, #0b1022 100%)',
              borderRight:`1px solid ${dragOver === 'pasillo' ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.1)'}`,
            }}>
            <p className="text-[7px] font-bold uppercase tracking-widest mt-14 rotate-90 whitespace-nowrap"
              style={{ color:'rgba(99,102,241,0.22)' }}>Pasillo</p>
            <div className="absolute top-16 bottom-4 w-px" style={{
              left:'50%',
              background:'repeating-linear-gradient(to bottom, rgba(99,102,241,0.16) 0, rgba(99,102,241,0.16) 5px, transparent 5px, transparent 10px)',
            }} />
            {[30,50,70].map(y => (
              <div key={y} className="absolute text-sm" style={{ top:`${y}%`, left:'50%', transform:'translate(-50%,-50%)', color:'rgba(99,102,241,0.18)' }}>›</div>
            ))}
            {enPasillo.map((id, i) => {
              const cfg = PERSONAJES[id];
              if (!cfg) return null;
              return (
                <div key={id} className="absolute transition-all duration-1000" style={{
                  left:'50%', top:`${18 + i * 20}%`, transform:'translate(-50%, -100%)', zIndex:10,
                }}>
                  <AgenteCard id={id} cfg={cfg} estado="caminando" selected={selId===id} onClick={() => setSelId(selId===id ? null : id)} />
                </div>
              );
            })}
          </div>

          {/* ═══ ZONA 3: SALA DE TRABAJO ═══ */}
          <div
            className="relative flex-1 transition-all"
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDragEnter={e => {
              e.preventDefault();
              dragEnterCount.current['sala'] = (dragEnterCount.current['sala'] ?? 0) + 1;
              setDragOver('sala');
            }}
            onDragLeave={() => {
              dragEnterCount.current['sala'] = (dragEnterCount.current['sala'] ?? 1) - 1;
              if ((dragEnterCount.current['sala'] ?? 0) <= 0) { dragEnterCount.current['sala'] = 0; setDragOver(null); }
            }}
            onDrop={e => {
              e.preventDefault();
              dragEnterCount.current['sala'] = 0;
              setDragOver(null);
              const id = dragIdRef.current || e.dataTransfer.getData('text/plain');
              if (!id || atDesk(getEstado(id))) return;
              startAvatar(async () => { await reanudarTrabajo(id); });
            }}
            style={{
              background: dragOver === 'sala'
                ? 'linear-gradient(145deg, #071428 0%, #0a1030 50%, #071428 100%)'
                : 'linear-gradient(145deg, #050d1e 0%, #07091a 50%, #050d1e 100%)',
              outline: dragOver === 'sala' ? '2px dashed rgba(99,102,241,0.35)' : 'none',
            }}>
            <div className="absolute inset-0 pointer-events-none" style={{
              background:'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.04) 0%, transparent 55%)',
            }} />
            {/* Cuadrícula de suelo */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage:'linear-gradient(rgba(59,130,246,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.03) 1px,transparent 1px)',
              backgroundSize:'60px 60px',
            }} />

            {/* Label */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-center" style={{ height:30, borderBottom:'1px solid rgba(59,130,246,0.07)' }}>
              <p style={{ color:'rgba(59,130,246,0.28)', fontSize:7, fontWeight:700, letterSpacing:4, textTransform:'uppercase' }}>
                💼 Sala de Trabajo
              </p>
            </div>

            {/* Escritorios isométricos */}
            {Object.entries(PERSONAJES).map(([id, cfg]) => {
              const deskIdx = cfg.deskRow * 4 + cfg.deskCol;
              const pos     = DESK_POS[deskIdx] ?? { x:50, y:50 };
              const activo  = atDesk(getEstado(id));
              return (
                <div key={`desk-${id}`}
                  onClick={() => setSelId(selId===id ? null : id)}
                  className="absolute cursor-pointer transition-all duration-500"
                  style={{
                    left:`${pos.x}%`, top:`${pos.y + 8}%`,
                    transform:'translate(-50%, -50%)',
                    zIndex:8,
                  }}>
                  {/* Escritorio: superficie + frente (efecto 3D) */}
                  <div style={{
                    width:72, height:38,
                    background: activo ? `${cfg.color}18` : 'rgba(14,22,40,0.92)',
                    border:`1px solid ${activo ? `${cfg.color}60` : 'rgba(51,65,85,0.45)'}`,
                    borderRadius:'5px 5px 3px 3px',
                    boxShadow: activo
                      ? `0 0 20px ${cfg.color}30, 0 5px 0 0 rgba(0,0,0,0.45), 0 7px 8px rgba(0,0,0,0.3)`
                      : '0 4px 0 0 rgba(0,0,0,0.4), 0 6px 6px rgba(0,0,0,0.22)',
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                  }}>
                    {/* Monitor */}
                    <div style={{
                      width:42, height:26,
                      background: activo ? `${cfg.color}28` : 'rgba(8,14,32,0.98)',
                      border:`1px solid ${activo ? `${cfg.color}60` : 'rgba(30,41,59,0.9)'}`,
                      borderRadius:3,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      boxShadow: activo ? `inset 0 0 12px ${cfg.color}18` : 'none',
                    }}>
                      {activo ? (
                        <span style={{ fontSize:13 }}>💻</span>
                      ) : (
                        <div style={{ width:14, height:10, background:'rgba(30,41,59,0.8)', borderRadius:1 }} />
                      )}
                    </div>
                    {/* Teclado */}
                    <div style={{ width:38, height:5, background: activo ? `${cfg.color}15` : 'rgba(20,30,55,0.8)', border:`1px solid ${activo ? `${cfg.color}30` : 'rgba(30,41,59,0.6)'}`, borderRadius:2 }} />
                  </div>
                  {/* Frente del escritorio */}
                  <div style={{
                    width:72, height:8,
                    background: activo ? `${cfg.color}10` : 'rgba(8,12,28,0.85)',
                    borderRadius:'0 0 4px 4px',
                    borderLeft:`1px solid ${activo ? `${cfg.color}30` : 'rgba(30,41,59,0.5)'}`,
                    borderRight:`1px solid ${activo ? `${cfg.color}30` : 'rgba(30,41,59,0.5)'}`,
                    borderBottom:`1px solid ${activo ? `${cfg.color}30` : 'rgba(30,41,59,0.5)'}`,
                    borderTop:'none',
                  }} />
                  {/* Label */}
                  <p style={{ textAlign:'center', fontSize:6, fontWeight:600, marginTop:2, color: activo ? cfg.color : '#334155' }}>
                    {cfg.nombre}
                  </p>
                  {activo && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background:cfg.color }} />}
                </div>
              );
            })}

            {/* Mesa de reuniones */}
            {enSala.filter(id => getEstado(id) === 'hablando').length >= 2 && (
              <div className="absolute" style={{
                left:'50%', top:'50%', transform:'translate(-50%,-50%)',
                width:84, height:46, borderRadius:23,
                background:'rgba(99,102,241,0.06)',
                border:'1px solid rgba(99,102,241,0.18)', zIndex:5,
              }}>
                <p style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:8, color:'rgba(99,102,241,0.35)' }}>mesa</p>
              </div>
            )}

            {dragOver === 'sala' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                <span style={{ fontSize:28, opacity:0.5 }}>💼</span>
              </div>
            )}

            {/* Avatares en sala */}
            {enSala.map(id => {
              const cfg    = PERSONAJES[id];
              if (!cfg) return null;
              const deskIdx = cfg.deskRow * 4 + cfg.deskCol;
              const pos     = DESK_POS[deskIdx] ?? { x:50, y:50 };
              return (
                <div key={`av-${id}`} className="absolute transition-all duration-1000"
                  draggable
                  onDragStart={e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; dragIdRef.current = id; setDragId(id); }}
                  onDragEnd={() => { dragIdRef.current = null; setDragId(null); }}
                  style={{ left:`${pos.x}%`, top:`${pos.y + 3}%`, transform:'translate(-50%, -100%)', zIndex:20, opacity: dragId === id ? 0.45 : 1, cursor:'grab' }}>
                  <AgenteCard id={id} cfg={cfg} estado={getEstado(id)} selected={selId===id} onClick={() => setSelId(selId===id ? null : id)} />
                </div>
              );
            })}

            {/* Papeles voladores */}
            {papeles.map(p => {
              const cfgPara = PERSONAJES[p.para];
              if (!cfgPara) return null;
              const desIdx = cfgPara.deskRow * 4 + cfgPara.deskCol;
              const dest   = DESK_POS[desIdx] ?? { x:50, y:50 };
              return (
                <div key={p.id} className="absolute pointer-events-none sims-papel-vuela z-30 text-xl"
                  style={{ left:`${dest.x}%`, top:`${dest.y + 8}%` }}>
                  📄
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Panel agente seleccionado ── */}
      {selCfg && (
        <div className="rounded-2xl overflow-hidden border" style={{ background:'#0f172a', borderColor:`${selCfg.color}33` }}>
          {/* Cabecera */}
          <div className="px-6 py-4 flex items-center gap-4" style={{ borderBottom:`1px solid ${selCfg.color}1a` }}>
            <div className="w-16 h-20 rounded-2xl flex items-end justify-center overflow-visible" style={{ background:`${selCfg.color}14`, border:`1px solid ${selCfg.color}30` }}>
              <HumanFigure cfg={selCfg} estado={getEstado(selId!)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span style={{ fontSize:18 }}>{selCfg.roleEmoji}</span>
                <p className="text-base font-bold text-white">{selCfg.nombre}</p>
              </div>
              <p className="text-xs text-slate-400">{selCfg.titulo}</p>
              <p className="text-[10px] text-slate-500 italic mt-0.5">{selCfg.personalidad}</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background:`${selCfg.color}20`, color:selCfg.accent }}>
                {getEstado(selId!) === 'idle' ? '✦ Disponible' : getEstado(selId!) === 'trabajando' ? '⚡ Trabajando' : getEstado(selId!) === 'celebrando' ? '🎉 Completado' : getEstado(selId!) === 'hablando' ? '💬 Comunicando' : '🚶 En camino'}
              </span>
              <button onClick={() => setSelId(null)} className="text-slate-500 hover:text-white text-xl">✕</button>
            </div>
          </div>

          {/* Botones de control del avatar */}
          <div className="px-6 pt-4 pb-1 flex gap-2">
            {atDesk(getEstado(selId!)) && (
              <button
                disabled={avatarPending}
                onClick={() => startAvatar(async () => { await moverAvatarADescanso(selId!); })}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity"
                style={{ background:'rgba(251,191,36,0.12)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.3)', opacity: avatarPending ? 0.5 : 1 }}>
                {avatarPending ? '...' : '🛋️ Enviar a descanso'}
              </button>
            )}
            {!atDesk(getEstado(selId!)) && getEstado(selId!) !== 'caminando' && selTareas.some(t => t.estado === 'pendiente' || t.estado === 'en_progreso') && (
              <button
                disabled={avatarPending}
                onClick={() => startAvatar(async () => { await reanudarTrabajo(selId!); })}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity"
                style={{ background:`${selCfg.color}18`, color:selCfg.accent, border:`1px solid ${selCfg.color}40`, opacity: avatarPending ? 0.5 : 1 }}>
                {avatarPending ? '...' : selTareas.some(t => t.estado === 'en_progreso') ? '⏯️ Retomar trabajo' : '🚀 Reanudar trabajo'}
              </button>
            )}
          </div>

          {/* Tareas con plan checklist */}
          <div className="px-6 py-4">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color:`${selCfg.color}80` }}>
              Tareas asignadas
            </p>
            {selTareas.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Sin tareas registradas todavía.</p>
            ) : (
              <div className="space-y-2">
                {selTareas.slice(0, 8).map(t => {
                  const steps      = t.plan_ejecucion ? parsePlanSteps(t.plan_ejecucion) : [];
                  const logCount   = bitacora.filter(b => b.tarea_id === t.id).length;
                  const total      = steps.length || logCount;
                  const finalizando = t.estado === 'en_progreso' && total > 0 && logCount >= total;
                  const doneCount  = t.estado === 'completada' ? total
                                   : Math.min(logCount, finalizando ? total - 1 : total);
                  const remaining  = total - doneCount;
                  const isExpanded = expandedTareaId === t.id;
                  return (
                    <div key={t.id}
                      onClick={() => setExpandedTareaId(isExpanded ? null : t.id)}
                      className="rounded-xl cursor-pointer transition-all"
                      style={{
                        background: isExpanded ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                        border: isExpanded ? `1px solid ${selCfg.color}30` : '1px solid rgba(255,255,255,0.05)',
                      }}>
                      {/* Fila resumen */}
                      <div className="flex items-start gap-3 p-3">
                        <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 flex-none" style={{
                          background: t.estado === 'completada' ? '#22c55e' : t.estado === 'en_progreso' ? selCfg.color : '#475569',
                        }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 leading-snug">{t.descripcion}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] capitalize font-medium" style={{
                              color: t.estado === 'completada' ? '#22c55e' : t.estado === 'en_progreso' ? selCfg.color : '#64748b',
                            }}>{t.estado.replace('_',' ')}</p>
                            {total > 0 && (
                              <span className="text-[9px]">
                                <span style={{ color:'#22c55e' }}>✓ {doneCount}</span>
                                {finalizando
                                  ? <span style={{ color:'#60a5fa' }}> · ⏳ verificando último paso</span>
                                  : <>
                                      <span className="text-slate-600"> · ⬜ {remaining}</span>
                                      <span className="text-slate-700"> · {total} {steps.length > 0 ? 'pasos' : 'acciones'}</span>
                                    </>
                                }
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-slate-600 text-xs mt-0.5 shrink-0">{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      {/* Checklist expandida */}
                      {isExpanded && (
                        <div className="px-3 pb-3">
                          {t.notas && (
                            <p className="text-[10px] text-slate-400 mb-2 leading-snug italic border-l-2 pl-2" style={{ borderColor:`${selCfg.color}40` }}>
                              {t.notas}
                            </p>
                          )}
                          {steps.length > 0 && (
                            <div className="space-y-1">
                              {steps.map((step, i) => {
                                const isCompleted = t.estado === 'completada';
                                const isActive    = t.estado === 'en_progreso';
                                const stepDone    = isCompleted || (doneCount > 0 && i < doneCount);
                                const stepActive  = (isActive && i === Math.min(doneCount, steps.length - 1)) || (finalizando && i === steps.length - 1);
                                return (
                                  <div key={i} className="flex items-start gap-1.5">
                                    <span className="mt-0.5 shrink-0" style={{ fontSize:10 }}>
                                      {stepDone ? '✅' : stepActive ? '🔵' : '⚪'}
                                    </span>
                                    <p className="text-[10px] leading-snug" style={{
                                      color: stepDone ? '#86efac' : stepActive ? selCfg.accent : '#475569',
                                      textDecoration: stepDone ? 'line-through' : 'none',
                                    }}>{step}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {steps.length === 0 && bitacora.filter(b => b.tarea_id === t.id).length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color:`${selCfg.color}60` }}>
                                Acciones registradas
                              </p>
                              {bitacora.filter(b => b.tarea_id === t.id).slice(0, 10).map((b, i) => (
                                <div key={i} className="flex items-start gap-1.5">
                                  <span className="mt-0.5 shrink-0 text-[10px]">✅</span>
                                  <p className="text-[10px] leading-snug text-slate-400">{b.accion.slice(0, 120)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                          {steps.length === 0 && logCount === 0 && !t.notas && (
                            <p className="text-[10px] text-slate-600 italic">Sin detalles adicionales.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Feed de actividad ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background:'#0f172a', border:'1px solid rgba(99,102,241,0.12)' }}>
        <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom:'1px solid rgba(99,102,241,0.08)' }}>
          <span className="text-sm font-semibold text-white">Actividad reciente</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            En vivo
          </span>
        </div>
        <div className="divide-y max-h-56 overflow-y-auto" style={{ borderColor:'rgba(255,255,255,0.03)' }}>
          {bitacora.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">Sin actividad registrada aún</div>
          ) : bitacora.map(b => {
            const cfg = PERSONAJES[b.agente];
            return (
              <div key={b.id} className="px-4 py-3 flex items-start gap-3">
                {/* Badge: emoji del rol en círculo de color — sin clipping */}
                <div className="w-9 h-9 rounded-xl flex-none flex items-center justify-center shrink-0"
                  style={{ background: cfg ? `${cfg.color}18` : 'rgba(255,255,255,0.05)', border:`1px solid ${cfg ? `${cfg.color}33` : 'transparent'}` }}>
                  <span style={{ fontSize: 16 }}>{cfg ? cfg.roleEmoji : '🤖'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold" style={{ color: cfg?.color ?? '#94a3b8' }}>{b.agente}</p>
                  <p className="text-xs text-slate-400 leading-snug mt-0.5">{b.accion}</p>
                </div>
                <span className="text-[10px] text-slate-600 shrink-0 mt-0.5">
                  {new Date(b.creado_en).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
