//! OpenAI-compatible provider presets.

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProviderPreset {
    pub id: &'static str,
    pub name: &'static str,
    pub endpoint: &'static str,
    pub model: &'static str,
}

pub const PRESETS: &[ProviderPreset] = &[
    ProviderPreset {
        id: "openai",
        name: "OpenAI",
        endpoint: "https://api.openai.com/v1/chat/completions",
        model: "gpt-4o-mini",
    },
    ProviderPreset {
        id: "gemini",
        name: "Google Gemini",
        endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        model: "gemini-2.5-flash",
    },
    ProviderPreset {
        id: "groq",
        name: "Groq",
        endpoint: "https://api.groq.com/openai/v1/chat/completions",
        model: "llama-3.3-70b-versatile",
    },
    ProviderPreset {
        id: "openrouter",
        name: "OpenRouter",
        endpoint: "https://openrouter.ai/api/v1/chat/completions",
        model: "openai/gpt-4o-mini",
    },
    ProviderPreset {
        id: "mistral",
        name: "Mistral AI",
        endpoint: "https://api.mistral.ai/v1/chat/completions",
        model: "mistral-small-latest",
    },
    ProviderPreset {
        id: "deepseek",
        name: "DeepSeek",
        endpoint: "https://api.deepseek.com/chat/completions",
        model: "deepseek-chat",
    },
    ProviderPreset {
        id: "ollama",
        name: "Ollama (local)",
        endpoint: "http://127.0.0.1:11434/v1/chat/completions",
        model: "llama3.2",
    },
    ProviderPreset {
        id: "lm-studio",
        name: "LM Studio (local)",
        endpoint: "http://127.0.0.1:1234/v1/chat/completions",
        model: "local-model",
    },
    ProviderPreset {
        id: "custom",
        name: "Custom endpoint",
        endpoint: "",
        model: "",
    },
];

pub fn preset_for_endpoint(endpoint: &str) -> usize {
    PRESETS
        .iter()
        .position(|preset| {
            !preset.endpoint.is_empty() && preset.endpoint.eq_ignore_ascii_case(endpoint.trim())
        })
        .unwrap_or(PRESETS.len() - 1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::ProviderConfig;

    #[test]
    fn every_noncustom_preset_is_a_valid_endpoint() {
        for preset in &PRESETS[..PRESETS.len() - 1] {
            assert!(!preset.id.is_empty());
            assert!(!preset.name.is_empty());
            ProviderConfig::new(preset.endpoint, preset.model).unwrap();
        }
    }

    #[test]
    fn endpoint_matching_is_case_insensitive_and_falls_back_to_custom() {
        assert_eq!(preset_for_endpoint(PRESETS[0].endpoint), 0);
        assert_eq!(
            preset_for_endpoint("https://API.OPENAI.COM/v1/chat/completions"),
            0
        );
        assert_eq!(
            preset_for_endpoint("https://example.com/v1"),
            PRESETS.len() - 1
        );
    }
}
