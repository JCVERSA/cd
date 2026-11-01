//! Built-in review commands shared by the native UI and inline trigger detector.

use crate::trigger::Trigger;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CommandDefinition {
    pub id: &'static str,
    pub label: &'static str,
    pub trigger: &'static str,
    pub instruction: &'static str,
}

pub const COMMANDS: &[CommandDefinition] = &[
    CommandDefinition {
        id: "improve",
        label: "Improve clarity",
        trigger: "?improve",
        instruction: "Rewrite to improve clarity, flow, and coherence while preserving meaning. Return only the revised text.",
    },
    CommandDefinition {
        id: "fix",
        label: "Fix grammar",
        trigger: "?fix",
        instruction: "Fix grammar, spelling, and punctuation errors while preserving meaning and tone. Return only the corrected text.",
    },
    CommandDefinition {
        id: "shorten",
        label: "Shorten",
        trigger: "?shorten",
        instruction: "Rewrite to be more concise while preserving the core meaning and all important facts. Return only the revised text.",
    },
    CommandDefinition {
        id: "expand",
        label: "Expand",
        trigger: "?expand",
        instruction: "Rewrite with useful additional detail based only on what is stated or widely known. Do not fabricate facts. Return only the revised text.",
    },
    CommandDefinition {
        id: "formal",
        label: "Formal tone",
        trigger: "?formal",
        instruction: "Rewrite in a formal, professional tone while preserving every fact and the original meaning. Return only the revised text.",
    },
    CommandDefinition {
        id: "casual",
        label: "Casual tone",
        trigger: "?casual",
        instruction: "Rewrite in a casual, friendly, natural tone while preserving every fact and the original meaning. Return only the revised text.",
    },
    CommandDefinition {
        id: "human",
        label: "Natural tone",
        trigger: "?human",
        instruction: "Rewrite to sound natural and human. Avoid filler, clichés, em dashes, and semicolons. Keep all facts, names, and numbers intact. Return only the revised text.",
    },
    CommandDefinition {
        id: "reply",
        label: "Write a reply",
        trigger: "?reply",
        instruction: "Write a concise, contextually appropriate reply to the provided message. Return only the reply.",
    },
    CommandDefinition {
        id: "translate-fr",
        label: "Translate to French",
        trigger: "?translate:fr",
        instruction: "Translate the text into natural French while preserving meaning, names, formatting, and tone. Return only the translation.",
    },
];

pub fn command_by_id(id: &str) -> Option<&'static CommandDefinition> {
    COMMANDS.iter().find(|command| command.id == id)
}

pub fn command_by_index(index: usize) -> &'static CommandDefinition {
    COMMANDS.get(index).unwrap_or(&COMMANDS[0])
}

pub fn triggers() -> Vec<Trigger> {
    COMMANDS
        .iter()
        .map(|command| {
            Trigger::new(command.id, command.trigger)
                .expect("built-in command IDs and triggers are non-empty")
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::trigger::{InputEvent, InputOrigin, TriggerDetector};

    #[test]
    fn command_ids_and_triggers_are_unique() {
        for (index, command) in COMMANDS.iter().enumerate() {
            assert!(command.trigger.starts_with('?'));
            assert!(!command.instruction.trim().is_empty());
            assert!(COMMANDS[..index]
                .iter()
                .all(|other| other.id != command.id && other.trigger != command.trigger));
        }
    }

    #[test]
    fn every_inline_trigger_resolves_to_its_command() {
        for command in COMMANDS {
            let mut detector = TriggerDetector::new(triggers());
            let matched = command.trigger.chars().fold(None, |_, character| {
                detector.feed(InputEvent::Text(character), InputOrigin::Physical)
            });
            assert_eq!(matched.unwrap().id, command.id);
        }
    }
}
