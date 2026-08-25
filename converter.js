"use strict";

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const analyzeButton = document.getElementById("analyzeButton");
const convertButton = document.getElementById("convertButton");
const statusBox = document.getElementById("status");
const resultsBox = document.getElementById("results");

let selectedFile = null;
let analysis = null;


/* ============================================================
   UTILIDADES
============================================================ */

function setStatus(text) {
    statusBox.textContent = text;
}

function hasBytes(bytes, signature) {

    if (signature.length > bytes.length) {
        return false;
    }

    outer:
    for (
        let i = 0;
        i <= bytes.length - signature.length;
        i++
    ) {
        for (
            let j = 0;
            j < signature.length;
            j++
        ) {
            if (
                bytes[i + j] !==
                signature[j]
            ) {
                continue outer;
            }
        }

        return true;
    }

    return false;
}


function findText(bytes, text) {

    const target =
        new TextEncoder().encode(text);

    return hasBytes(
        bytes,
        target
    );
}


function countText(bytes, text) {

    const target =
        new TextEncoder().encode(text);

    if (!target.length) {
        return 0;
    }

    let count = 0;

    for (
        let i = 0;
        i <= bytes.length - target.length;
        i++
    ) {
        let match = true;

        for (
            let j = 0;
            j < target.length;
            j++
        ) {
            if (
                bytes[i + j] !==
                target[j]
            ) {
                match = false;
                break;
            }
        }

        if (match) {
            count++;
        }
    }

    return count;
}


function formatBytes(bytes) {

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(2)} KB`;
    }

    if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }

    return `${(
        bytes /
        1024 /
        1024 /
        1024
    ).toFixed(2)} GB`;
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
    () => {

        if (!fileInput.files.length) {
            return;
        }

        selectedFile =
            fileInput.files[0];

        showSelectedFile();
    }
);


dropZone.addEventListener(
    "dragover",
    event => {

        event.preventDefault();

        dropZone.classList.add(
            "dragging"
        );
    }
);


dropZone.addEventListener(
    "dragleave",
    () => {

        dropZone.classList.remove(
            "dragging"
        );
    }
);


dropZone.addEventListener(
    "drop",
    event => {

        event.preventDefault();

        dropZone.classList.remove(
            "dragging"
        );

        if (!event.dataTransfer.files.length) {
            return;
        }

        selectedFile =
            event.dataTransfer.files[0];

        showSelectedFile();
    }
);


function showSelectedFile() {

    setStatus(
        `Archivo seleccionado:\n\n` +
        `${selectedFile.name}\n` +
        `${formatBytes(selectedFile.size)}`
    );

    resultsBox.innerHTML = "";

    convertButton.disabled = true;
}


/* ============================================================
   ANÁLISIS
============================================================ */

analyzeButton.addEventListener(
    "click",
    async () => {

        if (!selectedFile) {

            setStatus(
                "❌ Selecciona primero un EXE."
            );

            return;
        }

        setStatus(
            "🔎 Leyendo EXE..."
        );

        try {

            const buffer =
                await selectedFile.arrayBuffer();

            const bytes =
                new Uint8Array(buffer);

            analysis =
                analyzeExe(bytes);

            displayAnalysis();

            convertButton.disabled = false;

        } catch (error) {

            console.error(error);

            setStatus(
                "❌ Error analizando el EXE."
            );
        }
    }
);


/* ============================================================
   ANALIZADOR
============================================================ */

function analyzeExe(bytes) {

    const isPE =
        bytes.length >= 2 &&
        bytes[0] === 0x4D &&
        bytes[1] === 0x5A;

    const fnf =
        findText(
            bytes,
            "Friday Night Funkin"
        ) ||
        findText(
            bytes,
            "FNF"
        ) ||
        findText(
            bytes,
            "funkin"
        );

    const psych =
        findText(
            bytes,
            "Psych Engine"
        ) ||
        findText(
            bytes,
            "PsychEngine"
        );

    const haxe =
        findText(
            bytes,
            "Haxe"
        );

    const flixel =
        findText(
            bytes,
            "HaxeFlixel"
        ) ||
        findText(
            bytes,
            "flixel"
        );

    const openfl =
        findText(
            bytes,
            "OpenFL"
        ) ||
        findText(
            bytes,
            "openfl"
        );

    const lime =
        findText(
            bytes,
            "Lime"
        ) ||
        findText(
            bytes,
            "lime"
        );

    const png =
        countText(
            bytes,
            ".png"
        );

    const ogg =
        countText(
            bytes,
            ".ogg"
        );

    const json =
        countText(
            bytes,
            ".json"
        );

    const lua =
        countText(
            bytes,
            ".lua"
        );

    let score = 0;

    if (isPE) score += 10;
    if (fnf) score += 30;
    if (psych) score += 30;
    if (haxe) score += 10;
    if (flixel) score += 10;
    if (png > 5) score += 5;
    if (ogg > 0) score += 5;

    score =
        Math.min(
            score,
            100
        );

    return {
        fileName: selectedFile.name,
        fileSize: bytes.length,

        isPE,

        fnf,
        psych,
        haxe,
        flixel,
        openfl,
        lime,

        png,
        ogg,
        json,
        lua,

        score
    };
}


/* ============================================================
   RESULTADOS
============================================================ */

function displayAnalysis() {

    const a = analysis;

    setStatus(
        "✅ Análisis terminado.\n\n" +
        `Archivo: ${a.fileName}\n` +
        `Tamaño: ${formatBytes(a.fileSize)}\n\n` +
        `Puntuación web: ${a.score}/100`
    );

    resultsBox.innerHTML = "";

    addResult(
        "PE de Windows",
        a.isPE
            ? "Detectado"
            : "No detectado",
        a.isPE
            ? "good"
            : "bad"
    );

    addResult(
        "Friday Night Funkin'",
        a.fnf
            ? "Detectado"
            : "No detectado",
        a.fnf
            ? "good"
            : "warn"
    );

    addResult(
        "Psych Engine",
        a.psych
            ? "Detectado"
            : "No detectado directamente",
        a.psych
            ? "good"
            : "warn"
    );

    addResult(
        "HaxeFlixel",
        a.flixel
            ? "Detectado"
            : "No detectado directamente",
        a.flixel
            ? "good"
            : "warn"
    );

    addResult(
        "POSIBLES PNG",
        a.png,
        "good"
    );

    addResult(
        "POSIBLES OGG",
        a.ogg,
        "good"
    );

    addResult(
        "POSIBLES JSON",
        a.json,
        "good"
    );

    addResult(
        "POSIBLES LUA",
        a.lua,
        "good"
    );
}


function addResult(
    title,
    value,
    className
) {

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
   GENERADOR DEL PROYECTO WEB
============================================================ */

convertButton.addEventListener(
    "click",
    async () => {

        if (!selectedFile || !analysis) {
            return;
        }

        setStatus(
            "🛠️ Generando proyecto web..."
        );

        try {

            const zip =
                createWebProject();

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

            setStatus(
                "✅ Proyecto web generado.\n\n" +
                "Se descargó MissaWeb.zip.\n\n" +
                "Nota: esta versión genera la estructura " +
                "HTML5 y el análisis del EXE; todavía no " +
                "reconstruye completamente el runtime de Psych Engine."
            );

        } catch (error) {

            console.error(error);

            setStatus(
                "❌ No se pudo generar el proyecto."
            );
        }
    }
);


/* ============================================================
   ZIP
============================================================ */

function createWebProject() {

    const files = {};

    files["index.html"] =
`<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Missa V3 Web</title>

    <link
        rel="stylesheet"
        href="style.css"
    >
</head>

<body>

<div id="game">

    <h1>MISSA V3 WEB</h1>

    <p>
        FNF Web Runtime
    </p>

    <button id="start">
        INICIAR
    </button>

    <div id="status">
        Esperando...
    </div>

</div>

<script src="game.js"></script>

</body>
</html>
`;

    files["style.css"] =
`html,
body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
}

body {
    display: flex;
    align-items: center;
    justify-content: center;

    background: #111;
    color: white;

    font-family: Arial, sans-serif;
}

#game {
    text-align: center;
}

button {
    padding: 12px 30px;
    font-size: 18px;
    cursor: pointer;
}
`;

    files["game.js"] =
`const start =
    document.getElementById("start");

const status =
    document.getElementById("status");

start.addEventListener(
    "click",
    () => {
        status.textContent =
            "Runtime FNF Web iniciado.";
    }
);
`;

    files["analysis.json"] =
        JSON.stringify(
            analysis,
            null,
            4
        );

    files["README.txt"] =
`MISSA WEB
=========

Proyecto generado por FNF Web Converter.

Este proyecto es una base HTML5.

El EXE original es un ejecutable de Windows
y no se incluye dentro del proyecto.

Siguiente etapa:
- interpretar los datos FNF;
- cargar charts;
- cargar personajes;
- cargar eventos;
- implementar audio;
- implementar gameplay.
`;

    return fflate.zipSync(
        Object.fromEntries(
            Object.entries(files).map(
                ([name, content]) => [
                    name,
                    new TextEncoder().encode(
                        content
                    )
                ]
            )
        )
    );
}


function downloadBlob(
    blob,
    filename
) {

    const url =
        URL.createObjectURL(blob);

    const link =
        document.createElement(
            "a"
        );

    link.href = url;
    link.download = filename;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    setTimeout(
        () => URL.revokeObjectURL(url),
        1000
    );
}
