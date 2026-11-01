#![forbid(unsafe_code)]

//! Platform-independent SwiftSlate prototype logic.
//!
//! The Windows executable is deliberately kept outside this library so the
//! command engine and safety invariants can be tested on any CI runner.

pub mod preview;
pub mod replacement;
pub mod selection;
pub mod trigger;
