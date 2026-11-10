# 🎬 GUÍA DE FLUJO DE PRESENTACIÓN EN VIVO: ZONAVIVA
## Demostración Orgánica, Secuencial e Interactiva del Software
### Proyecto: Red Social Geográfica Descentralizada (MVP v3.1)
### Asignatura: Lenguajes de Programación — Unidad 2

---

| Ficha de la Demostración | Detalle |
| :--- | :--- |
| **Audiencia** | Docente evaluador, compañeros de cátedra y público en general |
| **Tiempo Estimado Total** | **10 a 12 minutos** (ajustable a formato relámpago de 6 min) |
| **Formato del Flujo** | Narrativa secuencial guiada por la experiencia del usuario (User Journey) |
| **Objetivo Pedagógico** | Mostrar todas las vistas y funciones sin sobrecargar técnicamente al público |
| **Herramientas de Apoyo** | Proyector / Pantalla compartida + 2 navegadores (o pestañas incógnito para simular dos usuarios) |

---

## 🧭 Mapa de Ruta de la Presentación (De un Vistazo)

```
[ ACTO 1 ] ─────► [ ACTO 2 ] ─────► [ ACTO 3 ] ─────► [ ACTO 4 ] ─────► [ ACTO 5 ] ─────► [ ACTO 6 ]
Bienvenida        Mapa y Geo        Foro de Zona      Crear Foro        Chat Privado      Offline y
e Identidad       en Puno           en Tiempo Real    de Usuario        E2EE (SAS)        Ajustes
(1.5 min)         (2.0 min)         (2.5 min)         (1.5 min)         (2.5 min)         (1.5 min)
```

---

## ⏱️ Cronograma y Estructura por Actos

```
┌──────┬──────────────────────────────────────────┬──────────────┬──────────────────────────────┐
│ Acto │ Vista / Pantalla                         │ Duración     │ Efecto "Wow" a Destacar      │
├──────┼──────────────────────────────────────────┼──────────────┼──────────────────────────────┤
│ 1    │ Bienvenida e Identidad (/bienvenida)     │ 1.5 min      │ Identidad sin emails ni pass │
│ 2    │ Inicio y Mapa Interactivo (/)            │ 2.0 min      │ Radar GPS + Zonas OSM Puno   │
│ 3    │ Foro de Zona en Vivo (/foro/:id)         │ 2.5 min      │ Sellado canónico y Geofence  │
│ 4    │ Creación de Foro Temporal (/foros/nuevo) │ 1.5 min      │ Ámbito por celda y 24h N=0   │
│ 5    │ Chat Aleatorio y Contactos (/chat)       │ 2.5 min      │ Cifrado E2EE + Código SAS    │
│ 6    │ Resiliencia Offline y Ajustes (/ajustes) │ 1.5 min      │ IndexedDB + Cola de salida   │
│ C    │ Cierre, Métricas de Calidad y Preguntas  │ 1.0 min      │ 117 tests pasando al 100%    │
└──────┴──────────────────────────────────────────┴──────────────┴──────────────────────────────┘
```

---

## 🎭 Desarrollo Paso a Paso de la Demostración

---

### ACTO 1: El Primer Contacto — Identidad Soberana sin Registro
**Ruta en pantalla:** `/bienvenida` (`BienvenidaPage.tsx`)  
**Tiempo sugerido:** 1:30 min  
**Objetivo:** Romper el paradigma tradicional de las redes sociales corporativas (olvidarse de números de teléfono, nombres reales y contraseñas).

```
┌────────────────────────────────────────────────────────┐
│                   [======== 100% =======] (Paso 3 de 3)│
│                                                        │
│                     ✨ Tu Identidad                    │
│                                                        │
│           ┌────────────────────────────────┐           │
│           │ [ 👤 ]  Lobo-Silencioso-88     │  🎲 Nuevo │
│           └────────────────────────────────┘           │
│                                                        │
│      [X] Entiendo que mis datos viven en mi teléfono  │
│          y que no hay servidores centrales.            │
│                                                        │
│           ┌────────────────────────────────┐           │
│           │     COMENZAR EN ZONAVIVA       │           │
│           └────────────────────────────────┘           │
└────────────────────────────────────────────────────────┘
```

#### 🗣️ Qué decir al público (Narrativa):
> *"Cuando abrimos una red social tradicional, lo primero que nos piden es nuestro correo, número de teléfono y acceso a nuestros contactos. En ZonaViva el enfoque es opuesto:*
> 
> *A través de este onboarding guiado de tres pasos, le explicamos al usuario que está entrando a una red hiperlocal donde **la privacidad es por diseño**. No hay cuentas centrales ni formularios de registro.*
> 
> *En este último paso, el sistema genera automáticamente un alias amigable y temporal. Al presionar 'Comenzar', la aplicación utiliza la **WebCrypto API nativa** de su navegador para generar un par de claves criptográficas seguras (ECDSA P-256). Las credenciales se guardan de forma soberana en el dispositivo y jamás se envían a una base de datos central."*

#### 🖱️ Qué hacer en vivo:
1. Mostrar la barra de progreso en el paso 1 y 2 explicando brevemente las garantías de privacidad.
2. En el paso 3, presionar el botón del dado 🎲 para ver cómo se generan alias dinámicos aleatorios (ej. `Condor-Andino-14`).
3. Marcar el checkbox de soberanía y hacer clic en **"Comenzar en ZonaViva"**.
4. Señalar cómo la transición a la pantalla principal es instantánea y fluida.

---

### ACTO 2: El Tablero Territorial — Mapa de Puno y Geocercado
**Ruta en pantalla:** `/` (`InicioPage.tsx`, `ZoneMap.tsx`, `GeoStatusBadge.tsx`)  
**Tiempo sugerido:** 2:00 min  
**Objetivo:** Mostrar cómo el espacio físico de Puno cobra vida en el navegador sin comprometer la ubicación exacta del usuario.

```
┌────────────────────────────────────────────────────────┐
│ 📍 ZonaViva  [Puno MVP]         [👤 Lobo-88] [🟢 GPS]  │
├────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────┐ │
│ │ 🗺️ MAPA INTERACTIVO DE PUNO                        │ │
│ │  [🟢 En zona: Plaza Mayor · ±15m]  [🎯 Mí] [🌐 Todo]│ │
│ │                                                    │ │
│ │       [UNAP Campus] (Azul)                         │ │
│ │            [Mercado Bellavista] (Amarillo)         │ │
│ │       [Parque Pino] (Verde)                        │ │
│ │       [Plaza Mayor] (Violeta) <--- 👤 Tú aquí      │ │
│ │       [Mercado Central] (Naranja)                  │ │
│ │            [Mercado Unión] (Rosa)                  │ │
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ 📍 Plaza Mayor de Puno                                 │
│    Estás aquí (publicación habilitada · ±15m)          │
│                                                        │
│ ┌─────────────────────────┐  ┌───────────────────────┐ │
│ │ 💬 Entrar al Foro       │  │ ✨ Chat Aleatorio 1:1 │ │
│ └─────────────────────────┘  └───────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

#### 🗣️ Qué decir al público (Narrativa):
> *"Ya estamos en el inicio. Lo primero que salta a la vista es nuestro mapa interactivo de la ciudad de Puno. No son marcadores estáticos puestos a mano:*
> 
> *Hemos delimitado con precisión geodésica **6 zonas oficiales extraídas directamente de OpenStreetMap**: los mercados Central, Unión y Dignidad, y Bellavista; la Plaza Mayor, el Parque Pino y el campus universitario de la UNAP.*
> 
> *Fíjense en el badge superior: el radar detecta mi posición física con un halo pulsante. Pero aquí está la clave técnica de nuestra arquitectura:*
> ***Las coordenadas GPS exactas jamás salen del navegador**. La comprobación de pertenencia se calcula matemáticamente en el cliente usando una malla de celdas **Geohash de precisión 7 (~153 metros)**. El servidor únicamente se entera de que estoy en la Plaza Mayor, no de mis coordenadas milimétricas.*
> 
> *Noten el contraste: como estoy en la Plaza Mayor, la tarjeta está en verde y me indica **'Publicación habilitada'**. Si selecciono manualmente el Mercado Bellavista, el mapa se encuadra suavemente y pasa a modo violeta: **'Modo exploración (solo lectura)'**."*

#### 🖱️ Qué hacer en vivo:
1. Señalar la insignia `GeoStatusBadge` superior con el estado satelital.
2. Hacer clic en los botones flotantes del mapa: **"Ver todo Puno"** (encuadre completo) y luego en **"Centrar en mí"** (el mapa vuelve suavemente a la posición del usuario).
3. Seleccionar otra zona en la cuadrícula inferior para mostrar cómo el mapa viaja automáticamente y la tarjeta cambia de color a "Modo Exploración".
4. Volver a seleccionar la zona activa (o activar el simulador GPS en la Plaza Mayor) y pulsar **"Entrar al Foro"**.

---

### ACTO 3: La Plaza Pública — Mensajería en Tiempo Real y Sellado Canónico
**Ruta en pantalla:** `/foro/zone:plaza-mayor` (`ForoPage.tsx`)  
**Tiempo sugerido:** 2:30 min  
**Objetivo:** Demostrar cómo se conversa en tiempo real, el control de acceso geográfico y el sellado criptográfico que reemplaza a la base de datos central.

```
┌────────────────────────────────────────────────────────┐
│ ‹ Volver   🟣 Plaza Mayor de Puno          👥 8 [🟢 Sync]│
├────────────────────────────────────────────────────────┤
│                                                        │
│  [👤 Inti-Viajero] 10:14 AM                            │
│  Buenos días vecinos, ¿saben si hoy atienden en la     │
│  oficina de recaudación frente a la catedral?          │
│                                                        │
│                        [👤 Lobo-88 (Tú)] 10:15 AM      │
│                        Sí, acabo de pasar y está       │
│                        abierto con atención normal.    │
│                                                        │
├────────────────────────────────────────────────────────┤
│ [ Escribe un mensaje para esta zona...    ] [ 📤 Enviar]│
│  📍 Estás físicamente en la zona · Publicación habilitada│
└────────────────────────────────────────────────────────┘
```

#### 🗣️ Qué decir al público (Narrativa):
> *"Estamos dentro del foro de la Plaza Mayor. En la esquina superior vemos el contador de usuarios en vivo conectados a esta sala mediante WebSockets y el estado de sincronización.*
> 
> *Aquí resolvemos uno de los mayores desafíos de una red descentralizada: **¿Cómo evitamos que alguien inyecte mensajes falsos si no hay una base de datos central?***
> 
> *Cada vez que presiono 'Enviar', el mensaje viaja a nuestro servidor relay en Node.js. El relay asigna una marca de tiempo oficial (`relayTs`), calcula el hash del contenido y **estampa un sello digital con una firma ECDSA P-256**. El relay retransmite el mensaje a todos los conectados y se olvida de él; no guarda una sola línea en disco.*
> 
> *Todos los teléfonos receptores verifican la firma del relay antes de aceptar el mensaje en su base de datos local `IndexedDB`.*
> 
> *Y miren la regla de proximidad: si yo salgo de la zona o simulo estar fuera de Puno, el campo de texto se bloquea de inmediato mostrando: **'Solo lectura: debes estar físicamente aquí para opinar'**. Esto asegura que las alertas de tráfico o avisos provengan de testigos presenciales reales."*

#### 🖱️ Qué hacer en vivo:
1. Escribir un mensaje de prueba: *"Informando desde la Plaza Mayor: el clima está despejado y sin tráfico."* y presionar Enviar.
2. Si tienes dos pestañas abiertas (o una ventana de incógnito), mostrar cómo el mensaje aparece instantáneamente en el otro navegador.
3. Hacer clic sobre el avatar de otro autor en el foro: se despliega el modal `AuthorProfileModal` mostrando su alias y su huella pública criptográfica.
4. Simular temporalmente salir de la zona para mostrar al público cómo el input inferior se bloquea y se muestra el banner de "Solo lectura".

---

### ACTO 4: Soberanía Comunitaria — Creación de Foros de Usuario
**Ruta en pantalla:** `/foros` $\rightarrow$ `/foros/nuevo` (`CrearForoPage.tsx`, `UserForumsLayer.tsx`)  
**Tiempo sugerido:** 1:30 min  
**Objetivo:** Demostrar que los usuarios no dependen de administradores para crear comunidades locales y explicar la regla de extinción sin basura digital.

```
┌────────────────────────────────────────────────────────┐
│ ‹ Cancelar               Crear Foro Temporal           │
├────────────────────────────────────────────────────────┤
│ Nombre del Foro:                                       │
│ [ Feria Dominical de Libros en el Arco               ] │
│                                                        │
│ Descripción:                                           │
│ [ Trueque de libros universitarios e ingeniería      ] │
│                                                        │
│ Radio de Cobertura Física:                             │
│ ( ) 50 metros   - Local comercial                      │
│ ( ) 100 metros  - Cuadra inmediata                     │
│ (•) 200 metros  - Barrio / Plaza (Recomendado)         │
│ ( ) 500 metros  - Sector vecinal                       │
│ ( ) 1000 metros - Distrito / Campus extendido          │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │                FUNDAR FORO LOCAL                   │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

#### 🗣️ Qué decir al público (Narrativa):
> *"Las 6 zonas oficiales cubren los puntos neurálgicos de Puno, pero ¿qué ocurre si unos estudiantes quieren organizar un debate en su facultad o unos vecinos organizan una feria en su cuadra?*
> 
> *Para eso creamos los **Foros de Usuario**. Cualquier ciudadano presente en el lugar puede fundar un foro en segundos.
> 
> *Al crearlo, el foro se ancla a la celda Geohash donde se encuentra el usuario y este selecciona un **radio de influencia** desde 50 metros para un local comercial hasta 1,000 metros para un campus o sector amplio.*
> 
> *Y lo más fascinante es su **ciclo de vida biológico**: no creamos foros zombis que ensucian la plataforma. Si un foro de usuario pasa **24 horas consecutivas sin miembros conectados ($N=0$)**, el foro expira y se extingue automáticamente tanto en la memoria del relay como en los clientes."*

#### 🖱️ Qué hacer en vivo:
1. Ir a la pestaña **Foros** y pulsar el botón **"+ Crear Foro"**.
2. Escribir un nombre: *"Grupo de Estudio Lenguajes de Programación"*.
3. Seleccionar radio de 200 metros.
4. Hacer clic en **"Fundar Foro Local"** y mostrar cómo se redirige a la nueva sala y aparece disponible en la pestaña *"Cerca de mí"*.

---

### ACTO 5: Canales Privados — Chat Aleatorio 1 a 1 y Cifrado E2EE
**Ruta en pantalla:** `/chat` (`ChatPage.tsx`, `DirectConversationView.tsx`)  
**Tiempo sugerido:** 2:30 min  
**Objetivo:** Presentar la función más avanzada en criptografía: chat efímero espontáneo con cifrado extremo a extremo matemáticamente verificable.

```
┌────────────────────────────────────────────────────────┐
│ Centro de Mensajes                                     │
│ ┌────────────────────────────────────────────────────┐ │
│ │ [ ✨ Aleatorio ]   [ 👥 Contactos (1) ]  [ 📩 Solicitudes ]│
│ └────────────────────────────────────────────────────┘ │
│                                                        │
│ 🔒 CANAL CIFRADO EXTREMO A EXTREMO (E2EE)              │
│    Emparejado con: Anónimo #42                         │
│    Código de seguridad: [ 4 9 2 - 1 0 8 ]              │
│                                                        │
│  [👤 Anónimo #42]                                      │
│  Hola, ¿estás cerca de la biblioteca central?          │
│                                                        │
│                        [👤 Lobo-88 (Tú)]               │
│                        Sí, en las mesas del segundo    │
│                        piso repasando el proyecto.     │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ [ Escribe un mensaje cifrado...          ] [ 📤 ]  │ │
│ └────────────────────────────────────────────────────┘ │
│ [ 🚪 Salir ]   [ 🤝 Añadir a Contactos ]   [ ⏭️ Siguiente ]│
└────────────────────────────────────────────────────────┘
```

#### 🗣️ Qué decir al público (Narrativa):
> *"Pasamos al módulo de mensajería privada en `/chat`. Aquí tenemos dos modalidades: **Chat Aleatorio** y **Contactos Directos**.*
> 
> *En la pestaña Aleatorio, podemos buscar a otra persona que esté en nuestra misma zona física, como un 'Omegle hiperlocal'. Al hacer coincidir a dos usuarios:*
> 
> 1. *Ambos navegadores generan un par de claves efímeras usando **ECDH P-256** (Curvas Elípticas).*
> 2. *Intercambian claves públicas a través del relay y derivan una clave simétrica con **HKDF**.*
> 3. *Los mensajes se cifran con **AES-GCM de 256 bits**.*
> 
> *¿Qué ve el servidor relay? **Absolutamente nada, solo ceros y unos cifrados**.*
> 
> *Y presten atención a este detalle: en pantalla aparece un **Código de Verificación SAS de 6 dígitos** (ej. `492 108`). Si ambos usuarios comparan ese número y coincide, queda matemáticamente descartado que el relay o cualquier atacante esté interceptando la llamada (ataque Man-in-the-Middle).*
> 
> *Además, si nos cae bien el interlocutor, podemos presionar **'Añadir a Contactos'** para enviarle una solicitud y mantener una conversación directa permanente sin tener que darnos el número de WhatsApp ni redes personales."*

#### 🖱️ Qué hacer en vivo:
1. En la pestaña *Aleatorio*, pulsar **"Buscar Chat Aleatorio"**.
2. Mostrar en pantalla el emparejamiento y señalar el recuadro verde con el **Código de Seguridad de 6 dígitos**.
3. Enviar un mensaje de prueba para ilustrar la fluidez de la conversación cifrada.
4. Mostrar brevemente las pestañas contiguas: **"Contactos"** (donde residen las conversaciones privadas directas) y **"Solicitudes"** (para aprobar nuevos contactos).

---

### ACTO 6: Resiliencia y Soberanía — Modo Offline y Ajustes
**Ruta en pantalla:** `/ajustes` (`AjustesPage.tsx`) + Simulación Offline  
**Tiempo sugerido:** 1:30 min  
**Objetivo:** Demostrar la arquitectura Offline-First y el control total que el usuario tiene sobre sus datos locales.

```
┌────────────────────────────────────────────────────────┐
│ ⚙️ Ajustes y Privacidad                                │
├────────────────────────────────────────────────────────┤
│ 👤 Identidad Actual                                    │
│    Alias: Lobo-Silencioso-88         [ ✏️ Modificar ]  │
│    Clave Pública: ecdsa-p256:7fA9...3b1                │
│    [ 🔄 Generar Nuevas Claves Criptográficas ]         │
│                                                        │
│ 💾 Almacenamiento Local Soberano (IndexedDB)           │
│    Mensajes guardados: 142 mensajes                    │
│    Foros en caché: 4 foros                             │
│    Bandeja de salida: 0 pendientes                     │
│    Estado persistente: ✅ Concedido por el navegador   │
│                                                        │
│ 🚨 Zona de Peligro                                     │
│    [ 🗑️ Borrar Todos Mis Datos y Cerrar Sesión ]       │
└────────────────────────────────────────────────────────┘
```

#### 🗣️ Qué decir al público (Narrativa):
> *"Para finalizar el recorrido, entramos en **Ajustes y Privacidad**. Aquí es donde la soberanía del usuario se hace palpable:*
> 
> *Fíjense en las métricas de almacenamiento: el sistema nos muestra con total transparencia cuántos mensajes y foros tenemos guardados en nuestra base de datos local `IndexedDB`.*
> 
> *¿Qué pasa si estamos en el lago Titicaca o en un mercado techado y se pierde la señal celular? ZonaViva es una **PWA Offline-First**. Los recursos cargan al instante gracias a nuestro Service Worker. Si escribo un mensaje sin internet, entra a una **bandeja de salida local (`outbox`)** con un icono de reloj; en el momento exacto en que el dispositivo recupera señal, el sistema lo despacha automáticamente al relay.*
> 
> *Y si el usuario decide marcharse, tiene la libertad absoluta: con un solo clic en **'Borrar todos mis datos'**, el navegador destruye las claves criptográficas y purga la base de datos local. Sin rastros en ningún servidor de la nube."*

#### 🖱️ Qué hacer en vivo:
1. Ir a `/ajustes` y señalar las estadísticas en tiempo real de mensajes almacenados.
2. Hacer clic en **"Persistencia de Almacenamiento"** para mostrar cómo el navegador concede permiso estricto contra borrados automáticos.
3. Mostrar la opción de modificar el Alias en cualquier momento.
4. *(Opcional si hay tiempo):* Activar el modo Offline en las herramientas de desarrollo de Chrome (DevTools $\rightarrow$ Network $\rightarrow$ Offline) para mostrar la aparición del `OfflineBanner` superior flotante.

---

## 🏆 Cierre de la Exposición y Métricas Técnicas (1 Minuto)

#### 🗣️ Qué decir para cerrar con broche de oro:
> *"En conclusión, profesores y compañeros: **ZonaViva** no es solo un diseño conceptual; es un producto de software 100% operativo que demuestra que es posible crear tecnología social hiperlocal, comunitaria y respetuosa con los derechos humanos.*
> 
> *A nivel de ingeniería de software en la asignatura:*
> - *Hemos implementado un monorepo modular estricto en **TypeScript 5.x** con cero errores de compilación.*
> - *Desarrollamos algoritmos de grafos (**BFS**) para garantizar que las zonas de Puno no tengan islas ni solapamientos.*
> - *Y respaldamos cada línea de código con **117 pruebas automatizadas unitarias e integradas ejecutadas con Vitest**, todas pasando con 100% de éxito.*
> 
> *Muchas gracias por su atención. Quedamos a su disposición para cualquier pregunta técnica."*

---

## ❓ Preguntas Frecuentes del Docente y Cómo Responderlas

### P1: *"¿Por qué dicen que es descentralizada si hay un servidor relay?"*
* **Respuesta clave:** *"Excelente pregunta, profesor. Es descentralizada respecto a la **fuente de verdad del contenido**. En una red tradicional (Meta, Twitter), el servidor central es el dueño de la base de datos y almacena toda la historia. En ZonaViva, el servidor relay es un enrutador efímero en memoria que no guarda un solo mensaje ni base de datos en disco. Los dueños del historial son los dispositivos de los participantes a través de IndexedDB. El servidor solo actúa como intermediario de señalización y sellador canónico para evitar que los relojes desincronizados de los clientes colisionen."*

### P2: *"¿Cómo garantizan que un usuario no altere su GPS para publicar donde no está?"*
* **Respuesta clave:** *"En el MVP actual asumimos el modelo de geolocalización del navegador. Para mitigar falsificaciones básicas, filtramos lecturas con antigüedad mayor a 60 segundos y descartamos precisiones degradadas mayores a 300 metros. Para un despliegue de alta seguridad en etapas futuras, se complementará con atestación de red celular (Cell ID) o balizas Bluetooth BLE de presencia local."*

### P3: *"¿Qué ocurre si un par responde una sincronización histórica con mensajes inventados?"*
* **Respuesta clave:** *"Esa fue una de las decisiones de diseño más importantes. Cada mensaje que pasa por el relay recibe un sello digital: el relay firma con su clave privada ECDSA P-256 la tupla `(id, forumId, relayTs, sha256(content))`. Los clientes que reciben la sincronización verifican esa firma con la clave pública embebida del relay. Si alguien modificó una sola letra del texto o la hora, la firma no coincide y el cliente descarta el mensaje inmediatamente."*

### P4: *"¿Por qué eligieron Puno para el piloto y qué particularidad técnica tiene?"*
* **Respuesta clave:** *"Puno tiene una dinámica urbana única: mercados con alta afluencia comercial concentrada (Central, Unión y Bellavista), una comunidad universitaria muy activa de más de 20,000 personas en la UNAP, y puntos cívicos claros como la Plaza Mayor y Parque Pino. Técnicamente, delimitamos las zonas extrayendo polígonos GeoJSON de OpenStreetMap y aplicamos un algoritmo Flood-Fill BFS para asegurarnos de que no existan islas aisladas dentro de ninguna de las 50 celdas Geohash P7 configuradas."*

---

*Guía didáctica de presentación desarrollada para la cátedra de Lenguajes de Programación — Noviembre 2026.*
