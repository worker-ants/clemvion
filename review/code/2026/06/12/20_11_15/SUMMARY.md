# Code Review 통합 보고서

## 전체 위험도
**LOW** — 기능 구현(CCH-CV-03 (b) 분기 + §5.4 rotate-bot-token 응답 확장)은 spec 요구사항을 충족하며 Critical 발견사항은 없다. WARNING 6건은 모두 캡슐화 위반·성능 SLA 위협·API 문서 누락 등 개선 가능 사항이며, 즉각 차단 이슈는 없다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 / 유지보수성 / 성능 | `executionsService['executionRepository']` bracket 접근으로 private 필드 직접 우회 — 캡슐화 위반, TypeORM 최적화 계층 무효화 가능성, 테스트 4곳에서 중복 cast 블록 | `hooks.service.ts` `getActiveExecutionStatus` (~L1337); `hooks.service.spec.ts` 4개 테스트케이스 | `ExecutionsService`에 `getExecutionStatus(id): Promise<ExecutionStatus \| null>` 공개 메서드 추가 후 위임; 테스트는 public mock으로 전환 |
| 2 | 보안 | `languageHints.executionStillRunning` 커스텀 값이 Telegram MarkdownV2 escape 없이 어댑터에 전달 — 특수문자 포함 시 전송 오류 또는 의도치 않은 포맷팅 | `hooks.service.ts` `sendExecutionStillRunningNotice` (~L1362-1364) | 어댑터 수준 escape 적용 또는 languageHints 저장 시 허용 문자 검증 추가 |
| 3 | 성능 | `sendExecutionStillRunningNotice`가 `await`로 대기하여 WH-NF-01 200ms SLA 위협 — Telegram/Slack API 왕복(100~500ms)이 응답 경로 블로킹 | `hooks.service.ts` `sendExecutionStillRunningNotice` (~L1046 호출, L1357-1378 구현) | `maybeNotifyIgnored`와 동일하게 fire-and-forget(`void sendExecutionStillRunningNotice(...).catch(...)`) 패턴으로 전환 |
| 4 | 동시성 | CCH-CV-03 `getActiveExecutionStatus` 호출 → 분기 처리 사이 TOCTOU 경쟁 조건 — `running` 읽은 후 `waiting_for_input` 전이 시 사용자 입력 전달 누락 가능 | `hooks.service.ts` `handleChatChannelWebhook` L828-1051 구간 | 완전 제거는 어려우나 spec/인라인 주석에 race window 명시; `interactionService.interact` 실패 시 `executionStillRunning` fallback 발송 검토 |
| 5 | API 계약 | `POST /api/triggers/:id/chat-channel/rotate-bot-token` Swagger 응답 스키마 미선언 — `@ApiResponse` 없어 4개 신규 필드(`rotatedAt`, `triggerId`, `chatChannelHealth`, `botIdentity`)가 문서에 노출되지 않음; `botIdentity: null` nullable 경로 미문서화 | `chat-channel.controller.ts` L218-241 | `RotateBotTokenResponseDto` 클래스 생성 및 `@ApiResponse({ status: 200, type: RotateBotTokenResponseDto })` 추가; `botIdentity` nullable 여부 `@ApiPropertyOptional` 표시 |
| 6 | 유지보수성 | 테스트 내 `execRepo` cast 블록 4회 중복 — `ExecutionsService` 내부 변경 시 4곳 동시 수정 필요 | `hooks.service.spec.ts` L277-394 근방 4개 `it()` 블록 | `beforeEach` 또는 헬퍼 함수로 추출해 단일 정의; W1 수정(공개 메서드) 적용 시 cast 중복 자체 소멸 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `languageHints.executionStillRunning` 기본값이 코드에서 MarkdownV2 pre-escape(`.` → `\.`)되어 있으나 spec §4.1 예시는 plain text 기재 — 코드가 옳고 spec 예시가 구식 | `spec/5-system/15-chat-channel.md §4.1` L220; `hooks.service.ts` | spec `executionStillRunning` 예시에 "MarkdownV2 pre-escape" 주석 추가 (project-planner 위임) |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] CCH-CV-03 (b) 분기가 `button_callback`/`contact_share`/`file_upload`에도 적용되나 spec (b) 행에 command kind 매트릭스 미명시 — 구현이 올바르고 spec이 미반영 | `spec/5-system/15-chat-channel.md` CCH-CV-03 (b) 행 | spec CCH-CV-03 (b) 행에 적용 대상 command kind 목록 명시 (project-planner 위임) |
| 3 | 보안 | `rotateBotToken` 응답의 `botIdentity`(`botId`, `username`) 포함 — `botId`는 타겟팅에 활용 가능하나 인증된 관리자 전용 API이므로 직접 위험 낮음; `botToken` 자체는 `CHAT_CHANNEL_RESPONSE_STRIP_KEYS`로 올바르게 제거됨 | `triggers.service.ts` ~L1559-1567 | 컨트롤러 수준 관리자 전용 접근 제어 재확인 |
| 4 | 보안 | DB 오류 시 `getActiveExecutionStatus`가 `null`(비활성) 반환 — fail-open으로 새 execution 시작; 의도적 설계 결정; CCH-NF-03 rate-limit 미구현이 보완책 | `hooks.service.ts` ~L1337-1349 | 의도적 정책 확인됨; CCH-NF-03 rate-limit 후속 PR에서 구현 |
| 5 | 범위 | `plan/in-progress/spec-sync-chat-channel-gaps.md` frontmatter `worktree` 값 수정(`spec-sync-audit` → `chat-channel-gaps`) — 규약 정합 수정 | plan 파일 frontmatter | 범위 내 정당한 수정 |
| 6 | 범위 | `review/consistency/2026/06/12/19_25_12/` consistency-check 산출물 커밋 포함 — developer `--impl-prep` 필수 단계 산출물; review/는 gitignored 아님 | `review/consistency/` 디렉토리 | 범위 내 정당한 파일 |
| 7 | 유지보수성 | `getActiveExecutionStatus` 반환 타입 이중 캐스팅(`as ... \| null \| undefined`) — `undefined`는 논리적으로 도달 불가 | `hooks.service.ts` ~L1342 | `as { status: ExecutionStatus } \| null`로 축소 |
| 8 | 유지보수성 | `activeStatus !== ExecutionStatus.WAITING_FOR_INPUT` 부정 조건 — 미래 비-terminal 상태 자동 포함 장점이 있으나 가독성 저하 | `hooks.service.ts` ~L1045 | 양성 조건(`=== RUNNING \|\| === PENDING`)으로 교체 또는 `isExecutionStillRunning` 헬퍼 추출; trade-off 주석 추가 |
| 9 | 유지보수성 | `sendExecutionStillRunningNotice`와 `maybeNotifyIgnored`가 동일 패턴(text 발송 + warn swallow) 중복 | `hooks.service.ts` ~L1357, ~L1183 | 공통 `trySendTextMessage` private 헬퍼 추출 권장 |
| 10 | 유지보수성 | `Awaited<ReturnType<TriggersService['rotateBotToken']>>` 패턴이 다른 controller 인라인 타입 관행과 상이할 수 있음 | `chat-channel.controller.ts` ~L226 | `RotateBotTokenResponse` named type export로 통일 고려 |
| 11 | 테스트 | CCH-CV-03 (b) 테스트에 `button_callback`/`contact_share`/`file_upload` command kind 케이스 미포함 — `text_message`만 커버 | `hooks.service.spec.ts` L259-299 | `button_callback` 케이스 최소 1개 추가 또는 파라미터화 테스트 적용 |
| 12 | 테스트 | `sendExecutionStillRunningNotice`에서 `languageHints.executionStillRunning` 커스텀 문구 분기 테스트 미존재 | `hooks.service.ts` L1363-1364; 테스트 없음 | 커스텀 문구가 `sendMessage` body에 전달되는지 단위 테스트 1건 추가 |
| 13 | 테스트 | `getActiveExecutionStatus` — `findOne`이 정상적으로 `undefined` 반환(stale execution ID)하는 케이스 명시적 테스트 없음 | `hooks.service.ts` L1337-1348 | stale executionId 케이스 테스트 추가 |
| 14 | 테스트 | `chatChannelHealth: 'healthy'` 하드코딩 의도가 테스트 명칭에 미표기 | `triggers.service.spec.ts` L1479-1498 | 테스트 명칭에 "(setupChannel 성공 시 항상 'healthy')" 명시 |
| 15 | 문서화 | `getActiveExecutionStatus` JSDoc에 "catch → null → 새 execution 시작" side-effect 미기재 | `hooks.service.ts` ~L1330 | `@remarks DB 예외 시 catch-null(비활성) → 새 execution 분기` 한 줄 추가 |
| 16 | 문서화 | `sendExecutionStillRunningNotice` JSDoc의 MarkdownV2 escape 전제가 어댑터 계약 변경 시 이중 escape 위험 미언급 | `hooks.service.ts` ~L1354 | "어댑터 계약 변경 시 이중 escape 주의" 주석 보강 |
| 17 | 문서화 | `triggers.service.ts` `chatChannelHealth: 'healthy'` 하드코딩 이유 주석 미명시 | `triggers.service.ts` ~L1565 | `// setupChannel 성공 = healthy 고정 (실패 시 이미 throw)` inline 추가 |
| 18 | 문서화 | `plan/in-progress/spec-sync-chat-channel-gaps.md` §7 동시 갱신 의무(`chat-channel-adapter.md`) 이행 여부 미명시 | plan 파일 비고 §7 | 완료 항목에 "갱신 완료" 또는 "해당 없음" 명시 |
| 19 | 문서화 | 신규 4개 테스트케이스가 별도 `describe` 그룹 없이 평탄 배치 | `hooks.service.spec.ts` ~L259-394 | `describe('CCH-CV-03 (b) — running/pending 분기', ...)` 그룹핑 추가 |
| 20 | API 계약 | `handleChatChannelWebhook` `{ executionId: 'ignored' }` 반환 — 기존 경로와 동일, HTTP 외부 계약 변화 없음 | `hooks.service.ts` L454-457 | 해당 없음 |
| 21 | 성능 | `getActiveExecutionStatus` `?.findOne?.` 이중 optional chaining — hot path 매 요청 평가 비용; 영향은 미미 | `hooks.service.ts` L1340-1345 | DI 직접 주입 또는 서비스 초기화 시 null 체크로 hot path optional chaining 제거 |
| 22 | 요구사항 | `executionsService['executionRepository']` private 접근 — 신규 도입 아닌 기존 패턴 계승; 기능 완전성 이슈 없음 | `hooks.service.ts` L1338-1343 | 별도 리팩터링 이슈로 처리 |
| 23 | 요구사항 | CCH-NF-03 rate-limit enforcement 잔여 미구현 — plan에 "별도 PR" 명시됨, 이번 변경 범위 외 | `plan/in-progress/spec-sync-chat-channel-gaps.md` | 후속 PR에서 처리 예정; 현 상태 정상 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | bracket 접근 캡슐화 위반(WARNING); MarkdownV2 escape 미보장(WARNING) |
| requirement | NONE | Critical/WARNING 없음; SPEC-DRIFT 2건(INFO) |
| scope | NONE | 모든 변경 plan 범위 내; 무관한 수정 없음 |
| side_effect | LOW | rotateBotToken 반환 타입 확장 하위 호환 유지(WARNING); Swagger 스키마 미반영(INFO) |
| maintainability | LOW | bracket 접근 + 테스트 cast 중복(WARNING×2); 타입·조건 가독성(INFO×3) |
| testing | LOW | execRepo cast 4중 중복(INFO); command kind 커버리지 누락(INFO); 커스텀 문구 분기 미테스트(INFO) |
| documentation | LOW | Swagger 응답 스키마 누락(INFO 주요); JSDoc 보강 권장 3건(INFO) |
| concurrency | LOW | TOCTOU 경쟁 조건(WARNING); form_submission fail-open(INFO) |
| api_contract | LOW | Swagger 스키마 미선언(WARNING); botIdentity nullable 클라이언트 처리 필요(WARNING) |
| performance | LOW | sendExecutionStillRunningNotice await 블로킹 200ms SLA 위협(WARNING); DB 쿼리 최적화 계층 우회 위험(WARNING) |

---

## 발견 없는 에이전트

- **scope**: 무관한 파일 수정·불필요한 리팩토링·의미 없는 포맷팅 변경 없음 (NONE)
- **requirement**: Critical/WARNING 수준 요구사항 미충족 또는 spec 위반 없음 (NONE)

---

## 권장 조치사항

1. **[W3 — 성능 SLA]** `sendExecutionStillRunningNotice`를 fire-and-forget 패턴으로 전환 — WH-NF-01 200ms SLA 위협 해소. `maybeNotifyIgnored`와 동일 패턴 적용(`void sendExecutionStillRunningNotice(...)`).

2. **[W1 — 캡슐화·성능·유지보수성 통합]** `ExecutionsService`에 `getExecutionStatus(id): Promise<ExecutionStatus | null>` 공개 메서드 추가 — bracket 접근 제거, TypeORM 최적화 계층 보호, 테스트 cast 중복 소멸. 이 단일 수정이 WARNING 1·6 및 INFO 7·21·22 를 동시 해소.

3. **[W5 — API 문서]** `RotateBotTokenResponseDto` 클래스 생성 및 `@ApiResponse` 데코레이터 추가 — Swagger에 4개 응답 필드 및 `botIdentity` nullable 노출.

4. **[W2 — 보안]** MarkdownV2 escape 정책 결정 — 어댑터 수준 자동 escape 또는 `languageHints` 입력 검증 추가. 커스텀 문구 경로 보호.

5. **[W4 — 동시성]** TOCTOU race window를 spec 또는 인라인 주석에 명시적으로 문서화. `interactionService.interact` 실패 시 `executionStillRunning` fallback 발송 로직 추가 검토.

6. **[INFO — 테스트 보강]** `button_callback` command kind CCH-CV-03 (b) 케이스 테스트 추가(최소 1건) + `languageHints.executionStillRunning` 커스텀 문구 분기 테스트 1건.

7. **[SPEC-DRIFT — spec 갱신]** `spec/5-system/15-chat-channel.md` §4.1 `executionStillRunning` 예시에 MarkdownV2 pre-escape 주석 추가; CCH-CV-03 (b) 행에 command kind 매트릭스 명시 (`project-planner` 위임).

---

## 라우터 결정

라우터 미사용 — `routing=all` (전체 reviewer 실행).

- **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, api_contract, performance (10명; side_effect_dup_guard는 side_effect와 동일 output_file)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명)