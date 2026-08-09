# 테스트(Testing) 리뷰 — auth-guard-reflection-hardening 후속 (fixtures 유일성 가드 + 문서 SoT 정리)

## 발견사항

- **[WARNING]** `ALL_WS 가 export 상수 전부를 담는다` 테스트가 "새 상수 누락"을 실제로는 못 잡는 경로가 있다
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:58-72` (`it('ALL_WS 가 export 상수 전부를 담는다 …')`)
  - 상세: 이 테스트는 `[...ALL_WS].sort()` 를 스펙 파일에 **하드코딩된** 7개 named-import 배열과 비교한다. 테스트 주석은 "상수를 추가하고 `ALL_WS` 에 넣는 것을 잊으면 그 값은 유일성 검사를 받지 않는다 — 여기서 명시적으로 대조해 그 누락을 잡는다" 고 주장하지만, 실제로 이 테스트가 그 상황을 잡으려면 **누군가 새 상수를 이 스펙 파일의 import 목록에도 추가해야 한다**는 전제가 필요하다. 만약 제3의 소비 스위트 작성자가 `workspace-id-fixtures.ts` 에 새 상수(예: `FOURTH_WS`)를 추가하면서 `ALL_WS` 에 넣는 것을 잊고, 동시에 (당연히) 이 spec 파일도 건드리지 않는다면 — `ALL_WS` 는 여전히 7개, 이 테스트의 하드코딩 배열도 여전히 7개라 **둘이 우연히 일치해 GREEN 이 나온다**. 즉 테스트가 방지하겠다고 선언한 바로 그 실패 모드(새 상수가 유일성 검사를 조용히 비껴감)가 재현되는 시나리오에서 이 테스트는 신호를 주지 못한다. 모듈 최상위의 `assertAllUnique(ALL_WS)` 런타임 체크도 `ALL_WS` 안에 없는 값은 애초에 검사 대상이 아니므로 이중으로 방어되지 않는다.
  - 제안: `import * as fixtures from './workspace-id-fixtures'` 형태로 모듈 네임스페이스를 통째로 가져와 `Object.entries(fixtures)` 에서 `string` 타입 값(즉 `ALL_WS`·`assertAllUnique` 를 제외한 나머지)을 자동 추출해 `ALL_WS` 와 대조하면, 스펙 파일을 갱신하지 않아도 모듈 쪽 export 목록 변화를 그대로 반영해 이 갭이 닫힌다. 최소한 이 갭(스펙 파일의 리스트도 함께 갱신해야만 유효하다는 전제)을 테스트 docstring 에 명시해 다음 사람이 "이 테스트가 있으니 안전하다"고 오판하지 않게 하는 것도 대안이다.

- **[INFO]** 로드 시점 배선(wiring) 검증이 소스 텍스트의 정확한 포맷(세미콜론·줄바꿈 없음)에 결합돼 있다
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.spec.ts:42-56` (`it('모듈이 로드 시점에 실제로 가드를 부른다 …')`)
  - 상세: `readFileSync` 로 원본 `.ts` 파일을 읽어 `/^\s*assertAllUnique\(ALL_WS\);/` 정규식으로 호출 줄 존재를 확인한다. "헬퍼 존재 ≠ 호출"을 잡기 위한 접근으로 타당하고 주석에도 근거가 잘 적혀 있으나, 세미콜론 생략(포매터 정책 변경)·여러 줄에 걸친 호출·인라인 옵션 인자 추가 등 순수 리팩터링성 포맷 변경에도 이 테스트가 (허위) RED 를 낼 수 있다. 실질적 위험은 낮음(포맷 변경 시 CI 가 즉시 드러내고 원인도 명백함)이라 INFO 로 표기.
  - 제안: 현재로도 충분히 실용적인 트레이드오프이므로 필수 수정은 아님. 다만 향후 이 파일에 손을 댈 때 정규식이 아니라 TS AST(`ts.createSourceFile` 등)로 최상위 `ExpressionStatement` 를 찾는 방식으로 바꾸면 포맷에 비의존적이 된다 — 다만 이는 이미 memory 에 기록된 "정적 가드: blind 정규식 vs 정밀 파서" 판단 기준상 이 정도 스코프(단일 파일 자기 검증)에서는 정규식으로도 충분하다고 볼 수 있다.

- **[INFO]** 경계 케이스(전부 동일 값, 3개 이상 중복)는 테스트되지 않았으나 로직이 `Set` 기반 단순 카운트라 실질 위험 낮음
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:78-86` (`assertAllUnique`)
  - 상세: 현재 테스트는 정확히 1쌍의 중복(`['a','b','a']`)만 다룬다. `['a','a','a']`(전부 동일) 이나 `['a','a','b','b']`(두 쌍 중복) 같은 형태는 다루지 않는다. 함수 구현이 `Set` 크기 비교라 이런 형태에서 로직 분기가 없어 회귀 위험은 낮다.
  - 제안: 우선순위 낮음. 필요하면 스펙에 1-2개 케이스 추가로 완성도를 높일 수 있으나 현재도 핵심 계약(유일/비유일 판정, 메시지 포맷, 로드 시점 배선)은 충분히 커버됨.

- **[INFO]** `uuid.spec.ts` / `workspace-id-fixtures.ts` 의 변경은 docstring/주석 정리(SoT 단일화)뿐이라 테스트 영향 없음
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts:49-58`, `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:47-51`
  - 상세: 로직 변경이 없고 기존 `it` 블록·assertion 은 그대로 유지되므로 회귀 테스트 관점에서 문제 없음. 다만 "이 둘이 유일한 방어선이다"라는 서술이 이제 두 곳(주 SoT `uuid.ts` docstring, 캐너리 사본 `uuid.spec.ts`)에만 남고 나머지는 포인터로 축약됐는데, `uuid.ts` 의 실제 프로덕션 호출부 단언(`workspace-context.util.ts:74` 한 곳)은 정적 서술일 뿐 테스트로 강제되지 않는다 — 새 호출부가 추가돼도 이 주석은 조용히 stale 해질 수 있다. 이는 코드 리뷰(문서 SoT) 영역이라 테스트 리뷰의 책임 범위 밖으로 판단해 낮은 등급으로만 기록.

## 요약

이번 변경은 순수 테스트 인프라(공용 픽스처 유일성 가드 + 관련 docstring SoT 정리)로, `assertAllUnique` 자체에 대한 신규 spec(`workspace-id-fixtures.spec.ts`)이 정상/이상/경계/배선 검증까지 골고루 갖춰져 있고, 판정 로직이 살아있는지(호출 여부)까지 별도로 확인하는 등 이 저장소가 과거 겪은 "vacuous test" 클래스를 의식한 설계다. 다만 "새 상수가 유일성 검사를 조용히 비껴가지 않도록" 막는다고 주장하는 export-완전성 테스트가, 스펙 파일 자신의 하드코딩 목록과 모듈의 `ALL_WS` 가 동시에 stale 해지는 경로에서는 실제로 그 실패 모드를 탐지하지 못하는 설계상 허점이 있어 WARNING 으로 등재한다. 그 외에는 로드 시점 배선 검증의 포맷 결합성 정도가 경미한 INFO 사항이며, `uuid.spec.ts` 변경은 순수 주석 정리로 회귀 위험이 없다.

## 위험도
LOW
