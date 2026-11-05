# Sam RAMman

Un personaje articulado que reacciona a la memoria RAM de tu computadora. Cuanta menos RAM se usa, más se agacha y más se enfada.

## Cómo usarlo

### 1. Medir la RAM real de tu computadora
Para ver a Sam reaccionar a la memoria real de tu sistema en tiempo real:

```sh
node server.js
```
Abre en tu navegador la dirección indicada: `http://localhost:3000`. Sam leerá automáticamente la memoria RAM real cada segundo.

### 2. Modo simulación manual
Puedes abrir `index.html` directamente en tu navegador (sin necesidad de servidor). En este modo:
- Arrastra «Memoria usada» para cambiar la postura manualmente.
- Elige la RAM instalada: 8, 16, 32, 64 o 128 GB.
- Una mano marca el total y la otra el uso. El espacio entre ambas es la memoria libre.
- «Animar uso de RAM» recorre automáticamente distintos valores.
- «Ver articulaciones» muestra los pivotes y el esqueleto.

El personaje se dibuja en Canvas con 15 piezas del cuerpo de `assets/partes/` y cuatro expresiones de `assets/caras/`, basadas en `../partes/cara.jpg`. La cabeza nueva sustituye la cabeza y mandíbula anteriores. Las expresiones cambian como recortes intercambiables: furioso con menos del 20 % de uso, molesto entre 20 y 45 %, incómodo entre 45 y 72 %, y tranquilo a partir de 72 %.

Cuanta menos RAM se usa, más se agacha el personaje y más se enfada. La barra tiene 380 píxeles de alto. Las guías conectan sus manos con los valores de la barra, permitiendo mantener los brazos proporcionados. Todas las piezas conservan su relación de aspecto y tamaño durante el movimiento. Los codos y rodillas se calculan con cinemática inversa. El motor de dibujo compartido está en `ramman.js`; los controles de la demo, en `app.js`.

Conserva `assets/partes/` y `assets/caras/` junto al HTML, CSS y JavaScript al copiar la demo. Las cuatro caras se generaron con image_gen a partir de la foto de referencia, manteniendo identidad, pelo, orientación frontal y estilo fotográfico, con fondo transparente y borde fino de papel; solo se pidió variar progresivamente el enfado.

Las fuentes de Google son opcionales; sin conexión se usan las fuentes del sistema.

Validación: `node demo/tests/animation.cjs` desde la carpeta del proyecto. Comprueba la carga de las 15 piezas y cuatro caras, seis posturas y cuatro niveles de expresión, la coincidencia de los extremos de las ocho piezas articuladas con sus pivotes y los controles. Usa un contexto Canvas de prueba; no sustituye una comprobación en navegador.
