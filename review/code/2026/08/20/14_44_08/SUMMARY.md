# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. 핵심 정책 전환(`Execution.inputData` egress 마스킹 카브아웃 폐지 + 재제출 3소비처 가드)은 방향·구현이 대체로 견고하지만, 직전 라운드 fix(터치 기반 판정 전환)가 spec 문서에 반영되지 않았고(SPEC-DRIFT) 그 판정 자체가 "터치했지만 값이 여전히 마커"인 새 우회를 열어 둔 채 검증되지 않았다는 점이 실질 위험으로 남는다. forced reviewer 7명 전원 결과 확보됨(미이행 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] Re-run 모달 차단 조건을 spec 2곳이 "값이 비어 있는가"(value-based)로 서술하지만, 실제 구현(및 그 근거가 된 직전 라운드 WARNING #2 fix)은 "사용자가 그 키를 건드렸는가"(touched-based)다. 두 판정은 관측 가능한 동작이 다르다(값 기반은 재차 비면 재차단, touched 기반은 한 번 건드리면 세션 내 영구 해제) | `spec/5-system/13-replay-rerun.md:358-361`, `spec/5-system/14-external-interaction-api.md:1570`(§R17 표), `plan/in-progress/eia-inputdata-marker-guard.md:118-119`(체크리스트); 코드(권위): `codebase/frontend/src/components/executions/rerun-modal.tsx`(`blockedByMaskedInput`, `setParam`) | 코드는 유지(타당한 fix). spec 두 문서와 plan 체크리스트를 "터치 여부로 판정"으로 project-planner 턴에서 재작성 |
| 2 | requirement | Re-run 모달에서 마스킹 키를 한 번이라도 "건드리면" `touchedMaskedKeys`에 값 무관하게 영구 등록돼, 최종 값이 여전히(또는 다시) 마스킹 마커 리터럴이어도 제출 차단이 영구 해제된다. `handleSubmit`은 `paramValues`를 `isMaskedMarker`/`hasMaskedMarkerLeaf` 최종 재검증 없이 그대로 전송하며, 신규 테스트도 "터치했지만 값이 여전히 마커"인 경로를 다루지 않는다. 에디터 툴바(`editor-toolbar.tsx`)는 값 기반(`useMemo` deps에 값 포함)이라 이 문제가 없음 — Re-run 모달만의 구조적 차이 | `codebase/frontend/src/components/executions/rerun-modal.tsx`(`setParam` 299-304행, `blockedByMaskedInput` 342-343행, `handleSubmit`) | `blockedByMaskedInput` 판정에 "터치됨" AND "현재 값이 더 이상 마커 아님"을 함께 요구(예: `maskedKeys.some((k) => !touchedMaskedKeys.has(k) || isMaskedMarker(paramValues[k]) || hasMaskedMarkerLeaf(paramValues[k]))`), 또는 `handleSubmit` 진입 시 마지막 방어선으로 재검증 + 캐너리 테스트 추가 |
| 3 | testing | 항목 2 의 판정 전환(값 기반 → 터치 기반)이 실제로 막으려던 회귀(스키마 지연 도착 시 `coerceInput('boolean','')`가 값 기반 판정을 조용히 통과시키는 우회)를 검증하는 회귀 테스트가 없다. 신규 describe(`"ReRunModal — 마스킹 마커 왕복 차단"`)는 `workflowNodes`를 빈 배열로 고정해 스키마 지연 도착 경로 자체가 한 번도 행사되지 않는다 | `codebase/frontend/src/components/executions/__tests__/rerun-modal.test.tsx:537-640` (`describe("ReRunModal — 마스킹 마커 왕복 차단", ...)`); 대상 코드: `rerun-modal.tsx:312-327`(재조정 effect) | 기존 462행 패턴(스키마 GET 지연 resolve)으로 "마스킹 필드 + 스키마가 나중에 boolean 등으로 도착" 시나리오를 추가하고, 미터치 상태에선 여전히 차단됨을 단언(대조로 터치 후엔 유지되는 것도 확인) |
| 4 | architecture | `inputData` egress 마스킹 게이트가 backend 응답 빌더 4곳(`toResponseExecution`, `toExecutionDto`, 노드 레벨 `maskIfPresent` 루프, `background-runs.service.ts`)에 분산돼 있고 유일한 동기화 장치가 사람이 읽는 주석 표다. 직전 라운드에서 바로 이 fragmentation 때문에 자매 DTO JSDoc 이 갱신에서 빠지는 CRITICAL 이 실제로 발생했으며, 근본 원인은 이번 PR 에서도 해소되지 않고 그대로 확장됨 | `codebase/backend/src/modules/executions/executions.service.ts`(1028-1048행 JSDoc 표, `toResponseExecution` 1074행, `toExecutionDto` 1009행, 노드 루프 695-703행), `background-runs.service.ts:305` | 4곳이 공유하는 단일 `redactExecutionFields(row)` 헬퍼(또는 응답 직전 interceptor)로 통합하는 리팩터를 백로그에 등재. 이번 PR을 막을 사안은 아님 |
| 5 | side_effect / api_contract | `Execution.inputData` REST 응답(`GET /executions/:id`, 목록, `/chain`, `POST .../stop`)의 값 의미가 "재제출 가능한 원문"에서 "표시 전용, 왕복 불가"로 바뀌었다. JSON 스키마 타입은 동일해 OpenAPI 계약상 드러나지 않는 실질적 하위 호환성 변경 — 이 저장소가 아는 프런트 3소비처는 가드됐지만, 이 엔드포인트를 직접 호출하는 저장소 밖 소비자(QA/운영 자동화, 감사 export 등, 실존 여부는 diff 범위 밖)는 이 변화를 스키마로 알 수 없다 | `codebase/backend/src/modules/executions/executions.service.ts`(`ResponseExecution` 타입 100-124행, `toResponseExecution` 1074행, `toExecutionDto` 1009행) | 이 REST 엔드포인트의 저장소 외부 소비자 존재 여부 확인, 있다면 릴리스 노트/API changelog 에 "breaking: `inputData` 이제 egress 마스킹됨" 명시 공지 |
| 6 | api_contract (security INFO 참고) | `POST /executions/:id/re-run` 의 `inputOverride` 요청 바디에 마스킹 마커 리터럴(`'***'`/`[REDACTED]`/`[REDACTED_DEPTH]`)을 거부하는 서버측 검증이 없다. `resolveTriggerParameters` 는 타입·필수값만 검증하므로, UI 를 우회한 임의 클라이언트(curl/스크립트)는 이 PR 이 막으려던 왕복 오염을 API 레벨에서 재현할 수 있다. security reviewer 는 같은 갭을 "기밀성 침해 아님 + 직전 라운드에서 이미 설계 결정으로 defer됨"을 근거로 INFO 로 평가 — 이미 인지·보류된 트레이드오프이며 이번 PR 이 새로 만든 결함은 아님 | `codebase/backend/src/modules/executions/executions.service.ts`(`reRun()`, 492행 부근 `resolveTriggerParameters` 호출) | 즉시 조치 불요(기존 결정 유지 가능). defense-in-depth 로 "값이 알려진 마스킹 마커와 정확히 일치하면 `INVALID_INPUT` 거부"하는 얕은 서버측 체크를 별도 트래커 항목으로 유지 검토 |
| 7 | documentation | `executions.service.spec.ts` 의 JSDoc 소제목(1109행)이 여전히 `"inputData 는 의도적으로 대상이 아니다"`(구 결론)를 현재형으로 단언한다. 정정문은 본문 중간의 blockquote 로만 추가돼, 위에서부터 읽는 독자는 소제목→본문 3문장까지 옛 결론을 읽은 뒤에야 정정을 만난다. 자매 파일(`execution-response.dto.ts`)은 같은 상황에서 주제문 자체를 현재형으로 재작성하는 올바른 패턴을 이미 적용함 — 이 파일만 놓침 | `codebase/backend/src/modules/executions/executions.service.spec.ts:1109`(소제목), 1106-1129행(블록 전체) | 소제목을 현재 진실("두 레벨 모두 마스킹 대상")로 재작성하고, 옛 설명은 `> 2026-08-20 이전에는 ...` 형태의 역사적 caveat 로 재배치(자매 DTO 파일과 동일 패턴) |
| 8 | maintainability | `blockedByMaskedInput` 선언 위에 연속된 두 개의 별도 JSDoc 블록이 배치돼 있다(329-334행, 335-341행) — 같은 판정 로직을 설명하는 내용인데 형태상 분리돼 있어 한쪽만 갱신되고 다른 쪽이 stale 로 남을 위험 | `codebase/frontend/src/components/executions/rerun-modal.tsx:329-341` | 두 블록을 하나의 JSDoc 으로 합치고 섹션 헤더로 구분 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | 마스킹-마커 재제출 차단이 클라이언트 단에서만 강제됨(위 WARNING #6 과 동일 근본 갭, security 는 기밀성 미영향·기존 defer 결정 근거로 INFO 평가) | `rerun-modal.tsx`, `editor-toolbar.tsx` | 현 설계 유지 가능. 서버측 방어는 별도 트래커 검토(WARNING #6 참고) |
| 2 | security | 마커 판별이 정확 일치만 잡고 부분 치환(`scheme://***@host` 류)은 감지하지 않음 — 의도적 경계로 JSDoc 이 명시, 기밀성 노출 아님(잔존 값은 이미 자격증명 제거됨) | `codebase/frontend/src/lib/utils/masked-markers.ts`(`isMaskedMarker`/`hasMaskedMarkerLeaf`) | 조치 불요(의도된 트레이드오프, 양방향 캐너리 테스트로 고정됨) |
| 3 | architecture | frontend `MASKED_MARKERS` 가 backend `sanitize-error-message.ts` 상수의 손-복제 미러이며, 기계적 동기화 검증(계약 테스트)이 아직 없음 — 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:315` 에 미체크 항목으로 추적 중 | `codebase/frontend/src/lib/utils/masked-markers.ts:1-22` vs `codebase/backend/src/shared/utils/sanitize-error-message.ts` | e2e/빌드 스크립트에서 두 상수 배열을 비교하는 계약 테스트 신설(이미 계획됨) |
| 4 | architecture | "마커 감지" 프리미티브는 공유되지만 "차단 정책"(무엇을 할지)은 소비처 3곳(폼 프리필/툴바/모달)이 각자 독립 구현 — CHANGELOG 가 의도적 차이임을 근거로 남김 | `dynamic-form-ui.tsx`, `editor-toolbar.tsx`, `rerun-modal.tsx` | 지금 리팩터 불요. 4번째 소비처 등장 시 공통 부분(터치 추적, leaf 순회)을 훅으로 재평가 |
| 5 | side_effect | `deepRedactSecrets` 의 모듈 전역 `WeakMap` 캐시가 이제 `Execution.inputData` 객체도 캐싱 — 기존 인프라(GC-safe, copy-on-change) 확장이며 새 위험은 아니나, 캐시 히트 시 같은 참조를 반환하는 캐비엇의 적용 범위가 넓어짐 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:181,201-214` | 조치 불요. 향후 응답 객체를 호출부가 in-place mutate 하지 않도록 유의 |
| 6 | maintainability | `touchedMaskedKeys` 이름이 실제로는 "마스킹 여부 무관 모든 편집 키"를 담아 이름보다 넓은 범위를 가짐 | `rerun-modal.tsx:229, 299-304` | `touchedKeys`로 개명하거나 주석으로 범위 명시 |
| 7 | maintainability | "2026-08-20 카브아웃 폐지" 서사가 5개 이상 파일에 근접 중복 서술됨(단일 SoT 앵커가 다중 로컬 요약으로 대체됨) — PR 스스로 CHANGELOG 에서 이 비용을 인지·감수했다고 밝힘 | `CHANGELOG.md`, `executions.service.ts`, 두 DTO, `background-runs.service.ts`, `executions.service.spec.ts` | (선택) `toResponseExecution` 마스킹 표를 유일한 SoT로 삼고 다른 파일은 짧게 인용만 유지 |
| 8 | testing | object/array 안쪽 마커 필드는 "채우면 풀린다" 언블록 경로가 스칼라 필드만 테스트되고 nested leaf 는 초기 차단 상태만 검증됨 | `rerun-modal.test.tsx:554`(스칼라), `:612`(object, 언블록 미검증) | 612행 테스트에 이어 object 필드 편집 후 활성화되는 단언 추가 |
| 9 | testing | 스칼라+object 마커가 동시에 섞인 원본에 대한 테스트 없음 — `maskedKeys.length >= 2` 케이스가 한 번도 행사되지 않아 `some` vs `every` 류 뮤테이션을 못 잡음 | `rerun-modal.test.tsx` 533-640행 전체 | 필수는 아니나 다항 fixture 로 "한쪽만 채워도 다른 쪽 남으면 계속 막힘" 고정 |
| 10 | documentation | plan 제목("소비처 2곳")과 CHANGELOG("소비처 3곳")이 서로 다른 기준(신규 추가분 vs 총합)으로 세어, 나란히 보면 모순처럼 보일 수 있음(실제 모순 아님) | `plan/in-progress/eia-inputdata-marker-guard.md`(frontmatter), `CHANGELOG.md:3` | (선택) plan 제목에 "(총 3곳 중 나머지 2곳)" 한정어 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 클라이언트 전용 가드(기존 defer 결정), 정확일치 경계 — 둘 다 기밀성 미영향. 직전 CRITICAL 2건 재검증 완료 |
| architecture | LOW | 마스킹 게이트 4곳 분산(주석 표 동기화, WARNING), frontend 상수 손-복제, 정책 3곳 독립구현 |
| requirement | MEDIUM | Re-run 모달 spec-drift(터치 기반 vs 값 기반), 터치 후 값이 여전히 마커여도 영구 해제되는 우회 |
| scope | NONE | 78파일 전부 계획 목표(카브아웃 폐지 + 3소비처 가드)로 수렴, 범위 이탈 없음 |
| side_effect | LOW | `inputData` 응답 값 의미 반전(외부 소비자 영향 가능), WeakMap 캐시 확장, 타입 필드 추가 — 전부 안전 확인 |
| maintainability | LOW | JSDoc 블록 분리, 변수명 정밀도, 문서 중복 서사(경미) |
| testing | LOW | 터치 기반 전환의 회귀 시나리오 자체를 검증하는 테스트 부재(WARNING), nested/혼합 케이스 왕복 커버리지 공백(INFO) |
| documentation | LOW | 테스트 파일 JSDoc 소제목이 구 결론 방치(자매 DTO는 이미 올바른 패턴 적용) |
| api_contract | LOW | 응답 값 의미 반전(breaking, 스키마엔 미노출), re-run 서버측 마커 재검증 부재(기존 defer 결정) |
| user_guide_sync | NONE | 매칭 trigger 3개(new-ui-string/backend-api-change/run-debug-flow-change) 전부 충족, 누락 0 |

## 발견 없는 에이전트

scope, user_guide_sync (위 표 참조 — 두 에이전트 모두 위험도 NONE, 실질 발견 없음)

## 권장 조치사항

1. **(WARNING #2)** Re-run 모달 `blockedByMaskedInput` 판정에 "터치됨" 뿐 아니라 "현재 값이 더 이상 마커가 아님"을 함께 요구하도록 수정 — 이 PR 의 핵심 목적(마스킹 마커 왕복 오염 차단)을 정면으로 재현하는 우회 경로이므로 최우선.
2. **(WARNING #3)** 항목 1 의 수정과 함께, 스키마 지연 도착 시 터치 기반 판정이 실제로 버티는지 검증하는 회귀 테스트를 추가.
3. **(SPEC-DRIFT #1)** `spec/5-system/13-replay-rerun.md` §10.2, `spec/5-system/14-external-interaction-api.md` §R17 표, `plan/in-progress/eia-inputdata-marker-guard.md` 체크리스트를 "터치 여부 기준"으로 project-planner 턴에서 정정.
4. **(WARNING #7)** `executions.service.spec.ts:1109` JSDoc 소제목을 현재 진실로 재작성(자매 DTO 패턴 적용).
5. **(WARNING #5)** `inputData` REST 응답의 저장소 외부 소비자 존재 여부를 확인하고, 있다면 breaking change 공지.
6. **(WARNING #4, #6, #8)** 백로그성 — 마스킹 게이트 4곳 통합 헬퍼, re-run 서버측 마커 리터럴 거부 체크, JSDoc 블록 병합은 이번 PR 을 막을 사안은 아니므로 후속 트래커 항목으로 등재.

## 라우터 결정

`routing_status=done` (router 가 선별):

- **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (10명)
- **제외**: performance, dependency, database, concurrency (4명)
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **전원 결과 확보됨(미이행 없음)**

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 판단 — 이번 changeset(마스킹 마커 감지·응답 필드 치환)은 성능 특성 변경이 아님으로 비관련 분류 (상세 사유는 prompt manifest 에 미전달) |
| dependency | 라우터 판단 — 신규/변경 외부 의존성 없음으로 비관련 분류 (상세 사유는 prompt manifest 에 미전달) |
| database | 라우터 판단 — 스키마·쿼리 변경 없음으로 비관련 분류 (상세 사유는 prompt manifest 에 미전달) |
| concurrency | 라우터 판단 — 동시성 제어 로직 변경 없음으로 비관련 분류 (상세 사유는 prompt manifest 에 미전달) |