import { chatGemini } from "../gemini";
import { addArticleRecord, updateArticleStatus, ScientificArticle } from "../db/articles";

export async function processAndFormatArticle(telegramId: string, articleText: string, sourceUrl?: string): Promise<{ text: string, articleId: string }> {
    // Generate Clinical Brief using Gemini
    const prompt = `
أنت دكتور مساعد (Personal Scientific Research Assistant).
يجب أن تلخص المقال الطبي التالي بدقة وواقعية، وبطريقة "Clinically Strong but Substantive".
ممنوع اختزال المقال لدرجة تضييع قيمته. لا تخترع معلومات غير موجودة.

اكتب الملخص بالضبط بهذا التنسيق:

🧠 عنوان المقال
...

🏥 Clinical Topic
...

🎯 لماذا يهمك؟
...

📌 أهم النقاط
1.
2.
3.

🦷 Clinical Takeaway
(أهم استنتاج للطبيب عملياً)

⚠️ Important Limitations
...

📊 Evidence / Study Type
(حدد نوع الدراسة وإذا لم تجده اكتب Evidence strength not reliably determined)

المقال:
"${articleText}"
`;

    const summary = await chatGemini(prompt);
    
    // Attempt to extract title and topic from summary naively for DB, 
    // or we can just ask Gemini to return JSON, but the prompt asked for a specific presentation format.
    // For simplicity, we'll store generic info and let the presentation be the summary.
    
    const articleRecord: ScientificArticle = {
        telegram_id: telegramId,
        title: summary.split('\n')[1] || "Clinical Article",
        url: sourceUrl,
        topic: "Clinical Dentistry",
        category: "Scientific Reading",
        clinical_takeaway: "Viewed in brief"
    };

    const articleId = await addArticleRecord(articleRecord);

    let finalText = summary;
    if (sourceUrl) {
        finalText += `\n\n🔗 Original Article\n[Read Article](${sourceUrl})`;
    }

    return { text: finalText, articleId };
}
