//! Guards for applying an asynchronous transformation to a live text field.
//!
//! AI responses can arrive after the user has changed focus or edited the
//! source text. A result is only eligible for replacement when the target and
//! source still match the snapshot captured at request time.

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SelectionSnapshot {
    target_id: String,
    selected_text: String,
}

impl SelectionSnapshot {
    pub fn new(target_id: impl Into<String>, selected_text: impl Into<String>) -> Self {
        Self {
            target_id: target_id.into(),
            selected_text: selected_text.into(),
        }
    }

    pub fn target_id(&self) -> &str {
        &self.target_id
    }

    pub fn selected_text(&self) -> &str {
        &self.selected_text
    }

    /// Determines whether an asynchronous result may still be applied.
    pub fn verify(&self, current_target_id: &str, current_selected_text: &str) -> ApplyDecision {
        if current_target_id != self.target_id {
            return ApplyDecision::Reject(RejectReason::FocusChanged);
        }
        if current_selected_text != self.selected_text {
            return ApplyDecision::Reject(RejectReason::SourceChanged);
        }
        ApplyDecision::Allow
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ApplyDecision {
    Allow,
    Reject(RejectReason),
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RejectReason {
    FocusChanged,
    SourceChanged,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_an_unchanged_target_and_selection() {
        let snapshot = SelectionSnapshot::new("window:12/control:4", "draft text");
        assert_eq!(
            snapshot.verify("window:12/control:4", "draft text"),
            ApplyDecision::Allow
        );
    }

    #[test]
    fn rejects_a_focus_change() {
        let snapshot = SelectionSnapshot::new("editor-a", "draft text");
        assert_eq!(
            snapshot.verify("editor-b", "draft text"),
            ApplyDecision::Reject(RejectReason::FocusChanged)
        );
    }

    #[test]
    fn rejects_an_edit_made_while_waiting() {
        let snapshot = SelectionSnapshot::new("editor-a", "draft text");
        assert_eq!(
            snapshot.verify("editor-a", "newer text"),
            ApplyDecision::Reject(RejectReason::SourceChanged)
        );
    }
}
