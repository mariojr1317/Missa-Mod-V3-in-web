"use strict";

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const status = document.getElementById("status");
const analyzeButton = document.getElementById("analyzeButton");

status.textContent =
    "✅ Converter cargado correctamente.\n\n" +
    "Haz clic en la caja para seleccionar un EXE.";

dropZone.addEventListener("click", () => {
    fileInput.click();
});

fileInput.addEventListener("change", () => {

    if (!fileInput.files.length) {
        return;
    }

    const file = fileInput.files[0];

    status.textContent =
        "✅ ARCHIVO CARGADO\n\n" +
        "Nombre: " + file.name + "\n" +
        "Tamaño: " +
        (file.size / 1024 / 1024).toFixed(2) +
        " MB";

    analyzeButton.disabled = false;
});

dropZone.addEventListener("dragover", event => {
    event.preventDefault();
});

dropZone.addEventListener("drop", event => {

    event.preventDefault();

    if (!event.dataTransfer.files.length) {
        return;
    }

    const file =
        event.dataTransfer.files[0];

    status.textContent =
        "✅ ARCHIVO ARRASTRADO\n\n" +
        "Nombre: " + file.name + "\n" +
        "Tamaño: " +
        (file.size / 1024 / 1024).toFixed(2) +
        " MB";
});
