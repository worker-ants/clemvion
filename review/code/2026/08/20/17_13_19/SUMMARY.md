# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 없음. WARNING 1건(테스트 자매 표면 간 단언 강도 비대칭). 나머지는 전부 기지(旣知)·트래커 등재·조치 불요로 판정된 INFO 뿐이다. forced 7개 reviewer 전원 결과 확보됨(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `①`(`findById`)의 `inputData` 캐너리는 이번 diff 에서 "유출 문자열 부재"(음성) + "마스킹 마커 존재"(양성) 쌍으로 강화됐지만, 같은 diff 가 같은 방향으로 뒤집는 자매 표면 `②`(`findByWorkflow`)·`⑧`(`getChain`)·`⑧-b`(`stop`)는 음성 단언(`.not.toContain('admin:pw')`)만 남아 마스킹 함수 자체가 배선 실수로 다른 값(`null`/`{}`/필드 누락)을 내도 계속 GREEN일 수 있다 | `codebase/backend/src/modules/executions/executions.service.spec.ts:1178`(②), `:1415`(⑧), `:1443`(⑧-b) — 대조군 `:1160-1161`(①, 이미 양성 단언 보유) | ②·⑧·⑧-b 세 자리에 ①과 동일하게 `.toContain('***')`(또는 `JSON.stringify` 기준 동등 양성 단언)를 나란히 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 재제출 오염 방지가 클라이언트 가드에만 있고, 서버(`inputOverride`)는 마스킹 마커 리터럴(`***`/`[REDACTED]`/`[REDACTED_DEPTH]`)을 값으로 그대로 수용한다 — API 직접 호출로 프런트 가드 우회 가능 | `codebase/backend/src/modules/executions/executions.service.ts`(re-run `resolveTriggerParameters` 호출부, 480~505행대); 대조: `codebase/frontend/src/components/executions/rerun-modal.tsx:368-375`, `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`(107~117행대) | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:322` 트래커대로 서버측에도 동일 판정을 얕게 추가해 마커 리터럴 값을 거부(이번 PR 스코프 아님, 이미 defer 확정) |
| 2 | side_effect | `Execution.inputData` REST 응답이 raw → 마스킹으로 바뀌는 콘텐츠 계약 변경 — 저장소 내부 소비자는 영향 없음을 확인했으나, 저장소 밖 API 직접 소비자가 있다면 영향 가능 | `codebase/backend/src/modules/executions/executions.service.ts`(`toResponseExecution`/`toExecutionDto`) | 조치 불요(이미 `review/code/2026/08/20/14_08_45/RESOLUTION.md` 트래커 #5 등재·defer 확정, spec §R17 이 요구조건으로 명시) |
| 3 | maintainability | `touchedMaskedKeys` 는 실제로 "마스킹 여부 무관하게 이번 세션에 편집한 모든 키" 집합인데 이름은 "이미 마스킹된 키만 필터링해 담는다"로 오독되기 쉽다 | `codebase/frontend/src/components/executions/rerun-modal.tsx:238`(선언), `:308-313`(갱신), `:372`(소비) | `touchedKeys` 로 개명하거나, 선언부에 "`maskedKeys` 와의 교집합만 의미가 있다" 주석 추가 |
| 4 | maintainability | "2026-08-20 카브아웃 폐지" 배경 서사가 단일 SoT 앵커(`MASKED_INPUT_DATA_REASON`) 폐기 이후 6개 이상 파일에 근접 중복 서술됨 — 다음 정책 변경 시 갱신 지점 다수 | `CHANGELOG.md:3-33`, `executions.service.ts` 여러 JSDoc, `execution-response.dto.ts:49-60,174-181`, `background-run-response.dto.ts:49-51`, `background-runs.service.ts:300-304`, `executions.service.spec.ts` describe JSDoc 여러 곳 | (선택) `toResponseExecution` 의 마스킹 표를 유일 SoT 로 삼고 나머지는 "SoT: 표 참조"로 축약 |
| 5 | documentation | plan 제목("소비처 2곳")과 CHANGELOG 제목("소비처 3곳")이 "소비처 개수"를 다른 기준(신규 vs 전체)으로 세어 나란히 보면 어긋나 보임 — 각자 본문 내적으로는 일관 | `plan/in-progress/eia-inputdata-marker-guard.md`(frontmatter title) vs `CHANGELOG.md:3` | 이전 라운드(`14_44_08`)가 이미 조치 불요로 판정 — 유지해도 무방. 굳이 정리하려면 plan 제목에 한정어 추가 |
| 6 | testing | `masked-markers.ts` 깊이 상한 경계 테스트가 object 중첩만 만들고 array 분기(`value.some((v) => scanForMarker(v, depth + 1))`)의 `depth + 1` 누락 뮤테이션은 못 잡음 | `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts:78-90` | array 경로에도 object 와 대칭인 깊이 경계 테스트 추가(낮은 우선순위) |
| 7 | testing | `rerun-modal.tsx` 의 `touchedMaskedKeys` 리셋(`useEffect`, `:248`)이 "필드를 건드린 뒤 모달을 닫았다 다시 여는" 재오픈 시나리오를 직접 행사하는 캐너리가 없음(패턴 일관성상 회귀 위험은 낮음) | `codebase/frontend/src/components/executions/rerun-modal.tsx:248` | 신설 상태이므로 재오픈 캐너리 추가 시 향후 이 effect 분리 리팩터에 유용 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 서버측 `inputOverride` 마커 리터럴 미거부(클라이언트 가드만 존재, 이미 defer된 기지 사안). 그 외 인젝션·시크릿·인가 우회·XSS·프로토타입 오염 없음 |
| requirement | NONE | 이전 8라운드 지적 전항목 반영 확인. 3조건 차단 판정·깊이 상한·spec 7개 문서 정합 재검증, 신규 발견 없음 |
| scope | NONE | 211개 파일 전부가 단일 결정의 직접 산물이거나 규약상 필수 감사 기록(review/**, plan/**). 무관한 리팩터·drive-by 수정 없음 |
| side_effect | LOW | `Execution.inputData` 응답 시맨틱 반전(외부 소비자 영향 가능, 이미 트래커 defer). 전역 상태·FS·env·네트워크 부작용 없음 |
| maintainability | LOW | 상태 변수 이름 정밀도(`touchedMaskedKeys`), 정책 배경 서사 근접 중복 — 둘 다 INFO. 마커 판별 유틸 승격은 명확한 구조 개선 |
| testing | LOW | 자매 표면 간 단언 강도 비대칭(WARNING 1건, 이번 diff 자신이 만든 신규 결함). 핵심 3소비처·3표면 캐너리는 촘촘함 |
| documentation | NONE | 이전 라운드 CRITICAL/WARNING 항목 전부 해소 재확인. plan/CHANGELOG 제목 개수 표기 차이만 잔존(기지, 조치 불요) |
| user_guide_sync | NONE | 매트릭스 3개 trigger(run-debug-flow-change/new-ui-string/backend-api-change) 전부 동일 커밋에서 동반 갱신, 누락 0건 |

## 발견 없는 에이전트

requirement, scope, documentation, user_guide_sync

## 권장 조치사항
1. (선택, 저비용) `executions.service.spec.ts` 의 `②`(findByWorkflow)·`⑧`(getChain)·`⑧-b`(stop) 세 표면에 `①`(findById)과 동일한 `.toContain('***')` 양성 단언을 추가해 마스킹 함수 배선 오류에 대한 테스트 방어력을 균일화한다.
2. (선택) `touchedMaskedKeys` 를 `touchedKeys` 로 개명하거나 주석으로 실제 의미(전체 편집 키, `maskedKeys` 교집합만 유의미)를 명시한다.
3. (defer 유지) `inputOverride` 서버측 마커 리터럴 거부는 기존 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:322`) 항목대로 별도 작업에서 처리한다 — 이번 PR 스코프 아님.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(prompt 에 세부 사유 미제공) — 이번 changeset 은 마스킹/UI 가드 로직으로 성능 영향 표면 낮음 |
  | architecture | router 판단(prompt 에 세부 사유 미제공) — 아키텍처 구조 변경 없음(단일 유틸 승격 리팩터 수준) |
  | dependency | router 판단(prompt 에 세부 사유 미제공) — 신규/변경 의존성 없음 |
  | database | router 판단(prompt 에 세부 사유 미제공) — 스키마/쿼리 변경 없음 |
  | concurrency | router 판단(prompt 에 세부 사유 미제공) — 동시성 로직 변경 없음 |
  | api_contract | router 판단(prompt 에 세부 사유 미제공) — REST 응답 필드 마스킹 변경은 side_effect/security 가 커버 |