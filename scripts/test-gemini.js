// 새 키로 사용 가능한 모델 찾기
const { GoogleGenerativeAI } = require("@google/generative-ai");

const KEY = "AIzaSyD4qcENPEf7mtgIXpwx43IecnW-ixpp-qA";
const MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
];

async function test() {
    const genAI = new GoogleGenerativeAI(KEY);
    for (const modelName of MODELS) {
        try {
            process.stdout.write(`테스트: ${modelName} ... `);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("안녕");
            const text = result.response.text().slice(0, 30);
            console.log(`✅ 성공: "${text}"`);
            return;
        } catch (e) {
            const msg = e.message || "";
            if (msg.includes("limit: 0")) console.log("❌ 할당량 0 (모델 미지원)");
            else if (msg.includes("429")) console.log("❌ 429 한도 초과");
            else if (msg.includes("404")) console.log("❌ 404 모델 없음");
            else console.log(`❌ ${msg.slice(0, 80)}`);
        }
    }
    console.log("\n모든 모델 실패. API 키 자체를 확인해주세요.");
}

test();
