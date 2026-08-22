# 부작용(Side Effect) 리뷰

## 리뷰 범위 요약

이번 diff 는 프로덕션 코드 변경이 **없다**. 실제 변경은:

1. `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` — 테스트 전용 추가(신규 `describe` 블록 + import 1개 추가)
2. `plan/complete/*.md`, `plan/in-progress/*.md` — plan lifecycle 이동/체크리스트 갱신 (문서)
3. `review/consistency/2026/08/22/15_35_56/*` — consistency-check 산출물 신규 추가 (문서/증빙)

프로덕션 로직 파일(`sanitize-error-message.ts`, `websocket.service.ts`, `strip-external-only-fields.ts` 등)은 이번 diff 에 포함되지 않았다 — 순수 테스트/문서 추가다. 따라서 시그니처 변경·공개 API 변경·환경 변수·네트워크 호출·이벤트/콜백 관점은 해당 사항 없음.

## 발견사항

- **[INFO]** 신규 테스트가 의존하는 모듈 레벨 캐시(`DEEP_REDACT_CACHE`)의 안전성 — 실제 위험 아님, 확인 기록
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` (신규 `describe('깊이 상한 경계 (MAX_REDACT_DEPTH)', …)` 블록, 게이트 274~383) / 근거 소스: `codebase/backend/src/shared/utils/sanitize-error-message.ts:202` (`const DEEP_REDACT_CACHE = new WeakMap<object, unknown>();`), `:222-235` (`deepRedactSecrets`)
  - 상세: `deepRedactSecrets` 는 depth 0(최상위 호출 인자)에서만 `WeakMap` 캐시를 조회/기록한다(`if (depth === 0 && …)`, `sanitize-error-message.ts:227`). 신규 테스트는 `PLAIN_SUBTREE`(`spec.ts:299`)라는 **동일 참조 객체**를 여러 테스트에서 leaf 로 재사용하지만, `nestObj`/`nestArr`/`nestMixed` 헬퍼가 매 호출마다 새 wrapper 객체를 생성하므로 `deepRedactSecrets` 에 전달되는 depth-0 루트는 매번 새 참조다 — leaf 참조 재사용이 캐시를 통해 다른 테스트의 기대값과 충돌할 여지는 없다. 모듈 스코프 `WeakMap` 이 파일 전체 테스트 실행 동안 유지되는 공유 상태이긴 하나, 캐시 키가 매번 새 객체라 오염 경로가 없음을 실제 구현을 대조해 확인했다. 별도 조치 불필요 — 기록 목적의 INFO.
  - 제안: 조치 불필요. 향후 이 describe 블록 안에서 `PLAIN_SUBTREE` 자체(또는 그 wrapper)를 depth-0 인자로 **직접** 재사용하는 테스트를 추가할 경우에만 재검토가 필요하다는 점만 유의.

- **[INFO]** 회귀 테스트가 5,000단 중첩 객체를 두 번 생성/순회
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:377-382` (`it('[회귀] 매우 깊은 입력에서도 던지지 않고, 상한 지점에서 잘린다', …)`)
  - 상세: `run()` 클로저가 `nestObj(5000, 'Bearer sk-DEEP-END')` 를 호출할 때마다 5,000단 객체 트리를 새로 구성한다. `expect(run).not.toThrow()` 와 `expect(run()).toEqual(...)` 두 단언이 `run()` 을 각각 독립 호출하므로 트리 구성 + `deepRedactSecrets` 호출이 총 2회 발생한다(캐시는 위 항목대로 매번 새 루트라 적중하지 않음). 실제 재귀 깊이는 `MAX_REDACT_DEPTH`(≈10)에서 조기 종료되므로 스택 오버플로 위험은 없고, 단지 5,000개 객체 할당이 두 번 일어나는 정도라 부작용이라 부를 수준은 아니다.
  - 제안: 조치 불필요(성능 관점의 사소한 중복이며 side-effect 카테고리에 해당하지 않음). 필요시 `const deep = run` 결과를 변수에 캐시해 1회 호출로 줄일 수 있으나 필수는 아니다.

- **[INFO]** `plan/`·`review/consistency/**` 신규 파일 추가는 프로젝트 컨벤션상 의도된 문서 산출물
  - 위치: `plan/complete/masked-marker-shared-package.md`, `plan/complete/mirror-guard-single-copy.md`, `plan/in-progress/masked-marker-shared-package.md`(삭제), `plan/in-progress/mirror-guard-single-copy.md`(삭제), `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, `review/consistency/2026/08/22/15_35_56/*`(신규 8파일)
  - 상세: 이들은 런타임 코드가 아니라 plan lifecycle 이동(`in-progress` → `complete`)과 사전 `/consistency-check` 산출물이다. `review/**` 는 저장소 컨벤션상 gitignore 대상이 아니고 PR 근거로 커밋되는 것이 의도된 동작이라, "예상치 못한 파일시스템 부작용"에 해당하지 않는다.
  - 제안: 조치 불필요.

## 요약

프로덕션 소스 변경이 전혀 없는 테스트 전용 + 문서 전용 diff다. 새로 추가된 테스트가 의존하는 모듈 레벨 `WeakMap` 캐시(depth-0 전용 키)의 안전성을 실제 구현(`sanitize-error-message.ts:202-235`)과 대조해 확인했고, 테스트 헬퍼가 매 호출 새 루트 객체를 만들기 때문에 leaf 객체(`PLAIN_SUBTREE`) 재사용이 캐시 오염이나 테스트 간 상태 누출로 이어지지 않는다. 전역 변수 신설, 시그니처/공개 API 변경, 환경 변수, 네트워크 호출, 이벤트/콜백 변경은 모두 해당 사항이 없다. plan/review 문서 파일 추가는 프로젝트 컨벤션에 부합하는 의도된 산출물이다.

## 위험도
NONE
