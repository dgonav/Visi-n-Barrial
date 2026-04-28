# Visión Barrial – Plataforma Ciudadana de Gestión de Incidencias

**Visión Barrial** es una aplicación web diseñada para empoderar a las comunidades, permitiendo a los ciudadanos reportar, hacer seguimiento y colaborar en la resolución de problemas en sus barrios de manera eficiente y transparente.

## 📋 Descripción

Esta plataforma facilita la comunicación entre los vecinos y las entidades responsables, centralizando el reporte de incidentes comunes como baches en la vía, fallas en el alumbrado público, problemas de recolección de basura y más. El sistema permite una trazabilidad completa desde que se crea el reporte hasta su resolución final.

## ✨ Características Principales

### 🔐 Gestión de Usuarios (RF-001)
- **Registro Seguro**: Creación de cuentas con validación de fortaleza de contraseña.
- **Acceso Protegido**: Inicio de sesión con cifrado SHA-256 para mayor seguridad.
- **Recuperación de Cuenta**: Proceso simulado de recuperación de contraseña vía correo.
- **Guardia de Sesión**: Protección de rutas para asegurar que solo usuarios autenticados accedan al panel.

### 📋 Reporte de Incidencias (CAS002)
- **Categorización**: Clasificación por tipos (Infraestructura, Alumbrado, Seguridad, etc.).
- **Geolocalización**: Opción de capturar la ubicación actual mediante GPS o ingreso manual.
- **Evidencia Multimedia**: Soporte para adjuntar imágenes (JPG/PNG) o documentos PDF.
- **Validaciones en Tiempo Real**: Control de longitud de descripción y formatos de archivos.

### 🔍 Seguimiento y Trazabilidad (CAS003 / CAS005)
- **Panel de Control (Dashboard)**: Resumen estadístico de reportes pendientes, en atención y resueltos.
- **Búsqueda y Filtros**: Filtrado avanzado por estado, rango de fechas y número de reporte.
- **Detalle del Caso**: Historial completo y estado actual de cada incidencia reportada.

## 🛠️ Tecnologías Utilizadas

- **Frontend**: HTML5 Semántico, CSS3 Moderno (Variables, Flexbox, Grid).
- **Lógica**: JavaScript Vanilla (ES6+).
- **Seguridad**: Implementación de SHA-256 para hashing de credenciales.
- **Almacenamiento**: `localStorage` para persistencia de datos y `sessionStorage` para gestión de sesiones.
- **Tipografía**: [Inter](https://fonts.google.com/specimen/Inter) vía Google Fonts.

## 📂 Estructura del Proyecto

```text
Vision barrial/
├── index.html        # Página de acceso (Login/Registro/Recuperación)
├── app.html          # Panel principal de la aplicación (Dashboard/Formularios)
├── auth.js           # Lógica de autenticación y validaciones de usuario
├── app.js            # Lógica central de gestión de incidencias y vistas
├── style.css         # Estilos generales del dashboard y componentes
├── auth.css          # Estilos específicos para el flujo de autenticación
└── Marco de requerimientos V3.pdf # Documentación técnica del proyecto
```

## 🚀 Instalación y Uso

1. **Clonar o descargar** el repositorio en tu máquina local.
2. Abre el archivo `index.html` en cualquier navegador web moderno (Chrome, Edge, Firefox, Safari).
3. **Registro**: Crea una cuenta nueva en la pestaña "Registrarse".
4. **Login**: Inicia sesión con tus credenciales.
5. **Reportar**: Dirígete a "Reportar Problema" para crear tu primera incidencia.
6. **Seguimiento**: Consulta el estado de tus reportes en la sección "Mis Reportes".

## 🛡️ Notas de Seguridad
*Actualmente, el sistema utiliza `localStorage` para la persistencia de datos con fines demostrativos y de prototipado. En un entorno de producción, se recomienda la integración con una base de datos robusta y un backend seguro.*

---
Desarrollado para mejorar la convivencia y el entorno urbano. 🏘️✨
