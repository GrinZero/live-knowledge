## ADDED Requirements

### Requirement: Multi-Dimensional Similarity Computation
The system SHALL compute event similarity using three dimensions: visual pHash (40%), semantic embedding (40%), and time decay (20%). The weighted combination SHALL produce a composite similarity score between 0 and 1.

#### Scenario: Visual Similarity Calculation
- **WHEN** comparing two screen frames
- **THEN** system SHALL compute Hamming distance between their 8x8 perceptual hashes
- **AND** SHALL normalize to 0-1 similarity where distance 0 = 1.0, distance 64 = 0.0

### Requirement: Semantic Embedding Comparison
The system SHALL compute semantic similarity using text embeddings of the analyzed context. Embeddings SHALL be cached by page URL to avoid redundant API calls.

#### Scenario: Embedding Cache Hit
- **WHEN** analyzing a page with URL "https://example.com/page-a"
- **AND** an embedding for this URL exists in cache
- **THEN** system SHALL reuse the cached embedding instead of calling AI API

### Requirement: Time Decay Factor
The system SHALL apply time decay to similarity scores. Events within 5 minutes receive full weight (1.0), events between 5-30 minutes receive 0.5 weight, events beyond 30 minutes receive 0.1 weight.

#### Scenario: Time Decay Applied
- **WHEN** comparing current event to an event 10 minutes ago
- **THEN** time decay factor SHALL be 0.5

### Requirement: Deduplication Decision
The system SHALL make deduplication decisions based on composite similarity score thresholds:
- Score > 0.85: Skip event (duplicate)
- Score 0.6-0.85: Enter confirmation queue (optional)
- Score < 0.6: Dispatch event (new)

#### Scenario: Duplicate Event Skipped
- **WHEN** composite similarity score is 0.92
- **THEN** system SHALL skip event dispatch
- **AND** SHALL log the deduplication reason

#### Scenario: New Event Dispatched
- **WHEN** composite similarity score is 0.45
- **THEN** system SHALL proceed with event dispatch

### Requirement: Deduplication History Tracking
The system SHALL maintain a deduplication history to prevent the same duplicate event from being skipped indefinitely. After 5 consecutive skips for similar content, the system SHALL force dispatch once to verify context change.

#### Scenario: Forced Dispatch After Consecutive Skips
- **WHEN** same content has been skipped 5 times consecutively
- **THEN** system SHALL force dispatch on the next occurrence regardless of similarity score
