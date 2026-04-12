/**
 * 파일 파서 유틸리티
 * PDF 및 Word 파일에서 텍스트를 추출하는 클라이언트 사이드 유틸리티
 */

import mammoth from "mammoth";

/**
 * PDF 파일에서 텍스트 추출 (pdfjs-dist 사용)
 */
export async function extractTextFromPDF(file: File): Promise<string> {
    const pdfjsLib = await import("pdfjs-dist");

    // Worker 설정 — Next.js 환경 호환 (unpkg의 js 파일로 고정. 버전 호환성 위해 3.x 이하 또는 해당 버전 js 명시적 사용)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    if (String(pdfjsLib.version).startsWith('5')) {
        // v5.x 부터는 빌드 시스템 차이로 다른 방법을 쓰거나 .mjs가 필수이므로
        // 아래와 같이 legacy 방식으로 폴백
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;
    }


    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const textParts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
            .map((item: any) => item.str)
            .join(" ");
        textParts.push(pageText);
    }

    return textParts.join("\n\n");
}

/**
 * Word(.docx) 파일에서 텍스트 추출 (mammoth 사용)
 */
export async function extractTextFromWord(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}

/**
 * 파일 확장자에 따라 적절한 파서 선택
 */
export async function extractTextFromFile(file: File): Promise<string> {
    const name = file.name.toLowerCase();

    if (name.endsWith(".pdf")) {
        return extractTextFromPDF(file);
    } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
        return extractTextFromWord(file);
    } else if (name.endsWith(".txt")) {
        return await file.text();
    } else {
        throw new Error(`지원하지 않는 파일 형식입니다: ${name.split('.').pop()}`);
    }
}
