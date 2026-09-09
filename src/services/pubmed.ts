import { ScientificArticle } from "../db/articles";

export async function searchRealArticles(topic: string, limit: number = 3): Promise<Partial<ScientificArticle>[]> {
    try {
        // Using Europe PMC REST API (Completely Free, No Auth, Massive Limits, Includes PubMed)
        const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(topic + " dentistry")}&format=json&resultType=core&pageSize=${limit}`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error("API Network error");
        
        const data = await response.json();
        const results = data.resultList?.result || [];
        
        return results.map((item: any) => {
            return {
                title: item.title,
                source: item.journalTitle || item.bookOrReportDetails?.publisher || "Unknown Source",
                url: item.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/` : (item.doi ? `https://doi.org/${item.doi}` : undefined),
                doi: item.doi,
                topic: topic,
                category: "Clinical Dentistry", 
                clinical_takeaway: item.abstractText ? item.abstractText.substring(0, 500) + "..." : "No abstract available"
                // Note: The clinical_takeaway here will be re-summarized by Gemini later
            };
        });
    } catch (error) {
        console.error("Europe PMC Search Error:", error);
        return [];
    }
}
