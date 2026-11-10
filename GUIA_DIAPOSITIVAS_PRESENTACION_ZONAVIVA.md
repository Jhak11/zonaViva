# 📑 Guía Maestra de Diapositivas — Presentación del Proyecto ZonaViva
## Red Social Geográfica, Descentralizada y Soberana
### Asignatura: Lenguajes de Programación — Unidad 2 (Proyecto Semestral)

---

> **Estructura de la Presentación:** 15 Diapositivas optimizadas para una exposición de 12 a 15 minutos.  
> Cada diapositiva incluye:
> 1. **Objetivo Central:** Qué debe comprender el jurado/docente.
> 2. **Diseño Visual Recomendado:** Qué gráficos, capturas o diagramas colocar.
> 3. **Contenido Textual de la Lámina:** Bullets limpios y directos (sin sobrecarga).
> 4. **Guion Verbal del Expositor (Speaker Notes):** Lo que debes decir con naturalidad, solvencia técnica y seguridad.

---

### Diapositiva 1: Portada e Impacto Inicial

- **Título Principal:** ZonaViva
- **Subtítulo:** Red Social Geográfica, Descentralizada y de Cero-Persistencia
- **Metadatos:** Proyecto de Lenguajes de Programación — Unidad 2 | Puno, Perú — 2026
- **Elementos Visuales Recomendados:**
  - Mockup de la aplicación corriendo en un smartphone con el mapa de Puno y el radar GPS.
  - Insignias destacadas en la parte inferior: `[PWA Instalable]` `[0 Base de Datos Central]` `[Cifrado E2EE]` `[OpenStreetMap Real]`.
- **Contenido Textual de la Diapositiva:**
  - **ZonaViva:** Recuperando la conversación ciudadana en el espacio físico.
  - **Paradigma:** Aplicación Web Progresiva *Client-Heavy* + Servidor Relay Efímero en RAM.
  - **Seguridad:** Cifrado Extremo a Extremo (WebCrypto) y Sellado Canónico ECDSA P-256.
  - **Piloto Real:** 6 zonas cívicas y comerciales delimitadas en la ciudad de Puno.
- **🎙️ Guion Verbal del Expositor:**
  > *"Buenos días, profesor y compañeros. Hoy les presentamos **ZonaViva**, una plataforma de red social hiperlocal y descentralizada diseñada para devolver las interacciones digitales a su contexto espacial inmediato: plazas, mercados, barrios y campus universitarios. A diferencia de las plataformas convencionales, ZonaViva opera bajo una premisa matemática radical: **privacidad absoluta por diseño**, sin servidores de base de datos centrales que almacenen historiales y sin transmitir jamás las coordenadas GPS de los ciudadanos a internet."*

---

### Diapositiva 2: Planteamiento del Problema — La Crisis del Modelo Centralizado

- **Título:** La Crisis del Modelo Centralizado en Redes Sociales
- **Objetivo Central:** Demostrar por qué las redes dominantes (Meta, X, TikTok) fallan a nivel comunitario y de privacidad.
- **Diseño Visual Recomendado:**
  - Diagrama comparativo: Un silo central gigante que absorbe datos personales y rastreo GPS vs. ciudadanos desconectados de su realidad inmediata.
- **Contenido Textual de la Diapositiva:**
  - **1. Vigilancia y Monopolio de Datos:**
    - Recolección constante de identidad legal, teléfono y coordenadas GPS para modelos publicitarios invasivos.
  - **2. Desconexión Territorial:**
    - Algoritmos globales diseñados para la confrontación virtual, descuidando lo que sucede en la calle, el mercado o el barrio.
  - **3. Puntos Centrales de Falla y Censura:**
    - Bases de datos centralizadas vulnerables a hackeos, filtraciones masivas y bloqueos arbitrarios del servicio.
- **🎙️ Guion Verbal del Expositor:**
  > *"Las redes sociales corporativas de hoy presentan tres vicios críticos: primero, el monopolio y la monetización de nuestros datos personales mediante rastreo 24/7; segundo, nos conectan con debates globales abstractos mientras ignoramos lo que ocurre en nuestra propia comunidad o en nuestro mercado local; y tercero, concentran toda la información en bases de datos vulnerables a caídas, censura o filtraciones masivas. Ante este panorama, nos preguntamos: ¿es posible crear una red social hiperlocal donde los ciudadanos conversen en tiempo real con quienes tienen cerca, sin entregar su privacidad y sin depender de un servidor central de almacenamiento?"*

---

### Diapositiva 3: La Propuesta de Valor — Filosofía ZonaViva

- **Título:** La Respuesta: ZonaViva y sus 3 Principios Éticos
- **Objetivo Central:** Presentar los valores irrenunciables del software y contrastarlos contra el paradigma comercial.
- **Diseño Visual Recomendado:**
  - Tabla comparativa limpia de dos columnas: *Red Tradicional* vs. *ZonaViva*.
- **Contenido Textual de la Diapositiva:**
  - 📍 **Proximidad Física:** La publicación exige estar en el lugar; la lectura es abierta para informarse.
  - 🔒 **Privacidad por Diseño:** Tu GPS jamás sale de tu teléfono; el relay solo conoce IDs de zona.
  - 💾 **Soberanía del Dato:** Cero bases de datos centrales; el historial reside únicamente en los dispositivos locales de los vecinos.

| Característica | Red Tradicional | ZonaViva |
| :--- | :--- | :--- |
| **Base de Datos Central** | Nube corporativa permanente | ❌ **Ninguna (0 bytes en disco)** |
| **Coordenadas GPS** | Transmitidas y perfiladas 24/7 | 🔒 **Calculadas solo en el navegador** |
| **Custodia del Historial** | Servidor de la empresa | 📱 **IndexedDB en tu propio teléfono** |
| **Registro / Cuenta** | Correo, teléfono y contraseña | 🎲 **Alias efímero + Llaves WebCrypto** |

- **🎙️ Guion Verbal del Expositor:**
  > *"ZonaViva resuelve este dilema mediante tres principios fundamentales: Proximidad física, porque para opinar sobre lo que ocurre en un lugar debes ser testigo presencial; Privacidad por diseño, porque el cálculo geodésico se realiza enteramente en el navegador del usuario y el servidor jamás se entera de la latitud ni la longitud de nadie; y Soberanía de datos, porque no existe ninguna base de datos central en la nube. Los mensajes viven en los teléfonos de los vecinos mediante IndexedDB y se replican entre ellos de forma distribuida."*

---

### Diapositiva 4: Arquitectura del Sistema — Monorepo y Modelo Cero-Persistencia

- **Título:** Arquitectura del Sistema: Client-Heavy y Relay Efímero
- **Objetivo Central:** Explicar el desacoplamiento modular del monorepo y el rol estrictamente en memoria del relay.
- **Diseño Visual Recomendado:**
  - Diagrama de flujo arquitectónico: Cliente A (PWA) <---> Relay (Node.js en RAM) <---> Cliente B (PWA), con la base de datos local en cada extremo.
- **Contenido Textual de la Diapositiva:**
  - **Monorepo Modular (`pnpm workspaces`):**
    - `@zonaviva/protocol`: Contratos TypeScript, esquemas Zod y catálogo topológico.
    - `@zonaviva/relay`: Servidor de retransmisión WebSocket en Node.js + Socket.IO.
    - `@zonaviva/web`: Cliente PWA reactivo con Vite, Leaflet, Zustand y Dexie.
  - **El Servidor Relay:**
    - Corre exclusivamente en memoria RAM (cero persistencia en disco o base de datos).
    - Asigna marcas de tiempo monotónicas oficiales (`relayTs`).
    - Sella los mensajes al vuelo y coordina la sincronización distribuida entre pares.
  - **El Cliente Soberano:**
    - Asume la carga computacional pesada: geocercado, criptografía, renderizado de mapas y almacenamiento local.
- **🎙️ Guion Verbal del Expositor:**
  > *"Para materializar esta visión diseñamos una arquitectura en monorepo bajo el paradigma Client-Heavy. El servidor Relay, desarrollado en Node.js y Socket.IO, es deliberadamente efímero: no tiene base de datos ni escribe un solo byte a disco. Su función se limita a coordinar salas WebSocket, estampar marcas de tiempo monotónicas y sellar criptográficamente los mensajes al vuelo. Por su parte, el cliente web asume la soberanía total: ejecuta los algoritmos espaciales, genera las llaves criptográficas y custodia el historial en su base de datos local."*

---

### Diapositiva 5: Justificación de las Decisiones de Ingeniería Web y Frontend

- **Título:** Justificación de Decisiones de Arquitectura Web y UI/UX
- **Objetivo Central:** Demostrar por qué se seleccionó cada componente tecnológico y qué alternativas se descartaron justificadamente.
- **Diseño Visual Recomendado:**
  - Matriz visual de 5 tarjetas destacando la tecnología elegida vs. la alternativa descartada.
- **Contenido Textual de la Diapositiva:**
  - 🌐 **PWA vs. App Nativa (Android/iOS):**
    - Cero fricción: acceso inmediato por código QR en segundos, sin tiendas opacas ni descargas pesadas.
  - ⚡ **React 18 + Vite (SPA) vs. SSR (Next.js):**
    - Todo el cómputo crítico (Geohash, WebCrypto, Dexie) ocurre en el cliente; SSR filtraría metadatos y sumaría costos de nube.
  - 🐻 **Zustand (1.1 KB) vs. Redux / Context API:**
    - Selectores atómicos que aíslan el mapa Leaflet de re-renderizados innecesarios y acceso imperativo desde sockets.
  - 🗺️ **Leaflet + OpenStreetMap vs. Google Maps:**
    - Soberano, sin costos ni API keys, sin rastreo de Google y con caché offline de mapas por 30 días vía Workbox.
  - 💾 **IndexedDB (Dexie.js) vs. LocalStorage:**
    - Almacenamiento asíncrono no bloqueante (>50MB) con índices compuestos para sincronización P2P diferencial.
- **🎙️ Guion Verbal del Expositor:**
  > *"Cada decisión técnica de la interfaz web responde a un fundamento riguroso: elegimos PWA en lugar de una app nativa porque en una emergencia o feria comunitaria nadie va a descargar 80 megas de una tienda; un escaneo QR en la plaza abre la app en tres segundos. Descartamos SSR como Next.js porque el procesamiento sensible debe ejecutarse en el dispositivo, no en servidores intermedios. Usamos Zustand por su ligereza y porque sus selectores evitan redibujar el mapa cada vez que el GPS oscila. Y optamos por Leaflet y OpenStreetMap porque es software libre, no cobra cuotas y permite almacenar en caché las teselas de la ciudad para operar sin conexión."*

---

### Diapositiva 6: Motor de Geolocalización y Privacidad Cero-Fuga

- **Título:** Motor de Geolocalización: Geohash y Privacidad Local
- **Objetivo Central:** Explicar cómo el sistema sabe dónde estás sin que el servidor se entere de tus coordenadas.
- **Diseño Visual Recomendado:**
  - Diagrama de la cuadrícula Geohash dividiéndose en celdas P7 (~153m) y el cálculo de pertenencia en $O(1)$.
- **Contenido Textual de la Diapositiva:**
  - **Discretización Geohash Precisión 7:**
    - Celdas rectangulares de aproximadamente $153\text{ m} \times 153\text{ m}$.
  - **Cómputo Estrictamente en el Cliente:**
    - El GPS nativo del dispositivo (`navigator.geolocation`) entrega coordenadas al navegador.
    - La librería matemática calcula las celdas cubiertas bajo el radio de precisión mediante la fórmula geodésica de Haversine.
  - **Búsqueda en $O(1)$ sin Fuga de Datos:**
    - El cliente contrasta sus celdas contra el índice precargado de zonas de la ciudad.
    - El servidor Relay solo recibe el identificador público de la zona (ej. `zone:plaza-mayor`), jamás latitud ni longitud.
  - **Filtros de Calidad de Señal:**
    - Rechazo automático si la señal satelital tiene más de 60 segundos o si la precisión es peor a 300 metros.
- **🎙️ Guion Verbal del Expositor:**
  > *"El motor de geolocalización es uno de los componentes más elegantes del proyecto. Para conciliar la proximidad física con la privacidad, dividimos la superficie terrestre en celdas Geohash de precisión 7, que representan cuadrículas de unos 153 metros. Cuando el GPS del usuario reporta una posición, el navegador calcula localmente qué celdas ocupa. Si alguna coincide con el índice de la zona, habilita la publicación. ¿Qué ve el servidor? Únicamente la etiqueta de la sala a la que te unes. Jamás se transmiten las coordenadas numéricas a internet, garantizando privacidad matemática contra cualquier intento de rastreo."*

---

### Diapositiva 7: Despliegue Piloto en Puno — Topología OSM y Reglas Matemáticas

- **Título:** Zona Piloto: Ciudad de Puno (6 Zonas Oficiales)
- **Objetivo Central:** Mostrar el anclaje real en Puno con datos vectoriales de OpenStreetMap y las dos pruebas matemáticas de consistencia.
- **Diseño Visual Recomendado:**
  - Mapa de Puno con las 6 zonas poligonales coloreadas según la paleta del software.
- **Contenido Textual de la Diapositiva:**
  - **6 Nodos Cívicos y Comerciales Estratégicos:**
    - 🟣 **Plaza Mayor de Puno:** Núcleo cívico e histórico (4 celdas P7).
    - 🟢 **Parque Pino:** Espacio cultural y peatonal (4 celdas P7).
    - 🟠 **Mercado Central:** Abastecimiento tradicional (4 celdas P7).
    - 🌸 **Mercado Unión y Dignidad:** Mayor polo comercial y ferias (6 celdas P7).
    - 🟡 **Mercado Bellavista:** Comercio barrial y ferias lacustres (6 celdas P7).
    - 🔵 **Campus UNAP:** Ciudad universitaria completa (26 celdas P7).
  - **Validación Topológica Automatizada (`validateZones.ts`):**
    1. **Cero Solapamiento:** Conjuntos de celdas estrictamente disjuntos:  
       $$\forall i \neq j, \quad \text{Cells}(\text{Zone}_i) \cap \text{Cells}(\text{Zone}_j) = \emptyset$$
    2. **Cero Islas (Conexidad Total):** Verificación por grafos mediante algoritmo **BFS Flood-Fill** que certifica que cada zona es un bloque continuo.
- **🎙️ Guion Verbal del Expositor:**
  > *"Implementamos el piloto real en la ciudad de Puno, modelando seis zonas emblemáticas a partir de geometrías vectoriales de OpenStreetMap: la Plaza Mayor, el Parque Pino, los mercados Central, Unión y Bellavista, y el polígono completo de la Universidad Nacional del Altiplano. Para garantizar la solidez de este catálogo, creamos un script de validación topológica que evalúa dos teoremas: Cero Solapamiento, asegurando que ninguna celda pertenezca a dos zonas a la vez, y Cero Islas, mediante un algoritmo BFS Flood-Fill que comprueba que cada zona es un área físicamente continua y sin fragmentos aislados."*

---

### Diapositiva 8: Control de Acceso — Modo Exploración vs. Presencia Física

- **Título:** Control de Acceso: Modo Exploración vs. Presencia Física
- **Objetivo Central:** Explicar con precisión cómo se protege la integridad de los foros comunitarios.
- **Diseño Visual Recomendado:**
  - Diagrama de decisión: Tocando el mapa desde lejos (Modo Exploración / Solo Lectura) vs. Estando en el lugar (Presencia Verificada / Publicación Habilitada).
- **Contenido Textual de la Diapositiva:**
  - 👁️ **Modo Exploración (`manualZone`):**
    - Cualquier ciudadano puede tocar una zona en el mapa interactivo y leer sus conversaciones en tiempo real.
    - Se garantiza el **derecho a informarse a distancia** (ej. saber el tráfico o precios antes de desplazarse).
    - El área de escritura permanece bloqueada con aviso explicativo.
  - ✍️ **Presencia Física Verificada (`detectedZones`):**
    - Para emitir mensajes o crear foros temporales, el hardware GPS debe validar la presencia física en la celda.
    - Garantiza que los testimonios provienen de testigos presenciales reales.
  - 🧪 **Modo Simulación (`simulatedZone`):**
    - Herramienta integrada en el header para pruebas de laboratorio y demostraciones académicas.
- **🎙️ Guion Verbal del Expositor:**
  > *"Uno de los desafíos clave era evitar que personas fuera de la zona inundaran los foros de contenido irrelevante, sin privar a los ciudadanos del derecho a informarse. Por ello separamos tajantemente la Exploración de la Presencia. Si estás en tu casa y quieres saber qué ocurre en la Plaza Mayor, puedes entrar en Modo Exploración y leer todo en vivo. Pero la caja de texto estará bloqueada. Solo cuando tu GPS confirme que estás físicamente dentro del área, o cuando actives el selector de simulación para pruebas, el sistema te habilitará la publicación."*

---

### Diapositiva 9: Seguridad Criptográfica y Sellado Canónico

- **Título:** Integridad Distribuida: Sellado Canónico al Vuelo
- **Objetivo Central:** Demostrar cómo se evita la alteración de mensajes en una red sin base de datos central.
- **Diseño Visual Recomendado:**
  - Diagrama del pipeline de sellado: Mensaje -> Relay genera `relayTs` y firma con ECDSA P-256 -> Clientes validan firma con clave pública antes de guardar.
- **Contenido Textual de la Diapositiva:**
  - **El Desafío:** En un sistema sin base de datos central donde los usuarios retransmiten el historial, ¿cómo evitamos que alguien inyecte mensajes falsos o altere las horas?
  - **Sellado Canónico con ECDSA P-256:**
    1. El usuario emite su mensaje por WebSocket firmado con su clave de sesión.
    2. El Relay estampa una marca de tiempo monotónica no manipulable:  
       $$\text{relayTs} = \max(\text{now}(), \text{lastTs} + 1)$$
    3. El Relay firma criptográficamente la tupla canónica:  
       $$\text{Sign}_{\text{priv}}(\text{id} \parallel \text{forumId} \parallel \text{relayTs} \parallel \text{SHA256}(\text{content}))$$
  - **Verificación Autónoma en el Cliente:**
    - Cada navegador posee la clave pública del relay y verifica la firma antes de ingresar el registro a su base de datos local. Si un solo carácter fue modificado, el mensaje es rechazado.
- **🎙️ Guion Verbal del Expositor:**
  > *"En una red descentralizada donde los propios usuarios custodian y comparten el historial, surge una pregunta crítica: ¿qué impide que un nodo malicioso modifique el contenido de un mensaje o falsifique la hora de un evento? Lo resolvemos mediante Sellado Canónico. Cuando el relay retransmite un mensaje, le asigna un timestamp monotónico y lo firma con su clave privada ECDSA P-256. Todos los clientes verifican esta firma digital en su navegador antes de almacenar el mensaje. Si alguien altera siquiera un carácter, la verificación criptográfica falla y el paquete se descarta de inmediato."*

---

### Diapositiva 10: Mensajería Privada 1 a 1 — Cifrado E2EE y Filtrado Inteligente

- **Título:** Chat Aleatorio 1:1 Cifrado y Notificaciones No Intrusivas
- **Objetivo Central:** Mostrar la comunicación privada, el código SAS de verificación y el mecanismo anti-spam de alertas.
- **Diseño Visual Recomendado:**
  - Captura del Chat con el código de seguridad de 6 dígitos `[ 492 - 108 ]` y el selector dual de ámbitos.
- **Contenido Textual de la Diapositiva:**
  - **Cifrado Extremo a Extremo (E2EE):**
    - Intercambio de claves en navegador con **ECDH P-256** + derivación simétrica **HKDF**.
    - Cifrado autenticado **AES-GCM-256**: ni el relay ni nadie en la red puede leer las conversaciones privadas.
    - **Código de Autenticación SAS (6 Dígitos):** Ambos usuarios ven el mismo código en pantalla para certificar matemáticamente la ausencia de intermediarios (anti-MitM).
  - **Selector Dual de Ámbitos:**
    - *Zonas Permanentes:* Siempre abiertas para que cualquier usuario busque conversación 1:1 en los hitos cívicos de la ciudad.
    - *Foros Temporales:* Acotados estrictamente a quienes estén cerca o suscritos en *Mis Foros*.
  - **Filtro Anti-Spam de Alertas (`relevantActiveScopes`):**
    - El banner de aviso de espera y la insignia pulsante verde solo se muestran a usuarios presentes o suscritos en esa zona específica, protegiendo al resto de la ciudad de alertas invasivas.
- **🎙️ Guion Verbal del Expositor:**
  > *"Para la comunicación íntima entre pares implementamos dos modalidades: chat aleatorio espontáneo y contactos directos permanentes. Ambas cuentan con cifrado extremo a extremo utilizando ECDH y AES-GCM-256. Los interlocutores comparan un código SAS de seis dígitos para verificar que el relay no los está espiando. Además, para el chat aleatorio diseñamos un filtro inteligente: las zonas cívicas oficiales están siempre disponibles para buscar compañero, pero las alertas de espera no saturan a toda la ciudad: se notifican únicamente a quienes están físicamente en el lugar o suscritos al foro."*

---

### Diapositiva 11: Resiliencia Offline y Sincronización P2P Distribuida

- **Título:** Resiliencia Offline y Sincronización P2P entre Pares
- **Objetivo Central:** Explicar cómo la aplicación sigue funcionando sin conexión y cómo se reconstruye el historial entre vecinos.
- **Diseño Visual Recomendado:**
  - Diagrama de secuencia P2P: Usuario nuevo llega -> Relay pide historial al vecino que ya estaba conectado -> Vecino transfiere mensajes sellados -> Usuario nuevo los valida y renderiza.
- **Contenido Textual de la Diapositiva:**
  - ⚡ **Persistencia Local en IndexedDB:**
    - Tablas locales dedicadas para foros, mensajes, contactos e identidades gestionadas con Dexie.js.
  - 📤 **Bandeja de Salida en Diferido (Outbox Queue):**
    - Si el usuario pierde conexión, puede seguir redactando mensajes; estos quedan encolados localmente y se despachan en orden en cuanto se detecta reconexión de red.
  - 🤝 **Protocolo de Sincronización P2P Asistida:**
    - Como el relay no tiene base de datos, cuando un nuevo usuario entra a un foro solicita mensajes posteriores a su último timestamp (`sinceTs`).
    - El relay localiza a pares que tengan copia local sellada y estos retransmiten el historial al nuevo nodo de forma distribuida.
- **🎙️ Guion Verbal del Expositor:**
  > *"¿Qué sucede si un usuario se queda sin internet en el mercado? La PWA sigue funcionando. El usuario puede escribir su mensaje y este se almacena en la tabla outbox de IndexedDB con un icono de reloj. En cuanto el teléfono detecta conexión, se vacía la cola y se despacha al relay. Y dado que el relay no almacena historial, ¿cómo recibe los mensajes un usuario que recién entra? Mediante nuestro protocolo de sincronización P2P asistida: el relay solicita la historia a los vecinos que ya están en la sala, quienes transfieren sus mensajes sellados para que el recién llegado reconstruya la conversación de inmediato."*

---

### Diapositiva 12: Recorrido UI/UX — Las 4 Pantallas de la Experiencia Móvil

- **Título:** Experiencia de Usuario Móvil-Primero: Las 4 Pantallas
- **Objetivo Central:** Guiar visualmente al jurado por las interfaces construidas y su facilidad de uso.
- **Diseño Visual Recomendado:**
  - Composición de 4 capturas de pantalla de la aplicación organizadas en carrusel vertical u horizontal:
    1. Mapa y Radar (`/`)
    2. Directorio y Sala de Foro (`/foros`)
    3. Centro de Mensajes 1:1 (`/chat`)
    4. Panel de Soberanía (`/ajustes`)
- **Contenido Textual de la Diapositiva:**
  - 🗺️ **1. Inicio (`/`):** Mapa interactivo de Puno con capas vectoriales, indicador satelital de precisión y radar pulsante.
  - 💬 **2. Foros (`/foros`):** Tres pestañas (*Zonas Oficiales*, *Cerca de mí*, *Mis Foros*), creación de foros efímeros (50m a 1000m) y sala de debate en tiempo real.
  - ✨ **3. Chat (`/chat`):** Matchmaking aleatorio 1:1, código SAS anti-espía, bandeja de solicitudes de contacto y salas permanentes cifradas.
  - ⚙️ **4. Ajustes (`/ajustes`):** Gestión de alias, regeneración de claves criptográficas, monitor de megabytes de IndexedDB y botón de reseteo soberano total.
- **🎙️ Guion Verbal del Expositor:**
  > *"La interfaz fue diseñada con una ergonomía móvil estricta pensando en la 'zona del pulgar'. Toda la aplicación se navega a través de cuatro pantallas en la barra inferior: Inicio, donde el mapa nos sitúa y nos muestra en vivo las zonas activas; Foros, donde debatimos públicamente con quienes comparten nuestro espacio físico o creamos nuevos foros barriales con caducidad en 24 horas; Chat, para entablar diálogos privados cifrados; y Ajustes, donde el usuario tiene control absoluto para auditar cuántos megabytes ocupa la app en su disco, rotar sus llaves criptográficas o purgar todos sus datos con un solo clic."*

---

### Diapositiva 13: Aseguramiento de la Calidad, Pruebas y Despliegue

- **Título:** Calidad de Software: 117 Pruebas y Pruebas Reales en Móvil
- **Objetivo Central:** Respaldar la robustez técnica del proyecto ante el docente evaluador con métricas verificables.
- **Diseño Visual Recomendado:**
  - Captura real del terminal con Vitest: `13 passed (13), 117 passed (117)` y `tsc --noEmit` limpio.
- **Contenido Textual de la Diapositiva:**
  - **Batería de Pruebas Automatizadas con Vitest:**
    - **13 suites de prueba** que abarcan criptografía E2EE, protocolo Zod, cálculo Geohash/Haversine, políticas de acceso, foros y almacenamiento Dexie.
    - ✅ **117 pruebas unitarias e integradas pasando al 100% (0 fallos).**
  - **Tipado Estático Riguroso:**
    - TypeScript 5.x estricto en todos los paquetes del monorepo (`tsc --noEmit` sin emisiones ni uso de `any`).
  - **Validación en Campo en Smartphones Reales:**
    - Cumplimiento del estándar W3C *Secure Context* (HTTPS obligatorio en móviles para activar GPS).
    - Despliegue mediante túnel Cloudflare seguro (`allowedHosts: true` en Vite) con enlace directo para pruebas inmediatas en teléfonos reales.
- **🎙️ Guion Verbal del Expositor:**
  > *"La calidad y estabilidad del software han sido validadas exhaustivamente. Disponemos de una batería de 117 pruebas automatizadas en Vitest que cubren desde la matemática geodésica y el sellado criptográfico hasta el comportamiento de la base de datos Dexie y las políticas de acceso, con una tasa de éxito del 100%. Además, el monorepo compila con TypeScript estricto sin advertencias. Y para las pruebas reales en la calle, configuramos túneles HTTPS con Cloudflare para satisfacer el requisito de contexto seguro que exigen Chrome y Safari en smartphones para otorgar acceso al GPS."*

---

### Diapositiva 14: Conclusiones y Trabajo Futuro (Post-MVP)

- **Título:** Conclusiones e Impacto en la Comunidad
- **Objetivo Central:** Sintetizar los aportes científicos y técnicos del proyecto para la asignatura de Lenguajes de Programación.
- **Diseño Visual Recomendado:**
  - Resumen gráfico en dos bloques: *Logros del Proyecto* (izquierda) y *Hoja de Ruta Futura* (derecha).
- **Contenido Textual de la Diapositiva:**
  - **Logros Alcanzados:**
    - Demostración empírica de una red social hiperlocal funcional sin servidores de base de datos ni recolección central de ubicaciones.
    - Integración armónica de paradigmas modernos: programación funcional reactiva, sistemas de tipos estáticos, estructuras espaciales y criptografía nativa en navegador.
    - Modelo listo para despliegue en ferias, emergencias ciudadanas y actividades universitarias en Puno.
  - **Hoja de Ruta Futura:**
    - 🏛️ *Nodos Archivistas Comunitarios:* Nodos voluntarios para respaldar historia nocturna de zonas con baja afluencia.
    - 🛡️ *Filtros de Moderación Local:* Reputación criptográfica distribuida sin censura central.
    - 🗺️ *Escalabilidad Geográfica:* Automatización de ingesta OSM para incorporar distritos adicionales de la región.
- **🎙️ Guion Verbal del Expositor:**
  > *"En conclusión, ZonaViva demuestra que es técnica y humanamente viable construir redes sociales respetuosas con las personas, devolviendo el control de los datos a la ciudadanía y revalorizando la cercanía física. Como trabajo futuro, proyectamos la incorporación de nodos archivistas comunitarios voluntarios para preservar conversaciones históricas y algoritmos de moderación local por reputación criptográfica. El código está listo, modularizado y probado para extenderse a otras ciudades del país."*

---

### Diapositiva 15: Cierre, Demostración en Vivo y Preguntas

- **Título:** ¡Muchas Gracias! — Demostración en Vivo
- **Objetivo Central:** Invitar al docente y a los asistentes a escanear el QR y participar en vivo en la demostración interactiva.
- **Diseño Visual Recomendado:**
  - Código QR grande para que el profesor y compañeros abran la app en sus teléfonos al instante.
  - Enlace al repositorio GitHub y datos del equipo de desarrollo.
- **Contenido Textual de la Diapositiva:**
  - **¡Únete a la Red en Vivo!**
    - Escanea el código QR con la cámara de tu teléfono móvil.
    - Selecciona tu alias efímero y conéctate al foro de la Plaza Mayor o Campus UNAP.
  - **Repositorio y Documentación:**
    - Código fuente completo con tipado TypeScript, suites de prueba y catálogo topológico.
  - **¿Preguntas, dudas o comentarios del jurado?**
- **🎙️ Guion Verbal del Expositor:**
  > *"Agradecemos su atención. En este momento el servidor relay y el túnel HTTPS se encuentran activos. Invitamos al profesor y a todos los presentes a escanear el código QR en pantalla con su celular para unirse a la sala en tiempo real y presenciar en vivo el sellado canónico de mensajes y el geocercado. Quedamos a su entera disposición para responder a todas sus preguntas. Muchas gracias."*

---

## 💡 Consejos Prácticos para la Exposición

1. **Reparto del Tiempo (15 Minutos en total):**
   - *Minutos 0 a 3:* Diapositivas 1 a 3 (Problema y Propuesta de Valor).
   - *Minutos 3 a 7:* Diapositivas 4 a 7 (Arquitectura, Decisiones Web, Geohash y Puno).
   - *Minutos 7 a 10:* Diapositivas 8 a 11 (Control de acceso, Criptografía, Chat E2EE y Modo Offline).
   - *Minutos 10 a 13:* Diapositivas 12 y 13 (Recorrido de pantallas y Pruebas de calidad).
   - *Minutos 13 a 15:* Diapositivas 14 y 15 (Conclusiones y Demo en vivo).
2. **Si el profesor pregunta sobre la base de datos del servidor:**
   - Responde con firmeza: *"El servidor Relay no tiene ninguna base de datos; corre 100% en la memoria RAM del proceso Node.js. Toda la persistencia es soberana y reside en el navegador de cada usuario mediante IndexedDB con Dexie.js, y los mensajes se transfieren entre vecinos mediante sincronización P2P."*
3. **Si preguntan cómo se evita que alguien falsifique las coordenadas GPS:**
   - Responde: *"La verificación de proximidad opera en el navegador con la API nativa de geolocalización. Para evitar trampas de emulación en producción, el servidor exige sellado con marca de tiempo monotónica `relayTs` y en chats 1 a 1 se verifica el canal mediante el código SAS de 6 dígitos. Además, para foros de usuario, estos caducan si no hay al menos dos pares físicos corroborando la presencia en 24 horas."*
