'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createClient } from '@/lib/supabase/client';
import { moverAvatarADescanso, reanudarTrabajo } from '@/lib/actions/avatares';

type EstadoAnim = 'idle' | 'caminando' | 'trabajando' | 'hablando' | 'celebrando';
type HairStyle  = 'profesional' | 'casual' | 'spiky' | 'hoodie' | 'bun' | 'creativo' | 'short';
type Accessory  = 'none' | 'glasses' | 'headset' | 'cap' | 'tie' | 'beret';
type RoleTool   = 'clipboard' | 'magnifier' | 'wrench' | 'screwdriver' | 'antenna' | 'palette' | 'paintbrush' | 'book' | 'shield' | 'database' | 'server' | 'none';
type LoungeAct     = 'playing' | 'sleeping' | 'chatting' | 'drinking' | 'idle';
type EstiloAvatares = 'humanos' | 'animales' | 'mixto';

interface Avatar  { id: string; agente_nombre: string | null; estado_animacion: EstadoAnim }
interface Entrada { id: string; agente: string; accion: string; creado_en: string; tarea_id?: string | null }
interface Tarea   {
  id: string; agente_asignado: string; descripcion: string; estado: string;
  notas: string | null; plan_ejecucion?: string | null;
  proyecto_id?: string | null;
  proyecto?: { nombre: string; empresa_id: string; empresa?: { nombre: string } | null } | null;
}
interface Props   { avatoresIniciales: Avatar[]; bitacoraInicial: Entrada[]; tareasIniciales: Tarea[] }

interface PersonajeCfg {
  nombre: string; titulo: string; personalidad: string;
  color: string; colorDark: string; accent: string;
  deskRow: 0|1|2|3; deskCol: 0|1|2|3; loungeSlot: number;
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
  'trans-investigador': { nombre:'Investigador', titulo:'Analista Web',          personalidad:'Curioso · Meticuloso',      color:'#f59e0b', colorDark:'#78350f', accent:'#fde68a', deskRow:3, deskCol:0, loungeSlot:12, skinColor:'#f1c27d', hairColor:'#7c4a03', hairStyle:'short',      accessory:'glasses', tool:'magnifier',  roleEmoji:'🔍' },
};

const AVATAR_EMOJIS: Record<string, { animal: string; mixto: string }> = {
  'pm-global':          { animal: '🦅', mixto: '🤖' },
  'dev-pm':             { animal: '🦉', mixto: '🧑‍💼' },
  'dev-backend':        { animal: '🐻', mixto: '⚙️'  },
  'dev-bd':             { animal: '🐘', mixto: '🧙'  },
  'dev-frontend':       { animal: '🦋', mixto: '🧚'  },
  'dev-devops':         { animal: '🦝', mixto: '👾'  },
  'dev-testing':        { animal: '🦎', mixto: '🕵️'  },
  'dev-diseno':         { animal: '🦊', mixto: '🎨'  },
  'dev-documentador':   { animal: '🐢', mixto: '👻'  },
  'dev-ciberseguridad': { animal: '🐺', mixto: '🥷'  },
  'dev-redes':          { animal: '🕷️', mixto: '🐙'  },
  'dev-soporte':        { animal: '🐶', mixto: '🫶'  },
  'trans-investigador': { animal: '🐱', mixto: '👽'  },
};

const LOUNGE_POS = [
  {x:46, y:40},{x:68, y:40},{x:46, y:62},{x:68, y:62},
  {x:14, y:68},{x:28, y:68},
  {x:14, y:48},{x:28, y:48},
  {x:88, y:28},{x:88, y:52},
  {x:55, y:18},{x:18, y:24},
  {x:75, y:18},
];

// Legacy desk positions (used as fallback when no company zones)
const DESK_POS = [
  {x:12,y:20},{x:37,y:20},{x:63,y:20},{x:88,y:20},
  {x:12,y:52},{x:37,y:52},{x:63,y:52},{x:88,y:52},
  {x:12,y:82},{x:37,y:82},{x:63,y:82},{x:88,y:82},
  {x:50,y:85},
];

// ── Company zone colour palette (6 colores rotativos) ─────────────────────────
const COMPANY_PALETTE = [
  { bg:'#dbeafe', border:'#3b82f6', header:'#1d4ed8', tile:'#eff6ff', soft:'#bfdbfe' },
  { bg:'#dcfce7', border:'#22c55e', header:'#15803d', tile:'#f0fdf4', soft:'#bbf7d0' },
  { bg:'#fce7f3', border:'#ec4899', header:'#be185d', tile:'#fdf2f8', soft:'#fbcfe8' },
  { bg:'#fed7aa', border:'#f97316', header:'#c2410c', tile:'#fff7ed', soft:'#fdba74' },
  { bg:'#e9d5ff', border:'#a855f7', header:'#7e22ce', tile:'#faf5ff', soft:'#d8b4fe' },
  { bg:'#ccfbf1', border:'#14b8a6', header:'#0f766e', tile:'#f0fdfa', soft:'#99f6e4' },
] as const;

type CompanyColor = typeof COMPANY_PALETTE[number];

interface CompanyZoneInfo {
  empresaId:       string;
  empresaNombre:   string;
  proyectoNombres: string[];
  agents:          string[];       // agentes con tarea primaria aquí
  ghostAgents:     string[];       // agentes en cola (trabajando en otra empresa)
  color:           CompanyColor;
}

// Posiciones de escritorios dentro de cada zona (% del ancho/alto de la zona)
const ZONE_DESK_SLOTS = [
  { x:20, y:22 }, { x:70, y:22 },
  { x:20, y:52 }, { x:70, y:52 },
  { x:20, y:80 }, { x:70, y:80 },
];

// ── Derivar zonas de empresa desde tareas activas ──────────────────────────────
function deriveCompanyZones(tareas: Tarea[]): CompanyZoneInfo[] {
  const active = tareas.filter(t =>
    (t.estado === 'en_progreso' || t.estado === 'pendiente') && t.proyecto?.empresa_id
  );
  if (active.length === 0) return [];

  const zoneMap = new Map<string, { nombre: string; proyectos: Set<string> }>();
  for (const t of active) {
    const eid = t.proyecto!.empresa_id;
    if (!zoneMap.has(eid)) {
      zoneMap.set(eid, { nombre: t.proyecto?.empresa?.nombre ?? 'Empresa', proyectos: new Set() });
    }
    const pn = t.proyecto?.nombre ?? '';
    if (pn) zoneMap.get(eid)!.proyectos.add(pn);
  }

  // Empresa primaria por agente: en_progreso > pendiente
  const agentPrimary = new Map<string, string>();
  for (const t of active) {
    if (t.estado === 'en_progreso') agentPrimary.set(t.agente_asignado, t.proyecto!.empresa_id);
  }
  for (const t of active) {
    if (!agentPrimary.has(t.agente_asignado)) agentPrimary.set(t.agente_asignado, t.proyecto!.empresa_id);
  }

  // Fantasmas: agentes con tareas en empresa secundaria
  const ghostMap = new Map<string, Set<string>>();
  for (const t of active) {
    const primary = agentPrimary.get(t.agente_asignado);
    if (primary && primary !== t.proyecto!.empresa_id) {
      const eid = t.proyecto!.empresa_id;
      if (!ghostMap.has(eid)) ghostMap.set(eid, new Set());
      ghostMap.get(eid)!.add(t.agente_asignado);
    }
  }

  // Agentes primarios por zona
  const primaryByZone = new Map<string, Set<string>>();
  for (const [ag, eid] of agentPrimary) {
    if (!primaryByZone.has(eid)) primaryByZone.set(eid, new Set());
    primaryByZone.get(eid)!.add(ag);
  }

  return Array.from(zoneMap.entries()).map(([eid, info], i) => ({
    empresaId:       eid,
    empresaNombre:   info.nombre,
    proyectoNombres: Array.from(info.proyectos),
    agents:          Array.from(primaryByZone.get(eid) ?? new Set()),
    ghostAgents:     Array.from(ghostMap.get(eid) ?? new Set()),
    color:           COMPANY_PALETTE[i % COMPANY_PALETTE.length]!,
  }));
}

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

// ── Figura humana SVG ─────────────────────────────────────────────────────────
function HumanFigure({ cfg, estado }: { cfg: PersonajeCfg; estado: EstadoAnim }) {
  const { skinColor, hairColor, hairStyle, accessory, color, colorDark, accent, tool } = cfg;
  const isActive      = atDesk(estado);
  const isCelebrating = estado === 'celebrando';
  const isWorking     = estado === 'trabajando';
  const isTalking     = estado === 'hablando';

  const shadowColor = 'rgba(0,0,0,0.12)';
  const eyeColor    = skinColor.startsWith('#6b') ? '#5b8dd9' : '#3d6bb5';

  const mouthCurve = isCelebrating ? 'M13 20 Q20 26 27 20'
    : isWorking ? 'M14.5 20 Q20 22 25.5 20'
    : 'M13.5 20.5 Q20 24 26.5 20.5';

  const leftBrow  = isWorking ? 'M12 11 Q16 9.5 20 11' : isCelebrating ? 'M12 9.5 Q16 8 20 9.5' : 'M12 11 Q16 10 20 11';
  const rightBrow = isWorking ? 'M20 11 Q24 9.5 28 11' : isCelebrating ? 'M20 9.5 Q24 8 28 9.5' : 'M20 11 Q24 10 28 11';

  return (
    <svg width="40" height="56" viewBox="0 0 40 56" style={{ overflow: 'visible' }}>
      {isActive && <ellipse cx="20" cy="57" rx="14" ry="3" fill={color} opacity="0.28" />}
      <ToolShape tool={tool} color={color} accent={accent} />
      <path d="M6 37 Q1 45 2 53" stroke={color} strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <circle cx="2" cy="53" r="3" fill={skinColor} />
      <path d="M34 37 Q39 45 38 53" stroke={color} strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <circle cx="38" cy="53" r="3" fill={skinColor} />
      <path d="M5 57 L5 38 Q9 29 17 28 L23 28 Q31 29 35 38 L35 57 Z" fill={color} />
      <path d="M5 57 L5 38 Q8 30 16 28 L16 57 Z" fill="rgba(0,0,0,0.09)" />
      <path d="M16 28 L20 35 L24 28" fill="white" opacity="0.15" />
      <rect x="17" y="25" width="6" height="6" rx="2.5" fill={skinColor} />
      <rect x="17" y="28" width="6" height="3" rx="1" fill={shadowColor} />
      <circle cx="20" cy="14" r="13" fill={skinColor} />
      <ellipse cx="20" cy="24" rx="7.5" ry="3.5" fill={shadowColor} />
      <ellipse cx="8.5" cy="16" rx="3" ry="2.5" fill={shadowColor} opacity="0.5" />
      <ellipse cx="31.5" cy="16" rx="3" ry="2.5" fill={shadowColor} opacity="0.5" />
      <ellipse cx="7" cy="15" rx="2.5" ry="3" fill={skinColor} />
      <ellipse cx="33" cy="15" rx="2.5" ry="3" fill={skinColor} />
      {hairStyle === 'profesional' && <path d="M7 14 Q7 1 20 1 Q33 1 33 14 Q31 5 20 4 Q9 5 7 14" fill={hairColor} />}
      {hairStyle === 'casual'      && <path d="M7 16 Q6 0 20 0 Q34 0 33 16 Q31 4 20 3 Q9 4 7 16" fill={hairColor} />}
      {hairStyle === 'spiky' && (
        <g fill={hairColor}>
          <path d="M7 14 Q9 3 20 2 Q31 3 33 14 Q30 6 20 5 Q10 6 7 14" />
          <path d="M10 8 L12 0 L14 8" /><path d="M17 6 L20 -1 L23 6" /><path d="M26 8 L28 0 L30 8" />
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
      {hairStyle === 'short' && <path d="M7 14 Q8 4 20 3 Q32 4 33 14 Q31 7 20 6 Q9 7 7 14" fill={hairColor} />}
      {(isCelebrating || isTalking) && (
        <>
          <circle cx="11" cy="17" r="3.5" fill="#ff8fab" opacity="0.28" />
          <circle cx="29" cy="17" r="3.5" fill="#ff8fab" opacity="0.28" />
        </>
      )}
      <path d={leftBrow}  stroke={hairColor} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d={rightBrow} stroke={hairColor} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <ellipse cx="15" cy="15" rx="3.5" ry="2.8" fill="white" opacity="0.97" />
      <ellipse cx="25" cy="15" rx="3.5" ry="2.8" fill="white" opacity="0.97" />
      <circle cx="15" cy="15" r="2.2" fill={eyeColor} /><circle cx="25" cy="15" r="2.2" fill={eyeColor} />
      <circle cx="15" cy="15" r="1.35" fill="#1a1a2e" /><circle cx="25" cy="15" r="1.35" fill="#1a1a2e" />
      <circle cx="15.7" cy="14.2" r="0.72" fill="white" opacity="0.9" />
      <circle cx="25.7" cy="14.2" r="0.72" fill="white" opacity="0.9" />
      <circle cx="18.7" cy="18.8" r="0.7" fill={shadowColor} opacity="1.2" />
      <circle cx="21.3" cy="18.8" r="0.7" fill={shadowColor} opacity="1.2" />
      <path d={mouthCurve} stroke="#c2774d" strokeWidth="1.5" fill={isCelebrating ? 'rgba(255,150,100,0.2)' : 'none'} strokeLinecap="round" />
      {accessory === 'glasses' && (
        <g stroke="#4a4a4a" strokeWidth="0.9" fill="none" opacity="0.9">
          <circle cx="15" cy="15" r="4.5" /><circle cx="25" cy="15" r="4.5" />
          <line x1="19.5" y1="15" x2="20.5" y2="15" />
          <line x1="7" y1="15" x2="10.5" y2="15" />
          <line x1="29.5" y1="15" x2="33" y2="15" />
        </g>
      )}
      {accessory === 'headset' && (
        <g fill={color} stroke={color} strokeWidth="0.4">
          <path d="M7 14 Q20 2 33 14" fill="none" strokeWidth="2.2" />
          <ellipse cx="7"  cy="15" rx="3" ry="3.5" />
          <ellipse cx="33" cy="15" rx="3" ry="3.5" />
          <path d="M7 18 Q3 22 3 25" fill="none" strokeWidth="1.6" />
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

// ── Avatar emoji (estilos animales / mixto) ───────────────────────────────────
function EmojiAvatar({ cfg, estado, emoji }: { cfg: PersonajeCfg; estado: EstadoAnim; emoji: string }) {
  const isActive = atDesk(estado);
  return (
    <div style={{ width: 40, height: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      {isActive && (
        <div style={{ position:'absolute', bottom:0, left:'50%', transform:'translateX(-50%)', width:28, height:5, borderRadius:'50%', background:cfg.color, opacity:0.22 }} />
      )}
      <div style={{
        width: 38, height: 42,
        background: `linear-gradient(135deg, ${cfg.color}28, ${cfg.color}14)`,
        border: `2px solid ${cfg.color}55`,
        borderRadius: '50% 50% 35% 35%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24,
        boxShadow: isActive
          ? `0 0 14px ${cfg.color}44, inset 0 0 8px ${cfg.color}18`
          : '0 2px 6px rgba(0,0,0,0.08)',
        flexShrink: 0,
      }}>
        {emoji}
      </div>
      <div style={{ display:'flex', gap:5, marginTop:1 }}>
        <div style={{ width:5, height:12, background:cfg.color, opacity:0.55, borderRadius:'0 0 3px 3px' }} />
        <div style={{ width:5, height:12, background:cfg.color, opacity:0.55, borderRadius:'0 0 3px 3px' }} />
      </div>
    </div>
  );
}

// ── Slot de agente fantasma ───────────────────────────────────────────────────
function GhostAgentSlot({ agenteId, primaryNombre, estilo }: { agenteId: string; primaryNombre: string; estilo: EstiloAvatares }) {
  const cfg = PERSONAJES[agenteId];
  if (!cfg) return null;
  const emojiData = AVATAR_EMOJIS[agenteId];
  const ghostEmoji = estilo === 'animales' ? emojiData?.animal : emojiData?.mixto;
  return (
    <div className="relative flex flex-col items-center pointer-events-none select-none sims-ghost" style={{ width: 62 }}>
      <div className="absolute z-10 pointer-events-none" style={{ top: -18, left: '50%', transform: 'translateX(-50%)' }}>
        <div className="text-[7px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap flex items-center gap-0.5"
          style={{ background: '#fef9c3', color: '#92400e', border: '1px solid #fde047', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
          ⏳ {primaryNombre.slice(0, 12)}
        </div>
      </div>
      <div className="sims-avatar-idle">
        {estilo === 'humanos' || !ghostEmoji
          ? <HumanFigure cfg={cfg} estado="idle" />
          : <EmojiAvatar cfg={cfg} estado="idle" emoji={ghostEmoji} />
        }
      </div>
      <div className="mt-0.5 px-1.5 py-0.5 rounded-lg text-center"
        style={{ background: 'rgba(0,0,0,0.08)', maxWidth: 62 }}>
        <p className="text-[8px] font-bold truncate" style={{ color: '#64748b' }}>{cfg.nombre}</p>
      </div>
    </div>
  );
}

// ── Card de agente ────────────────────────────────────────────────────────────
function AgenteCard({
  id, cfg, estado, selected, onClick, estilo,
}: { id: string; cfg: PersonajeCfg; estado: EstadoAnim; selected: boolean; onClick: () => void; estilo: EstiloAvatares }) {
  const activo    = atDesk(estado);
  const enLounge  = !activo && estado !== 'caminando';
  const loungeAct = enLounge ? getLoungeActivity(cfg.loungeSlot) : 'idle';

  return (
    <div className="relative cursor-pointer group select-none flex flex-col items-center" onClick={onClick} style={{ width: 62 }}>
      {estado === 'hablando' && (
        <div className="absolute z-40 pointer-events-none" style={{ bottom: '100%', marginBottom: 4, left: '50%', transform: 'translateX(-50%)' }}>
          <div className="sims-burbuja text-[9px] px-2 py-1 rounded-xl font-semibold whitespace-nowrap"
            style={{ background: cfg.color, color: '#fff', boxShadow: `0 2px 8px ${cfg.color}66` }}>
            💬 · · ·
          </div>
          <div className="mx-auto" style={{ width:0, height:0, borderLeft:'5px solid transparent', borderRight:'5px solid transparent', borderTop:`5px solid ${cfg.color}` }} />
        </div>
      )}
      {estado === 'celebrando' && (
        <div className="absolute pointer-events-none sims-confeti text-base" style={{ bottom: '100%', left:'50%', transform:'translateX(-50%)', marginBottom:2 }}>
          🎉
        </div>
      )}
      {activo && (
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white animate-pulse z-30"
          style={{ background: cfg.color }} />
      )}
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
      <div className={`sims-avatar-${estado}`}>
        {estilo === 'humanos' || !AVATAR_EMOJIS[id]
          ? <HumanFigure cfg={cfg} estado={estado} />
          : <EmojiAvatar cfg={cfg} estado={estado} emoji={(estilo === 'animales' ? AVATAR_EMOJIS[id]?.animal : AVATAR_EMOJIS[id]?.mixto) ?? ''} />
        }
      </div>
      {/* Badge nombre */}
      <div className="mt-0.5 px-1.5 py-0.5 rounded-lg text-center" style={{
        background: activo ? `${cfg.color}22` : 'rgba(255,255,255,0.82)',
        border: selected ? `1.5px solid ${cfg.color}` : '1px solid rgba(0,0,0,0.08)',
        boxShadow: selected ? `0 0 0 2px ${cfg.color}30` : 'none',
        maxWidth: 62,
      }}>
        <p className="text-[8px] font-bold truncate" style={{ color: activo ? cfg.colorDark : '#475569' }}>
          {cfg.nombre}
        </p>
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block z-50 w-48 pointer-events-none">
        <div className="rounded-2xl p-3 shadow-2xl border" style={{ background:'#1e293b', borderColor:`${cfg.color}55` }}>
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
      <div className="absolute top-0 left-0 right-0 flex items-center justify-center" style={{ height: 32, borderBottom: '1px solid rgba(180,140,50,0.18)', zIndex: 1 }}>
        <p style={{ color: 'rgba(146,64,14,0.5)', fontSize: 7, fontWeight: 700, letterSpacing: 4, textTransform: 'uppercase' }}>
          🏠 Sala de Descanso
        </p>
      </div>

      {/* Alfombra */}
      <div className="absolute" style={{ left:'8%', bottom:55, width:'84%', height:80, borderRadius:18,
        background:'radial-gradient(ellipse at center, rgba(120,53,15,0.15) 0%, rgba(80,30,5,0.06) 100%)',
        border:'1px solid rgba(180,100,30,0.12)' }} />

      {/* Sofá */}
      <div className="absolute" style={{ left:'4%', bottom:60 }}>
        <div style={{ width:82, height:22, background:'linear-gradient(160deg,rgba(180,100,40,0.78),rgba(140,70,20,0.85))',
          border:'1px solid rgba(200,120,40,0.35)', borderRadius:'8px 8px 0 0', boxShadow:'0 -2px 8px rgba(0,0,0,0.12)' }}>
          <div style={{ position:'absolute', top:5, left:8, right:8, height:1, background:'rgba(220,160,60,0.2)', borderRadius:1 }} />
          <div style={{ position:'absolute', top:12, left:8, right:8, height:1, background:'rgba(220,160,60,0.2)', borderRadius:1 }} />
        </div>
        <div style={{ width:82, height:16, background:'linear-gradient(180deg,rgba(195,110,40,0.72),rgba(155,80,25,0.82))',
          border:'1px solid rgba(200,110,35,0.3)', position:'relative', zIndex:2 }}>
          <div className="flex gap-1 px-1.5 pt-1">
            {[0,1,2].map(i => (
              <div key={i} style={{ flex:1, height:10, background:'rgba(205,130,50,0.45)', border:'1px solid rgba(230,150,50,0.22)', borderRadius:'3px 3px 0 0' }} />
            ))}
          </div>
        </div>
        <div style={{ position:'absolute', left:-7, top:5, width:9, height:28, background:'rgba(150,80,25,0.8)', border:'1px solid rgba(180,100,30,0.35)', borderRadius:'5px 0 0 5px' }} />
        <div style={{ position:'absolute', right:-7, top:5, width:9, height:28, background:'rgba(150,80,25,0.8)', border:'1px solid rgba(180,100,30,0.35)', borderRadius:'0 5px 5px 0' }} />
        <div className="flex justify-between px-2">
          {[0,1].map(i => <div key={i} style={{ width:4, height:7, background:'rgba(90,45,10,0.85)', borderRadius:'0 0 2px 2px' }} />)}
        </div>
        {/* Mesa de café */}
        <div style={{ width:70, height:8, background:'linear-gradient(135deg,rgba(120,70,20,0.6),rgba(90,50,10,0.65))',
          border:'1px solid rgba(160,90,25,0.3)', borderRadius:3, marginTop:10, marginLeft:6,
          boxShadow:'0 3px 0 rgba(0,0,0,0.2)', position:'relative' }}>
          <span style={{ position:'absolute', top:-7, left:5, fontSize:9 }}>☕</span>
          <span style={{ position:'absolute', top:-7, left:24, fontSize:9 }}>📱</span>
        </div>
        <div style={{ width:55, height:3, margin:'0 auto', background:'rgba(80,40,5,0.5)' }} />
        <div className="flex justify-between" style={{ padding:'0 14px' }}>
          {[0,1].map(i => <div key={i} style={{ width:3, height:6, background:'rgba(60,28,4,0.7)' }} />)}
        </div>
      </div>

      {/* Mesa de futbolito */}
      <div className="absolute" style={{ left:'35%', top:'18%' }}>
        <div style={{ width:108, height:8, background:'linear-gradient(90deg,rgba(150,80,25,0.85),rgba(120,65,20,0.8))',
          borderRadius:'4px 4px 0 0', border:'1px solid rgba(190,110,35,0.45)' }} />
        <div style={{ width:108, height:68, background:'linear-gradient(160deg,#166534,#15803d)',
          border:'2px solid rgba(74,222,128,0.2)', position:'relative',
          boxShadow:'inset 0 0 16px rgba(0,0,0,0.25), 0 4px 0 rgba(0,0,0,0.35)' }}>
          <div style={{ position:'absolute', left:'50%', top:4, bottom:4, width:1, background:'rgba(74,222,128,0.3)' }} />
          <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:20, height:20, border:'1px solid rgba(74,222,128,0.25)', borderRadius:'50%' }} />
          <div style={{ position:'absolute', left:2, top:'25%', width:5, height:'50%', background:'rgba(253,224,71,0.35)', borderRadius:1 }} />
          <div style={{ position:'absolute', right:2, top:'25%', width:5, height:'50%', background:'rgba(253,224,71,0.35)', borderRadius:1 }} />
          {[16,32,54,72,90].map((x,i) => (
            <div key={i} style={{ position:'absolute', left:x, top:-8, bottom:-8, width:2.5, background:'rgba(200,200,200,0.45)', borderRadius:1 }}>
              {[14,36,58].slice(0, i%2===0 ? 3 : 2).map((y,j) => (
                <div key={j} style={{ position:'absolute', top:y, left:-4, width:10, height:10, borderRadius:'50%',
                  background: i<3 ? 'rgba(59,130,246,0.8)' : 'rgba(239,68,68,0.8)',
                  border:'1px solid rgba(255,255,255,0.25)', boxShadow:'0 1px 3px rgba(0,0,0,0.35)' }} />
              ))}
            </div>
          ))}
          <div style={{ position:'absolute', left:'47%', top:'44%', width:7, height:7, borderRadius:'50%', background:'white', boxShadow:'0 0 4px rgba(0,0,0,0.4)' }} />
        </div>
        <div style={{ width:108, height:10, background:'linear-gradient(90deg,rgba(130,70,18,0.82),rgba(100,55,12,0.85))',
          borderRadius:'0 0 4px 4px', border:'1px solid rgba(170,100,20,0.35)', boxShadow:'0 3px 6px rgba(0,0,0,0.25)' }} />
        <div className="flex justify-between px-3">
          {[0,1].map(i => <div key={i} style={{ width:6, height:16, background:'rgba(80,40,8,0.85)', borderRadius:'0 0 3px 3px' }} />)}
        </div>
      </div>

      {/* Máquina vending */}
      <div className="absolute" style={{ right:8, top:'8%' }}>
        <div style={{ width:46, height:84, background:'linear-gradient(180deg,#f0fdf4,#dcfce7)',
          border:'2px solid rgba(34,197,94,0.4)', borderRadius:7, position:'relative',
          boxShadow:'3px 3px 0 rgba(0,0,0,0.1), 0 6px 16px rgba(0,0,0,0.1)' }}>
          <div style={{ height:6, margin:'4px 4px 0', background:'linear-gradient(90deg,rgba(34,197,94,0.5),rgba(22,163,74,0.6))', borderRadius:'4px 4px 2px 2px' }} />
          <div style={{ margin:'4px 4px 0', height:26, background:'linear-gradient(135deg,#f0fdf4,#dcfce7)',
            border:'1px solid rgba(34,197,94,0.4)', borderRadius:4,
            display:'flex', flexWrap:'wrap', gap:3, padding:3, justifyContent:'center', alignItems:'center' }}>
            {['☕','🥤','🍵','🧃'].map((e,i) => <span key={i} style={{ fontSize:8 }}>{e}</span>)}
          </div>
          <div style={{ margin:'5px 7px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:3.5 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ height:7, background: i===0||i===3 ? 'rgba(34,197,94,0.5)' : 'rgba(220,240,220,0.7)',
                borderRadius:2, border:'1px solid rgba(34,197,94,0.2)' }} />
            ))}
          </div>
          <div style={{ margin:'6px auto 0', width:18, height:2.5, background:'rgba(0,0,0,0.12)', borderRadius:1, border:'1px solid rgba(34,197,94,0.2)' }} />
          <div style={{ position:'absolute', bottom:14, left:'50%', transform:'translateX(-50%)', width:6, height:6, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 6px #22c55e88' }} />
          <div style={{ position:'absolute', bottom:4, left:5, right:5, height:12, background:'rgba(0,0,0,0.06)', borderRadius:'0 0 5px 5px', border:'1px solid rgba(34,197,94,0.15)' }} />
        </div>
      </div>

      {/* Planta */}
      <div className="absolute" style={{ right:58, bottom:14 }}>
        <div style={{ position:'relative' }}>
          <div style={{ width:14, height:20, background:'rgba(34,197,94,0.45)', borderRadius:'50% 50% 20% 20%', marginBottom:1 }} />
          <div style={{ width:10, height:8, background:'rgba(21,128,61,0.38)', borderRadius:'50% 50% 20% 20%', position:'absolute', top:-5, left:8, transform:'rotate(30deg)' }} />
          <div style={{ width:10, height:8, background:'rgba(21,128,61,0.38)', borderRadius:'50% 50% 20% 20%', position:'absolute', top:-4, left:-4, transform:'rotate(-25deg)' }} />
          <div style={{ width:12, height:10, background:'rgba(180,120,60,0.55)', borderRadius:'2px 2px 4px 4px', margin:'0 auto' }} />
        </div>
      </div>

      {/* Lámpara */}
      <div className="absolute" style={{ left:'5%', top:'14%' }}>
        <div style={{ width:22, height:14, background:'linear-gradient(180deg,rgba(251,191,36,0.22),rgba(251,191,36,0.08))',
          borderRadius:'50% 50% 30% 30%', border:'1px solid rgba(251,191,36,0.3)',
          boxShadow:'0 0 16px rgba(251,191,36,0.15)', marginBottom:0 }} />
        <div style={{ width:2, height:34, background:'rgba(180,160,120,0.45)', margin:'0 auto' }} />
        <div style={{ width:18, height:3, background:'rgba(180,160,120,0.4)', borderRadius:2, margin:'0 auto' }} />
      </div>
    </>
  );
}

// ── Parser plan ───────────────────────────────────────────────────────────────
function parsePlanSteps(plan: string): string[] {
  if (!plan) return [];
  const pasoHeaderRe = /^===\s*PASO\s+(\d+)\s*[—–\-]\s*(.+?)\s*===\s*$/gim;
  const headers: string[] = [];
  let m;
  while ((m = pasoHeaderRe.exec(plan)) !== null) {
    headers.push(`Paso ${m[1]}: ${(m[2] ?? '').trim()}`);
  }
  if (headers.length > 0) return headers;
  const sinEncabezados = plan.replace(/^===.*===\s*$/gm, '');
  return sinEncabezados.split('\n').map(l => l.trim())
    .filter(l => /^\d+[\.\)\-]\s+\S/.test(l) || /^\*\*\d+[\.\)]\*?\*?\s+\S/.test(l) || /^[-*•]\s+\S/.test(l) || /^Paso\s+\d+/i.test(l) || /^Step\s+\d+/i.test(l))
    .map(l => l.replace(/^\d+[\.\)\-]\s*/, '').replace(/^\*\*\d+[\.\)]\*?\*?\s*/, '').replace(/^[-*•]\s*/, '').replace(/^Paso\s+\d+[\.\:\-]?\s*/i, '').replace(/^Step\s+\d+[\.\:\-]?\s*/i, '').replace(/\*\*/g, '').trim())
    .filter(l => l.length > 4);
}

async function ejecutarTareaAPI(tareaId: string, reanudar = false) {
  await fetch('/api/ejecutar-tarea', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tarea_id: tareaId, reanudar }),
  });
}

async function cambiarEstadoTareaAPI(tareaId: string, nuevoEstado: string) {
  const { createClient: cc } = await import('@/lib/supabase/client');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = cc() as any;
  await sb.from('tareas').update({ estado: nuevoEstado }).eq('id', tareaId);
}

function extraerComandosSSH(bitacora: Entrada[], tareaId: string) {
  return bitacora
    .filter(b => b.tarea_id === tareaId)
    .filter(b => b.accion.startsWith('🖥️') || b.accion.startsWith('📤'))
    .slice().reverse();
}

interface Papel { id: string; de: string; para: string; ts: number }

// ── Componente principal ──────────────────────────────────────────────────────
export default function SimsCanvas({ avatoresIniciales, bitacoraInicial, tareasIniciales }: Props) {
  const supabase = createClient();

  const [estados, setEstados]            = useState<Record<string, EstadoAnim>>({});
  const targetRef                        = useRef<Record<string, EstadoAnim>>({});
  const [bitacora, setBitacora]          = useState<Entrada[]>(bitacoraInicial);
  const [tareas, setTareas]              = useState<Tarea[]>(tareasIniciales);
  const [selId, setSelId]                = useState<string | null>(null);
  const [papeles, setPapeles]            = useState<Papel[]>([]);
  const [avatarPending, startAvatar]     = useTransition();
  const [dragId, setDragId]              = useState<string | null>(null);
  const [ejecutandoId, setEjecutandoId]  = useState<string | null>(null);
  const dragIdRef                        = useRef<string | null>(null);
  const [dragOver, setDragOver]          = useState<string | null>(null);
  const dragEnterCount                   = useRef<Record<string, number>>({});
  const [expandedTareaId, setExpandedTareaId]   = useState<string | null>(null);
  const [filtroEmpresaId, setFiltroEmpresaId]   = useState<string>('');
  const [filtroProyectoId, setFiltroProyectoId] = useState<string>('');
  const [filtroEstado, setFiltroEstado]         = useState<string>('');
  const [tareaPage, setTareaPage]               = useState<number>(5);
  const [cambioEstadoId, setCambioEstadoId]     = useState<string | null>(null);
  const [estiloAvatares, setEstiloAvatares]     = useState<EstiloAvatares>('humanos');

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
    const canal = supabase.channel('sims-v6')
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
        setBitacora(p => [payload.new as Entrada, ...p].slice(0, 150));
      })
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'tareas' }, payload => {
        setTareas(p => [payload.new as Tarea, ...p].slice(0, 500));
      })
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'tareas' }, payload => {
        const updated = payload.new as Tarea;
        setTareas(p => p.map(t => t.id === updated.id ? { ...t, ...updated, proyecto: updated.proyecto ?? t.proyecto } : t));
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFiltroEmpresaId('');
    setFiltroProyectoId('');
    setFiltroEstado('');
    setTareaPage(5);
    setExpandedTareaId(null);
  }, [selId]);

  function getEstado(id: string): EstadoAnim { return estados[id] ?? 'idle'; }
  function estadoColor(e: string) {
    if (e === 'completada') return '#22c55e';
    if (e === 'en_progreso') return '#3b82f6';
    return '#eab308';
  }

  // ── Zonas de empresa dinámicas ────────────────────────────────────────────
  const companyZones = deriveCompanyZones(tareas);

  const agentesIds = Object.keys(PERSONAJES);

  // Agentes en lounge = los que NO tienen zona de empresa asignada Y no están en tránsito
  const enLounge = agentesIds.filter(id => {
    if (getEstado(id) === 'caminando') return false;
    return !companyZones.some(z => z.agents.includes(id));
  });
  const enPasillo = agentesIds.filter(id => getEstado(id) === 'caminando');

  // Agentes trabajando sin zona de empresa (fallback)
  const enSalaGeneral = agentesIds.filter(id =>
    atDesk(getEstado(id)) && !companyZones.some(z => z.agents.includes(id))
  );

  const selCfg    = selId ? PERSONAJES[selId] : null;
  const selTareas = tareas.filter(t => t.agente_asignado === selId);

  const empresasAgente = [...new Map(
    selTareas.filter(t => t.proyecto?.empresa_id && t.proyecto.empresa?.nombre)
      .map(t => [t.proyecto!.empresa_id, t.proyecto!.empresa!.nombre])
  ).entries()].map(([id, nombre]) => ({ id, nombre }));

  const proyectosAgente = [...new Map(
    selTareas
      .filter(t => t.proyecto_id && t.proyecto?.nombre && (!filtroEmpresaId || t.proyecto?.empresa_id === filtroEmpresaId))
      .map(t => [t.proyecto_id!, t.proyecto!.nombre])
  ).entries()].map(([id, nombre]) => ({ id, nombre }));

  const selTareasFiltradas = selTareas
    .filter(t => !filtroEmpresaId  || t.proyecto?.empresa_id === filtroEmpresaId)
    .filter(t => !filtroProyectoId || t.proyecto_id === filtroProyectoId)
    .filter(t => !filtroEstado     || t.estado === filtroEstado);
  const selTareasVisibles = selTareasFiltradas.slice(0, tareaPage);
  const hayMasTareas = selTareasFiltradas.length > tareaPage;

  // ── Helpers de drag ───────────────────────────────────────────────────────
  function dragEnterZone(key: string) {
    dragEnterCount.current[key] = (dragEnterCount.current[key] ?? 0) + 1;
    setDragOver(key);
  }
  function dragLeaveZone(key: string) {
    dragEnterCount.current[key] = (dragEnterCount.current[key] ?? 1) - 1;
    if ((dragEnterCount.current[key] ?? 0) <= 0) { dragEnterCount.current[key] = 0; setDragOver(null); }
  }
  function dropToLounge(e: React.DragEvent) {
    e.preventDefault();
    dragEnterCount.current['lounge'] = 0; setDragOver(null);
    const id = dragIdRef.current || e.dataTransfer.getData('text/plain');
    if (!id) return;
    startAvatar(async () => { await moverAvatarADescanso(id); });
  }
  function dropToWork(e: React.DragEvent) {
    e.preventDefault(); setDragOver(null);
    const id = dragIdRef.current || e.dataTransfer.getData('text/plain');
    if (!id || atDesk(getEstado(id))) return;
    startAvatar(async () => { await reanudarTrabajo(id); });
  }

  return (
    <div className="space-y-4">

      {/* ── Escena principal ── */}
      <div className="rounded-3xl overflow-hidden" style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
      }}>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3" style={{ background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
          <span className="text-xl">🏢</span>
          <div>
            <p className="text-sm font-bold text-slate-800">Servicios Agénticos</p>
            <p className="text-[10px] text-slate-400">
              {enSalaGeneral.length + companyZones.reduce((s, z) => s + z.agents.filter(id => atDesk(getEstado(id))).length, 0)} trabajando
              {' · '}{enPasillo.length} en tránsito
              {' · '}{enLounge.length} en descanso
            </p>
          </div>
          {/* Pills de empresas activas */}
          {companyZones.length > 0 && (
            <div className="flex items-center gap-1.5 ml-3 flex-wrap">
              {companyZones.map(z => (
                <div key={z.empresaId} className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: z.color.bg, color: z.color.header, border: `1px solid ${z.color.border}50` }}>
                  🏢 <span className="max-w-[80px] truncate">{z.empresaNombre}</span>
                  <span className="opacity-60 ml-0.5">({z.agents.length})</span>
                </div>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {/* Toggle estilo de avatares */}
            <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background:'#f1f5f9', border:'1px solid #e2e8f0' }}>
              {(['humanos', 'animales', 'mixto'] as EstiloAvatares[]).map(e => (
                <button key={e} onClick={() => setEstiloAvatares(e)}
                  title={e === 'humanos' ? 'Profesionales' : e === 'animales' ? 'Animales' : 'Mixto'}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-md transition-all"
                  style={{
                    background: estiloAvatares === e ? '#1e293b' : 'transparent',
                    color: estiloAvatares === e ? '#f8fafc' : '#94a3b8',
                  }}>
                  {e === 'humanos' ? '👤' : e === 'animales' ? '🐾' : '🤖'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              En vivo
            </div>
          </div>
        </div>

        {/* Layout de oficina */}
        <div className="flex overflow-x-auto" style={{ height: 630 }}>

          {/* ═══ ZONA 1: LOUNGE ═══ */}
          <div
            className="relative flex-shrink-0 transition-all"
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDragEnter={e => { e.preventDefault(); dragEnterZone('lounge'); }}
            onDragLeave={() => dragLeaveZone('lounge')}
            onDrop={dropToLounge}
            style={{
              width: 262,
              background: dragOver === 'lounge'
                ? 'linear-gradient(160deg,#fef9c3 0%,#fef3c7 60%,#fffbeb 100%)'
                : 'linear-gradient(160deg,#fef9ee 0%,#fef3c7 60%,#fffbeb 100%)',
              borderRight: `2px solid ${dragOver === 'lounge' ? '#fbbf24' : '#fde68a'}`,
              outline: dragOver === 'lounge' ? '2px dashed #f59e0b' : 'none',
            }}>
            {/* Tile floor */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: 'linear-gradient(rgba(180,130,60,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(180,130,60,0.06) 1px,transparent 1px)',
              backgroundSize: '26px 26px',
            }} />
            {dragOver === 'lounge' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                <span style={{ fontSize: 28, opacity: 0.5 }}>🛋️</span>
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
                  <AgenteCard id={id} cfg={cfg} estado={getEstado(id)} selected={selId===id} onClick={() => setSelId(selId===id ? null : id)} estilo={estiloAvatares} />
                </div>
              );
            })}
          </div>

          {/* ═══ ZONA 2: PASILLO ═══ */}
          <div
            className="relative flex-shrink-0 flex flex-col items-center"
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDragEnter={e => { e.preventDefault(); dragEnterZone('pasillo'); }}
            onDragLeave={() => dragLeaveZone('pasillo')}
            onDrop={e => {
              e.preventDefault(); dragEnterCount.current['pasillo'] = 0; setDragOver(null);
              const id = dragIdRef.current || e.dataTransfer.getData('text/plain');
              if (!id) return;
              if (!atDesk(getEstado(id)) && getEstado(id) !== 'caminando') {
                startAvatar(async () => { await reanudarTrabajo(id); });
              } else if (atDesk(getEstado(id))) {
                startAvatar(async () => { await moverAvatarADescanso(id); });
              }
            }}
            style={{
              width: 40,
              background: '#f1f5f9',
              borderRight: `1px solid ${dragOver === 'pasillo' ? '#94a3b8' : '#e2e8f0'}`,
            }}>
            <p className="absolute" style={{
              top: '50%', left: '50%',
              transform: 'translate(-50%,-50%) rotate(-90deg)',
              fontSize: 6, color: '#94a3b8', fontWeight: 700, letterSpacing: 3, whiteSpace: 'nowrap',
            }}>PASILLO</p>
            {/* Línea punteada */}
            <div className="absolute" style={{
              left: '50%', top: 30, bottom: 10, width: 1,
              background: 'repeating-linear-gradient(to bottom,#cbd5e1 0,#cbd5e1 5px,transparent 5px,transparent 10px)',
            }} />
            {enPasillo.map((id, i) => {
              const cfg = PERSONAJES[id];
              if (!cfg) return null;
              return (
                <div key={id} className="absolute transition-all duration-1000"
                  style={{ top:`${18 + i * 20}%`, left:'50%', transform:'translate(-50%,-100%)', zIndex:10 }}>
                  <AgenteCard id={id} cfg={cfg} estado="caminando" selected={selId===id} onClick={() => setSelId(selId===id ? null : id)} estilo={estiloAvatares} />
                </div>
              );
            })}
          </div>

          {/* ═══ ZONAS DE EMPRESA (dinámicas) ═══ */}
          {companyZones.length > 0 ? (
            companyZones.map((zone, zi) => (
              <div key={zone.empresaId}
                className="relative flex-shrink-0 transition-all"
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                onDragEnter={e => { e.preventDefault(); dragEnterZone(`co-${zone.empresaId}`); }}
                onDragLeave={() => dragLeaveZone(`co-${zone.empresaId}`)}
                onDrop={e => {
                  e.preventDefault(); dragEnterCount.current[`co-${zone.empresaId}`] = 0; setDragOver(null);
                  const id = dragIdRef.current || e.dataTransfer.getData('text/plain');
                  if (!id || atDesk(getEstado(id))) return;
                  startAvatar(async () => { await reanudarTrabajo(id); });
                }}
                style={{
                  width: 228,
                  background: zone.color.tile,
                  borderRight: zi < companyZones.length - 1 ? `2px solid ${zone.color.border}30` : 'none',
                  outline: dragOver === `co-${zone.empresaId}` ? `2px dashed ${zone.color.border}` : 'none',
                }}>

                {/* ── Cabecera de empresa ── */}
                <div className="flex items-start justify-between px-3 py-2 relative z-10"
                  style={{ background: zone.color.header, minHeight: 58 }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-white flex items-center gap-1.5">
                      🏢 <span className="truncate">{zone.empresaNombre}</span>
                    </p>
                    <div className="flex flex-wrap gap-0.5 mt-0.5">
                      {zone.proyectoNombres.slice(0, 2).map(p => (
                        <span key={p} className="text-[7px] px-1.5 py-0.5 rounded-full text-white/80 truncate max-w-[90px]"
                          style={{ background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.22)' }}>
                          {p}
                        </span>
                      ))}
                      {zone.proyectoNombres.length > 2 && (
                        <span className="text-[7px] text-white/50">+{zone.proyectoNombres.length - 2}</span>
                      )}
                    </div>
                  </div>
                  {/* Badge: agentes activos */}
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background:'rgba(255,255,255,0.2)', color:'rgba(255,255,255,0.95)' }}>
                      {zone.agents.length} 👤
                    </span>
                    {zone.ghostAgents.length > 0 && (
                      <span className="text-[7px] px-1.5 py-0.5 rounded-full"
                        style={{ background:'rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.7)' }}>
                        {zone.ghostAgents.length} ⏳
                      </span>
                    )}
                  </div>
                </div>

                {/* Suelo con patrón de tiles */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  top: 58,
                  backgroundImage: `linear-gradient(${zone.color.border}12 1px,transparent 1px),linear-gradient(90deg,${zone.color.border}12 1px,transparent 1px)`,
                  backgroundSize: '26px 26px',
                }} />

                {/* ── Fantasmas (agentes en cola) ── */}
                {zone.ghostAgents.map((agenteId, gi) => {
                  const slotIdx = zone.agents.length + gi;
                  const slot = ZONE_DESK_SLOTS[slotIdx % ZONE_DESK_SLOTS.length];
                  if (!slot) return null;
                  const cfg = PERSONAJES[agenteId];
                  if (!cfg) return null;
                  const primaryZone = companyZones.find(z => z.agents.includes(agenteId));
                  const topPct = slot.y;
                  return (
                    <div key={`ghost-${agenteId}`} className="absolute" style={{
                      left: `${slot.x}%`,
                      top: `calc(58px + ${topPct}% + 12px)`,
                      transform: 'translate(-50%, -100%)',
                      zIndex: 8,
                    }}>
                      {/* Escritorio fantasma */}
                      <div style={{
                        width: 72, height: 38,
                        background: `${zone.color.border}0a`,
                        border: `1.5px dashed ${zone.color.border}55`,
                        borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginBottom: 2,
                        boxShadow: `0 2px 8px ${zone.color.border}10`,
                      }}>
                        <span style={{ fontSize: 13, opacity: 0.4 }}>💻</span>
                      </div>
                      <GhostAgentSlot agenteId={agenteId} primaryNombre={primaryZone?.empresaNombre ?? '...'} estilo={estiloAvatares} />
                    </div>
                  );
                })}

                {/* ── Agentes primarios (escritorio + avatar) ── */}
                {zone.agents.map((agenteId, ai) => {
                  const slot = ZONE_DESK_SLOTS[ai % ZONE_DESK_SLOTS.length];
                  if (!slot) return null;
                  const cfg = PERSONAJES[agenteId];
                  if (!cfg) return null;
                  const estado  = getEstado(agenteId);
                  const activo  = atDesk(estado);
                  const secondaryZones = companyZones.filter(z => z.ghostAgents.includes(agenteId));
                  const topPct = slot.y;

                  return (
                    <div key={agenteId}>
                      {/* Escritorio */}
                      <div className="absolute cursor-pointer"
                        onClick={() => setSelId(selId === agenteId ? null : agenteId)}
                        style={{
                          left: `${slot.x}%`,
                          top: `calc(58px + ${topPct + 5}%)`,
                          transform: 'translate(-50%, -50%)',
                          zIndex: 8,
                        }}>
                        <div style={{
                          width: 72, height: 38,
                          background: activo ? `${cfg.color}18` : 'white',
                          border: `1.5px solid ${activo ? cfg.color+'60' : '#e2e8f0'}`,
                          borderRadius: 6,
                          boxShadow: activo
                            ? `0 0 18px ${cfg.color}28, 0 3px 0 rgba(0,0,0,0.06)`
                            : '0 2px 0 rgba(0,0,0,0.05)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                        }}>
                          <div style={{
                            width: 42, height: 26,
                            background: activo ? `${cfg.color}22` : '#f8fafc',
                            border: `1px solid ${activo ? cfg.color+'50' : '#e2e8f0'}`,
                            borderRadius: 3,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {activo ? <span style={{ fontSize: 13 }}>💻</span> : <div style={{ width: 14, height: 10, background: '#e2e8f0', borderRadius: 1 }} />}
                          </div>
                          <div style={{ width: 38, height: 5, background: activo ? `${cfg.color}15` : '#f1f5f9', border: `1px solid ${activo ? cfg.color+'25' : '#e2e8f0'}`, borderRadius: 2 }} />
                        </div>
                        <div style={{ width: 72, height: 7, background: activo ? `${cfg.color}10` : '#f8fafc', borderRadius: '0 0 4px 4px', border: `1px solid ${activo ? cfg.color+'20' : '#e2e8f0'}`, borderTop: 'none' }} />
                        <p style={{ textAlign: 'center', fontSize: 6, fontWeight: 600, marginTop: 1, color: activo ? cfg.color : '#94a3b8' }}>{cfg.nombre}</p>
                        {activo && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full animate-pulse border-2 border-white" style={{ background: cfg.color }} />}
                      </div>

                      {/* Avatar */}
                      <div className="absolute transition-all duration-1000"
                        draggable
                        onDragStart={e => { e.dataTransfer.setData('text/plain', agenteId); e.dataTransfer.effectAllowed = 'move'; dragIdRef.current = agenteId; setDragId(agenteId); }}
                        onDragEnd={() => { dragIdRef.current = null; setDragId(null); }}
                        style={{
                          left: `${slot.x}%`,
                          top: `calc(58px + ${topPct - 1}%)`,
                          transform: 'translate(-50%, -100%)',
                          zIndex: 20,
                          opacity: dragId === agenteId ? 0.45 : 1,
                          cursor: 'grab',
                        }}>
                        {/* Badge multi-empresa */}
                        {secondaryZones.length > 0 && (
                          <div className="absolute z-30 sims-badge-bounce" style={{ top: -4, right: -4 }}>
                            <div className="text-[7px] font-bold w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: '#f59e0b', color: '#fff', boxShadow: '0 1px 4px rgba(245,158,11,0.5)', border: '1.5px solid #fff' }}>
                              +{secondaryZones.length}
                            </div>
                          </div>
                        )}
                        <AgenteCard id={agenteId} cfg={cfg} estado={estado} selected={selId === agenteId} onClick={() => setSelId(selId === agenteId ? null : agenteId)} estilo={estiloAvatares} />
                      </div>
                    </div>
                  );
                })}

                {/* Papeles voladores dirigidos a esta zona */}
                {papeles.filter(p => zone.agents.includes(p.para)).map(p => {
                  const cfg = PERSONAJES[p.para];
                  if (!cfg) return null;
                  const ai = zone.agents.indexOf(p.para);
                  const slot = ZONE_DESK_SLOTS[ai % ZONE_DESK_SLOTS.length];
                  if (!slot) return null;
                  return (
                    <div key={p.id} className="absolute pointer-events-none sims-papel-vuela z-30 text-xl"
                      style={{ left:`${slot.x}%`, top:`calc(58px + ${slot.y + 8}%)` }}>
                      📄
                    </div>
                  );
                })}

                {/* Drag-over indicator */}
                {dragOver === `co-${zone.empresaId}` && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                    <span style={{ fontSize: 28, opacity: 0.4 }}>💼</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            /* Estado vacío: sin empresas activas */
            <div
              className="relative flex-1 flex flex-col items-center justify-center transition-all"
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDragEnter={e => { e.preventDefault(); dragEnterZone('sala'); }}
              onDragLeave={() => dragLeaveZone('sala')}
              onDrop={dropToWork}
              style={{
                background: dragOver === 'sala' ? '#eff6ff' : '#f8fafc',
                borderLeft: '1px solid #e2e8f0',
                outline: dragOver === 'sala' ? '2px dashed #93c5fd' : 'none',
              }}>
              {/* Cuadrícula de suelo */}
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: 'linear-gradient(rgba(148,163,184,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.08) 1px,transparent 1px)',
                backgroundSize: '26px 26px',
              }} />
              {enSalaGeneral.length === 0 ? (
                <div className="text-center relative z-10">
                  <div style={{ fontSize: 44, marginBottom: 12 }}>🏗️</div>
                  <p className="text-sm font-semibold text-slate-400">Sala de trabajo vacía</p>
                  <p className="text-xs text-slate-300 mt-1 max-w-[200px]">Los agentes aparecerán aquí cuando tengan tareas con empresa asignada</p>
                </div>
              ) : (
                <>
                  {enSalaGeneral.map(id => {
                    const cfg = PERSONAJES[id];
                    if (!cfg) return null;
                    const deskIdx = cfg.deskRow * 4 + cfg.deskCol;
                    const pos = DESK_POS[deskIdx] ?? { x:50, y:50 };
                    return (
                      <div key={id} className="absolute transition-all duration-1000"
                        draggable
                        onDragStart={e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; dragIdRef.current = id; setDragId(id); }}
                        onDragEnd={() => { dragIdRef.current = null; setDragId(null); }}
                        style={{ left:`${pos.x}%`, top:`${pos.y + 5}%`, transform:'translate(-50%,-100%)', zIndex:20, opacity: dragId===id ? 0.45:1, cursor:'grab' }}>
                        <AgenteCard id={id} cfg={cfg} estado={getEstado(id)} selected={selId===id} onClick={() => setSelId(selId===id ? null : id)} estilo={estiloAvatares} />
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel agente seleccionado ── */}
      {selCfg && (
        <div className="rounded-2xl overflow-hidden border" style={{ background:'#0f172a', borderColor:`${selCfg.color}33` }}>
          <div className="px-6 py-4 flex items-center gap-4" style={{ borderBottom:`1px solid ${selCfg.color}1a` }}>
            <div className="w-16 h-20 rounded-2xl flex items-end justify-center overflow-visible" style={{ background:`${selCfg.color}14`, border:`1px solid ${selCfg.color}30` }}>
              {estiloAvatares === 'humanos' || !AVATAR_EMOJIS[selId!]
                ? <HumanFigure cfg={selCfg} estado={getEstado(selId!)} />
                : <div style={{ fontSize: 42, lineHeight: 1, paddingBottom: 8 }}>
                    {estiloAvatares === 'animales' ? AVATAR_EMOJIS[selId!]?.animal : AVATAR_EMOJIS[selId!]?.mixto}
                  </div>
              }
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

          {/* Botones de control */}
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

          {/* Tareas */}
          <div className="px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color:`${selCfg.color}80` }}>
                Tareas asignadas
                {selTareasFiltradas.length !== selTareas.length && (
                  <span className="ml-1 font-normal text-slate-600">({selTareasFiltradas.length}/{selTareas.length})</span>
                )}
              </p>
              {(filtroEmpresaId || filtroProyectoId || filtroEstado) && (
                <button onClick={() => { setFiltroEmpresaId(''); setFiltroProyectoId(''); setFiltroEstado(''); }}
                  className="text-[9px] text-slate-500 hover:text-slate-300 px-1">✕ limpiar</button>
              )}
            </div>

            {selTareas.length > 2 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(['pendiente','en_progreso','completada'] as const).map(e => (
                  <button key={e} onClick={() => setFiltroEstado(filtroEstado === e ? '' : e)}
                    className="text-[9px] font-semibold px-2 py-0.5 rounded-full transition-colors"
                    style={{
                      background: filtroEstado === e ? estadoColor(e)+'28' : 'rgba(255,255,255,0.04)',
                      color:      filtroEstado === e ? estadoColor(e)       : '#475569',
                      border:    `1px solid ${filtroEstado === e ? estadoColor(e)+'44' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                    {e.replace('_',' ')}
                  </button>
                ))}
                {empresasAgente.length > 1 && (
                  <select value={filtroEmpresaId}
                    onChange={e => { setFiltroEmpresaId(e.target.value); setFiltroProyectoId(''); }}
                    className="text-[9px] bg-transparent border border-white/10 rounded px-1.5 py-0.5 text-slate-400 cursor-pointer">
                    <option value="">Todas las empresas</option>
                    {empresasAgente.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                  </select>
                )}
                {proyectosAgente.length > 1 && (
                  <select value={filtroProyectoId} onChange={e => setFiltroProyectoId(e.target.value)}
                    className="text-[9px] bg-transparent border border-white/10 rounded px-1.5 py-0.5 text-slate-400 cursor-pointer">
                    <option value="">Todos los proyectos</option>
                    {proyectosAgente.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                )}
              </div>
            )}

            {selTareas.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Sin tareas registradas todavía.</p>
            ) : selTareasFiltradas.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No hay tareas con estos filtros.</p>
            ) : (
              <div className="space-y-2">
                {selTareasVisibles.map(t => {
                  const steps      = t.plan_ejecucion ? parsePlanSteps(t.plan_ejecucion) : [];
                  const logCount   = bitacora.filter(b => b.tarea_id === t.id).length;
                  const total      = steps.length || logCount;
                  const finalizando = t.estado === 'en_progreso' && total > 0 && logCount >= total;
                  const doneCount  = t.estado === 'completada' ? total : Math.min(logCount, finalizando ? total - 1 : total);
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
                      <div className="flex items-start gap-3 p-3">
                        <span className="mt-1.5 w-2 h-2 rounded-full shrink-0 flex-none" style={{
                          background: t.estado === 'completada' ? '#22c55e' : t.estado === 'en_progreso' ? '#3b82f6' : (t.notas && /^error/i.test(t.notas) ? '#ef4444' : '#eab308'),
                        }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-200 leading-snug">{t.descripcion}</p>
                          {t.proyecto?.nombre && (
                            <p className="text-[9px] text-slate-600 mt-0.5 truncate">
                              {t.proyecto.empresa?.nombre && <span className="text-slate-700">{t.proyecto.empresa.nombre} · </span>}
                              {t.proyecto.nombre}
                            </p>
                          )}
                          <div className="flex items-center flex-wrap gap-2 mt-0.5">
                            <p className="text-[10px] capitalize font-medium" style={{
                              color: t.estado === 'completada' ? '#22c55e' : t.estado === 'en_progreso' ? '#3b82f6' : (t.notas && /^error/i.test(t.notas) ? '#ef4444' : '#eab308'),
                            }}>{t.estado.replace('_',' ')}</p>
                            {total > 0 && (
                              <span className="text-[9px]">
                                <span style={{ color:'#22c55e' }}>✓ {doneCount}</span>
                                {finalizando
                                  ? <span style={{ color:'#60a5fa' }}> · ⏳ verificando último paso</span>
                                  : <><span className="text-slate-600"> · ⬜ {remaining}</span><span className="text-slate-700"> · {total} {steps.length > 0 ? 'pasos' : 'acciones'}</span></>
                                }
                              </span>
                            )}
                            {t.estado === 'en_progreso' && total > 0 && !finalizando && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ background:`${selCfg.color}25`, color:selCfg.accent }}>
                                📍 paso {Math.min(doneCount + 1, total)}/{total}
                              </span>
                            )}
                            {finalizando && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                                style={{ background:'rgba(96,165,250,0.15)', color:'#60a5fa' }}>
                                📍 paso {total}/{total}
                              </span>
                            )}
                          </div>
                          {t.estado === 'en_progreso' && (() => {
                            const cmds = extraerComandosSSH(bitacora, t.id).filter(b => b.accion.startsWith('🖥️'));
                            const ultimo = cmds[cmds.length - 1];
                            if (!ultimo) return null;
                            const cmd = ultimo.accion.replace(/^🖥️\s*SSH\s*\[[^\]]+\]:\s*/, '');
                            return (
                              <p className="text-[9px] font-mono mt-1 truncate" style={{ color:'#4ade80', opacity:0.7 }}>
                                $ {cmd.slice(0, 80)}{cmd.length > 80 ? '…' : ''}
                              </p>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {(t.estado === 'pendiente' || t.estado === 'cancelada' || t.estado === 'en_progreso') && (
                            <button
                              disabled={ejecutandoId === t.id}
                              onClick={async (e) => {
                                e.stopPropagation();
                                setEjecutandoId(t.id);
                                await ejecutarTareaAPI(t.id, t.estado === 'en_progreso');
                                setTimeout(() => setEjecutandoId(null), 3000);
                              }}
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md transition-opacity"
                              style={{
                                background: t.estado === 'en_progreso' ? 'rgba(59,130,246,0.15)' : 'rgba(234,179,8,0.15)',
                                color:      t.estado === 'en_progreso' ? '#60a5fa' : '#eab308',
                                border:     t.estado === 'en_progreso' ? '1px solid rgba(59,130,246,0.3)' : '1px solid rgba(234,179,8,0.3)',
                                opacity: ejecutandoId === t.id ? 0.5 : 1,
                              }}
                              title={t.estado === 'en_progreso' ? 'Reiniciar tarea' : 'Ejecutar tarea ahora'}>
                              {ejecutandoId === t.id ? '⏳' : t.estado === 'en_progreso' ? '⟳' : '▶'}
                            </button>
                          )}
                          <span className="text-slate-600 text-xs mt-0.5">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-3 pb-3">
                          <div className="flex items-center gap-1.5 mb-3 flex-wrap" onClick={e => e.stopPropagation()}>
                            <span className="text-[9px] text-slate-600 font-semibold uppercase tracking-wider">Mover a:</span>
                            {([
                              { estado: 'pendiente',   label: 'Pendiente',   color: '#eab308' },
                              { estado: 'en_progreso', label: 'En progreso', color: '#3b82f6' },
                              { estado: 'completada',  label: 'Completada',  color: '#22c55e' },
                              { estado: 'cancelada',   label: 'Cancelada',   color: '#64748b' },
                            ] as const).filter(s => s.estado !== t.estado).map(s => (
                              <button key={s.estado}
                                disabled={cambioEstadoId === t.id}
                                onClick={async () => {
                                  setCambioEstadoId(t.id);
                                  await cambiarEstadoTareaAPI(t.id, s.estado);
                                  setCambioEstadoId(null);
                                }}
                                className="text-[9px] font-semibold px-2 py-0.5 rounded-md transition-opacity"
                                style={{ background:`${s.color}18`, color:s.color, border:`1px solid ${s.color}35`, opacity: cambioEstadoId === t.id ? 0.4 : 1 }}>
                                {cambioEstadoId === t.id ? '…' : s.label}
                              </button>
                            ))}
                          </div>
                          {t.notas && (
                            <p className="text-[10px] text-slate-400 mb-2 leading-snug italic border-l-2 pl-2" style={{ borderColor:`${selCfg.color}40` }}>
                              {t.notas}
                            </p>
                          )}
                          {steps.length > 0 && (
                            <div className="space-y-0.5">
                              {steps.map((step, i) => {
                                const isCompleted = t.estado === 'completada';
                                const isActive    = t.estado === 'en_progreso';
                                const stepDone    = isCompleted || (doneCount > 0 && i < doneCount);
                                const stepActive  = (isActive && i === Math.min(doneCount, steps.length - 1)) || (finalizando && i === steps.length - 1);
                                return (
                                  <div key={i} className="rounded-lg px-1.5 py-1" style={{
                                    background: stepActive ? `${selCfg.color}08` : 'transparent',
                                    border: stepActive ? `1px solid ${selCfg.color}20` : '1px solid transparent',
                                  }}>
                                    <div className="flex items-start gap-1.5">
                                      <span className="mt-0.5 shrink-0" style={{ fontSize:10 }}>
                                        {stepDone ? '✅' : stepActive ? '🔵' : '⚪'}
                                      </span>
                                      <p className="text-[10px] leading-snug font-medium" style={{
                                        color: stepDone ? '#86efac' : stepActive ? selCfg.accent : '#475569',
                                        textDecoration: stepDone ? 'line-through' : 'none',
                                      }}>{step}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {(() => {
                            const allSSH = bitacora
                              .filter(b => b.tarea_id === t.id)
                              .filter(b => b.accion.startsWith('🖥️') || b.accion.startsWith('📤'));
                            if (allSSH.length === 0) return null;
                            const total = allSSH.length;
                            const newestIsPending = allSSH[0]?.accion.startsWith('🖥️') ?? false;
                            return (
                              <div className="mt-3">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color:`${selCfg.color}55` }}>
                                    Comandos SSH
                                  </p>
                                  <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background:'rgba(255,255,255,0.05)', color:'#475569' }}>
                                    {total}
                                  </span>
                                  {newestIsPending && (
                                    <span className="ml-auto text-[8px] font-bold text-blue-400 animate-pulse">
                                      ⏳ esperando respuesta
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-0.5 max-h-56 overflow-y-auto">
                                  {allSSH.map((b, i) => {
                                    const isCmd     = b.accion.startsWith('🖥️');
                                    const isPending = i === 0 && newestIsPending;
                                    const num       = total - i;
                                    const txt       = isCmd
                                      ? b.accion.replace(/^🖥️\s*SSH\s*\[[^\]]+\]:\s*/, '')
                                      : b.accion.replace(/^📤\s*SSH resultado \(exit [^)]+\):\s*/, '');
                                    const ts = new Date(b.creado_en).toLocaleString('es-MX', {
                                      month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit',
                                    });
                                    const exitMatch = !isCmd ? b.accion.match(/exit (\d+)/) : null;
                                    const exitCode  = exitMatch ? exitMatch[1] : null;
                                    const isError   = exitCode != null && exitCode !== '0';
                                    return (
                                      <div key={b.id} className="rounded-lg px-2 py-1.5" style={{
                                        background: isPending ? 'rgba(59,130,246,0.1)' : isError ? 'rgba(239,68,68,0.07)' : isCmd ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.22)',
                                        border: isPending ? '1px solid rgba(59,130,246,0.3)' : isError ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent',
                                      }}>
                                        <div className="flex items-center gap-2 mb-0.5">
                                          <span className="text-[7px] font-bold font-mono shrink-0" style={{ color:'#374151', opacity:0.65 }}>#{num}</span>
                                          <span className="text-[7px] shrink-0 tabular-nums" style={{ color:'#374151' }}>{ts}</span>
                                          {isPending && <span className="ml-auto text-[7px] font-bold text-blue-400 animate-pulse">⏳ aguardando…</span>}
                                          {isError   && <span className="ml-auto text-[7px] font-bold text-red-400">✗ exit {exitCode}</span>}
                                          {!isPending && !isError && exitCode === '0' && <span className="ml-auto text-[7px] font-semibold text-green-500 opacity-60">✓ ok</span>}
                                        </div>
                                        <p className="text-[8px] font-mono break-all leading-relaxed" style={{
                                          color: isPending ? '#60a5fa' : isCmd ? '#4ade80' : isError ? '#f87171' : '#475569',
                                        }}>
                                          {isCmd ? '$ ' : '  '}{txt.slice(0, 300)}{txt.length > 300 ? '…' : ''}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                          {steps.length === 0 && bitacora.filter(b => b.tarea_id === t.id).length > 0 && (() => {
                            const allEntries = bitacora.filter(b => b.tarea_id === t.id);
                            const allSSH2 = allEntries.filter(b => b.accion.startsWith('🖥️') || b.accion.startsWith('📤'));
                            const nonSSH   = allEntries.filter(b => !b.accion.startsWith('🖥️') && !b.accion.startsWith('📤'));
                            const newestIsPending2 = allSSH2[0]?.accion.startsWith('🖥️') ?? false;
                            const total2 = allSSH2.length;
                            return (
                              <div className="space-y-1">
                                {allSSH2.length > 0 && (
                                  <>
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color:`${selCfg.color}60` }}>Comandos SSH</p>
                                      <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background:'rgba(255,255,255,0.05)', color:'#475569' }}>{total2}</span>
                                      {newestIsPending2 && <span className="ml-auto text-[8px] font-bold text-blue-400 animate-pulse">⏳ esperando respuesta</span>}
                                    </div>
                                    <div className="space-y-0.5 max-h-56 overflow-y-auto">
                                      {allSSH2.map((b, i) => {
                                        const isCmd2     = b.accion.startsWith('🖥️');
                                        const isPending2 = i === 0 && newestIsPending2;
                                        const num2       = total2 - i;
                                        const txt2       = isCmd2
                                          ? b.accion.replace(/^🖥️\s*SSH\s*\[[^\]]+\]:\s*/, '')
                                          : b.accion.replace(/^📤\s*SSH resultado \(exit [^)]+\):\s*/, '');
                                        const ts2 = new Date(b.creado_en).toLocaleString('es-MX', {
                                          month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit',
                                        });
                                        const exitMatch2 = !isCmd2 ? b.accion.match(/exit (\d+)/) : null;
                                        const exitCode2  = exitMatch2 ? exitMatch2[1] : null;
                                        const isError2   = exitCode2 != null && exitCode2 !== '0';
                                        return (
                                          <div key={b.id} className="rounded-lg px-2 py-1.5" style={{
                                            background: isPending2 ? 'rgba(59,130,246,0.1)' : isError2 ? 'rgba(239,68,68,0.07)' : isCmd2 ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.22)',
                                            border: isPending2 ? '1px solid rgba(59,130,246,0.3)' : isError2 ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent',
                                          }}>
                                            <div className="flex items-center gap-2 mb-0.5">
                                              <span className="text-[7px] font-bold font-mono shrink-0" style={{ color:'#374151', opacity:0.65 }}>#{num2}</span>
                                              <span className="text-[7px] shrink-0 tabular-nums" style={{ color:'#374151' }}>{ts2}</span>
                                              {isPending2  && <span className="ml-auto text-[7px] font-bold text-blue-400 animate-pulse">⏳ aguardando…</span>}
                                              {isError2    && <span className="ml-auto text-[7px] font-bold text-red-400">✗ exit {exitCode2}</span>}
                                              {!isPending2 && !isError2 && exitCode2 === '0' && <span className="ml-auto text-[7px] font-semibold text-green-500 opacity-60">✓ ok</span>}
                                            </div>
                                            <p className="text-[8px] font-mono break-all leading-relaxed" style={{
                                              color: isPending2 ? '#60a5fa' : isCmd2 ? '#4ade80' : isError2 ? '#f87171' : '#475569',
                                            }}>
                                              {isCmd2 ? '$ ' : '  '}{txt2.slice(0, 300)}{txt2.length > 300 ? '…' : ''}
                                            </p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                                {nonSSH.length > 0 && (
                                  <>
                                    <p className="text-[9px] font-bold uppercase tracking-wider mt-2 mb-1" style={{ color:`${selCfg.color}60` }}>Actividad reciente</p>
                                    {nonSSH.slice(0, 12).map((b) => (
                                      <div key={b.id} className="rounded-lg px-2 py-1" style={{ background:'transparent' }}>
                                        <p className="text-[8px] break-all leading-relaxed" style={{ color:'#94a3b8' }}>
                                          {b.accion.slice(0, 200)}{b.accion.length > 200 ? '…' : ''}
                                        </p>
                                      </div>
                                    ))}
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          {steps.length === 0 && bitacora.filter(b => b.tarea_id === t.id).length === 0 && !t.notas && (
                            <p className="text-[10px] text-slate-600 italic">Sin detalles adicionales.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {hayMasTareas && (
                  <button onClick={() => setTareaPage(p => p + 5)}
                    className="w-full text-[10px] text-slate-500 hover:text-slate-300 py-2 rounded-xl transition-colors border border-white/5 mt-1">
                    Ver 5 más · {selTareasFiltradas.length - tareaPage} restantes
                  </button>
                )}
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
