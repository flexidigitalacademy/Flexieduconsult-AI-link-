require("dotenv").config();

const express = require("express");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json({
    limit: "20mb"
}));

app.use(express.urlencoded({
    extended: true,
    limit: "20mb"
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

                second: "2-digit",

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

function getKey() {

    if (!API_KEYS.length) {

        throw new Error(
            "❌ No Gemini API Keys Found"
        );
    }

    const key = API_KEYS[keyIndex];

    keyIndex =
        (keyIndex + 1) % API_KEYS.length;

    return key;
}

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
                "❌ Gemini Error:",
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
- Expand lighting
- Expand environment
- Expand realism
- Add camera details
- Add cinematic depth
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
// 🎨 IMAGE GENERATION CORE
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

    const filename =
        `image-${Date.now()}.png`;

    const filepath =
        path.join(__dirname, filename);

    fs.writeFileSync(
        filepath,
        response.data
    );

    return {
        filepath,
        filename,
        enhancedPrompt:
            improvedPrompt
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
- Beginner friendly
- Educational
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

    const filename =
        `math-${Date.now()}.png`;

    const filepath =
        path.join(__dirname, filename);

    await sharp(
        Buffer.from(svg)
    )
        .png()
        .toFile(filepath);

    return {
        filepath,
        filename
    };
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
// 🧠 GENERAL AI CHAT
// =====================================================

async function normalAI(prompt) {

    return await callGemini([

        {
            parts: [
                {
                    text:
`You are JARVIS AI.

Be intelligent,
educational,
helpful,
friendly,
and conversational.

NO LATEX.

Use Unicode symbols:
√ π ± ² ³

USER:
${prompt}`
                }
            ]
        }
    ]);
}

// =====================================================
// 🏠 ROOT ROUTE
// =====================================================

app.get("/", (req, res) => {

    res.send(`

        <h1>🤖 JARVIS AI CORE</h1>

        <p>STATUS: ONLINE</p>

        <p>TIME: ${TimeCore.now()}</p>

        <hr>

        <h3>AVAILABLE ROUTES</h3>

        <ul>
            <li>GET /</li>
            <li>GET /test</li>
            <li>GET /debug-ai</li>
            <li>POST /ai</li>
            <li>POST /pdf</li>
        </ul>

    `);
});

// =====================================================
// 🧪 TEST ROUTE
// =====================================================

app.get("/test", (req, res) => {

    res.json({

        success: true,

        message:
            "✅ JARVIS server working",

        time:
            TimeCore.now()
    });
});

// =====================================================
// 🧪 DEBUG ROUTE
// =====================================================

app.get("/debug-ai", (req, res) => {

    res.json({

        success: true,

        status:
            "✅ AI ROUTE ONLINE",

        gemini_keys_loaded:
            API_KEYS.length,

        server_time:
            TimeCore.now()
    });
});

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
                    "❌ No PDF provided"
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

        const extractedText =
            pdfData.text || "";

        const result =
            await callGemini([

                {
                    parts: [
                        {
                            text:
`Analyze this PDF carefully.

PDF CONTENT:
${extractedText}

USER REQUEST:
${prompt || "Summarize this PDF"}`
                        }
                    ]
                }
            ]);

        return res.json({

            success: true,

            type: "pdf",

            result,

            time:
                TimeCore.now()
        });

    } catch (err) {

        console.log(
            "❌ PDF Error:",
            err.response?.data ||
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

        if (!prompt) {

            return res.status(400).json({

                success: false,

                error:
                    "❌ Prompt is required"
            });
        }

        console.log(
            "📥 Incoming AI Request:",
            prompt
        );

        // =================================================
        // EXAM MODE
        // =================================================

        if (mode === "exam") {

            const result =
                await examSolver(prompt);

            return res.json({

                success: true,

                type: "exam",

                result,

                time:
                    TimeCore.now()
            });
        }

        // =================================================
        // IMAGE MODE
        // =================================================

        if (mode === "image") {

            const image =
                await generateImage(prompt);

            return res.json({

                success: true,

                type: "image",

                image:
                    image.filepath,

                enhanced_prompt:
                    image.enhancedPrompt,

                time:
                    TimeCore.now()
            });
        }

        // =================================================
        // MATH MODE
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

                result:
                    solution,

                image:
                    image.filepath,

                time:
                    TimeCore.now()
            });
        }

        // =================================================
        // NORMAL AI MODE
        // =================================================

        const result =
            await normalAI(prompt);

        return res.json({

            success: true,

            type: "text",

            result,

            time:
                TimeCore.now()
        });

    } catch (err) {

        console.log(
            "❌ AI Route Error:",
            err.response?.data ||
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
// ⏰ DAILY WAT QUIZ SCHEDULER
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
                    "⏰ DAILY QUIZ GENERATION RUNNING..."
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
            "❌ Scheduler Error:",
            err.message
        );
    }

}, 60000);

// =====================================================
// 🚀 START SERVER
// =====================================================

app.listen(PORT, () => {

    console.log(
`🚀 JARVIS AI CORE RUNNING ON PORT ${PORT}`
    );

    console.log(
`🌍 LOCAL:
http://localhost:${PORT}`
    );
});
