## 1. Setup and Dependencies

- [x] 1.1 Install `@langchain/langgraph` and `graphology` packages
- [x] 1.2 Create `apps/desktop/src/main/services/EventWorkflow` directory
- [x] 1.3 Add feature flag `ENABLE_EVENT_WORKFLOW` to configuration

## 2. ContextStateGraph Implementation

- [x] 2.1 Create `ContextStateGraph` class in `EventWorkflow/ContextStateGraph.ts`
- [x] 2.2 Implement node creation with properties (id, timestamp, pHash, embedding, url, summary)
- [x] 2.3 Implement edge creation for node connections
- [x] 2.4 Implement LRU eviction when node count exceeds 1000
- [x] 2.5 Implement graph serialization/deserialization for persistence
- [x] 2.6 Implement `findSimilarNodes()` query method

## 3. Smart Deduplication Layer

- [x] 3.1 Create `DeduplicationService` in `EventWorkflow/DeduplicationService.ts`
- [x] 3.2 Implement pHash similarity calculation using Hamming distance
- [x] 3.3 Implement embedding cache with URL as key
- [x] 3.4 Implement time decay factor calculation (5min:1.0, 5-30min:0.5, 30min+:0.1)
- [x] 3.5 Implement composite similarity score (0.4*pHash + 0.4*embedding + 0.2*timeDecay)
- [x] 3.6 Implement deduplication decision logic with thresholds (0.85/0.6)
- [x] 3.7 Implement consecutive skip counter and forced dispatch logic

## 4. LangGraph Workflow

- [x] 4.1 Define `EventWorkflowState` interface with all workflow state fields
- [x] 4.2 Create `screenCheck` node function
- [x] 4.3 Create `captureFrame` node function
- [x] 4.4 Create `analyzeContext` node function (integrate AIEngine)
- [x] 4.5 Create `computeSimilarity` node function
- [x] 4.6 Create `deduplicate` node function with conditional routing
- [x] 4.7 Create `triggerEvent` node function (integrate PluginManager)
- [x] 4.8 Create `updateStateGraph` node function
- [x] 4.9 Assemble nodes into `StateGraph` with proper edges and conditional branching
- [x] 4.10 Implement checkpointing for state persistence

## 5. MonitoringService Refactoring

- [x] 5.1 Refactor `MonitoringService` to use new workflow when feature flag enabled
- [x] 5.2 Add fallback to original implementation when feature flag disabled
- [x] 5.3 Update `startMonitoringLoop` to invoke workflow instead of direct calls
- [x] 5.4 Add logging for workflow state transitions

## 6. Testing and Integration

- [x] 6.1 Add unit tests for `DeduplicationService` similarity calculations
- [x] 6.2 Add unit tests for `ContextStateGraph` node operations
- [ ] 6.3 Add integration test for workflow state transitions
- [ ] 6.4 Verify backward compatibility when feature flag is off
- [ ] 6.5 Test deduplication with synthetic similar screen data
