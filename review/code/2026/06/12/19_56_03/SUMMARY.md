# Code Review 통합 보고서

검토 대상: chat-channel-gaps — CCH-CV-03(b) + §5.4 rotate-bot-token 응답 확장

---

## 전체 위험도

**HIGH** — 구현 코드는 spec 요구사항을 정확히 이행했으나, spec 단일 진실 문서(`spec/5-system/15-chat-channel.md`)가 두 군데 모두 "미구현 (Planned)" 마커와 구 스키마를 유지하는 CRITICAL 불일치가 있다. 테스트 커버리지 갭(경계 케이스 4건), 아키텍처·유지보수성 중간 등급 경고도 복수 존재한다.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/15-chat-channel.md` CCH-CV-03 행이 "(b) 분기 미구현 (Planned)" 마커·제거된 메서드명(`isActiveExecution`, `hooks.service.ts:733`)·무효 행 번호를 그대로 유지 — 코드는 이미 완전 구현됨 | `spec/5-system/15-chat-channel.md` 67행 | CCH-CV-03 행의 "(b) 분기 미구현 (Planned)" 단락 전체를 구현 완료 사실로 교체; `isActiveExecution` → `getActiveExecutionStatus` 메서드명 갱신; 행 번호 참조 제거 (`project-planner` 위임) |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/15-chat-channel.md §5.4` 성공 응답 예시가 아직 `rotatedAt` 1필드 + "미구현 (Planned)" 마커 — 코드는 이미 4필드(`rotatedAt`, `triggerId`, `chatChannelHealth`, `botIdentity`) 반환 중 | `spec/5-system/15-chat-channel.md` 324행, 333행 | §5.4 성공 응답 JSON 예시를 4필드로 갱신; "현재 구현은 1필드만 반환" 및 "미구현 (Planned)" 문구 제거; `triggers.service.ts:921` 고정 행 번호 참조 제거 (`project-planner` 위임) |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `getActiveExecutionStatus` — `pending` 상태 분기 미검증. 구현은 `running`/`pending` 모두 동일 경로지만 테스트는 `running` 케이스만 검증 | `hooks.service.spec.ts` CCH-CV-03 (b) 테스트 블록 | `status: 'pending'` mock 으로 동일 동작(sendMessage 호출, `{ executionId: 'ignored' }` 반환) 검증 케이스 추가 |
| 2 | 테스트 | `getActiveExecutionStatus` — DB 예외(catch) 경로 미검증. `findOne` 예외 시 `.catch(() => null)` → `hasActiveExecution = false` → 새 execution 시작될 수 있으나 해당 시나리오 테스트 없음 | `hooks.service.ts` `getActiveExecutionStatus` (~line 1650) | `execRepo.findOne.mockRejectedValueOnce(new Error('db error'))` 케이스 추가 |
| 3 | 테스트 | `sendExecutionStillRunningNotice` — `sendMessage` 실패(catch) 경로 미검증. sendMessage throw 시에도 `{ executionId: 'ignored' }` 정상 반환 여부 미확인 | `hooks.service.ts` `sendExecutionStillRunningNotice` (~line 1679) | `mockAdapter.sendMessage.mockRejectedValueOnce(new Error('network'))` 케이스 추가 |
| 4 | 테스트 | §5.4 `botIdentity: null` 케이스가 `triggers.service.spec.ts` 에만 있고 controller 레벨 미검증 | `chat-channel.controller.spec.ts` | controller spec 에 `botIdentity: null` mock 케이스 추가 또는 "pass-through 만이므로 service 레벨 충분" 근거 주석 명시 |
| 5 | 아키텍처 | `HooksService` 단일 책임 원칙 위반 — `handleChatChannelWebhook` 에 인증·대화 상태·execution 상태·명령 분기·form 처리 등 9개 이상 책임 집중. 이번 변경이 분기를 추가해 복잡도 심화 | `hooks.service.ts` `handleChatChannelWebhook` (~380 라인) | `ChatChannelWebhookHandler` 서비스를 `chat-channel` 모듈에 분리하고 `HooksService` 는 위임만 수행하도록 후속 PR 기술 부채 등록 |
| 6 | 아키텍처 / 유지보수성 | `executionsService['executionRepository']` bracket-access — `ExecutionsService` private 멤버에 문자열 키로 직접 접근하여 캡슐화·인터페이스 분리·의존성 역전 원칙 위반. 컴파일 타임 미감지 런타임 오류 위험 | `hooks.service.ts` `getActiveExecutionStatus` (~line 1650) | `ExecutionsService` 에 `getActiveStatus(id: string): Promise<ExecutionStatus \| null>` 공개 메서드 추가 후 해당 경로 사용 |
| 7 | 유지보수성 | `handleChatChannelWebhook` 반환 타입 인라인 객체 리터럴 — `handleWebhook` 반환 타입과 일부 중복, 동기화 위험 | `hooks.service.ts` `handleChatChannelWebhook` 시그니처 (~line 1045) | `ChatChannelWebhookResult` named 타입으로 추출 후 두 메서드에서 공유 |
| 8 | 부작용 | `rotateBotToken` 반환 타입 확장 — Swagger 스키마 / 프론트엔드 API 타입 코드젠 등 외부 계약 소비자에게 전파 가능. 기존 `{ rotatedAt }` 만 기대하던 클라이언트 영향 확인 필요 | `triggers.service.ts` 반환 타입; `chat-channel.controller.ts` 172행 | Swagger `@ApiResponse` DTO 또는 프론트엔드 API 타입 재생성 여부 확인 |
| 9 | 부작용 | `isActiveExecution` → `getActiveExecutionStatus` 교체로 `running`/`pending` 상태에서 기존 forwarding 이 모두 무시(안내+ignored)로 동작 변경 — `button_callback` / `contact_share` / `file_upload` 도 포함 | `hooks.service.ts` ~line 778–807 | spec CCH-CV-03 이 4가지 명령 종류 모두를 무시 대상으로 포함하는지 명시적 검증 |
| 10 | 문서화 | `handleChatChannelWebhook` JSDoc 4번 항목이 CCH-CV-03 (b) 분기("running/pending → executionStillRunning 안내 + ignored")를 반영하지 않음 | `hooks.service.ts` `handleChatChannelWebhook` JSDoc (1028~1038행) | "(a) waiting_for_input → interact(), (b) running/pending → executionStillRunning 안내+ignored, (c) terminal/없음 → 새 execution" 로 갱신 |
| 11 | 문서화 | `languageHints.executionStillRunning` EN locale default 문구 미문서화 — 구현은 KO 단일 default 사용 중이나 spec §4.1.1 에 EN locale 지원 여부/KO fallback 명시 없음 | `spec/5-system/15-chat-channel.md` §4.1.1 (243행) | §4.1.1 또는 §4.2 config 예시 테이블에 `executionStillRunning` 이 KO-only fallback 임을 명기 |
| 12 | 성능 | `getActiveExecutionStatus` — 활성 대화 있는 모든 webhook 요청에서 conversation lookup 이후 execution status DB 쿼리가 직렬 추가 실행. WH-NF-01 200ms SLA 하에서 tail latency 누적 우려 | `hooks.service.ts` 746-754, 1647-1662 | `channelConversationService.lookup` 응답에 execution status 포함하거나 두 I/O 병렬화 가능 여부 검토. 고트래픽 채널 모니터링 권고 |
| 13 | 동시성 | `getActiveExecutionStatus` + `hasActiveExecution` 분기 사이 TOCTOU — DB 스냅샷 조회 후 분기 실행 시점에 execution 상태가 변경될 수 있음(`running` → `waiting_for_input` 전이 등) | `hooks.service.ts` `handleChatChannelWebhook` 내 activeStatus 조회·분기 전체 | best-effort 특성상 실용적으로 수용 가능하나 trade-off 를 코드 주석으로 문서화 권장 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | bracket-access `executionRepository` — TypeScript 접근 제어 우회, 보안 직결 아니나 내부 상태 불일치 위험 | `hooks.service.ts` `getActiveExecutionStatus` | `ExecutionsService` 공개 메서드 추가로 해결 (WARNING #6 과 동일) |
| 2 | 보안 | 로거에 `conversationKey` 평문 기록 (`sendExecutionStillRunningNotice` 등 다수 경로) | `hooks.service.ts` 다수 `logger.warn` | 앞 6자 + `***` 마스킹 또는 `[REDACTED]` 처리 검토 (운영 가시성 트레이드오프) |
| 3 | 보안 | 외부 API 에러 메시지 `err.message` 그대로 로그 기록 — 토큰·민감 설정값 포함 가능성 | `hooks.service.ts` `sendExecutionStillRunningNotice` 등 catch 블록 | 에러 코드·상태코드 수준만 기록 검토 |
| 4 | 보안 | `newBotToken` 포맷 검증 부재 — 존재/문자열 여부만 확인, Telegram token 형식 미검증 | `chat-channel.controller.ts` `rotateBotToken` (~line 227) | 정규식(`/^\d+:[A-Za-z0-9_-]{35,}$/`)으로 최소 포맷 검증 추가 검토 |
| 5 | 아키텍처 | `ChatChannelController` 반환 타입 `Awaited<ReturnType<TriggersService['rotateBotToken']>>` — Controller 가 Service 구현 타입에 직접 결합 | `chat-channel.controller.ts` 226행 | `RotateBotTokenResponseDto` 명시적 인터페이스 정의로 API 계약 안정화 |
| 6 | 아키텍처 | `TriggersService.rotateBotToken` 반환 타입 인라인 정의 — named export(`RotateBotTokenResult`)로 추출하면 재사용성 향상 | `triggers.service.ts` 858-864행 | `export interface RotateBotTokenResult { ... }` 정의 후 재사용 |
| 7 | 아키텍처 | `handleFormStep` 내 `MAX_FIELDS_HEURISTIC = 10` 매직 상수 + "v1 stub" 주석 — 미완성 설계가 서비스 레이어에 hard-coded | `hooks.service.ts` ~line 1583 | PR-E(fieldsCatalog) 구현 시 `FormStepHandler` 분리 함께 고려 |
| 8 | 유지보수성 | `getActiveExecutionStatus` 내 terminal 상태 목록(`COMPLETED/FAILED/CANCELLED`) 하드코딩 | `hooks.service.ts` `getActiveExecutionStatus` (~line 1657) | `TERMINAL_STATUSES` 상수 또는 `isTerminalStatus` 헬퍼 공용 추출 |
| 9 | 유지보수성 | `sendExecutionStillRunningNotice` 와 `maybeNotifyIgnored` 가 `adapter.sendMessage` + try/catch + logger.warn 패턴 중복 | `hooks.service.ts` ~line 1670 vs ~line 1496 | `trySendText(...)` private 헬퍼로 추출해 중복 제거 |
| 10 | 테스트 | `waiting_for_input` 상태에서 정상 forwarding 경로 유지 여부 회귀 테스트 — diff 에 명시적으로 보이지 않음 | `hooks.service.spec.ts` | 기존 테스트에 해당 케이스 존재 확인, 없으면 추가 |
| 11 | 테스트 | `languageHints.executionStillRunning` 커스텀 메시지 경로 미검증 | `hooks.service.ts` `sendExecutionStillRunningNotice` (~line 1675) | `config.languageHints.executionStillRunning` 설정 케이스에서 커스텀 텍스트 전달 검증 추가 |
| 12 | 요구사항 | `ROTATE_RESULT` 테스트 주석 "3필드 동봉" — 실제 객체는 4필드(혼동 유발) | `chat-channel.controller.spec.ts` 36행; `triggers.service.spec.ts` 1792행 | "rotatedAt + 3필드 추가(triggerId / chatChannelHealth / botIdentity)" 또는 "4필드"로 통일 |
| 13 | 문서화 | 인라인 주석 "truthy 시 TS 가 non-null 로 좁힘" — 실제 연산자는 `!= null`(null/undefined 제외)로 semantics 다름 | `hooks.service.ts` 1141~1145행 | "`!= null` (null/undefined 제외) 시" 로 수정 |
| 14 | API 계약 | `botIdentity.teamId?` 선택적 서브필드 — Swagger `@ApiProperty` 에 `required: false`·`nullable: true` 미선언 | `triggers.service.ts` L861 | Swagger 문서화 보완 |
| 15 | API 계약 | `{ executionId: 'ignored' }` sentinel 값 — 클라이언트가 실제 execution ID 로 오인해 후속 조회 API 호출 가능성 | `hooks.service.ts` L766 | API 문서에 `'ignored'` 의미 명시 또는 `{ status: 'skipped' }` 별도 필드 검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| documentation | HIGH | spec 본문 2군데 CRITICAL 불일치 (CCH-CV-03 (b) + §5.4 "미구현" 마커 잔존) |
| architecture | MEDIUM | HooksService 단일 책임 위반; executionsService bracket-access 캡슐화 위반 |
| maintainability | MEDIUM | handleChatChannelWebhook 370줄 다중 책임; bracket-access 리팩터링 미완료 |
| testing | MEDIUM | pending 상태·DB 예외·sendMessage 실패·botIdentity null 경계 케이스 4건 미검증 |
| security | LOW | 모든 발견사항 INFO 수준 (로거 conversationKey 노출, 에러 메시지 노출, token 포맷 미검증) |
| performance | LOW | 직렬 DB 쿼리 누적 latency 경고 (WARNING 1건); 나머지 INFO |
| side_effect | LOW | 반환 타입 확장·행동 변경 WARNING 2건; 실제 breaking change 아님 |
| concurrency | LOW | TOCTOU 패턴 WARNING 1건 (best-effort 특성상 실용적 수용 가능) |
| requirement | LOW | spec 갱신 누락(documentation 과 중복) + 테스트 주석 불일치 INFO |
| api_contract | LOW | 서비스 타입과 HTTP DTO 결합 구조 WARNING; botIdentity nullable Swagger 미선언 |
| scope | NONE | 모든 변경이 plan 항목과 정확히 대응, 범위 이탈 없음 |

---

## 발견 없는 에이전트

scope — 변경 범위가 plan `spec-sync-chat-channel-gaps.md` 의 두 구현 항목 및 의무 절차 산출물과 1:1 대응하며 불필요한 변경 없음.

---

## 권장 조치사항

1. **(CRITICAL/SPEC-DRIFT) spec 본문 갱신 — `project-planner` 위임**: `spec/5-system/15-chat-channel.md` 의 CCH-CV-03 행 "(b) 미구현 Planned" 마커 제거·메서드명 갱신, §5.4 성공 응답 JSON 4필드로 갱신·"미구현 Planned" 제거. plan 체크박스가 완료로 표기됐으나 실제 spec 본문은 갱신되지 않은 상태.
2. **(WARNING/테스트) 경계 케이스 4건 추가**: `pending` 상태 분기, DB 예외 catch, `sendMessage` 실패 swallow, `botIdentity: null` controller 레벨 케이스.
3. **(WARNING/부작용 확인) 외부 계약 소비자 점검**: `rotateBotToken` 4필드 확장에 따른 프론트엔드 API 타입 재생성 여부 및 Swagger DTO 갱신 확인.
4. **(WARNING/부작용 확인) `button_callback` 등 행동 변경 spec 정합**: `running`/`pending` 상태에서 `button_callback`·`contact_share`·`file_upload` 도 무시되는 것이 spec CCH-CV-03 의도인지 명시 확인 및 spec 보완.
5. **(WARNING/문서화) `handleChatChannelWebhook` JSDoc 갱신**: (b) 분기 경로 추가 반영.
6. **(WARNING/문서화) `languageHints.executionStillRunning` EN locale 지원 여부 spec 명기**.
7. **(후속 기술 부채) `ExecutionsService` 공개 메서드 추가**: `getActiveStatus(id): Promise<ExecutionStatus | null>` 추가 후 bracket-access 제거.
8. **(후속 기술 부채) `handleChatChannelWebhook` 분리**: `ChatChannelWebhookHandler` 서비스로 분리.

---

## 라우터 결정

라우터가 선별 실행:

- **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`, `api_contract` (11명)
- **제외**: 3명

  | 제외된 reviewer | 이유 |
  |-----------------|------|
  | dependency | 변경 범위에 패키지 의존성 변경 없음 |
  | database | DB 스키마 변경 없음, 기존 쿼리 패턴 유지 |
  | user_guide_sync | 사용자 가이드 문서 변경 없음 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)