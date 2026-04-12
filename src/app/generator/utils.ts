import { SpecItem } from "@/components/SpecInput";

// ——— Fallback 로컬 템플릿 (Gemini 연결 불가 시 사용) ———

export interface FactSheetData {
    prSubject: string;
    prType: string;
    prTypeCustom?: string;
    brandName: string;
    productName?: string;
    referenceText?: string;
    llmQuestions?: string[];
    llmAnswers?: string[];
    brandDescription?: string;
}

// --- 1. Spec-to-Story Engine (Rule-based) ---
// Maps physical specs to lifestyle benefits
const mapSpecToStory = (specs: SpecItem[]): string[] => {
    return specs.map(spec => {
        const val = spec.value.toLowerCase();

        // Dimensions Logic
        if (spec.category === 'dimensions') {
            if (val.includes('1200') || val.includes('1000')) return `${spec.value} 사이즈로 콤팩트한 공간에도 여유롭게 배치하여 나만의 홈오피스를 완성할 수 있다.`;
            if (val.includes('1400') || val.includes('1600') || val.includes('1800')) return `${spec.value}의 넉넉한 사이즈로 멀티태스킹에 최적화된 넓은 작업 공간을 제공한다.`;
            return `${spec.value}의 효율적인 규격으로 공간 활용성을 극대화했다.`;
        }

        // Material Logic
        if (spec.category === 'material') {
            if (val.includes('e0') || val.includes('친환경')) return `엄격한 품질 관리를 거친 ${spec.value} 자재를 사용하여 건강한 학습 및 업무 환경을 조성한다.`;
            if (val.includes('lpm') || val.includes('강화')) return `스크래치와 오염에 강한 ${spec.value} 마감을 적용하여, 오랜 사용에도 변함없는 내구성을 자랑한다.`;
        }

        // Function Logic
        if (spec.category === 'function') {
            if (val.includes('모터') || val.includes('높이')) return `${spec.value} 기능을 통해 사용자의 체형과 컨디션에 맞춘 최적의 높이를 제공한다.`;
            if (val.includes('조명') || val.includes('led')) return `${spec.value} 기능은 눈의 피로를 최소화하여 장시간 집중이 필요한 작업에 도움을 준다.`;
            if (val.includes('수납') || val.includes('배선')) return `${spec.value} 솔루션을 통해 복잡한 데스크 위를 깔끔하게 정리, 심리적 안정감을 준다.`;
        }

        return spec.detail ? `${spec.value} - ${spec.detail}` : `${spec.value}를 통해 사용자 편의성을 높였다.`;
    });
};

// --- Main Fallback Template ---
export const generateDraft = (data: FactSheetData, specs: SpecItem[]): string => {
    const specStories = mapSpecToStory(specs);
    const typeLabel =
        data.prType === "product" ? "신제품 출시" :
            data.prType === "campaign" ? "브랜드 캠페인" :
                data.prType === "activity" ? "브랜드 활동" :
                    data.prTypeCustom || "보도자료";

    return `[${typeLabel}]

${data.brandName}${data.productName ? `, '${data.productName}' 공개` : ""} ... "${data.prSubject}"

(서울=날짜) ${data.brandName}${data.productName ? `가 신제품 '${data.productName}'을(를)` : "가 새로운 소식을"} 공개했다.

${specStories.length > 0 ? specStories.map(s => `- ${s}`).join("\n") : ""}

${data.llmQuestions?.length ? `\n[자주 묻는 질문]\n${data.llmQuestions.map((q, i) => `Q: ${q}\nA: ${data.llmAnswers?.[i] || ""}`).join("\n\n")}` : ""}

# # #

${data.brandDescription || ""}`;
};
