"use strict";

const zipInput =
    document.getElementById("zipInput");

const zipDrop =
    document.getElementById("zipDrop");

const analyzeButton =
    document.getElementById("analyzeButton");

const buildButton =
    document.getElementById("buildButton");

const statusBox =
    document.getElementById("status");

const resultsBox =
    document.getElementById("results");

const progressBar =
    document.getElementById("progressBar");

let selectedZip = null;
let zipFiles = [];
let analysis = null;


/* ============================================================
   ESTA FUNCIÓN EXISTE ANTES DE TODO LO DEMÁS
============================================================ */

window.addResult = function (
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
};


function setStatus(text)
{
    statusBox.textContent =
        text;
}


function setProgress(value)
{
    progressBar.style.width =
        `${value}%`;
}


function formatBytes(bytes)
{
    if (bytes < 1024)
        return `${bytes} B`;

    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(2)} KB`;

    if (bytes < 1024 * 1024 * 1024)
        return `${(
            bytes /
            1024 /
            1024
        ).toFixed(2)} MB`;

    return `${(
        bytes /
        1024 /
        1024 /
        1024
    ).toFixed(2)} GB`;
}


/* ============================================================
   SELECCIÓN ZIP
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
        if (!zipInput.files.length)
            return;

        selectedZip =
            zipInput.files[0];

        analyzeButton.disabled =
            false;

        buildButton.disabled =
            true;

        setStatus(
            "📦 ZIP seleccionado\n\n" +
            selectedZip.name +
            "\n" +
            formatBytes(
                selectedZip.size
            ) +
            "\n\n" +
            "Pulsa ANALIZAR TODO."
        );
    }
);


/* ============================================================
   DRAG & DROP
============================================================ */

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

        if (!event.dataTransfer.files.length)
            return;

        selectedZip =
            event.dataTransfer.files[0];

        analyzeButton.disabled =
            false;

        buildButton.disabled =
            true;

        setStatus(
            "📦 ZIP seleccionado\n\n" +
            selectedZip.name +
            "\n" +
            formatBytes(
                selectedZip.size
            )
        );
    }
);


/* ============================================================
   LEER ZIP
============================================================ */

async function readZip(file)
{
    const buffer =
        await file.arrayBuffer();

    const bytes =
        new Uint8Array(buffer);

    const unpacked =
        fflate.unzipSync(
            bytes
        );

    return Object.entries(
        unpacked
    ).map(
        ([name, data]) =>
        ({
            name,
            data
        })
    );
}


/* ============================================================
   ANALIZAR ZIP
============================================================ */

function analyzeZip(files)
{
    const result =
    {
        total: 0,
        images: 0,
        audio: 0,
        videos: 0,
        fonts: 0,
        json: 0,
        charts: 0,
        lua: 0,
        scripts: 0,
        shaders: 0,
        other: 0
    };


    for (const file of files)
    {
        if (
            !file.name ||
            file.name.endsWith("/")
        )
        {
            continue;
        }

        result.total++;

        const lower =
            file.name.toLowerCase();


        if (
            /\.(png|jpg|jpeg|webp|bmp|gif)$/i
                .test(lower)
        )
        {
            result.images++;
        }


        else if (
            /\.(ogg|mp3|wav|m4a|aac|flac)$/i
                .test(lower)
        )
        {
            result.audio++;
        }


        else if (
            /\.(mp4|webm|mov|avi|mkv)$/i
                .test(lower)
        )
        {
            result.videos++;
        }


        else if (
            /\.(ttf|otf|woff|woff2)$/i
                .test(lower)
        )
        {
            result.fonts++;
        }


        else if (
            lower.endsWith(".json")
        )
        {
            result.json++;

            try
            {
                const object =
                    JSON.parse(
                        new TextDecoder(
                            "utf-8"
                        ).decode(
                            file.data
                        )
                    );

                if (
                    object.song &&
                    Array.isArray(
                        object.song.notes
                    )
                )
                {
                    result.charts++;
                }
            }
            catch
            {
                // No es JSON válido.
            }
        }


        else if (
            lower.endsWith(".lua")
        )
        {
            result.lua++;
        }


        else if (
            /\.(hx|hscript|js|ts)$/i
                .test(lower)
        )
        {
            result.scripts++;
        }


        else if (
            /\.(frag|vert|glsl|shader)$/i
                .test(lower)
        )
        {
            result.shaders++;
        }


        else
        {
            result.other++;
        }
    }

    return result;
}


/* ============================================================
   ANALIZAR BOTÓN
============================================================ */

analyzeButton.addEventListener(
    "click",
    async () =>
    {
        if (!selectedZip)
        {
            setStatus(
                "❌ No hay ZIP seleccionado."
            );

            return;
        }

        try
        {
            analyzeButton.disabled =
                true;

            setStatus(
                "📦 Abriendo ZIP completo..."
            );

            setProgress(20);

            zipFiles =
                await readZip(
                    selectedZip
                );

            setProgress(60);

            setStatus(
                "🧠 Analizando archivos..."
            );

            analysis =
                analyzeZip(
                    zipFiles
                );

            resultsBox.innerHTML =
                "";

            addResult(
                "Archivos totales",
                analysis.total
            );

            addResult(
                "Imágenes",
                analysis.images
            );

            addResult(
                "Audio",
                analysis.audio
            );

            addResult(
                "Vídeos",
                analysis.videos
            );

            addResult(
                "Fuentes",
                analysis.fonts
            );

            addResult(
                "JSON",
                analysis.json
            );

            addResult(
                "Charts",
                analysis.charts
            );

            addResult(
                "Lua",
                analysis.lua
            );

            addResult(
                "Scripts",
                analysis.scripts
            );

            addResult(
                "Shaders",
                analysis.shaders
            );

            addResult(
                "Otros",
                analysis.other
            );

            setProgress(100);

            buildButton.disabled =
                false;

            setStatus(
                "✅ ZIP ANALIZADO\n\n" +
                `Archivos encontrados: ${
                    analysis.total
                }\n\n` +
                "Todos los archivos permanecen " +
                "en memoria y podrán copiarse " +
                "al proyecto web."
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
   ZIP → PROYECTO WEB
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
            setStatus(
                "❌ Primero analiza el ZIP."
            );

            return;
        }

        try
        {
            buildButton.disabled =
                true;

            setStatus(
                "🌐 Construyendo proyecto..."
            );

            setProgress(10);

            const project = {};


            /*
             * COPIAR TODO EL ZIP.
             */

            for (
                const file
                of zipFiles
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
                    file.name
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

                project[
                    `assets/original/${safe}`
                ] =
                    file.data;
            }


            /*
             * MANIFEST
             */

            project[
                "manifest.json"
            ] =
                new TextEncoder()
                    .encode(
                        JSON.stringify(
                        {
                            version:
                                "10.1.0",

                            source:
                            {
                                name:
                                    selectedZip.name,

                                size:
                                    selectedZip.size
                            },

                            statistics:
                                analysis
                        },
                        null,
                        4
                        )
                    );


            /*
             * HTML REAL DE ENTRADA
             */

            project[
                "index.html"
            ] =
                new TextEncoder()
                    .encode(
`<!DOCTYPE html>

<html lang="es">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>Missa Web</title>

<style>

html,body
{
    margin:0;
    width:100%;
    height:100%;

    background:#101010;
    color:white;

    font-family:Arial;
}

#menu
{
    position:absolute;

    left:50%;
    top:50%;

    transform:
        translate(-50%,-50%);

    text-align:center;
}

button
{
    padding:15px 25px;
    font-weight:bold;
    cursor:pointer;
}

</style>

</head>

<body>

<div id="menu">

<h1>🎵 MISSA WEB</h1>

<p>
Proyecto generado con los datos reales
del ZIP del juego.
</p>

<button id="inspect">
🔎 VER DATOS DEL JUEGO
</button>

<pre id="info">
Esperando...
</pre>

</div>

<script src="game.js"></script>

</body>

</html>`
                    );


            /*
             * GAME.JS
             */

            project[
                "game.js"
            ] =
                new TextEncoder()
                    .encode(
`"use strict";

const button =
    document.getElementById("inspect");

const info =
    document.getElementById("info");

button.addEventListener(
    "click",
    async () =>
    {
        const response =
            await fetch(
                "manifest.json"
            );

        const manifest =
            await response.json();

        info.textContent =
            JSON.stringify(
                manifest.statistics,
                null,
                2
            );
    }
);`
                    );


            /*
             * README
             */

            project[
                "README.txt"
            ] =
                new TextEncoder()
                    .encode(
`MISSA WEB

Este proyecto contiene:

- Todos los archivos originales
  del ZIP dentro de:

  assets/original/

- manifest.json
- index.html
- game.js

IMPORTANTE:

El contenido original NO fue eliminado.

El runtime de juego se irá construyendo
sobre estos datos reales.
`
                    );


            setProgress(60);

            setStatus(
                "📦 Creando ZIP de salida..."
            );


            const output =
                fflate.zipSync(
                    project,
                    {
                        level: 0
                    }
                );


            setProgress(100);


            const blob =
                new Blob(
                    [output],
                    {
                        type:
                            "application/zip"
                    }
                );


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
                "MissaWeb.zip";

            document.body.appendChild(
                link
            );

            link.click();

            link.remove();


            setStatus(
                "✅ PROYECTO GENERADO\n\n" +
                "MissaWeb.zip descargado.\n\n" +
                "Todos los archivos originales " +
                "están dentro de:\n" +
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
        }
    }
);


/* ============================================================
 INICIO
============================================================ */

setStatus(
    "✅ V10.1 cargado correctamente.\n\n" +
    "Selecciona el ZIP completo del juego."
);
