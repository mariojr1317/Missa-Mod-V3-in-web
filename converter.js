"use strict";

/*
============================================================
 FNF WEB CONVERTER V8

 FUNCIONES:

 1. EXE -> análisis
 2. ZIP -> análisis
 3. ZIP -> proyecto HTML5

 Busca:

 IMÁGENES
 PNG
 JPG
 JPEG
 WEBP

 AUDIO
 OGG
 MP3
 WAV

 VIDEO
 MP4
 WEBM

 DATOS
 JSON
 LUA
 TXT

 FNF
 Psych Engine
 Charts
 Songs

 El ZIP se procesa localmente.
============================================================
*/


/* ============================================================
 ELEMENTOS
============================================================ */

const exeInput =
    document.getElementById("exeInput");

const exeDrop =
    document.getElementById("exeDrop");

const exeAnalyze =
    document.getElementById("exeAnalyze");

const exeExtract =
    document.getElementById("exeExtract");

const zipInput =
    document.getElementById("zipInput");

const zipDrop =
    document.getElementById("zipDrop");

const zipAnalyze =
    document.getElementById("zipAnalyze");

const zipBuild =
    document.getElementById("zipBuild");

const status =
    document.getElementById("status");

const results =
    document.getElementById("results");

const progressBar =
    document.getElementById("progressBar");


let selectedExe = null;
let selectedZip = null;

let zipFiles = [];
let zipAnalysis = null;


/* ============================================================
 UI
============================================================ */

function setStatus(text)
{
    status.textContent =
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


function clearResults()
{
    results.innerHTML =
        "";
}


function result(
    title,
    value
)
{
    const element =
        document.createElement(
            "div"
        );

    element.className =
        "result";

    element.innerHTML =
        `
        <strong>${escapeHTML(title)}</strong>
        <br>
        <span>${escapeHTML(
            String(value)
        )}</span>
        `;

    results.appendChild(
        element
    );
}


function escapeHTML(value)
{
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ============================================================
 DRAG & DROP
============================================================ */

function setupDropZone(
    zone,
    input,
    callback
)
{
    zone.addEventListener(
        "click",
        () => input.click()
    );

    input.addEventListener(
        "change",
        () =>
        {
            if (
                input.files.length
            )
            {
                callback(
                    input.files[0]
                );
            }
        }
    );

    zone.addEventListener(
        "dragover",
        event =>
        {
            event.preventDefault();

            zone.classList.add(
                "dragging"
            );
        }
    );

    zone.addEventListener(
        "dragleave",
        () =>
        {
            zone.classList.remove(
                "dragging"
            );
        }
    );

    zone.addEventListener(
        "drop",
        event =>
        {
            event.preventDefault();

            zone.classList.remove(
                "dragging"
            );

            if (
                event.dataTransfer.files.length
            )
            {
                callback(
                    event.dataTransfer.files[0]
                );
            }
        }
    );
}


/* ============================================================
 EXE
============================================================ */

setupDropZone(
    exeDrop,
    exeInput,
    file =>
    {
        selectedExe =
            file;

        exeAnalyze.disabled =
            false;

        exeExtract.disabled =
            true;

        setStatus(
            `EXE seleccionado:\n\n` +
            `${file.name}\n` +
            `${formatBytes(file.size)}`
        );
    }
);


exeAnalyze.addEventListener(
    "click",
    async () =>
    {
        if (
            !selectedExe
        )
        {
            return;
        }

        try
        {
            setStatus(
                "🔎 Analizando EXE..."
            );

            const buffer =
                await selectedExe.arrayBuffer();

            const bytes =
                new Uint8Array(
                    buffer
                );

            const pe =
                bytes[0] === 0x4D &&
                bytes[1] === 0x5A;

            clearResults();

            result(
                "Archivo",
                selectedExe.name
            );

            result(
                "Tamaño",
                formatBytes(
                    bytes.length
                )
            );

            result(
                "PE",
                pe
                    ? "Detectado"
                    : "No detectado"
            );

            result(
                "FNF",
                containsText(
                    bytes,
                    "Friday Night Funkin"
                ) ||
                containsText(
                    bytes,
                    "funkin"
                )
                    ? "Detectado"
                    : "No confirmado"
            );

            result(
                "Psych Engine",
                containsText(
                    bytes,
                    "Psych Engine"
                ) ||
                containsText(
                    bytes,
                    "PsychEngine"
                )
                    ? "Detectado"
                    : "No confirmado"
            );

            exeExtract.disabled =
                false;

            setStatus(
                "✅ EXE analizado."
            );
        }
        catch(error)
        {
            setStatus(
                "❌ Error:\n" +
                error.message
            );
        }
    }
);


/* ============================================================
 ZIP
============================================================ */

setupDropZone(
    zipDrop,
    zipInput,
    file =>
    {
        selectedZip =
            file;

        zipAnalyze.disabled =
            false;

        zipBuild.disabled =
            true;

        setStatus(
            `ZIP seleccionado:\n\n` +
            `${file.name}\n` +
            `${formatBytes(file.size)}`
        );
    }
);


/* ============================================================
 ANALIZAR ZIP
============================================================ */

zipAnalyze.addEventListener(
    "click",
    async () =>
    {
        if (
            !selectedZip
        )
        {
            return;
        }

        zipAnalyze.disabled =
            true;

        zipBuild.disabled =
            true;

        try
        {
            setStatus(
                "📦 Leyendo ZIP..."
            );

            setProgress(10);

            const buffer =
                await selectedZip.arrayBuffer();

            const data =
                new Uint8Array(
                    buffer
                );

            /*
                fflate ya está cargado desde index.html.
            */

            const extracted =
                fflate.unzipSync(
                    data
                );

            zipFiles =
                Object.entries(
                    extracted
                ).map(
                    ([name, content]) =>
                    ({
                        name,
                        data: content
                    })
                );

            setProgress(50);

            zipAnalysis =
                analyzeZip(
                    zipFiles
                );

            setProgress(100);

            displayZipAnalysis(
                zipAnalysis
            );

            zipBuild.disabled =
                false;

            setStatus(
                "✅ ZIP analizado correctamente."
            );
        }
        catch(error)
        {
            console.error(error);

            setStatus(
                "❌ No se pudo abrir el ZIP.\n\n" +
                error.message
            );
        }
        finally
        {
            zipAnalyze.disabled =
                false;
        }
    }
);


/* ============================================================
 ANALIZAR CONTENIDO ZIP
============================================================ */

function analyzeZip(
    files
)
{
    const result =
    {
        total: files.length,

        images: [],
        audio: [],
        video: [],
        json: [],
        charts: [],
        lua: [],
        text: [],

        songs: [],
        characters: [],
        stages: []
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

        const lower =
            file.name.toLowerCase();


        /* ----------------------------------------
           IMÁGENES
        ---------------------------------------- */

        if (
            /\.(png|jpg|jpeg|webp|bmp)$/i
                .test(lower)
        )
        {
            result.images.push(
                file.name
            );
        }


        /* ----------------------------------------
           AUDIO
        ---------------------------------------- */

        if (
            /\.(ogg|mp3|wav|m4a|aac)$/i
                .test(lower)
        )
        {
            result.audio.push(
                file.name
            );
        }


        /* ----------------------------------------
           VIDEO
        ---------------------------------------- */

        if (
            /\.(mp4|webm|mov|avi)$/i
                .test(lower)
        )
        {
            result.video.push(
                file.name
            );
        }


        /* ----------------------------------------
           JSON
        ---------------------------------------- */

        if (
            lower.endsWith(
                ".json"
            )
        )
        {
            result.json.push(
                file.name
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
                    name:
                        file.name,

                    data:
                        file.data,

                    song:
                        getChartSong(
                            object
                        )
                });
            }

            if (
                lower.includes(
                    "character"
                )
            )
            {
                result.characters.push(
                    file.name
                );
            }

            if (
                lower.includes(
                    "stage"
                )
            )
            {
                result.stages.push(
                    file.name
                );
            }
        }


        /* ----------------------------------------
           LUA
        ---------------------------------------- */

        if (
            lower.endsWith(
                ".lua"
            )
        )
        {
            result.lua.push(
                file.name
            );
        }


        /* ----------------------------------------
           TXT/XML
        ---------------------------------------- */

        if (
            /\.(txt|xml|cfg|ini)$/i
                .test(lower)
        )
        {
            result.text.push(
                file.name
            );
        }


        /* ----------------------------------------
           SONGS
        ---------------------------------------- */

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
                file.name
            );
        }
    }

    return result;
}


/* ============================================================
 JSON
============================================================ */

function parseJSON(
    data
)
{
    try
    {
        const text =
            new TextDecoder(
                "utf-8"
            ).decode(
                data
            );

        return JSON.parse(
            text
        );
    }
    catch
    {
        return null;
    }
}


function isPsychChart(
    object
)
{
    if (
        !object ||
        typeof object !== "object"
    )
    {
        return false;
    }

    /*
        Estructura típica:
        object.song.notes
        sectionNotes
    */

    if (
        !object.song ||
        typeof object.song !== "object"
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
            Array.isArray(
                section.sectionNotes
            )
    );
}


function getChartSong(
    object
)
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
 RESULTADOS ZIP
============================================================ */

function displayZipAnalysis(
    data
)
{
    clearResults();

    result(
        "Archivos",
        data.total
    );

    result(
        "Imágenes",
        data.images.length
    );

    result(
        "Audio",
        data.audio.length
    );

    result(
        "Vídeos",
        data.video.length
    );

    result(
        "JSON",
        data.json.length
    );

    result(
        "Charts Psych Engine",
        data.charts.length
    );

    result(
        "Lua",
        data.lua.length
    );

    result(
        "Personajes",
        data.characters.length
    );

    result(
        "Stages",
        data.stages.length
    );

    if (
        data.charts.length
    )
    {
        const names =
            data.charts
                .slice(
                    0,
                    20
                )
                .map(
                    chart =>
                        chart.song +
                        " → " +
                        chart.name
                )
                .join("\n");

        result(
            "Charts encontrados",
            names
        );
    }
}


/* ============================================================
 ZIP → HTML5
============================================================ */

zipBuild.addEventListener(
    "click",
    async () =>
    {
        if (
            !zipFiles.length ||
            !zipAnalysis
        )
        {
            return;
        }

        zipBuild.disabled =
            true;

        try
        {
            setStatus(
                "🌐 Construyendo proyecto HTML5..."
            );

            setProgress(10);

            const project =
                buildWebProject(
                    zipFiles,
                    zipAnalysis
                );

            setProgress(60);

            const zip =
                fflate.zipSync(
                    project,
                    {
                        level: 0
                    }
                );

            setProgress(90);

            const blob =
                new Blob(
                    [zip],
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
                "✅ PROYECTO HTML5 GENERADO\n\n" +
                `Archivos originales: ${
                    zipFiles.length
                }\n` +
                `Charts: ${
                    zipAnalysis.charts.length
                }\n\n` +
                "Descargado como MissaWeb.zip"
            );
        }
        catch(error)
        {
            console.error(error);

            setStatus(
                "❌ Error generando el proyecto:\n\n" +
                error.message
            );
        }
        finally
        {
            zipBuild.disabled =
                false;
        }
    }
);


/* ============================================================
 CREAR PROYECTO WEB
============================================================ */

function buildWebProject(
    originalFiles,
    analysis
)
{
    const project = {};


    /*
        1. Copiar TODOS los archivos originales.

        Esto es importante:
        no destruimos los datos que ya conseguimos.
    */

    for (
        const file
        of originalFiles
    )
    {
        if (
            !file.name ||
            file.name.endsWith("/")
        )
        {
            continue;
        }

        /*
            Evitar escapar fuera del proyecto.
        */

        const cleanName =
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
            `assets/original/${cleanName}`
        ] =
            file.data;
    }


    /*
        2. Crear manifest.
    */

    const manifest =
    {
        converter:
        {
            version:
                "8.0.0"
        },

        source:
        {
            zip:
                selectedZip.name,

            files:
                originalFiles.length
        },

        resources:
        {
            images:
                analysis.images,

            audio:
                analysis.audio,

            video:
                analysis.video,

            json:
                analysis.json,

            lua:
                analysis.lua
        },

        charts:
            analysis.charts.map(
                chart =>
                ({
                    file:
                        chart.name,

                    song:
                        chart.song
                })
            ),

        characters:
            analysis.characters,

        stages:
            analysis.stages
    };


    project[
        "manifest.json"
    ] =
        textData(
            JSON.stringify(
                manifest,
                null,
                4
            )
        );


    /*
        3. Crear index.html.
    */

    project[
        "index.html"
    ] =
        textData(
            createGameHTML(
                analysis
            )
        );


    /*
        4. Crear game.js.
    */

    project[
        "game.js"
    ] =
        textData(
            createGameJS()
        );


    /*
        5. Crear style.css.
    */

    project[
        "style.css"
    ] =
        textData(
            createGameCSS()
        );


    /*
        6. README.
    */

    project[
        "README.txt"
    ] =
        textData(
            createREADME(
                analysis
            )
        );


    return project;
}


/* ============================================================
 DATA
============================================================ */

function textData(
    text
)
{
    return new TextEncoder()
        .encode(text);
}


/* ============================================================
 GAME HTML
============================================================ */

function createGameHTML(
    analysis
)
{
    const charts =
        analysis.charts;

    let chartOptions =
        "";

    charts.forEach(
        (chart, index) =>
        {
            chartOptions +=
`
<option value="${
    escapeHTML(
        chart.name
    )
}">
${
    escapeHTML(
        chart.song
    )
}
</option>
`;
        }
    );


    if (!charts.length)
    {
        chartOptions =
`
<option>
No se detectaron charts
</option>
`;
    }


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
Proyecto generado desde ZIP
</p>

<label>
Canción / Chart
</label>

<select id="chart">

${chartOptions}

</select>

<br>

<label>
Audio
</label>

<select id="audio">

${analysis.audio
    .map(
        audio =>
`
<option value="${
    escapeHTML(
        audio
    )
}">
${
    escapeHTML(
        audio
    )
}
</option>
`
    )
    .join("")
}

</select>

<br>

<button id="play">
▶ JUGAR
</button>

<p id="info">
Esperando...
</p>

</div>

<canvas id="gameCanvas"></canvas>

<script src="game.js"></script>

</body>

</html>
`;
}


/* ============================================================
 GAME JS
============================================================ */

function createGameJS()
{
    return String.raw`
"use strict";


const canvas =
    document.getElementById(
        "gameCanvas"
    );

const ctx =
    canvas.getContext(
        "2d"
    );

const chartSelect =
    document.getElementById(
        "chart"
    );

const audioSelect =
    document.getElementById(
        "audio"
    );

const playButton =
    document.getElementById(
        "play"
    );

const menu =
    document.getElementById(
        "menu"
    );

const info =
    document.getElementById(
        "info"
    );


const keys =
[
    "ArrowLeft",
    "ArrowDown",
    "ArrowUp",
    "ArrowRight"
];


let chart = null;
let notes = [];
let audio = null;
let playing = false;

let score = 0;
let combo = 0;
let misses = 0;
let health = 1;


function resize()
{
    canvas.width =
        innerWidth;

    canvas.height =
        innerHeight;
}


addEventListener(
    "resize",
    resize
);

resize();


async function loadChart(
    filename
)
{
    /*
        Los archivos originales se copiaron a:

        assets/original/

    */

    const url =
        "assets/original/" +
        filename;

    const response =
        await fetch(url);

    if (!response.ok)
    {
        throw new Error(
            "No se pudo cargar el chart."
        );
    }

    const data =
        await response.json();

    if (
        !data.song ||
        !Array.isArray(
            data.song.notes
        )
    )
    {
        throw new Error(
            "El JSON no parece un chart compatible."
        );
    }

    chart =
        data.song;

    notes = [];

    for (
        const section
        of chart.notes
    )
    {
        if (
            !Array.isArray(
                section.sectionNotes
            )
        )
        {
            continue;
        }

        for (
            const raw
            of section.sectionNotes
        )
        {
            if (
                !Array.isArray(
                    raw
                ) ||
                raw.length < 2
            )
            {
                continue;
            }

            const time =
                Number(
                    raw[0]
                );

            const lane =
                (
                    Number(
                        raw[1]
                    ) % 4 + 4
                ) % 4;

            notes.push(
            {
                time,
                lane,
                hit: false,
                missed: false
            });
        }
    }

    notes.sort(
        (a,b) =>
            a.time -
            b.time
    );

    info.textContent =
        "Canción: " +
        (
            chart.song ||
            "Unknown"
        ) +
        " | BPM: " +
        (
            chart.bpm ||
            "?"
        ) +
        " | Notas: " +
        notes.length;
}


function loadAudio(
    filename
)
{
    const url =
        "assets/original/" +
        filename;

    audio =
        new Audio(
            url
        );

    audio.preload =
        "auto";

    return new Promise(
        (resolve,reject) =>
        {
            audio.addEventListener(
                "canplaythrough",
                resolve,
                {
                    once:true
                }
            );

            audio.addEventListener(
                "error",
                () =>
                    reject(
                        new Error(
                            "No se pudo cargar el audio."
                        )
                    ),
                {
                    once:true
                }
            );
        }
    );
}


playButton.addEventListener(
    "click",
    async () =>
    {
        try
        {
            await loadChart(
                chartSelect.value
            );

            await loadAudio(
                audioSelect.value
            );

            score = 0;
            combo = 0;
            misses = 0;
            health = 1;

            for (
                const note
                of notes
            )
            {
                note.hit =
                    false;

                note.missed =
                    false;
            }

            menu.style.display =
                "none";

            playing = true;

            await audio.play();
        }
        catch(error)
        {
            alert(
                error.message
            );
        }
    }
);


addEventListener(
    "keydown",
    event =>
    {
        if (
            !playing
        )
        {
            return;
        }

        const lane =
            keys.indexOf(
                event.code
            );

        if (
            lane === -1
        )
        {
            return;
        }

        event.preventDefault();

        hitNote(
            lane
        );
    }
);


function hitNote(
    lane
)
{
    if (!audio)
        return;

    const now =
        audio.currentTime *
        1000;

    let best =
        null;

    let distance =
        Infinity;

    for (
        const note
        of notes
    )
    {
        if (
            note.hit ||
            note.missed
        )
        {
            continue;
        }

        if (
            note.lane !== lane
        )
        {
            continue;
        }

        const d =
            Math.abs(
                note.time -
                now
            );

        if (
            d < distance
        )
        {
            distance = d;
            best = note;
        }
    }

    if (!best)
        return;

    if (
        distance <= 45
    )
    {
        best.hit = true;

        score += 350;
        combo++;

    }
    else if (
        distance <= 90
    )
    {
        best.hit = true;

        score += 200;
        combo++;

    }
    else if (
        distance <= 135
    )
    {
        best.hit = true;

        score += 100;
        combo++;
    }
}


function update()
{
    if (
        !playing ||
        !audio
    )
    {
        return;
    }

    const now =
        audio.currentTime *
        1000;

    for (
        const note
        of notes
    )
    {
        if (
            note.hit ||
            note.missed
        )
        {
            continue;
        }

        if (
            now -
            note.time >
            180
        )
        {
            note.missed = true;

            combo = 0;

            misses++;

            health =
                Math.max(
                    0,
                    health - 0.05
                );
        }
    }

    if (
        audio.ended
    )
    {
        playing = false;

        menu.style.display =
            "block";
    }
}


function drawArrow(
    x,
    y,
    lane,
    size
)
{
    ctx.save();

    ctx.translate(
        x,
        y
    );

    if (
        lane === 0
    )
    {
        ctx.rotate(
            -Math.PI / 2
        );
    }

    if (
        lane === 1
    )
    {
        ctx.rotate(
            Math.PI
        );
    }

    if (
        lane === 3
    )
    {
        ctx.rotate(
            Math.PI / 2
        );
    }

    ctx.beginPath();

    ctx.moveTo(
        size,
        0
    );

    ctx.lineTo(
        0,
        -size
    );

    ctx.lineTo(
        -size,
        0
    );

    ctx.lineTo(
        -size / 2,
        0
    );

    ctx.lineTo(
        -size / 2,
        size
    );

    ctx.lineTo(
        size / 2,
        size
    );

    ctx.lineTo(
        size / 2,
        0
    );

    ctx.closePath();

    ctx.fill();

    ctx.restore();
}


function draw()
{
    ctx.fillStyle =
        "#101010";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.fillStyle =
        "white";

    ctx.font =
        "bold 20px Arial";

    ctx.fillText(
        "Score: " + score,
        20,
        30
    );

    ctx.fillText(
        "Combo: " + combo,
        20,
        60
    );

    ctx.fillText(
        "Misses: " + misses,
        20,
        90
    );

    const laneWidth =
        Math.min(
            110,
            canvas.width / 6
        );

    const total =
        laneWidth * 4;

    const start =
        (
            canvas.width -
            total
        ) / 2;

    const receptor =
        canvas.height -
        150;

    for (
        let lane = 0;
        lane < 4;
        lane++
    )
    {
        ctx.strokeStyle =
            "white";

        ctx.lineWidth =
            3;

        ctx.strokeRect(
            start +
            lane *
            laneWidth +
            8,

            receptor,

            laneWidth - 16,

            60
        );

        drawArrow(
            start +
            lane *
            laneWidth +
            laneWidth / 2,

            receptor + 30,

            lane,

            20
        );
    }

    if (
        audio
    )
    {
        const now =
            audio.currentTime *
            1000;

        for (
            const note
            of notes
        )
        {
            if (
                note.hit ||
                note.missed
            )
            {
                continue;
            }

            const delta =
                note.time -
                now;

            const y =
                receptor -
                delta * 0.55;

            if (
                y < -100 ||
                y >
                canvas.height + 100
            )
            {
                continue;
            }

            ctx.fillStyle =
                "white";

            ctx.fillRect(
                start +
                note.lane *
                laneWidth +
                10,

                y,

                laneWidth - 20,

                45
            );
        }
    }
}


function loop()
{
    update();
    draw();

    requestAnimationFrame(
        loop
    );
}

requestAnimationFrame(
    loop
);
`;
}


/* ============================================================
 CSS DEL JUEGO
============================================================ */

function createGameCSS()
{
    return `
html,
body
{
    margin:0;
    padding:0;

    width:100%;
    height:100%;

    overflow:hidden;

    background:#101010;

    color:white;

    font-family:Arial,sans-serif;
}

#menu
{
    position:fixed;

    z-index:10;

    left:50%;
    top:50%;

    transform:
        translate(-50%,-50%);

    width:min(550px,90%);

    padding:30px;

    background:#181818;

    border:
        1px solid #333;

    border-radius:16px;

    text-align:center;
}

select,
button
{
    padding:12px;

    margin:10px;

    border-radius:8px;
}

button
{
    cursor:pointer;

    font-weight:bold;
}

#gameCanvas
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
MISSA WEB
=========

Generado por FNF Web Converter V8.

ARCHIVOS ORIGINALES:
${zipFiles.length}

IMÁGENES:
${analysis.images.length}

AUDIO:
${analysis.audio.length}

VÍDEOS:
${analysis.video.length}

JSON:
${analysis.json.length}

CHARTS:
${analysis.charts.length}

LUA:
${analysis.lua.length}

PERSONAJES:
${analysis.characters.length}

STAGES:
${analysis.stages.length}


ESTRUCTURA:

assets/original/
    Archivos recuperados del ZIP

manifest.json
    Mapa de los recursos

index.html
    Juego web

game.js
    Runtime FNF experimental

style.css
    Estilos


IMPORTANTE:

Esta versión puede reconocer y cargar
charts con la estructura clásica de
Psych Engine.

Todavía no reproduce automáticamente
todas las funciones del juego original.

El objetivo siguiente es conectar:

chart
+
instrumental
+
voices
+
characters
+
stage
+
events

para reproducir una canción completa.
`;
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
        3000
    );
}


/* ============================================================
 UTILIDAD
============================================================ */

function containsText(
    bytes,
    text
)
{
    const signature =
        ascii(text);

    return (
        findSignature(
            bytes,
            signature
        ) !== -1
    );
}


/* ============================================================
 INICIO
============================================================ */

setStatus(
    "✅ FNF Web Converter V8 cargado.\n\n" +
    "Ahora puedes usar EXE → ZIP o ZIP → HTML5."
);
