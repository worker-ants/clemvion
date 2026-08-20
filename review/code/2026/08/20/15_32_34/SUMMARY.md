# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 0건. WARNING 2건(rerun 모달의 무효 JSON 경유 마스킹 차단 우회, CHANGELOG 자기모순) 중 첫 번째는 backend `isCoerceFailure` 방어선이 실제 데이터 오염까지는 막지만 3라운드 동안 이 경로를 행사하는 테스트가 전무했다. forced whitelist(documentation/maintainability/requirement/scope/security/side_effect/testing) 전원 결과 확보 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | object/array 타입 파라미터 필드를 편집해 **문법적으로 무효한 JSON**(마커 텍스트는 남긴 채)으로 만들면 `blockedByMaskedInput` 이 조용히 풀림 — `coerceInput` 이 `JSON.parse` 실패 시 raw 문자열로 폴백하고, `hasMaskedMarkerLeaf` 는 문자열에 대해 정확 일치만 검사하므로 raw 문자열은 마커로 인식되지 않음. 재현 확인(scratch 테스트, 즉시 삭제). backend `resolveTriggerParameters` 의 `isCoerceFailure` 가 `coerce_failed` 로 거부해 실제 데이터 오염(라운드1 CRITICAL 급)까지는 이르지 않지만, 이 경로를 행사하는 테스트가 3라운드 동안 전무하고 "차단 문구" 대신 일반 오류 토스트만 뜸 | `codebase/frontend/src/components/executions/rerun-modal.tsx:345-349`(`blockedByMaskedInput`), `:176-187`(`coerceInput`) / 대응 테스트 부재: `rerun-modal.test.tsx:537-706` | (1) object/array 필드에서 JSON coerce 실패 상태면 무조건 차단 유지하는 조건을 `blockedByMaskedInput` 에 추가 (2) 유효 JSON 뒤에 문자를 추가해 무효로 만들고도 버튼이 disabled 인지 확인하는 캐너리 테스트 1개 추가 |
| 2 | Documentation | `CHANGELOG.md` 최상단(이 PR 신규 항목, `:3`)과 이 PR 이 건드리지 않은 더 아래쪽 기존 `Unreleased` 항목(#1180, `origin/main` 에 이미 존재, `:103-115`)이 카브아웃 결정을 정반대로 단언 — 상호 모순인데 정정/상호 참조가 없음. 이 PR 자신의 diff 범위 밖이라 앞선 8라운드(code 3 + consistency 5) 어느 리뷰도 대조하지 못한 사각지대 | `CHANGELOG.md:3` vs `:103-115`(`⚠️ Execution.inputData 만 마스킹하지 않는다 (의도)` 블록, `git blame` 확인상 커밋 `89c3f3c53` 작성) | 오래된 블록에 "→ 2026-08-20 에 이 카브아웃은 닫혔다(위 최신 Unreleased 항목 참조)" 형태의 후방 참조 caveat 추가, 또는 릴리스 전 상태를 활용해 최신 결정으로 축약 병합 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Requirement | `POST /executions/:id/re-run` 서버측이 `inputOverride` 값 자체가 마스킹 마커 리터럴(`'***'` 등)이어도 거부하지 않음 — UI 우회(직접 API 호출) 시 왕복 오염 재현 가능. 기밀성 침해 아님(이미 마스킹된 값의 데이터 무결성 문제), 이 PR 이 새로 만든 결함 아님 | `codebase/backend/src/modules/executions/executions.service.ts`(`resolveTriggerParameters(schema, dto.inputOverride ?? {})` 호출부) | 트래커 등재됨(`plan/in-progress/spec-sync-external-interaction-api-gaps.md` `14_44_08` W6) — 별건으로 진행, 이번 PR 비차단 |
| 2 | Architecture | backend 마스킹 관문이 서비스 클래스 2곳에 걸쳐 4개 이상 지점으로 분산 — SRP/DIP 상 단일 지점(공유 헬퍼/interceptor)으로 역전되지 않음 | `executions.service.ts`(`toResponseExecution`, `toExecutionDto`, 노드 레벨 `maskIfPresent` 루프) + `background-runs.service.ts` | 트래커 등재됨 — 후속에서 `redactExecutionFields(row)` 공유 헬퍼 또는 응답 직전 interceptor 로 통합 검토 |
| 3 | Architecture | frontend `MASKED_MARKERS` 가 backend 상수를 손으로 복제한 cross-runtime 미러이고, 신규 테스트는 프런트 내부 리터럴 일치만 검증해 backend 값과 기계적으로 대조하지 않음 — drift 시 프리필 가드가 조용히 fail-open | `codebase/frontend/src/lib/utils/masked-markers.ts:18-22` ↔ `codebase/backend/src/shared/utils/sanitize-error-message.ts` | 트래커 등재됨 — 후속에서 backend 값 빌드타임 export 또는 e2e 계약 테스트로 실제 대조 추가 검토 |
| 4 | Side Effect | `Execution.inputData` 공개 REST 응답 콘텐츠 계약 변경(원문 → 마스킹) — OpenAPI 스키마 타입은 그대로라 스키마 diff 로는 드러나지 않는 콘텐츠 계약 변경. 저장소 밖 소비자는 감지 불가 | `executions.service.ts`(`toResponseExecution`, `toExecutionDto`), `background-runs.service.ts:305` | 트래커 등재됨 — 이 PR 의 핵심 의도이므로 조치 불요 |
| 5 | Requirement / Documentation | plan frontmatter title 과 CHANGELOG 제목이 "재제출 소비처 개수"를 다른 기준(2 vs 3)으로 세어 나란히 읽으면 모순처럼 보임(각자 내부적으로는 일관) | `plan/in-progress/eia-inputdata-marker-guard.md`(title) vs `CHANGELOG.md:3` | 이전 라운드(`14_44_08`)가 조치 불요로 defer, 이번에도 유효. 선택적으로 plan 제목에 "(총 3곳 중 나머지 2곳)" 한정어 추가 가능 |
| 6 | Testing | Re-run 모달을 같은 인스턴스에서 다른 실행으로 재사용하는 경로(모달 열린 채 `original` prop 만 변경)에 대한 `touchedMaskedKeys`/`paramValues` 리셋 테스트 없음 | `rerun-modal.tsx`(`useEffect(..., [open, originalParameters])` 리셋 블록) | (선택) `rerender` 로 `open=true` 유지한 채 `original` 만 바꾸는 케이스 추가 |
| 7 | Testing | `Execution.inputData` egress 마스킹 반전에 대한 e2e(HTTP 왕복) 검증 없음 — unit 레벨에만 존재. 이 계층 전체(outputData/error, 선행 PR #1179/#1180)가 공유하는 기존 패턴이라 이번 PR 신규 갭 아님 | `executions.service.spec.ts:1109-1424`(unit) 대비 `test/*.e2e-spec.ts` | 조치 불요(기존 패턴) |
| 8 | Testing | 클라이언트 측 제출 함수(`handleSubmit`)에 버튼 `disabled` 외 내부 가드가 없다는 전제를 고정하는 캐너리 없음. INFO#1(서버측 우회, W6)과는 다른 경로 — 정상 UI 조작만으로 발생 가능성 있는 것과 완전 우회는 별개 | `rerun-modal.tsx:351`(`handleSubmit`) | 조치 불요(참고용, 별도 트래킹 없음) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 CRITICAL/WARNING 없음. 마스킹 관문 완전성·프런트 마커 가드 이중조건 실측 확인. 잔여 항목(inputOverride 우회)은 기존 트래커 등재분 |
| architecture | LOW | 신규 결함 없음. frontend 마커 유틸 승격은 의존 방향 개선. 잔여 2건(backend 관문 분산, frontend 마커 미러 계약 테스트 부재)은 기존 트래커 등재분 |
| requirement | LOW | 신규 CRITICAL/WARNING 없음. spec 7개 문서와 구현 line-level 대조 정합 확인. 잔여 2건은 INFO/기존 defer |
| scope | NONE | 122개 변경 파일 전량 단일 의도(카브아웃 폐지)에 직결, 무관 변경 없음 |
| side_effect | LOW | 신규 side-effect 없음. 유일 항목(inputData 응답 콘텐츠 계약 변경)은 PR 핵심 의도이자 기존 트래커 등재분 |
| maintainability | NONE | 라운드 1~3 결함 전부 실측상 해소. 신규 지적 없음 |
| testing | MEDIUM | **object/array 필드 무효 JSON 경유 마스킹 차단 우회 재현(WARNING, 신규)** — backend 방어선이 데이터 오염은 막음. 그 외 3건은 기존 INFO/트래커 |
| documentation | LOW | **CHANGELOG 상단 신규 항목 vs 기존 #1180 항목 자기모순(WARNING, 신규 발견 — PR diff 범위 밖 사각지대)**. 그 외는 실측상 해소 확인 |
| user_guide_sync | NONE | 매트릭스 3개 trigger(run-debug-flow-change, new-ui-string, backend-api-change) 전부 동반 갱신 완결 확인 |

## 발견 없는 에이전트

security, scope, maintainability, user_guide_sync — 신규 CRITICAL/WARNING/INFO 없음(NONE 판정).

## 권장 조치사항
1. `rerun-modal.tsx` 의 `blockedByMaskedInput` 에 object/array 필드의 JSON coerce 실패 상태를 반영해 무조건 차단 유지하도록 수정하고, 이를 고정하는 캐너리 테스트를 `rerun-modal.test.tsx` 마스킹 describe 블록에 추가한다 (WARNING #1).
2. `CHANGELOG.md` 의 기존 `#1180` `Unreleased` 블록(`:103-115`)에 최신 결정(카브아웃이 닫혔음)을 가리키는 후방 참조 caveat 를 추가하거나, 릴리스 전 상태를 활용해 최신 결정으로 축약 병합한다 (WARNING #2).
3. (선택, 트래커 추적 중 — 이번 PR 비차단) `inputOverride` 서버측 마커 리터럴 거부, backend 마스킹 관문 4곳 통합, frontend/backend 마커 상수 계약 테스트, Re-run 모달 재사용 리셋 테스트, e2e 왕복 검증 등은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 트래커 항목대로 별건 진행.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (9명)
  - **제외**: 표 참조 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced whitelist 전원 결과 확보됨 — 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이 changeset 과 관련 낮음 (마스킹 게이트 재사용, 신규 알고리즘 없음) |
  | dependency | 의존성 변경 없음 (package.json 등 미변경) |
  | database | 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 로직 변경 없음 |
  | api_contract | 응답 콘텐츠 변경은 side_effect/security 가 커버, 스키마 타입 자체는 무변경 |