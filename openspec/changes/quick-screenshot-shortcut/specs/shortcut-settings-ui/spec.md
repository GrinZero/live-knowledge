## ADDED Requirements

### Requirement: Shortcut key configuration in Settings
The system SHALL provide a shortcut key configuration interface in the Settings page under the "Triggers" tab.

#### Scenario: User can view current shortcut
- **WHEN** user navigates to Settings > Triggers tab
- **THEN** user sees the current configured shortcut displayed

#### Scenario: User can set custom shortcut
- **WHEN** user clicks the shortcut input field and presses a key combination
- **THEN** the shortcut is captured and displayed in the input field

#### Scenario: Shortcut setting persists after restart
- **WHEN** user sets a custom shortcut and restarts the application
- **THEN** the custom shortcut is still active and registered

### Requirement: Shortcut input validation
The system SHALL validate that the shortcut combination is valid and not empty.

#### Scenario: Empty shortcut is rejected
- **WHEN** user clears the shortcut field and tries to save
- **THEN** system shows an error message and does not save

#### Scenario: Single key shortcut is allowed
- **WHEN** user sets a single key (e.g., `F12`) as shortcut
- **THEN** system accepts and registers it

### Requirement: Shortcut change takes effect immediately
The system SHALL unregister the old shortcut and register the new one immediately when the user saves the settings.

#### Scenario: New shortcut active after save
- **WHEN** user changes shortcut from `Cmd+Shift+S` to `Cmd+Shift+X` and saves
- **THEN** `Cmd+Shift+S` is unregistered and `Cmd+Shift+X` is now active
