
import { GoogleGenAI } from "@google/genai";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { cleanAiMathText } from "../../../lib/ai-text";

export const runtime = "nodejs";

async function getSupabase() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    } catch {
                        // Cookie writes may not be available in every context.
                    }
                },
            },
        }
    );
}

export async function POST(request: Request) {
    try {
        const supabase = await getSupabase();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "Please sign in to use LearnMate AI." },
                { status: 401 }
            );
        }

        const body = await request.json();
        const question =
            typeof body.question === "string"
                ? body.question.trim()
                : "";
        const requestedChatId =
            typeof body.chatId === "string"
                ? body.chatId
                : null;

        if (!question) {
            return NextResponse.json(
                { error: "Please enter a message." },
                { status: 400 }
            );
        }

        if (question.length > 10000) {
            return NextResponse.json(
                { error: "Your message is too long." },
                { status: 400 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json(
                { error: "Gemini API key is not configured." },
                { status: 500 }
            );
        }

        let chatId = requestedChatId;

        if (chatId) {
            const { data: existingChat, error } = await supabase
                .from("ai_chats")
                .select("id")
                .eq("id", chatId)
                .eq("user_id", user.id)
                .maybeSingle();

            if (error) {
                console.error("Chat lookup failed:", error);
                return NextResponse.json(
                    { error: "Could not open this conversation." },
                    { status: 500 }
                );
            }

            if (!existingChat) {
                return NextResponse.json(
                    { error: "Conversation not found." },
                    { status: 404 }
                );
            }
        } else {
            const { data: newChat, error } = await supabase
                .from("ai_chats")
                .insert({
                    user_id: user.id,
                    title: question.slice(0, 60),
                })
                .select("id")
                .single();

            if (error || !newChat) {
                console.error("Chat creation failed:", error);
                return NextResponse.json(
                    { error: "Could not create a conversation." },
                    { status: 500 }
                );
            }

            chatId = newChat.id;
        }

        const { data: previousMessages, error: historyError } =
            await supabase
                .from("ai_chat_messages")
                .select("role, content")
                .eq("chat_id", chatId)
                .eq("user_id", user.id)
                .order("created_at", { ascending: true })
                .limit(30);

        if (historyError) {
            console.error("Chat history failed:", historyError);
            return NextResponse.json(
                { error: "Could not load conversation history." },
                { status: 500 }
            );
        }

        const { error: saveQuestionError } = await supabase
            .from("ai_chat_messages")
            .insert({
                chat_id: chatId,
                user_id: user.id,
                role: "user",
                content: question,
            });

        if (saveQuestionError) {
            console.error("Question save failed:", saveQuestionError);
            return NextResponse.json(
                { error: "Could not save your message." },
                { status: 500 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        const history = (previousMessages || []).map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
        }));

        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash-lite",
            config: {
                systemInstruction:
                    "You are LearnMate AI, a helpful school tutor for students in Classes 1–12. " +
                    "Explain concepts clearly using age-appropriate language. " +
                    "Use step-by-step explanations and examples when useful. " +
                    "Be supportive, accurate, and concise. " +
                    "Do not invent textbook page numbers or sources. " +
                    "Write all maths in plain text, never in LaTeX: do not use dollar-sign notation ($...$ or $$...$$), " +
                    "backslash commands such as \\frac, \\sqrt or \\times, or curly-brace grouping. " +
                    "Write fractions as a/b, roots with the √ symbol, powers with superscript digits (x², 10³), " +
                    "and use real symbols where needed (×, ÷, π, θ, ≤, ≥, ≠, ≈, ±, →) so the answer reads cleanly on screen.",
            },
            contents: [
                ...history,
                { role: "user", parts: [{ text: question }] },
            ],
        });

        const answer = cleanAiMathText(
            response.text ||
                "I couldn't generate an answer. Please try again."
        );

        const { error: saveAnswerError } = await supabase
            .from("ai_chat_messages")
            .insert({
                chat_id: chatId,
                user_id: user.id,
                role: "assistant",
                content: answer,
            });

        if (saveAnswerError) {
            console.error("Answer save failed:", saveAnswerError);
            return NextResponse.json(
                { error: "The answer was generated but could not be saved." },
                { status: 500 }
            );
        }

        await supabase
            .from("ai_chats")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", chatId)
            .eq("user_id", user.id);

        return NextResponse.json({ answer, chatId });
    } catch (error) {
        console.error("LearnMate AI error:", error);

        return NextResponse.json(
            { error: "Unable to answer right now. Please try again." },
            { status: 500 }
        );
    }
}
