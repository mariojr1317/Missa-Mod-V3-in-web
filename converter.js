"use strict";

/*
============================================================
 FNF WEB CONVERTER V10

 FUENTE PRINCIPAL:
     ZIP COMPLETO DEL JUEGO

 REGLA:
     NO ELIMINAR ARCHIVOS DESCONOCIDOS.

 EL PROGRAMA:

 1. Abre TODO el ZIP.
 2. Conserva todas las entradas.
 3. Clasifica archivos.
 4. Busca:
      - canciones
      - charts
      - personajes
      - stages
      - eventos
      - imágenes
      - audio
      - vídeos
      - fuentes
      - scripts
      - shaders
 5. Muestra la lista completa.
 6. Genera un nuevo ZIP con:
      - archivos originales
      - manifest.json
      - index.html
      - game.js
      - style.css

 IMPORTANTE:
 Esto todavía no convierte automáticamente el motor
 compilado de Psych Engine. Primero estamos construyendo
 un mapa completo y preservando todos sus datos.
============================================================
*/


const zipInput =
    document.getElementById(
        "zipInput"
    );

const zipDrop =
    document.getElementById(
        "zipDrop"
    );

const analyzeButton =
    document.getElementById(
        "analyzeButton"
    );

const buildButton =
    document.getElementById(
        "buildButton"
    );

const statusBox =
    document.getElementById(
        "status"
    );

const resultsBox =
    document.getElementById(
        "results"
    );

const progressBar =
    document.getElementById(
        "progressBar"
    );

const fileListCard =
    document.getElementById(
        "fileListCard"
    );

const fileList =
    document.getElementById(
        "fileList"
    );

const searchInput =
    document.getElementById(
        "search"
    );


let selectedZip = null;

let zipFiles = [];

let analysis = null;


/* ============================================================
 UTILIDADES
============================================================ */

function setStatus(text)
{
    statusBox.textContent =
        text;
}


function setProgress(value)
{
    progressBar.style.width =
        `${Math.max(
            0,
            Math.min(
                100,
                value
            )
        )}%`;
}


function formatBytes(bytes)
{
    if (
        bytes < 1024
    )
    {
        return `${bytes} B`;
    }

    if (
        bytes <
        1024 * 1024
    )
    {
        return `${(
            bytes /
            1024
        ).toFixed(2)} KB`;
    }

    if (
        bytes <
        1024 *
        1024 *
        1024
    )
    {
        return `${(
            bytes /
            1024 /
            1024
        ).toFixed(2)} MB`;
    }

    return `${(
        bytes /
        1024 /
        1024 /
        1024
    ).toFixed(2)} GB`;
}


function cleanPath(path)
{
    return String(path)
        .replaceAll(
            "\\",
            "/"
        )
        .replace(
            /^\/+/,
            ""
        )
        .replaceAll(
            "../",
            ""
        );
}


function extension(path)
{
    const clean =
        path
            .toLowerCase()
            .split("?")[0];

    const dot =
        clean.lastIndexOf(".");

    if (
        dot === -1
    )
    {
        return "";
    }

    return clean.slice(
        dot
    );
}


/* ============================================================
 DROP ZONE
============================================================ */

zipDrop.addEventListener(
    "click",
    () =>
    {
        zipInput.click();
    }
);


zipInput.addEventListener(
    "change",
    () =>
    {
        if (
            zipInput.files.length
        )
        {
            selectZip(
                zipInput.files[0]
            );
        }
    }
);


zipDrop.addEventListener(
    "dragover",
    event =>
    {
        event.preventDefault();

        zipDrop.classList.add(
            "dragging"
        );
    }
);


zipDrop.addEventListener(
    "dragleave",
    () =>
    {
        zipDrop.classList.remove(
            "dragging"
        );
    }
);


zipDrop.addEventListener(
    "drop",
    event =>
    {
        event.preventDefault();

        zipDrop.classList.remove(
            "dragging"
        );

        if (
            event.dataTransfer.files.length
        )
        {
            selectZip(
                event.dataTransfer.files[0]
            );
        }
    }
);


function selectZip(file)
{
    selectedZip =
        file;

    analyzeButton.disabled =
        false;

    buildButton.disabled =
        true;

    zipFiles =
        [];

    analysis =
        null;

    resultsBox.innerHTML =
        "";

    fileList.innerHTML =
        "";

    fileListCard.classList.add(
        "hidden"
    );

    setProgress(0);

    setStatus(
        "📦 ZIP seleccionado\n\n" +
        `Nombre: ${file.name}\n` +
        `Tamaño: ${formatBytes(
            file.size
        )}\n\n` +
        "Pulsa ANALIZAR TODO."
    );
}


/* ============================================================
 LEER ZIP COMPLETO
============================================================ */

async function readFullZip(file)
{
    const buffer =
        await file.arrayBuffer();

    const bytes =
        new Uint8Array(
            buffer
        );

    const result =
        fflate.unzipSync(
            bytes
        );

    return Object.entries(
        result
    )
    .map(
        ([name, data]) =>
        ({
            name:
                cleanPath(name),

            data
        })
    );
}


/* ============================================================
 JSON
============================================================ */

function decodeUTF8(data)
{
    try
    {
        return new TextDecoder(
            "utf-8"
        ).decode(
            data
        );
    }
    catch
    {
        return "";
    }
}


function parseJSON(data)
{
    try
    {
        return JSON.parse(
            decodeUTF8(data)
        );
    }
    catch
    {
        return null;
    }
}


/* ============================================================
 DETECTAR CHART
============================================================ */

function isPsychChart(object)
{
    if (
        !object ||
        typeof object !==
            "object"
    )
    {
        return false;
    }

    if (
        !object.song ||
        typeof object.song !==
            "object"
    )
    {
        return false;
    }

    if (
        !Array.isArray(
            object.song.notes
        )
    )
    {
        return false;
    }

    return object.song.notes.some(
        section =>
            section &&
            Array.isArray(
                section.sectionNotes
            )
    );
}


function getSongName(object)
{
    if (
        object &&
        object.song
    )
    {
        return (
            object.song.song ||
            object.song.name ||
            "Unknown"
        );
    }

    return "Unknown";
}


/* ============================================================
 CLASIFICAR ZIP
============================================================ */

function analyzeZipFiles(files)
{
    const result =
    {
        total: 0,

        images: [],
        audio: [],
        videos: [],
        fonts: [],
        json: [],
        charts: [],
        lua: [],
        scripts: [],
        shaders: [],
        text: [],
        archives: [],
        other: [],

        characters: [],
        stages: [],
        songs: [],
        events: [],

        totalBytes: 0
    };


    for (
        const file
        of files
    )
    {
        if (
            !file.name ||
            file.name.endsWith("/")
        )
        {
            continue;
        }


        const path =
            file.name;

        const lower =
            path.toLowerCase();

        const ext =
            extension(path);


        result.total++;

        result.totalBytes +=
            file.data.length;


        /*
         * IMÁGENES
         */

        if (
            [
                ".png",
                ".jpg",
                ".jpeg",
                ".webp",
                ".bmp",
                ".gif"
            ]
            .includes(ext)
        )
        {
            result.images.push(
                path
            );
        }


        /*
         * AUDIO
         */

        else if (
            [
                ".ogg",
                ".mp3",
                ".wav",
                ".m4a",
                ".aac",
                ".flac"
            ]
            .includes(ext)
        )
        {
            result.audio.push(
                path
            );
        }


        /*
         * VÍDEO
         */

        else if (
            [
                ".mp4",
                ".webm",
                ".mov",
                ".avi",
                ".mkv"
            ]
            .includes(ext)
        )
        {
            result.videos.push(
                path
            );
        }


        /*
         * FUENTES
         */

        else if (
            [
                ".ttf",
                ".otf",
                ".woff",
                ".woff2"
            ]
            .includes(ext)
        )
        {
            result.fonts.push(
                path
            );
        }


        /*
         * JSON
         */

        else if (
            ext === ".json"
        )
        {
            result.json.push(
                path
            );

            const object =
                parseJSON(
                    file.data
                );


            if (
                isPsychChart(
                    object
                )
            )
            {
                result.charts.push(
                {
                    file:
                        path,

                    song:
                        getSongName(
                            object
                        ),

                    bpm:
                        object.song &&
                        object.song.bpm
                            ? object.song.bpm
                            : null,

                    speed:
                        object.song &&
                        object.song.speed
                            ? object.song.speed
                            : null,

                    noteCount:
                        countChartNotes(
                            object
                        )
                });
            }


            /*
             * Personajes
             */

            if (
                lower.includes(
                    "character"
                )
            )
            {
                result.characters.push(
                    path
                );
            }


            /*
             * Stages
             */

            if (
                lower.includes(
                    "stage"
                )
            )
            {
                result.stages.push(
                    path
                );
            }
        }


        /*
         * LUA
         */

        else if (
            ext === ".lua"
        )
        {
            result.lua.push(
                path
            );


            if (
                lower.includes(
                    "custom_events"
                ) ||
                lower.includes(
                    "events"
                )
            )
            {
                result.events.push(
                    path
                );
            }
        }


        /*
         * OTROS SCRIPTS
         */

        else if (
            [
                ".hx",
                ".hscript",
                ".js",
                ".ts"
            ]
            .includes(ext)
        )
        {
            result.scripts.push(
                path
            );
        }


        /*
         * SHADERS
         */

        else if (
            [
                ".frag",
                ".vert",
                ".glsl",
                ".shader"
            ]
            .includes(ext)
        )
        {
            result.shaders.push(
                path
            );
        }


        /*
         * TEXTO
         */

        else if (
            [
                ".txt",
                ".xml",
                ".cfg",
                ".ini",
                ".csv"
            ]
            .includes(ext)
        )
        {
            result.text.push(
                path
            );
        }


        /*
         * ARCHIVOS COMPRIMIDOS
         */

        else if (
            [
                ".zip",
                ".pak",
                ".pck",
                ".7z"
            ]
            .includes(ext)
        )
        {
            result.archives.push(
                path
            );
        }


        /*
         * OTROS
         */

        else
        {
            result.other.push(
                path
            );
        }


        /*
         * SONGS
         */

        if (
            lower.includes(
                "/songs/"
            ) ||
            lower.includes(
                "\\songs\\"
            ) ||
            lower.includes(
                "/song/"
            )
        )
        {
            result.songs.push(
                path
            );
        }


        /*
         * EVENTOS
         */

        if (
            lower.includes(
                "custom_events"
            ) ||
            lower.includes(
                "/events/"
            )
        )
        {
            if (
                !result.events.includes(
                    path
                )
            )
            {
                result.events.push(
                    path
                );
            }
        }
    }


    return result;
}


function countChartNotes(object)
{
    let total = 0;

    if (
        !object ||
        !object.song ||
        !Array.isArray(
            object.song.notes
        )
    )
    {
        return total;
    }

    for (
        const section
        of object.song.notes
    )
    {
        if (
            Array.isArray(
                section.sectionNotes
            )
        )
        {
            total +=
                section.sectionNotes.length;
        }
    }

    return total;
}


/* ============================================================
 MOSTRAR ARCHIVOS
============================================================ */

function renderFileList(
    filter = ""
)
{
    const normalized =
        filter
            .trim()
            .toLowerCase();

    fileList.innerHTML =
        "";

    const visible =
        zipFiles.filter(
            file =>
                !normalized ||
                file.name
                    .toLowerCase()
                    .includes(
                        normalized
                    )
        );


    const fragment =
        document.createDocumentFragment();


    for (
        const file
        of visible
    )
    {
        const div =
            document.createElement(
                "div"
            );

        div.className =
            "file-entry";


        const ext =
            extension(
                file.name
            );


        const size =
            formatBytes(
                file.data.length
            );


        div.textContent =
            `${file.name}  (${size})`;


        if (ext)
        {
            const badge =
                document.createElement(
                    "span"
                );

            badge.className =
                "file-type";

            badge.textContent =
                ext;

            div.appendChild(
                badge
            );
        }


        fragment.appendChild(
            div
        );
    }


    fileList.appendChild(
        fragment
    );
}


searchInput.addEventListener(
    "input",
    () =>
    {
        renderFileList(
            searchInput.value
        );
    }
);


/* ============================================================
 RESULTADOS
============================================================ */

function addResult(
    title,
    value,
    good = true
)
{
    const element =
        document.createElement("div");

    element.className =
        `result ${good ? "good" : "warn"}`;

    const titleElement =
        document.createElement("div");

    titleElement.className =
        "result-title";

    titleElement.textContent =
        title;

    const valueElement =
        document.createElement("div");

    valueElement.className =
        "result-value";

    valueElement.textContent =
        String(value);

    element.appendChild(
        titleElement
    );

    element.appendChild(
        valueElement
    );

    resultsBox.appendChild(
        element
    );
}


function displayAnalysis()
{
    // ...
}
    resultsBox.innerHTML =
        "";


    addResult(
        "Archivos totales",
        analysis.total
    );


    addResult(
        "Tamaño total",
        formatBytes(
            analysis.totalBytes
        )
    );


    addResult(
        "Imágenes",
        analysis.images.length
    );


    addResult(
        "Audio",
        analysis.audio.length
    );


    addResult(
        "Vídeos",
        analysis.videos.length
    );


    addResult(
        "Fuentes",
        analysis.fonts.length
    );


    addResult(
        "JSON",
        analysis.json.length
    );


    addResult(
        "Charts",
        analysis.charts.length
    );


    addResult(
        "Lua",
        analysis.lua.length
    );


    addResult(
        "Scripts",
        analysis.scripts.length
    );


    addResult(
        "Shaders",
        analysis.shaders.length
    );


    addResult(
        "Texto",
        analysis.text.length
    );


    addResult(
        "Archivos empaquetados",
        analysis.archives.length
    );


    addResult(
        "Otros",
        analysis.other.length
    );


    addResult(
        "Personajes",
        analysis.characters.length
    );


    addResult(
        "Stages",
        analysis.stages.length
    );


    addResult(
        "Songs",
        analysis.songs.length
    );


    addResult(
        "Eventos",
        analysis.events.length
    );


    if (
        analysis.charts.length
    )
    {
        addResult(
            "Charts encontrados",
            analysis.charts
                .slice(
                    0,
                    30
                )
                .map(
                    chart =>
                    `${chart.song} | ${
                        chart.file
                    } | ${
                        chart.noteCount
                    } notas`
                )
                .join("\n")
        );
    }
}


/* ============================================================
 ANALIZAR TODO
============================================================ */

analyzeButton.addEventListener(
    "click",
    async () =>
    {
        if (
            !selectedZip
        )
        {
            return;
        }


        analyzeButton.disabled =
            true;

        buildButton.disabled =
            true;


        try
        {
            setStatus(
                "📦 Abriendo TODO el ZIP..."
            );

            setProgress(10);


            zipFiles =
                await readFullZip(
                    selectedZip
                );


            setProgress(55);


            setStatus(
                "🧠 Analizando cada archivo..."
            );


            analysis =
                analyzeZipFiles(
                    zipFiles
                );


            setProgress(90);


            displayAnalysis();


            fileListCard.classList.remove(
                "hidden"
            );


            renderFileList();


            setProgress(100);


            buildButton.disabled =
                false;


            setStatus(
                "✅ ANÁLISIS COMPLETO\n\n" +
                `Archivos encontrados: ${
                    analysis.total
                }\n` +
                `Tamaño: ${
                    formatBytes(
                        analysis.totalBytes
                    )
                }\n\n` +
                "Se conservaron todos los archivos."
            );
        }
        catch(error)
        {
            console.error(error);


            setStatus(
                "❌ ERROR LEYENDO ZIP\n\n" +
                error.message
            );
        }
        finally
        {
            analyzeButton.disabled =
                false;
        }
    }
);


/* ============================================================
 CONSTRUIR PROYECTO
============================================================ */

buildButton.addEventListener(
    "click",
    async () =>
    {
        if (
            !zipFiles.length ||
            !analysis
        )
        {
            return;
        }


        buildButton.disabled =
            true;

        analyzeButton.disabled =
            true;


        try
        {
            setStatus(
                "🌐 Preparando proyecto web..."
            );


            setProgress(10);


            const project =
                buildWebProject(
                    zipFiles,
                    analysis
                );


            setProgress(40);


            /*
             * Sin compresión.
             * Esto reduce muchísimo el uso de CPU/RAM.
             */

            const output =
                fflate.zipSync(
                    project,
                    {
                        level: 0
                    }
                );


            setProgress(90);


            const blob =
                new Blob(
                    [output],
                    {
                        type:
                            "application/zip"
                    }
                );


            downloadBlob(
                blob,
                "MissaWeb.zip"
            );


            setProgress(100);


            setStatus(
                "✅ MISSA WEB GENERADO\n\n" +
                "MissaWeb.zip fue descargado.\n\n" +
                "Los archivos originales fueron " +
                "conservados en:\n" +
                "assets/original/"
            );
        }
        catch(error)
        {
            console.error(error);


            setStatus(
                "❌ ERROR GENERANDO PROYECTO\n\n" +
                error.message
            );
        }
        finally
        {
            buildButton.disabled =
                false;

            analyzeButton.disabled =
                false;
        }
    }
);


/* ============================================================
 PROYECTO WEB
============================================================ */

function buildWebProject(
    files,
    analysis
)
{
    const project = {};


    /*
     * --------------------------------------------------------
     * TODOS LOS ARCHIVOS ORIGINALES
     * --------------------------------------------------------
     */

    for (
        const file
        of files
    )
    {
        if (
            !file.name ||
            file.name.endsWith("/")
        )
        {
            continue;
        }


        const safe =
            cleanPath(
                file.name
            );


        project[
            `assets/original/${safe}`
        ] =
            file.data;
    }


    /*
     * --------------------------------------------------------
     * MANIFEST
     * --------------------------------------------------------
     */

    const manifest =
    {
        converter:
        {
            version:
                "10.0.0"
        },

        source:
        {
            filename:
                selectedZip.name,

            size:
                selectedZip.size
        },

        statistics:
        {
            total:
                analysis.total,

            totalBytes:
                analysis.totalBytes,

            images:
                analysis.images.length,

            audio:
                analysis.audio.length,

            videos:
                analysis.videos.length,

            fonts:
                analysis.fonts.length,

            json:
                analysis.json.length,

            charts:
                analysis.charts.length,

            lua:
                analysis.lua.length,

            scripts:
                analysis.scripts.length,

            shaders:
                analysis.shaders.length,

            text:
                analysis.text.length,

            archives:
                analysis.archives.length,

            other:
                analysis.other.length,

            characters:
                analysis.characters.length,

            stages:
                analysis.stages.length,

            songs:
                analysis.songs.length,

            events:
                analysis.events.length
        },

        files:
        {
            images:
                analysis.images,

            audio:
                analysis.audio,

            videos:
                analysis.videos,

            fonts:
                analysis.fonts,

            json:
                analysis.json,

            lua:
                analysis.lua,

            scripts:
                analysis.scripts,

            shaders:
                analysis.shaders,

            text:
                analysis.text,

            archives:
                analysis.archives,

            other:
                analysis.other
        },

        charts:
            analysis.charts,

        characters:
            analysis.characters,

        stages:
            analysis.stages,

        songs:
            analysis.songs,

        events:
            analysis.events
    };


    project[
        "manifest.json"
    ] =
        new TextEncoder()
            .encode(
                JSON.stringify(
                    manifest,
                    null,
                    4
                )
            );


    /*
     * --------------------------------------------------------
     * HTML
     * --------------------------------------------------------
     */

    project[
        "index.html"
    ] =
        new TextEncoder()
            .encode(
                createGameHTML(
                    analysis
                )
            );


    /*
     * --------------------------------------------------------
     * GAME JS
     * --------------------------------------------------------
     */

    project[
        "game.js"
    ] =
        new TextEncoder()
            .encode(
                createGameJS()
            );


    /*
     * --------------------------------------------------------
     * CSS
     * --------------------------------------------------------
     */

    project[
        "style.css"
    ] =
        new TextEncoder()
            .encode(
                createGameCSS()
            );


    /*
     * --------------------------------------------------------
     * README
     * --------------------------------------------------------
     */

    project[
        "README.txt"
    ] =
        new TextEncoder()
            .encode(
                createREADME(
                    analysis
                )
            );


    return project;
}


/* ============================================================
 HTML JUEGO
============================================================ */

function createGameHTML(
    analysis
)
{
    const charts =
        analysis.charts
            .map(
                (chart, index) =>
                `
<option value="${escapeHTMLAttribute(
    chart.file
)}">
${escapeHTML(
    chart.song ||
    `Chart ${index + 1}`
)}
</option>
`
            )
            .join("");


    return `<!DOCTYPE html>

<html lang="es">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>Missa Web</title>

<link
    rel="stylesheet"
    href="style.css"
>

</head>

<body>

<div id="menu">

<h1>🎵 MISSA WEB</h1>

<p>
Proyecto creado a partir de los datos reales.
</p>

${
    charts
        ? `
<label>
Chart
</label>

<select id="chart">

${charts}

</select>

<br>
`
        : `
<p>
⚠️ No se detectaron charts automáticamente.
</p>
`
}

<button id="inspect">
🔎 VER MANIFEST
</button>

<p id="status">
Preparado.
</p>

</div>

<canvas id="game"></canvas>

<script src="game.js"></script>

</body>

</html>`;
}


/* ============================================================
 GAME JS
============================================================ */

function createGameJS()
{
    return `
"use strict";

const status =
    document.getElementById(
        "status"
    );

const inspectButton =
    document.getElementById(
        "inspect"
    );


inspectButton.addEventListener(
    "click",
    async () =>
    {
        try
        {
            const response =
                await fetch(
                    "manifest.json"
                );

            const manifest =
                await response.json();

            status.textContent =
                "Archivos: " +
                manifest.statistics.total +
                "\\n" +
                "Charts: " +
                manifest.statistics.charts +
                "\\n" +
                "Audio: " +
                manifest.statistics.audio +
                "\\n" +
                "Imágenes: " +
                manifest.statistics.images +
                "\\n" +
                "Vídeos: " +
                manifest.statistics.videos;
        }
        catch(error)
        {
            status.textContent =
                "Error leyendo manifest: " +
                error.message;
        }
    }
);
`;
}


/* ============================================================
 CSS JUEGO
============================================================ */

function createGameCSS()
{
    return `
html,
body
{
    margin:0;

    width:100%;
    height:100%;

    overflow:hidden;

    background:#101010;

    color:white;

    font-family:
        Arial,
        sans-serif;
}

#menu
{
    position:fixed;

    z-index:10;

    left:50%;
    top:50%;

    transform:
        translate(
            -50%,
            -50%
        );

    width:min(
        600px,
        90%
    );

    padding:30px;

    background:#181818;

    border:
        1px solid #333;

    border-radius:16px;

    text-align:center;
}

button,
select
{
    margin-top:12px;

    padding:12px;

    border-radius:8px;
}

button
{
    cursor:pointer;

    font-weight:bold;
}

#game
{
    display:block;

    width:100vw;
    height:100vh;
}
`;
}


/* ============================================================
 README
============================================================ */

function createREADME(
    analysis
)
{
    return `
MISSA WEB V10
=============

FUENTE:
${selectedZip.name}

TODO EL ZIP FUE CONSERVADO.

ARCHIVOS:
${analysis.total}

TAMAÑO:
${formatBytes(
    analysis.totalBytes
)}

IMÁGENES:
${analysis.images.length}

AUDIO:
${analysis.audio.length}

VIDEOS:
${analysis.videos.length}

FUENTES:
${analysis.fonts.length}

JSON:
${analysis.json.length}

CHARTS:
${analysis.charts.length}

LUA:
${analysis.lua.length}

SCRIPTS:
${analysis.scripts.length}

SHADERS:
${analysis.shaders.length}

TEXTO:
${analysis.text.length}

ARCHIVOS EMPAQUETADOS:
${analysis.archives.length}

OTROS:
${analysis.other.length}

PERSONAJES:
${analysis.characters.length}

STAGES:
${analysis.stages.length}

SONGS:
${analysis.songs.length}

EVENTOS:
${analysis.events.length}


ESTRUCTURA:

assets/original/
    TODOS los archivos del ZIP original.

manifest.json
    Mapa completo del contenido.

index.html
game.js
style.css
    Base del proyecto web.


IMPORTANTE:

Esta versión NO elimina archivos desconocidos.

El objetivo es tener una copia web completa
del contenido recuperado y construir encima
el runtime FNF.

El siguiente paso es interpretar los datos
reales para reproducir el comportamiento del
juego original.
`;
}


/* ============================================================
 ESCAPAR HTML
============================================================ */

function escapeHTML(value)
{
    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        );
}


function escapeHTMLAttribute(value)
{
    return escapeHTML(
        value
    )
        .replaceAll(
            '"',
            "&quot;"
        );
}


/* ============================================================
 DESCARGAR
============================================================ */

function downloadBlob(
    blob,
    filename
)
{
    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href =
        url;

    link.download =
        filename;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    setTimeout(
        () =>
            URL.revokeObjectURL(
                url
            ),
        5000
    );
}


/* ============================================================
 START
============================================================ */

setStatus(
    "✅ V10 cargada.\n\n" +
    "Selecciona el ZIP completo del juego."
);
