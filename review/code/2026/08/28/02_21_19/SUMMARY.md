# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 실질 WARNING 1건(`extractNodeErrorPayload` 의 `!code || !message` 가드가 두 피연산자를 개별적으로 가르는 fixture 없음, testing reviewer 가 뮤테이션으로 실증). 나머지는 전부 이전 3라운드에서 이미 반영/유예된 항목의 재확인(INFO)이며, forced whitelist(7개 reviewer) 전원 결과 확보됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `extractNodeErrorPayload` 의 `if (!code \|\| !message) return null;` 가드를 겨냥한 신규 테스트가 `code`/`message` 를 **동시에** 비우는 fixture만 사용해, "code만 없음"/"message만 없음" 두 개별 케이스를 가르지 못한다. `\|\|`→`&&` 뮤테이션에도 89/89 GREEN (직접 실증, 즉시 원복 확인) | `codebase/frontend/src/lib/websocket/use-execution-events.ts:94`, 테스트 `use-execution-events.test.ts:2246` 부근 | 가드 테스트를 두 갈래로 분리 — (a) `error: { code: "X" }` (message만 없음), (b) `error: { message: "Y" }` (code만 없음). 둘 다 배너 미표시를 확인 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 백엔드 프로바이더 원문 에러 메시지가 사용자에게 처음 그대로 노출됨 (spec §4.1-a/§9.7 승인된 계약, 이번 PR 범위 밖) | `use-execution-events.ts` `makeSystemErrorItem`(112-137) | 조치 불요. 필요 시 백엔드에서 사용자 대면 message/내부 로그 분리를 별도 검토 |
| 2 | requirement / testing | `plan/in-progress/system-error-banner-live-ws.md` 체크리스트의 테스트 개수 서술("frontend 87")이 실제(89/89, 직접 재실행 확인)보다 낡음 | `plan/in-progress/system-error-banner-live-ws.md:62` | push 전 마무리 커밋에서 갱신(급하지 않음) |
| 3 | requirement / documentation | `- [ ] /ai-review · push · PR` 미체크 — 이번 세션이 그 단계 자체라 정상 | `plan/in-progress/system-error-banner-live-ws.md:63` | push·PR 완료 후 체크 및 `plan/complete/` 이동 |
| 4 | maintainability | `handleNodeCompleted`/`handleNodeFailed` 의 errorPayload 추출~`addConversationMessage` 블록 ~20줄 중복 (3라운드 연속 defer, 사유 유효) | `use-execution-events.ts:813-835` vs `:909-931` | 세 번째 호출부 생기면 헬퍼 추출 재검토 |
| 5 | maintainability | `asRecord(asRecord(domain)?.error)` 이중 언래핑 밀도 높음 (JSDoc이 충분히 보완, defer 유지) | `use-execution-events.ts:89-90` | 현 판정 유지 |
| 6 | maintainability | `payload.output` 타입 표기가 두 핸들러에서 다름(`Record<string,unknown>` vs `unknown`) — 공유 `NodeHandlerOutput` 타입 부재가 근본 원인, PR과 직교한 별건으로 defer | `use-execution-events.ts:769`, `:855-861`, `:869` | 공유 타입 도입 시 함께 정리 |
| 7 | testing | `asRecord` 의 배열 배제 분기(`!Array.isArray(v)`) 무테스트, 낮은 우선순위로 재확인 | `use-execution-events.ts:53` | 여유 있을 때 `output: []` fixture 1건 추가 |
| 8 | testing | `handleNodeCompleted` 의 "이전 대화 없음"(single-turn) 케이스 전용 테스트 없음 — 공유 함수 커버로 간접 방어, 실질 위험 낮음 | `use-execution-events.ts:814` | 여력 있으면 대칭 테스트 1건 추가 |
| 9 | documentation | `handleNodeFailed` 의 `output` 필드 위 주석이 도메인-레벨 서술(`output.error`)이라 wire-레벨 관점에서 표면적으로 혼동 재현 (2라운드 연속 유예, 실질 오류 아님) | `use-execution-events.ts:865-868` | 여유 있으면 "(AI Agent 자신의 domain output 필드명)" 구절 추가 |
| 10 | documentation | RESOLUTION 이 약속한 "PR 설명에 배너 최초 노출 명시"가 아직 미이행 — PR 자체가 아직 미생성이라 결함 아님 | `plan/in-progress/system-error-banner-live-ws.md` 체크리스트 마지막 항목 | PR 생성 시 본문에 "배너가 라이브 WS 경로에서 처음 노출됨(회귀 아님)" 문구 포함 |
| 11 | side_effect | `direct`(객체 형태 `rawError`) 분기 제거로 구조화 에러 인식 계약이 좁아짐 — 현재 도달 불가능 실측 근거 있음, 향후 백엔드가 객체 error 를 다시 보내면 유의 | `use-execution-events.ts:84-100` | 조치 불요, 근거 기록됨 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | XSS/인젝션/시크릿 노출 없음. 렌더 싱크 전부 JSX 텍스트 자식만 사용, `dangerouslySetInnerHTML` 없음. `details` 는 타입 화이트리스트로만 소비 |
| requirement | NONE | 핵심 결함(라이브 WS 배너 미발동)과 원인(얕은 unwrap + 배선 누락) 정확히 식별·수정. spec §4.1-a / conversation-thread.md 와 line-level 일치. 89/89 GREEN 직접 재확인 |
| scope | NONE | 프로덕션 변경은 단일 결함 수정(언래핑 정정 + 호출부 배선 교정)에 국한. 테스트/CHANGELOG/plan 신규 요소 전부 추적 가능한 review-driven 근거 보유 |
| side_effect | LOW | 종전 죽어있던 배너 APPEND 경로가 처음 발동 — 의도된 기능 재활성화(CHANGELOG/plan 명시). `addConversationMessage` 는 순수 불변 갱신, 부가 부작용 없음 |
| maintainability | NONE | 이전 3라운드 지적 사항 전부 반영 확인. 잔여 3건은 모두 defer 사유 유효, 신규 결함 없음 |
| testing | LOW | 이전 WARNING 전부 해소 재확인 + 89/89 GREEN. 신규 뮤테이션 실증으로 `!code \|\| !message` 가드 discriminating fixture 부재 WARNING 신규 발견 |
| documentation | LOW | 이전 3라운드 documentation 지적 전부 소스 반영 확인(JSDoc, 자매 주석, 테스트 제목, CHANGELOG, `.bak` 제거). 잔여 2건은 carry-over INFO |

## 발견 없는 에이전트

없음 (전 reviewer 가 최소 INFO 이상 기록, 단 CRITICAL/WARNING 없는 에이전트: security, requirement, scope, maintainability).

## 권장 조치사항

1. **(WARNING, testing)** `!code || !message` 가드 테스트를 "code만 없음"/"message만 없음" 두 케이스로 분리해 `||` 양쪽 피연산자를 개별 고정한다.
2. (선택, 급하지 않음) `plan/in-progress/system-error-banner-live-ws.md` 체크리스트의 테스트 개수 표기를 89/89로 갱신하고, push·PR 완료 후 마지막 체크박스를 체크 + `plan/complete/` 이동.
3. (선택) PR 생성 시 본문에 "system_error 배너가 라이브 WS 경로에서 처음 노출됨(회귀 아님)" 문구 포함.
4. 나머지 INFO(핸들러 간 중복, 이중 언래핑 밀도, 타입 표기 불일치, 배열 배제 미테스트, single-turn completed 테스트 부재, 도메인/wire 주석 혼동 표면화)는 기존 defer 판정 유지 — 이번 라운드에서 격상 근거 없음.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. 전체 reviewer(security, requirement, scope, side_effect, maintainability, testing, documentation) 강제 실행(`router_safety`), 7명 전원 결과 확보됨. 제외된 reviewer 없음.