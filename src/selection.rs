//! Portable limits and assembly for text captured from accessibility APIs.
//!
//! UI Automation can return multiple disjoint ranges and provider-controlled
//! amounts of text. This module applies deterministic limits before any text is
//! handed to the review UI or a future network provider.

/// Maximum UTF-16 code units accepted from one selection capture.
pub const MAX_SELECTION_UTF16: usize = 32_768;

/// Maximum number of disjoint ranges accepted from one selection capture.
pub const MAX_SELECTION_RANGES: usize = 8;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SelectionLimitError {
    TooManyRanges,
    TooLong,
}

/// Combines non-empty selection ranges with newlines while enforcing both
/// range-count and UTF-16-size limits.
pub fn combine_selection_ranges<I, S>(ranges: I) -> Result<Option<String>, SelectionLimitError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut output = String::new();
    let mut range_count = 0usize;
    let mut utf16_count = 0usize;

    for range in ranges {
        range_count = range_count.saturating_add(1);
        if range_count > MAX_SELECTION_RANGES {
            return Err(SelectionLimitError::TooManyRanges);
        }

        let range = range.as_ref();
        if range.is_empty() {
            continue;
        }

        let separator_count = usize::from(!output.is_empty());
        let range_utf16_count = range.encode_utf16().count();
        utf16_count = utf16_count
            .saturating_add(separator_count)
            .saturating_add(range_utf16_count);
        if utf16_count > MAX_SELECTION_UTF16 {
            return Err(SelectionLimitError::TooLong);
        }

        if separator_count == 1 {
            output.push('\n');
        }
        output.push_str(range);
    }

    if output.trim().is_empty() {
        Ok(None)
    } else {
        Ok(Some(output))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn combines_disjoint_ranges() {
        assert_eq!(
            combine_selection_ranges(["first", "second"]),
            Ok(Some("first\nsecond".into()))
        );
    }

    #[test]
    fn ignores_empty_ranges() {
        assert_eq!(
            combine_selection_ranges(["", "selected", ""]),
            Ok(Some("selected".into()))
        );
    }

    #[test]
    fn whitespace_only_selection_is_empty() {
        assert_eq!(combine_selection_ranges([" \t\n"]), Ok(None));
    }

    #[test]
    fn rejects_too_many_ranges() {
        let ranges = vec!["x"; MAX_SELECTION_RANGES + 1];
        assert_eq!(
            combine_selection_ranges(ranges),
            Err(SelectionLimitError::TooManyRanges)
        );
    }

    #[test]
    fn counts_utf16_units_instead_of_utf8_bytes() {
        let astral_character = "😀";
        let accepted = astral_character.repeat(MAX_SELECTION_UTF16 / 2);
        assert!(combine_selection_ranges([accepted.as_str()]).is_ok());

        let rejected = format!("{accepted}a");
        assert_eq!(
            combine_selection_ranges([rejected.as_str()]),
            Err(SelectionLimitError::TooLong)
        );
    }

    #[test]
    fn accounts_for_range_separators() {
        let first = "a".repeat(MAX_SELECTION_UTF16 - 1);
        assert!(combine_selection_ranges([first.as_str(), "b"]).is_err());
    }
}
