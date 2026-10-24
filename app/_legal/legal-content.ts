/* ==========================================================
   LearnMate legal content (data only)

   DRAFT: written from what the LearnMate dashboard code does.
   It has NOT been reviewed by a lawyer. Replace or edit any
   wording here; the pages render whatever is in this file.

   Before launch, confirm or fill in:
   - LEGAL_LAST_UPDATED (the date you actually publish)
   - LEARNMATE_CONTACT_EMAIL (leave "" to hide the contact
     section; nothing is invented while it is empty)
   - what /api/account/delete actually erases
   - what /api/doubt-clearer sends to Gemini and whether your
     Gemini plan allows Google to use prompts for training
   - how you collect parent/guardian consent for under-18s
   - governing law and dispute wording (not included yet)
========================================================== */

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "list"; items: string[] };

export type LegalSection = {
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocData = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

export const LEGAL_LAST_UPDATED = "25 October 2026";

/* Set this to a real address to show a contact section on both pages. */
export const LEARNMATE_CONTACT_EMAIL = "";

function contactSection(topic: string): LegalSection[] {
  if (!LEARNMATE_CONTACT_EMAIL) return [];

  return [
    {
      id: "contact",
      title: "Contact",
      blocks: [
        {
          type: "p",
          text: `If you have questions about ${topic}, write to us at ${LEARNMATE_CONTACT_EMAIL}.`,
        },
      ],
    },
  ];
}

export const PRIVACY: LegalDocData = {
  title: "Privacy Policy",
  intro:
    "LearnMate is a learning platform for students in Classes 1–12. This policy explains what information LearnMate collects, why, and the choices you have.",
  sections: [
    {
      id: "information-we-collect",
      title: "1. Information we collect",
      blocks: [
        { type: "p", text: "When you use LearnMate, the following information is stored for you:" },
        {
          type: "list",
          items: [
            "Account details: your name and email address, and the sign-in credentials managed by our authentication provider.",
            "Profile photo: only if you choose to upload one in Settings.",
            "Learning activity: the courses you add, your chapter and milestone progress, your study time and your study streaks.",
            "Doubt Clearer conversations: the questions you type, the answers you receive, and the conversation titles, saved to your account so you can return to them.",
          ],
        },
        {
          type: "p",
          text: "A few things are kept only in your own browser (local storage) and are not part of your account: your light or dark theme choice, your chapter practice answer statistics and your next test date.",
        },
        {
          type: "p",
          text: "LearnMate uses a sign-in session, stored by your browser, so that you stay signed in between visits.",
        },
      ],
    },
    {
      id: "how-we-use-information",
      title: "2. How we use your information",
      blocks: [
        {
          type: "list",
          items: [
            "To create your account and keep you signed in.",
            "To show your courses, progress, study time and streaks.",
            "To answer your questions in Doubt Clearer and keep your conversation history.",
            "To keep the service running, secure and working properly.",
          ],
        },
      ],
    },
    {
      id: "ai-features",
      title: "3. AI features and Google Gemini",
      blocks: [
        {
          type: "p",
          text: "Doubt Clearer is powered by Google’s Gemini API. When you ask a question, it is sent from LearnMate’s server to Gemini so that an answer can be generated and returned to you.",
        },
        {
          type: "p",
          text: "Please do not type sensitive personal information, such as passwords, phone numbers, home addresses or other people’s private details, into Doubt Clearer. Google’s handling of data it receives is described in Google’s own terms and privacy documents.",
        },
      ],
    },
    {
      id: "service-providers",
      title: "4. Service providers",
      blocks: [
        {
          type: "p",
          text: "LearnMate relies on Supabase for authentication, database storage and profile photo storage, and on Google for the Gemini API. These providers process information on our behalf so that LearnMate can work.",
        },
      ],
    },
    {
      id: "children",
      title: "5. Students and children",
      blocks: [
        {
          type: "p",
          text: "LearnMate is designed for students in Classes 1–12, so many of its users are children. Parents and guardians are welcome to read this policy together with their child and to look at what their child’s account contains.",
        },
        {
          type: "p",
          text: "If you are a parent or guardian and no longer want your child to have a LearnMate account, the account can be deleted from Settings.",
        },
      ],
    },
    {
      id: "your-choices",
      title: "6. Your choices and controls",
      blocks: [
        {
          type: "list",
          items: [
            "Update your name, email address and profile photo in Settings.",
            "Rename or permanently delete any Doubt Clearer conversation from your chat history.",
            "Sign out at any time.",
            "Delete your account from Settings.",
            "Clear the information LearnMate keeps in your browser by clearing your site data in your browser settings.",
          ],
        },
      ],
    },
    {
      id: "retention",
      title: "7. How long we keep information",
      blocks: [
        {
          type: "p",
          text: "Your account information, progress and saved conversations are kept while your account exists, so they are there when you come back. Conversations you delete are removed from your history.",
        },
      ],
    },
    {
      id: "security",
      title: "8. Security",
      blocks: [
        {
          type: "p",
          text: "We rely on the security features of our authentication and database providers to protect your information. No method of storing or transmitting data is completely secure, so we cannot guarantee absolute security. Please keep your password private.",
        },
      ],
    },
    {
      id: "changes",
      title: "9. Changes to this policy",
      blocks: [
        {
          type: "p",
          text: "If we change this policy, we will update the date at the top of this page. Please check it from time to time.",
        },
      ],
    },
    ...contactSection("this Privacy Policy"),
  ],
};

export const TERMS: LegalDocData = {
  title: "Terms & Conditions",
  intro:
    "These terms apply when you use LearnMate. By creating an account or using LearnMate, you agree to them.",
  sections: [
    {
      id: "about",
      title: "1. About LearnMate",
      blocks: [
        {
          type: "p",
          text: "LearnMate is a learning platform for students in Classes 1–12. It offers courses and chapters, progress and study tracking, and Doubt Clearer, an AI-powered tool for asking study questions.",
        },
      ],
    },
    {
      id: "accounts",
      title: "2. Your account",
      blocks: [
        {
          type: "list",
          items: [
            "Give accurate information when you sign up and keep it up to date.",
            "Keep your password private. You are responsible for activity on your account.",
            "Students who are under 18 should use LearnMate with the knowledge of a parent, guardian or teacher.",
          ],
        },
      ],
    },
    {
      id: "acceptable-use",
      title: "3. Using LearnMate responsibly",
      blocks: [
        { type: "p", text: "When using LearnMate, please do not:" },
        {
          type: "list",
          items: [
            "Try to break, overload or gain unauthorised access to LearnMate or other people’s accounts.",
            "Use scripts or automated tools to access the service.",
            "Use Doubt Clearer to create abusive, harmful or unlawful content.",
            "Upload a profile photo that you do not have the right to use, or that is offensive or unlawful.",
            "Share your account with others.",
          ],
        },
      ],
    },
    {
      id: "ai-answers",
      title: "4. AI answers can be wrong",
      blocks: [
        {
          type: "p",
          text: "Doubt Clearer is generated by an AI model and can make mistakes. Check important answers against your textbook or ask your teacher. It is a study aid and not a replacement for your school or your teachers.",
        },
      ],
    },
    {
      id: "learning-content",
      title: "5. Learning content",
      blocks: [
        {
          type: "p",
          text: "Course content is provided to support your learning and may not match every school’s or board’s syllabus exactly.",
        },
      ],
    },
    {
      id: "your-content",
      title: "6. Your content",
      blocks: [
        {
          type: "p",
          text: "You keep ownership of the questions you type and the photo you upload. You allow LearnMate to store and process them to run the service, including sending your questions to our AI provider to generate answers, as described in the Privacy Policy.",
        },
      ],
    },
    {
      id: "our-content",
      title: "7. LearnMate’s content and brand",
      blocks: [
        {
          type: "p",
          text: "The LearnMate name, logo, design and content belong to LearnMate or its licensors. You may use LearnMate for your own personal learning, but you may not copy, resell or redistribute it.",
        },
      ],
    },
    {
      id: "availability",
      title: "8. Availability and changes",
      blocks: [
        {
          type: "p",
          text: "We aim to keep LearnMate available, but it may sometimes be interrupted, and features may change, be added or be removed.",
        },
      ],
    },
    {
      id: "ending",
      title: "9. Ending your use",
      blocks: [
        {
          type: "p",
          text: "You can stop using LearnMate at any time and can delete your account from Settings. We may suspend or end access to accounts that break these terms.",
        },
      ],
    },
    {
      id: "liability",
      title: "10. Disclaimer and liability",
      blocks: [
        {
          type: "p",
          text: "LearnMate is provided “as is” and “as available”. To the extent allowed by law, LearnMate is not liable for losses that arise from using the service or relying on its answers, including AI-generated answers.",
        },
      ],
    },
    {
      id: "changes",
      title: "11. Changes to these terms",
      blocks: [
        {
          type: "p",
          text: "We may update these terms. When we do, we will change the date at the top of this page. Continuing to use LearnMate after an update means you accept the updated terms.",
        },
      ],
    },
    ...contactSection("these terms"),
  ],
};
