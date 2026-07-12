# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** "drift 가드" 신규 테스트 2쌍이 SoT 배열 자체의 **순서 변경**은 탐지하지 못한다 (mutation-test 로 실증)
  - 위치: `execution-status-response.dto.spec.ts` `status.enum 은 공유 SoT 배열과 값·순서가 동일하다` / `interact-ack-response.dto.spec.ts` `currentStatus.enum 은 공유 SoT 배열과 값·순서가 동일하다`, 그리고 두 파일의 `wire SoT 는 엔티티 ExecutionStatus 상태 집합과 동일하다` 테스트.
  - 상세: 실제로 `execution-status.literal.ts` 의 `EIA_EXECUTION_STATUS_VALUES` 순서를 엔티티 순서(`pending,running,completed,failed,cancelled,waiting_for_input` — JSDoc 이 명시적으로 "wire 순서와 다르다"고 지적하는 그 순서)로 재배열한 뒤 두 spec 파일을 함께 돌려봤다 (`npx jest execution-status-response.dto.spec.ts interact-ack-response.dto.spec.ts`) — **21개 테스트 전부 green** 으로 통과했다(변경 후 즉시 원복 확인, `git diff` clean).
    - 첫 번째 테스트(`status.enum` toEqual `[...EIA_EXECUTION_STATUS_VALUES]`)는 OpenAPI 문서의 `enum` 이 **같은 심볼**을 가리키므로 본질적으로 tautological 하다 — swagger 데코레이터가 SoT 를 실제로 소비하는지(하드코딩 배열로 되돌아가지 않았는지)만 검증하고, SoT 자체의 순서가 옳은지는 검증하지 않는다.
    - 두 번째 테스트(엔티티↔wire drift 가드)는 의도적으로 `.sort()` 한 뒤 비교하므로 **순서 불변식을 명시적으로 면제**한다(엔티티와 wire 순서가 다르다는 설계 때문에 불가피). 즉 값 집합의 누락/오타/추가는 잡지만 순서는 절대 못 잡는다.
  - 이 파일의 JSDoc 은 "엔티티 enum 순서가 wire enum 배열 순서와 달라 로컬 리터럴을 wire SoT 로 둔다"고 명시해 **순서 자체가 의도된 wire 계약**임을 강조하는데, 그 계약을 고정(pin)하는 테스트가 어디에도 없다. 향후 누군가 실수로(혹은 "일관성" 명목으로) `EIA_EXECUTION_STATUS_VALUES` 배열 순서를 바꿔도 현재 스위트는 무음으로 통과한다 — OpenAPI 문서의 `enum` 배열 순서가 SDK 코드 생성기·문서 소비자에게 wire-visible 하다는 점(RESOLUTION.md 도 "값·순서" 를 함께 언급)을 고려하면 실질적 회귀 안전망 공백이다.
  - 제안: `execution-status.literal.ts` (또는 신규 `execution-status.literal.spec.ts`) 에 하드코딩된 기대 배열로 순서를 고정하는 단언 1개 추가:
    ```ts
    expect(EIA_EXECUTION_STATUS_VALUES).toEqual([
      'pending', 'running', 'waiting_for_input',
      'completed', 'failed', 'cancelled',
    ]);
    ```
    이렇게 하면 (a) swagger 출력이 SoT 를 반영하는지, (b) SoT 가 엔티티와 값 집합이 일치하는지, (c) SoT 자체의 정확한 순서 — 3단을 모두 커버해 실제 "drift 가드" 라는 이름에 부합하게 된다.

- **[INFO]** `execution-status.literal.ts` 자체의 전용 spec 파일 부재 — 간접 커버리지에 의존
  - 위치: `execution-status.literal.ts` (신규 파일, spec 없음)
  - 상세: 신규 SoT 상수/타입은 두 소비 DTO 의 spec 을 통해서만 간접 검증된다. 실질적 위험은 낮다(위 WARNING 에서 실증했듯 두 소비처 spec 이 모두 동일한 값-집합 검증을 중복 수행하므로 한쪽이 나중에 리팩터로 제거돼도 다른 쪽이 남을 가능성이 높다). 다만 전용 spec 이 있었다면 위 WARNING 의 순서 고정 테스트를 자연스럽게 그 파일에 둘 수 있었다.
  - 제안: 위 WARNING 해소 시 `execution-status.literal.spec.ts` 를 신설해 그곳에 순서 고정 테스트를 두는 편이, DTO 스키마 spec 파일에 SoT 내부 값 검증 책임을 얹는 것보다 관심사 분리 측면에서 낫다.

- **[INFO]** "엔티티↔wire drift 가드" 테스트가 두 spec 파일에 동일 로직으로 중복
  - 위치: `execution-status-response.dto.spec.ts` 와 `interact-ack-response.dto.spec.ts` 양쪽의 `wire SoT 는 엔티티 ExecutionStatus 상태 집합과 동일하다` 테스트 — assertion 내용이 글자 그대로 동일(`[...EIA_EXECUTION_STATUS_VALUES].sort()` vs `Object.values(ExecutionStatus).sort()`).
  - 상세: 이 불변식은 "공유 SoT 자체"에 대한 것이지 각 DTO 고유의 것이 아니라서, DTO 가 3개·4개로 늘어날 때마다 동일 테스트가 계속 복제될 가능성이 있다. 기능적으로 문제는 없고(오히려 각 소비처가 독립적으로 회귀 가드를 갖는 것은 나쁘지 않음), 다만 SoT 값 자체가 바뀔 때 실패 지점이 여러 파일에 흩어져 진단 노이즈가 생긴다.
  - 제안: 필수는 아님. 위 두 INFO/WARNING 을 함께 해소하며 `execution-status.literal.spec.ts` 로 이 불변식 검증을 1곳으로 옮기고, 각 DTO spec 에는 "그 DTO 의 enum 이 SoT 를 실제로 참조하는지"만 남기는 방향을 고려할 것.

## 검증한 사항 (문제 없음)

- 실제로 두 spec 파일을 함께 실행해 **21개 테스트 전원 green** 확인 (`execution-status-response.dto.spec.ts` 15개 기존 + 2개 신규, `interact-ack-response.dto.spec.ts` 신규 4개 = 21, RESOLUTION.md 기재치와 일치).
- Mock 적절성: 두 spec 모두 실제 `SwaggerModule.createDocument()` 로 OpenAPI 문서를 생성해 검증한다(가짜 데코레이터 메타데이터 읽기가 아님) — `@ApiExtraModels` 누락으로 인한 dangling `$ref` 같은 실제 문제를 잡을 수 있는 패턴이며, 과도한 mocking 이 없다.
- 테스트 격리: 각 spec 파일이 자신의 `Test.createTestingModule` + `app.init()`/`app.close()` 를 `beforeAll`/`finally` 로 독립 수행 — 두 파일을 병렬/순차 어느 쪽으로 실행해도 상태 공유가 없다(HTTP 리스닝 없이 Nest context 만 빌드하므로 포트 충돌도 없음). `interact-ack-response.dto.spec.ts` 의 `currentStatus 는 optional 이다` 테스트도 독립적으로 필드 optionality 를 검증해 엣지 케이스(명령 직후 미관측 가능성)를 커버한다.
- 회귀 테스트: `ExecutionStatusDto`/`InteractAckDto` 의 기존 15개 스키마 회귀(oneOf, discriminator 부재, nullable, additionalProperties 등)는 이번 변경(리터럴 유니온 → 공유 상수 참조 치환)으로 영향받지 않으며, 실제로 green 임을 재확인했다 — `status`/`currentStatus` 필드의 런타임 wire 표현이 동일하므로 회귀 리스크 없음.
- 테스트 용이성: `EIA_EXECUTION_STATUS_VALUES`/`ExecutionStatusLiteral` 이 순수 상수/타입으로 export 되어 있어 DI 없이 바로 import 가능 — 테스트하기 쉬운 구조.
- `interact-ack-response.dto.spec.ts` 신설로 이전 리뷰(19_49_01) WARNING 2건(신규 SoT 값 미검증, InteractAckDto 스키마 회귀 부재)은 실질적으로 해소됐다 — 다만 그 해소 과정에서 추가된 "순서 검증"이 위에서 지적한 대로 불완전(tautological/order-agnostic)하다는 점이 잔여 갭이다.

## 요약

원 리뷰(19_49_01)의 두 WARNING(신규 SoT 값 미검증, InteractAckDto 스키마 회귀 부재)은 이번 diff 로 실제로 해소됐고, 21개 테스트가 실행 확인상 모두 green 이다. Mock 사용은 적절(실 SwaggerModule 생성)하고 테스트 격리·가독성도 양호하다. 다만 mutation-test 로 직접 실증한 결과, 신규 추가된 두 "drift 가드" 테스트 쌍은 SoT 배열(`EIA_EXECUTION_STATUS_VALUES`) 자체의 **순서**가 바뀌어도(엔티티 순서로 되돌려도) 무음으로 통과한다 — 첫 테스트는 동일 심볼을 비교하는 tautology 이고, 두 번째 테스트는 의도적으로 `.sort()` 해 순서를 면제하기 때문이다. 이 파일의 JSDoc 이 명시적으로 "순서가 다르기 때문에 로컬 SoT 를 둔다"고 밝힌 만큼, 정작 그 순서를 고정하는 하드코딩 assertion 이 스위트 어디에도 없다는 점은 실질적 회귀 안전망 공백이며 WARNING 으로 판단한다. 부수적으로 SoT 전용 spec 파일 부재·중복 테스트 로직은 INFO 수준의 구조 개선 여지다.

## 위험도

MEDIUM
