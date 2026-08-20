STATUS=success ISSUES=0

===REPORT_MARKDOWN_BELOW===
# 아키텍처(Architecture) 코드 리뷰 — eia-inputdata-marker-guard (18_23_54)

## 컨텍스트

이 changeset(`origin/main...HEAD`)은 `Execution.inputData` egress 마스킹 카브아웃 폐지
+ 재제출 소비처 3곳(폼 프리필 · Re-run 모달 · 에디터 히스토리 로드) 마커 가드 신설을
다룬다. 같은 diff 에 대해 이미 **아홉 라운드**의 아키텍처 리뷰(`14_08_45` → … →
`16_51_19` → `17_13_19`/`17_38_33` → `18_03_01`)가 순차적으로 실행됐고, CRITICAL 은
초기(`14_08_45`)에 1건, 구조적 WARNING 은 `18_03_01`(orphan 마스킹 키를 강제로
`"string"` 타입으로 되살려 원본이 object/array 였던 경우 `displayValue` 가
`[object Object]` 를 렌더하던 결함)에서 1건 잡혔고 각각 즉시 수정됐다. HEAD 는 그
마지막 WARNING 수정 커밋(`2c628f6ac`, `inferTypeFromValue` 도입)까지 반영된 상태다.

이번 라운드는 직전 라운드 결론을 그대로 신뢰하지 않고 핵심 파일을 직접 열어
재검증했다: `lib/utils/masked-markers.ts`(전문), `rerun-modal.tsx`(전문 — 특히
`fields`/`inferTypeFromValue`/`blockedByMaskedInput`), `dynamic-form-ui.tsx`(import
경로), `executions.service.ts`(`toResponseExecution`/`toExecutionDto` 마스킹 관문),
`background-runs.service.ts`(자매 관문), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
(등재된 트래커 항목 실물 grep 대조).

## 발견사항

없음 — 새로 지적할 CRITICAL/WARNING 을 찾지 못했다. 확인한 항목과 판단 근거:

- **`inferTypeFromValue` fix 가 실제로 반영돼 있다** — `rerun-modal.tsx:173-177` 이
  orphan 마스킹 키의 타입을 원본 값 shape(`Array.isArray`/`typeof === "object"`)에서
  추론하고, `fields` 파생(`:343-345`)이 `type: inferTypeFromValue(originalParameters[name])`
  으로 이를 사용한다. `isStructuredType`(선언된 타입 기준)과 `inferTypeFromValue`(값
  shape 기준)가 서로 다른 판정 축을 쓰는 이유가 JSDoc(`:327-331`)에 명시돼 있고, 두
  판정이 왜 다른 정책이어야 하는지(선언이 있는 필드 vs 선언이 없는 orphan)가 일관적이다.
  직전 라운드가 지적한 `[object Object]` 경로는 닫혔다.
- **`lib/utils/masked-markers.ts` 로의 승격이 유지되고 있다** — `rerun-modal.tsx`,
  `editor-toolbar.tsx`, `dynamic-form-ui.tsx` 세 소비처 전부 `@/lib/utils/masked-markers`
  단일 지점만 import 한다. 순수 유틸(자체 의존성 0, 부수효과 없음)이라 순환 의존 여지가
  없고, 값 검사(`isMaskedMarker`)를 깊이 검사보다 먼저 수행하는 순서(off-by-one 이
  fail-open 이 되는 문제 회피)와 깊이 상한(`MAX_MARKER_SCAN_DEPTH = 10`)이 backend
  `MAX_REDACT_DEPTH` 와 정합한다는 근거가 JSDoc 에 남아 있다.
- **backend 마스킹 관문의 단일 문서화 지점** — `executions.service.ts` 의
  `toResponseExecution` JSDoc 이 6개 읽기 표면을 표로 열거하고, `background-runs.service.ts`
  는 그 표를 프로즈로 정확히 가리킨다(수치 drift 없음). 두 서비스가 실제 마스킹 primitive
  (`redactStoredDataForResponse`/`redactStoredErrorForResponse`, `shared/utils/`)는
  공유하고 호출부 배선만 각자 갖는 구조라, "게이트가 여러 곳에 분산된다"는 잔여 부채는
  로직 중복이 아니라 **호출부 통합 리팩터** 범위이며 이미 트래커
  (`spec-sync-external-interaction-api-gaps.md:315`, `14_44_08` W4)에 등재돼 있다.
- **레이어 방향 개선 확인** — 마커 판별 순수 함수가 컴포넌트(`dynamic-form-ui.tsx`)
  밖으로 나오면서, 모달/툴바가 무관한 프레젠테이션 컴포넌트를 import 해야 했던 잘못된
  형제→형제 의존이 제거되고 공용 유틸 레이어로 재배선됐다 — 아키텍처 관점에서 순수 개선.
- **FE/BE 상수 손-복제, `inputOverride` 서버측 미검증** — 둘 다 이번 라운드에서도
  재확인했지만 새 이슈가 아니다. 전자는 `packages/chat-channel-validation` 선례를
  참고하라는 제안과 함께 트래커에 등재돼 있고(`spec-sync-...md:346-368`), 후자는
  `14_44_08` W6 으로 등재된 뒤 `18_03_01` RESOLUTION 에서 "spec 표면이라 developer
  권한 밖 — planner 턴 동반 착수" 로 명시적으로 처리 경로가 확정됐다. CHANGELOG 최상단이
  이 카브아웃-폐지의 **닫힌 범위**(UI 정상 흐름 한정, API 직접 호출은 서버가 여전히
  받는다)를 정확히 서술하고 있어 문서화된 보장이 구현보다 넓지 않다.

## 요약

10회차에 걸친 반복 리뷰로 이 changeset 의 구조적 결함(CRITICAL 1건, 구조적 WARNING
1~2건)은 모두 발견 즉시 수정됐고, 이번 라운드의 독립 재검증에서도 SOLID·결합도/응집도·
레이어 책임·순환 의존·모듈 경계·확장성 어느 축에서도 새로운 결함을 찾지 못했다.
마스킹 판별 유틸을 `lib/utils/`로 승격해 잘못된 컴포넌트 간 의존 방향을 제거했고,
backend 는 단일 문서화 관문(`toResponseExecution` 표)을 유지한 채 세 컬럼
(`error`/`outputData`/`inputData`)에 일관된 마스킹 정책을 적용해 이전의 "레벨별로
반대 정책"이라는 반직관적 분기를 없앴다. 남은 구조적 부채(마스킹 게이트 4곳의 호출부
통합, FE/BE 상수 손-복제, `inputOverride` 서버측 미검증)는 전부 근거·처리 경로와 함께
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 명시 등재돼 있고,
이번 PR 을 막을 사안이 아니다.

## 위험도

LOW
