# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `assertAllUnique` 의 throw 메시지가 범용 유일성 가드치고는 소비 맥락(cross-tenant 테스트 무의미화, "Test suite failed to run" 동시 실패)에 강하게 결합돼 있다.
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:81-85`
  - 상세: 함수 자체는 `readonly string[]` 을 받는 범용 유일성 검사이지만, 에러 메시지는 이 특정 픽스처 모듈의 용례(“cross-tenant 테스트가 조용히 무의미해진다”)를 하드코딩한다. 지금은 이 모듈 전용(`__test-utils__`)이라 문제되지 않지만, 다른 배열에 재사용될 경우 메시지가 맥락에 맞지 않게 된다.
  - 제안: 현재 범위에서는 개선 불요(재사용 계획이 없고, 실패 시 원인 파악에 오히려 유리). 이 함수가 다른 모듈로 승격/재사용되는 시점에 메시지를 매개변수화하는 것을 검토.

- **[INFO]** 소스 텍스트를 직접 읽어 정규식으로 "배선(call site) 존재"를 검증하는 테스트 패턴은 정확한 포맷(단일 줄, 세미콜론 포함)에 의존한다.
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:42-56` (`callSites` 정규식 `/^\s*assertAllUnique\(ALL_WS\);/`)
  - 상세: 호출부가 향후 여러 줄로 개행되거나 세미콜론이 생략되면(ASI) 이 테스트가 실패한다. 다만 실패 방향이 "조용히 통과"가 아니라 "시끄럽게 RED" 이므로 안전한 방향이고, 이 저장소에는 이미 같은 패턴(`catalog-sync.spec.ts`, `catalog-docs-drift.spec.ts`, `config-env-coverage.spec.ts`)이 선례로 존재해 일관성 있는 컨벤션이다. 순수 정보 제공 목적으로만 기록.
  - 제안: 조치 불필요. 향후 호출부 포맷을 바꿀 계획이 있다면 테스트도 함께 갱신할 것.

이 외에 가독성·네이밍·함수 길이·중첩 깊이·매직 넘버·중복 코드·복잡도·일관성 관점에서 지적할 만한 문제는 발견되지 않았다.

- `assertAllUnique` 함수는 8줄, 순환 복잡도 2(단일 `if`)로 짧고 명확하다. 네이밍(`assert*`)은 같은 파일 트리의 `assertProductionConfig`·`assertWorkspaceIdReflectionWorks`·`assertCorsOriginsConfigured` 와 일관된다.
- `ALL_WS` 배열은 기존 7개 상수를 그대로 나열한 것으로 새 개념을 도입하지 않으며, 테스트(`workspace-id-fixtures.spec.ts:58-72`)가 "새 상수 추가 시 `ALL_WS` 누락"을 명시적으로 잡아 drift 를 방지한다.
- 세 파일(`uuid.ts`/`uuid.spec.ts`/`workspace-id-fixtures.ts`)에 중복돼 있던 nil-UUID 회귀 캐너리 근거 산문을 `uuid.ts` 의 `isUuidShaped` docstring 한 곳(SoT)으로 모으고 나머지는 1줄 포인터로 축약한 것을 실제로 확인했다(`codebase/backend/src/common/utils/uuid.ts:16-33`에 근거·앵커 정정 이력이 온전히 남아 있음) — 문서 중복 제거로 유지보수성을 개선하는 방향의 변경이다.
- `workspace-id-fixtures.spec.ts` 의 테스트 이름·주석은 각 테스트가 무엇을 방어하는지("판정이 살아 있는가", "헬퍼 존재 ≠ 호출", "새 상수가 가드를 비껴가지 않도록") 명확히 설명해 가독성이 높다.
- plan 문서(`plan/in-progress/auth-guard-reflection-hardening.md`)의 체크리스트 갱신은 이전에 미룬 두 항목(값 유일성 단언, nil-UUID 캐너리 SoT 통합)을 완료 처리하고 근거를 남긴 것으로, 코드 자체의 유지보수성에 영향을 주지 않는 문서 변경이다.

## 요약

이번 변경은 (1) 3개 스위트에 흩어져 있던 워크스페이스 UUID 픽스처 유일성을 로드 시점 런타임 가드(`assertAllUnique`)로 고정하고, (2) 4곳에 중복돼 있던 nil-UUID 회귀 캐너리 근거 산문을 프로덕션 호출부에 가장 가까운 `uuid.ts` docstring 하나로 통합해 나머지는 포인터로 축약한 것이 핵심이다. 두 변경 모두 오히려 기존의 중복·drift 위험을 줄이는 방향이며, 함수는 짧고 명확하고, 네이밍은 기존 `assert*` 가드 컨벤션과 일관되고, 테스트는 값이 아니라 배선(wiring)을 검증하는 의도가 주석으로 명시돼 있어 vacuous 테스트를 피했다. 사소한 INFO 2건(에러 메시지의 맥락 결합, 소스텍스트 정규식 테스트의 포맷 의존성)은 모두 현재 범위에서 실질적 위험이 없고 기존 컨벤션과 일치한다.

## 위험도

NONE
