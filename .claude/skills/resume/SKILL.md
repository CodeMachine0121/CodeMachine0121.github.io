---
name: resume
description: Generate a professional software engineer resume/CV. Produces a polished, ATS-optimized resume with professional summary, technical skills, quantifiable achievements, and professional attributes. Use when user asks to "generate resume", "write CV", "build resume", "create resume", "產出履歷", or "寫履歷".
---

# Resume Generation Skill

Generate a professional, ATS-optimized software engineer resume tailored to the user's background.

## Trigger phrases
- "generate resume" / "write resume" / "build resume" / "create resume"
- "generate CV" / "write CV"
- "產出履歷" / "寫履歷" / "製作履歷"

---

## Process

### Step 1 — Gather information

Ask the user for the following if not already provided. Accept any info given inline — don't re-ask.

**Required:**
- Full name
- Target job title / role (e.g. Senior Frontend Engineer)
- Years of experience
- Current or most recent employer + role
- Key technical skills (languages, frameworks, tools)
- 2–4 work experience highlights with measurable outcomes (e.g. "reduced load time by 30%")
- Education (degree, institution, year)

**Optional but recommended:**
- LinkedIn / GitHub / portfolio URL
- Contact info (email, phone, location)
- Target company or industry (for tone adjustment)
- Certifications or notable projects
- Language preference for output (English / Chinese / bilingual)

If the user provides a rough description of their background, extract what you can and only ask about what's genuinely missing.

---

### Step 2 — Generate the resume

Produce the full resume using the structure below. Output in Markdown by default (easy to copy into Word/Notion/Google Docs). If the user requests `.docx`, use the `docx` skill after generating content.

---

## Resume Structure

### Header
```
[Full Name]
[Target Job Title]
[Email] · [Phone] · [Location]
[LinkedIn] · [GitHub/Portfolio]
```

---

### Professional Summary (3–4 sentences)

Write a results-driven summary that incorporates the user's background. Use this template as a guide but personalize to their actual experience:

> Results-driven [job title] with [X] years of experience designing, developing, and deploying scalable applications that improve performance, reliability, and user experience. Skilled in [key stack], with a meticulous approach to writing clean, maintainable code. Thrives in collaborative agile teams, adaptable to new technologies, and takes full accountability for projects from initial requirements to final deployment.

Weave in 2–3 of the **12 Professional Attributes** listed below where they fit naturally. Do NOT list them as a bullet — integrate them as descriptors.

---

### Core Technical Skills

Present as a categorized list for ATS visibility. Populate from the user's actual skills:

```
Programming Languages:   [e.g. Python, JavaScript (ES6+), TypeScript, SQL, Java]
Frameworks & Libraries:  [e.g. React, Node.js, Next.js, Django, Express]
Databases:               [e.g. PostgreSQL, MongoDB, Redis, MySQL]
Cloud & DevOps:          [e.g. AWS (EC2, S3, Lambda), Docker, Jenkins, CI/CD]
Tools & Practices:       [e.g. Git, Agile/Scrum, REST APIs, Jest/PyTest, System Design]
```

Only include categories the user actually has skills in. Add or rename categories to fit (e.g. "Mobile", "Data & ML").

---

### Work Experience

For each role, use this format:

```
[Job Title] — [Company Name]
[Month Year] – [Month Year or Present]
[City, Country or Remote]

• [Achievement bullet 1]
• [Achievement bullet 2]
• [Achievement bullet 3]
```

**Achievement bullet rules:**
- Lead with a strong action verb (Built, Designed, Refactored, Implemented, Reduced, Increased, Automated, Optimized, Shipped, Led)
- Include a quantifiable result wherever possible: %, time saved, user count, latency reduction
- Reference specific technologies used

**Reference examples for tone (adapt to user's actual work):**
- Built and deployed scalable REST APIs supporting 50,000+ daily users, improving response time by 35%
- Refactored legacy modules into reusable components, reducing bug reports by 40% and improving maintainability
- Implemented CI/CD pipelines to automate testing and deployment, cutting release time from 2 hours to 20 minutes
- Developed responsive platform using code splitting and query optimization, reducing page load times by 30%

---

### Projects (optional, include if relevant or early-career)

```
[Project Name] — [Tech Stack]
[One-line description + outcome]
[GitHub link if available]
```

---

### Education

```
[Degree] in [Field]
[Institution Name], [Year]
```

---

### Certifications (optional)

```
• [Certification Name] — [Issuer], [Year]
```

---

## Reference: 12 Professional Attributes

Use these words organically in the summary or experience bullets — never as a standalone list in the resume itself.

| Word | Meaning in context |
|---|---|
| Responsive | Acts quickly to complete engineering duties |
| Proactive | Takes initiative in code optimization without being asked |
| Complete Finisher | Ensures all tasks are completed to a high standard |
| Reliable | Punctual and consistent in delivery |
| Self-motivated | Performs independently with minimal supervision |
| Collaborative | Works effectively in cross-functional teams |
| Dependable | Trusted to deliver critical work on schedule |
| Resourceful | Solves complex problems with limited time or resources |
| Adaptable | Adjusts quickly to new tech stacks and environments |
| Analytical | Breaks down problems to find efficient solutions |
| Meticulous | Pays close attention to detail and code accuracy |
| Accountable | Takes full ownership of project outcomes and code quality |

---

## Output format

Default: **Markdown** (paste-ready for Notion, Google Docs, GitHub)

If the user asks for a Word file, invoke the `docx` skill to convert the Markdown content into a `.docx`.

If the user asks for a PDF, use the `pdf` skill after generating the Markdown.

---

## Quality checklist before finalizing

- [ ] Every job bullet leads with an action verb
- [ ] At least 2 bullets per role contain a metric or quantifiable result
- [ ] Technical skills are categorized (not a flat list)
- [ ] Professional summary is 3–4 sentences and uses at least 2 attribute words
- [ ] No personal pronouns ("I", "my", "we") in any bullet point
- [ ] ATS-safe: no tables, no columns, no headers/footers in the content itself
- [ ] Dates are consistent format (Month Year)
