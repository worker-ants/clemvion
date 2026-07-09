# 문서화(Documentation) Review

대상: `node-output-schema-enrichers.ts` DRY 리팩터 (behavior-preserving) + 테스트 보강 +
`use-expression-context.ts` dispatch 단일화 + `plan/in-progress/expression-enricher-dry.md`

## 발견사항

- **[INFO]** Form enricher 의 백엔드 교차참조 주석이 리팩터 중 소실
  - 위치: `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts` — `enrichFormOutputSchema` JSDoc (구 L822-828 → 신 L950-955)
  - 상세: 리팩터 전 주석은 `output.interaction.data` 가 채워지는 시점을 `codebase/backend/.../form.handler.ts` + `execution-engine.service.ts`의 `waitForFormSubmission`으로 명시적으로 가리켰다. 새 JSDoc은 이 교차참조를 생략하고 "submission 시점에 채워진다"는 서술만 남겼다. 같은 파일의 다른 함수들(예: `enrichManualTriggerOutputSchema`— spec §4/§5.1, CONVENTIONS Principle 1.1, `use-expression-suggestions` 참조)은 여전히 백엔드/spec 교차참조를 유지하고 있어 Form만 비대칭적으로 축소됐다. 공통 골격 설명(`enrichByProjecting` JSDoc)으로 흡수된 "tolerant fall-through" 문구와 달리, 이 backend 파일 포인터는 다른 함수 주석에 중복 존재하던 내용이 아니라 Form 고유의 정보였다.
  - 제안: `enrichFormOutputSchema` JSDoc에 `form.handler.ts` / `execution-engine.service.ts#waitForFormSubmission` 교차참조를 복원(또는 축약 유지). 필수는 아니나, 향후 백엔드 shape 변경 시 이 프론트 enricher를 함께 점검해야 한다는 단서가 사라지는 점이 아쉽다.

- **[INFO]** `plan/in-progress/expression-enricher-dry.md`의 설계·테스트 체크리스트가 실제 완료 상태를 반영하지 않음
  - 위치: `plan/in-progress/expression-enricher-dry.md` — `## 설계` 4개 항목, `## 테스트` 2개 항목 (모두 `- [ ]`)
  - 상세: 같은 커밋(`709650032`)에서 `cloneSchema`, `enrichByProjecting`, `OUTPUT_SCHEMA_ENRICHERS` export, `use-expression-context.ts` 2곳 dispatch 통합, 레지스트리 완전성 테스트가 모두 실제로 구현·커밋됐음이 diff로 확인되지만, plan 파일의 해당 체크박스는 전부 미체크 상태로 남아 있다(단, `mergeObjectProp` 대신 `getOrCreateObjectChild` + `mergeLeafProps` 2개 함수로 구현된 점은 설계 초안 대비 자연스러운 변형이라 문제 아님). `## 워크플로 체크`의 `/ai-review` 항목이 미체크인 것은 현재 리뷰가 진행 중이므로 정확하지만, 설계·테스트 항목까지 미체크인 것은 plan이 실제 진행 상황을 즉시 반영하지 않고 있음을 뜻한다.
  - 제안: 구현이 이미 커밋된 시점에 설계/테스트 체크박스도 함께 체크하거나, 최소한 이번 PR의 마지막 정리 커밋(`.claude/docs/plan-lifecycle.md` 관례에 따른 review 전용 커밋)에서 갱신한다. 즉시 차단 사유는 아님.

- **[INFO]** CHANGELOG 미갱신 — 정책상 정상
  - 위치: `CHANGELOG.md` (변경 없음)
  - 상세: 이 리팩터는 plan에 "spec·런타임·백엔드·사용자 가시 동작 무변경"으로 명시된 순수 내부 DRY이며, `OUTPUT_SCHEMA_ENRICHERS`가 매핑하는 5개 노드 타입과 각 enricher의 공개 함수 시그니처(export 이름)가 그대로 보존된다. 저장소 관례상 CHANGELOG는 사용자/spec 가시 변경에만 기록되며(예: 과거 "Manual Trigger 파라미터 표현식 자동완성 힌트" 항목), 동일 계열의 다른 순수 `refactor(...)` 커밋들도 CHANGELOG를 갱신하지 않는다. 이번 변경도 그 관례에 부합하므로 누락이 아니다.
  - 제안: 조치 불필요. (확인 목적으로 기재)

## 문서 품질이 개선된 부분 (참고)

- 모듈 최상단 JSDoc에 "공유 골격"(clone → project → attach, Transform만 예외) 설명이 추가되어 신규 기여자가 5개 enricher의 공통 패턴을 한눈에 파악할 수 있게 됐다.
- 이전에는 문서화되지 않았던 내부 헬퍼(`cloneSchema`, `collectProps`, `getOrCreateObjectChild`, `mergeLeafProps`, `enrichByProjecting`)에 각각 목적·계약을 설명하는 JSDoc이 신규로 추가됐다.
- `enrichTableOutputSchema`의 doc이 "왜 `mergeLeafProps`를 쓰지 않는가"(array items vs keyed property)를 명시적으로 설명해, 코드만 보면 불일치로 보일 수 있는 부분을 미리 해소했다.
- 신규 테스트(`OUTPUT_SCHEMA_ENRICHERS registry`)에 "왜 이 가드가 필요한가"(두 dispatch 지점 중 한 곳만 갱신되는 조용한 회귀 방지)를 설명하는 주석이 붙어 있어 테스트 자체가 설계 의도의 문서 역할을 겸한다.
- `spec/5-system/5-expression-language.md §7.2`는 구현 세부(if/else vs registry dispatch)를 서술하지 않고 노드 타입별 투영 규칙만 다루므로, 이번 리팩터로 인한 spec 갱신 필요는 없음을 확인했다(dispatch 대상 5개 노드 타입·투영 규칙 불변).

## 요약

이번 변경은 순수 behavior-preserving 리팩터로, 오히려 기존보다 문서화 수준이 개선됐다(모듈 개요 주석 신설, 내부 헬퍼 JSDoc 신규 추가, 레지스트리 테스트의 의도 주석). 다만 리팩터 과정에서 Form enricher의 백엔드 소스 교차참조 주석이 축소됐고, plan 파일의 설계/테스트 체크리스트가 실제 완료된 작업을 아직 반영하지 못하고 있다. README/API 문서/CHANGELOG/설정 문서/예제 코드 관점에서는 해당 사항이 없거나(신규 API·설정·엔드포인트 없음) 저장소 관례상 갱신이 불필요함을 확인했다. spec(`5-expression-language.md §7.2`)은 구현 세부를 다루지 않아 이번 리팩터로 인한 drift가 없다.

## 위험도

LOW
