"use strict";

/*
============================================================
 FNF WEB CONVERTER V9

 OBJETIVOS

 1. EXE -> ZIP
    Recuperar recursos binarios reconocibles.

 2. ZIP -> HTML5
    Leer el ZIP ya extraído.
    Clasificar sus archivos.
    Detectar charts Psych Engine.
    Crear un proyecto web que CONSERVE
    los archivos originales.

 IMPORTANTE:
 No se intenta convertir el código nativo
 del EXE directamente a JavaScript.
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

const statusBox =
    document.getElementById("status");

const resultsBox =
    document.getElementById("results");

const progressBar =
    document.getElementById("progressBar");


/* ============================================================
 ESTADO
============================================================ */

let selectedExe = null;
let selectedZip = null;

let zipFiles = [];
let zipAnalysis = null;


/* ============================================================
 UI
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


function clearResults()
{
    resultsBox.innerHTML =
        "";
}


function addResult(
    title,
    value,
    good = true
)
{
    const element =
        document.createElement(
            "div"
        );

    element.className =
        `result ${
            good
                ? "good"
                : "warn"
        }`;

    const titleElement =
        document.createElement(
            "div"
        );

    titleElement.className =
        "result-title";

    titleElement.textContent =
        title;


    const valueElement =
        document.createElement(
            "div"
        );

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


function escapePath(path)
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
        return `${
            (
                bytes /
                1024
            ).toFixed(2)
        } KB`;
    }

    if (
        bytes <
        1024 *
        1024 *
        1024
    )
    {
        return `${
            (
                bytes /
                1024 /
                1024
            ).toFixed(2)
        } MB`;
    }

    return `${
        (
            bytes /
            1024 /
            1024 /
            1024
        ).toFixed(2)
    } GB`;
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
        () =>
        {
            input.click();
        }
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
 EXE SELECTOR
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

        clearResults();

        setProgress(0);

        setStatus(
            "📦 EXE seleccionado\n\n" +
            `Nombre: ${
                file.name
            }\n` +
            `Tamaño: ${
                formatBytes(
                    file.size
                )
            }\n\n` +
            "Pulsa ANALIZAR EXE."
        );
    }
);


/* ============================================================
 ZIP SELECTOR
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

        zipFiles =
            [];

        zipAnalysis =
            null;

        clearResults();

        setProgress(0);

        setStatus(
            "📁 ZIP seleccionado\n\n" +
            `Nombre: ${
                file.name
            }\n` +
            `Tamaño: ${
                formatBytes(
                    file.size
                )
            }\n\n` +
            "Pulsa ANALIZAR ZIP."
        );
    }
);


/* ============================================================
 BYTES / FIRMAS
============================================================ */

function ascii(text)
{
    return Uint8Array.from(
        [...text].map(
            char =>
                char.charCodeAt(0)
        )
    );
}


function hasSignature(
    data,
    offset,
    signature
)
{
    if (
        offset +
        signature.length >
        data.length
    )
    {
        return false;
    }

    for (
        let i = 0;
        i < signature.length;
        i++
    )
    {
        if (
            data[offset + i] !==
            signature[i]
        )
        {
            return false;
        }
    }

    return true;
}


function findSignature(
    data,
    signature,
    start = 0
)
{
    for (
        let i = start;
        i +
            signature.length <=
            data.length;
        i++
    )
    {
        if (
            hasSignature(
                data,
                i,
                signature
            )
        )
        {
            return i;
        }
    }

    return -1;
}


function readU32LE(
    data,
    offset
)
{
    if (
        offset + 4 >
        data.length
    )
    {
        return 0;
    }

    return (
        data[offset] |
        (
            data[offset + 1]
            << 8
        ) |
        (
            data[offset + 2]
            << 16
        ) |
        (
            data[offset + 3]
            << 24
        )
    ) >>> 0;
}


function readU32BE(
    data,
    offset
)
{
    if (
        offset + 4 >
        data.length
    )
    {
        return 0;
    }

    return (
        (
            data[offset]
            << 24
        ) >>> 0
    ) |
    (
        data[offset + 1]
        << 16
    ) |
    (
        data[offset + 2]
        << 8
    ) |
    data[offset + 3];
}


function containsText(
    data,
    text
)
{
    return (
        findSignature(
            data,
            ascii(text)
        ) !== -1
    );
}


/* ============================================================
 EXE ANALYSIS
============================================================ */

function analyzeEXE(
    data
)
{
    const pe =
        data.length >= 2 &&
        data[0] === 0x4D &&
        data[1] === 0x5A;


    const fnf =
        containsText(
            data,
            "Friday Night Funkin"
        ) ||
        containsText(
            data,
            "funkin"
        ) ||
        containsText(
            data,
            "FNF"
        );


    const psych =
        containsText(
            data,
            "Psych Engine"
        ) ||
        containsText(
            data,
            "PsychEngine"
        );


    const flixel =
        containsText(
            data,
            "HaxeFlixel"
        ) ||
        containsText(
            data,
            "flixel"
        );


    return {
        pe,
        fnf,
        psych,
        flixel
    };
}


/* ============================================================
 EXE ANALYZE BUTTON
============================================================ */

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

        exeAnalyze.disabled =
            true;

        exeExtract.disabled =
            true;


        try
        {
            setStatus(
                "📥 Cargando EXE..."
            );

            setProgress(20);

            const buffer =
                await selectedExe.arrayBuffer();

            const data =
                new Uint8Array(
                    buffer
                );

            setStatus(
                "🔎 Analizando..."
            );

            const analysis =
                analyzeEXE(
                    data
                );

            setProgress(100);

            clearResults();

            addResult(
                "Archivo",
                selectedExe.name
            );

            addResult(
                "Tamaño",
                formatBytes(
                    selectedExe.size
                )
            );

            addResult(
                "PE",
                analysis.pe
                    ? "✅ Detectado"
                    : "❌ No detectado",
                analysis.pe
            );

            addResult(
                "FNF",
                analysis.fnf
                    ? "✅ Detectado"
                    : "⚠️ No confirmado",
                analysis.fnf
            );

            addResult(
                "Psych Engine",
                analysis.psych
                    ? "✅ Detectado"
                    : "⚠️ No confirmado",
                analysis.psych
            );

            addResult(
                "HaxeFlixel",
                analysis.flixel
                    ? "✅ Detectado"
                    : "⚠️ No confirmado",
                analysis.flixel
            );

            exeExtract.disabled =
                false;

            setStatus(
                "✅ EXE analizado.\n\n" +
                "Ya puedes pulsar EXTRAER EXE."
            );
        }
        catch(error)
        {
            console.error(error);

            setStatus(
                "❌ Error analizando EXE:\n\n" +
                error.message
            );
        }
        finally
        {
            exeAnalyze.disabled =
                false;
        }
    }
);


/* ============================================================
 PNG
============================================================ */

function extractPNG(
    data,
    start
)
{
    const endMarker =
        ascii("IEND");

    const marker =
        findSignature(
            data,
            endMarker,
            start + 8
        );

    if (
        marker === -1
    )
    {
        return null;
    }

    return data.slice(
        start,
        marker + 8
    );
}


/* ============================================================
 JPEG
============================================================ */

function extractJPEG(
    data,
    start
)
{
    for (
        let i = start + 3;
        i + 1 < data.length;
        i++
    )
    {
        if (
            data[i] === 0xFF &&
            data[i + 1] === 0xD9
        )
        {
            return data.slice(
                start,
                i + 2
            );
        }
    }

    return null;
}


/* ============================================================
 RIFF
============================================================ */

function extractRIFF(
    data,
    start,
    type
)
{
    if (
        !hasSignature(
            data,
            start,
            ascii("RIFF")
        )
    )
    {
        return null;
    }

    if (
        !hasSignature(
            data,
            start + 8,
            ascii(type)
        )
    )
    {
        return null;
    }

    const size =
        readU32LE(
            data,
            start + 4
        );

    const end =
        start +
        8 +
        size;

    if (
        end <= start ||
        end > data.length
    )
    {
        return null;
    }

    return data.slice(
        start,
        end
    );
}


/* ============================================================
 OGG
============================================================ */

function extractOGG(
    data,
    start
)
{
    let position =
        start;

    while (
        position + 27 <=
        data.length
    )
    {
        if (
            !hasSignature(
                data,
                position,
                [
                    0x4F,
                    0x67,
                    0x67,
                    0x53
                ]
            )
        )
        {
            return null;
        }

        const headerType =
            data[
                position + 5
            ];

        const segments =
            data[
                position + 26
            ];

        const tableStart =
            position + 27;

        const payloadStart =
            tableStart +
            segments;

        if (
            payloadStart >
            data.length
        )
        {
            return null;
        }

        let payloadSize =
            0;

        for (
            let i = 0;
            i < segments;
            i++
        )
        {
            payloadSize +=
                data[
                    tableStart + i
                ];
        }

        const pageEnd =
            payloadStart +
            payloadSize;

        if (
            pageEnd >
            data.length
        )
        {
            return null;
        }

        /*
         * OggS header type 0x04 = EOS.
         */

        if (
            headerType & 0x04
        )
        {
            return data.slice(
                start,
                pageEnd
            );
        }

        position =
            pageEnd;
    }

    return null;
}


/* ============================================================
 JSON
============================================================ */

function extractJSONObject(
    data,
    start
)
{
    if (
        data[start] !== 0x7B
    )
    {
        return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    const limit =
        Math.min(
            data.length,
            start +
            16 * 1024 * 1024
        );


    for (
        let i = start;
        i < limit;
        i++
    )
    {
        const byte =
            data[i];

        if (
            inString
        )
        {
            if (
                escaped
            )
            {
                escaped = false;
            }
            else if (
                byte === 0x5C
            )
            {
                escaped = true;
            }
            else if (
                byte === 0x22
            )
            {
                inString = false;
            }

            continue;
        }

        if (
            byte === 0x22
        )
        {
            inString = true;

            continue;
        }

        if (
            byte === 0x7B
        )
        {
            depth++;
        }
        else if (
            byte === 0x7D
        )
        {
            depth--;

            if (
                depth === 0
            )
            {
                const raw =
                    data.slice(
                        start,
                        i + 1
                    );

                try
                {
                    const text =
                        new TextDecoder(
                            "utf-8"
                        ).decode(
                            raw
                        );

                    return {
                        data:
                            raw,

                        object:
                            JSON.parse(
                                text
                            ),

                        end:
                            i + 1
                    };
                }
                catch
                {
                    return null;
                }
            }
        }
    }

    return null;
}


/* ============================================================
 CHART DETECTOR
============================================================ */

function isPsychChart(
    object
)
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


function chartSongName(
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
 ZIP ANALYSIS
============================================================ */

async function readZIP(
    file
)
{
    const buffer =
        await file.arrayBuffer();

    const bytes =
        new Uint8Array(
            buffer
        );

    /*
     * fflate está cargado desde index.html.
     */

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
            name,
            data
        })
    );
}


function analyzeZIP(
    files
)
{
    const analysis =
    {
        total: 0,

        images: [],
        audio: [],
        videos: [],
        json: [],
        lua: [],
        text: [],

        charts: [],
        characters: [],
        stages: [],
        events: []
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

        const name =
            escapePath(
                file.name
            );

        const lower =
            name.toLowerCase();

        analysis.total++;


        /*
         * Imágenes
         */

        if (
            /\.(png|jpg|jpeg|webp|bmp)$/i
                .test(lower)
        )
        {
            analysis.images.push(
                name
            );
        }


        /*
         * Audio
         */

        if (
            /\.(ogg|mp3|wav|m4a|aac)$/i
                .test(lower)
        )
        {
            analysis.audio.push(
                name
            );
        }


        /*
         * Vídeo
         */

        if (
            /\.(mp4|webm|mov|avi)$/i
                .test(lower)
        )
        {
            analysis.videos.push(
                name
            );
        }


        /*
         * Lua
         */

        if (
            lower.endsWith(".lua")
        )
        {
            analysis.lua.push(
                name
            );
        }


        /*
         * TXT/XML/etc.
         */

        if (
            /\.(txt|xml|cfg|ini)$/i
                .test(lower)
        )
        {
            analysis.text.push(
                name
            );
        }


        /*
         * JSON
         */

        if (
            lower.endsWith(".json")
        )
        {
            analysis.json.push(
                name
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
                analysis.charts.push(
                {
                    file:
                        name,

                    song:
                        chartSongName(
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
                analysis.characters.push(
                    name
                );
            }


            if (
                lower.includes(
                    "stage"
                )
            )
            {
                analysis.stages.push(
                    name
                );
            }
        }


        /*
         * Custom events
         */

        if (
            lower.includes(
                "custom_events"
            ) ||
            lower.includes(
                "events"
            )
        )
        {
            analysis.events.push(
                name
            );
        }
    }

    return analysis;
}


function parseJSON(
    data
)
{
    try
    {
        return JSON.parse(
            new TextDecoder(
                "utf-8"
            ).decode(data)
        );
    }
    catch
    {
        return null;
    }
}


/* ============================================================
 ZIP ANALYZE BUTTON
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
                "📦 Abriendo ZIP..."
            );

            setProgress(10);

            zipFiles =
                await readZIP(
                    selectedZip
                );

            setProgress(50);

            zipAnalysis =
                analyzeZIP(
                    zipFiles
                );

            setProgress(100);

            clearResults();

            addResult(
                "Archivos",
                zipAnalysis.total
            );

            addResult(
                "Imágenes",
                zipAnalysis.images.length
            );

            addResult(
                "Audio",
                zipAnalysis.audio.length
            );

            addResult(
                "Vídeos",
                zipAnalysis.videos.length
            );

            addResult(
                "JSON",
                zipAnalysis.json.length
            );

            addResult(
                "Charts Psych Engine",
                zipAnalysis.charts.length
            );

            addResult(
                "Lua",
                zipAnalysis.lua.length
            );

            addResult(
                "Personajes",
                zipAnalysis.characters.length
            );

            addResult(
                "Stages",
                zipAnalysis.stages.length
            );

            addResult(
                "Eventos",
                zipAnalysis.events.length
            );


            if (
                zipAnalysis.charts.length
            )
            {
                addResult(
                    "Charts",
                    zipAnalysis.charts
                        .slice(
                            0,
                            20
                        )
                        .map(
                            chart =>
                                `${chart.song} → ${chart.file}`
                        )
                        .join("\n")
                );
            }


            zipBuild.disabled =
                false;

            setStatus(
                "✅ ZIP analizado.\n\n" +
                "Ahora puedes pulsar " +
                "CONSTRUIR HTML5."
            );
        }
        catch(error)
        {
            console.error(error);

            setStatus(
                "❌ No se pudo abrir el ZIP:\n\n" +
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
 EXE EXTRACT
============================================================ */

exeExtract.addEventListener(
    "click",
    async () =>
    {
        if (
            !selectedExe
        )
        {
            setStatus(
                "❌ Primero selecciona un EXE."
            );

            return;
        }

        exeExtract.disabled =
            true;

        exeAnalyze.disabled =
            true;


        try
        {
            setStatus(
                "📥 Cargando EXE...\n\n" +
                "Esto puede tardar porque " +
                "el archivo es grande."
            );

            setProgress(5);

            const buffer =
                await selectedExe.arrayBuffer();

            const data =
                new Uint8Array(
                    buffer
                );

            setProgress(15);


            const extracted =
                await extractEmbeddedResources(
                    data
                );

            setProgress(90);


            const zipObject = {};


            /*
             * Guardar recursos reales.
             */

            for (
                const file
                of extracted
            )
            {
                zipObject[
                    file.path
                ] =
                    file.data;
            }


            /*
             * Manifest.
             */

            const manifest =
            {
                source:
                {
                    file:
                        selectedExe.name,

                    size:
                        selectedExe.size
                },

                files:
                    extracted.map(
                        file =>
                        ({
                            path:
                                file.path,

                            type:
                                file.type,

                            size:
                                file.data.length,

                            offset:
                                file.offset
                        })
                    )
            };


            zipObject[
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


            setStatus(
                "📦 Generando MissaExtracted.zip..."
            );


            /*
             * Sin compresión para ahorrar RAM.
             */

            const zip =
                fflate.zipSync(
                    zipObject,
                    {
                        level: 0
                    }
                );


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
                "MissaExtracted.zip"
            );


            setProgress(100);

            clearResults();

            addResult(
                "Archivos extraídos",
                extracted.length
            );

            addResult(
                "ZIP",
                "MissaExtracted.zip"
            );


            setStatus(
                "✅ EXTRACCIÓN TERMINADA\n\n" +
                `Recursos recuperados: ${
                    extracted.length
                }\n\n` +
                "Se descargó MissaExtracted.zip."
            );
        }
        catch(error)
        {
            console.error(error);

            setStatus(
                "❌ ERROR EXTRAYENDO EXE:\n\n" +
                error.message
            );
        }
        finally
        {
            exeExtract.disabled =
                false;

            exeAnalyze.disabled =
                false;
        }
    }
);


/* ============================================================
 EXE RESOURCE EXTRACTION
============================================================ */

async function extractEmbeddedResources(
    data
)
{
    const files = [];

    let imageIndex = 0;
    let audioIndex = 0;
    let videoIndex = 0;
    let jsonIndex = 0;


    /*
     * --------------------------------------------------------
     * PNG
     * --------------------------------------------------------
     */

    setStatus(
        "🖼️ Extrayendo PNG..."
    );

    const png =
    [
        0x89,
        0x50,
        0x4E,
        0x47,
        0x0D,
        0x0A,
        0x1A,
        0x0A
    ];

    let position = 0;

    while (true)
    {
        const found =
            findSignature(
                data,
                png,
                position
            );

        if (
            found === -1
        )
        {
            break;
        }

        const extracted =
            extractPNG(
                data,
                found
            );

        if (
            extracted
        )
        {
            imageIndex++;

            files.push(
            {
                path:
                    `images/image_${imageIndex}.png`,

                data:
                    extracted,

                type:
                    "PNG",

                offset:
                    found
            });

            position =
                found +
                extracted.length;
        }
        else
        {
            position =
                found + png.length;
        }
    }


    /*
     * --------------------------------------------------------
     * JPEG
     * --------------------------------------------------------
     */

    setStatus(
        "🖼️ Extrayendo JPEG..."
    );

    const jpeg =
    [
        0xFF,
        0xD8,
        0xFF
    ];

    position = 0;

    while (true)
    {
        const found =
            findSignature(
                data,
                jpeg,
                position
            );

        if (
            found === -1
        )
        {
            break;
        }

        const extracted =
            extractJPEG(
                data,
                found
            );

        if (
            extracted
        )
        {
            imageIndex++;

            files.push(
            {
                path:
                    `images/image_${imageIndex}.jpg`,

                data:
                    extracted,

                type:
                    "JPEG",

                offset:
                    found
            });

            position =
                found +
                extracted.length;
        }
        else
        {
            position =
                found + jpeg.length;
        }
    }


    /*
     * --------------------------------------------------------
     * WAV / WEBP
     * --------------------------------------------------------
     */

    setStatus(
        "🔊 Extrayendo WAV / WEBP..."
    );

    const riff =
        ascii("RIFF");

    position = 0;

    while (true)
    {
        const found =
            findSignature(
                data,
                riff,
                position
            );

        if (
            found === -1
        )
        {
            break;
        }


        if (
            hasSignature(
                data,
                found + 8,
                ascii("WAVE")
            )
        )
        {
            const extracted =
                extractRIFF(
                    data,
                    found,
                    "WAVE"
                );

            if (
                extracted
            )
            {
                audioIndex++;

                files.push(
                {
                    path:
                        `audio/audio_${audioIndex}.wav`,

                    data:
                        extracted,

                    type:
                        "WAV",

                    offset:
                        found
                });

                position =
                    found +
                    extracted.length;

                continue;
            }
        }


        if (
            hasSignature(
                data,
                found + 8,
                ascii("WEBP")
            )
        )
        {
            const extracted =
                extractRIFF(
                    data,
                    found,
                    "WEBP"
                );

            if (
                extracted
            )
            {
                imageIndex++;

                files.push(
                {
                    path:
                        `images/image_${imageIndex}.webp`,

                    data:
                        extracted,

                    type:
                        "WEBP",

                    offset:
                        found
                });

                position =
                    found +
                    extracted.length;

                continue;
            }
        }


        position =
            found + 4;
    }


    /*
     * --------------------------------------------------------
     * OGG
     * --------------------------------------------------------
     */

    setStatus(
        "🎵 Extrayendo OGG..."
    );

    const ogg =
    [
        0x4F,
        0x67,
        0x67,
        0x53
    ];

    position = 0;

    while (true)
    {
        const found =
            findSignature(
                data,
                ogg,
                position
            );

        if (
            found === -1
        )
        {
            break;
        }

        const extracted =
            extractOGG(
                data,
                found
            );

        if (
            extracted
        )
        {
            audioIndex++;

            files.push(
            {
                path:
                    `audio/audio_${audioIndex}.ogg`,

                data:
                    extracted,

                type:
                    "OGG",

                offset:
                    found
            });

            position =
                found +
                extracted.length;
        }
        else
        {
            position =
                found + 4;
        }
    }


    /*
     * --------------------------------------------------------
     * MP4
     * --------------------------------------------------------
     */

    setStatus(
        "🎬 Buscando MP4..."
    );

    const ftyp =
        ascii("ftyp");

    position = 0;

    while (true)
    {
        const found =
            findSignature(
                data,
                ftyp,
                position
            );

        if (
            found === -1
        )
        {
            break;
        }

        const start =
            found - 4;

        if (
            start < 0
        )
        {
            position =
                found + 4;

            continue;
        }

        const boxSize =
            readU32BE(
                data,
                start
            );

        if (
            boxSize < 8 ||
            start + boxSize >
            data.length
        )
        {
            position =
                found + 4;

            continue;
        }


        /*
         * Buscamos el siguiente recurso reconocido
         * como delimitador aproximado.
         */

        let end =
            data.length;


        const nextPNG =
            findSignature(
                data,
                png,
                start + boxSize
            );

        const nextOGG =
            findSignature(
                data,
                ogg,
                start + boxSize
            );

        if (
            nextPNG !== -1
        )
        {
            end =
                Math.min(
                    end,
                    nextPNG
                );
        }

        if (
            nextOGG !== -1
        )
        {
            end =
                Math.min(
                    end,
                    nextOGG
                );
        }


        if (
            end >
            start + 1024
        )
        {
            videoIndex++;

            files.push(
            {
                path:
                    `video/video_${videoIndex}.mp4`,

                data:
                    data.slice(
                        start,
                        end
                    ),

                type:
                    "MP4",

                offset:
                    start
            });
        }


        position =
            Math.max(
                end,
                found + 4
            );
    }


    /*
     * --------------------------------------------------------
     * JSON
     * --------------------------------------------------------
     */

    setStatus(
        "📊 Buscando JSON..."
    );

    position = 0;

    while (true)
    {
        const found =
            findSignature(
                data,
                [0x7B],
                position
            );

        if (
            found === -1
        )
        {
            break;
        }

        const extracted =
            extractJSONObject(
                data,
                found
            );

        if (
            extracted
        )
        {
            jsonIndex++;

            files.push(
            {
                path:
                    `data/data_${jsonIndex}.json`,

                data:
                    extracted.data,

                type:
                    "JSON",

                offset:
                    found
            });

            position =
                extracted.end;
        }
        else
        {
            position =
                found + 1;
        }
    }


    return files;
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

        zipAnalyze.disabled =
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


            setProgress(70);


            /*
             * STORE = 0.
             * Evita consumir mucha RAM comprimiendo
             * cientos de MB.
             */

            const zip =
                fflate.zipSync(
                    project,
                    {
                        level: 0
                    }
                );


            setProgress(100);


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


            clearResults();

            addResult(
                "Archivos originales",
                zipFiles.length
            );

            addResult(
                "Charts",
                zipAnalysis.charts.length
            );

            addResult(
                "Proyecto",
                "MissaWeb.zip ✅"
            );


            setStatus(
                "✅ PROYECTO GENERADO\n\n" +
                "MissaWeb.zip fue descargado.\n\n" +
                "El ZIP contiene los archivos originales " +
                "dentro de assets/original/."
            );
        }
        catch(error)
        {
            console.error(error);

            setStatus(
                "❌ ERROR CONSTRUYENDO HTML5:\n\n" +
                error.message
            );
        }
        finally
        {
            zipBuild.disabled =
                false;

            zipAnalyze.disabled =
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
     * ============================================
     * COPIAR DATOS REALES
     * ============================================
     *
     * NO inventamos assets.
     *
     * Todo lo que estaba en el ZIP se conserva.
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

        const cleanPath =
            escapePath(
                file.name
            );

        project[
            `assets/original/${cleanPath}`
        ] =
            file.data;
    }


    /*
     * ============================================
     * MANIFEST
     * ============================================
     */

    const manifest =
    {
        converter:
        {
            version:
                "9.0.0"
        },

        source:
        {
            zip:
                selectedZip.name,

            originalFiles:
                originalFiles.length
        },

        resources:
        {
            images:
                analysis.images,

            audio:
                analysis.audio,

            videos:
                analysis.videos,

            json:
                analysis.json,

            lua:
                analysis.lua,

            events:
                analysis.events
        },

        charts:
            analysis.charts,

        characters:
            analysis.characters,

        stages:
            analysis.stages
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
     * ============================================
     * WEB HTML
     * ============================================
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
     * ============================================
     * GAME ENGINE
     * ============================================
     */

    project[
        "game.js"
    ] =
        new TextEncoder()
            .encode(
                createGameJS()
            );


    /*
     * ============================================
     * CSS
     * ============================================
     */

    project[
        "style.css"
    ] =
        new TextEncoder()
            .encode(
                createGameCSS()
            );


    /*
     * ============================================
     * README
     * ============================================
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
 GAME HTML
============================================================ */

function createGameHTML(
    analysis
)
{
    let chartsHTML = "";

    if (
        analysis.charts.length
    )
    {
        chartsHTML =
            analysis.charts
                .map(
                    (chart, index) =>
                    `
<option value="${
    escapePath(
        chart.file
    )
}">
${
    chart.song ||
    `Chart ${index + 1}`
}
</option>
`
                )
                .join("");
    }
    else
    {
        chartsHTML =
`
<option>
No se detectaron charts
</option>
`;
    }


    let audioHTML = "";

    if (
        analysis.audio.length
    )
    {
        audioHTML =
            analysis.audio
                .map(
                    audio =>
                    `
<option value="${
    escapePath(audio)
}">
${
    escapePath(audio)
}
</option>
`
                )
                .join("");
    }
    else
    {
        audioHTML =
`
<option>
No se detectó audio
</option>
`;
    }


    return `
<!DOCTYPE html>

<html lang="es">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>Missa V3 Web</title>

<link
    rel="stylesheet"
    href="style.css"
>

</head>

<body>

<div id="menu">

<h1>🎵 MISSA V3 WEB</h1>

<p>
Los recursos pertenecen al paquete extraído.
</p>

<label>
Chart
</label>

<select id="chart">

${chartsHTML}

</select>

<br>

<label>
Audio
</label>

<select id="audio">

${audioHTML}

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

const menu =
    document.getElementById(
        "menu"
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

const info =
    document.getElementById(
        "info"
    );


const KEYS =
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


/*
============================================================
 CARGAR CHART

 El chart se encuentra en:

 assets/original/<ruta>
============================================================
*/

async function loadChart(
    originalPath
)
{
    const url =
        "assets/original/" +
        originalPath;

    const response =
        await fetch(
            url
        );

    if (
        !response.ok
    )
    {
        throw new Error(
            "No se pudo cargar el chart:\n" +
            originalPath
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
            "Este archivo no tiene " +
            "una estructura de chart compatible."
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
            !section ||
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
                !Array.isArray(raw) ||
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
                    ) %
                    4 +
                    4
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


/*
============================================================
 AUDIO
============================================================
*/

async function loadAudio(
    originalPath
)
{
    const url =
        "assets/original/" +
        originalPath;


    audio =
        new Audio(
            url
        );


    audio.preload =
        "auto";


    await new Promise(
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
                {
                    reject(
                        new Error(
                            "No se pudo cargar:\n" +
                            originalPath
                        )
                    );
                },
                {
                    once:true
                }
            );
        }
    );
}


/*
============================================================
 JUGAR
============================================================
*/

playButton.addEventListener(
    "click",
    async () =>
    {
        try
        {
            if (
                !chartSelect.value ||
                chartSelect.value.startsWith(
                    "No se"
                )
            )
            {
                throw new Error(
                    "No hay charts disponibles."
                );
            }


            if (
                !audioSelect.value ||
                audioSelect.value.startsWith(
                    "No se"
                )
            )
            {
                throw new Error(
                    "No hay audio disponible."
                );
            }


            await loadChart(
                chartSelect.value
            );

            await loadAudio(
                audioSelect.value
            );


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


            score = 0;
            combo = 0;
            misses = 0;
            health = 1;


            menu.style.display =
                "none";


            playing = true;


            await audio.play();
        }
        catch(error)
        {
            console.error(error);

            alert(
                error.message
            );
        }
    }
);


/*
============================================================
 INPUT
============================================================
*/

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
            KEYS.indexOf(
                event.code
            );


        if (
            lane < 0
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
    if (
        !audio
    )
    {
        return;
    }


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
            distance =
                d;

            best =
                note;
        }
    }


    if (
        !best
    )
    {
        return;
    }


    if (
        distance <= 45
    )
    {
        best.hit =
            true;

        score +=
            350;

        combo++;
    }
    else if (
        distance <= 90
    )
    {
        best.hit =
            true;

        score +=
            200;

        combo++;
    }
    else if (
        distance <= 135
    )
    {
        best.hit =
            true;

        score +=
            100;

        combo++;
    }
}


/*
============================================================
 UPDATE
============================================================
*/

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
            note.missed =
                true;

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
        playing =
            false;

        menu.style.display =
            "block";
    }
}


/*
============================================================
 DIBUJAR FLECHA
============================================================
*/

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


/*
============================================================
 DIBUJAR JUEGO
============================================================
*/

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
        "#ffffff";


    ctx.font =
        "bold 20px Arial";


    ctx.fillText(
        "Score: " +
        score,
        20,
        30
    );


    ctx.fillText(
        "Combo: " +
        combo,
        20,
        60
    );


    ctx.fillText(
        "Misses: " +
        misses,
        20,
        90
    );


    const laneWidth =
        Math.min(
            110,
            canvas.width / 6
        );


    const total =
        laneWidth *
        4;


    const startX =
        (
            canvas.width -
            total
        ) / 2;


    const receptorY =
        canvas.height -
        150;


    /*
     * Receptores
     */

    for (
        let lane = 0;
        lane < 4;
        lane++
    )
    {
        ctx.strokeStyle =
            "#ffffff";

        ctx.lineWidth =
            3;


        ctx.strokeRect(
            startX +
            lane *
            laneWidth +
            8,

            receptorY,

            laneWidth -
            16,

            60
        );


        drawArrow(
            startX +
            lane *
            laneWidth +
            laneWidth / 2,

            receptorY + 30,

            lane,

            20
        );
    }


    /*
     * Notas
     */

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
                receptorY -
                delta *
                0.55;


            if (
                y <
                -100 ||
                y >
                canvas.height +
                100
            )
            {
                continue;
            }


            ctx.fillStyle =
                "#ffffff";


            ctx.fillRect(
                startX +
                note.lane *
                laneWidth +
                10,

                y,

                laneWidth -
                20,

                45
            );


            ctx.fillStyle =
                "#111";


            drawArrow(
                startX +
                note.lane *
                laneWidth +
                laneWidth / 2,

                y + 22,

                note.lane,

                17
            );
        }
    }
}


/*
============================================================
 LOOP
============================================================
*/

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
 GAME CSS
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
        550px,
        90%
    );

    padding:30px;

    background:#181818;

    border:
        1px solid #333;

    border-radius:16px;

    text-align:center;
}

#menu h1
{
    margin-top:0;
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

Conversor V9.

Este proyecto conserva los archivos reales
que estaban dentro del ZIP original.

ARCHIVOS:
${zipFiles.length}

IMÁGENES:
${analysis.images.length}

AUDIO:
${analysis.audio.length}

VÍDEOS:
${analysis.videos.length}

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

EVENTOS:
${analysis.events.length}


ESTRUCTURA:

assets/original/
    Archivos originales del ZIP.

manifest.json
    Mapa de los datos encontrados.

index.html
    Punto de entrada web.

game.js
    Runtime FNF experimental.

style.css
    Interfaz.


IMPORTANTE:

El objetivo es utilizar los datos reales del juego.

Esta versión todavía no reproduce todas las
funciones de Psych Engine.

El siguiente trabajo consiste en conectar
automáticamente los charts, audios, personajes,
stages, eventos y vídeos reales del mod.
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
        5000
    );
}


/* ============================================================
 INICIO
============================================================ */

setStatus(
    "✅ FNF Web Converter V9 cargado.\n\n" +
    "EXE → ZIP o ZIP → HTML5."
);
