# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. 실질 WARNING 은 `CHANGELOG.md` 의 자기-모순적(존재하지 않는 항목을 가리키는) 참조 1건뿐이며 기능·보안·데이터 무결성에는 영향 없음. forced(router_safety) 7개 reviewer(documentation/maintainability/requirement/scope/security/side_effect/testing) 전원 결과 확보 확인됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation / Requirement | `CHANGELOG.md` 가 "프런트 마커 가드는 **아래 항목에서** 폼 프리필에 먼저 구현됐다"고 서술하지만, 그 "아래 항목"에 해당하는 CHANGELOG 절이 파일 어디에도 존재하지 않는다(`isMaskedMarker`/`DynamicFormUI` 문자열 grep 결과 이 문장 자신 외 0건). 게다가 이 파일은 "최신이 위로 쌓인다"는 관례를 line 24 에서 스스로 명시하는데, 이번 PR(최신 변경)의 자기 설명이라면 "아래"가 아니라 "위"에 있어야 앞뒤가 맞아 방향도 틀렸다. 직전 라운드(`12_06_12`) WARNING #4("CHANGELOG stale") fix 시도가 새로운 형태의 불일치를 만든 것으로, 처분이 실제로 완결되지 않았다. | `CHANGELOG.md:38-39` | 이 문단 위에 새 `## Unreleased` 섹션을 추가해 `isMaskedMarker`/`initialValueFor` 프리필 가드·힌트·닫힌 조건을 서술하고 이 문단이 그 "위 항목"을 가리키도록 고치거나, 아예 자기참조("이 커밋이 폼 프리필에 먼저 구현했다")로 바꾼다. 이 마스킹 시리즈의 자매 커밋(#1177/#1179/#1180)이 모두 자기 항목을 가진 선례를 따르는 편이 저장소 관행과 더 일치. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Side Effect | backend `sanitize-error-message.ts` 의 마스킹 마커 상수(SoT)와 frontend `dynamic-form-ui.tsx` 의 `MASKED_MARKERS`(미러)가 수동 복제 구조이고 값을 비교하는 자동 계약 테스트가 없다 — 한쪽만 바뀌면 프리필 가드가 그 신규 마커에 대해 조용히 fail-open 한다. 이번 라운드에서 명명 불일치(직전 WARNING)는 해소돼 이름은 일치. | `codebase/backend/src/shared/utils/sanitize-error-message.ts:96-100,128-136` ↔ `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339-373` | 비차단. 여력 되면 두 상수 집합을 비교하는 경량 계약 테스트 추가. |
| 2 | Requirement / Maintainability / Testing | 테스트 fixture(`MARKERS` 배열)가 마스킹 마커 리터럴을 여전히 하드코딩 — 이번 라운드에서 구현 상수가 `export const MASKED_MARKERS` 로 승격되어 이제 `import` 로 재사용 가능해졌는데도 반영되지 않았다(3개 reviewer 가 독립적으로 동일 지적). 값 자체는 fail-safe 방향(구현이 마커를 늘려도 거짓 통과는 아니고 커버리지만 조용히 빠짐). | `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:598` vs `dynamic-form-ui.tsx:339` | `MARKERS` 리터럴을 `[...MASKED_MARKERS]` (import 경유)로 교체. 우선순위 낮음. |
| 3 | Security | URI-userinfo 처럼 backend 에서 **부분-매치**로 마스킹된 값(`scheme://***@host`)은 정확 일치 기반 `isMaskedMarker` 가드를 통과해 그대로 프리필된다. 다만 자격증명 부분 자체는 이미 서버에서 제거된 뒤라 신규 노출은 아니고, 이 경계는 JSDoc·캐너리 테스트·직전 라운드 RESOLUTION 에서 이미 의도적으로 고정된 트레이드오프다(포함-매치로 넓히면 정상 값까지 지워지는 오탐 비용이 더 큼). | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:371` (`isMaskedMarker`) | 현행 유지. `token=` 등 키워드 패턴 확장 시 이 갭도 함께 넓어짐을 계속 인지. |
| 4 | Testing | 신규 `export function isMaskedMarker` 에 대한 직접 단위 테스트가 없다 — 컴포넌트 렌더를 통한 간접 테스트만 존재, `number`/`boolean`/`null` 등 non-string 입력 경로가 전혀 행사되지 않음. 구현이 `typeof v === "string"` 가드로 단순해 현재 위험은 낮지만, 공개 유틸로 승격된 만큼 향후 판별 로직 진화 시 회귀 방어가 없다. | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:371-373` | 필수 아님. `isMaskedMarker(123)`/`(null)`/`(undefined)`/`(true)` 순수 함수 단위 테스트 4~5줄 추가 고려. |
| 5 | Testing | 신규 가드 회귀 테스트가 전부 `field.type: "text"` 로만 검증됨 — checkbox/select/number 등 다른 필드 타입에서 마스킹 마커 `defaultValue` 케이스는 미검증. 가드 로직 자체는 필드 타입을 분기하지 않아 실동작엔 영향 없음. | `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:597-724` | 필수 아님. `type: "select"`/`"textarea"` 케이스 1건 `it.each` 추가해 타입-불문 가드임을 고정. |
| 6 | User Guide Sync | Form 노드 스키마 문서(`02-nodes/presentation.mdx`/`.en.mdx`)의 `defaultValue` FieldTable 행에 이번 PR 이 도입한 "마스킹 마커와 일치하면 프리필 스킵" 신규 UX 가 캐비엇으로 반영되지 않음. `05-run-and-debug/` 타겟(매트릭스 요구)은 이미 갱신됐고 런타임 힌트 문구가 원인을 그 자리에서 설명하므로 비차단. 직전 라운드부터 지속된 잔여(2라운드 연속 non-blocking INFO). | `codebase/frontend/src/content/docs/02-nodes/presentation.mdx:198`, `.en.mdx` | 여력 되면 "자격증명으로 판별된 기본값은 프리필되지 않고 직접 입력을 안내해요" 한 문장 추가. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 부분-매치 프리필 미탐지(의도적 경계, INFO) · backend/frontend 마커 미러 drift 위험(INFO) · 신규 보안 결함 없음(긍정 확인) |
| requirement | LOW | CHANGELOG "아래 항목" 죽은 포인터(WARNING, documentation 과 중복 지적) · 테스트 fixture 마커 리터럴 미교체(INFO). 핵심 기능·spec fidelity 는 emit 경로·§R17 과 line-level 일치 확인 |
| scope | NONE | 전 변경이 plan 체크리스트와 1:1 대응. spec 3파일·`sanitize-error-message.ts` 재배치·review 산출물은 모두 사전 승인 경로(impl-prep WARNING 정정) 확인됨. 실질 지적 없음 |
| side_effect | LOW | 신규 export(`MASKED_MARKERS`/`isMaskedMarker`) 는 순수 함수, 부작용 없음 · `onSubmit` payload 변화는 PR 목적 자체(회귀 테스트로 고정) · backend/frontend 마커 미러 drift(INFO, security 와 중복) |
| maintainability | NONE | 직전 라운드 WARNING 2건(muted-text 클래스, 명명 불일치) 해소 확인 · 테스트 fixture 마커 리터럴 미교체(INFO, requirement/testing 과 중복) |
| testing | LOW | 직전 라운드 testing WARNING 2건을 뮤테이션 독립 재현으로 해소 검증(14/2/4 RED 재확인) · `isMaskedMarker` non-string 입력 단위 테스트 부재(INFO) · 가드 테스트가 text 필드만 커버(INFO) |
| documentation | LOW | CHANGELOG "아래 항목" 죽은 포인터(WARNING) · 마커 리네임·spec 3파일 정합은 전수 grep 으로 긍정 확인 |
| user_guide_sync | LOW | `presentation.mdx`/`.en.mdx` 의 `defaultValue` 캐비엇 미반영(INFO, 2라운드 연속 잔여, 비차단) · `run-and-debug`/i18n 타겟은 충족 확인 |

## 발견 없는 에이전트

없음 (전 8개 reviewer 가 최소 1건 이상의 INFO/WARNING 을 보고했으나, 실질 조치 필요 CRITICAL 은 0건).

## 권장 조치사항

1. `CHANGELOG.md:38-39` 의 "아래 항목에서 폼 프리필에 먼저 구현됐다" 문구를 자기-완결적 서술로 수정하거나, 이 절 위에 새 `## Unreleased` 항목을 추가해 실제로 가리킬 대상을 만든다 (WARNING #1, requirement+documentation 중복 지적 — 이 시리즈의 자매 커밋 3건이 모두 자기 항목을 가진 선례와 맞춤).
2. (저비용, 선택) 테스트 fixture `MARKERS` 리터럴을 `export const MASKED_MARKERS` import 로 교체해 삼중 복제를 이중으로 줄인다 (INFO #2, 3개 reviewer 중복 지적).
3. (선택) `isMaskedMarker` non-string 입력에 대한 직접 단위 테스트, 그리고 text 이외 필드 타입에 대한 가드 회귀 테스트 1건 추가 (INFO #4, #5).
4. (선택, 백로그) `02-nodes/presentation.mdx`/`.en.mdx` 의 `defaultValue` FieldTable 에 마스킹 프리필 스킵 캐비엇 한 문장 추가 (INFO #6, 2라운드 연속 잔여).
5. backend/frontend 마커 상수 미러에 대한 경량 계약 테스트 추가는 이 시리즈 전반의 반복 INFO — 별도 저비용 후속 작업으로 트래킹 권장 (INFO #1).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보 확인됨(forced 미이행 없음)
  - **제외**: 아래 표 (6명, router 판단 — 본 prompt 에 개별 사유 텍스트 미포함)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 (diff 특성상 해당 영역 무관으로 제외 추정, 상세 사유 미제공) |
  | architecture | router 판단 (상세 사유 미제공) |
  | dependency | router 판단 (상세 사유 미제공) |
  | database | router 판단 (상세 사유 미제공) |
  | concurrency | router 판단 (상세 사유 미제공) |
  | api_contract | router 판단 (상세 사유 미제공) |