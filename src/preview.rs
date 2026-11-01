//! A deterministic, offline transformation used only by the native UI prototype.
//!
//! This is intentionally not presented as AI. It lets us exercise the text
//! review flow before networking and secret storage are introduced.

/// Produces a small local preview by normalizing whitespace, capitalizing the
/// first character, and adding terminal punctuation when needed.
pub fn improve_preview(input: &str) -> String {
    let normalized = input.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return String::new();
    }

    let mut chars = normalized.chars();
    let first = chars.next().expect("non-empty text has a first character");
    let mut output = first.to_uppercase().collect::<String>();
    output.extend(chars);

    if !matches!(output.chars().last(), Some('.' | '!' | '?')) {
        output.push('.');
    }
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_whitespace_and_punctuation() {
        assert_eq!(
            improve_preview("  hello   swift slate  "),
            "Hello swift slate."
        );
    }

    #[test]
    fn preserves_existing_terminal_punctuation() {
        assert_eq!(improve_preview("already done!"), "Already done!");
    }

    #[test]
    fn handles_unicode_capitalization() {
        assert_eq!(improve_preview("écrire clairement"), "Écrire clairement.");
    }

    #[test]
    fn empty_input_stays_empty() {
        assert!(improve_preview(" \n\t ").is_empty());
    }
}
