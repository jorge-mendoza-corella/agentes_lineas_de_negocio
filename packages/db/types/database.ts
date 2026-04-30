export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agentes: {
        Row: {
          area_negocio_id: string | null
          creado_en: string
          descripcion_breve: string | null
          es_transversal: boolean
          id: string
          nombre: string
          rol: string
          tags: string[]
        }
        Insert: {
          area_negocio_id?: string | null
          creado_en?: string
          descripcion_breve?: string | null
          es_transversal?: boolean
          id?: string
          nombre: string
          rol: string
          tags?: string[]
        }
        Update: {
          area_negocio_id?: string | null
          creado_en?: string
          descripcion_breve?: string | null
          es_transversal?: boolean
          id?: string
          nombre?: string
          rol?: string
          tags?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "agentes_area_negocio_id_fkey"
            columns: ["area_negocio_id"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      aprobaciones: {
        Row: {
          comentarios: string | null
          created_at: string
          decision: string
          id: string
          solicitud_id: string
          stakeholder_id: string
        }
        Insert: {
          comentarios?: string | null
          created_at?: string
          decision: string
          id?: string
          solicitud_id: string
          stakeholder_id: string
        }
        Update: {
          comentarios?: string | null
          created_at?: string
          decision?: string
          id?: string
          solicitud_id?: string
          stakeholder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aprobaciones_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes_aprobacion"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aprobaciones_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      areas_negocio: {
        Row: {
          actualizado_en: string
          creado_en: string
          descripcion: string | null
          es_servicio: boolean
          id: string
          nombre: string
          pm_agente: string | null
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          descripcion?: string | null
          es_servicio?: boolean
          id?: string
          nombre: string
          pm_agente?: string | null
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          descripcion?: string | null
          es_servicio?: boolean
          id?: string
          nombre?: string
          pm_agente?: string | null
        }
        Relationships: []
      }
      avatares: {
        Row: {
          actualizado_en: string
          agente_nombre: string | null
          estado_animacion: string
          id: string
          nombre_mostrar: string
          oficina_id: string | null
          posicion_actual_x: number | null
          posicion_actual_y: number | null
          sprite_url: string | null
          stakeholder_id: string | null
          tipo: string
        }
        Insert: {
          actualizado_en?: string
          agente_nombre?: string | null
          estado_animacion?: string
          id?: string
          nombre_mostrar: string
          oficina_id?: string | null
          posicion_actual_x?: number | null
          posicion_actual_y?: number | null
          sprite_url?: string | null
          stakeholder_id?: string | null
          tipo: string
        }
        Update: {
          actualizado_en?: string
          agente_nombre?: string | null
          estado_animacion?: string
          id?: string
          nombre_mostrar?: string
          oficina_id?: string | null
          posicion_actual_x?: number | null
          posicion_actual_y?: number | null
          sprite_url?: string | null
          stakeholder_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatares_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatares_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      bitacora_actividad: {
        Row: {
          accion: string
          agente: string
          creado_en: string
          id: string
          payload: Json | null
          proyecto_id: string | null
          requerimiento_id: string | null
          tarea_id: string | null
        }
        Insert: {
          accion: string
          agente: string
          creado_en?: string
          id?: string
          payload?: Json | null
          proyecto_id?: string | null
          requerimiento_id?: string | null
          tarea_id?: string | null
        }
        Update: {
          accion?: string
          agente?: string
          creado_en?: string
          id?: string
          payload?: Json | null
          proyecto_id?: string | null
          requerimiento_id?: string | null
          tarea_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_actividad_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bitacora_actividad_requerimiento_id_fkey"
            columns: ["requerimiento_id"]
            isOneToOne: false
            referencedRelation: "requerimientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bitacora_actividad_tarea_id_fkey"
            columns: ["tarea_id"]
            isOneToOne: false
            referencedRelation: "tareas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversaciones_pm: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          proyecto_id: string | null
          titulo: string | null
          updated_at: string
          usuario_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          proyecto_id?: string | null
          titulo?: string | null
          updated_at?: string
          usuario_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          proyecto_id?: string | null
          titulo?: string | null
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversaciones_pm_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_pm_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversaciones_pm_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizacion_lineas: {
        Row: {
          agente_nombre: string
          cotizacion_id: string
          created_at: string
          descripcion: string
          horas: number
          id: string
          orden: number
          precio_hora: number
          subtotal: number | null
          tarea_id: string | null
        }
        Insert: {
          agente_nombre: string
          cotizacion_id: string
          created_at?: string
          descripcion: string
          horas?: number
          id?: string
          orden?: number
          precio_hora?: number
          subtotal?: number | null
          tarea_id?: string | null
        }
        Update: {
          agente_nombre?: string
          cotizacion_id?: string
          created_at?: string
          descripcion?: string
          horas?: number
          id?: string
          orden?: number
          precio_hora?: number
          subtotal?: number | null
          tarea_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotizacion_lineas_cotizacion_id_fkey"
            columns: ["cotizacion_id"]
            isOneToOne: false
            referencedRelation: "cotizaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizacion_lineas_tarea_id_fkey"
            columns: ["tarea_id"]
            isOneToOne: false
            referencedRelation: "tareas"
            referencedColumns: ["id"]
          },
        ]
      }
      cotizaciones: {
        Row: {
          created_at: string
          descuento_pct: number
          empresa_id: string | null
          estado: string
          folio: string | null
          generada_por: string | null
          id: string
          moneda: string
          notas: string | null
          proyecto_id: string | null
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          descuento_pct?: number
          empresa_id?: string | null
          estado?: string
          folio?: string | null
          generada_por?: string | null
          id?: string
          moneda?: string
          notas?: string | null
          proyecto_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          descuento_pct?: number
          empresa_id?: string | null
          estado?: string
          folio?: string | null
          generada_por?: string | null
          id?: string
          moneda?: string
          notas?: string | null
          proyecto_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotizaciones_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_generada_por_fkey"
            columns: ["generada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotizaciones_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_agente_tarifas: {
        Row: {
          agente_nombre: string
          empresa_id: string
          tarifa_hora: number
        }
        Insert: {
          agente_nombre: string
          empresa_id: string
          tarifa_hora: number
        }
        Update: {
          agente_nombre?: string
          empresa_id?: string
          tarifa_hora?: number
        }
        Relationships: [
          {
            foreignKeyName: "empresa_agente_tarifas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_contratos: {
        Row: {
          activo: boolean | null
          creado_en: string | null
          empresa_id: string
          id: string
          servicio_id: string
        }
        Insert: {
          activo?: boolean | null
          creado_en?: string | null
          empresa_id: string
          id?: string
          servicio_id: string
        }
        Update: {
          activo?: boolean | null
          creado_en?: string | null
          empresa_id?: string
          id?: string
          servicio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_contratos_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_modulos: {
        Row: {
          id: string
          nombre: string
          descripcion: string | null
          icono: string | null
          activo: boolean
          orden: number
          creado_en: string
        }
        Insert: {
          id?: string
          nombre: string
          descripcion?: string | null
          icono?: string | null
          activo?: boolean
          orden?: number
          creado_en?: string
        }
        Update: {
          nombre?: string
          descripcion?: string | null
          icono?: string | null
          activo?: boolean
          orden?: number
        }
        Relationships: []
      }
      empresa_servicios: {
        Row: {
          activo: boolean
          created_at: string
          empresa_id: string
          id: string
          modulo_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          modulo_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          modulo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empresa_servicios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empresa_servicios_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "catalogo_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      modulo_servicios: {
        Row: {
          modulo_id: string
          servicio_id: string
        }
        Insert: {
          modulo_id: string
          servicio_id: string
        }
        Update: {
          modulo_id?: string
          servicio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modulo_servicios_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "catalogo_modulos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modulo_servicios_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          activa: boolean
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          slug: string
          updated_at: string
        }
        Insert: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          slug: string
          updated_at?: string
        }
        Update: {
          activa?: boolean
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      mensajes_pm: {
        Row: {
          contenido: string
          conversacion_id: string
          created_at: string
          id: string
          metadata: Json | null
          rol: string
        }
        Insert: {
          contenido: string
          conversacion_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          rol: string
        }
        Update: {
          contenido?: string
          conversacion_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          rol?: string
        }
        Relationships: []
      }
      oficinas: {
        Row: {
          alto: number
          ancho: number
          area_negocio_id: string | null
          color_hex: string | null
          id: string
          nombre: string
          piso: number
          posicion_x: number | null
          posicion_y: number | null
        }
        Insert: {
          alto?: number
          ancho?: number
          area_negocio_id?: string | null
          color_hex?: string | null
          id?: string
          nombre: string
          piso: number
          posicion_x?: number | null
          posicion_y?: number | null
        }
        Update: {
          alto?: number
          ancho?: number
          area_negocio_id?: string | null
          color_hex?: string | null
          id?: string
          nombre?: string
          piso?: number
          posicion_x?: number | null
          posicion_y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "oficinas_area_negocio_id_fkey"
            columns: ["area_negocio_id"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          created_at: string
          email: string
          empresa_id: string | null
          id: string
          nombre: string
          rol: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          empresa_id?: string | null
          id: string
          nombre: string
          rol?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          empresa_id?: string | null
          id?: string
          nombre?: string
          rol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_decisiones: {
        Row: {
          consecuencias: string | null
          contexto: string | null
          creado_en: string
          decision: string
          estado: string
          id: string
          proyecto_id: string
          titulo: string
        }
        Insert: {
          consecuencias?: string | null
          contexto?: string | null
          creado_en?: string
          decision: string
          estado?: string
          id?: string
          proyecto_id: string
          titulo: string
        }
        Update: {
          consecuencias?: string | null
          contexto?: string | null
          creado_en?: string
          decision?: string
          estado?: string
          id?: string
          proyecto_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_decisiones_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_stack: {
        Row: {
          capa: string
          id: string
          notas: string | null
          proyecto_id: string
          tecnologia: string
        }
        Insert: {
          capa: string
          id?: string
          notas?: string | null
          proyecto_id: string
          tecnologia: string
        }
        Update: {
          capa?: string
          id?: string
          notas?: string | null
          proyecto_id?: string
          tecnologia?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_stack_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_stakeholders: {
        Row: {
          proyecto_id: string
          rol: string
          stakeholder_id: string
        }
        Insert: {
          proyecto_id: string
          rol: string
          stakeholder_id: string
        }
        Update: {
          proyecto_id?: string
          rol?: string
          stakeholder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proyecto_stakeholders_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyecto_stakeholders_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      proyectos: {
        Row: {
          actualizado_en: string
          area_negocio_id: string | null
          creado_en: string
          descripcion: string | null
          empresa_id: string | null
          estado: string
          id: string
          nombre: string
          rama_prefijo: string | null
          repo_url: string | null
          stakeholder_principal_id: string | null
        }
        Insert: {
          actualizado_en?: string
          area_negocio_id?: string | null
          creado_en?: string
          descripcion?: string | null
          empresa_id?: string | null
          estado?: string
          id?: string
          nombre: string
          rama_prefijo?: string | null
          repo_url?: string | null
          stakeholder_principal_id?: string | null
        }
        Update: {
          actualizado_en?: string
          area_negocio_id?: string | null
          creado_en?: string
          descripcion?: string | null
          empresa_id?: string | null
          estado?: string
          id?: string
          nombre?: string
          rama_prefijo?: string | null
          repo_url?: string | null
          stakeholder_principal_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proyectos_area_negocio_id_fkey"
            columns: ["area_negocio_id"]
            isOneToOne: false
            referencedRelation: "areas_negocio"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proyectos_stakeholder_principal_id_fkey"
            columns: ["stakeholder_principal_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      requerimientos: {
        Row: {
          actualizado_en: string
          creado_en: string
          descripcion: string | null
          estado: string
          id: string
          prioridad: string
          proyecto_id: string
          solicitado_por: string | null
          titulo: string
        }
        Insert: {
          actualizado_en?: string
          creado_en?: string
          descripcion?: string | null
          estado?: string
          id?: string
          prioridad?: string
          proyecto_id: string
          solicitado_por?: string | null
          titulo: string
        }
        Update: {
          actualizado_en?: string
          creado_en?: string
          descripcion?: string | null
          estado?: string
          id?: string
          prioridad?: string
          proyecto_id?: string
          solicitado_por?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "requerimientos_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requerimientos_solicitado_por_fkey"
            columns: ["solicitado_por"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      servicio_agentes: {
        Row: {
          agente_nombre: string
          servicio_id: string
          tarifa_hora: number | null
        }
        Insert: {
          agente_nombre: string
          servicio_id: string
          tarifa_hora?: number | null
        }
        Update: {
          agente_nombre?: string
          servicio_id?: string
          tarifa_hora?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "servicio_agentes_servicio_id_fkey"
            columns: ["servicio_id"]
            isOneToOne: false
            referencedRelation: "servicios"
            referencedColumns: ["id"]
          },
        ]
      }
      servicios: {
        Row: {
          activo: boolean | null
          creado_en: string | null
          descripcion: string | null
          icono: string | null
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean | null
          creado_en?: string | null
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean | null
          creado_en?: string | null
          descripcion?: string | null
          icono?: string | null
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      solicitudes_aprobacion: {
        Row: {
          area: string
          created_at: string
          descripcion: string
          empresa_id: string | null
          estado: string
          id: string
          plan_detallado: Json
          stakeholder_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          area: string
          created_at?: string
          descripcion: string
          empresa_id?: string | null
          estado?: string
          id?: string
          plan_detallado?: Json
          stakeholder_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          descripcion?: string
          empresa_id?: string | null
          estado?: string
          id?: string
          plan_detallado?: Json
          stakeholder_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_aprobacion_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_aprobacion_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholder_areas: {
        Row: {
          area: string
          created_at: string
          id: string
          stakeholder_id: string
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          stakeholder_id: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          stakeholder_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholder_areas_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          creado_en: string
          email: string | null
          es_principal: boolean
          id: string
          nombre: string
          rol: string | null
        }
        Insert: {
          creado_en?: string
          email?: string | null
          es_principal?: boolean
          id?: string
          nombre: string
          rol?: string | null
        }
        Update: {
          creado_en?: string
          email?: string | null
          es_principal?: boolean
          id?: string
          nombre?: string
          rol?: string | null
        }
        Relationships: []
      }
      tareas: {
        Row: {
          agente_asignado: string
          completado_en: string | null
          creado_en: string
          descripcion: string
          estado: string
          id: string
          iniciado_en: string | null
          notas: string | null
          plan_ejecucion: string | null
          proyecto_id: string | null
          rama: string | null
          requerimiento_id: string | null
        }
        Insert: {
          agente_asignado: string
          completado_en?: string | null
          creado_en?: string
          descripcion: string
          estado?: string
          id?: string
          iniciado_en?: string | null
          notas?: string | null
          plan_ejecucion?: string | null
          proyecto_id?: string | null
          rama?: string | null
          requerimiento_id?: string | null
        }
        Update: {
          agente_asignado?: string
          completado_en?: string | null
          creado_en?: string
          descripcion?: string
          estado?: string
          id?: string
          iniciado_en?: string | null
          notas?: string | null
          plan_ejecucion?: string | null
          proyecto_id?: string | null
          rama?: string | null
          requerimiento_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tareas_requerimiento_id_fkey"
            columns: ["requerimiento_id"]
            isOneToOne: false
            referencedRelation: "requerimientos"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas_agentes: {
        Row: {
          activo: boolean
          actualizado_en: string
          agente_nombre: string
          area: string
          creado_en: string
          display_name: string
          id: string
          moneda: string
          tarifa_hora: number
        }
        Insert: {
          activo?: boolean
          actualizado_en?: string
          agente_nombre: string
          area?: string
          creado_en?: string
          display_name: string
          id?: string
          moneda?: string
          tarifa_hora?: number
        }
        Update: {
          activo?: boolean
          actualizado_en?: string
          agente_nombre?: string
          area?: string
          creado_en?: string
          display_name?: string
          id?: string
          moneda?: string
          tarifa_hora?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      es_plataforma_admin: { Args: never; Returns: boolean }
      es_superadmin: { Args: never; Returns: boolean }
      mi_empresa_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
