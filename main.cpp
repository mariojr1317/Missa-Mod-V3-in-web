#include <algorithm>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

namespace fs = std::filesystem;

struct Resource
{
    std::string type;
    std::string extension;
    std::size_t offset;
    std::size_t size;
};

static std::vector<unsigned char> readFile(
    const std::string& path
)
{
    std::ifstream file(
        path,
        std::ios::binary
    );

    if (!file)
        return {};

    file.seekg(0, std::ios::end);

    const std::streamsize size =
        file.tellg();

    file.seekg(0, std::ios::beg);

    if (size <= 0)
        return {};

    std::vector<unsigned char> data(
        static_cast<std::size_t>(size)
    );

    file.read(
        reinterpret_cast<char*>(data.data()),
        size
    );

    return data;
}

static bool match(
    const std::vector<unsigned char>& data,
    std::size_t offset,
    const std::vector<unsigned char>& signature
)
{
    if (
        offset + signature.size()
        > data.size()
    )
    {
        return false;
    }

    for (
        std::size_t i = 0;
        i < signature.size();
        ++i
    )
    {
        if (
            data[offset + i]
            != signature[i]
        )
        {
            return false;
        }
    }

    return true;
}

static std::size_t findNextSignature(
    const std::vector<unsigned char>& data,
    std::size_t start,
    const std::vector<unsigned char>& signature
)
{
    if (signature.empty())
        return data.size();

    for (
        std::size_t i = start;
        i + signature.size()
            <= data.size();
        ++i
    )
    {
        if (
            match(
                data,
                i,
                signature
            )
        )
        {
            return i;
        }
    }

    return data.size();
}

static void writeBlock(
    const fs::path& path,
    const std::vector<unsigned char>& data,
    std::size_t offset,
    std::size_t size
)
{
    std::ofstream file(
        path,
        std::ios::binary
    );

    if (!file)
        return;

    file.write(
        reinterpret_cast<const char*>(
            data.data() + offset
        ),
        static_cast<std::streamsize>(size)
    );
}

static bool containsText(
    const std::vector<unsigned char>& data,
    const std::string& text
)
{
    if (text.empty())
        return false;

    for (
        std::size_t i = 0;
        i + text.size()
            <= data.size();
        ++i
    )
    {
        bool ok = true;

        for (
            std::size_t j = 0;
            j < text.size();
            ++j
        )
        {
            if (
                data[i + j]
                != static_cast<unsigned char>(
                    text[j]
                )
            )
            {
                ok = false;
                break;
            }
        }

        if (ok)
            return true;
    }

    return false;
}

static std::string architecture(
    const std::vector<unsigned char>& data
)
{
    if (data.size() < 0x40)
        return "Unknown";

    if (
        data[0] != 'M' ||
        data[1] != 'Z'
    )
    {
        return "Not PE";
    }

    const std::uint32_t peOffset =
        static_cast<std::uint32_t>(data[0x3C]) |
        (static_cast<std::uint32_t>(data[0x3D]) << 8) |
        (static_cast<std::uint32_t>(data[0x3E]) << 16) |
        (static_cast<std::uint32_t>(data[0x3F]) << 24);

    if (
        peOffset + 6
        > data.size()
    )
    {
        return "Unknown";
    }

    if (
        data[peOffset] != 'P' ||
        data[peOffset + 1] != 'E' ||
        data[peOffset + 2] != 0 ||
        data[peOffset + 3] != 0
    )
    {
        return "Invalid PE";
    }

    const std::uint16_t machine =
        static_cast<std::uint16_t>(
            data[peOffset + 4]
        ) |
        (
            static_cast<std::uint16_t>(
                data[peOffset + 5]
            ) << 8
        );

    switch (machine)
    {
        case 0x014C:
            return "x86";

        case 0x8664:
            return "x64";

        case 0xAA64:
            return "ARM64";

        case 0x01C4:
            return "ARM";

        default:
            return "Unknown";
    }
}

static void createDirectories(
    const fs::path& root
)
{
    fs::create_directories(
        root / "assets" / "images"
    );

    fs::create_directories(
        root / "assets" / "audio"
    );

    fs::create_directories(
        root / "assets" / "data"
    );

    fs::create_directories(
        root / "assets" / "archives"
    );
}

static void createWebFiles(
    const fs::path& root
)
{
    {
        std::ofstream html(
            root / "index.html"
        );

        html <<
R"HTML(<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0"
    >

    <title>Missa Web</title>

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
)HTML";
    }

    {
        std::ofstream css(
            root / "style.css"
        );

        css <<
R"CSS(
html,
body
{
    margin: 0;
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

    font-family: Arial, sans-serif;
}

#game
{
    text-align: center;

    width: 800px;
    max-width: 90%;
}

button
{
    padding: 12px 30px;

    font-size: 18px;

    cursor: pointer;
}

#status
{
    margin-top: 20px;

    font-family: monospace;
}
)CSS";
    }

    {
        std::ofstream js(
            root / "game.js"
        );

        js <<
R"JS(
const start =
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
)JS";
    }
}

int main(
    int argc,
    char* argv[]
)
{
    std::cout
        << "\n"
        << "====================================\n"
        << "       FNF WEB CONVERTER V3\n"
        << "====================================\n\n";

    if (argc < 2)
    {
        std::cout
            << "Uso:\n\n"
            << "FNFWebConverter.exe MissaMod.exe\n\n";

        return 1;
    }

    const std::string input =
        argv[1];

    std::cout
        << "[*] Leyendo: "
        << input
        << "\n";

    const auto data =
        readFile(input);

    if (data.empty())
    {
        std::cerr
            << "[ERROR] No se pudo leer el archivo.\n";

        return 1;
    }

    std::cout
        << "[+] "
        << data.size()
        << " bytes cargados.\n";

    const bool pe =
        data.size() >= 2 &&
        data[0] == 'M' &&
        data[1] == 'Z';

    std::cout
        << "[*] PE: "
        << (pe ? "SI" : "NO")
        << "\n";

    std::cout
        << "[*] Arquitectura: "
        << architecture(data)
        << "\n\n";

    std::cout
        << "Motor:\n";

    const bool fnf =
        containsText(
            data,
            "Friday Night Funkin"
        ) ||
        containsText(
            data,
            "funkin"
        );

    const bool psych =
        containsText(
            data,
            "Psych Engine"
        ) ||
        containsText(
            data,
            "PsychEngine"
        );

    const bool haxe =
        containsText(
            data,
            "Haxe"
        );

    const bool flixel =
        containsText(
            data,
            "HaxeFlixel"
        ) ||
        containsText(
            data,
            "flixel"
        );

    std::cout
        << "  FNF: "
        << (fnf ? "SI" : "NO")
        << "\n";

    std::cout
        << "  Psych Engine: "
        << (psych ? "SI" : "NO")
        << "\n";

    std::cout
        << "  Haxe: "
        << (haxe ? "SI" : "NO")
        << "\n";

    std::cout
        << "  HaxeFlixel: "
        << (flixel ? "SI" : "NO")
        << "\n\n";

    fs::path output =
        fs::path(input).stem();

    output += "_Web";

    createDirectories(output);
    createWebFiles(output);

    std::cout
        << "[+] Proyecto web creado en:\n"
        << "    "
        << output
        << "\n\n";

    // ========================================================
    // PNG
    // ========================================================

    const std::vector<unsigned char> pngSignature =
    {
        0x89,
        0x50,
        0x4E,
        0x47,
        0x0D,
        0x0A,
        0x1A,
        0x0A
    };

    // ========================================================
    // OGG
    // ========================================================

    const std::vector<unsigned char> oggSignature =
    {
        'O',
        'g',
        'g',
        'S'
    };

    // ========================================================
    // ZIP
    // ========================================================

    const std::vector<unsigned char> zipSignature =
    {
        0x50,
        0x4B,
        0x03,
        0x04
    };

    std::size_t imageCount = 0;
    std::size_t audioCount = 0;
    std::size_t archiveCount = 0;

    // ========================================================
    // PNG EXTRACTION
    // ========================================================

    std::cout
        << "[*] Buscando PNG...\n";

    std::size_t position = 0;

    while (true)
    {
        position =
            findNextSignature(
                data,
                position,
                pngSignature
            );

        if (
            position >= data.size()
        )
        {
            break;
        }

        ++imageCount;

        // PNG contiene un chunk IEND.
        // Buscamos su firma:
        //
        // 49 45 4E 44
        //

        const std::vector<unsigned char> iend =
        {
            'I',
            'E',
            'N',
            'D'
        };

        const std::size_t end =
            findNextSignature(
                data,
                position + 8,
                iend
            );

        std::size_t size;

        if (
            end < data.size()
        )
        {
            size =
                (end + 8) - position;
        }
        else
        {
            size =
                std::min<std::size_t>(
                    1024 * 1024,
                    data.size() - position
                );
        }

        const fs::path filename =
            output
            / "assets"
            / "images"
            / (
                "image_"
                + std::to_string(imageCount)
                + ".png"
            );

        writeBlock(
            filename,
            data,
            position,
            size
        );

        position +=
            std::max<std::size_t>(
                size,
                1
            );
    }

    // ========================================================
    // OGG EXTRACTION
    // ========================================================

    std::cout
        << "[*] Buscando OGG...\n";

    position = 0;

    while (true)
    {
        position =
            findNextSignature(
                data,
                position,
                oggSignature
            );

        if (
            position >= data.size()
        )
        {
            break;
        }

        ++audioCount;

        // OGG puede contener múltiples páginas.
        // En esta versión guardamos un bloque razonable.
        const std::size_t size =
            std::min<std::size_t>(
                32 * 1024 * 1024,
                data.size() - position
            );

        const fs::path filename =
            output
            / "assets"
            / "audio"
            / (
                "audio_"
                + std::to_string(audioCount)
                + ".ogg"
            );

        writeBlock(
            filename,
            data,
            position,
            size
        );

        position +=
            std::max<std::size_t>(
                size,
                1
            );
    }

    // ========================================================
    // ZIP EXTRACTION
    // ========================================================

    std::cout
        << "[*] Buscando archivos ZIP...\n";

    position = 0;

    while (true)
    {
        position =
            findNextSignature(
                data,
                position,
                zipSignature
            );

        if (
            position >= data.size()
        )
        {
            break;
        }

        ++archiveCount;

        const std::size_t size =
            std::min<std::size_t>(
                64 * 1024 * 1024,
                data.size() - position
            );

        const fs::path filename =
            output
            / "assets"
            / "archives"
            / (
                "archive_"
                + std::to_string(archiveCount)
                + ".zip"
            );

        writeBlock(
            filename,
            data,
            position,
            size
        );

        position +=
            std::max<std::size_t>(
                size,
                1
            );
    }

    std::cout
        << "\n====================================\n"
        << " RESULTADO\n"
        << "====================================\n\n";

    std::cout
        << "PNG encontrados: "
        << imageCount
        << "\n";

    std::cout
        << "OGG encontrados: "
        << audioCount
        << "\n";

    std::cout
        << "ZIP encontrados: "
        << archiveCount
        << "\n\n";

    std::cout
        << "Salida:\n"
        << output
        << "\n\n";

    std::cout
        << "NOTA:\n"
        << "Los OGG/ZIP incrustados pueden requerir\n"
        << "un parser de formato para obtener su\n"
        << "tamaño real. La V4 mejorará esto.\n\n";

    return 0;
}
