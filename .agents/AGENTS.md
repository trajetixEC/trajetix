# WORKSPACE RULES & UX PROTOCOLS

## 🚀 PARTE I: SISTEMA DE COMPONENTES Y ESTADOS
1. **shadcn/ui**: Siempre usar componentes de shadcn.
2. **Loading Spinners**: Siempre muestra spinners shadcn (`Loader2` animado) en botones que se estén cargando al editar cosas, eliminar cosas, o enviar formularios.

## 🎨 PARTE II: FRONTEND Y EXPERIENCIA DE USUARIO (UX)
3. **Sistema de Diseño (Semantic Classes)**:
   No utilices colores arbitrarios. Utiliza exclusivamente las clases semánticas para compatibilidad en tema oscuro:
   - `primary`: Acciones principales.
   - `secondary`: Soporte y jerarquía.
   - `muted`: Ayuda, fondos sutiles y desactivados.
   - `accent`: Resaltados específicos.

## 🖼️ PARTE III: GESTIÓN DE ASSETS Y MULTIMEDIA
4. **Protocolo de Procesamiento Obligatorio (Regla WebP)**:
   Queda prohibido subir imágenes sin procesar.
   - Formato: Conversión obligatoria a `.webp`.
   - Límite: Máximo 2MB por archivo.
   - Compresión: Calidad entre 0.6 y 0.8.
   - Utilidad: Es obligatorio usar `lib/image-processor.ts` en el frontend.
