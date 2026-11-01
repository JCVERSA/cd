//! Bounded, platform-independent inline-trigger detection.
//!
//! The detector never needs a document or keystroke history. It retains only
//! enough characters to recognize the longest configured trigger and clears
//! that suffix whenever a sensitive field is focused.

use std::collections::VecDeque;

/// Identifies the source of an input event.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum InputOrigin {
    /// Input produced by the user or another application.
    Physical,
    /// Input synthesized by SwiftSlate itself. It must never retrigger commands.
    SwiftSlate,
}

/// An edit to the short suffix retained by the detector.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum InputEvent {
    Text(char),
    Backspace,
    /// Cursor movement, focus movement, mouse editing, or an unknown edit.
    Reset,
}

/// A configured textual trigger.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Trigger {
    id: String,
    pattern: Vec<char>,
}

impl Trigger {
    /// Creates a non-empty trigger.
    pub fn new(id: impl Into<String>, pattern: impl Into<String>) -> Result<Self, TriggerError> {
        let id = id.into();
        let pattern = pattern.into().chars().collect::<Vec<_>>();
        if id.trim().is_empty() {
            return Err(TriggerError::EmptyId);
        }
        if pattern.is_empty() {
            return Err(TriggerError::EmptyPattern);
        }
        Ok(Self { id, pattern })
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn pattern(&self) -> String {
        self.pattern.iter().collect()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TriggerError {
    EmptyId,
    EmptyPattern,
}

/// A successful match. The length is measured in Unicode scalar values, not bytes.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TriggerMatch {
    pub id: String,
    pub character_count: usize,
}

/// Detects configured suffixes using a strictly bounded in-memory buffer.
#[derive(Debug)]
pub struct TriggerDetector {
    triggers: Vec<Trigger>,
    suffix: VecDeque<char>,
    capacity: usize,
    sensitive: bool,
}

impl TriggerDetector {
    pub fn new(mut triggers: Vec<Trigger>) -> Self {
        // Longest match wins. The ID tie-break makes behavior deterministic.
        triggers.sort_by(|left, right| {
            right
                .pattern
                .len()
                .cmp(&left.pattern.len())
                .then_with(|| left.id.cmp(&right.id))
        });
        let capacity = triggers
            .iter()
            .map(|trigger| trigger.pattern.len())
            .max()
            .unwrap_or(0);
        Self {
            triggers,
            suffix: VecDeque::with_capacity(capacity),
            capacity,
            sensitive: false,
        }
    }

    /// Suspends detection for protected controls and immediately forgets all
    /// previously observed characters.
    pub fn set_sensitive(&mut self, sensitive: bool) {
        self.sensitive = sensitive;
        self.suffix.clear();
    }

    pub fn is_sensitive(&self) -> bool {
        self.sensitive
    }

    /// Applies one edit and returns the longest matching trigger, if any.
    pub fn feed(&mut self, event: InputEvent, origin: InputOrigin) -> Option<TriggerMatch> {
        if self.sensitive || origin == InputOrigin::SwiftSlate {
            return None;
        }

        match event {
            InputEvent::Text(character) => {
                if self.capacity == 0 {
                    return None;
                }
                if self.suffix.len() == self.capacity {
                    self.suffix.pop_front();
                }
                self.suffix.push_back(character);
            }
            InputEvent::Backspace => {
                self.suffix.pop_back();
            }
            InputEvent::Reset => {
                self.suffix.clear();
                return None;
            }
        }

        self.triggers.iter().find_map(|trigger| {
            let pattern_length = trigger.pattern.len();
            if pattern_length > self.suffix.len() {
                return None;
            }
            let offset = self.suffix.len() - pattern_length;
            self.suffix
                .iter()
                .skip(offset)
                .copied()
                .eq(trigger.pattern.iter().copied())
                .then(|| TriggerMatch {
                    id: trigger.id.clone(),
                    character_count: pattern_length,
                })
        })
    }

    #[cfg(test)]
    fn buffered_text(&self) -> String {
        self.suffix.iter().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn trigger(id: &str, pattern: &str) -> Trigger {
        Trigger::new(id, pattern).unwrap()
    }

    fn type_text(detector: &mut TriggerDetector, text: &str) -> Option<TriggerMatch> {
        text.chars().fold(None, |_, character| {
            detector.feed(InputEvent::Text(character), InputOrigin::Physical)
        })
    }

    #[test]
    fn matches_a_typed_suffix() {
        let mut detector = TriggerDetector::new(vec![trigger("improve", "?improve")]);
        assert_eq!(
            type_text(&mut detector, "Please ?improve"),
            Some(TriggerMatch {
                id: "improve".into(),
                character_count: 8,
            })
        );
    }

    #[test]
    fn longest_trigger_wins() {
        let mut detector =
            TriggerDetector::new(vec![trigger("short", "?go"), trigger("long", "?go-now")]);
        assert_eq!(type_text(&mut detector, "?go-now").unwrap().id, "long");
    }

    #[test]
    fn backspace_updates_the_suffix() {
        let mut detector = TriggerDetector::new(vec![trigger("fix", "?fix")]);
        type_text(&mut detector, "?fiz");
        detector.feed(InputEvent::Backspace, InputOrigin::Physical);
        assert_eq!(type_text(&mut detector, "x").unwrap().id, "fix");
    }

    #[test]
    fn reset_forgets_previous_input() {
        let mut detector = TriggerDetector::new(vec![trigger("fix", "?fix")]);
        type_text(&mut detector, "?fi");
        detector.feed(InputEvent::Reset, InputOrigin::Physical);
        assert!(type_text(&mut detector, "x").is_none());
    }

    #[test]
    fn the_buffer_never_exceeds_the_longest_trigger() {
        let mut detector = TriggerDetector::new(vec![trigger("fix", "?fix")]);
        type_text(&mut detector, "a very long sentence");
        assert_eq!(detector.buffered_text().chars().count(), 4);
        assert_eq!(detector.buffered_text(), "ence");
    }

    #[test]
    fn sensitive_mode_clears_and_suspends_detection() {
        let mut detector = TriggerDetector::new(vec![trigger("fix", "?fix")]);
        type_text(&mut detector, "?fi");
        detector.set_sensitive(true);
        assert!(detector.buffered_text().is_empty());
        assert!(type_text(&mut detector, "?fix").is_none());
        detector.set_sensitive(false);
        assert!(type_text(&mut detector, "x").is_none());
    }

    #[test]
    fn swiftslate_input_never_retriggers_a_command() {
        let mut detector = TriggerDetector::new(vec![trigger("fix", "?fix")]);
        for character in "?fix".chars() {
            assert!(detector
                .feed(InputEvent::Text(character), InputOrigin::SwiftSlate)
                .is_none());
        }
        assert!(detector.buffered_text().is_empty());
    }

    #[test]
    fn unicode_patterns_use_character_lengths() {
        let mut detector = TriggerDetector::new(vec![trigger("french", "?écris")]);
        let matched = type_text(&mut detector, "?écris").unwrap();
        assert_eq!(matched.character_count, 6);
    }

    #[test]
    fn empty_configuration_is_inert() {
        let mut detector = TriggerDetector::new(Vec::new());
        assert!(type_text(&mut detector, "anything").is_none());
        assert!(detector.buffered_text().is_empty());
    }
}
