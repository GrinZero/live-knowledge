## MODIFIED Requirements

### Requirement: MonitoringService Workflow Integration
The MonitoringService SHALL be refactored to use the LangGraph workflow orchestration instead of the existing linear polling loop. The service SHALL delegate screen watching, analysis, and event dispatch to their respective workflow nodes.

#### Scenario: Workflow-Driven Monitoring
- **WHEN** MonitoringService starts
- **THEN** it SHALL initialize and start the LangGraph workflow
- **AND** SHALL use the workflow's state transitions to coordinate components

### Requirement: Backward Compatibility Fallback
The system SHALL retain the existing MonitoringService methods as a fallback when the new workflow is disabled via feature flag.

#### Scenario: Feature Flag Disabled
- **WHEN** `ENABLE_EVENT_WORKFLOW` feature flag is false
- **THEN** system SHALL use the original MonitoringService implementation
- **AND** SHALL NOT initialize the LangGraph workflow

#### Scenario: Feature Flag Enabled
- **WHEN** `ENABLE_EVENT_WORKFLOW` feature flag is true
- **THEN** system SHALL use the new LangGraph workflow
- **AND** SHALL route all monitoring through workflow nodes
