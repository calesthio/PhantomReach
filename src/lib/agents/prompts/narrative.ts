/**
 * Prompt for generating the executive summary narrative.
 * Used with Claude Sonnet for high-quality narrative output.
 */

export function getNarrativePrompt(
  businessName: string,
  moduleResults: Record<string, any>
): string {
  const resultsJson = JSON.stringify(moduleResults, null, 2);

  return `<task>
Write a 2-3 paragraph executive summary for ${businessName}'s digital health audit.
</task>

<audit_data>
${resultsJson}
</audit_data>

<instructions>
Write the executive summary following these guidelines:

Paragraph 1 — Overall Assessment:
- Open with the business name and overall grade/score
- State whether the digital presence is strong, moderate, or weak relative to peers
- Mention the most notable strength (highest-scoring module)
- Mention the most critical weakness (lowest-scoring module)

Paragraph 2 — Key Findings:
- Highlight 3-4 specific data points that tell the story (e.g., star rating,
  review count, PageSpeed score, citation accuracy percentage, business-impact signals)
- Connect findings to business impact (e.g., "A 3.2-star rating is suppressing
  visibility in Google Maps local pack results")
- Quantify revenue only when the data explicitly says revenue_basis is "verified_public"
  or "user_provided". Otherwise describe business impact qualitatively.
- Note any competitive positioning insights

Paragraph 3 — Path Forward:
- Summarize the top 3 actionable recommendations in priority order
- Frame each recommendation in terms of expected business outcome
- End with an encouraging but honest forward-looking statement

Style:
- Professional but accessible — a small business owner should understand every sentence
- Use specific non-revenue numbers, not vague language ("72/100" not "decent")
- Do not use dollar opportunity, ROI, revenue leakage, monthly leakage, or percent-of-revenue
  language unless revenue_basis is verified_public or user_provided
- Do not put internal snake_case keys such as website_performance, review_sentiment, or
  revenue_impact in prose. Use Website, Reviews, and Business impact.
- Do not critique the report, model, module, prompt, schema, formula, or calculator.
- Avoid marketing fluff and empty superlatives
- Keep the total length between 200-350 words
- Do not use bullet points or headers — write in flowing prose paragraphs
</instructions>

<example_output_format>
[Business Name] received an overall digital health grade of [grade] ([score]/100),
placing it [above/below/near] the average for [category] businesses in [city]...

[Continue with findings and recommendations in paragraph form...]
</example_output_format>`;
}
