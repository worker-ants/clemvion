# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 발견 없음. 순수 위생(hygiene) 리팩터로 마스킹 로직·allowlist 키 목록·인증 가드 로직은 바이트 단위로 보존됨(security 실측). 실질 결함은 JSDoc 이 리팩터링 중 원래 대상에서 떨어져 나가 무관한 코드에 붙은 두 건(WARNING)뿐. forced whitelist(7명) 전원 결과 확보 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서 정합성 | `swagger-probe.ts` 의 `schemasOf` 선언 앞에 JSDoc 블록 3개가 연속으로 쌓였고, 그중 가운데 블록은 실제로는 `schemaOf`(단수) 함수를 설명하는 내용이다. 결과적으로 (a) `schemasOf` 위엔 사실상 동일한 문서가 중복되고 (b) `schemaOf` 함수(95줄)는 자신을 설명하는 JSDoc 을 완전히 잃었다. maintainability·documentation 양쪽이 독립적으로 WARNING 으로 지적(requirement·testing 은 같은 결함을 INFO 로 관측). | `codebase/backend/src/shared/testing/swagger-probe.ts:58-75`(3중 JSDoc), `:95`(`schemaOf` 선언, JSDoc 없음) | 63-70번째 줄 블록(`schemaOf` 설명)을 95번째 줄 `schemaOf` 선언 위로 옮기고, 58-62/71-75 의 중복 `schemasOf` 설명은 하나만 남긴다. |
| 2 | 문서 정합성 | `websocket.service.spec.ts` 리팩터 과정에서 두 `llmCalls strip` 테스트를 파일 앞쪽으로 옮기면서, 원래 그 자리에 있던 JSDoc(`_retryState`/`#1205`/allowlist 근거를 담은 설명)을 옮기지 않고 그대로 두어, 지금은 이동해 온 두 llmCalls-strip 테스트를 설명하는 것처럼 보이지만 실제로는 새로 분리된 `nodeOutput allowlist · fanout 파이프라인 불변식` describe 블록의 캐너리 테스트를 설명하려던 글이다. 이 PR 자체가 "주석-코드 일치"를 핵심 동기로 삼는 만큼 같은 성격의 새 괴리가 생긴 것은 의미가 있다. | `codebase/backend/src/modules/websocket/websocket.service.spec.ts:751-761`(JSDoc), `:762`, `:777`(엉뚱하게 설명 대상이 된 두 테스트), `:812`(실제 대상이어야 할 캐너리) | JSDoc(`:751-761`)을 `describe('nodeOutput allowlist · fanout 파이프라인 불변식', ...)` 블록의 캐너리 테스트(`:812` 근처) 위로 옮기거나, 이동된 두 테스트를 설명하도록 다시 쓴다. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 커버리지 | `buildSwaggerDocument` JSDoc 이 명시하는 핵심 보장("createDocument 가 던져도 finally 로 app.close() 실행")을 직접 검증하는 회귀 테스트가 없다. | `codebase/backend/src/shared/testing/swagger-probe.ts:36-44` (JSDoc) / `swagger-probe.spec.ts` (케이스 부재) | 순환 참조 등으로 던지는 프로브 컨트롤러를 세워 `app.close()` 호출을 spy 로 확인하는 케이스 추가(우선순위 낮음). |
| 2 | 문서 정확도 | `buildSwaggerDocument` JSDoc 의 "네 스펙 중 둘은 `{ controllers }`, 둘은 `{ imports }`" 서술이 실측(3:1)과 다르다. | `codebase/backend/src/shared/testing/swagger-probe.ts:41-43` | "셋은 `controllers:`, 하나는 `imports:`" 로 정정. |
| 3 | 문서 staleness | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 미완료(collapsed `<details>`) 항목 문구가 이번 PR 이 이동시킨 구 경로(`shared/utils/node-output-allowlist.ts`)를 여전히 안내한다. 실행에는 영향 없음(착수 시 import 에러로 즉시 드러남). | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — 미완료 항목 `<details>` 내 "재사용할 헬퍼는 이미 있다" 문구 | 착수 시점에 정정하거나 지금 `nodes/core/node-output-allowlist.ts` 로 한 줄만 고친다. |
| 4 | 스코프 | 서로 독립적인 5개 위생 항목(Swagger 헬퍼 추출·모듈 재배치·리네임·JSDoc 오기 정정·테스트 describe 재배치)이 한 커밋에 번들됐다. 다만 이는 plan 에 사전 등재된 명시적 관례("이 파일을 다른 이유로 여는 순간 함께 처리")이며 각 항목이 실측(테스트 수 63→63 불변 등)과 함께 완료 처리됨. | 커밋 `044a2e19e` 전체 (20개 파일) | 조치 불요 — 승인 시 20개 파일 전체가 아니라 plan 체크박스 5개 단위로 완결성 확인 권장. |
| 5 | 가독성 | `node-output-allowlist.ts` 의 컴파일타임 결속 검사가 조건부 타입(`extends … ? true : never`)을 값 타입 자리에 쓰는 다소 생소한 TS 관용구다. 주석으로 의도는 충분히 설명돼 있어 기능 문제는 아님. | `codebase/backend/src/nodes/core/node-output-allowlist.ts:106-114` | (선택) 검색 가능한 키워드(예: "conditional-type exhaustiveness check")를 주석에 추가. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | rename/이동 전수 검증(구 이름·구 경로 잔존 0), allowlist 키 목록 완전 동일, devDependency dist 유출 차단(tsconfig exclude) 확인. 신규 위험 없음. |
| requirement | LOW | websocket.service.spec.ts JSDoc 오귀속(WARNING) 발견. swagger-probe.ts 고아 JSDoc 중복, "2:2 vs 3:1" 서술 오차(INFO). 그 외 spec fidelity(EIA-AU-09 제거 등) 전부 정합 확인. |
| scope | LOW | 5개 독립 위생 항목이 한 커밋에 번들 — plan 사전 등재된 의도된 관례로 판정, 조치 불요(INFO). 드라이브바이 변경 없음. |
| side_effect | LOW | rename/이동 전수 grep 실측으로 부작용 없음 확인. 유일 잔여는 plan 미완료 항목의 구 경로 안내(INFO), 기능 영향 없음. |
| maintainability | LOW | swagger-probe.ts 3중 JSDoc 오귀속(WARNING). node-output-allowlist.ts 조건부 타입 관용구 해독 비용(INFO). 그 외 리네임/추출 전반 가독성 양호. |
| testing | LOW | 리네임/이동 grep 전수 0건, 테스트 수 63→63 보존 확인. swagger-probe.ts 고아 JSDoc(INFO), buildSwaggerDocument try/finally 미검증(INFO). |
| documentation | LOW | swagger-probe.ts 3중 JSDoc/schemaOf 무설명(WARNING) — 이 파일의 존재 목적("명확한 에러 메시지")과 직결된 결함으로 지목. 그 외 문서 동기화 전반 모범적. |

## 발견 없는 에이전트

(없음 — 전 에이전트가 최소 INFO 이상 1건 이상 보고)

## 권장 조치사항

1. `swagger-probe.ts:58-75` 의 3중/오귀속 JSDoc 을 정리 — `schemaOf`(95줄) 설명을 제자리로 옮기고 `schemasOf` 위 중복 블록 하나만 남긴다. (maintainability·documentation WARNING, requirement·testing INFO 로 4개 에이전트가 독립적으로 지목)
2. `websocket.service.spec.ts:751-761` 의 JSDoc 을 실제 대상인 `nodeOutput allowlist · fanout 파이프라인 불변식` describe 블록(`:812` 근처)의 캐너리 테스트 위로 이동.
3. (선택, 낮은 우선순위) `swagger-probe.ts` JSDoc 의 "둘:둘" 서술을 실측(3:1)으로 정정, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 미완료 항목의 구 경로 문구 정정, `buildSwaggerDocument` try/finally 회귀 테스트 추가.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. prompt 상 `routing: skipped`, forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원 실행 및 결과 확보됨. 제외된 reviewer 없음.
