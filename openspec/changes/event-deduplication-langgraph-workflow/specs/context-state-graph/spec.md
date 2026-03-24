## ADDED Requirements

### Requirement: Graph-Based Context Storage
The system SHALL store context history using a directed graph structure (ContextStateGraph). Nodes represent events or page states, edges represent transitions or relationships.

#### Scenario: Node Creation
- **WHEN** a new event is processed
- **THEN** system SHALL create a node with properties: id, timestamp, pHash, embedding, url, summary
- **AND** SHALL connect to the previous node with an edge

### Requirement: Maximum Node Limit
The system SHALL enforce a maximum node limit (default: 1000). When exceeded, the oldest nodes SHALL be evicted using LRU policy.

#### Scenario: Node Eviction
- **WHEN** node count exceeds 1000
- **THEN** system SHALL remove the oldest 100 nodes
- **AND** SHALL preserve recent nodes for similarity comparison

### Requirement: Similar Node Query
The system SHALL support querying for similar nodes based on pHash or embedding similarity.

#### Scenario: Find Similar Nodes
- **WHEN** querying for nodes similar to a given embedding with threshold 0.8
- **THEN** system SHALL return all nodes with embedding similarity > 0.8

### Requirement: Graph Persistence
The system SHALL store graph state in memory only. On application restart, the graph SHALL start fresh without restoring previous state.

#### Scenario: Fresh Graph On Restart
- **WHEN** application starts
- **THEN** system SHALL initialize an empty graph
- **AND** SHALL NOT restore any previous state
