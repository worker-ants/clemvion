# Code Review 통합 보고서

## 전체 위험도
**LOW** — `system_error` 배너 라이브 WS 경로 복구(5라운드 누적 diff)에서 CRITICAL/WARNING 없이 안정적으로 수렴했으나, testing 관점에서 `retryable`/`retryAfterSec` 타입 가드가 malformed 타입 입력에 대해 두 호출부 모두 무테스트인 신규 WARNING 1건이 발견됨. forced(router_safety) 화이트리스트 7개 reviewer 전원의 결과가 실제로 확보되었음 — 강제 목록 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `retryable`/`retryAfterSec` 타입 가드(`typeof === "boolean"` / `typeof === "number"`)가 두 호출부(`handleNodeCompleted`, `handleNodeFailed`)에서 완전히 동일한 코드로 복제돼 있는데, 값은 있으나 타입이 틀린 경우(예: 백엔드가 `retryable: "true"` 문자열을 보내는 스키마 drift)를 겨냥한 fixture 가 하나도 없음. 뮤테이션 실측(타입 체크 제거)으로 92/92 GREEN 유지 확인 — 자매 함수 `extractNodeErrorPayload` 의 `!code \|\| !message` 갭(이 PR 이 직접 고친 것과 동일 클래스)의 다음 단계 자리. | `codebase/frontend/src/lib/websocket/use-execution-events.ts:815-822`(`handleNodeCompleted`), `:911-918`(`handleNodeFailed`) | 한 호출부(`handleNodeFailed` 권장, 기존 `[가드]` 네이밍 컨벤션 재사용)에 `details: { retryable: "true", retryAfterSec: "30" }` 같은 malformed 타입 fixture 1건 추가해 안전 fallback(`false`/`undefined`)을 고정. 두 호출부가 완전 중복이므로 공유 헬퍼 추출 시 그 헬퍼 테스트 하나로 양쪽 동시 고정 가능(maintainability 의 DRY 지적과 연계). |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 신규 실사용 렌더 경로(`system_error` 배너)가 JSX 텍스트 자식으로만 소비되고 `dangerouslySetInnerHTML` 없음 — XSS 안전 재확인 | `use-execution-events.ts` `extractNodeErrorPayload`/`makeSystemErrorItem`; 싱크 `conversation-timeline-item.tsx` | 조치 불요 |
| 2 | security | `details` 필드는 `retryable`(boolean)/`retryAfterSec`(number) 개별 타입 검증된 두 필드만 UI 로 전달, 나머지 하위 필드는 버려짐 — 임의 객체 유출 없음 | `use-execution-events.ts` `extractNodeErrorPayload` | 조치 불요 |
| 3 | security | (범위 밖) 백엔드 프로바이더 원문 에러 메시지가 이 배포로 처음 사용자에게 노출됨 — spec §4.1-a/§9.7 이 이미 승인한 계약, 이 PR 의 결함 아님 | `use-execution-events.ts` `makeSystemErrorItem` | 필요 시 백엔드에서 사용자 대면/로그용 메시지 분리 별건 검토 |
| 4 | security | ID 새니타이즈(`sanitizeUuid`)·인증/세션/암호화/의존성 변경 없음, 하드코딩 시크릿 없음 | 전체 diff | 조치 불요 |
| 5 | requirement | `details` 캐스트(`typeof === "object"`)가 같은 파일의 `asRecord`(`!Array.isArray` 배제)와 달리 배열을 배제하지 않음 — 소비부가 named-property 접근만 해 실질 영향 없음, 백엔드 wire 상 배열 경로도 없음 | `use-execution-events.ts` `extractNodeErrorPayload` details 산출 라인 | 여유 있으면 `!Array.isArray(source.details)` 추가해 원칙 일관화 |
| 6 | requirement | `handleNodeCompleted`(`port:'error'`+`node.completed`) 분기의 production 도달 가능성이 4라운드 연속 100% 확증 안 됨(백엔드 미변경, 이 PR 이 그 경로를 고쳤을 뿐 신규 생성 아님) | `use-execution-events.ts:813-835` | 도달성 확정하려면 별도 백엔드 조사(planner 턴) 필요, 이 PR 과 직교 |
| 7 | side_effect | `addConversationMessage` 호출 빈도가 라이브 WS 경로에서 처음 0→N 이 됨(죽어있던 부수효과 경로 복구) — CHANGELOG/plan 에 "회귀 아님"으로 명시된 의도된 변경 | `use-execution-events.ts:813,909` | 조치 불요, 배포 후 신규 노출을 결함으로 오인하지 않도록 릴리즈 노트 전파 확인 |
| 8 | side_effect | `extractNodeErrorPayload` 시그니처 축소(2→1 인자)는 비-export 함수, 호출부 2곳 동반 수정 확인 — 외부 영향 없음 | `use-execution-events.ts:84` | 조치 불요 |
| 9 | maintainability | 신규 `\|\|` 좌/우항 가드 테스트 2건이 준비/단언 6줄을 거의 그대로 반복 | `use-execution-events.test.ts:2241-2258` vs `:2260-2277` | 세 번째 유사 조합 추가 시 `it.each` 파라미터화 고려(우선순위 낮음) |
| 10 | maintainability | (carry-over, 4라운드 유예) `handleNodeCompleted`/`handleNodeFailed` errorPayload 추출~append 블록 ~20줄 중복 | `use-execution-events.ts:807-835` vs `:904-931` | 세 번째 호출부 생기면 공유 헬퍼 추출 재검토 |
| 11 | maintainability | (carry-over, 4라운드 유예) `asRecord(asRecord(domain)?.error)` 이중 언래핑 밀도, `payload.output` 타입 표기 핸들러 간 불일치(`Record<string,unknown>` vs `unknown`) | `use-execution-events.ts:90`, `:769`/`:869` | 현 판정 유지, 공유 타입 도입 시 함께 정리 |
| 12 | testing | `details` 필드가 존재하지만 object 아닌 경우(예: 문자열)의 방어도 무테스트 — 위 WARNING 과 동일 클래스, 실도달 가능성 낮음 | `use-execution-events.ts:95-98` | 급하지 않음, WARNING fixture 작성 시 `details: "n/a"` 케이스 동시 추가 고려 |
| 13 | documentation | (carry-over, 4라운드 유예) `handleNodeFailed` 의 `output?: unknown` 필드 위 §7.9 주석이 바로 위 §4.1-a wire-레벨 주석과 다른 자리를 가리키는 것처럼 읽힐 여지 | `use-execution-events.ts` (`handleNodeFailed` payload 타입 선언부) | 여유 있으면 "(AI Agent 자신의 domain output 필드 이름)" 구절 추가 |
| 14 | documentation | PR 설명에 "배너 최초 노출(회귀 아님)" 명시 이행이 PR 미생성으로 대기 중 | `plan/in-progress/system-error-banner-live-ws.md` 체크리스트 | PR 생성 시 본문에 해당 문구 포함 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | XSS 안전, 시크릿 없음, 인증/암호화 변경 없음 — INFO 4건(범위 밖 1건 포함) |
| requirement | NONE | 요구사항 충족 재확인(92/92 GREEN, tsc 클린), CRITICAL/WARNING 4라운드 전부 반영 — INFO 2건 |
| scope | NONE | 스코프 이탈 없음, plan 체크리스트와 diff 1:1 대응 — 발견사항 없음 |
| side_effect | NONE | 죽은 부수효과 경로 복구(의도됨), 시그니처 축소 영향 범위 확인 — INFO 5건 |
| maintainability | NONE | 신규 결함 없음, 기존 INFO 4라운드 연속 유예 유지 |
| testing | **LOW** | `retryable`/`retryAfterSec` 타입 가드 무테스트 신규 WARNING 1건, `details` non-object 무테스트 INFO 1건 |
| documentation | NONE | 신규 테스트 주석 정확·정직, carry-over INFO 2건만 |

## 발견 없는 에이전트

- **scope** — 코드 영향 diff(4파일)가 plan 의 스코프 선언과 정확히 1:1 대응, backend/spec 변경 없음, 무관한 파일/포맷팅 변경 없음.

## 권장 조치사항

1. (WARNING) `handleNodeCompleted`/`handleNodeFailed` 의 `retryable`/`retryAfterSec` 타입 가드에 malformed 타입 fixture(예: `retryable: "true"`, `retryAfterSec: "30"`)를 추가해 안전 fallback 을 고정한다. 가능하면 이 기회에 maintainability 가 지적한 ~20줄 중복 블록을 공유 헬퍼로 추출해 테스트 1건으로 양쪽을 동시에 커버한다.
2. (INFO, 급하지 않음) `details` non-object 케이스(`details: "n/a"`) fixture 를 1번과 함께 추가한다.
3. (INFO, carry-over) PR 생성 시 본문에 "`system_error` 배너가 라이브 WS 경로에서 처음 노출됨(회귀 아님)" 문구를 포함한다.
4. (INFO, 낮은 우선순위) 신규 `||` 좌/우항 가드 테스트 2건, `asRecord` 배열 배제 비대칭 등은 현재 판정(유예/조치 불요) 유지 — 코드 품질에 실질 영향 없음.

## 라우터 결정

- `routing_status=skipped` — 프롬프트가 `routing: skipped` 로 명시. 대신 router_safety 강제 화이트리스트가 적용되어 전체 7개 카테고리 reviewer(`documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`)가 소스 코드 변경(`use-execution-events.ts`, `use-execution-events.test.ts`)을 이유로 전원 강제 실행되었다.
  - **실행**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 전원 forced)
  - **제외**: 없음 (0명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — 전원 결과 확보됨(누락 없음, 재작성 불요).

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |