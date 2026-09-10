# dlx-portal — Portal Privado de Clientes | Despeja la X

Aplicación web privada de seguimiento de obras para los **clientes** del estudio
**Despeja la X**: siguen su proyecto fase a fase (de proyecto a obra hasta la entrega de
llaves), votan decisiones, consultan documentos y ven el diario de obra.

> **La gestión (consola del estudio) NO vive aquí**: se hace desde el módulo **Obras** de
> **dlx-admin** (`dlx-admin-main` → ruta `/obras`), integrado con los componentes y
> patrones del backoffice existente. Este portal es solo la cara del cliente.

Es una **app hermana** del resto del ecosistema DLX (`dlx-web`, `dlx-blog`, `dlx-admin`,
`dlx-calculator`): comparte el **mismo proyecto Firebase** (`despejalapp`), la misma marca
(Kanit + Montserrat, Jet/Saffron/White Smoke) y las mismas convenciones (Next.js 16,
Tailwind 4, React 19).

---

## 🚀 Stack tecnológico

* **Framework**: Next.js 16 (App Router, convención `proxy`) + TypeScript
* **Estilos**: Tailwind CSS v4 · componentes estilo shadcn locales (`src/components/ui`) · Kanit + Montserrat
* **Backend**: **Firebase** — Authentication, Firestore y Storage (proyecto compartido `despejalapp`)
* **Despliegue**: Vercel (igual que dlx-web)

> El portal arranca en **MODO DEMO** (datos simulados, sin tocar Firebase) mientras no
> haya configuración real. En `.env.local` ya está preparado el bloque REAL comentado:
> descoméntalo y añade las credenciales del Admin SDK para pasar a MODO REAL.

---

## 🧩 Modelo de datos (Firestore) — colecciones con prefijo `portal_`

⚠️ El proyecto Firebase es COMPARTIDO con las demás apps DLX. Para no chocar con las
colecciones existentes (`projects` del portfolio de dlx-web/dlx-admin, `users` y `results`
de la calculadora, `blog`, `web`), **todas las colecciones raíz del portal llevan el
prefijo `portal_`** (constantes en `src/lib/firebase/config.ts`):

```
portal_users/{uid}            rol (admin | client), nombre, email
portal_clients/{clientId}     ficha de cliente (incluye user_id que la enlaza al login)
portal_projects/{projectId}   proyecto (client_id, nombre, dirección, tipo, etapa, estado…)
  ├─ phases/{id}              las 10–11 fases del método
  ├─ decisions/{id}           decisiones / votos del cliente
  ├─ meetings/{id}            actas de reunión
  ├─ documents/{id}           planos, contratos, presupuestos…
  ├─ weeklyUpdates/{id}       partes semanales de obra (diario de obra)
  ├─ requests/{id}            solicitudes del cliente
  └─ photos/{id}              galería de fotos
```

En Storage, los archivos del portal viven bajo el prefijo **`portal/projects/{projectId}/...`**
(el portfolio de dlx-admin usa `projects/images/...`, sin conflicto).

---

## 🛠️ Puesta en marcha (paso a paso)

### 1. Activar los servicios que falten en el proyecto Firebase compartido
En [console.firebase.google.com](https://console.firebase.google.com/), proyecto
**despejalapp** (el mismo de la web principal):
1. **Authentication** → método **Correo electrónico/contraseña** (actívalo si no lo está).
2. **Firestore** y **Storage** ya están activos (los usan las otras apps).

### 2. Activar el MODO REAL en las variables de entorno
En `.env.local` (o en las Environment Variables de Vercel):
1. Comenta el bloque DEMO y descomenta el **bloque REAL** — ya viene rellenado con la
   configuración pública de `despejalapp` (la misma que usa dlx-admin/dlx-web).
2. Añade las credenciales del Admin SDK. **Dos formatos admitidos**:
   * `FIREBASE_SERVICE_ACCOUNT_KEY` = JSON completo de la cuenta de servicio
     (Configuración del proyecto > Cuentas de servicio > Generar nueva clave privada), o
   * `PRIVATE_KEY` + `CLIENT_EMAIL` — **el mismo formato que ya usa dlx-web**, por si
     quieres reutilizar exactamente las mismas variables del despliegue existente.
   Son secretos: nunca al repositorio (`.env*` está en `.gitignore`).

> Con cualquier `NEXT_PUBLIC_FIREBASE_PROJECT_ID` distinto de `your-project-id` la app
> entra en modo real. Mientras siga el placeholder, sigue en demo.

### 3. Publicar las reglas de seguridad — archivo canónico único
Las reglas de Firestore y Storage de TODO el ecosistema (incluidos los bloques `portal_*`
y `portal/projects/...` de este portal) viven en un único archivo canónico por servicio,
en el repo de la calculadora, que es el que tiene el `firebase.json` de despliegue:

* `dlx-calculator-main/firestore.rules` (+ `firestore.indexes.json`)
* `dlx-calculator-main/storage.rules`

Se despliegan desde ese repo: `firebase deploy --only firestore,storage`.
Los archivos `firestore.rules` / `storage.rules` de ESTE repo son solo punteros
(intencionadamente no desplegables) para que nadie pueda pisar las reglas compartidas.

### 4. Crear usuarios y asignar roles
1. **Cuenta del estudio (staff)**: asigna el custom claim `role: 'admin'` a la cuenta con
   la que el estudio entra en dlx-admin:
   `node --env-file=.env.local scripts/set-admin-claim.mjs estudio@despejalax.es admin`
   (tras asignarlo, cerrar sesión y volver a entrar para refrescar el token). Sin ese
   claim, la puerta de rol de dlx-admin no deja pasar y las reglas deniegan el acceso.
2. **Clientes**: no hace falta crearlos a mano. Desde dlx-admin → Obras → ficha de la
   obra → **"Invitar al portal"**: se crea su cuenta de Auth, se le asigna
   `role: 'client'`, se enlaza `portal_clients.user_id` y se genera el enlace para que
   fije su contraseña (el estudio se lo envía por su canal habitual).

### 5. Desplegar en Vercel
1. Conecta el repositorio en Vercel y añade TODAS las variables de entorno del paso 2.
2. **Deploy** y apunta el subdominio (p. ej. `portal.despejalax.es`).

---

## 🧪 Pruebas tras el despliegue
1. **Invitado**: entra a `/dashboard` sin sesión → te redirige a `/login`. La antigua
   ruta `/admin` redirige siempre a `/dashboard` (la consola vive en dlx-admin).
2. **Cliente**: inicia sesión con un correo de cliente → ves el timeline de TU proyecto.
3. **Estudio**: crea una obra/decisión/acta desde dlx-admin → Obras → comprueba que el
   cliente la ve al momento en su portal.
4. **Descargas**: abre un documento; la URL es una *signed URL* temporal generada en el
   servidor que caduca a los 60 segundos.

---

## ⚡ Subida de fotos sin sobrecostes
Las fotos de obra se suben desde **dlx-admin → Obras → pestaña Fotos**: cada imagen se
comprime en el navegador (Canvas → WebP, versión optimizada máx. 1600px + miniatura máx.
480px, sin metadatos EXIF) antes de subirse al Storage del portal.

---

## 📂 Organización
* Capa de datos Firebase: `src/lib/firebase/` (`config` — incluye las constantes
  `COL_USERS`/`COL_CLIENTS`/`COL_PROJECTS`/`STORAGE_ROOT` —, `client`, `admin`, `session`,
  `profile`, `db`, `phases`, `storage`, `middleware`).
* Protección de rutas: `src/proxy.ts` (convención `proxy` de Next 16).
* Server Actions: `src/app/admin/actions.ts` (solo admin) y `src/app/dashboard/actions.ts`
  (con validación de propiedad de cliente).
* Reglas de seguridad: canónicas en `dlx-calculator-main` (`firestore.rules`,
  `storage.rules`); en este repo solo hay punteros (ver paso 3).
* Estilos y marca (Jet `#333533`, Saffron `#EEBA0B`, White Smoke `#F5F3F4`, Kanit/Montserrat):
  `src/app/globals.css` y `src/app/layout.tsx`.

---

## 🔁 Historial de integración (jul 2026)
Esta app procede del prototipo "tu-hogar-despejado" y se integró en el ecosistema DLX con
estos cambios (el resto del código se conservó tal cual):
* Renombrada a `dlx-portal`; versiones alineadas con dlx-web (Next ~16.2.9, React 19.2,
  firebase 12, firebase-admin 14, Tailwind 4.3).
* Colecciones Firestore con prefijo `portal_` y Storage bajo `portal/` para convivir con
  los datos existentes del proyecto `despejalapp`.
* **La consola de administración se movió a dlx-admin como módulo "Obras"** (ruta
  `/obras`), reconstruida con TanStack Router + React Query + `@xabimedina/dlx-components`
  para reutilizar los componentes existentes del backoffice. Las rutas `/admin` de este
  portal se eliminaron y redirigen a `/dashboard`.
* Eliminada la dependencia runtime `shadcn` (su import de CSS era redundante con los
  tokens ya definidos en `globals.css`).
* Migración `middleware` → `proxy` (deprecación de Next 16).
* Admin SDK acepta también `PRIVATE_KEY`/`CLIENT_EMAIL` (formato dlx-web).
* `firebase.json` eliminado para evitar despliegues accidentales de reglas sobre el
  proyecto compartido.
