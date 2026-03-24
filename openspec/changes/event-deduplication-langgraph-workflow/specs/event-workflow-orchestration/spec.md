## ADDED Requirements

### Requirement: LangGraph State Machine Integration
The system SHALL integrate @langchain/langgraph as the workflow orchestration engine for event processing. The StateMachine SHALL manage the lifecycle of screen monitoring events including capture, analysis, deduplication, and dispatch.

#### Scenario: Workflow State Transitions
- **WHEN** screen change is detected
- **THEN** workflow transitions from `idle` to `capturing` state

- **WHEN** frame capture completes
- **THEN** workflow transitions to `analyzing` state

- **WHEN** analysis completes
- **THEN** workflow transitions to `deduplicating` state

- **WHEN** deduplication decision is made
- **THEN** workflow transitions to `dispatching` or `skipping` state

- **WHEN** event dispatch completes
- **THEN** workflow transitions back to `idle` state

### Requirement: Checkpoint and Resume
The system SHALL support checkpointing workflow state to enable resume after application restart. Checkpoints SHALL be serialized to memory and optionally persisted.

#### Scenario: State Recovery After Restart
- **WHEN** application restarts with checkpoint data available
- **THEN** workflow SHALL resume from the last checkpointed state

### Requirement: Conditional Branching
The system SHALL support conditional branching in the workflow based on deduplication results.

#### Scenario: Duplicate Detection Branch
- **WHEN** deduplication similarity score exceeds 0.85
- **THEN** workflow SHALL take the `skip_event` branch

- **WHEN** deduplication similarity score is below 0.6
- **THEN** workflow SHALL take the `dispatch_event` branch

### Requirement: Node Retry Logic
The system SHALL implement retry logic for transient failures in AI analysis and event dispatch nodes.

#### Scenario: Analysis Node Retry
- **WHEN** AI analysis node fails with transient error
- **THEN** system SHALL retry up to 3 times with exponential backoff
- **AND** SHALL transition to `error` state if all retries fail
