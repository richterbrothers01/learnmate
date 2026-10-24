import type { Metadata } from "next";

import LegalDocument from "../_legal/LegalDocument";
import { PRIVACY } from "../_legal/legal-content";

export const metadata: Metadata = {
    title: "Privacy Policy | LearnMate",
};

export default function PrivacyPage() {
    return (
        <LegalDocument
            doc={PRIVACY}
            otherHref="/terms"
            otherLabel="Terms & Conditions"
        />
    );
}
