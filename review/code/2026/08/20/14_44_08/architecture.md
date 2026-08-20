# 아키텍처(Architecture) 코드 리뷰 — eia-inputdata-marker-guard

## 발견사항

- **[WARNING]** `inputData` egress 마스킹 게이트가 백엔드 응답 빌더 4곳에 분산돼 있고, 유일한 동기화 장치가 사람이 읽는 주석 표다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `toResponseExecution`(1067행 부근, `inputData: redactStoredDataForResponse(rest.inputData)` 1074행), `toExecutionDto`(976행 부근, 1009행), 노드 레벨 map 루프(695~703행 `maskIfPresent`), 그리고 자매 서비스 `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:305`
  - 상세: `toResponseExecution` 바로 위 JSDoc(1028~1048행)이 스스로 이렇게 말한다 — "마스킹을 호출부마다 손으로 걸면 **한 곳씩 빠진다** — 이 저장소의 반복 실패 형태다" 그리고 6개 표면을 나열한 표를 "이 주석이 정본"이라고 못 박는다. 즉 이 아키텍처는 컴파일러/타입 시스템이 강제하는 단일 게이트가 아니라, 새 필드를 마스킹 대상에 넣을 때마다 개발자가 이 표를 보고 N 개 호출부를 전수로 고쳐야 하는 구조다. 이번 PR 은 정확히 그 패턴을 따라 4곳을 모두 고쳤고(그 자체는 옳다), 그러나 직전 리뷰 라운드(`review/code/2026/08/20/14_08_45/RESOLUTION.md` CRITICAL 2)에서 바로 이 fragmentation 때문에 자매 DTO(`ExecutionDto.inputData` JSDoc)가 갱신에서 빠지는 사고가 실제로 났다. 근본 원인이 이번 PR 에서도 그대로 남아 있어, 다음에 다섯 번째 마스킹 대상 필드가 추가되면 같은 형태의 결함이 재발할 여지가 크다.
  - 제안: `toResponseExecution`/`toExecutionDto`/`background-runs.service.ts` 의 동일 노드용 매퍼가 공유하는 단일 `redactExecutionFields(row)` 같은 헬퍼(또는 응답 직전 NestJS interceptor)로 통합해, "N 곳에 손으로 건다"를 "1곳에서 호출한다"로 좁히는 리팩터를 백로그에 등재할 것을 권한다. 지금 당장 이 PR 을 막을 사안은 아니다(기존 관례를 정확히 따랐다) — 다음 필드 추가 시점에 같은 실패가 세 번째로 반복되기 전에 구조를 바꾸는 편이 낫다.

- **[INFO]** frontend `MASKED_MARKERS` 는 backend `sanitize-error-message.ts` 상수의 손-복제 미러이고, 기계적 동기화 검증이 아직 없다
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:1-22`(파일 헤더 주석이 "SoT 는 backend 상수" 라고 명시) vs `codebase/backend/src/shared/utils/sanitize-error-message.ts` 의 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`
  - 상세: `codebase/frontend`(Next.js CSR)와 `codebase/backend`(NestJS)는 빌드/번들이 분리돼 있어 직접 import 가 불가능하다는 이유로 상수를 손으로 복제하는 것 자체는 합리적 트레이드오프다. 다만 이 값이 갈리면 "가드가 조용히 fail-open"(새 마커 종류가 backend 에 추가돼도 frontend 가드가 못 알아채 마스킹 값이 그대로 재제출)하는 보안-인접 결함으로 이어지는데, 이를 기계로 대조하는 계약 테스트는 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:315` 에 아직 미체크(`- [ ]`) 항목으로만 남아 있다 — 이번 PR 로 새로 생긴 갭은 아니고 이미 추적 중이므로 이 PR 을 막을 사안은 아니지만, 두 모듈 경계 사이에 컴파일 타임/CI 타임으로 강제되는 계약이 없다는 구조적 사실은 아키텍처 관점에서 다시 짚어 둔다.
  - 제안: (이미 plan 에 등재됨, 별건으로 진행 예정) e2e 또는 빌드 스크립트에서 두 상수 배열을 문자열로 추출해 비교하는 계약 테스트 신설.

- **[INFO]** "마스킹 마커 감지" 프리미티브는 공유되지만 "차단 정책"(무엇을 할지)은 소비처 3곳에서 각자 독립 구현돼 있다
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx`(`initialValueFor`, 프리필 스킵) / `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`(103~119행, `jsonError` useMemo 안의 `hasMaskedMarkerLeaf(parsed)` 단일 검사 → Run 비활성) / `codebase/frontend/src/components/executions/rerun-modal.tsx`(116~137행 `splitMaskedParameters` + `touchedMaskedKeys` 상태 + `blockedByMaskedInput` 파생값)
  - 상세: `lib/utils/masked-markers.ts` 로 승격된 것은 `isMaskedMarker`/`hasMaskedMarkerLeaf` 같은 순수 판별 함수뿐이고, "마커를 만나면 무엇을 하는가"(프리필 스킵 vs JSON 전체 차단 vs 필드별 비우기+touched-tracking)는 세 컴포넌트가 각각 다시 조립한다. CHANGELOG(`3~25`행)가 이 세 형태가 의도적으로 다르다는 근거를 명확히 남겨 두고 있어 지금 상태가 오판은 아니다. 다만 이 구조에서는 향후 네 번째 소비처(예: 신규 벌크 재실행 기능)가 생기면 세 패턴 중 하나를 다시 손으로 조립해야 하고, "정책"에 해당하는 로직에는 마커 미러 계약 테스트 같은 공유 검증 지점이 없다 — 판별 프리미티브만 SoT 이고 정책 자체는 SoT 가 분산돼 있다는 점을 확장성(§8) 관점에서 기록해 둔다.
  - 제안: 지금 리팩터할 필요는 없음(과도한 추상화 위험 — 세 UX 가 실제로 다르다). 네 번째 소비처가 생기는 시점에 공통 부분(터치 여부 추적, leaf 순회)을 훅으로 뽑을지 재평가.

## 요약

이 PR 의 핵심 아키텍처 결정 — `Execution.inputData` 의 마스킹-예외 카브아웃을 폐지하고, 마커 판별 프리미티브(`MASKED_MARKERS`/`isMaskedMarker`/`hasMaskedMarkerLeaf`)를 컴포넌트(`dynamic-form-ui.tsx`)에서 `lib/utils/masked-markers.ts` 로 승격한 것 — 은 방향이 옳다. 특히 이 승격은 "모달/툴바가 무관한 폼 UI 컴포넌트를 단지 상수 하나 때문에 import 해야 하는" 역방향 의존을 없애 DIP 를 개선한 실질적 개선이다. backend 쪽도 `Execution.inputData` 를 특별 취급하던 예외 상수(`MASKED_INPUT_DATA_REASON`)를 통째로 제거하고 다른 두 컬럼과 동일한 마스킹 경로로 흡수시켜, "레벨별로 반대 정책" 이라는 분기를 없앤 것은 개방-폐쇄 원칙 관점에서 조건부 특수 케이스를 줄이는 바람직한 방향이다. 다만 그 마스킹 게이트 자체가 4개의 독립 호출부(주석 표로만 동기화)에 분산돼 있다는 기존 아키텍처 부채를 이번 PR 이 해소하지 않고 그대로 확장했고, 이는 바로 이 PR 시리즈의 직전 라운드에서 실제 CRITICAL(자매 DTO JSDoc 누락)로 발현된 근본 원인이라 WARNING 으로 기록한다. frontend/backend 간 마커 상수 손-복제와 3-소비처 정책 분산은 이미 문서화·추적된 트레이드오프로, 현재로선 과도한 추상화보다 낫다고 판단해 INFO 로 남긴다. 순환 의존이나 레이어 위반(프레젠테이션이 데이터 접근을 직접 하는 등)은 발견되지 않았다.

## 위험도

LOW
