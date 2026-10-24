import type { Metadata } from "next";

import LegalDocument from "../_legal/LegalDocument";
import { TERMS } from "../_legal/legal-content";

export const metadata: Metadata = {
    title: "Terms & Conditions | LearnMate",
};

export default function TermsPage() {
    return (
        <LegalDocument
            doc={TERMS}
            otherHref="/privacy"
            otherLabel="Privacy Policy"
        />
    );
}
