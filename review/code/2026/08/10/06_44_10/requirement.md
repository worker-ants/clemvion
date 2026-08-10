# 요구사항(Requirement) 리뷰

## 검증 방법

- `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.{ts,spec.ts}`,
  `codebase/backend/src/common/utils/uuid.{ts,spec.ts}` 전문을 직접 Read.
- `npx jest src/common/__test-utils__/workspace-id-fixtures.spec.ts src/common/utils/uuid.spec.ts`
  실행 → 2 suites / 14 tests 전부 PASS 확인 (vacuous 아님, 실제로 도는 테스트).
- `npx tsc --noEmit -p tsconfig.json` 실행 → 대상 4 파일 관련 타입 에러 0건
  (`isolatedModules: true` 라 jest 자체는 cross-file 타입체크를 안 하므로, 주석이 언급한
  TS2677(`v is string` narrowing 실패) 회피가 실제로 유효한지 별도로 확인함).
- `grep -rn isUuidShaped codebase/backend/src` → 프로덕션 호출부가 `workspace-context.util.ts:74`
  단 한 곳임을 재확인 (uuid.spec.ts·workspace-id-fixtures.ts 가 "유일한 방어선" 이라 적은 근거 검증).
- `spec/data-flow/12-workspace.md`, `spec/5-system/1-auth.md`, `spec/5-system/3-error-handling.md` 에서
  `isUuidShaped`/`VALIDATION_ERROR` 관련 서술이 이미 이 docstring 통합 방향과 일치함을 확인
  (이번 diff 는 `spec/` 을 건드리지 않음 — 순수 codebase 문서 재배치 + 신규 가드/테스트).

## 발견사항

- **[INFO]** plan 문서의 서술이 실제 에러 메시지 내용을 살짝 과장한다.
  - 위치: `plan/in-progress/auth-guard-reflection-hardening.md:307` (게이트 307,
    "메시지가 개수를 말하므로 어느 쌍이 겹쳤는지 바로 좁혀진다")
  - 상세: `assertAllUnique` 의 throw 메시지(`workspace-id-fixtures.ts:82-84`, 게이트 82)는
    "고유 N / 전체 M" 카운트만 담고 있고, 어느 두 상수가 겹쳤는지(구체적 쌍/값)는 담지 않는다.
    "바로 좁혀진다"는 표현이 실제로는 "중복이 있다는 사실과 개수까지만 알 수 있고, 어느 쌍인지는
    소스를 열어 `ALL_WS` 를 눈으로 대조해야 한다"는 정도다. 기능 결함은 아니며 plan 서술의
    정밀도 문제.
  - 제안: 굳이 고치지 않아도 무방 (코드 동작에는 영향 없음). 다음에 이 plan 문단을 만질 일이
    있으면 "개수까지만 좁혀준다"로 완화 권고.

## 항목별 평가

1. **기능 완전성**: `assertAllUnique` + `ALL_WS` + 모듈 로드 시점 호출까지 완전히 구현됨.
   uuid.ts/uuid.spec.ts/workspace-id-fixtures.ts 세 곳에 흩어져 있던 nil-UUID 회귀 캐너리 근거를
   `uuid.ts` 의 `isUuidShaped` docstring 한 곳(SoT)으로 모으고 나머지 둘은 포인터로 축약 — plan
   이 명시한 목표와 diff 가 정확히 일치.
2. **엣지 케이스**: 빈 배열·단일 원소(위반 아님), 3개 중 1쌍 중복(위반) 모두 `workspace-id-fixtures.spec.ts`
   에서 테스트됨. `Set` 기반 중복 판정이라 순서·대소문자는 별도 고려 불필요(픽스처 값이 전부
   소문자 리터럴).
3. **TODO/FIXME**: 대상 4 파일에 TODO/FIXME/HACK/XXX 없음 (grep 확인).
4. **의도와 구현 간 괴리**: 없음. `assertAllUnique` 라는 이름과 "중복 있으면 throw" 동작이 일치.
   "순수 함수로 뺀 이유"(테스트 가능성) 주석과 실제로 별도 spec 파일에서 함수를 직접 호출해
   검증하는 구조가 일치.
5. **에러 시나리오**: 로드 시점에 던지므로 이 모듈을 import 하는 3개 소비 스위트가 전부
   "Test suite failed to run" 으로 동시 실패한다는 설명이 Node/Jest 모듈 로딩 시맨틱과 부합
   (import 시 top-level 코드가 실행되고 예외가 전파되면 그 모듈을 import 하는 모든 테스트
   파일의 suite 자체가 실패).
6. **데이터 유효성**: `ALL_WS` 는 `readonly string[]` 이고 `assertAllUnique(values: readonly string[])`
   시그니처가 이를 그대로 받음. 타입 수준에서 문자열 배열만 허용.
7. **비즈니스 로직**: "이름은 역할, 값은 불투명하되 서로 달라야 한다"는 픽스처 모듈 계약이
   런타임 가드로 정확히 인코딩됨. 자동 추출 테스트(`workspace-id-fixtures.spec.ts` 게이트 53-77)가
   "새 UUID 상수를 추가하고 `ALL_WS` 갱신을 잊으면 감지된다"를 보장 — 하드코딩 목록 대조 방식의
   결함(과거 리뷰에서 지적된 값)을 실제로 피함. `Object.values` 로 `ALL_WS`(배열)·`assertAllUnique`
   (함수) 자체가 섞여 들어와도 `typeof v === 'string'` 필터로 정확히 배제됨(직접 실행 확인).
8. **반환값**: `assertAllUnique` 는 통과 시 `void`(조기 `return`), 실패 시 `throw` — 모든 경로
   정의됨. 값을 반환할 필요가 없는 가드 함수라 `void` 가 적절.
9. **spec fidelity**: 이 변경 영역(`common/__test-utils__/*`, `common/utils/uuid*`)은 내부 테스트
   인프라이며 `spec/` 어디에도 `workspace-id-fixtures`/`assertAllUnique` 언급이 없음(grep 확인) —
   product spec 대상이 아니라 회색지대(INFO 대상조차 아님, 애초에 spec 이 다루는 레이어가 아님).
   단 `uuid.ts` 의 `isUuidShaped` 자체(로직 불변, docstring 만 재배치)는 `spec/data-flow/12-workspace.md`
   §Rationale 및 `spec/5-system/1-auth.md` 의 서술과 line-level 로 계속 일치함 — 이번 diff 가
   `isUuidShaped`/`isValidUuid` 판정 로직을 변경하지 않았으므로 spec drift 없음.

## 요약

`workspace-id-fixtures.ts` 에 값 유일성 가드(`assertAllUnique` + 로드 시점 호출)를 신설하고,
nil-UUID 회귀 캐너리 근거 문단을 `uuid.ts` 의 `isUuidShaped` docstring 한 곳으로 통합해 3곳
중복(uuid.ts·uuid.spec.ts·workspace-id-fixtures.ts)을 해소한 변경이다. 신규 `workspace-id-fixtures.spec.ts`
는 (a) 판정 함수 자체의 양방향 동작, (b) 모듈이 실제로 그 함수를 로드 시점에 호출하는지(소스
grep 방식), (c) `ALL_WS` 가 export 된 모든 UUID-형 상수를 자동 추출로 빠짐없이 담는지를 각각
겨냥해 과거 세 차례(하드코딩 목록·중복 제거·값 대조) 반증된 vacuous 패턴을 명시적으로 피했다.
직접 `npx jest`·`npx tsc --noEmit` 로 실행/타입 검증했고 실패 없음. plan 문서의 체크리스트도
실제 diff·이전 세션 이력과 정합한다. 발견된 문제는 plan 서술 정밀도에 관한 INFO 1건뿐이며
코드 결함이나 spec 불일치는 없다.

## 위험도

NONE
