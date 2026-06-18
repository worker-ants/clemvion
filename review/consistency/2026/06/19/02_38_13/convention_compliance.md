# 정식 규약 준수 검토 결과

**검토 모드**: --impl-prep (구현 착수 전)
**Target**: `spec/5-system/4-execution-engine.md`
**검토 일시**: 2026-06-19

---

## 발견사항

### [INFO] 전역 Redis 키 일부가 §9.1 패턴 명시 예외로 등록돼 있으나 주석 위치가 본문과 Rationale 사이에 분산
- target 위치: §9.2 하단 note (`exec:recover:lock`, `exec:cont:seq:*`, `exec:seq:*`)
- 위반 규약: 해당 없음 (규약 위반 아님)
- 상세: §9.1 패턴(`{service}:{workspaceId}:{resource}:{id}:{sub}`)의 명시 예외를 §9.2 표 하단 note 에서 설명하고 있다. 규약 위반이 아니지만 예외 등록 문구가 표 주석으로 묻혀 있어 향후 키 추가 시 일관성 검사 누락 우려가 있다.
- 제안: 현재 note 위치 유지는 허용 가능. 실질 규약 이탈 없음.

### [INFO] §7.5.2 의 `EXECUTION_MESSAGE_TOO_LONG` 과 EIA 진입점의 `MESSAGE_TOO_LONG` 사이 코드 이름 불일치 명시 방식
- target 위치: §7.5.2 본문 및 EIA 진입점 note
- 위반 규약: `spec/conventions/error-codes.md §1` (의미 기반 명명 — "구현·역사를 박지 않음")
- 상세: WS 경로는 `EXECUTION_MESSAGE_TOO_LONG`, REST(EIA) 경로는 `MESSAGE_TOO_LONG` 으로 동일 조건이 두 코드 이름으로 노출된다. 스펙 본문은 "WS ack 와 REST 422의 routing 분기가 클라이언트에서 동일 코드를 다르게 처리해야 하는 혼동을 회피" 를 이유로 의도적 분리라고 명시하고 있다. 분리 자체는 §7.5.1 의 선례(`INVALID_EXECUTION_STATE` vs `STATE_MISMATCH`) 패턴과 일관된다. `error-codes.md §1` 이 요구하는 "의미 기반 명명"을 두 코드 모두 충족하므로 이 분리는 정식 규약 위반이 아니다.
- 제안: 현 상태 유지. `error-codes.md §3 Historical-artifact 예외 레지스트리` 는 이 케이스를 등록할 필요 없다 — 명명이 정확하고 의도적 설계이므로.

### [INFO] `pending_plans` 의 일부 항목이 `plan/in-progress/llm-error-passthrough`를 가리키지 않음
- target 위치: frontmatter `pending_plans:`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` (`pending_plans` 는 미구현 surface 를 책임지는 plan 경로여야 함)
- 상세: frontmatter `pending_plans:` 는 4개 plan 을 등록한다. 현재 worktree 이름(`llm-error-passthrough-79d0fe`)이 시사하는 `llm-error-passthrough` 관련 plan 은 이 목록에 없다. `spec/5-system/4-execution-engine.md` 의 `status: partial` 상태에서 이 plan 이 구현하는 surface(§7.5.2 Continuation ack 누출 차단)는 Rationale에 "2026-06-14 결정"으로 이미 기술돼 있고 `pending_plans` 에 없다. 이는 `spec-impl-evidence.md §3` 의 "미구현 surface 를 책임지는 plan 이 pending_plans 에 등재" 요건과의 정합을 --impl-prep 착수 전에 확인이 필요하다.
- 제안: 해당 구현 plan 이 신규 착수라면 frontmatter `pending_plans:` 에 추가 후 `spec-pending-plan-existence.test.ts` 가드가 통과하는지 확인한다. Rationale 에 이미 "결정 완료" 로 기술된 경우라면 이 구현이 실제로 별도 plan 을 통해 추적되고 있는지 점검한다.

---

## 명명 규약 (점검 관점 1) — 이상 없음

- 에러 코드: `EXECUTION_INTERNAL_ERROR`, `EXECUTION_MESSAGE_TOO_LONG`, `EXECUTION_TIME_LIMIT_EXCEEDED` 등 신규 코드 모두 `UPPER_SNAKE_CASE` + `error-codes.md §1` 의미 기반 원칙 준수.
- `EXECUTION_INTERNAL_ERROR` = generic 누출 차단 fallback, `EXECUTION_MESSAGE_TOO_LONG` = 메시지 길이 초과 조건을 이름으로 기술 → 의미 기반 명명 충족.
- BullMQ 큐 이름(`execution-run`, `execution-continuation`, `background-execution`): kebab-case 일관 사용. §9.1 키 패턴과 구분되는 라이브러리 외부 식별자로 적절.
- Redis 키 패턴: §9.1 의 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴을 모든 `exec:`, `core:`, `ws:` 키가 준수하며, 전역 키는 §9.2 note 에서 명시 예외 등록.
- 서비스 클래스 이름(`AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`, `NodeBootstrapService`): PascalCase NestJS 규약 준수.

## 출력 포맷 규약 (점검 관점 2) — 이상 없음

- `NodeHandlerOutput` 5-필드 규약(`config`, `output`, `meta?`, `port?`, `status?`): §5.1 정의가 `spec/conventions/node-output.md Principle 0` 과 정합.
- `interaction.data` payload 형식: §1.3 표(`form_submitted`, `button_click`, `button_continue`, `message_received`)가 `spec/conventions/interaction-type-registry.md` 참조 구조와 일치함을 doc 내 cross-link 로 확인.
- Continuation ack 에러 표면: `{ success: false, error: <message>, errorCode: <code> }` 형태가 §7.5.2 에 명시. `error-codes.md §1` 의 `UPPER_SNAKE_CASE` 준수.
- `_resumeCheckpoint` shape 및 `_retryState` shape: §1.3 에 상세 기술, `node-output.md Principle 4.2.1` 보존 예외 cross-link 완료.

## 문서 구조 규약 (점검 관점 3) — 이상 없음

- 3섹션 구성(Overview / 본문 / Rationale): 준수. Overview(§Overview 블록 존재), 본문(§1–§11), Rationale(### 소제목별 다수 항목) 모두 존재.
- frontmatter: `id: execution-engine`, `status: partial`, `code:` glob 2개, `pending_plans:` 4개 등재. `spec/conventions/spec-impl-evidence.md §2` 스키마 필수 필드 충족.
- `status: partial` 시 `pending_plans:` 의무 요건 충족 (4개 등재).
- 파일 위치(`spec/5-system/4-execution-engine.md`): `spec/5-system/` 영역 하위, CLAUDE.md 의 `spec/<영역>/*.md` 규약 준수.
- `0-` prefix, `_product-overview.md` 명명 컨벤션: 본 파일은 해당 없음 (일반 spec 파일).

## API 문서 규약 (점검 관점 4) — 해당 없음

- 본 문서는 실행 엔진 내부 계약 spec 이며 OpenAPI/Swagger 데코레이터·DTO 명명 패턴의 직접 대상이 아님. 관련 API 표면은 `14-external-interaction-api.md` 와 `6-websocket-protocol.md` 에 cross-link 로 분리.

## 금지 항목 (점검 관점 5) — 이상 없음

- `error-codes.md §1` 금지: 구현·역사 정보를 에러 코드 이름에 박는 패턴 — `EXECUTION_INTERNAL_ERROR`·`EXECUTION_MESSAGE_TOO_LONG` 모두 조건 의미를 기술, 구현 경로 미노출.
- `error-codes.md §2` 금지: rename 을 breaking 없이 수행 — 신규 코드(`EXECUTION_TIME_LIMIT_EXCEEDED`)는 기존 `EXECUTION_TIMEOUT` 의 rename 이 아닌 신설로 분리. 안정성 정책 준수.
- `spec-impl-evidence.md` 금지: `status: implemented` 인데 `code:` glob 0매치 — 본 파일은 `status: partial` 이므로 해당 없음.
- `node-output.md Principle 0` 금지: 5필드 외 top-level 필드 임의 추가 — `_resumeState`, `_resumeCheckpoint`, `_retryState` 는 Principle 0 명시 예외로 등재됨.
- Redis pub/sub `execution:continuation` 채널 재사용 금지 (§Rationale "Durable Continuation" 기술): 본 문서 §7.4 에서 폐기 선언 및 BullMQ 큐로 교체 명시. 금지 항목 준수.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 정식 규약(`spec/conventions/`) 준수 관점에서 전반적으로 양호하다. 에러 코드 명명(`error-codes.md §1·§2`)·출력 포맷(`node-output.md Principle 0`)·frontmatter 스키마(`spec-impl-evidence.md §2·§3`)·Redis 키 패턴·문서 3섹션 구성 등 핵심 규약을 모두 충족한다. CRITICAL·WARNING 수준의 규약 직접 위반은 발견되지 않았다. INFO 수준으로 `pending_plans` 항목이 llm-error-passthrough 구현 대상 surface 를 커버하는지 착수 전 점검이 권장된다 — 구현 plan 이 실제 착수 계획이라면 frontmatter 에 추가해 `spec-pending-plan-existence.test.ts` 가드를 통과시켜야 한다.

---

## 위험도

LOW

STATUS: OK
