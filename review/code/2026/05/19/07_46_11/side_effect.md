# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** `loopNodeMetadata.warningRules` 를 `[]` 로 변경 — 공개 인터페이스 동작 변경
  - 위치: `codebase/backend/src/nodes/logic/loop/loop.schema.ts` — `loopNodeMetadata` 객체
  - 상세: `warningRules` 배열에서 `loop:no-count` 항목이 제거되었다. 이 필드는 `NodeComponentMetadata` 의 공개 속성으로, frontend 캔버스 배지 렌더링(`loopSummary`)과 backend `handler.validate`의 "count 필수" 검사 양쪽에서 소비된다. 변경 후 count 가 비어있어도 경고 배지가 발생하지 않는다. 단, `default('1')` 이 존재하는 저장 계층을 거치는 정상 경로에서는 빈 count 자체가 도달하지 않으므로 의도된 동작이다.
  - 제안: 문서화된 설계 의도("최소 반복 1회 정책")가 이미 주석·spec 에 명시되어 있어 추가 조치 불필요. 단, legacy 데이터(zod parse 를 거치지 않고 직접 DB 에 쓰인 count=null/undefined 레코드)에 대한 캔버스 배지가 누락될 수 있음을 인지할 것.

- **[INFO]** `evaluateWarnings` import 제거 — 의존 모듈에 대한 side-effect 없음
  - 위치: `codebase/backend/src/nodes/logic/loop/loop.schema.spec.ts` — 파일 최상단
  - 상세: `@workflow/node-summary` 패키지의 `evaluateWarnings` 심볼이 spec 파일에서만 제거되었다. 프로덕션 코드(`loop.schema.ts`)에서는 원래 import 한 적 없으므로 번들·런타임에 영향 없다.
  - 제안: 없음.

- **[INFO]** `handler.validate({})` 반환값 변경 — 호출자에 대한 행동 계약 변경
  - 위치: `codebase/backend/src/nodes/logic/loop/loop.handler.spec.ts` L383–386
  - 상세: `validate({})` 가 이전에는 `valid: false` 를 반환하도록 기대하던 테스트가 이제 `{ valid: true, errors: [] }` 를 기대하도록 변경되었다. 이는 프로덕션 `LoopHandler.validate` 구현 자체가 변경된 것을 반영한다. 빈 count 를 실패가 아니라 통과로 처리하므로, 이 handler 를 직접 호출하는 다른 경로(예: UI 실시간 검증 로직, 별도 e2e)가 있다면 이전과 다른 결과를 받는다.
  - 제안: `LoopHandler.validate` 가 호출되는 모든 경로(frontend real-time validation, sub-workflow pre-check 등)를 확인하여 빈 count 를 `valid: true` 로 처리해도 무방한지 검토. `default('1')` 을 거치지 않는 직접 handler 호출 경로가 있다면 해당 경로에서 빈 count 가 런타임까지 전달될 수 있다.

- **[INFO]** `WARNING_KO` 레코드에서 `"Count must be entered."` 키 삭제 — 번역 조회 결과 변경
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` L895 (제거)
  - 상세: `translateBackendWarning("Count must be entered.", "ko")` 호출 시 이전에는 한국어 문자열을 반환했으나, 변경 후에는 원문 영어 문자열을 반환하는 `pickKo` fallback 경로로 흐른다. warningRule 자체가 제거되어 이 키가 생성될 경로가 없다면 부작용 없다. 단, 아직 `loop:no-count` 경고가 저장된 기존 실행 로그·알림이 프론트엔드에 표시될 때 ko 번역이 유실된다.
  - 제안: 기존 실행 로그·알림 데이터에서 해당 경고 메시지가 렌더링될 가능성을 검토. 만약 있다면 `WARNING_KO` 에 키를 일정 기간 유지하거나, 영어 fallback 이 허용되는 UX 라면 제거가 안전하다.

- **[INFO]** `evaluateMetadataBlockingErrors(loopNodeMetadata, {})` 반환값 변경 — 빈 배열로 변경
  - 위치: `codebase/backend/src/nodes/logic/loop/loop.schema.spec.ts` L573–575
  - 상세: 이전 테스트는 빈 config 에 대해 `'Count must be entered.'` 를 반환하길 기대했으나, 이제 `[]` 를 기대한다. `evaluateMetadataBlockingErrors` 는 `warningRules` 와 `validateConfig` 양쪽을 통합 실행하는 함수이므로, `warningRules: []` 변경이 이 함수의 결과를 변경한 것이다. `validateLoopConfig` 는 `count` 가 `undefined`/`null`/빈 문자열인 경우 오류를 발생시키지 않도록 이미 구현되어 있어(`count !== undefined && count !== null && count !== ''` 조건) 결과적으로 빈 config 는 통과한다.
  - 제안: 없음. 의도된 정책 변경에 부합하는 결과다.

## 요약

이번 변경의 핵심은 `loopNodeMetadata.warningRules` 에서 `loop:no-count` 항목을 제거하고, 이에 연동된 테스트·i18n 매핑·주석을 정합화한 것이다. 부작용 관점에서 주요 위험은 두 가지다. 첫째, `LoopHandler.validate({})` 의 반환값이 `valid: false` 에서 `valid: true` 로 전환됨에 따라 zod parse 를 거치지 않는 직접 호출 경로(legacy 데이터, direct repo write, 또는 별도 검증 흐름)에서 빈 count 가 그대로 통과하는 새 동작이 발생한다. 이는 `execution-engine.service.spec.ts` 주석이 명시한 "runtime safety net" — `INVALID_CONTAINER_PARAM` throw — 에 의존하는 구조로, 런타임 단에서 최종 차단이 이루어진다. 둘째, `WARNING_KO` 에서 키를 즉시 삭제하면 이미 저장된 기존 로그의 한국어 번역이 유실될 수 있다. 전반적으로 변경은 의도된 설계 결정("최소 반복 1회 정책")에 충실하게 구현되었으며, 전역 변수 도입, 파일시스템 부작용, 네트워크 호출, 환경 변수 읽기/쓰기는 없다. 시그니처·인터페이스 수준의 변경은 `loopNodeMetadata.warningRules` 에 한정되며, 이 변경의 영향은 zod default 가 활성화된 정상 경로에서는 무해하다.

## 위험도

LOW
