"use strict";

/*
============================================================
 FNF WEB CONVERTER V6

 OBJETIVO

 EXE
  ↓
 extracción real
  ↓
 PNG / JPG / WEBP / WAV / OGG
  ↓
 JSON reales
  ↓
 detección de charts Psych Engine
  ↓
 ZIP
  ↓
 navegador
  ↓
 selector de chart + audio
  ↓
 gameplay FNF básico

 Esta versión NO convierte el código Haxe compilado.
 Convierte/recupera los datos que podamos identificar.
============================================================
*/

const fileInput = document.getElementById("file");
const drop = document.getElementById("drop");
const analyzeButton = document.getElementById("analyze");
const extractButton = document.getElementById("extract");
const status = document.getElementById("status");
const results = document.getElementById("results");
const bar = document.getElementById("bar");

let selectedFile = null;
let selectedBytes = null;
let analysis = null;


/* ============================================================
   UTILIDADES
============================================================ */

function setStatus(text) {
    status.textContent = text;
}

function progress(value) {
    bar.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function textBytes(text) {
    return Uint8Array.from(
        [...text].map(c => c.charCodeAt(0))
    );
}

function hasSignature(bytes, offset, signature) {

    if (offset + signature.length > bytes.length) {
        return false;
    }

    for (let i = 0; i < signature.length; i++) {
        if (bytes[offset + i] !== signature[i]) {
            return false;
        }
    }

    return true;
}

function findSignature(bytes, signature, start = 0, end = bytes.length) {

    const limit =
        Math.min(end, bytes.length) -
        signature.length;

    for (let i = start; i <= limit; i++) {
        if (hasSignature(bytes, i, signature)) {
            return i;
        }
    }

    return -1;
}

function findText(bytes, text, start = 0, end = bytes.length) {
    return findSignature(
        bytes,
        textBytes(text),
        start,
        end
    );
}

function readU16LE(bytes, offset) {

    if (offset + 2 > bytes.length) {
        return 0;
    }

    return (
        bytes[offset] |
        (bytes[offset + 1] << 8)
    ) & 0xFFFF;
}

function readU32LE(bytes, offset) {

    if (offset + 4 > bytes.length) {
        return 0;
    }

    return (
        bytes[offset] |
        (bytes[offset + 1] << 8) |
        (bytes[offset + 2] << 16) |
        (bytes[offset + 3] << 24)
    ) >>> 0;
}

function formatBytes(value) {

    if (value < 1024) {
        return `${value} B`;
    }

    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(2)} KB`;
    }

    if (value < 1024 * 1024 * 1024) {
        return `${(
            value /
            1024 /
            1024
        ).toFixed(2)} MB`;
    }

    return `${(
        value /
        1024 /
        1024 /
        1024
    ).toFixed(2)} GB`;
}

function safeFilename(name) {

    return name
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .replace(/\s+/g, "_")
        .slice(0, 180);
}


/* ============================================================
   ARCHIVO
============================================================ */

drop.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", () => {

    if (!fileInput.files.length) {
        return;
    }

    selectFile(fileInput.files[0]);
});

drop.addEventListener("dragover", event => {

    event.preventDefault();

    drop.classList.add("drag");
});

drop.addEventListener("dragleave", () => {

    drop.classList.remove("drag");
});

drop.addEventListener("drop", event => {

    event.preventDefault();

    drop.classList.remove("drag");

    if (!event.dataTransfer.files.length) {
        return;
    }

    selectFile(
        event.dataTransfer.files[0]
    );
});

function selectFile(file) {

    selectedFile = file;
    selectedBytes = null;
    analysis = null;

    analyzeButton.disabled = false;
    extractButton.disabled = true;

    results.innerHTML = "";

    setStatus(
        "📦 Archivo seleccionado\n\n" +
        `Nombre: ${file.name}\n` +
        `Tamaño: ${formatBytes(file.size)}\n\n` +
        "Pulsa ANALIZAR."
    );

    progress(0);
}


/* ============================================================
   PE
============================================================ */

function analyzePE(bytes) {

    const result = {
        valid: false,
        machine: "Unknown",
        peOffset: null
    };

    if (
        bytes.length < 64 ||
        bytes[0] !== 0x4D ||
        bytes[1] !== 0x5A
    ) {
        return result;
    }

    const peOffset =
        readU32LE(bytes, 0x3C);

    if (peOffset + 24 > bytes.length) {
        return result;
    }

    if (
        !hasSignature(
            bytes,
            peOffset,
            [0x50, 0x45, 0x00, 0x00]
        )
    ) {
        return result;
    }

    result.valid = true;
    result.peOffset = peOffset;

    const machine =
        readU16LE(
            bytes,
            peOffset + 4
        );

    switch (machine) {

        case 0x014C:
            result.machine = "x86 (32-bit)";
            break;

        case 0x8664:
            result.machine = "x64 (64-bit)";
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

    return result;
}


/* ============================================================
   MOTOR
============================================================ */

function detectEngine(bytes) {

    const fnf =
        findText(bytes, "Friday Night Funkin") !== -1 ||
        findText(bytes, "funkin") !== -1 ||
        findText(bytes, "FNF") !== -1;

    const psych =
        findText(bytes, "Psych Engine") !== -1 ||
        findText(bytes, "PsychEngine") !== -1;

    const haxe =
        findText(bytes, "Haxe") !== -1;

    const flixel =
        findText(bytes, "HaxeFlixel") !== -1 ||
        findText(bytes, "flixel") !== -1;

    const openfl =
        findText(bytes, "OpenFL") !== -1 ||
        findText(bytes, "openfl") !== -1;

    const lime =
        findText(bytes, "Lime") !== -1 ||
        findText(bytes, "lime") !== -1;

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

function countSignature(bytes, signature) {

    let count = 0;
    let position = 0;

    while (true) {

        const found =
            findSignature(
                bytes,
                signature,
                position
            );

        if (found === -1) {
            break;
        }

        count++;

        position =
            found +
            Math.max(
                1,
                signature.length
            );
    }

    return count;
}


/* ============================================================
   ANÁLISIS
============================================================ */

function analyzeGame(bytes) {

    const pe =
        analyzePE(bytes);

    const engine =
        detectEngine(bytes);

    const png =
        countSignature(
            bytes,
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
        );

    const jpg =
        countSignature(
            bytes,
            [
                0xFF,
                0xD8,
                0xFF
            ]
        );

    const ogg =
        countSignature(
            bytes,
            [
                0x4F,
                0x67,
                0x67,
                0x53
            ]
        );

    const riff =
        countSignature(
            bytes,
            [
                0x52,
                0x49,
                0x46,
                0x46
            ]
        );

    const zip =
        countSignature(
            bytes,
            [
                0x50,
                0x4B,
                0x03,
                0x04
            ]
        );

    let score = 0;

    if (pe.valid) score += 10;
    if (engine.fnf) score += 25;
    if (engine.psych) score += 35;
    if (engine.flixel) score += 15;
    if (ogg > 0) score += 5;
    if (png > 0) score += 5;
    if (riff > 0) score += 5;

    score =
        Math.min(100, score);

    return {
        pe,
        engine,

        resources: {
            png,
            jpg,
            ogg,
            riff,
            zip
        },

        score
    };
}


/* ============================================================
   RESULTADOS
============================================================ */

function addResult(title, value, good = true) {

    const element =
        document.createElement("div");

    element.className =
        `result ${good ? "good" : "warn"}`;

    element.innerHTML =
        `<strong>${title}</strong><br>${value}`;

    results.appendChild(element);
}

function displayAnalysis() {

    results.innerHTML = "";

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
        "Friday Night Funkin'",
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
        "PNG binarios",
        analysis.resources.png
    );

    addResult(
        "JPEG binarios",
        analysis.resources.jpg
    );

    addResult(
        "OGG",
        analysis.resources.ogg
    );

    addResult(
        "RIFF/WAV",
        analysis.resources.riff
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
    async () => {

        if (!selectedFile) {
            return;
        }

        analyzeButton.disabled = true;
        extractButton.disabled = true;

        try {

            setStatus(
                "📥 Cargando EXE..."
            );

            const buffer =
                await selectedFile.arrayBuffer();

            selectedBytes =
                new Uint8Array(buffer);

            progress(20);

            setStatus(
                "🔎 Analizando PE..."
            );

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        20
                    )
            );

            analysis =
                analyzeGame(
                    selectedBytes
                );

            progress(100);

            displayAnalysis();

            extractButton.disabled =
                false;

            setStatus(
                "✅ Análisis terminado.\n\n" +
                `Tamaño: ${formatBytes(
                    selectedBytes.length
                )}\n` +
                `Arquitectura: ${
                    analysis.pe.machine
                }\n` +
                `Puntuación: ${
                    analysis.score
                }/100`
            );

        }
        catch (error) {

            console.error(error);

            setStatus(
                "❌ Error:\n\n" +
                error.message
            );
        }
        finally {

            analyzeButton.disabled =
                false;
        }
    }
);


/* ============================================================
   EXTRAER PNG
============================================================ */

function extractPNG(bytes, start) {

    const iend =
        textBytes("IEND");

    const end =
        findSignature(
            bytes,
            iend,
            start + 8
        );

    if (end === -1) {
        return null;
    }

    const finish =
        end + 8;

    if (
        finish <= start ||
        finish > bytes.length
    ) {
        return null;
    }

    return bytes.slice(
        start,
        finish
    );
}


/* ============================================================
   EXTRAER JPG
============================================================ */

function extractJPG(bytes, start) {

    for (
        let i = start + 3;
        i + 1 < bytes.length;
        i++
    ) {

        if (
            bytes[i] === 0xFF &&
            bytes[i + 1] === 0xD9
        ) {

            return bytes.slice(
                start,
                i + 2
            );
        }
    }

    return null;
}


/* ============================================================
   WAV / WEBP
============================================================ */

function extractRIFF(
    bytes,
    start,
    subtype
) {

    if (
        !hasSignature(
            bytes,
            start,
            textBytes("RIFF")
        )
    ) {
        return null;
    }

    if (
        !hasSignature(
            bytes,
            start + 8,
            textBytes(subtype)
        )
    ) {
        return null;
    }

    const size =
        readU32LE(
            bytes,
            start + 4
        );

    const finish =
        start +
        8 +
        size;

    if (
        finish > bytes.length ||
        finish <= start
    ) {
        return null;
    }

    return bytes.slice(
        start,
        finish
    );
}


/* ============================================================
   OGG
============================================================ */

function extractOGG(bytes, start) {

    let position =
        start;

    while (
        position + 27 <=
        bytes.length
    ) {

        if (
            !hasSignature(
                bytes,
                position,
                [
                    0x4F,
                    0x67,
                    0x67,
                    0x53
                ]
            )
        ) {
            return null;
        }

        const headerType =
            bytes[position + 5];

        const segments =
            bytes[position + 26];

        const table =
            position + 27;

        const payload =
            table +
            segments;

        if (
            payload >
            bytes.length
        ) {
            return null;
        }

        let payloadSize = 0;

        for (
            let i = 0;
            i < segments;
            i++
        ) {
            payloadSize +=
                bytes[
                    table + i
                ];
        }

        const pageEnd =
            payload +
            payloadSize;

        if (
            pageEnd >
            bytes.length
        ) {
            return null;
        }

        if (
            headerType & 0x04
        ) {
            return bytes.slice(
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
   JSON DETECTION
============================================================ */

/*
    Lee un objeto JSON completo empezando en "{"
    respetando strings y escapes.

    Esto evita muchos falsos positivos.
*/

function extractJSONAt(
    bytes,
    start,
    maxSize = 8 * 1024 * 1024
) {

    if (
        bytes[start] !== 0x7B
    ) {
        return null;
    }

    const endLimit =
        Math.min(
            bytes.length,
            start + maxSize
        );

    const decoder =
        new TextDecoder(
            "utf-8",
            {
                fatal: false
            }
        );

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (
        let i = start;
        i < endLimit;
        i++
    ) {

        const byte =
            bytes[i];

        if (inString) {

            if (escaped) {
                escaped = false;
                continue;
            }

            if (byte === 0x5C) {
                escaped = true;
                continue;
            }

            if (byte === 0x22) {
                inString = false;
            }

            continue;
        }

        if (byte === 0x22) {
            inString = true;
            continue;
        }

        if (byte === 0x7B) {
            depth++;
        }
        else if (byte === 0x7D) {

            depth--;

            if (depth === 0) {

                const raw =
                    bytes.slice(
                        start,
                        i + 1
                    );

                const text =
                    decoder.decode(
                        raw
                    );

                try {

                    const object =
                        JSON.parse(
                            text
                        );

                    return {
                        end:
                            i + 1,

                        text,
                        object
                    };

                }
                catch {

                    return null;
                }
            }
        }
    }

    return null;
}


/* ============================================================
   ¿ES CHART PSYCH ENGINE?
============================================================ */

function scoreChart(
    object,
    text
) {

    let score = 0;

    if (
        object &&
        typeof object === "object"
    ) {
        score += 5;
    }

    if (
        object.song &&
        typeof object.song === "object"
    ) {
        score += 20;
    }

    if (
        object.song &&
        Array.isArray(
            object.song.notes
        )
    ) {
        score += 30;
    }

    if (
        object.song &&
        object.song.bpm !== undefined
    ) {
        score += 10;
    }

    if (
        object.song &&
        object.song.song
    ) {
        score += 10;
    }

    if (
        object.song &&
        object.song.speed !== undefined
    ) {
        score += 10;
    }

    if (
        text.includes(
            "sectionNotes"
        )
    ) {
        score += 15;
    }

    return Math.min(
        score,
        100
    );
}


/* ============================================================
   BUSCAR JSONS
============================================================ */

function extractJSONResources(
    bytes
) {

    const candidates = [];

    let position = 0;

    let attempts = 0;

    while (
        position <
        bytes.length &&
        attempts < 50000
    ) {

        const found =
            findSignature(
                bytes,
                [0x7B],
                position
            );

        if (found === -1) {
            break;
        }

        attempts++;

        const extracted =
            extractJSONAt(
                bytes,
                found
            );

        if (extracted) {

            const score =
                scoreChart(
                    extracted.object,
                    extracted.text
                );

            /*
              Solo guardamos JSON suficientemente
              grandes/estructurados como para ser útiles.
            */

            if (
                score >= 10
            ) {

                candidates.push(
                {
                    offset:
                        found,

                    end:
                        extracted.end,

                    size:
                        extracted.end -
                        found,

                    score,

                    object:
                        extracted.object,

                    text:
                        extracted.text
                });

                position =
                    extracted.end;

                continue;
            }
        }

        position =
            found + 1;

        if (
            attempts % 500 === 0
        ) {
            progress(
                20 +
                Math.min(
                    35,
                    attempts / 1000
                )
            );
        }
    }

    return deduplicateJSON(
        candidates
    );
}


/* ============================================================
   ELIMINAR DUPLICADOS
============================================================ */

function deduplicateJSON(
    list
) {

    const result = [];
    const seen = new Set();

    for (
        const item of list
    ) {

        const key =
            item.text;

        if (
            seen.has(key)
        ) {
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
   BUSCAR NOMBRES CERCANOS
============================================================ */

function findNearbyFilename(
    bytes,
    offset,
    extension
) {

    const decoder =
        new TextDecoder(
            "latin1"
        );

    const range =
        4096;

    const start =
        Math.max(
            0,
            offset - range
        );

    const end =
        Math.min(
            bytes.length,
            offset + range
        );

    const text =
        decoder.decode(
            bytes.slice(
                start,
                end
            )
        );

    const regex =
        new RegExp(
            `[A-Za-z0-9_./\\\\ -]{1,180}\\\\${extension}|` +
            `[A-Za-z0-9_./\\\\ -]{1,180}\\${extension}`,
            "ig"
        );

    const match =
        text.match(
            regex
        );

    if (!match) {
        return null;
    }

    return safeFilename(
        match[0]
            .replace(
                /\\/g,
                "/"
            )
            .split("/")
            .pop()
    );
}


/* ============================================================
   EXTRAER TODO
============================================================ */

async function extractAll() {

    const output = [];

    /*
      PNG
    */

    setStatus(
        "🖼️ Extrayendo PNG..."
    );

    progress(5);

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
    let pngIndex = 0;

    while (true) {

        const found =
            findSignature(
                selectedBytes,
                pngSig,
                position
            );

        if (found === -1) {
            break;
        }

        const data =
            extractPNG(
                selectedBytes,
                found
            );

        if (data) {

            pngIndex++;

            const nearby =
                findNearbyFilename(
                    selectedBytes,
                    found,
                    ".png"
                );

            const filename =
                safeFilename(
                    nearby ||
                    `image_${pngIndex}.png`
                );

            const path =
                `assets/images/${pngIndex}_${filename}`;

            output.push(
            {
                path,
                data,
                type: "PNG",
                offset: found
            });

            position =
                found +
                data.length;
        }
        else {

            position =
                found + 8;
        }
    }


    /*
      JPG
    */

    setStatus(
        "🖼️ Extrayendo JPEG..."
    );

    progress(15);

    const jpgSig =
    [
        0xFF,
        0xD8,
        0xFF
    ];

    position = 0;

    let jpgIndex = 0;

    while (true) {

        const found =
            findSignature(
                selectedBytes,
                jpgSig,
                position
            );

        if (found === -1) {
            break;
        }

        const data =
            extractJPG(
                selectedBytes,
                found
            );

        if (data) {

            jpgIndex++;

            output.push(
            {
                path:
                    `assets/images/jpg_${jpgIndex}.jpg`,

                data,
                type: "JPEG",
                offset: found
            });

            position =
                found +
                data.length;
        }
        else {

            position =
                found + 3;
        }
    }


    /*
      RIFF
    */

    setStatus(
        "🔊 Extrayendo WAV/WebP..."
    );

    progress(25);

    const riffSig =
        textBytes("RIFF");

    position = 0;

    let wavIndex = 0;
    let webpIndex = 0;

    while (true) {

        const found =
            findSignature(
                selectedBytes,
                riffSig,
                position
            );

        if (found === -1) {
            break;
        }

        if (
            hasSignature(
                selectedBytes,
                found + 8,
                textBytes("WAVE")
            )
        ) {

            const data =
                extractRIFF(
                    selectedBytes,
                    found,
                    "WAVE"
                );

            if (data) {

                wavIndex++;

                output.push(
                {
                    path:
                        `assets/audio/wav_${wavIndex}.wav`,

                    data,
                    type: "WAV",
                    offset: found
                });

                position =
                    found +
                    data.length;

                continue;
            }
        }

        if (
            hasSignature(
                selectedBytes,
                found + 8,
                textBytes("WEBP")
            )
        ) {

            const data =
                extractRIFF(
                    selectedBytes,
                    found,
                    "WEBP"
                );

            if (data) {

                webpIndex++;

                output.push(
                {
                    path:
                        `assets/images/webp_${webpIndex}.webp`,

                    data,
                    type: "WEBP",
                    offset: found
                });

                position =
                    found +
                    data.length;

                continue;
            }
        }

        position =
            found + 4;
    }


    /*
      OGG
    */

    setStatus(
        "🎵 Extrayendo OGG..."
    );

    progress(35);

    const oggSig =
    [
        0x4F,
        0x67,
        0x67,
        0x53
    ];

    position = 0;

    let oggIndex = 0;

    while (true) {

        const found =
            findSignature(
                selectedBytes,
                oggSig,
                position
            );

        if (found === -1) {
            break;
        }

        const data =
            extractOGG(
                selectedBytes,
                found
            );

        if (data) {

            oggIndex++;

            const nearby =
                findNearbyFilename(
                    selectedBytes,
                    found,
                    ".ogg"
                );

            const filename =
                safeFilename(
                    nearby ||
                    `audio_${oggIndex}.ogg`
                );

            output.push(
            {
                path:
                    `assets/audio/${oggIndex}_${filename}`,

                data,
                type: "OGG",
                offset: found
            });

            position =
                found +
                data.length;
        }
        else {

            position =
                found + 4;
        }
    }


    /*
      JSON
    */

    setStatus(
        "📊 Buscando JSON reales y charts..."
    );

    progress(50);

    const jsonCandidates =
        extractJSONResources(
            selectedBytes
        );

    let jsonIndex = 0;

    const charts = [];

    for (
        const candidate
        of jsonCandidates
    ) {

        jsonIndex++;

        const isChart =
            candidate.score >= 50;

        let filename;

        if (isChart) {

            filename =
                `chart_${charts.length + 1}.json`;

        }
        else {

            filename =
                `data_${jsonIndex}.json`;
        }

        const path =
            `assets/data/${filename}`;

        const data =
            new TextEncoder()
                .encode(
                    candidate.text
                );

        output.push(
        {
            path,
            data,
            type:
                isChart
                    ? "PSYCH_CHART"
                    : "JSON",

            offset:
                candidate.offset,

            score:
                candidate.score
        });

        if (isChart) {

            charts.push(
            {
                path,
                score:
                    candidate.score,

                offset:
                    candidate.offset,

                size:
                    candidate.size,

                song:
                    candidate.object &&
                    candidate.object.song
                        ? candidate.object.song.song || null
                        : null,

                bpm:
                    candidate.object &&
                    candidate.object.song
                        ? candidate.object.song.bpm || null
                        : null,

                speed:
                    candidate.object &&
                    candidate.object.song
                        ? candidate.object.song.speed || null
                        : null
            });
        }
    }


    progress(100);

    return {
        files: output,
        charts
    };
}


/* ============================================================
   EXTRAER
============================================================ */

extractButton.addEventListener(
    "click",
    async () => {

        if (
            !selectedBytes ||
            !analysis
        ) {
            return;
        }

        extractButton.disabled =
            true;

        analyzeButton.disabled =
            true;

        try {

            const extracted =
                await extractAll();

            setStatus(
                "📦 Generando proyecto web..."
            );

            const zip =
                buildProject(
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

            link.href = url;

            link.download =
                "MissaWeb.zip";

            document.body.appendChild(
                link
            );

            link.click();

            link.remove();

            setStatus(
                "✅ MISSA WEB GENERADO\n\n" +

                `Archivos extraídos: ${
                    extracted.files.length
                }\n` +

                `Charts detectados: ${
                    extracted.charts.length
                }\n\n` +

                "Descarga: MissaWeb.zip"
            );

            showExtractionResults(
                extracted
            );

        }
        catch (error) {

            console.error(error);

            setStatus(
                "❌ Error:\n\n" +
                error.message
            );

        }
        finally {

            extractButton.disabled =
                false;

            analyzeButton.disabled =
                false;
        }
    }
);


/* ============================================================
   RESULTADO EXTRACCIÓN
============================================================ */

function showExtractionResults(
    extracted
) {

    results.innerHTML = "";

    addResult(
        "Archivos extraídos",
        extracted.files.length
    );

    addResult(
        "Charts Psych Engine",
        extracted.charts.length
    );

    const chartNames =
        extracted.charts
            .slice(0, 20)
            .map(
                (chart, index) =>
                    `${index + 1}. ${
                        chart.song ||
                        chart.path
                    }`
            )
            .join("\n");

    if (chartNames) {

        addResult(
            "Charts detectados",
            `<pre style="white-space:pre-wrap">${
                chartNames
            }</pre>`
        );
    }
    else {

        addResult(
            "Charts detectados",
            "⚠️ Ningún JSON alcanzó la puntuación de chart."
        );
    }
}


/* ============================================================
   PROYECTO WEB
============================================================ */

function buildProject(
    extracted
) {

    const files = [];


    /*
      Los recursos extraídos.
    */

    for (
        const item
        of extracted.files
    ) {

        files.push(
        {
            name:
                item.path,

            data:
                item.data
        });
    }


    /*
      Manifest.
    */

    const manifest =
    {
        converter:
        {
            version:
                "6.0.0"
        },

        original:
        {
            name:
                selectedFile.name,

            size:
                selectedFile.size
        },

        engine:
        {
            fnf:
                analysis.engine.fnf,

            psychEngine:
                analysis.engine.psych,

            haxe:
                analysis.engine.haxe,

            haxeflixel:
                analysis.engine.flixel,

            openfl:
                analysis.engine.openfl,

            lime:
                analysis.engine.lime
        },

        charts:
            extracted.charts,

        files:
            extracted.files.map(
                item =>
                ({
                    path:
                        item.path,

                    type:
                        item.type,

                    size:
                        item.data.length,

                    offset:
                        item.offset,

                    score:
                        item.score || null
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


    /*
      README.
    */

    files.push(
    {
        name:
            "README.txt",

        data:
            new TextEncoder()
                .encode(
`MISSA V3 WEB
============

Extractor V6

El proyecto contiene recursos
recuperados directamente del EXE.

Charts detectados:
${extracted.charts.length}

El siguiente paso es seleccionar
un chart y un audio y ejecutar
el runtime FNF.

IMPORTANTE:

El código nativo compilado de
Psych Engine NO se ha traducido
automáticamente a JavaScript.

Los datos recuperados sí pueden
ser interpretados por un runtime web.
`
                )
    });


    /*
      index.html
    */

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


    /*
      game.js
    */

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


    /*
      CSS
    */

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


    return createZip(
        files
    );
}


/* ============================================================
   HTML DEL JUEGO
============================================================ */

function createGameHTML(
    charts
) {

    const chartOptions =
        charts.length
            ? charts.map(
                (chart, index) =>
                    `<option value="assets/data/chart_${
                        index + 1
                    }.json">${
                        escapeHTML(
                            chart.song ||
                            `Chart ${index + 1}`
                        )
                    }</option>`
            ).join("\n")
            : `<option>
                No se detectaron charts
               </option>`;


    return `<!DOCTYPE html>
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
Runtime FNF experimental
</p>

<label>
Chart:
</label>

<select id="chartSelect">

${chartOptions}

</select>

<label>
Audio OGG:
</label>

<input
    id="audioFile"
    type="file"
    accept=".ogg,.wav,.mp3"
>

<br>

<button id="startButton">
▶ JUGAR
</button>

<div id="info">
Esperando...
</div>

</div>

<canvas id="gameCanvas"></canvas>

<script src="game.js"></script>

</body>

</html>`;
}


/* ============================================================
   JS DEL JUEGO
============================================================ */

function createGameJS() {

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
        "chartSelect"
    );

const audioFile =
    document.getElementById(
        "audioFile"
    );

const startButton =
    document.getElementById(
        "startButton"
    );

const info =
    document.getElementById(
        "info"
    );

const LANES = 4;

const KEYS = [
    "ArrowLeft",
    "ArrowDown",
    "ArrowUp",
    "ArrowRight"
];

const NOTE_SPEED = 0.55;

let chart = null;

let notes = [];

let audio = null;

let playing = false;

let score = 0;

let combo = 0;

let misses = 0;

let health = 1;

let rating = "";

let ratingTime = 0;


/* ============================================================
 RESIZE
============================================================ */

function resize() {

    canvas.width =
        window.innerWidth;

    canvas.height =
        window.innerHeight;
}

window.addEventListener(
    "resize",
    resize
);

resize();


/* ============================================================
 LOAD CHART
============================================================ */

async function loadChart(url) {

    const response =
        await fetch(url);

    if (!response.ok) {

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
    ) {

        throw new Error(
            "El JSON no tiene estructura Psych Engine reconocible."
        );
    }

    chart =
        data.song;

    notes = [];

    for (
        const section
        of chart.notes
    ) {

        if (
            !Array.isArray(
                section.sectionNotes
            )
        ) {
            continue;
        }

        for (
            const raw
            of section.sectionNotes
        ) {

            if (
                !Array.isArray(raw) ||
                raw.length < 2
            ) {
                continue;
            }

            const time =
                Number(raw[0]);

            const rawLane =
                Number(raw[1]);

            const sustain =
                Number(
                    raw[2] || 0
                );

            /*
                El juego completo de Psych Engine
                distingue notas de jugador/rival.

                Esta primera versión usa el
                conjunto de lanes como entrada jugable.
            */

            notes.push({
                time,
                lane:
                    ((rawLane % 4) + 4) % 4,
                sustain,
                hit: false,
                missed: false
            });
        }
    }

    notes.sort(
        (a, b) =>
            a.time -
            b.time
    );

    info.textContent =
        `Chart: ${
            chart.song ||
            "Unknown"
        } | BPM: ${
            chart.bpm ||
            "?"
        } | Notas: ${
            notes.length
        }`;
}


/* ============================================================
 AUDIO
============================================================ */

function loadAudioFromFile(
    file
) {

    if (audio) {

        audio.pause();

        URL.revokeObjectURL(
            audio.src
        );
    }

    const url =
        URL.createObjectURL(
            file
        );

    audio =
        new Audio(
            url
        );

    audio.preload =
        "auto";

    return new Promise(
        (resolve, reject) => {

            audio.addEventListener(
                "canplaythrough",
                resolve,
                {
                    once: true
                }
            );

            audio.addEventListener(
                "error",
                () => reject(
                    new Error(
                        "No se pudo cargar el audio."
                    )
                ),
                {
                    once: true
                }
            );
        }
    );
}


/* ============================================================
 START
============================================================ */

startButton.addEventListener(
    "click",
    async () => {

        try {

            const chartURL =
                chartSelect.value;

            await loadChart(
                chartURL
            );

            if (
                !audioFile.files.length
            ) {

                throw new Error(
                    "Selecciona primero un OGG/WAV/MP3."
                );
            }

            await loadAudioFromFile(
                audioFile.files[0]
            );

            score = 0;
            combo = 0;
            misses = 0;
            health = 1;

            for (
                const note
                of notes
            ) {

                note.hit = false;
                note.missed = false;
            }

            menu.style.display =
                "none";

            playing = true;

            await audio.play();

        }
        catch(error) {

            console.error(error);

            alert(
                error.message
            );
        }
    }
);


/* ============================================================
 INPUT
============================================================ */

window.addEventListener(
    "keydown",
    event => {

        if (!playing) {
            return;
        }

        const lane =
            KEYS.indexOf(
                event.code
            );

        if (
            lane === -1
        ) {
            return;
        }

        event.preventDefault();

        hitLane(
            lane
        );
    }
);


function hitLane(lane) {

    if (!audio) {
        return;
    }

    const now =
        audio.currentTime *
        1000;

    let best =
        null;

    let bestDifference =
        Infinity;

    for (
        const note
        of notes
    ) {

        if (
            note.hit ||
            note.missed
        ) {
            continue;
        }

        if (
            note.lane !== lane
        ) {
            continue;
        }

        const difference =
            Math.abs(
                note.time -
                now
            );

        if (
            difference <
            bestDifference
        ) {

            bestDifference =
                difference;

            best =
                note;
        }
    }

    if (!best) {
        return;
    }

    if (
        bestDifference <= 45
    ) {

        registerHit(
            best,
            "SICK",
            350
        );

    }
    else if (
        bestDifference <= 90
    ) {

        registerHit(
            best,
            "GOOD",
            200
        );

    }
    else if (
        bestDifference <= 135
    ) {

        registerHit(
            best,
            "BAD",
            100
        );
    }
}


function registerHit(
    note,
    newRating,
    points
) {

    note.hit = true;

    combo++;

    score += points;

    health =
        Math.min(
            1,
            health + 0.02
        );

    rating =
        newRating;

    ratingTime =
        450;
}


/* ============================================================
 UPDATE
============================================================ */

function update() {

    if (!playing || !audio) {
        return;
    }

    const now =
        audio.currentTime *
        1000;

    for (
        const note
        of notes
    ) {

        if (
            note.hit ||
            note.missed
        ) {
            continue;
        }

        if (
            now -
            note.time >
            180
        ) {

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
        ratingTime >
        0
    ) {

        ratingTime -=
            16;
    }

    if (
        audio.ended
    ) {

        playing = false;
    }
}


/* ============================================================
 RENDER
============================================================ */

function draw() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.fillStyle =
        "#101010";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.fillStyle =
        "#fff";

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

    const totalWidth =
        laneWidth * LANES;

    const startX =
        (
            canvas.width -
            totalWidth
        ) / 2;

    const receptorY =
        canvas.height - 150;

    for (
        let lane = 0;
        lane < LANES;
        lane++
    ) {

        drawReceptor(
            startX +
            lane *
            laneWidth,
            receptorY,
            laneWidth,
            lane
        );
    }

    if (audio) {

        const now =
            audio.currentTime *
            1000;

        for (
            const note
            of notes
        ) {

            if (
                note.hit ||
                note.missed
            ) {
                continue;
            }

            const delta =
                note.time -
                now;

            const y =
                receptorY -
                delta *
                NOTE_SPEED;

            if (
                y < -100 ||
                y > canvas.height + 100
            ) {
                continue;
            }

            drawNote(
                startX +
                note.lane *
                laneWidth,
                y,
                laneWidth,
                note.lane
            );
        }
    }

    if (
        ratingTime > 0
    ) {

        ctx.save();

        ctx.textAlign =
            "center";

        ctx.font =
            "bold 50px Arial";

        ctx.fillStyle =
            "#fff";

        ctx.fillText(
            rating,
            canvas.width / 2,
            canvas.height / 2
        );

        ctx.restore();
    }
}


/* ============================================================
 ARROW
============================================================ */

function drawArrow(
    x,
    y,
    lane,
    size
) {

    ctx.save();

    ctx.translate(
        x,
        y
    );

    if (
        lane === 0
    ) {
        ctx.rotate(
            -Math.PI / 2
        );
    }
    else if (
        lane === 1
    ) {
        ctx.rotate(
            Math.PI
        );
    }
    else if (
        lane === 3
    ) {
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


function drawReceptor(
    x,
    y,
    width,
    lane
) {

    ctx.strokeStyle =
        "#fff";

    ctx.lineWidth =
        3;

    ctx.strokeRect(
        x + 8,
        y,
        width - 16,
        60
    );

    drawArrow(
        x +
        width / 2,
        y + 30,
        lane,
        22
    );
}


function drawNote(
    x,
    y,
    width,
    lane
) {

    ctx.fillStyle =
        "#fff";

    ctx.fillRect(
        x + 10,
        y,
        width - 20,
        45
    );

    ctx.fillStyle =
        "#111";

    drawArrow(
        x +
        width / 2,
        y + 22,
        lane,
        18
    );
}


/* ============================================================
 LOOP
============================================================ */

function loop() {

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

function createGameCSS() {

    return `
html,
body {

    margin: 0;
    padding: 0;

    width: 100%;
    height: 100%;

    overflow: hidden;

    background: #101010;

    color: white;

    font-family: Arial, sans-serif;
}

#menu {

    position: fixed;

    z-index: 10;

    top: 50%;
    left: 50%;

    transform:
        translate(
            -50%,
            -50%
        );

    padding: 30px;

    width: min(
        500px,
        90%
    );

    text-align: center;

    background: #181818;

    border:
        1px solid
        #333;

    border-radius: 16px;
}

#menu h1 {

    margin-top: 0;
}

select,
input,
button {

    margin-top: 10px;

    padding: 12px;

    border-radius: 8px;

    border: 1px solid #555;
}

button {

    cursor: pointer;

    font-weight: bold;
}

#gameCanvas {

    display: block;

    width: 100vw;
    height: 100vh;
}
`;
}


/* ============================================================
 ESCAPAR HTML
============================================================ */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


/* ============================================================
 ZIP
============================================================ */

function crc32(data) {

    let crc =
        0xFFFFFFFF;

    for (
        let i = 0;
        i < data.length;
        i++
    ) {

        crc ^=
            data[i];

        for (
            let j = 0;
            j < 8;
            j++
        ) {

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
) {

    array.push(
        value & 0xFF,
        (value >>> 8) & 0xFF
    );
}

function push32(
    array,
    value
) {

    array.push(
        value & 0xFF,
        (value >>> 8) & 0xFF,
        (value >>> 16) & 0xFF,
        (value >>> 24) & 0xFF
    );
}

function createZip(files) {

    const output = [];
    const central = [];

    let offset = 0;

    for (
        const file
        of files
    ) {

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

        push16(local, 20);
        push16(local, 0);
        push16(local, 0);
        push16(local, 0);
        push16(local, 0);

        push32(
            local,
            crc
        );

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

        push16(
            local,
            0
        );

        for (
            const byte
            of name
        ) {

            local.push(
                byte
            );
        }

        for (
            const byte
            of data
        ) {

            local.push(
                byte
            );
        }

        for (
            const byte
            of local
        ) {

            output.push(
                byte
            );
        }


        const entry = [];

        push32(
            entry,
            0x02014B50
        );

        push16(entry, 20);
        push16(entry, 20);
        push16(entry, 0);
        push16(entry, 0);
        push16(entry, 0);
        push16(entry, 0);

        push32(
            entry,
            crc
        );

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

        push16(entry, 0);
        push16(entry, 0);
        push16(entry, 0);
        push16(entry, 0);

        push32(
            entry,
            0
        );

        push32(
            entry,
            offset
        );

        for (
            const byte
            of name
        ) {

            entry.push(
                byte
            );
        }

        central.push(
            entry
        );

        offset +=
            local.length;
    }


    const centralOffset =
        output.length;

    let centralSize = 0;

    for (
        const entry
        of central
    ) {

        for (
            const byte
            of entry
        ) {

            output.push(
                byte
            );
        }

        centralSize +=
            entry.length;
    }


    push32(
        output,
        0x06054B50
    );

    push16(output, 0);
    push16(output, 0);

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

    push16(
        output,
        0
    );


    return new Uint8Array(
        output
    );
}
