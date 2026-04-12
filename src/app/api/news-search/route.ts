import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const display = searchParams.get('display') || '20';
    const sort = searchParams.get('sort') || 'date';
    const start = searchParams.get('start') || '1';

    if (!query) {
        return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'Naver API credentials not configured' }, { status: 500 });
    }

    try {
        const response = await fetch(
            `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}&start=${start}`,
            {
                headers: {
                    'X-Naver-Client-Id': clientId,
                    'X-Naver-Client-Secret': clientSecret,
                },
                cache: 'no-store'
            }
        );

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json({ error: 'Naver API error', details: errorData }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('Naver News Search Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
