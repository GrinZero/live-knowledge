## ADDED Requirements

### Requirement: Global shortcut triggers manual screenshot capture
The system SHALL register a configurable global keyboard shortcut that, when pressed, triggers a single screenshot capture and event processing workflow WITHOUT opening the monitoring panel.

#### Scenario: Default shortcut triggers capture
- **WHEN** user presses `CommandOrControl+Shift+S` (default) and no custom shortcut is configured
- **THEN** system captures the current screen immediately and processes it through the EventWorkflow

#### Scenario: Custom shortcut triggers capture
- **WHEN** user presses the configured custom shortcut
- **THEN** system captures the current screen immediately and processes it through the EventWorkflow

#### Scenario: Shortcut works when monitoring is running
- **WHEN** user presses the shortcut while monitoring is already running
- **THEN** system still captures the current screen and processes it (no conflict)

#### Scenario: Shortcut works when no window is open
- **WHEN** user presses the shortcut when no application window is focused
- **THEN** system captures the current screen and processes it

### Requirement: Silent background capture
The system SHALL NOT open any window or UI panel when the shortcut is triggered.

#### Scenario: No UI shown on shortcut
- **WHEN** user presses the shortcut
- **THEN** no window or panel is opened or brought to focus

#### Scenario: Capture completes without user interaction
- **WHEN** user presses the shortcut
- **THEN** capture and processing complete in the background without requiring user input
