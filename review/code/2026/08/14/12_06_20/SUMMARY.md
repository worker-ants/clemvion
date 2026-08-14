# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 신규 WARNING 2건 모두 이번 라운드 마지막 커밋(`b49ee4310`)이 새로 추가한 테스트 JSDoc 한 곳의 서술 정확성 문제(동작 결함 아님)로, maintainability·testing·documentation 3개 reviewer 가 동일 지점을 독립적으로 지적했다. forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/테스트 | 신규 `it.each` 깊이 경계 테스트의 JSDoc 이 "`stripDeep` 은 `depth >= MAX_SANITIZE_DEPTH`, 형제는 `depth >` — 연산자가 다르다"고 **현재형**으로 서술하지만, **같은 커밋(`b49ee4310`)**이 `stripDeep` 의 연산자를 `>=`→`>` 로 이미 통일해 두 함수는 지금 동일하다. 프로덕션 코드 인라인 주석(`websocket.service.ts:388-392`)은 과거형("종전 `>=` 는…")으로 정확히 정정했으나, 이 테스트 JSDoc 만 정정을 반영하지 못한 채 stale 서술을 안고 도입됐다. 직전 라운드(`10_32_27` testing W7)에서 잡아 고친 것과 동일 클래스 결함이 바로 다음 커밋에서 재발한 사례. (maintainability, testing, documentation 3개 reviewer 독립 지적) | `codebase/backend/src/modules/websocket/websocket.service.spec.ts:798-800` (실제 코드: `websocket.service.ts:393`) | "종전엔 `stripDeep` 이 `depth >= …`, 형제는 `depth > …` 로 달랐다(이 커밋에서 `>` 로 통일)"처럼 과거형+정정 사실을 명시하거나 통일 이후 시점 서술로 재작성 |
| 2 | 유지보수성 | 신규 `it.each([0, 5, 8, 9, 10, 11, 12])` 의 깊이 값이 `MAX_SANITIZE_DEPTH` 상수가 아니라 리터럴로 하드코딩돼 있다. 같은 파일 앞부분(`:203`)의 자매 depth 경계 테스트는 "상수 변경 시 자동 추적되도록 매직넘버 대신 import" 관례를 명시하며 `MAX_SANITIZE_DEPTH + 2` 처럼 상수 상대값을 쓰는데, 이번 테스트는 그 관례를 어겼다. 지금은 상수값(10)과 리터럴이 우연히 일치하지만, 상수가 바뀌면 테스트는 계속 통과하면서 조용히 경계 판별력을 잃는다. | `codebase/backend/src/modules/websocket/websocket.service.spec.ts:819` (대조: `:203`, `:205`) | `[0, MAX_SANITIZE_DEPTH-5, MAX_SANITIZE_DEPTH-2, MAX_SANITIZE_DEPTH-1, MAX_SANITIZE_DEPTH, MAX_SANITIZE_DEPTH+1, MAX_SANITIZE_DEPTH+2]` 처럼 상수 상대값으로 변경 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `stripDeep` 의 깊이 상한(`MAX_SANITIZE_DEPTH`) 방어는 함수 자신이 아니라 "sanitize 가 항상 먼저 실행된다"는 호출 순서에 의존하는 설계다. 현재는 실 파이프라인 depth sweep 테스트로 안전이 검증됐지만, 향후 sanitize 를 거치지 않은 원본 payload 에 `stripDeep`/`stripExternalOnlyFields` 가 재사용되는 새 호출부가 생기면 이 보호가 조용히 사라진다(이미 JSDoc 에 명시됨). | `websocket.service.ts:393` vs `:251` | 조치 불요. 신규 호출부 추가 시 재검토 |
| 2 | 보안 | 이미 전송 완료된 raw 프롬프트/대화이력 데이터에 대한 사후 대응(외부 통합자 통지 여부 등)이 아직 "운영 판단 필요" 로 plan 에 열려 있다. 코드 결함은 아니며 이 PR 승인과 별개 사안. | `plan/in-progress/spec-draft-eia-62-waiting-payload.md`, `CHANGELOG.md:23-24` | 코드 조치 불요. 운영 측 정책 판단 대기 |
| 3 | 성능 | `stripDeep` 객체 분기의 `Object.entries(obj)` 호출은 strip 대상 유무와 무관하게 **모든 object 노드**에서 배열을 새로 할당한다. JSDoc "제거가 실제로 일어나기 전에는 아무것도 할당하지 않는다"는 문구는 정확히는 반환 객체(clone)에만 해당한다. | `websocket.service.ts:408` (JSDoc: `:343`) | 조치 불요. JSDoc 문구를 "반환 identity 는 할당 없이 보존된다" 정도로 좁히면 오독 방지 |
| 4 | SPEC-DRIFT | [SPEC-DRIFT] spec 본문의 `llmCalls` strip 선언이 `ai_message`/§6.5 문맥에만 텍스트로 고정돼 있고, 실제 수정 대상이었던 `waiting_for_input`/§6.2 는 spec 어디에도 명시되지 않는다. 코드는 이름 기반 strip(`EXTERNAL_STRIPPED_FIELDS`)이라 이벤트 종류 무관하게 이미 이 갭을 안전하게 덮고 있다 — spec 이 코드보다 좁게 문서화된 상태이며, 코드가 spec 을 어긴 게 아니라 spec 명문화가 코드를 못 따라간 상태다. | `spec/5-system/6-websocket-protocol.md:519` vs `websocket.service.ts:293-301` | 이미 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` "(7) llmCalls strip SoT 가 실제 누출 표면을 안 덮는다" 항목으로 planner 인계 등재됨. 추가 조치 불요(확인 기록용) |
| 5 | 부작용 | `stripDeep` 도입으로 strip 판정이 "위치"에서 "이름"으로 바뀌며, `emitExecutionEvent`/`emitNodeEvent` 를 타는 **모든** 이벤트 타입의 외부 fanout 계약이 함께 넓어졌다(의도된 트레이드오프, JSDoc 명시). 향후 어떤 노드 필드가 우연히 `llmCalls` 라는 이름을 재사용하면 자동으로 외부 수신자에게서 사라진다. | `websocket.service.ts:303-317`, `:387-427` | 조치 불요(이전 라운드부터 추적된 collateral 없음 확인 완료) |
| 6 | 테스트 | `it.each` 깊이 스윕 표본이 판별력 전환 지점(depth 7→8)에 가장 가까운 `7`을 포함하지 않는다(표본이 `{0,5}`/`{8~12}`로 갈라짐). 현재 서술·결론은 별도 실측으로 검증돼 정확하다. | `websocket.service.spec.ts:819` | 우선순위 낮음. 향후 배열 수정 시 `7` 추가 권장 |
| 7 | 테스트 | 이번 PR 이 실제로 고친 "중첩 누출" 케이스 회귀 테스트가 `emitExecutionEvent` 경로에만 추가됐고, `emitNodeEvent` 쪽은 여전히 top-level-only 케이스만 검증한다(두 경로가 같은 `stripDeep` 을 공유하므로 기능적으로는 커버되나, 파일 자체 증명력은 비대칭). | `websocket.service.spec.ts:856-879` vs `:656-717` | 우선순위 낮음. 향후 node 이벤트가 중첩 shape 을 갖게 되면 짝지어 추가 |
| 8 | 유지보수성 | 경계 연산자 통일 서사가 함수 JSDoc·인라인 주석·테스트 JSDoc 세 곳에 중복 서술돼, 한 곳만 갱신되고 나머지가 stale 로 남는 사고(WARNING 1 이 실례)가 반복될 표면이 넓다. | `websocket.service.ts:360`, `:388-392`; `websocket.service.spec.ts:796-817` | 필수 아님. 다음에 이 로직을 건드릴 때 세 곳 함께 갱신 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `__proto__` 오염 수정·깊이 경계 통일 실행 검증 완료. 신규 결함 없음, 사후대응은 운영 판단 대기 |
| performance | LOW | 이전 라운드 WARNING(지연 할당·깊이 상한·경계연산자) 전부 해소 확인. `Object.entries` 할당 관련 INFO 1건 |
| requirement | NONE | 핵심 요구사항(모든 깊이의 `llmCalls` strip) 충족을 뮤테이션 재현으로 독립 검증. spec 커버리지 갭은 SPEC-DRIFT 로 이미 추적됨 |
| scope | NONE | 실질 델타는 커밋 1개, 직전 라운드 처방에 정확히 한정. 스코프 이탈 없음 |
| side_effect | LOW | 입력 mutate 없음, 전역상태/시그니처/네트워크 영향 없음. 이벤트 계약 확장은 의도된 트레이드오프 |
| maintainability | LOW | 신규 테스트에 매직넘버 하드코딩(WARNING) + 테스트 JSDoc stale 서술(WARNING) 2건 |
| testing | LOW | 40/40 통과, 뮤테이션 재현으로 판별력 검증. 테스트 JSDoc stale 서술(WARNING) 1건 + 표본/대칭성 INFO 2건 |
| documentation | LOW | CHANGELOG·JSDoc·plan 체크리스트 대부분 동기화 확인. 마지막 커밋 테스트 JSDoc stale 서술(WARNING) 1건 |

## 발견 없는 에이전트

없음 (전원 최소 1건 이상의 INFO/WARNING 기록, Critical 은 전원 0건).

## 권장 조치사항

1. `websocket.service.spec.ts:798-800` 테스트 JSDoc 을 과거형으로 정정해 "경계 연산자가 다르다"는 stale 서술을 제거한다 (WARNING 1, 3개 reviewer 중복 지적).
2. `websocket.service.spec.ts:819` 의 `it.each` 깊이 배열을 `MAX_SANITIZE_DEPTH` 상대값으로 바꿔 상수 변경 시 판별력이 조용히 소실되지 않게 한다 (WARNING 2).
3. (낮은 우선순위) spec 본문에 `waiting_for_input`/§6.2 의 `llmCalls` strip 적용을 명문화 — 이미 `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 에 planner 인계 항목으로 등재돼 있으므로 별도 이번 PR 조치는 불요.
4. (낮은 우선순위) `it.each` 표본에 depth `7`을 추가하고, `emitNodeEvent` 쪽에도 nested 회귀 테스트를 대칭적으로 추가하는 것을 향후 유지보수 시 고려.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음)
  - **제외**: 6명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | router 판단상 이번 diff 와 낮은 관련성 (내부 private 함수 리팩터, 아키텍처 변경 없음) |
  | dependency | 신규/변경 외부 의존성 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | api_contract | 공개 API 시그니처 변경 없음 (module-private 함수만 변경) |
  | user_guide_sync | 사용자 가이드 대상 UI/기능 변경 없음 |