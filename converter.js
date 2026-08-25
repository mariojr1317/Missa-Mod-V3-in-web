```javascript
"use strict";

/*
============================================================
 FNF WEB CONVERTER V7

 Detecta y extrae contenedores multimedia:

 IMÁGENES
   PNG
   JPG/JPEG
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

 ARCHIVOS
   ZIP

 También intenta detectar:
   FNF
   Psych Engine
   HaxeFlixel

 Y charts JSON con:
   song.notes
   sectionNotes
   bpm
   speed

 IMPORTANTE:
 El EXE se procesa localmente.
 No se sube a ningún servidor.
============================================================
*/

const fileInput =
    document.getElementById(
        "fileInput"
    );

const dropZone =
    document.getElementById(
        "dropZone"
    );

const analyzeButton =
    document.getElementById(
        "analyzeButton"
    );

const extractButton =
    document.getElementById(
        "extractButton"
    );

const status =
    document.getElementById(
        "status"
    );

const results =
    document.getElementById(
        "results"
    );

const progressBar =
    document.getElementById(
        "progressBar"
    );


let selectedFile = null;
let bytes = null;
let analysis = null;


/* ============================================================
 UI
============================================================ */

function setStatus(text)
{
    status.textContent = text;
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


function formatBytes(value)
{
    if (value < 1024)
        return `${value} B`;

    if (value < 1024 * 1024)
        return `${
            (value / 1024).toFixed(2)
        } KB`;

    if (value < 1024 * 1024 * 1024)
        return `${
            (
                value /
                1024 /
                1024
            ).toFixed(2)
        } MB`;

    return `${
        (
            value /
            1024 /
            1024 /
            1024
        ).toFixed(2)
    } GB`;
}


function ascii(text)
{
    return Uint8Array.from(
        [...text].map(
            c => c.charCodeAt(0)
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


function readU16LE(
    data,
    offset
)
{
    if (
        offset + 2 >
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
        )
    ) & 0xFFFF;
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


function safeName(name)
{
    return name
        .replace(
            /[<>:"/\\|?*\x00-\x1F]/g,
            "_"
        )
        .replace(
            /\s+/g,
            "_"
        )
        .slice(
            0,
            160
        );
}


/* ============================================================
 ARCHIVO
============================================================ */

dropZone.addEventListener(
    "click",
    () => fileInput.click()
);


fileInput.addEventListener(
    "change",
    () =>
    {
        if (
            fileInput.files.length
        )
        {
            selectFile(
                fileInput.files[0]
            );
        }
    }
);


dropZone.addEventListener(
    "dragover",
    event =>
    {
        event.preventDefault();

        dropZone.classList.add(
            "dragging"
        );
    }
);


dropZone.addEventListener(
    "dragleave",
    () =>
    {
        dropZone.classList.remove(
            "dragging"
        );
    }
);


dropZone.addEventListener(
    "drop",
    event =>
    {
        event.preventDefault();

        dropZone.classList.remove(
            "dragging"
        );

        if (
            event.dataTransfer.files.length
        )
        {
            selectFile(
                event.dataTransfer.files[0]
            );
        }
    }
);


function selectFile(file)
{
    selectedFile = file;

    bytes = null;

    analysis = null;

    analyzeButton.disabled =
        false;

    extractButton.disabled =
        true;

    results.innerHTML =
        "";

    setProgress(0);

    setStatus(
        `📦 ${file.name}\n\n` +
        `Tamaño: ${
            formatBytes(file.size)
        }\n\n` +
        `Pulsa ANALIZAR.`
    );
}


/* ============================================================
 PE
============================================================ */

function analyzePE(data)
{
    const result =
    {
        valid: false,
        machine: "Unknown"
    };

    if (
        data.length < 64 ||
        data[0] !== 0x4D ||
        data[1] !== 0x5A
    )
    {
        return result;
    }

    const peOffset =
        readU32LE(
            data,
            0x3C
        );

    if (
        peOffset + 24 >
        data.length
    )
    {
        return result;
    }

    if (
        !hasSignature(
            data,
            peOffset,
            [0x50,0x45,0x00,0x00]
        )
    )
    {
        return result;
    }

    result.valid = true;

    const machine =
        readU16LE(
            data,
            peOffset + 4
        );

    switch (machine)
    {
        case 0x014C:
            result.machine =
                "x86 (32-bit)";
            break;

        case 0x8664:
            result.machine =
                "x64 (64-bit)";
            break;

        case 0xAA64:
            result.machine =
                "ARM64";
            break;

        default:
            result.machine =
                `Unknown (0x${
                    machine.toString(16)
                })`;
    }

    return result;
}


/* ============================================================
 MOTOR
============================================================ */

function detectEngine(data)
{
    const fnf =
        findSignature(
            data,
            ascii(
                "Friday Night Funkin"
            )
        ) !== -1 ||
        findSignature(
            data,
            ascii("funkin")
        ) !== -1;

    const psych =
        findSignature(
            data,
            ascii("Psych Engine")
        ) !== -1 ||
        findSignature(
            data,
            ascii("PsychEngine")
        ) !== -1;

    const flixel =
        findSignature(
            data,
            ascii("HaxeFlixel")
        ) !== -1 ||
        findSignature(
            data,
            ascii("flixel")
        ) !== -1;

    const haxe =
        findSignature(
            data,
            ascii("Haxe")
        ) !== -1;

    const openfl =
        findSignature(
            data,
            ascii("OpenFL")
        ) !== -1 ||
        findSignature(
            data,
            ascii("openfl")
        ) !== -1;

    const lime =
        findSignature(
            data,
            ascii("Lime")
        ) !== -1 ||
        findSignature(
            data,
            ascii("lime")
        ) !== -1;

    return {
        fnf,
        psych,
        haxe,
        flixel,
        openfl,
        lime
    };
}


/* ============================================================
 FIRMAS
============================================================ */

function countSignature(
    data,
    signature
)
{
    let count = 0;
    let position = 0;

    while (true)
    {
        const found =
            findSignature(
                data,
                signature,
                position
            );

        if (found === -1)
            break;

        count++;

        position =
            found +
            signature.length;
    }

    return count;
}


/* ============================================================
 ANÁLISIS
============================================================ */

function analyzeGame(data)
{
    const pe =
        analyzePE(data);

    const engine =
        detectEngine(data);

    const resources =
    {
        png:
            countSignature(
                data,
                [
                    0x89,
                    0x50,
                    0x4E,
                    0x47,
                    0x0D,
                    0x0A,
                    0x1A,
                    0x0A
                ]
            ),

        jpg:
            countSignature(
                data,
                [
                    0xFF,
                    0xD8,
                    0xFF
                ]
            ),

        ogg:
            countSignature(
                data,
                [
                    0x4F,
                    0x67,
                    0x67,
                    0x53
                ]
            ),

        mp3:
            countSignature(
                data,
                [
                    0x49,
                    0x44,
                    0x33
                ]
            ),

        riff:
            countSignature(
                data,
                ascii("RIFF")
            ),

        mp4:
            countSignature(
                data,
                ascii("ftyp")
            ),

        webm:
            countSignature(
                data,
                ascii("webm")
            ),

        zip:
            countSignature(
                data,
                [
                    0x50,
                    0x4B,
                    0x03,
                    0x04
                ]
            )
    };

    let score = 0;

    if (pe.valid)
        score += 10;

    if (engine.fnf)
        score += 25;

    if (engine.psych)
        score += 35;

    if (engine.flixel)
        score += 15;

    if (resources.ogg)
        score += 5;

    if (resources.mp3)
        score += 5;

    if (resources.png)
        score += 5;

    score =
        Math.min(
            100,
            score
        );

    return {
        pe,
        engine,
        resources,
        score
    };
}


/* ============================================================
 RESULTADOS
============================================================ */

function addResult(
    title,
    value,
    good = true
)
{
    const div =
        document.createElement(
            "div"
        );

    div.className =
        `result ${
            good
                ? "good"
                : "warn"
        }`;

    div.innerHTML =
        `
        <div class="result-title">
            ${title}
        </div>

        <div class="result-value">
            ${value}
        </div>
        `;

    results.appendChild(
        div
    );
}


function displayAnalysis()
{
    results.innerHTML =
        "";

    addResult(
        "PE",
        analysis.pe.valid
            ? "✅ Válido"
            : "❌ No detectado",
        analysis.pe.valid
    );

    addResult(
        "Arquitectura",
        analysis.pe.machine
    );

    addResult(
        "FNF",
        analysis.engine.fnf
            ? "✅ Detectado"
            : "⚠️ No confirmado",
        analysis.engine.fnf
    );

    addResult(
        "Psych Engine",
        analysis.engine.psych
            ? "✅ Detectado"
            : "⚠️ No confirmado",
        analysis.engine.psych
    );

    addResult(
        "HaxeFlixel",
        analysis.engine.flixel
            ? "✅ Detectado"
            : "⚠️ No confirmado",
        analysis.engine.flixel
    );

    addResult(
        "PNG",
        analysis.resources.png
    );

    addResult(
        "JPG/JPEG",
        analysis.resources.jpg
    );

    addResult(
        "OGG",
        analysis.resources.ogg
    );

    addResult(
        "MP3",
        analysis.resources.mp3
    );

    addResult(
        "RIFF/WAV/WEBP",
        analysis.resources.riff
    );

    addResult(
        "MP4/FTYP",
        analysis.resources.mp4
    );

    addResult(
        "WEBM",
        analysis.resources.webm
    );

    addResult(
        "ZIP",
        analysis.resources.zip
    );

    addResult(
        "Puntuación",
        `${analysis.score}/100`
    );
}


/* ============================================================
 ANALIZAR
============================================================ */

analyzeButton.addEventListener(
    "click",
    async () =>
    {
        if (!selectedFile)
            return;

        analyzeButton.disabled =
            true;

        extractButton.disabled =
            true;

        try
        {
            setStatus(
                "📥 Cargando EXE..."
            );

            const buffer =
                await selectedFile.arrayBuffer();

            bytes =
                new Uint8Array(
                    buffer
                );

            setProgress(20);

            analysis =
                analyzeGame(
                    bytes
                );

            setProgress(100);

            displayAnalysis();

            extractButton.disabled =
                false;

            setStatus(
                "✅ Análisis terminado.\n\n" +
                `Tamaño: ${
                    formatBytes(
                        bytes.length
                    )
                }\n` +
                `Arquitectura: ${
                    analysis.pe.machine
                }\n` +
                `Puntuación: ${
                    analysis.score
                }/100`
            );
        }
        catch(error)
        {
            console.error(error);

            setStatus(
                `❌ ${error.message}`
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

    if (marker === -1)
        return null;

    const end =
        marker + 8;

    return data.slice(
        start,
        end
    );
}


/* ============================================================
 JPEG
============================================================ */

function extractJPG(
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
 MP3

 Soporta:
   ID3

 y MPEG frames básicos.
============================================================ */

function extractMP3(
    data,
    start
)
{
    if (
        hasSignature(
            data,
            start,
            ascii("ID3")
        )
    )
    {
        if (
            start + 10 >
            data.length
        )
        {
            return null;
        }

        const sizeBytes =
            data.slice(
                start + 6,
                start + 10
            );

        const size =
            (
                ((sizeBytes[0] & 0x7F) << 21) |
                ((sizeBytes[1] & 0x7F) << 14) |
                ((sizeBytes[2] & 0x7F) << 7) |
                (sizeBytes[3] & 0x7F)
            );

        const end =
            start +
            10 +
            size;

        /*
          ID3 no necesariamente contiene TODO
          el MP3. Por eso seguimos buscando frames.
        */

        if (
            end <= data.length
        )
        {
            let pos = end;

            while (
                pos + 4 <=
                data.length
            )
            {
                if (
                    data[pos] === 0xFF &&
                    (data[pos + 1] & 0xE0) === 0xE0
                )
                {
                    pos += 2;
                }
                else
                {
                    break;
                }

                if (
                    pos > start &&
                    pos - start >
                    256 * 1024 * 1024
                )
                {
                    break;
                }
            }

            /*
              Como un MP3 no tiene un final simple universal,
              usamos el siguiente contenedor conocido si existe.
            */

            const nextPNG =
                findSignature(
                    data,
                    [
                        0x89,
                        0x50,
                        0x4E,
                        0x47
                    ],
                    end
                );

            const nextOgg =
                findSignature(
                    data,
                    [
                        0x4F,
                        0x67,
                        0x67,
                        0x53
                    ],
                    end
                );

            let finish =
                data.length;

            if (
                nextPNG !== -1
            )
            {
                finish =
                    Math.min(
                        finish,
                        nextPNG
                    );
            }

            if (
                nextOgg !== -1
            )
            {
                finish =
                    Math.min(
                        finish,
                        nextOgg
                    );
            }

            return data.slice(
                start,
                finish
            );
        }
    }

    return null;
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
            data[position + 5];

        const segments =
            data[position + 26];

        const table =
            position + 27;

        const payload =
            table +
            segments;

        if (
            payload >
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
                    table + i
                ];
        }

        const pageEnd =
            payload +
            payloadSize;

        if (
            pageEnd >
            data.length
        )
        {
            return null;
        }

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
 MP4

 Busca ftyp y calcula boxes ISO-BMFF.
============================================================ */

function extractMP4(
    data,
    ftyp
)
{
    let boxStart =
        ftyp - 4;

    if (
        boxStart < 0
    )
    {
        return null;
    }

    let lastValid =
        boxStart;

    while (
        boxStart + 8 <=
        data.length
    )
    {
        const size =
            readU32BE(
                data,
                boxStart
            );

        if (
            size === 0
        )
        {
            break;
        }

        if (
            size === 1
        )
        {
            /*
              64-bit larges no se manejan en
              esta versión.
            */
            break;
        }

        if (
            size < 8 ||
            boxStart + size >
            data.length
        )
        {
            break;
        }

        lastValid =
            boxStart +
            size;

        boxStart =
            lastValid;
    }

    if (
        lastValid <= ftyp
    )
    {
        return null;
    }

    return {
        start:
            ftyp - 4,

        end:
            lastValid,

        data:
            data.slice(
                ftyp - 4,
                lastValid
            )
    };
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


/* ============================================================
 WEBM

 Matroska usa EBML.
 Esta función detecta el contenedor y
 busca una siguiente firma conocida para
 determinar un límite aproximado.

============================================================ */

function extractWebM(
    data,
    start
)
{
    const nextPNG =
        findSignature(
            data,
            [
                0x89,
                0x50,
                0x4E,
                0x47
            ],
            start + 4
        );

    const nextOgg =
        findSignature(
            data,
            [
                0x4F,
                0x67,
                0x67,
                0x53
            ],
            start + 4
        );

    let end =
        data.length;

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
        nextOgg !== -1
    )
    {
        end =
            Math.min(
                end,
                nextOgg
            );
    }

    return data.slice(
        start,
        end
    );
}


/* ============================================================
 JSON
============================================================ */

function extractJSONAt(
    data,
    start,
    maxSize = 16 * 1024 * 1024
)
{
    if (
        data[start] !==
        0x7B
    )
    {
        return null;
    }

    const limit =
        Math.min(
            data.length,
            start + maxSize
        );

    let depth = 0;
    let stringMode = false;
    let escaped = false;

    for (
        let i = start;
        i < limit;
        i++
    )
    {
        const b =
            data[i];

        if (stringMode)
        {
            if (escaped)
            {
                escaped = false;
            }
            else if (
                b === 0x5C
            )
            {
                escaped = true;
            }
            else if (
                b === 0x22
            )
            {
                stringMode = false;
            }

            continue;
        }

        if (
            b === 0x22
        )
        {
            stringMode = true;

            continue;
        }

        if (
            b === 0x7B
        )
        {
            depth++;
        }
        else if (
            b === 0x7D
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

                    const object =
                        JSON.parse(
                            text
                        );

                    return {
                        end:
                            i + 1,

                        data:
                            raw,

                        text,
                        object
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
 CHART
============================================================ */

function chartScore(
    object,
    text
)
{
    let score = 0;

    if (
        object &&
        typeof object ===
            "object"
    )
    {
        score += 5;
    }

    if (
        object.song &&
        typeof object.song ===
            "object"
    )
    {
        score += 20;
    }

    if (
        object.song &&
        Array.isArray(
            object.song.notes
        )
    )
    {
        score += 30;
    }

    if (
        object.song &&
        object.song.bpm !==
            undefined
    )
    {
        score += 10;
    }

    if (
        object.song &&
        object.song.speed !==
            undefined
    )
    {
        score += 10;
    }

    if (
        text.includes(
            "sectionNotes"
        )
    )
    {
        score += 20;
    }

    return Math.min(
        score,
        100
    );
}


/* ============================================================
 JSON SCANNER
============================================================ */

function extractJSONResources(
    data
)
{
    const output = [];

    let position = 0;

    let attempts = 0;

    while (
        position <
            data.length &&
        attempts <
            100000
    )
    {
        const start =
            findSignature(
                data,
                [0x7B],
                position
            );

        if (
            start === -1
        )
        {
            break;
        }

        attempts++;

        const candidate =
            extractJSONAt(
                data,
                start
            );

        if (
            candidate
        )
        {
            const score =
                chartScore(
                    candidate.object,
                    candidate.text
                );

            if (
                score >= 10
            )
            {
                output.push(
                {
                    data:
                        candidate.data,

                    object:
                        candidate.object,

                    text:
                        candidate.text,

                    score,

                    offset:
                        start
                });

                position =
                    candidate.end;

                continue;
            }
        }

        position =
            start + 1;
    }

    return dedupeJSON(
        output
    );
}


function dedupeJSON(
    list
)
{
    const result = [];
    const seen = new Set();

    for (
        const item
        of list
    )
    {
        const key =
            item.text;

        if (
            seen.has(key)
        )
        {
            continue;
        }

        seen.add(key);

        result.push(
            item
        );
    }

    return result;
}


/* ============================================================
 EXTRACCIÓN
============================================================ */

async function extractAll()
{
    const files = [];

    const charts = [];

    let imageIndex = 0;
    let audioIndex = 0;
    let videoIndex = 0;
    let dataIndex = 0;
    let jsonChartIndex = 0;


    /* --------------------------------------------------------
       PNG
    -------------------------------------------------------- */

    setStatus(
        "🖼️ Extrayendo PNG..."
    );

    setProgress(5);

    const pngSig =
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
                bytes,
                pngSig,
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
                bytes,
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
                    `assets/images/image_${
                        imageIndex
                    }.png`,

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
                found + 8;
        }
    }


    /* --------------------------------------------------------
       JPEG
    -------------------------------------------------------- */

    setStatus(
        "🖼️ Extrayendo JPG..."
    );

    setProgress(15);

    const jpgSig =
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
                bytes,
                jpgSig,
                position
            );

        if (
            found === -1
        )
        {
            break;
        }

        const extracted =
            extractJPG(
                bytes,
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
                    `assets/images/image_${
                        imageIndex
                    }.jpg`,

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
                found + 3;
        }
    }


    /* --------------------------------------------------------
       RIFF / WAV / WEBP
    -------------------------------------------------------- */

    setStatus(
        "🔊 Extrayendo WAV y WEBP..."
    );

    setProgress(25);

    const riffSig =
        ascii("RIFF");

    position = 0;

    while (true)
    {
        const found =
            findSignature(
                bytes,
                riffSig,
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
                bytes,
                found + 8,
                ascii("WAVE")
            )
        )
        {
            const extracted =
                extractRIFF(
                    bytes,
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
                        `assets/audio/audio_${
                            audioIndex
                        }.wav`,

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
                bytes,
                found + 8,
                ascii("WEBP")
            )
        )
        {
            const extracted =
                extractRIFF(
                    bytes,
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
                        `assets/images/image_${
                            imageIndex
                        }.webp`,

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


    /* --------------------------------------------------------
       OGG
    -------------------------------------------------------- */

    setStatus(
        "🎵 Extrayendo OGG..."
    );

    setProgress(35);

    const oggSig =
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
                bytes,
                oggSig,
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
                bytes,
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
                    `assets/audio/audio_${
                        audioIndex
                    }.ogg`,

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


    /* --------------------------------------------------------
       MP3
    -------------------------------------------------------- */

    setStatus(
        "🎵 Extrayendo MP3..."
    );

    setProgress(45);

    const id3Sig =
        ascii("ID3");

    position = 0;

    while (true)
    {
        const found =
            findSignature(
                bytes,
                id3Sig,
                position
            );

        if (
            found === -1
        )
        {
            break;
        }

        const extracted =
            extractMP3(
                bytes,
                found
            );

        if (
            extracted &&
            extracted.length >
                128
        )
        {
            audioIndex++;

            files.push(
            {
                path:
                    `assets/audio/audio_${
                        audioIndex
                    }.mp3`,

                data:
                    extracted,

                type:
                    "MP3",

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
                found + 3;
        }
    }


    /* --------------------------------------------------------
       MP4
    -------------------------------------------------------- */

    setStatus(
        "🎬 Extrayendo MP4..."
    );

    setProgress(55);

    const ftyp =
        ascii("ftyp");

    position = 0;

    while (true)
    {
        const found =
            findSignature(
                bytes,
                ftyp,
                position
            );

        if (
            found === -1
        )
        {
            break;
        }

        const extracted =
            extractMP4(
                bytes,
                found
            );

        if (
            extracted
        )
        {
            videoIndex++;

            files.push(
            {
                path:
                    `assets/video/video_${
                        videoIndex
                    }.mp4`,

                data:
                    extracted.data,

                type:
                    "MP4",

                offset:
                    extracted.start
            });

            position =
                extracted.end;
        }
        else
        {
            position =
                found + 4;
        }
    }


    /* --------------------------------------------------------
       WEBM
    -------------------------------------------------------- */

    setStatus(
        "🎬 Extrayendo WEBM..."
    );

    setProgress(62);

    const webmSig =
        ascii("webm");

    position = 0;

    while (true)
    {
        const found =
            findSignature(
                bytes,
                webmSig,
                position
            );

        if (
            found === -1
        )
        {
            break;
        }

        /*
          Retrocedemos para buscar EBML.
        */

        const start =
            Math.max(
                0,
                found - 64
            );

        const extracted =
            extractWebM(
                bytes,
                start
            );

        if (
            extracted &&
            extracted.length >
                1024
        )
        {
            videoIndex++;

            files.push(
            {
                path:
                    `assets/video/video_${
                        videoIndex
                    }.webm`,

                data:
                    extracted,

                type:
                    "WEBM",

                offset:
                    start
            });

            position =
                start +
                extracted.length;
        }
        else
        {
            position =
                found + 4;
        }
    }


    /* --------------------------------------------------------
       JSON
    -------------------------------------------------------- */

    setStatus(
        "📊 Extrayendo JSON y buscando charts..."
    );

    setProgress(70);

    const jsonFiles =
        extractJSONResources(
            bytes
        );

    for (
        const item
        of jsonFiles
    )
    {
        dataIndex++;

        const isChart =
            item.score >= 50;

        let path;

        if (
            isChart
        )
        {
            jsonChartIndex++;

            path =
                `assets/data/chart_${
                    jsonChartIndex
                }.json`;

            charts.push(
            {
                path,

                score:
                    item.score,

                song:
                    item.object.song
                        ? (
                            item.object.song.song ||
                            null
                        )
                        : null,

                bpm:
                    item.object.song
                        ? (
                            item.object.song.bpm ||
                            null
                        )
                        : null,

                speed:
                    item.object.song
                        ? (
                            item.object.song.speed ||
                            null
                        )
                        : null,

                offset:
                    item.offset
            });
        }
        else
        {
            path =
                `assets/data/data_${
                    dataIndex
                }.json`;
        }

        files.push(
        {
            path,

            data:
                item.data,

            type:
                isChart
                    ? "PSYCH_CHART"
                    : "JSON",

            offset:
                item.offset,

            score:
                item.score
        });
    }


    setProgress(100);

    return {
        files,
        charts
    };
}


/* ============================================================
 EXTRACCIÓN ZIP
============================================================ */

/*
  ZIP incrustado:
  V7 lo detecta y lo conserva como ZIP.
  No lo descomprime aquí porque una descompresión completa
  de cientos de MB podría agotar la memoria del navegador.
*/

function extractZIP(
    data,
    start
)
{
    /*
      Buscamos EOCD.
    */

    const minimum =
        Math.max(
            start,
            data.length -
            65557
        );

    for (
        let i =
            data.length - 22;
        i >= minimum;
        i--
    )
    {
        if (
            hasSignature(
                data,
                i,
                [
                    0x50,
                    0x4B,
                    0x05,
                    0x06
                ]
            )
        )
        {
            const commentLength =
                readU16LE(
                    data,
                    i + 20
                );

            const end =
                i +
                22 +
                commentLength;

            if (
                end <=
                data.length
            )
            {
                return data.slice(
                    start,
                    end
                );
            }
        }
    }

    return null;
}


/* ============================================================
 ZIP DEL PROYECTO
============================================================ */

function crc32(data)
{
    let crc =
        0xFFFFFFFF;

    for (
        let i = 0;
        i < data.length;
        i++
    )
    {
        crc ^= data[i];

        for (
            let j = 0;
            j < 8;
            j++
        )
        {
            crc =
                (
                    crc >>> 1
                ) ^
                (
                    crc & 1
                        ? 0xEDB88320
                        : 0
                );
        }
    }

    return (
        crc ^
        0xFFFFFFFF
    ) >>> 0;
}


function push16(
    array,
    value
)
{
    array.push(
        value & 255,
        (value >>> 8) & 255
    );
}


function push32(
    array,
    value
)
{
    array.push(
        value & 255,
        (value >>> 8) & 255,
        (value >>> 16) & 255,
        (value >>> 24) & 255
    );
}


function createZIP(
    files
)
{
    const output = [];
    const central = [];

    let offset = 0;

    for (
        const file
        of files
    )
    {
        const name =
            new TextEncoder()
                .encode(
                    file.name
                );

        const data =
            file.data;

        const crc =
            crc32(data);

        const local = [];

        push32(
            local,
            0x04034B50
        );

        push16(local,20);
        push16(local,0);
        push16(local,0);
        push16(local,0);
        push16(local,0);

        push32(local,crc);

        push32(
            local,
            data.length
        );

        push32(
            local,
            data.length
        );

        push16(
            local,
            name.length
        );

        push16(local,0);

        for (
            const b
            of name
        )
        {
            local.push(b);
        }

        for (
            const b
            of data
        )
        {
            local.push(b);
        }

        output.push(...local);


        const entry = [];

        push32(
            entry,
            0x02014B50
        );

        push16(entry,20);
        push16(entry,20);
        push16(entry,0);
        push16(entry,0);
        push16(entry,0);
        push16(entry,0);

        push32(entry,crc);

        push32(
            entry,
            data.length
        );

        push32(
            entry,
            data.length
        );

        push16(
            entry,
            name.length
        );

        push16(entry,0);
        push16(entry,0);
        push16(entry,0);
        push16(entry,0);

        push32(entry,0);

        push32(
            entry,
            offset
        );

        entry.push(...name);

        central.push(entry);

        offset +=
            local.length;
    }

    const centralOffset =
        output.length;

    let centralSize = 0;

    for (
        const entry
        of central
    )
    {
        output.push(...entry);

        centralSize +=
            entry.length;
    }

    push32(
        output,
        0x06054B50
    );

    push16(output,0);
    push16(output,0);

    push16(
        output,
        files.length
    );

    push16(
        output,
        files.length
    );

    push32(
        output,
        centralSize
    );

    push32(
        output,
        centralOffset
    );

    push16(output,0);

    return new Uint8Array(
        output
    );
}


/* ============================================================
 CREAR GAME HTML
============================================================ */

function createGameHTML(
    charts
)
{
    const chartOptions =
        charts.length
            ? charts.map(
                (chart, index) =>
                    `
<option value="assets/data/chart_${
    index + 1
}.json">
${
    chart.song ||
    `Chart ${index + 1}`
}
</option>
`
            ).join("")
            : `
<option>
No se detectaron charts
</option>
`;

    return `<!DOCTYPE html>

<html lang="es">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width,initial-scale=1"
>

<title>Missa V7 Web</title>

<link
    rel="stylesheet"
    href="style.css"
>

</head>

<body>

<div id="menu">

<h1>🎵 MISSA V7 WEB</h1>

<p>Runtime FNF experimental</p>

<label>
Chart
</label>

<select id="chart">
${chartOptions}
</select>

<br>

<label>
Audio
</label>

<input
    id="audio"
    type="file"
    accept=".ogg,.mp3,.wav"
>

<br>

<button id="play">
▶ JUGAR
</button>

<div id="info">
Esperando...
</div>

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
    return String.raw`
"use strict";

const canvas =
    document.getElementById("game");

const ctx =
    canvas.getContext("2d");

const menu =
    document.getElementById("menu");

const chartSelect =
    document.getElementById("chart");

const audioInput =
    document.getElementById("audio");

const playButton =
    document.getElementById("play");

const info =
    document.getElementById("info");

let chart = null;
let notes = [];
let audio = null;

let playing = false;

let score = 0;
let combo = 0;
let misses = 0;
let health = 1;

const KEYS = [
    "ArrowLeft",
    "ArrowDown",
    "ArrowUp",
    "ArrowRight"
];

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

async function loadChart(url)
{
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
            "El archivo no tiene estructura Psych Engine."
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
                !Array.isArray(raw) ||
                raw.length < 2
            )
            {
                continue;
            }

            const time =
                Number(raw[0]);

            const lane =
                (
                    Number(raw[1]) %
                    4 + 4
                ) % 4;

            notes.push({
                time,
                lane,
                hit: false,
                missed: false
            });
        }
    }

    notes.sort(
        (a,b) =>
            a.time - b.time
    );

    info.textContent =
        `Canción: ${
            chart.song ||
            "?"
        } | BPM: ${
            chart.bpm ||
            "?"
        } | Notas: ${
            notes.length
        }`;
}

function loadAudio(file)
{
    const url =
        URL.createObjectURL(file);

    audio =
        new Audio(url);

    audio.preload =
        "auto";

    return new Promise(
        (resolve,reject) =>
        {
            audio.addEventListener(
                "canplaythrough",
                resolve,
                {once:true}
            );

            audio.addEventListener(
                "error",
                () =>
                    reject(
                        new Error(
                            "No se pudo cargar el audio."
                        )
                    ),
                {once:true}
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
            if (
                !audioInput.files.length
            )
            {
                throw new Error(
                    "Selecciona un archivo de audio."
                );
            }

            await loadChart(
                chartSelect.value
            );

            await loadAudio(
                audioInput.files[0]
            );

            for (
                const note
                of notes
            )
            {
                note.hit = false;
                note.missed = false;
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
        if (!playing)
            return;

        const lane =
            KEYS.indexOf(
                event.code
            );

        if (lane < 0)
            return;

        event.preventDefault();

        hitNote(lane);
    }
);

function hitNote(lane)
{
    if (!audio)
        return;

    const now =
        audio.currentTime *
        1000;

    let best = null;
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

    if (distance <= 45)
    {
        best.hit = true;
        combo++;
        score += 350;
        health =
            Math.min(
                1,
                health + .02
            );
    }
    else if (distance <= 90)
    {
        best.hit = true;
        combo++;
        score += 200;
    }
    else if (distance <= 135)
    {
        best.hit = true;
        combo++;
        score += 100;
    }
}

function update()
{
    if (!playing || !audio)
        return;

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
                    health - .05
                );
        }
    }

    if (
        audio.ended
    )
    {
        playing = false;
    }
}

function arrow(
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

    if (lane === 0)
        ctx.rotate(-Math.PI/2);

    if (lane === 1)
        ctx.rotate(Math.PI);

    if (lane === 3)
        ctx.rotate(Math.PI/2);

    ctx.beginPath();

    ctx.moveTo(size,0);

    ctx.lineTo(
        0,
        -size
    );

    ctx.lineTo(
        -size,
        0
    );

    ctx.lineTo(
        -size/2,
        0
    );

    ctx.lineTo(
        -size/2,
        size
    );

    ctx.lineTo(
        size/2,
        size
    );

    ctx.lineTo(
        size/2,
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
        `Score: ${score}`,
        20,
        30
    );

    ctx.fillText(
        `Combo: ${combo}`,
        20,
        60
    );

    ctx.fillText(
        `Misses: ${misses}`,
        20,
        90
    );

    ctx.fillStyle =
        "#333";

    ctx.fillRect(
        20,
        110,
        250,
        18
    );

    ctx.fillStyle =
        "#4caf50";

    ctx.fillRect(
        20,
        110,
        250 * health,
        18
    );

    const laneWidth =
        Math.min(
            110,
            canvas.width / 6
        );

    const total =
        laneWidth * 4;

    const startX =
        (
            canvas.width -
            total
        ) / 2;

    const receptorY =
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
            startX +
            lane *
            laneWidth + 8,
            receptorY,
            laneWidth - 16,
            60
        );

        arrow(
            startX +
            lane *
            laneWidth +
            laneWidth/2,
            receptorY + 30,
            lane,
            21
        );
    }

    if (audio)
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
                delta * .55;

            if (
                y < -100 ||
                y > canvas.height + 100
            )
            {
                continue;
            }

            ctx.fillStyle =
                "white";

            ctx.fillRect(
                startX +
                note.lane *
                laneWidth + 10,
                y,
                laneWidth - 20,
                45
            );

            ctx.fillStyle =
                "#111";

            arrow(
                startX +
                note.lane *
                laneWidth +
                laneWidth/2,
                y + 22,
                note.lane,
                17
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
html,body
{
    margin:0;
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

    left:50%;
    top:50%;

    transform:
        translate(-50%,-50%);

    z-index:10;

    width:min(500px,90%);

    padding:30px;

    background:#181818;

    border:
        1px solid #333;

    border-radius:16px;

    text-align:center;
}

select,
input,
button
{
    padding:11px;

    margin-top:10px;

    border-radius:8px;
}

button
{
    font-weight:bold;
    cursor:pointer;
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
 ZIP FINAL
============================================================ */

function createProjectZIP(
    extracted
)
{
    const files = [];


    /*
      Assets
    */

    for (
        const file
        of extracted.files
    )
    {
        files.push(
        {
            name:
                file.path,

            data:
                file.data
        });
    }


    /*
      Manifest
    */

    const manifest =
    {
        converter:
        {
            version:
                "7.0.0"
        },

        original:
        {
            filename:
                selectedFile.name,

            size:
                selectedFile.size
        },

        engine:
            analysis.engine,

        architecture:
            analysis.pe.machine,

        resources:
            analysis.resources,

        charts:
            extracted.charts,

        files:
            extracted.files.map(
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


    files.push(
    {
        name:
            "manifest.json",

        data:
            new TextEncoder()
                .encode(
                    JSON.stringify(
                        manifest,
                        null,
                        4
                    )
                )
    });


    files.push(
    {
        name:
            "index.html",

        data:
            new TextEncoder()
                .encode(
                    createGameHTML(
                        extracted.charts
                    )
                )
    });


    files.push(
    {
        name:
            "game.js",

        data:
            new TextEncoder()
                .encode(
                    createGameJS()
                )
    });


    files.push(
    {
        name:
            "style.css",

        data:
            new TextEncoder()
                .encode(
                    createGameCSS()
                )
    });


    files.push(
    {
        name:
            "README.txt",

        data:
            new TextEncoder()
                .encode(
`MISSA V3 WEB
============

Extractor V7.

Formatos multimedia buscados:

PNG
JPG
WEBP

OGG
MP3
WAV

MP4
WEBM

JSON
LUA

ZIP

Charts detectados:
${
    extracted.charts.length
}

El runtime web incluido
es experimental.

El código nativo de Windows
no se convierte directamente.

Los recursos recuperados
se preparan para el runtime web.
`
                )
    });


    return createZIP(
        files
    );
}


/* ============================================================
 BOTÓN EXTRAER
============================================================ */

extractButton.addEventListener(
    "click",
    async () =>
    {
        if (
            !bytes ||
            !analysis
        )
        {
            return;
        }

        analyzeButton.disabled =
            true;

        extractButton.disabled =
            true;

        try
        {
            const extracted =
                await extractAll();

            setStatus(
                "📦 Empaquetando..."
            );

            const zip =
                createProjectZIP(
                    extracted
                );

            const blob =
                new Blob(
                    [zip],
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

            results.innerHTML =
                "";

            addResult(
                "Archivos extraídos",
                extracted.files.length
            );

            addResult(
                "Charts detectados",
                extracted.charts.length
            );

            addResult(
                "Proyecto",
                "MissaWeb.zip ✅"
            );

            setStatus(
                "✅ TERMINADO\n\n" +
                `Archivos: ${
                    extracted.files.length
                }\n` +
                `Charts: ${
                    extracted.charts.length
                }\n\n` +
                "MissaWeb.zip descargado."
            );
        }
        catch(error)
        {
            console.error(error);

            setStatus(
                "❌ ERROR\n\n" +
                error.message
            );
        }
        finally
        {
            analyzeButton.disabled =
                false;

            extractButton.disabled =
                false;
        }
    }
);
```
