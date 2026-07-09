import { z } from 'zod';
import type { ChatMessage } from '../../llm/interfaces/llm-client.interface';
import type { PresentationPayload } from '../../../shared/conversation-thread/conversation-thread.types';

/**
 * Multi-turn AI 노드(`ai_agent` / `information_extractor`)의 재개 상태 3종에 대한
 * 단일 형태 SoT (refactor-03 M-7 RESUME-STATE 클러스터).
 *
 * 엔진 전반에 흩어진 `x as Record<string, unknown>` / `as Record & { ... }`
 * 구조 단언을 아래 `z.infer` 타입으로 대체해 "재개 상태" 라는 도메인 의미를
 * 코드에 명시한다. **behavior-preserving** — 본 스키마는 런타임 경계에서
 * `parse`/`safeParse` 하지 **않는다**: §7.5 rehydration 은 부재/부분/미래-버전
 * checkpoint 에 대해 spec 이 규정한 graceful-reset(`RESUME_INCOMPATIBLE_STATE`)
 * 또는 기본값 보강으로 대응하는데, 여기에 zod 검증을 끼우면 "부분 checkpoint 를
 * 받아 기본값으로 복원" 하던 malformed 허용 semantics 가 "거부/coerce" 로 바뀌어
 * 행위가 달라진다. 따라서 스키마는 (a) allow-list 를 executable 하게 문서화하고
 * (b) `z.infer` 타입을 제공하며 (c) **단위 테스트에서만** `buildResumeCheckpoint`
 * 산출물의 allow-list drift(특히 credential 필드 유입)를 검증하는 oracle 로 쓰인다.
 *
 * 라이프사이클 구분 (spec/5-system/4-execution-engine.md §1.3, impl-prep I-8):
 * - `ResumeState`      — in-memory only. multi-turn 핸들러가 턴 간 보관하는 전체
 *                        상태(credential/context-binding 필드 포함). `stripControlFields`
 *                        가 DB 영속 전 제거.
 * - `ResumeCheckpoint` — DB 영속. `ResumeState` 의 **credential-strip 부분집합** +
 *                        `schemaVersion`. `expiresAt`(TTL)·`lastUserMessage` 없음.
 *                        park·매 turn 시 `NodeExecution.outputData._resumeCheckpoint`.
 * - `RetryState`       — DB 영속(+TTL). 동일 부분집합 + `expiresAt` + replay 메타
 *                        (`lastUserMessage`/`lastUserMessageSource`). retryable error
 *                        종결 시 `NodeExecution.outputData._retryState`.
 */

/**
 * credential-strip 부분집합 (impl-prep I-5 allow-list — spec §1.3 합집합).
 * `_resumeCheckpoint` 와 `_retryState` 가 공유하는 필드군: credential 을 담지 않는
 * runtime 값만. credential / context-binding 필드(`llmConfigId` / `workspaceId` /
 * `conditions` / `presentationTools` / `maxTurns` / `rawConfig` / `conversationThreadRef`
 * 등)는 **의도적으로 제외** — 재개 시 `node.config` 재평가로 재유도한다.
 *
 * `information_extractor` 고유 runtime state(`partialResult` / `collectionRetryCount`)를
 * 포함하는 합집합 — ai_agent 재구성에는 inert(기본값). 각 값은 `z.unknown()` 계열로
 * 넓게 둔다(런타임 검증 목적이 아니라 형태 문서화·타입 파생 목적).
 */
const credentialStripSubsetShape = {
  // M-7 enrich — `z.custom<T>()` 는 **런타임 validator 를 추가하지 않는다**(모든
  // 값 통과). 오직 `z.infer` 타입만 concrete domain 타입으로 sharpen 해 소비처의
  // `as ChatMessage[]` 류 domain 캐스트를 제거한다. §7.5 graceful-reset 의 "런타임
  // 미검증" 계약(#783)은 그대로 유지 — `z.array(z.custom<ChatMessage>())` 는 배열
  // 여부만 검사(기존 `z.array(z.unknown())` 와 동일 강도)하고 원소는 미검증.
  messages: z.array(z.custom<ChatMessage>()),
  turnCount: z.number(),
  totalInputTokens: z.number(),
  totalOutputTokens: z.number(),
  totalThinkingTokens: z.number(),
  toolCalls: z.number(),
  model: z.unknown(),
  temperature: z.unknown(),
  maxTokens: z.unknown(),
  knowledgeBases: z.array(z.unknown()),
  ragTopK: z.unknown(),
  ragThreshold: z.unknown(),
  ragSources: z.array(z.unknown()),
  mcpServers: z.array(z.unknown()),
  // information_extractor 고유 runtime state (credential-free, spec §1.3 합집합).
  partialResult: z.record(z.string(), z.unknown()),
  collectionRetryCount: z.number(),
  // form 제출 대기 중이면 존재 (그 외 부재).
  pendingFormToolCall: z.record(z.string(), z.unknown()).optional(),
};

/**
 * `_resumeCheckpoint` — DB 영속 credential-strip 부분집합 + `schemaVersion`.
 * `buildResumeCheckpoint` 산출물의 **정확한 키 집합**을 기술한다(closed object) —
 * 단위 테스트가 `.strict()` 로 credential 필드 유입(allow-list drift)을 차단한다.
 * 소비처는 §7.5 rehydration 의 `schemaVersion` 가드 1곳뿐이라 closed 로 충분.
 */
export const resumeCheckpointSchema = z.object({
  schemaVersion: z.number(),
  ...credentialStripSubsetShape,
});
export type ResumeCheckpoint = z.infer<typeof resumeCheckpointSchema>;

/**
 * `_retryState` — DB 영속(+TTL). 부분집합 + `expiresAt` + replay 메타.
 * DB 에서 읽어들이는 값이라 방어적으로 모든 필드를 optional 로 두고(코드가 개별
 * 검증) `catchall` 로 열어 둔다(index signature — `Record<string, unknown>` 로
 * 취급하는 재구성기에 그대로 전달 가능).
 */
export const retryStateSchema = z
  .object({
    ...credentialStripSubsetShape,
    // ISO 8601 TTL. 소비처(`retryLastTurn`)가 `Date.parse` 로 방어적으로 검증한다.
    expiresAt: z.string(),
    retryAfterSec: z.number(),
    // 재개 시 replay 할 마지막 사용자 메시지.
    lastUserMessage: z.string(),
    lastUserMessageSource: z.enum(['ai_message', 'form_submitted']),
    // checkpoint 와 공유하는 메타(엄격 검사 대상 아님).
    schemaVersion: z.number(),
  })
  .partial()
  .catchall(z.unknown());
export type RetryState = z.infer<typeof retryStateSchema>;

/**
 * `_resumeState` — in-memory 전체 상태(superset). 부분집합 + credential /
 * context-binding 필드 + IE config 재유도분 + 진단 필드. 자유롭게 읽기·변형되는
 * 사이트가 많아 모든 필드 optional + `catchall` 로 최대한 permissive 하게 둔다
 * (`(x as ResumeState) ?? {}` 의 `{}` 도 대입 가능).
 */
export const resumeStateSchema = z
  .object({
    ...credentialStripSubsetShape,
    // credential / context-binding (DB 미영속 — 재개 시 node.config 재유도).
    llmConfigId: z.unknown(),
    workspaceId: z.string(),
    executionId: z.string(),
    nodeId: z.string(),
    workflowId: z.string(),
    // 노드 단위 context-binding — 재개 시 대기/재시도 NodeExecution row id 로
    // 재유도(persist 금지). resume 턴 통합 usage-log attribution 에 필요(#501).
    nodeExecutionId: z.string(),
    maxTurns: z.number(),
    maxToolCalls: z.number(),
    conditions: z.array(z.unknown()),
    presentationTools: z.array(z.unknown()),
    // information_extractor config (node.config 재유도분).
    outputSchema: z.array(z.unknown()),
    examples: z.array(z.unknown()),
    instructions: z.string(),
    maxCollectionRetries: z.number(),
    // 턴 간 운반되는 컨텍스트 참조·진단. (M-7 enrich — `z.custom<T>()` 는 런타임
    // 미검증, 타입만 sharpen. rawConfig·conversationThreadRef·memoryState 는
    // 진짜 dynamic/서비스 상태라 unknown 유지.)
    conversationThreadRef: z.unknown(),
    rawConfig: z.unknown(),
    turnDebugHistory: z.custom<unknown[]>(),
    allPresentations: z.custom<PresentationPayload[]>(),
    memoryState: z.unknown(),
  })
  .partial()
  .catchall(z.unknown());
export type ResumeState = z.infer<typeof resumeStateSchema>;

/**
 * credential / context-binding 필드 목록 (impl-prep I-5 "제외" 항목).
 * `_resumeCheckpoint` 에 이 중 하나라도 유입되면 credential 누출이므로 단위
 * 테스트가 부재를 단언한다. `buildResumeCheckpoint`/`buildRetryReentryState`
 * allow-list 와 동기 유지.
 */
export const CREDENTIAL_CONTEXT_FIELDS = [
  'llmConfigId',
  'workspaceId',
  'executionId',
  'nodeId',
  'workflowId',
  'nodeExecutionId',
  'maxTurns',
  'maxToolCalls',
  'conditions',
  'presentationTools',
  'conversationThreadRef',
  'rawConfig',
] as const;
