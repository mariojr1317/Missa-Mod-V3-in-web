"use strict";

/*
============================================================
 FNF WEB CONVERTER V4
 Real embedded-resource extractor

 Funciona completamente en el navegador.

 Detecta:
   - PE
   - FNF
   - Psych Engine
   - HaxeFlixel
   - PNG
   - JPG/JPEG
   - WEBP
   - WAV
   - OGG
   - ZIP incrustados

 Genera:

 MissaWeb.zip
 ├── index.html
 ├── game.js
 ├── style.css
 ├── README.txt
 ├── manifest.json
 └── assets/
     ├── images/
     ├── audio/
     ├── archives/
     └── extracted/
============================================================
*/


const fileInput =
    document.getElementById("fileInput");

const dropZone =
    document.getElementById("dropZone");

const analyzeButton =
    document.getElementById("analyzeButton");

const convertButton =
    document.getElementById("convertButton");

const statusBox =
    document.getElementById("status");

const resultsBox =
    document.getElementById("results");


let selectedFile = null;
let selectedBytes = null;
let analysis = null;


/* ============================================================
   UTILIDADES
============================================================ */

function setStatus(text)
{
    statusBox.textContent = text;
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


function readU32LE(bytes, offset)
{
    if (
        offset + 4 >
        bytes.length
    )
    {
        return 0;
    }

    return (
        bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)
    ) >>> 0;
}


function readU16LE(bytes, offset)
{
    if (
        offset + 2 >
        bytes.length
    )
    {
        return 0;
    }

    return (
        bytes[offset] |
        (bytes[offset + 1] << 8)
    ) & 0xFFFF;
}


function readU32BE(bytes, offset)
{
    if (
        offset + 4 >
        bytes.length
    )
    {
        return 0;
    }

    return (
        ((bytes[offset] << 24) >>> 0) |
        (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) |
        bytes[offset + 3]
    ) >>> 0;
}


function hasSignature(
    bytes,
    offset,
    signature
)
{
    if (
        offset + signature.length >
        bytes.length
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
            bytes[offset + i] !==
            signature[i]
        )
        {
            return false;
        }
    }

    return true;
}


function findSignature(
    bytes,
    signature,
    start = 0,
    end = bytes.length
)
{
    const last =
        Math.min(
            end,
            bytes.length
        ) -
        signature.length;

    for (
        let i = start;
        i <= last;
        i++
    )
    {
        if (
            hasSignature(
                bytes,
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


function asciiBytes(text)
{
    return Uint8Array.from(
        [...text].map(
            char =>
                char.charCodeAt(0)
        )
    );
}


function findText(
    bytes,
    text,
    start = 0
)
{
    return findSignature(
        bytes,
        asciiBytes(text),
        start
    );
}


function sliceBytes(
    bytes,
    start,
    end
)
{
    return bytes.slice(
        start,
        end
    );
}


function uniqueName(
    used,
    base,
    extension
)
{
    let name =
        base +
        extension;

    let number = 1;

    while (
        used.has(name)
    )
    {
        name =
            `${base}_${number}${extension}`;

        number++;
    }

    used.add(name);

    return name;
}


/* ============================================================
   ARCHIVO SELECCIONADO
============================================================ */

dropZone.addEventListener(
    "click",
    () => fileInput.click()
);


fileInput.addEventListener(
    "change",
    async () =>
    {
        if (
            !fileInput.files.length
        )
        {
            return;
        }

        selectedFile =
            fileInput.files[0];

        selectedBytes = null;
        analysis = null;

        convertButton.disabled =
            true;

        resultsBox.innerHTML =
            "";

        setStatus(
            "Archivo seleccionado:\n\n" +
            `${selectedFile.name}\n` +
            `${formatBytes(
                selectedFile.size
            )}`
        );
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
            !event.dataTransfer.files.length
        )
        {
            return;
        }

        selectedFile =
            event.dataTransfer.files[0];

        selectedBytes = null;
        analysis = null;

        convertButton.disabled =
            true;

        resultsBox.innerHTML =
            "";

        setStatus(
            "Archivo seleccionado:\n\n" +
            `${selectedFile.name}\n` +
            `${formatBytes(
                selectedFile.size
            )}`
        );
    }
);


/* ============================================================
   ANÁLISIS DEL EXE
============================================================ */

analyzeButton.addEventListener(
    "click",
    async () =>
    {
        if (!selectedFile)
        {
            setStatus(
                "❌ Primero selecciona un EXE."
            );

            return;
        }

        analyzeButton.disabled =
            true;

        convertButton.disabled =
            true;

        try
        {
            setStatus(
                "📥 Cargando EXE...\n\n" +
                "Esto puede consumir bastante memoria " +
                "si el archivo es grande."
            );

            const buffer =
                await selectedFile.arrayBuffer();

            selectedBytes =
                new Uint8Array(buffer);

            setStatus(
                "🔎 Analizando estructura PE..."
            );

            analysis =
                analyzeExe(
                    selectedBytes
                );

            displayAnalysis();

            convertButton.disabled =
                false;
        }
        catch (error)
        {
            console.error(error);

            setStatus(
                "❌ Error:\n\n" +
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
   ANALIZADOR PE
============================================================ */

function getPEInfo(bytes)
{
    const result =
    {
        valid: false,
        machine: "Unknown",
        sections: []
    };

    if (
        bytes.length < 64 ||
        bytes[0] !== 0x4D ||
        bytes[1] !== 0x5A
    )
    {
        return result;
    }

    const peOffset =
        readU32LE(
            bytes,
            0x3C
        );

    if (
        peOffset + 24 >
        bytes.length
    )
    {
        return result;
    }

    if (
        !hasSignature(
            bytes,
            peOffset,
            [0x50, 0x45, 0x00, 0x00]
        )
    )
    {
        return result;
    }

    result.valid = true;

    const machine =
        readU16LE(
            bytes,
            peOffset + 4
        );

    switch (machine)
    {
        case 0x014C:
            result.machine = "x86";

            break;

        case 0x8664:
            result.machine = "x64";

            break;

        case 0xAA64:
            result.machine = "ARM64";

            break;

        case 0x01C4:
            result.machine = "ARM";

            break;

        default:
            result.machine =
                `Unknown (0x${machine.toString(16)})`;
    }


    const sectionCount =
        readU16LE(
            bytes,
            peOffset + 6
        );

    const optionalHeaderSize =
        readU16LE(
            bytes,
            peOffset + 20
        );

    const sectionTable =
        peOffset +
        24 +
        optionalHeaderSize;


    for (
        let i = 0;
        i < sectionCount;
        i++
    )
    {
        const sectionOffset =
            sectionTable +
            i * 40;

        if (
            sectionOffset + 40 >
            bytes.length
        )
        {
            break;
        }

        let name = "";

        for (
            let j = 0;
            j < 8;
            j++
        )
        {
            const char =
                bytes[
                    sectionOffset + j
                ];

            if (
                char === 0
            )
            {
                break;
            }

            name +=
                String.fromCharCode(
                    char
                );
        }

        const virtualSize =
            readU32LE(
                bytes,
                sectionOffset + 8
            );

        const virtualAddress =
            readU32LE(
                bytes,
                sectionOffset + 12
            );

        const rawSize =
            readU32LE(
                bytes,
                sectionOffset + 16
            );

        const rawPointer =
            readU32LE(
                bytes,
                sectionOffset + 20
            );

        result.sections.push(
        {
            name,
            virtualSize,
            virtualAddress,
            rawSize,
            rawPointer
        });
    }

    return result;
}


function analyzeExe(bytes)
{
    const pe =
        getPEInfo(bytes);

    const fnf =
        findText(
            bytes,
            "Friday Night Funkin"
        ) !== -1 ||
        findText(
            bytes,
            "funkin"
        ) !== -1 ||
        findText(
            bytes,
            "FNF"
        ) !== -1;

    const psych =
        findText(
            bytes,
            "Psych Engine"
        ) !== -1 ||
        findText(
            bytes,
            "PsychEngine"
        ) !== -1;

    const haxe =
        findText(
            bytes,
            "Haxe"
        ) !== -1;

    const flixel =
        findText(
            bytes,
            "HaxeFlixel"
        ) !== -1 ||
        findText(
            bytes,
            "flixel"
        ) !== -1;

    const openfl =
        findText(
            bytes,
            "OpenFL"
        ) !== -1 ||
        findText(
            bytes,
            "openfl"
        ) !== -1;

    const lime =
        findText(
            bytes,
            "Lime"
        ) !== -1 ||
        findText(
            bytes,
            "lime"
        ) !== -1;

    let score = 0;

    if (pe.valid)
        score += 10;

    if (fnf)
        score += 30;

    if (psych)
        score += 30;

    if (haxe)
        score += 10;

    if (flixel)
        score += 10;

    if (openfl)
        score += 5;

    if (lime)
        score += 5;

    score =
        Math.min(
            score,
            100
        );

    return {
        fileName:
            selectedFile.name,

        fileSize:
            bytes.length,

        pe,

        fnf,
        psych,
        haxe,
        flixel,
        openfl,
        lime,

        score
    };
}


/* ============================================================
   MOSTRAR RESULTADOS
============================================================ */

function displayAnalysis()
{
    const a =
        analysis;

    setStatus(
        "✅ Análisis terminado.\n\n" +
        `Archivo: ${a.fileName}\n` +
        `Tamaño: ${formatBytes(
            a.fileSize
        )}\n` +
        `Arquitectura: ${a.pe.machine}\n\n` +
        `Viabilidad inicial: ${a.score}/100`
    );

    resultsBox.innerHTML =
        "";

    addResult(
        "PE",
        a.pe.valid
            ? "✅ Válido"
            : "❌ No detectado",
        a.pe.valid
            ? "good"
            : "bad"
    );

    addResult(
        "Arquitectura",
        a.pe.machine,
        "good"
    );

    addResult(
        "Friday Night Funkin'",
        a.fnf
            ? "✅ Detectado"
            : "❌ No detectado",
        a.fnf
            ? "good"
            : "warn"
    );

    addResult(
        "Psych Engine",
        a.psych
            ? "✅ Detectado"
            : "⚠️ No detectado directamente",
        a.psych
            ? "good"
            : "warn"
    );

    addResult(
        "HaxeFlixel",
        a.flixel
            ? "✅ Detectado"
            : "⚠️ No detectado directamente",
        a.flixel
            ? "good"
            : "warn"
    );

    addResult(
        "Secciones PE",
        a.pe.sections.length,
        "good"
    );
}


function addResult(
    title,
    value,
    className
)
{
    const element =
        document.createElement(
            "div"
        );

    element.className =
        `result ${className}`;

    element.innerHTML =
        `<strong>${title}</strong><br>${value}`;

    resultsBox.appendChild(
        element
    );
}


/* ============================================================
   EXTRACCIÓN PNG
============================================================ */

function extractPNG(
    bytes,
    start
)
{
    const iend =
        asciiBytes(
            "IEND"
        );

    const end =
        findSignature(
            bytes,
            iend,
            start + 8
        );

    if (end === -1)
        return null;

    /*
      IEND:

      00 00 00 00
      I E N D
      CRC CRC CRC CRC

      Por eso terminamos 8 bytes después
      del texto IEND.
    */

    const finish =
        end + 8;

    if (
        finish <= start ||
        finish > bytes.length
    )
    {
        return null;
    }

    return {
        end: finish,
        data:
            sliceBytes(
                bytes,
                start,
                finish
            )
    };
}


/* ============================================================
   JPEG
============================================================ */

function extractJPEG(
    bytes,
    start
)
{
    let position =
        start + 2;

    while (
        position + 1 <
        bytes.length
    )
    {
        if (
            bytes[position] === 0xFF &&
            bytes[position + 1] === 0xD9
        )
        {
            const end =
                position + 2;

            return {
                end,

                data:
                    sliceBytes(
                        bytes,
                        start,
                        end
                    )
            };
        }

        position++;
    }

    return null;
}


/* ============================================================
   WEBP
============================================================ */

function extractWEBP(
    bytes,
    start
)
{
    if (
        !hasSignature(
            bytes,
            start,
            asciiBytes("RIFF")
        )
    )
    {
        return null;
    }

    if (
        !hasSignature(
            bytes,
            start + 8,
            asciiBytes("WEBP")
        )
    )
    {
        return null;
    }

    const size =
        readU32LE(
            bytes,
            start + 4
        );

    const end =
        start +
        8 +
        size;

    if (
        end > bytes.length
    )
    {
        return null;
    }

    return {
        end,
        data:
            sliceBytes(
                bytes,
                start,
                end
            )
    };
}


/* ============================================================
   WAV
============================================================ */

function extractWAV(
    bytes,
    start
)
{
    if (
        !hasSignature(
            bytes,
            start,
            asciiBytes("RIFF")
        )
    )
    {
        return null;
    }

    if (
        !hasSignature(
            bytes,
            start + 8,
            asciiBytes("WAVE")
        )
    )
    {
        return null;
    }

    const size =
        readU32LE(
            bytes,
            start + 4
        );

    const end =
        start +
        8 +
        size;

    if (
        end > bytes.length
    )
    {
        return null;
    }

    return {
        end,

        data:
            sliceBytes(
                bytes,
                start,
                end
            )
    };
}


/* ============================================================
   OGG
============================================================ */

function extractOGG(
    bytes,
    start
)
{
    let position =
        start;

    let pages = 0;

    let sawEOS = false;

    /*
      Ogg page:

      0-3   "OggS"
      4     version
      5     header type
      6-13  granule
      14-17 serial
      18-21 sequence
      22-25 checksum
      26    segment count
      27... segment table
      payload follows
    */

    while (
        position + 27 <=
        bytes.length
    )
    {
        if (
            !hasSignature(
                bytes,
                position,
                [0x4F, 0x67, 0x67, 0x53]
            )
        )
        {
            break;
        }

        const headerType =
            bytes[position + 5];

        const segmentCount =
            bytes[position + 26];

        const tableStart =
            position + 27;

        const payloadStart =
            tableStart +
            segmentCount;

        if (
            payloadStart >
            bytes.length
        )
        {
            return null;
        }

        let payloadSize = 0;

        for (
            let i = 0;
            i < segmentCount;
            i++
        )
        {
            payloadSize +=
                bytes[
                    tableStart + i
                ];
        }

        const pageEnd =
            payloadStart +
            payloadSize;

        if (
            pageEnd >
            bytes.length
        )
        {
            return null;
        }

        pages++;

        if (
            headerType & 0x04
        )
        {
            sawEOS = true;

            return {
                end: pageEnd,

                data:
                    sliceBytes(
                        bytes,
                        start,
                        pageEnd
                    ),

                pages
            };
        }

        position =
            pageEnd;
    }

    /*
      Si no hubo EOS pero tenemos al menos una página,
      no extraemos porque podría ser un OGG incompleto.
    */

    return null;
}


/* ============================================================
   ZIP EMBEBIDO
============================================================ */

function findEOCD(
    bytes,
    start
)
{
    const signature =
        [0x50, 0x4B, 0x05, 0x06];

    /*
      El comentario máximo de un ZIP es 65535 bytes,
      así que basta buscar hacia atrás desde el final.
    */

    const minimum =
        Math.max(
            start,
            bytes.length -
            65557
        );

    for (
        let i = bytes.length - 22;
        i >= minimum;
        i--
    )
    {
        if (
            hasSignature(
                bytes,
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


function extractEmbeddedZip(
    bytes,
    start
)
{
    const eocd =
        findEOCD(
            bytes,
            start
        );

    if (eocd === -1)
        return null;

    const commentLength =
        readU16LE(
            bytes,
            eocd + 20
        );

    const end =
        eocd +
        22 +
        commentLength;

    if (
        end > bytes.length
    )
    {
        return null;
    }

    const candidate =
        sliceBytes(
            bytes,
            start,
            end
        );

    try
    {
        const entries =
            fflate.unzipSync(
                candidate
            );

        const names =
            Object.keys(
                entries
            );

        if (
            names.length === 0
        )
        {
            return null;
        }

        return {
            end,
            data: candidate,
            entries
        };
    }
    catch
    {
        return null;
    }
}


/* ============================================================
   EXTRACCIÓN PRINCIPAL
============================================================ */

async function extractResources(
    bytes
)
{
    const result =
    {
        files: [],
        counts:
        {
            png: 0,
            jpg: 0,
            webp: 0,
            wav: 0,
            ogg: 0,
            zip: 0
        }
    };

    const usedNames =
        new Set();

    const addResource =
    (
        path,
        data,
        type,
        sourceOffset
    ) =>
    {
        result.files.push(
        {
            path,
            data,
            type,
            sourceOffset,
            size: data.length
        });
    };


    /* --------------------------------------------------------
       PNG
    -------------------------------------------------------- */

    setStatus(
        "🖼️ Buscando PNG reales..."
    );

    let position = 0;

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

    while (true)
    {
        const found =
            findSignature(
                bytes,
                pngSig,
                position
            );

        if (found === -1)
            break;

        const extracted =
            extractPNG(
                bytes,
                found
            );

        if (extracted)
        {
            const name =
                uniqueName(
                    usedNames,
                    `image_${result.counts.png + 1}`,
                    ".png"
                );

            result.counts.png++;

            addResource(
                `assets/images/${name}`,
                extracted.data,
                "PNG",
                found
            );

            position =
                extracted.end;
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
        "🖼️ Buscando JPEG reales..."
    );

    position = 0;

    const jpgSig =
    [
        0xFF,
        0xD8,
        0xFF
    ];

    while (true)
    {
        const found =
            findSignature(
                bytes,
                jpgSig,
                position
            );

        if (found === -1)
            break;

        const extracted =
            extractJPEG(
                bytes,
                found
            );

        if (extracted)
        {
            const name =
                uniqueName(
                    usedNames,
                    `image_${result.counts.jpg + 1}`,
                    ".jpg"
                );

            result.counts.jpg++;

            addResource(
                `assets/images/${name}`,
                extracted.data,
                "JPEG",
                found
            );

            position =
                extracted.end;
        }
        else
        {
            position =
                found + 3;
        }
    }


    /* --------------------------------------------------------
       WEBP
    -------------------------------------------------------- */

    setStatus(
        "🖼️ Buscando WebP reales..."
    );

    position = 0;

    const riffSig =
        asciiBytes("RIFF");

    while (true)
    {
        const found =
            findSignature(
                bytes,
                riffSig,
                position
            );

        if (found === -1)
            break;

        if (
            hasSignature(
                bytes,
                found + 8,
                asciiBytes("WEBP")
            )
        )
        {
            const extracted =
                extractWEBP(
                    bytes,
                    found
                );

            if (extracted)
            {
                const name =
                    uniqueName(
                        usedNames,
                        `image_${result.counts.webp + 1}`,
                        ".webp"
                    );

                result.counts.webp++;

                addResource(
                    `assets/images/${name}`,
                    extracted.data,
                    "WEBP",
                    found
                );

                position =
                    extracted.end;

                continue;
            }
        }

        position =
            found + 4;
    }


    /* --------------------------------------------------------
       WAV
    -------------------------------------------------------- */

    setStatus(
        "🔊 Buscando WAV reales..."
    );

    position = 0;

    while (true)
    {
        const found =
            findSignature(
                bytes,
                riffSig,
                position
            );

        if (found === -1)
            break;

        if (
            hasSignature(
                bytes,
                found + 8,
                asciiBytes("WAVE")
            )
        )
        {
            const extracted =
                extractWAV(
                    bytes,
                    found
                );

            if (extracted)
            {
                const name =
                    uniqueName(
                        usedNames,
                        `audio_${result.counts.wav + 1}`,
                        ".wav"
                    );

                result.counts.wav++;

                addResource(
                    `assets/audio/${name}`,
                    extracted.data,
                    "WAV",
                    found
                );

                position =
                    extracted.end;

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
        "🎵 Buscando streams OGG..."
    );

    position = 0;

    const oggSig =
    [
        0x4F,
        0x67,
        0x67,
        0x53
    ];

    while (true)
    {
        const found =
            findSignature(
                bytes,
                oggSig,
                position
            );

        if (found === -1)
            break;

        const extracted =
            extractOGG(
                bytes,
                found
            );

        if (extracted)
        {
            const name =
                uniqueName(
                    usedNames,
                    `audio_${result.counts.ogg + 1}`,
                    ".ogg"
                );

            result.counts.ogg++;

            addResource(
                `assets/audio/${name}`,
                extracted.data,
                "OGG",
                found
            );

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
       ZIP
    -------------------------------------------------------- */

    setStatus(
        "📦 Buscando archivos ZIP incrustados..."
    );

    position = 0;

    const zipSig =
    [
        0x50,
        0x4B,
        0x03,
        0x04
    ];

    while (true)
    {
        const found =
            findSignature(
                bytes,
                zipSig,
                position
            );

        if (found === -1)
            break;

        const extracted =
            extractEmbeddedZip(
                bytes,
                found
            );

        if (extracted)
        {
            result.counts.zip++;

            for (
                const [name, data]
                of Object.entries(
                    extracted.entries
                )
            )
            {
                if (
                    name.endsWith("/")
                )
                {
                    continue;
                }

                /*
                  Protección contra nombres extraños.
                */

                const safePath =
                    name
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

                addResource(
                    `assets/extracted/${safePath}`,
                    data,
                    "ZIP_ENTRY",
                    found
                );
            }

            position =
                extracted.end;
        }
        else
        {
            position =
                found + 4;
        }
    }


    return result;
}


/* ============================================================
   GENERAR PROYECTO
============================================================ */

convertButton.addEventListener(
    "click",
    async () =>
    {
        if (
            !selectedBytes ||
            !analysis
        )
        {
            setStatus(
                "❌ Primero analiza el EXE."
            );

            return;
        }

        convertButton.disabled =
            true;

        analyzeButton.disabled =
            true;

        try
        {
            const resources =
                await extractResources(
                    selectedBytes
                );

            setStatus(
                "🧱 Construyendo proyecto web..."
            );

            const zip =
                buildProjectZip(
                    analysis,
                    resources
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
                "MissaWeb.zip"
            );

            displayExtractionResult(
                resources
            );
        }
        catch (error)
        {
            console.error(error);

            setStatus(
                "❌ Error durante la extracción:\n\n" +
                error.message
            );
        }
        finally
        {
            convertButton.disabled =
                false;

            analyzeButton.disabled =
                false;
        }
    }
);


/* ============================================================
   ZIP FINAL
============================================================ */

function buildProjectZip(
    analysis,
    resources
)
{
    const files = {};


    /* --------------------------------------------------------
       index.html
    -------------------------------------------------------- */

    files["index.html"] =
`<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>MISSA V3 WEB</title>

    <link
        rel="stylesheet"
        href="style.css"
    >
</head>

<body>

<div id="game">

    <h1>MISSA V3 WEB</h1>

    <p>
        Proyecto generado por FNF Web Converter
    </p>

    <button id="start">
        INICIAR
    </button>

    <div id="status">
        Runtime esperando...
    </div>

</div>

<script src="game.js"></script>

</body>

</html>
`;


    /* --------------------------------------------------------
       CSS
    -------------------------------------------------------- */

    files["style.css"] =
`html,
body
{
    margin: 0;
    padding: 0;

    width: 100%;
    height: 100%;
}

body
{
    display: flex;

    align-items: center;
    justify-content: center;

    background: #111;

    color: white;

    font-family:
        Arial,
        sans-serif;
}

#game
{
    width: 900px;
    max-width: 90%;

    text-align: center;
}

button
{
    padding: 14px 30px;

    border: none;
    border-radius: 10px;

    cursor: pointer;

    font-size: 18px;
}

#status
{
    margin-top: 20px;

    font-family:
        monospace;
}
`;


    /* --------------------------------------------------------
       JS
    -------------------------------------------------------- */

    files["game.js"] =
`const start =
    document.getElementById("start");

const status =
    document.getElementById("status");

start.addEventListener(
    "click",
    () =>
    {
        status.textContent =
            "Runtime web iniciado.";
    }
);
`;


    /* --------------------------------------------------------
       README
    -------------------------------------------------------- */

    files["README.txt"] =
`MISSA V3 WEB
============

Este proyecto fue generado automáticamente
por FNF Web Converter.

Motor detectado:
${analysis.psych ? "Psych Engine" : "FNF / motor no confirmado"}

HaxeFlixel:
${analysis.flixel ? "Sí" : "No confirmado"}

Recursos extraídos:
PNG: ${resources.counts.png}
JPEG: ${resources.counts.jpg}
WebP: ${resources.counts.webp}
WAV: ${resources.counts.wav}
OGG: ${resources.counts.ogg}
ZIP: ${resources.counts.zip}

IMPORTANTE:

Los recursos extraídos son los que pudieron
identificarse estructuralmente dentro del EXE.

El código Haxe/C++ compilado de Windows
NO se convierte automáticamente en JavaScript.

El siguiente objetivo del proyecto es implementar
un runtime FNF compatible con los datos extraídos.
`;


    /* --------------------------------------------------------
       MANIFEST REAL
    -------------------------------------------------------- */

    const manifest =
    {
        converter:
        {
            version:
                "4.0.0"
        },

        original:
        {
            name:
                analysis.fileName,

            size:
                analysis.fileSize,

            engine:
                analysis.psych
                    ? "Psych Engine"
                    : "Friday Night Funkin / Unknown"
        },

        resources:
            resources.files.map(
                file =>
                ({
                    path:
                        file.path,

                    type:
                        file.type,

                    size:
                        file.size,

                    sourceOffset:
                        file.sourceOffset
                })
            ),

        counts:
            resources.counts
    };


    files["manifest.json"] =
        JSON.stringify(
            manifest,
            null,
            4
        );


    /* --------------------------------------------------------
       Recursos binarios
    -------------------------------------------------------- */

    for (
        const resource
        of resources.files
    )
    {
        files[
            resource.path
        ] =
            resource.data;
    }


    /* --------------------------------------------------------
       Comprimir
    -------------------------------------------------------- */

    return fflate.zipSync(
        files,
        {
            level: 6
        }
    );
}


/* ============================================================
   RESULTADO
============================================================ */

function displayExtractionResult(
    resources
)
{
    setStatus(
        "✅ EXTRACCIÓN TERMINADA\n\n" +

        `PNG reales: ${resources.counts.png}\n` +
        `JPEG reales: ${resources.counts.jpg}\n` +
        `WebP reales: ${resources.counts.webp}\n` +
        `WAV reales: ${resources.counts.wav}\n` +
        `OGG reales: ${resources.counts.ogg}\n` +
        `ZIP encontrados: ${resources.counts.zip}\n\n` +

        `Archivos extraídos: ${resources.files.length}\n\n` +

        "📦 MissaWeb.zip descargado."
    );

    resultsBox.innerHTML =
        "";

    addResult(
        "PNG reales extraídos",
        resources.counts.png,
        "good"
    );

    addResult(
        "JPEG reales extraídos",
        resources.counts.jpg,
        "good"
    );

    addResult(
        "WebP reales extraídos",
        resources.counts.webp,
        "good"
    );

    addResult(
        "WAV reales extraídos",
        resources.counts.wav,
        "good"
    );

    addResult(
        "OGG reales extraídos",
        resources.counts.ogg,
        "good"
    );

    addResult(
        "ZIP incrustados",
        resources.counts.zip,
        "good"
    );

    addResult(
        "Total de archivos",
        resources.files.length,
        "good"
    );
}


/* ============================================================
   DESCARGA
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

    link.href = url;

    link.download =
        filename;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    setTimeout(
        () =>
            URL.revokeObjectURL(url),
        2000
    );
}
