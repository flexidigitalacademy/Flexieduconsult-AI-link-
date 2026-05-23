require("dotenv").config();

const express = require("express");
const axios = require("axios");
const pdfParse = require("pdf-parse");
const sharp = require("sharp");
const fs = require("fs");
const mjAPI = require("mathjax-node");

const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================
// MIDDLEWARE
// =====================================================

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// =====================================================
// 🇳🇬 WAT TIME CORE
// =====================================================

const TimeCore = {

    now() {
        return new Intl.DateTimeFormat("en-GB", {
            timeZone: "Africa/Lagos",
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }).format(new Date());
    },

    clock() {
        const hour = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Africa/Lagos",
            hour: "2-digit",
            hour12: false
        }).format(new Date());

        const minute = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Africa/Lagos",
            minute: "2-digit"
        }).format(new Date());

        return { hour, minute };
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
    const key = API_KEYS[keyIndex];
    keyIndex = (keyIndex + 1) % API_KEYS.length;
    return key;
};

async function callGemini(contents, isJson = false) {

    let lastError;

    for (let i = 0; i < API_KEYS.length; i++) {

        try {

            const res = await axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${getKey()}`,
                {
                    contents,
                    ...(isJson && {
                        generationConfig: {
                            responseMimeType: "application/json"
                        }
                    })
                },
                { timeout: 60000 }
            );

            const text =
                res.data?.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) return text.trim();

        } catch (err) {
            lastError = err;
        }
    }

    throw new Error(lastError?.message || "Gemini failed");
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
- Output ONLY improved prompt

USER:
${prompt}
`;

    const enhanced = await callGemini([
        { parts: [{ text: system }] }
    ]);

    return enhanced || prompt;
}

// =====================================================
// 🎨 IMAGE CORE (FLUX)
// =====================================================

async function generateImage(prompt) {

    const improvedPrompt = await enhancePrompt(prompt);

    const res = await axios.post(
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
        { inputs: improvedPrompt },
        {
            headers: {
                Authorization: `Bearer ${process.env.HF_TOKEN}`
            },
            responseType: "arraybuffer",
            timeout: 60000
        }
    );

    const file = "./image.png";
    fs.writeFileSync(file, res.data);

    return { file, prompt: improvedPrompt };
}

// =====================================================
// 🧮 MATH CORE (CANVAS REMOVED → SVG SAFE)
// =====================================================

function isMath(text) {
    return /solve|calculate|equation|prove|x|y|=|\^|√/.test(text.toLowerCase());
}

async function solveMath(question) {

    const prompt = `
You are a WAEC/JAMB math solver.

- Step-by-step solution
- No LaTeX
- Use √ π ± ² ³

QUESTION:
${question}
`;

    return await callGemini([{ parts: [{ text: prompt }] }]);
}

// 🔥 REPLACED CANVAS WITH SVG + SHARP
async function mathToImage(text) {

    const svg = `
    <svg width="1000" height="600">
        <rect width="100%" height="100%" fill="#111827"/>
        <foreignObject x="40" y="40" width="920" height="520">
            <div xmlns="http://www.w3.org/1999/xhtml"
                style="color:white;font-size:24px;line-height:1.6;white-space:pre-wrap;font-family:Arial;">
                ${text}
            </div>
        </foreignObject>
    </svg>
    `;

    const buffer = Buffer.from(svg);

    const file = "./math.png";

    await sharp(buffer).png().toFile(file);

    return file;
}

// =====================================================
// 📚 EXAM CORE
// =====================================================

async function examSolver(question) {

    const prompt = `
WAEC/JAMB examiner mode:

Step-by-step solution only.
No LaTeX.

QUESTION:
${question}
`;

    return await callGemini([{ parts: [{ text: prompt }] }]);
}

// =====================================================
// ⚙️ MAIN AI ROUTER
// =====================================================

app.post("/ai", async (req, res) => {

    try {

        const { prompt, mode } = req.body;

        if (mode === "exam") {

            const result = await examSolver(prompt);

            return res.json({
                success: true,
                type: "exam",
                text: result,
                time: TimeCore.now()
            });
        }

        if (mode === "image") {

            const img = await generateImage(prompt);

            return res.json({
                success: true,
                type: "image",
                image: img.file,
                enhanced_prompt: img.prompt,
                time: TimeCore.now()
            });
        }

        if (isMath(prompt)) {

            const solution = await solveMath(prompt);
            const image = await mathToImage(solution);

            return res.json({
                success: true,
                type: "math-combo",
                text: solution,
                image,
                time: TimeCore.now()
            });
        }

        const result = await callGemini([
            { parts: [{ text: `You are JARVIS AI.\nUser: ${prompt}` }] }
        ]);

        return res.json({
            success: true,
            type: "text",
            text: result,
            time: TimeCore.now()
        });

    } catch (err) {

        return res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// =====================================================
// SYSTEM ROUTES
// =====================================================

app.get("/", (req, res) => {
    res.send(`
        <h1>JARVIS AI CORE (FULL PRODUCTION)</h1>
        <p>WAT TIME: ${TimeCore.now()}</p>
    `);
});

app.get("/test", (req, res) => {
    res.json({ ok: true });
});

// =====================================================
// WAT SCHEDULER
// =====================================================

let quizLock = false;

setInterval(async () => {

    const { hour, minute } = TimeCore.clock();

    if (hour === "19" && minute === "00") {

        if (!quizLock) {
            quizLock = true;

            console.log("⏰ WAT QUIZ RUNNING...");

            await callGemini([
                { parts: [{ text: "Generate a daily quiz" }] }
            ]);
        }

    } else {
        quizLock = false;
    }

}, 60000);

// =====================================================
// START SERVER
// =====================================================

app.listen(PORT, () => {
    console.log(`JARVIS CORE RUNNING ON PORT ${PORT}`);
});
