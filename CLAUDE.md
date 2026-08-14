# 🎨 PROTOCOLOS DE UX Y DISEÑO FRONTEND

Este documento define los estándares obligatorios de UX, diseño de interfaz y gestión de activos para todo desarrollo en el proyecto **Trajetix ERP**.

---

## 🚀 PARTE I: SISTEMA DE COMPONENTES Y ESTADOS

### 1. Componentes Base
- Siempre usar componentes de **shadcn/ui** para garantizar consistencia visual, accesibilidad e interactividad.

### 2. Estados de Carga e Interactividad (Loading Spinners)
- Es **obligatorio** mostrar spinners de carga (`Loader2` animado de `lucide-react` / `shadcn`) dentro de los botones durante operaciones asíncronas:
  - Al guardar / enviar formularios.
  - Al editar registros.
  - Al eliminar / desactivar registros.
  - Al realizar peticiones a la API o cargar datos.

---

## 🎨 PARTE II: FRONTEND Y EXPERIENCIA DE USUARIO (UX)

### 3. Sistema de Diseño (Semantic Classes)
No utilices colores arbitrarios ni clases de colores personalizados. Utiliza exclusivamente las clases semánticas para garantizar compatibilidad automática en tema claro y tema oscuro:
- **`primary`**: Acciones principales y elementos destacados.
- **`secondary`**: Soporte y jerarquía.
- **`muted`**: Ayuda, subtítulos, fondos sutiles y elementos desactivados.
- **`accent`**: Resaltados específicos y estados hover.
- **`destructive`**: Acciones de eliminación o eliminación crítica.

### 4. Iconografía Estandarizada
- No usar emojis en botones o elementos interactivos.
- Usar exclusivamente iconos de **Lucide React**.
- Para acciones en tarjetas o listas (ej. editar, eliminar), mostrar solo los iconos sin texto.

---

## 🖼️ PARTE III: GESTIÓN DE ASSETS Y MULTIMEDIA

### 5. Protocolo de Procesamiento Obligatorio (Regla WebP)
Queda prohibido subir imágenes sin procesar.
1. **Formato**: Conversión obligatoria a **`.webp`**.
2. **Límite**: Máximo **2MB** por archivo.
3. **Compresión**: Calidad entre 0.6 y 0.8.
4. **Utilidad**: Es obligatorio usar `lib/image-processor.ts` en el frontend antes de enviar cualquier activo al servidor.
