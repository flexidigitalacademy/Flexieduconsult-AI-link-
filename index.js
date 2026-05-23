require("dotenv").config();

const express = require("express");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const sharp = require("sharp");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json({
    limit: "15mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "15mb"
}));

// =====================================================
// 🇳🇬 WAT TIME CORE
// =====================================================

const TimeCore = {

    now() {

        return new Intl.DateTimeFormat(
            "en-GB",
            {
                timeZone: "Africa/Lagos",

                day: "2-digit",
                month: "long",
                year: "numeric",

                hour: "2-digit",
                minute: "2-digit",

                hour12: true
            }
        ).format(new Date());
    },

    clock() {

        const hour =
            new Intl.DateTimeFormat(
                "en-GB",
                {
                    timeZone: "Africa/Lagos",

                    hour: "2-digit",

                    hour12: false
                }
            ).format(new Date());

        const minute =
            new Intl.DateTimeFormat(
                "en-GB",
                {
                    timeZone: "Africa/Lagos",

                    minute: "2-digit"
                }
            ).format(new Date());

        return {
            hour,
            minute
        };
    }
};

// =====================================================
// 🧠 GEMINI CORE
// =====================================================

const API_KEYS = [

    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5

].filter(Boolean);

let keyIndex = 0;

const getKey = () => {

    if (!API_KEYS.length) {

        throw new Error(
            "No Gemini API Keys Found"
        );
    }

    const key = API_KEYS[keyIndex];

    keyIndex =
        (keyIndex + 1) % API_KEYS.length;

    return key;
};

async function callGemini(
    contents,
    isJson = false
) {

    let lastError;

    for (
        let i = 0;
        i < API_KEYS.length;
        i++
    ) {

        try {

            const response =
                await axios.post(

                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getKey()}`,

                    {
                        contents,

                        ...(isJson && {

                            generationConfig: {

                                responseMimeType:
                                    "application/json"
                            }
                        })
                    },

                    {
                        timeout: 60000,

                        headers: {
                            "Content-Type":
                                "application/json"
                        }
                    }
                );

            const text =
                response.data
                    ?.candidates?.[0]
                    ?.content?.parts?.[0]
                    ?.text;

            if (
                text &&
                typeof text === "string"
            ) {

                return text.trim();
            }

        } catch (err) {

            lastError = err;

            console.log(
                "Gemini Error:",
                err.response?.data ||
                err.message
            );
        }
    }

    throw new Error(

        lastError?.response?.data
            ?.error?.message ||

        lastError?.message ||

        "Gemini request failed"
    );
}

// =====================================================
// 🧠 AUTO PROMPT ENHANCER
// =====================================================

async function enhancePrompt(prompt) {

    const system = `
You are a professional AI image prompt engineer.

Convert user prompts into ultra-detailed cinematic prompts.

RULES:
- Expand lighting, environment, camera details
- Make it realistic and cinematic
- Add depth and realism
- Keep original meaning
- Output ONLY improved prompt

USER:
${prompt}
`;

    const enhanced =
        await callGemini([
            {
                parts: [
                    {
                        text: system
                    }
                ]
            }
        ]);

    return enhanced || prompt;
}

// =====================================================
// 🎨 IMAGE CORE (FLUX)
// =====================================================

async function generateImage(prompt) {

    const improvedPrompt =
        await enhancePrompt(prompt);

    const response =
        await axios.post(

            "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",

            {
                inputs: improvedPrompt
            },

            {
                headers: {
                    Authorization:
`Bearer ${process.env.HF_TOKEN}`
                },

                responseType:
                    "arraybuffer",

                timeout: 120000
            }
        );

    const file =
        `./image-${Date.now()}.png`;

    fs.writeFileSync(
        file,
        response.data
    );

    return {
        file,
        prompt: improvedPrompt
    };
}

// =====================================================
// 🧮 MATH DETECTOR
// =====================================================

function isMath(text = "") {

    return /solve|calculate|equation|prove|x|y|=|\^|√|integrate|differentiate|fraction|matrix|simplify|math/i
        .test(text.toLowerCase());
}

// =====================================================
// 🧮 MATH SOLVER
// =====================================================

async function solveMath(question) {

    const prompt = `
You are a WAEC/JAMB mathematics expert.

RULES:
- Solve step-by-step
- Be beginner friendly
- Explain clearly
- NO LATEX
- Use Unicode symbols:
√ π ± ² ³

QUESTION:
${question}
`;

    return await callGemini([
        {
            parts: [
                {
                    text: prompt
                }
            ]
        }
    ]);
}

// =====================================================
// 🖼️ MATH IMAGE GENERATOR
// =====================================================

async function mathToImage(text) {

    const svg = `
    <svg width="1200" height="800"
        xmlns="http://www.w3.org/2000/svg">

        <style>
            .title {
                fill: white;
                font-size: 38px;
                font-family: Arial;
                font-weight: bold;
            }

            .content {
                fill: white;
                font-size: 26px;
                font-family: Arial;
                white-space: pre-wrap;
            }
        </style>

        <rect
            width="100%"
            height="100%"
            fill="#111827"
        />

        <text
            x="50"
            y="70"
            class="title">
            JARVIS Math Solution
        </text>

        <foreignObject
            x="50"
            y="110"
            width="1100"
            height="650">

            <div xmlns="http://www.w3.org/1999/xhtml"
                style="
                    color:white;
                    font-size:26px;
                    line-height:1.7;
                    font-family:Arial;
                    white-space:pre-wrap;
                ">

                ${text}

            </div>

        </foreignObject>

    </svg>
    `;

    const file =
        `./math-${Date.now()}.png`;

    await sharp(
        Buffer.from(svg)
    )
        .png()
        .toFile(file);

    return file;
}

// =====================================================
// 📚 EXAM SOLVER
// =====================================================

async function examSolver(question) {

    const prompt = `
You are a WAEC/JAMB/Post-UTME examiner.

RULES:
- Solve step-by-step
- Educational explanation
- Beginner friendly
- No skipped steps
- NO LATEX
- Use Unicode symbols only

QUESTION:
${question}
`;

    return await callGemini([
        {
            parts: [
                {
                    text: prompt
                }
            ]
        }
    ]);
}

// =====================================================
// 📄 PDF ANALYZER
// =====================================================

app.post("/pdf", async (req, res) => {

    try {

        const {
            fileBase64,
            prompt
        } = req.body;

        if (!fileBase64) {

            return res.status(400).json({

                success: false,

                error:
                    "No PDF provided"
            });
        }

        const buffer =
            Buffer.from(

                fileBase64.replace(
                    /^data:application\/pdf;base64,/,
                    ""
                ),

                "base64"
            );

        const pdfData =
            await pdfParse(buffer);

        const text =
            pdfData.text || "";

        const result =
            await callGemini([

                {
                    parts: [
                        {
                            text:
`Analyze this PDF document:

${text}

User Request:
${prompt || "Summarize"}`
                        }
                    ]
                }
            ]);

        return res.json({

            success: true,

            result,

            time:
                TimeCore.now()
        });

    } catch (err) {

        console.log(
            "PDF Error:",
            err.message
        );

        return res.status(500).json({

            success: false,

            error:
                err.message
        });
    }
});

// =====================================================
// ⚙️ MAIN AI ROUTER
// =====================================================

app.post("/ai", async (req, res) => {

    try {

        const {
            prompt,
            mode
        } = req.body;

        // =================================================
        // EXAM MODE
        // =================================================

        if (mode === "exam") {

            const result =
                await examSolver(prompt);

            return res.json({

                success: true,

                type: "exam",

                text: result,

                time:
                    TimeCore.now()
            });
        }

        // =================================================
        // IMAGE MODE
        // =================================================

        if (mode === "image") {

            const img =
                await generateImage(prompt);

            return res.json({

                success: true,

                type: "image",

                image:
                    img.file,

                enhanced_prompt:
                    img.prompt,

                time:
                    TimeCore.now()
            });
        }

        // =================================================
        // AUTO MATH MODE
        // =================================================

        if (isMath(prompt)) {

            const solution =
                await solveMath(prompt);

            const image =
                await mathToImage(solution);

            return res.json({

                success: true,

                type:
                    "math-combo",

                text:
                    solution,

                image,

                time:
                    TimeCore.now()
            });
        }

        // =================================================
        // NORMAL AI MODE
        // =================================================

        const result =
            await callGemini([

                {
                    parts: [
                        {
                            text:
`You are JARVIS AI.

Be intelligent, educational,
helpful and conversational.

NO LATEX.

Use Unicode symbols:
√ π ± ² ³

User:
${prompt}`
                        }
                    ]
                }
            ]);

        return res.json({

            success: true,

            type: "text",

            text: result,

            time:
                TimeCore.now()
        });

    } catch (err) {

        console.log(
            "AI Route Error:",
            err.message
        );

        return res.status(500).json({

            success: false,

            error:
                err.message
        });
    }
});

// =====================================================
// 🏠 SYSTEM ROUTES
// =====================================================

app.get("/", (req, res) => {

    res.send(`

        <h1>
            🤖 JARVIS AI CORE
        </h1>

        <p>
            STATUS: ONLINE
        </p>

        <p>
            WAT TIME:
            ${TimeCore.now()}
        </p>

    `);
});

app.get("/test", (req, res) => {

    res.json({
        ok: true
    });
});

// =====================================================
// ⏰ WAT SCHEDULER
// =====================================================

let quizLock = false;

setInterval(async () => {

    try {

        const {
            hour,
            minute
        } = TimeCore.clock();

        if (
            hour === "19" &&
            minute === "00"
        ) {

            if (!quizLock) {

                quizLock = true;

                console.log(
                    "⏰ WAT QUIZ RUNNING..."
                );

                await callGemini([
                    {
                        parts: [
                            {
                                text:
"Generate a daily WAEC/Post-UTME quiz"
                            }
                        ]
                    }
                ]);
            }

        } else {

            quizLock = false;
        }

    } catch (err) {

        console.log(
            "Scheduler Error:",
            err.message
        );
    }

}, 60000);

// =====================================================
// 🚀 START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log(
`🚀 JARVIS CORE RUNNING ON PORT ${PORT}`
    );
});
