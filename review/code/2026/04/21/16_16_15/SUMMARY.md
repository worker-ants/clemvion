# Code Review 통합 보고서

## 전체 위험도
**HIGH** — Zustand 상태 직접 변이로 인한 UI 렌더링 버그, 비원자적 DB 갱신, 핵심 스트리밍 서비스 테스트 부재가 배포 전 수정이 필요한 수준으로 존재함

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | State | **Zustand 상태 직접 변이 (2건)**: `approveActivePlan`의 `plan.plan.approved = true`와 `handleSseEvent`의 `other.plan.steps = ...`가 `set()` 외부에서 원본 상태 객체를 직접 변이. React 참조 비교 실패로 리렌더 누락 | `assistant-store.ts` | `set()` 콜백 내에서 `s.messages.map(m => ({ ...m, plan: { ...m.plan, ... } }))` 불변 갱신으로 교체 |
| 2 | Testing | **LLM 스트리밍 클라이언트 테스트 전무**: 새로 추가된 `stream()` 제너레이터(이벤트 타입별 분기, AbortSignal, 문자열 에러 판별) 전체 미검증 | `anthropic.client.ts`, `openai.client.ts` | Jest AsyncIterable 모킹으로 이벤트 타입별 단위 테스트 및 abort 경로 작성 |
| 3 | Testing | **WorkflowAssistantStreamService 테스트 전무**: 도구 호출 라우팅, 플랜 승인 흐름, 메시지 영속화 타이밍 전체 미검증 | `workflow-assistant-stream.service.ts` | 서비스 레이어 단위 테스트 + e2e 스트림 통합 테스트 우선 작성 |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Database | **`appendMessage` 비원자적 3단계 DB 쓰기**: `messageRepo.save` → `sessionRepo.update` → `sessionRepo.increment` 트랜잭션 없이 순차 실행. 중간 실패 시 `message_count`와 실제 행 수 불일치 | `workflow-assistant-session.service.ts:appendMessage()` | `DataSource.transaction()`으로 묶거나 단일 UPDATE 쿼리로 통합 |
| 2 | Architecture | **`ExploreToolsService` 타 모듈 Repository 직접 주입**: `Node`, `Edge`, `Integration`, `KnowledgeBase` Repository를 소유 모듈의 서비스 레이어 우회하여 직접 DI. 모듈 경계 캡슐화 위반 | `tools/explore-tools.service.ts` | 각 도메인 모듈에 read-only 조회 메서드 추가·export 후 서비스 DI로 교체 |
| 3 | Security | **노드 `config` 민감 정보 LLM 프롬프트 노출**: API 키·패스워드 등이 포함된 `config` 필드가 필터링 없이 외부 LLM API로 전달 가능 | `system-prompt.ts`, `explore-tools.service.ts` | 프롬프트 조립 전 `config`에서 secret/password/key/token 필드 redact 처리 |
| 4 | Security | **SSE 스트림에서 내부 오류 메시지 노출**: `error instanceof Error ? error.message : 'Unknown error'`를 클라이언트에 직접 write. DB 오류·LLM 에러 상세 포함 가능 | `workflow-assistant.controller.ts:catch` | 에러 코드만 클라이언트 반환, 상세는 서버 로그에만 기록 |
| 5 | Security | **사용자 입력 크기 제한 없음**: `content`에 `@MaxLength` 없음, `nodes`/`edges` 배열에 `@ArrayMaxSize` 없음. LLM 토큰 남용 및 OOM 유발 가능 | `assistant-message-request.dto.ts` | `@MaxLength(4000)`, `@ArrayMaxSize(500)` 추가 |
| 6 | API | **SSE 에러가 HTTP 200으로 흡수**: 스트림 시작 후 발생하는 모든 오류가 `event: error`로 내려오고 HTTP 200 유지. 모니터링·로그 분석 사각지대 | `workflow-assistant.controller.ts`, `assistant.ts` | 스트림 시작 전 세션 검증 선행, 실패 시 4xx 즉시 반환 |
| 7 | Concurrency | **`sendMessage` TOCTOU**: `isStreaming` 가드 확인 후 세션 생성 `await` 사이에 두 번째 호출 진입 시 중복 세션 생성·중복 스트림 가능 | `assistant-store.ts:sendMessage` | 가드 직후 동기 구간에서 즉시 `set({ isStreaming: true })` 선점 |
| 8 | Database | **`findLatestActive` 복합 인덱스 누락**: 쿼리 조건 `(workflowId, userId, status, last_interaction_at DESC)`인데 인덱스에 `user_id` 미포함 | `V019__workflow_assistant.sql` | `(workflow_id, user_id, status, last_interaction_at DESC)` 복합 인덱스 추가 |
| 9 | Performance | **tool arguments 문자열 `+=` 누적 O(n²)**: `block.args += delta.partial_json` 패턴이 Anthropic·OpenAI 양쪽 중복. 긴 JSON 생성 시 GC 압박 | `anthropic.client.ts`, `openai.client.ts` | `string[]`로 수집 후 `join('')` 단 한 번 결합 |
| 10 | Maintainability | **`approveActivePlan` 한국어 하드코딩**: `sendMessage("계획대로 진행해 주세요.", snapshot)` — i18n 시스템 우회 | `assistant-store.ts:324` | i18n 키 추가 후 `t()` 경유 또는 상수로 분리 |
| 11 | Dependency | **순환 의존성 동적 import 우회**: `assistant-store → editor-store` 간 순환 참조를 `import()` lazy load로 회피. 유지보수 부채 | `assistant-store.ts:handleSseEvent` | 이벤트 버스 또는 `AssistantEditorBridge` 서비스로 단방향 의존성 재설계 |
| 12 | Scope | **`snapshotForApproval` prop 데드 코드**: `AssistantMessageViewProps`에 선언되나 컴포넌트 본문에서 미사용 | `assistant-message.tsx:14` | prop 제거 또는 실제 사용처 추가 |
| 13 | Scope | **`role='system'/'tool'` 미사용 enum 선제 등록**: 현재 실제로 사용되지 않는 값 미리 스키마에 추가 | `V019__workflow_assistant.sql`, `workflow-assistant-message.entity.ts` | 실제 사용 시점에 마이그레이션으로 추가, 현재는 `user`·`assistant`만 유지 |
| 14 | API | **`GET /sessions/latest` 경로 충돌 위험**: `:id` 라우트보다 앞에 선언되어 현재 동작하나, 순서 역전 시 `ParseUUIDPipe` 400 오류 | `workflow-assistant.controller.ts` | 쿼리 파라미터 방식(`?onlyLatest=true`)으로 변경 또는 라우팅 테스트로 순서 고정 |
| 15 | API | **중첩 DTO `@ApiProperty` 누락**: `AssistantWorkflowNodeDto`, `AssistantWorkflowEdgeDto` 필드에 데코레이터 없어 Swagger 스키마 불완전 | `assistant-message-request.dto.ts` | 각 필드에 `@ApiProperty`/`@ApiPropertyOptional` 추가 |
| 16 | Validation | **`AssistantWorkflowEdgeDto.type` 검증 누락**: `@IsString()`만 있고 `@IsIn(['data', 'error'])` 없어 임의 문자열 통과 | `assistant-message-request.dto.ts:54-56` | `@IsOptional() @IsIn(['data', 'error'])` 추가 |
| 17 | API | **`llmConfigId` null 설정 불가**: `@IsOptional() @IsUUID()` 조합으로 명시적 `null` 전달 시 검증 실패 | `update-assistant-session.dto.ts` | `@ValidateIf(o => o.llmConfigId !== null) @IsUUID()` 적용 |
| 18 | Logic | **`pendingToolCalls` 다중 라운드 누적**: 루프 외부 선언으로 이전 라운드 결과가 누적되고, 중간 라운드 `assistantText`는 DB 미저장 | `workflow-assistant-stream.service.ts` | 각 라운드 시작 시 `pendingToolCalls` 초기화 또는 라운드별 별도 메시지 저장 |
| 19 | Performance | **`appendMessage` session UPDATE 2회**: `sessionRepo.update`와 `sessionRepo.increment` 별도 라운드트립 | `workflow-assistant-session.service.ts` | 단일 `UPDATE SET message_count = message_count + 1, last_interaction_at = NOW()` 통합 |
| 20 | Performance | **`getWorkflow` nodes/edges 직렬 쿼리**: `nodeRepo.find`와 `edgeRepo.find`가 순차 실행 | `explore-tools.service.ts:110-117` | `Promise.all([nodeRepo.find(...), edgeRepo.find(...)])` 병렬화 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Dependency | `nanoid` 신규 import — 기존 `package.json` 포함 여부 확인 필요. 미포함 시 `crypto.randomUUID()`로 대체 가능 | `assistant-store.ts` | package.json 확인 |
| 2 | API | 응답 래핑 불일치 — 클라이언트가 `data.data`로 언래핑하나 글로벌 `TransformInterceptor` 적용 여부 불명확. 미적용 시 항상 `undefined` | `assistant.ts`, `app.module.ts` | 인터셉터 적용 여부 확인 후 클라이언트 수정 또는 인터셉터 명시 |
| 3 | Security | SSE fetch가 axios 인터셉터 우회 — 토큰 만료 시 401이 raw error로 처리됨 | `assistant.ts:streamMessage` | 토큰 갱신 로직을 fetch 경로에도 별도 구현 |
| 4 | Database | `uuid_generate_v4()` — `uuid-ossp` 확장 선행 활성화 가정. 신규 환경 실패 가능성 | `V019__workflow_assistant.sql` | `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` 추가 또는 `gen_random_uuid()`로 교체 |
| 5 | Database | `ILIKE '%…%'` 패턴 — B-tree 인덱스 미사용, 대량 데이터 시 seqscan | `explore-tools.service.ts:listWorkflows` | `pg_trgm` GIN 인덱스 또는 접두어 검색으로 제한 |
| 6 | Database | 메시지 페이지네이션 없음 — 장기 세션에서 전체 로드 시 메모리 압박 | `workflow-assistant-session.service.ts:loadMessages` | 최근 N건 + cursor 기반 페이지네이션 적용 |
| 7 | Performance | `buildSystemPrompt`에서 `JSON.stringify(current, null, 2)` — pretty-print가 LLM 입력 토큰 30~40% 증가 | `system-prompt.ts:48` | `JSON.stringify(current)` 교체 |
| 8 | Performance | `setWorkflow` API 3회 직렬 호출 — `getLatestSession`, `listSessions` 병렬화 가능 | `assistant-store.ts:setWorkflow` | `Promise.all` 병렬화 |
| 9 | Performance | 스트리밍 중 자동 스크롤 미작동 — `text_delta`는 메시지 수 변화 없어 effect 미발동 | `assistant-panel.tsx` | 스트리밍 중 `requestAnimationFrame` 또는 메시지 내용을 의존성에 포함 |
| 10 | Maintainability | `parseSseRecord`의 multi-line data concat 버그 — SSE 스펙상 `\n` 구분자 필요하나 단순 이어붙임 | `assistant.ts:parseSseRecord` | `data += (data ? "\n" : "") + line.slice(5).trim()` |
| 11 | Documentation | `applyAssistantOperation` JSDoc가 undo를 과장 보증 — `update_node` label/position 변경 시 undo 미호출 | `editor-store.ts` | JSDoc 수정 + label/position 변경 시 `pushUndo()` 선행 호출 |
| 12 | Documentation | `appendMessage` 주석이 "트랜잭션 없이도 안전"이라 기술하나 실제 구현과 불일치 | `workflow-assistant-session.service.ts` | 주석 정확히 수정: denormalized 필드 best-effort 갱신 명시 |
| 13 | Dependency | `LlmConfigModule` + `LlmModule` 이중 import — 내부 re-export 관계 확인 후 중복 제거 | `workflow-assistant.module.ts` | 각 모듈 exports 확인 |
| 14 | Concurrency | `usageLogService.record()` fire-and-forget — 실패가 무음 삭제 | `llm.service.ts:finally` | `.catch(err => logger.warn(...))` 체이닝 추가 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Requirement | **HIGH** | Zustand 직접 변이, appendMessage 비원자 연산, i18n 누락, 엣지 타입 검증 누락 |
| Architecture | **HIGH** | Zustand 직접 변이, ExploreToolsService 모듈 경계 침해, 비원자 DB 갱신, LLM 에러 문자열 매칭 |
| Testing | **HIGH** | LLM 스트리밍·StreamService 테스트 전무, 상태 변이 버그 테스트 부재, SSE 파싱 버그 |
| Security | **MEDIUM** | config 민감 데이터 LLM 노출, SSE 에러 메시지 노출, 입력 크기 제한 없음 |
| Performance | **MEDIUM** | tool args O(n²) 누적, Zustand 직접 변이 UI 버그, 직렬 DB 쿼리 |
| Side Effect | **MEDIUM** | Zustand 직접 변이(CRITICAL), appendMessage 비원자 연산, stream abort 시 done 이벤트 방출 |
| Concurrency | **MEDIUM** | sendMessage TOCTOU, Zustand 직접 변이, appendMessage 비원자 연산 |
| Maintainability | **MEDIUM** | Zustand 직접 변이, 비원자 카운터, LLM 에러 처리 코드 중복, 한국어 하드코딩 |
| API Contract | **MEDIUM** | 메시지 무제한 조회, SSE 에러 HTTP 200, 경로 충돌, Swagger 스키마 불완전 |
| Database | **MEDIUM** | appendMessage 비원자 연산, findLatestActive 인덱스 누락, 페이지네이션 없음 |
| Scope | **LOW** | LLM stream 공유 인프라 확장, 미사용 prop/enum |
| Documentation | **LOW** | 중첩 DTO @ApiProperty 누락, JSDoc 구현 불일치 |
| Dependency | **LOW** | 순환 의존성 lazy import 우회, nanoid 확인 필요 |

---

## 발견 없는 에이전트
없음 (전 에이전트 1건 이상 발견)

---

## 권장 조치사항

1. **[즉시] Zustand 상태 직접 변이 수정** — `approveActivePlan`과 `handleSseEvent` 내 plan 업데이트를 `set()` 콜백 불변 방식으로 교체. 프로덕션에서 재현 어려운 렌더링 버그
2. **[즉시] `sendMessage` TOCTOU 수정** — 가드 직후 `set({ isStreaming: true })` 선점으로 중복 세션 생성 차단
3. **[배포 전] `appendMessage` 트랜잭션 처리** — `DataSource.transaction()` 또는 단일 UPDATE 쿼리로 통합
4. **[배포 전] 입력 크기 검증 추가** — `@MaxLength(4000)`, `@ArrayMaxSize(500)` DTO 적용
5. **[배포 전] SSE 에러 메시지 노출 차단** — catch 블록에서 에러 코드만 반환, 상세는 서버 로그
6. **[단기] LLM 스트리밍 클라이언트 테스트 작성** — `stream()` 메서드 이벤트 타입별 + abort 경로
7. **[단기] `WorkflowAssistantStreamService` 테스트 작성** — 도구 라우팅·플랜 승인 흐름
8. **[단기] `ExploreToolsService` 모듈 경계 정리** — Repository 직접 주입 → 서비스 DI
9. **[단기] config 민감 정보 redact** — 시스템 프롬프트 조립 전 key/secret/password 필드 제거
10. **[중기] 스토어 순환 의존성 해소** — 이벤트 버스 또는 브릿지 서비스로 단방향 의존성 재설계
11. **[중기] `findLatestActive` 복합 인덱스 추가** — `(workflow_id, user_id, status, last_interaction_at DESC)`
12. **[중기] LLM 에러 감지 방식 개선** — 문자열 매칭 → SDK 타입 가드 + 공통 `mapProviderError` 유틸 추출