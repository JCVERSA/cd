//! Lightweight Linux command-line adapter.
//!
//! The CLI is intentionally composable with desktop shortcut managers while
//! Wayland lacks a universal system-wide hotkey and selected-text portal.

use std::io::{Read, Write};

use swiftslate::provider::ProviderConfig;
use swiftslate::selection::{combine_selection_ranges, SelectionLimitError, MAX_SELECTION_UTF16};

use crate::linux_config::{load_or_default, save_provider_config};
use crate::linux_provider::perform_request;
use crate::linux_secrets::{delete_api_key, read_api_key, save_api_key};
use crate::linux_selection::capture_selection;

const MAX_INPUT_BYTES: usize = MAX_SELECTION_UTF16 * 4;
const MAX_SECRET_BYTES: usize = 16 * 1024;

pub fn main() {
    if let Err(error) = run() {
        eprintln!("SwiftSlate: {error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    let command = arguments.first().map(String::as_str).unwrap_or("help");
    match command {
        "help" | "--help" | "-h" => {
            print_help();
            Ok(())
        }
        "version" | "--version" | "-V" => {
            println!("SwiftSlate {}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        "configure" => configure(&arguments[1..]),
        "set-key" => set_key(&arguments[1..]),
        "remove-key" => remove_key(&arguments[1..]),
        "capture-selection" => capture_only(&arguments[1..]),
        "improve" => improve_stdin(&arguments[1..]),
        "improve-selection" => improve_selection(&arguments[1..]),
        "doctor" => doctor(&arguments[1..]),
        other => Err(format!("Unknown command `{other}`. Run `swiftslate help`.")),
    }
}

fn configure(arguments: &[String]) -> Result<(), String> {
    let current = load_or_default()?;
    let mut endpoint = current.endpoint;
    let mut model = current.model;
    let mut index = 0;
    while index < arguments.len() {
        let value = arguments
            .get(index + 1)
            .ok_or_else(|| format!("{} requires a value.", arguments[index]))?;
        match arguments[index].as_str() {
            "--endpoint" => endpoint = value.clone(),
            "--model" => model = value.clone(),
            option => return Err(format!("Unknown configure option `{option}`.")),
        }
        index += 2;
    }
    let config = ProviderConfig::new(endpoint, model).map_err(|error| error.to_string())?;
    save_provider_config(&config)?;
    println!("Saved endpoint and model. No API key was written to the config file.");
    Ok(())
}

fn set_key(arguments: &[String]) -> Result<(), String> {
    require_exact_options(arguments, &["--stdin"])?;
    let config = load_or_default()?;
    let target = config
        .credential_target()
        .map_err(|error| error.to_string())?;
    let mut secret = read_stdin(MAX_SECRET_BYTES, "API key")?;
    remove_one_line_ending(&mut secret);
    let result = save_api_key(&target, &mut secret);
    secret.fill(0);
    result?;
    println!("Saved the host-scoped API key in Secret Service.");
    Ok(())
}

fn remove_key(arguments: &[String]) -> Result<(), String> {
    require_no_options(arguments)?;
    let config = load_or_default()?;
    let target = config
        .credential_target()
        .map_err(|error| error.to_string())?;
    delete_api_key(&target)?;
    println!("Removed the API key for this provider host from Secret Service.");
    Ok(())
}

fn capture_only(arguments: &[String]) -> Result<(), String> {
    require_no_options(arguments)?;
    let captured = capture_selection()?;
    eprintln!("Captured from {}.", captured.source.description());
    print_text(&captured.text)
}

fn improve_stdin(arguments: &[String]) -> Result<(), String> {
    require_exact_options(arguments, &["--consent"])?;
    let input = read_and_validate_input()?;
    improve_and_print(input)
}

fn improve_selection(arguments: &[String]) -> Result<(), String> {
    require_exact_options(arguments, &["--consent"])?;
    let captured = capture_selection()?;
    eprintln!(
        "Captured from {}. Sending only this text and SwiftSlate's fixed editing instruction.",
        captured.source.description()
    );
    improve_and_print(captured.text)
}

fn improve_and_print(input: String) -> Result<(), String> {
    let config = load_or_default()?;
    eprintln!(
        "Consent: sending the current text to {} using model {}. The result will be printed for review and will not be pasted automatically.",
        config.endpoint, config.model
    );
    let output = perform_request(&config, &input)?;
    print_text(&output)
}

fn doctor(arguments: &[String]) -> Result<(), String> {
    require_no_options(arguments)?;
    let config = load_or_default()?;
    println!("Endpoint: {}", config.endpoint);
    println!("Model: {}", config.model);
    let target = config
        .credential_target()
        .map_err(|error| error.to_string())?;
    match read_api_key(&target) {
        Ok(Some(_)) => println!("Secret Service key: available"),
        Ok(None) => println!("Secret Service key: not configured"),
        Err(error) => println!("Secret Service key: unavailable ({error})"),
    }
    let desktop = if std::env::var_os("WAYLAND_DISPLAY").is_some() {
        "Wayland (primary selection requires wl-clipboard and compositor support)"
    } else if std::env::var_os("DISPLAY").is_some() {
        "X11 (primary selection requires xclip or xsel)"
    } else {
        "no graphical session detected; stdin mode remains available"
    };
    println!("Desktop capability: {desktop}");
    println!("Automatic replacement: disabled; output is review-only");
    Ok(())
}

fn read_and_validate_input() -> Result<String, String> {
    let bytes = read_stdin(MAX_INPUT_BYTES, "input text")?;
    let text =
        String::from_utf8(bytes).map_err(|_| "Input text must be valid UTF-8.".to_owned())?;
    match combine_selection_ranges([text]) {
        Ok(Some(text)) => Ok(text),
        Ok(None) => Err("Input text is empty.".into()),
        Err(SelectionLimitError::TooLong) => Err("Input text exceeds SwiftSlate's limit.".into()),
        Err(SelectionLimitError::TooManyRanges) => unreachable!("one range was provided"),
    }
}

fn read_stdin(limit: usize, description: &str) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    std::io::stdin()
        .lock()
        .take((limit + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read {description} from stdin: {error}"))?;
    if bytes.len() > limit {
        bytes.fill(0);
        return Err(format!("The {description} exceeds SwiftSlate's limit."));
    }
    Ok(bytes)
}

fn remove_one_line_ending(bytes: &mut Vec<u8>) {
    if bytes.last() == Some(&b'\n') {
        bytes.pop();
        if bytes.last() == Some(&b'\r') {
            bytes.pop();
        }
    }
}

fn require_no_options(arguments: &[String]) -> Result<(), String> {
    if arguments.is_empty() {
        Ok(())
    } else {
        Err(format!("Unexpected option `{}`.", arguments[0]))
    }
}

fn require_exact_options(arguments: &[String], expected: &[&str]) -> Result<(), String> {
    if arguments.len() == expected.len()
        && arguments
            .iter()
            .map(String::as_str)
            .eq(expected.iter().copied())
    {
        Ok(())
    } else {
        Err(format!("This command requires: {}", expected.join(" ")))
    }
}

fn print_text(text: &str) -> Result<(), String> {
    let mut stdout = std::io::stdout().lock();
    stdout
        .write_all(text.as_bytes())
        .and_then(|()| stdout.write_all(b"\n"))
        .map_err(|error| format!("Could not write output: {error}"))
}

fn print_help() {
    println!(
        "SwiftSlate 1.2 — lightweight AI text improvement\n\n\
Usage:\n\
  swiftslate configure [--endpoint URL] [--model NAME]\n\
  printf '%s' 'API_KEY' | swiftslate set-key --stdin\n\
  swiftslate remove-key\n\
  printf '%s' 'text' | swiftslate improve --consent\n\
  swiftslate capture-selection\n\
  swiftslate improve-selection --consent\n\
  swiftslate doctor\n\n\
The --consent flag is required for every CLI process that sends text. Provider output is printed for review and is never pasted automatically."
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_only_one_terminal_line_ending() {
        let mut value = b"secret\r\n".to_vec();
        remove_one_line_ending(&mut value);
        assert_eq!(value, b"secret");

        let mut embedded = b"not\nallowed\n".to_vec();
        remove_one_line_ending(&mut embedded);
        assert_eq!(embedded, b"not\nallowed");
    }

    #[test]
    fn exact_consent_option_is_required() {
        assert!(require_exact_options(&["--consent".into()], &["--consent"]).is_ok());
        assert!(require_exact_options(&[], &["--consent"]).is_err());
        assert!(require_exact_options(&["--yes".into()], &["--consent"]).is_err());
    }
}
