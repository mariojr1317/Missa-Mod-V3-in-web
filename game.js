"use strict";

/*
============================================================
 MISSA WEB RUNTIME
 V5

 Runtime FNF experimental para charts compatibles
 con la estructura clásica de Psych Engine.

 Soporta:
   song.notes
   sectionNotes
   bpm
   speed

 Controles:
   ArrowLeft
   ArrowDown
   ArrowUp
   ArrowRight
============================================================
*/


const canvas =
    document.getElementById("gameCanvas");

const ctx =
    canvas.getContext("2d");


/* ============================================================
   CONFIG
============================================================ */

const LANES = 4;

const HIT_WINDOW_SICK = 45;
const HIT_WINDOW_GOOD = 90;
const HIT_WINDOW_BAD = 135;
const HIT_WINDOW_MISS = 180;

const LANE_KEYS =
[
    "ArrowLeft",
    "ArrowDown",
    "ArrowUp",
    "ArrowRight"
];


/* ============================================================
   ESTADO
============================================================ */

let chart = null;

let notes = [];

let songAudio = null;

let songStarted = false;

let songStartTime = 0;

let score = 0;

let combo = 0;

let misses = 0;

let health = 1;

let currentTime = 0;

let lastFrame = 0;

let noteSpeed = 0.55;


/* ============================================================
   ESCALA
============================================================ */

function resize()
{
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
   NORMALIZAR CHART
============================================================ */

function parsePsychChart(data)
{
    if (
        !data ||
        !data.song
    )
    {
        throw new Error(
            "No parece un chart de Psych Engine."
        );
    }

    const song =
        data.song;

    const bpm =
        Number(
            song.bpm ||
            120
        );

    const speed =
        Number(
            song.speed ||
            1
        );

    const result =
    [];

    const sections =
        Array.isArray(
            song.notes
        )
            ? song.notes
            : [];


    /*
      Psych Engine clásico:

      sectionNotes:

      [
          time,
          lane,
          sustain
      ]
    */

    for (
        const section
        of sections
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
            const note
            of section.sectionNotes
        )
        {
            if (
                !Array.isArray(note) ||
                note.length < 2
            )
            {
                continue;
            }

            const time =
                Number(
                    note[0]
                );

            const rawLane =
                Number(
                    note[1]
                );

            const sustain =
                Number(
                    note[2] ||
                    0
                );


            /*
              Psych Engine normalmente usa
              lanes 0-3 para jugador y
              4-7 para rival.

              Para nuestra primera versión
              solamente cargamos las notas
              del jugador.
            */

            const lane =
                rawLane % 4;


            result.push(
            {
                time,
                lane,
                sustain,
                hit: false,
                missed: false
            });
        }
    }

    result.sort(
        (a, b) =>
            a.time - b.time
    );


    return {
        bpm,
        speed,
        notes: result
    };
}


/* ============================================================
   CARGAR CHART
============================================================ */

async function loadChart(url)
{
    const response =
        await fetch(url);

    if (!response.ok)
    {
        throw new Error(
            `No se pudo cargar ${url}`
        );
    }

    const data =
        await response.json();

    chart =
        parsePsychChart(
            data
        );

    notes =
        chart.notes;

    noteSpeed =
        0.55 *
        chart.speed;
}


/* ============================================================
   AUDIO
============================================================ */

async function loadSong(url)
{
    songAudio =
        new Audio();

    songAudio.preload =
        "auto";

    songAudio.src =
        url;

    await new Promise(
        (resolve, reject) =>
        {
            songAudio.addEventListener(
                "canplaythrough",
                resolve,
                {
                    once: true
                }
            );

            songAudio.addEventListener(
                "error",
                () =>
                {
                    reject(
                        new Error(
                            "No se pudo cargar el audio."
                        )
                    );
                },
                {
                    once: true
                }
            );
        }
    );
}


/* ============================================================
   GAME START
============================================================ */

async function startGame()
{
    score = 0;

    combo = 0;

    misses = 0;

    health = 1;


    /*
      Estos nombres son provisionales.

      La V6 deberá obtenerlos automáticamente
      del manifest generado por el extractor.
    */

    await loadChart(
        "charts/song.json"
    );

    await loadSong(
        "audio/inst.ogg"
    );


    songStarted =
        true;

    songStartTime =
        performance.now();

    songAudio.currentTime =
        0;

    await songAudio.play();
}


/* ============================================================
   TIEMPO
============================================================ */

function getSongTime()
{
    if (
        !songAudio
    )
    {
        return 0;
    }

    /*
      El audio es nuestra referencia principal.
    */

    return (
        songAudio.currentTime *
        1000
    );
}


/* ============================================================
   NOTAS
============================================================ */

function updateNotes()
{
    currentTime =
        getSongTime();


    for (
        const note of notes
    )
    {
        if (
            note.hit ||
            note.missed
        )
        {
            continue;
        }


        const difference =
            currentTime -
            note.time;


        if (
            difference >
            HIT_WINDOW_MISS
        )
        {
            note.missed =
                true;

            combo = 0;

            misses++;

            health -= 0.05;

            if (
                health < 0
            )
            {
                health = 0;
            }
        }
    }
}


/* ============================================================
   INPUT
============================================================ */

window.addEventListener(
    "keydown",
    event =>
    {
        if (
            !songStarted
        )
        {
            return;
        }

        const lane =
            LANE_KEYS.indexOf(
                event.code
            );

        if (
            lane === -1
        )
        {
            return;
        }

        event.preventDefault();

        hitLane(
            lane
        );
    }
);


function hitLane(lane)
{
    currentTime =
        getSongTime();


    let candidate =
        null;

    let bestDifference =
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


        const difference =
            Math.abs(
                note.time -
                currentTime
            );


        if (
            difference <
            bestDifference
        )
        {
            bestDifference =
                difference;

            candidate =
                note;
        }
    }


    if (
        !candidate
    )
    {
        return;
    }


    if (
        bestDifference <=
        HIT_WINDOW_SICK
    )
    {
        registerHit(
            candidate,
            "SICK",
            350
        );

        return;
    }


    if (
        bestDifference <=
        HIT_WINDOW_GOOD
    )
    {
        registerHit(
            candidate,
            "GOOD",
            200
        );

        return;
    }


    if (
        bestDifference <=
        HIT_WINDOW_BAD
    )
    {
        registerHit(
            candidate,
            "BAD",
            100
        );

        return;
    }
}


/* ============================================================
   HIT
============================================================ */

function registerHit(
    note,
    rating,
    points
)
{
    note.hit =
        true;

    combo++;

    score +=
        points;

    health +=
        0.02;

    if (
        health >
        1
    )
    {
        health = 1;
    }


    showRating(
        rating
    );
}


/* ============================================================
   RATING
============================================================ */

let ratingText =
    "";

let ratingTimer =
    0;


function showRating(
    text
)
{
    ratingText =
        text;

    ratingTimer =
        500;
}


/* ============================================================
   RENDER
============================================================ */

function draw()
{
    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
      Fondo.
    */

    ctx.fillStyle =
        "#111";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    /*
      HUD.
    */

    ctx.fillStyle =
        "#fff";

    ctx.font =
        "bold 22px Arial";

    ctx.fillText(
        `Score: ${score}`,
        20,
        35
    );

    ctx.fillText(
        `Combo: ${combo}`,
        20,
        65
    );

    ctx.fillText(
        `Misses: ${misses}`,
        20,
        95
    );


    /*
      Health.
    */

    ctx.fillStyle =
        "#333";

    ctx.fillRect(
        20,
        115,
        250,
        18
    );

    ctx.fillStyle =
        "#4caf50";

    ctx.fillRect(
        20,
        115,
        250 * health,
        18
    );


    /*
      Receptores.
    */

    const laneWidth =
        Math.min(
            100,
            canvas.width / 6
        );

    const totalWidth =
        laneWidth *
        LANES;

    const startX =
        (
            canvas.width -
            totalWidth
        ) / 2;

    const receptorY =
        canvas.height -
        150;


    for (
        let lane = 0;
        lane < LANES;
        lane++
    )
    {
        drawReceptor(
            startX +
            lane *
            laneWidth,
            receptorY,
            laneWidth,
            lane
        );
    }


    /*
      Notas.
    */

    if (
        songStarted
    )
    {
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
                currentTime;


            const y =
                receptorY -
                delta *
                noteSpeed;


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


    /*
      Rating.
    */

    if (
        ratingTimer >
        0
    )
    {
        ctx.save();

        ctx.textAlign =
            "center";

        ctx.font =
            "bold 50px Arial";

        ctx.fillStyle =
            "#fff";

        ctx.fillText(
            ratingText,
            canvas.width / 2,
            canvas.height / 2
        );

        ctx.restore();
    }
}


/* ============================================================
   RECEPTORES
============================================================ */

function drawReceptor(
    x,
    y,
    width,
    lane
)
{
    ctx.strokeStyle =
        "white";

    ctx.lineWidth =
        4;

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
        25
    );
}


/* ============================================================
   NOTAS
============================================================ */

function drawNote(
    x,
    y,
    width,
    lane
)
{
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
        20
    );
}


/* ============================================================
   FLECHAS
============================================================ */

function drawArrow(
    x,
    y,
    direction,
    size
)
{
    ctx.save();

    ctx.translate(
        x,
        y
    );

    switch(direction)
    {
        case 0:

            ctx.rotate(
                -Math.PI / 2
            );

            break;

        case 1:

            ctx.rotate(
                Math.PI
            );

            break;

        case 2:

            break;

        case 3:

            ctx.rotate(
                Math.PI / 2
            );

            break;
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


/* ============================================================
   GAME LOOP
============================================================ */

function gameLoop(
    timestamp
)
{
    const delta =
        timestamp -
        lastFrame;

    lastFrame =
        timestamp;


    if (
        ratingTimer >
        0
    )
    {
        ratingTimer -=
            delta;
    }


    if (
        songStarted
    )
    {
        updateNotes();
    }


    draw();


    requestAnimationFrame(
        gameLoop
    );
}


requestAnimationFrame(
    gameLoop
);


/* ============================================================
   EXPORT
============================================================ */

window.MissaWeb =
{
    loadChart,
    loadSong,
    startGame
};
