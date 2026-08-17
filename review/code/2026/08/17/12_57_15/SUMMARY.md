# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 8개 reviewer 전원(강제 지정 7명 + 라우터 선별 1명)이 정상 실행되어 전문을 확보했고(누락·미이행 없음), 남은 것은 전부 비차단 INFO(설계 경계 재확인, 문서 캐비엇 미반영, 테스트 커버리지 갭)뿐이다. 이 diff 는 이미 2라운드(`12_06_12`, `12_33_36`) 코드 리뷰 + 1라운드 consistency-check 를 거쳐 지적된 WARNING·INFO 전부가 해소됐음을 이번 라운드가 실제 소스 재대조로 재확인한 3차 확정 라운드다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안/설계경계 | `isMaskedMarker` 는 값 전체가 마스킹 마커와 **정확 일치**하는 경우만 탐지한다. (a) backend 의 부분-치환 결과(URI userinfo 등)는 잔여로 남아 프리필되지만 자격증명 자체는 이미 서버에서 제거된 뒤라 신규 노출은 아니다. (b) 반대로 마커 리터럴과 우연히 정확 일치하는 정상 기본값도 오탐으로 빈 값 처리된다. 두 경계 모두 2라운드 연속 식별·감수된 의도된 트레이드오프다. | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:371-384`, `codebase/backend/src/shared/utils/sanitize-error-message.ts:47-51` | 현행 유지(비차단). 필요 시 `isMaskedMarker`/`initialValueFor` JSDoc 에 두 방향 경계를 한 줄씩 보강 |
| 2 | 요구사항 | spec §R17 "프리필 왕복" 불릿이 "정확 일치만 탐지" 설계 경계를 서술하지 않아, spec 만 읽으면 가드 범위가 완전한 것으로 오독될 여지가 있다. | `spec/5-system/14-external-interaction-api.md` §R17 | `project-planner` 위임 시 "탐지는 정확 일치 기준이며 부분-치환 결과는 잔여로 남는다" 캐비엇 한 문장 추가 고려(비차단) |
| 3 | 유지보수성/보안 | backend `MASKED_MARKERS`(SoT) ↔ frontend 미러가 두 파일에 수동 복제돼 있고, 이를 자동 대조하는 크로스-스택(jest↔vitest) 계약 테스트가 아직 없다. 이름은 양쪽 정확히 일치(`MASKED_MARKERS`/`isMaskedMarker`)하며 프런트 쪽 절반은 이번 라운드에 리터럴 대조 테스트로 이미 기계화됨. | `codebase/backend/src/shared/utils/sanitize-error-message.ts:95-136`, `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339-373` | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커 유지, 공유 패키지 추출 시 해소 |
| 4 | 요구사항/테스트 | 마스킹 안내 힌트가 `field.defaultValue`(불변 prop) 기준으로 노출돼, 사용자가 필드에 값을 직접 입력해 채운 뒤에도 힌트가 계속 남는다. 영구 표시가 의도인지(원인 설명 지속) 편집-후-소멸이 의도인지 결정된 바 없고, 이를 검증하는 테스트도 없다. | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:473` | 의도(영구 표시 vs 편집-후-소멸) 결정 후 `fireEvent.change` 뒤 힌트 상태를 단언하는 테스트 1건 추가 |
| 5 | 부작용 | 마스킹 마커와 일치하는 `defaultValue` + `required: true` 조합에서, 빈 초기값이 되며 `noValidate` 없는 폼의 네이티브 HTML5 validation 이 `handleSubmit` 호출 전 단계에서 제출 자체를 막는다. PR 목적을 보강하는 부수효과지만 이전 라운드에 명시적으로 다룬 적 없는 상호작용. | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:318,375-384,436` | 조치 불요(정보성, 비차단) |
| 6 | 테스트 | `isMaskedMarker` 의 non-string 입력에 대한 직접 단위 테스트, `select`/`textarea` 타입 커버리지가 없다(기존 트래커 등재, 신규 아님). | `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:371-384` | 트래커 유지, 이번 PR 범위 아님 |
| 7 | 문서화 | 테스트 파일 상단 "검증 범위" JSDoc 목록이 이번 PR 로 추가된 마스킹 왕복 차단 테스트 블록(7건)을 등재하지 않는다. | `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:12-30` | 목록에 "마스킹된 `defaultValue` 프리필 차단(왕복 오염 방지, EIA §R17)" 한 줄 추가 |
| 8 | 사용자가이드동기화 | Form 노드 스키마 문서(`02-nodes/presentation.mdx` / `.en.mdx`)의 `defaultValue` FieldTable 이 이번 변경의 프리필-스킵 신규 동작 캐비엇을 반영하지 않는다. 3라운드 연속 동일 잔여지만, 이번 라운드에 처음으로 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 정식 등재돼 더 이상 미기록 누락이 아니다. `run-results.mdx`/`.en.mdx`(매트릭스 타겟 자체)는 이미 갱신 완료. | `codebase/frontend/src/content/docs/02-nodes/presentation.mdx`, `.en.mdx` | 여력 시 "자격증명으로 판별된 기본값은 프리필되지 않는다" 한 문장 추가(재량, 트래커로 추적 중이라 이번 PR 필수 아님) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 정확 일치 탐지 경계(부분-치환 잔여, 신규 노출 아님) + 마커 미러 계약 테스트 부재. 인젝션/시크릿/인증우회 없음 |
| requirement | LOW | spec §R17 이 정확-일치 경계 미서술 + 힌트가 defaultValue 기준으로 영속 노출 |
| scope | NONE | 이번 라운드 변경 5개 파일 전부 직전 라운드 리뷰 지적 1:1 대응, 스코프 이탈 없음 |
| side_effect | LOW | 마커 리터럴 일치 정상값 오탐 + required 필드 네이티브 검증 차단(부수 효과, 비차단) |
| maintainability | NONE | 직전 WARNING·INFO 전부 반영 재확인, 신규 결함 없음. 마커 미러 계약 테스트 부재만 참고 |
| testing | LOW | 26/26 GREEN 직접 재현. 힌트 영속 노출에 대한 테스트 부재, 기존 트래커 항목(non-string/select/textarea) 재확인 |
| documentation | NONE | 직전 WARNING(CHANGELOG 죽은 포인터) 해소 재확인. 테스트 파일 상단 커버리지 목록 미갱신만 INFO |
| user_guide_sync | LOW | `presentation.mdx` 캐비엇 미반영(3라운드 잔여, 이번에 트래커 정식 등재). 매트릭스 확정 타겟은 충족 |

## 발견 없는 에이전트

- scope — 이번 라운드 변경분(5개 파일)이 모두 직전 라운드 리뷰 지적에 1:1 대응하며, 요청 밖 리팩토링·무관한 파일 수정·의미 없는 포맷팅 변경이 발견되지 않았다(순수 긍정 확인만 존재).

## 권장 조치사항

1. (선택) `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 후속 작업 시 `02-nodes/presentation.mdx`/`.en.mdx` 의 `defaultValue` FieldTable 에 프리필-스킵 캐비엇 한 문장 추가 (# 8).
2. (선택) 마스킹 힌트의 "영구 표시 vs 편집-후-소멸" 의도를 결정하고, 결정에 맞는 테스트 1건 추가 (# 4).
3. (선택) 테스트 파일 상단 "검증 범위" JSDoc 목록에 신규 마스킹 왕복 차단 블록 한 줄 추가 (# 7).
4. 위 항목 모두 비차단이며 이번 PR 의 push 를 막지 않는다. 나머지(#1, #3, #5, #6)는 기존 트래커·JSDoc 으로 이미 관리 중이므로 추가 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 미이행 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(폼 프리필 가드, 순수 함수·정적 문자열 비교)와 무관 |
  | architecture | router 판단상 아키텍처 변경 없음(단일 컴포넌트 내부 로직 확장) |
  | dependency | router 판단상 의존성 변경 없음 |
  | database | router 판단상 DB 스키마/쿼리 변경 없음 |
  | concurrency | router 판단상 동시성 로직 변경 없음(순수 클라이언트 렌더링) |
  | api_contract | router 판단상 API 계약 변경 없음(내부 컴포넌트 prop/렌더링만 변경) |