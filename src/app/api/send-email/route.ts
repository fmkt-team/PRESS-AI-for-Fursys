import { NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: Request) {
    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const body = await request.json();
        const { requesterName, team, subject, type, referenceUrl } = body;

        // Vercel 환경일 경우 실제 도메인, 로컬일 경우 localhost
        const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000';

        const adminUrl = `${baseUrl}/admin/requests`;

        const data = await resend.emails.send({
            from: 'PressCraft AI <onboarding@resend.dev>', // Resend 테스트 발신자
            to: ['jooyoung_park@fursys.com'], // 변경된 담당자 이메일 (승인 필요)
            subject: `[보도자료 의뢰 접수] ${subject}`,
            html: `
                <h2>새로운 보도자료 배포 의뢰가 접수되었습니다.</h2>
                <p><strong>요청자:</strong> ${requesterName}</p>
                <p><strong>팀/부서:</strong> ${team}</p>
                <p><strong>주제:</strong> ${subject}</p>
                <p><strong>유형:</strong> ${type}</p>
                ${referenceUrl ? `<p><strong>참고 URL:</strong> <a href="${referenceUrl}">${referenceUrl}</a></p>` : ''}
                <hr />
                <p>자세한 내용은 어드민 페이지에서 확인해주세요.</p>
                <a href="${adminUrl}" style="display:inline-block;padding:10px 20px;background-color:#000;color:#fff;text-decoration:none;border-radius:5px;">어드민에서 확인하기</a>
            `
        });

        if (data.error) {
            console.error("Resend API Error: ", data.error);
            return NextResponse.json({ error: data.error.message || "이메일 발송에 실패했습니다." }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Email API Route Error: ", error);
        return NextResponse.json({ error: error.message || "알 수 없는 오류가 발생했습니다." }, { status: 500 });
    }
}
