# 유지보수성(Maintainability) 리뷰

## 개요

이번 변경은 동시성 e2e 아홉 파일(11 블록)에 손으로 복제돼 있던 "락 획득 → 요청 발사 → 공허성
가드(`Promise.race` + 1.5초 타임아웃) → COMMIT → 결과 반환 → ROLLBACK/pending 흡수" 보일러플레이트를
`codebase/backend/test/helpers/concurrency.ts` 의 `raceUnderHeldLock()` 단일 함수로 추출한 순수
리팩터다(`codebase/backend/src/**` 변경 0). 각 e2e 파일은 락 SQL·params·발사할 thunk 배열만 넘기고,
정렬 로직과 단언은 호출부에 그대로 남겼다.

## 발견사항

- **[INFO]** 공유 상수가 사용 지점보다 파일 뒤쪽에 선언되어 있다
  - 위치: `codebase/backend/test/helpers/concurrency.ts:87` (선언), 사용은 `:67`
    (`setTimeout(() => resolve('pending'), VACUITY_GUARD_MS)`)
  - 상세: `VACUITY_GUARD_MS` 상수가 이를 사용하는 `raceUnderHeldLock()` 함수(38~81줄) 아래,
    파일 맨 끝(83~87줄)에 선언되어 있다. `const` 는 호이스팅되지 않으므로 런타임 동작에는
    문제가 없지만(함수가 실제로 호출되는 시점엔 이미 모듈 평가가 끝난 뒤이므로), 위에서
    아래로 읽는 독자는 `VACUITY_GUARD_MS` 를 만나는 시점(67줄)에 아직 그 값·근거를 보지
    못한 채 87줄까지 스크롤해야 한다.
  - 제안: 상수 선언을 함수 정의 위(예: import 직후)로 옮기면 선형 가독성이 개선된다. 사소한
    스타일 이슈라 blocking 은 아니다.

- **[INFO]** 1.5초 대기 시간의 근거 설명이 두 곳에 중복 서술돼 있다
  - 위치: `codebase/backend/test/helpers/concurrency.ts:60-63` (함수 본문 인라인 주석) 및
    `:83-86` (`VACUITY_GUARD_MS` 선언 위 JSDoc)
  - 상세: "트리거 삭제 경로의 `lock_timeout` 이 5초라 그 아래여야 한다" 는 동일한 근거가
    함수 본문 주석과 상수 JSDoc 양쪽에 거의 같은 문장으로 반복된다. 지금은 문제 없지만,
    향후 근거가 바뀌면(예: `lock_timeout` 값이 조정되면) 두 곳 중 한 곳만 갱신되고 다른
    한 곳이 stale 로 남을 위험이 있다.
  - 제안: 상수 선언을 함수 위로 옮기면(위 항목) 이 중복도 자연히 한 곳으로 합쳐진다 — 두
    지적이 같은 수정으로 해소된다.

## 정합성 확인 (문제 없음으로 판정한 것들)

- **중복 제거**: 9 파일 11 블록에 반복되던 `let pending`·`BEGIN`·`Promise.race`+`setTimeout`
  공허성 가드·`finally` 의 `ROLLBACK`/`pending?.catch` 블록이 각 호출부에서 완전히 사라지고
  `raceUnderHeldLock()` 한 곳으로 모였다. 각 호출부는 이제 락 SQL·params·발사 thunk 배열만
  전달하는 5~15줄짜리 선언적 코드로 줄었다 — DRY 원칙에 부합하는 교과서적 추출이다.
- **함수 길이·복잡도**: `raceUnderHeldLock()` 은 44줄, 조기 검증(`if (fires.length < 2) throw`)
  1개 + `try/finally` 1단 중첩뿐이다. 순환 복잡도가 낮고 책임이 "겹침 오케스트레이션 + 공허성
  가드" 하나로 명확히 좁혀져 있다.
  이 관대할 정도로 상세한 JSDoc(37줄)이 정당화된다.
- **정렬 로직을 헬퍼가 흡수하지 않은 것도 의도적 설계**: `@returns` 에 "정렬하지 않는다 —
  무엇으로 정렬할지는 호출부가 안다" 고 명시하고, 각 호출부가 `.sort((a,b)=>a.status-b.status)`
  또는 `.sort((a,b)=>a-b)` 를 그대로 유지한다. 형태는 반복되지만 호출부마다 정렬 키가 다르므로
  (`status` 단일 · `{status, code}` 복합) 헬퍼로 밀어 넣으면 오히려 제네릭이 과도하게 복잡해진다
  — 의도적 트레이드오프이며 plan(`plan/in-progress/e2e-race-helper.md` §D)에도 왜 상수화·통합
  대상에서 제외했는지 근거가 남아 있다.
- **제네릭 타입 파라미터 명시 여부 차이는 정당함**: `auth-config`/`member-remove`/`model-config`/
  `workspace-delete` 는 `raceUnderHeldLock<{ status: number; code?: string }>` 로 타입을 명시하고,
  `integration`/`schedule`/`trigger`/`workflow-delete` 는 명시하지 않는다. 전자의 발사 함수는
  실패 분기에서 `res.body?.error?.code` (사실상 `any`)를 반환해 타입 추론이 넓어질 수 있는
  경우이고, 후자는 단순 `number` 라 추론만으로 충분하다 — 불필요한 스타일 불일치가 아니라
  타입 안전성을 위해 필요한 곳에만 명시한 것으로 확인됐다.
- **매직 넘버**: 기존에 11곳에 흩어져 있던 `1_500` 리터럴이 `VACUITY_GUARD_MS` 상수 하나로
  집중됐다(파일 배치 순서를 제외하면 명명·문서화 모두 적절). `60_000`(jest 타임아웃)은
  plan 에서 명시적으로 "파일마다 다를 이유가 있어 일괄 상수화하지 않는다" 고 근거를 남기고
  헬퍼 밖(`it(...)` 인자)에 그대로 둔 것도 타당하다.
- **네이밍**: `raceUnderHeldLock`/`locker`/`lock`/`fires` 모두 함수 본문·JSDoc·기존 e2e 파일들의
  지역 변수명(`locker`)과 일관된다. 새 식별자가 기존 코드베이스와 충돌하지 않는다.
- **가드(guard) throw 메시지**: `fires.length < 2` 실패 시 받은 개수까지 포함한 에러 메시지를
  던져 디버깅에 유용하다. 다만 이 최소 길이 제약을 타입 레벨(튜플 타입)이 아니라 런타임
  검증으로만 강제하는 점은 트레이드오프이지 결함은 아니다 — 제네릭 배열에 컴파일타임
  최소 길이를 강제하는 타입은 가독성 비용이 커서, 문서화된 런타임 가드가 합리적 선택이다.
- **일관성**: 9개 e2e 파일 전체에서 호출 패턴, import 순서, 주석 스타일이 균일하게 치환되어
  있다. 리팩터 이전부터 있던 파일 간 사소한 주석 유무 차이(예: `workspace-delete`/
  `schedule-delete` 는 락 직전 도메인 설명 주석이 없고 다른 파일엔 있음)는 이번 diff 로
  새로 생긴 것이 아니라 원본에도 이미 있던 차이이며, 이번 변경이 그 차이를 확대하거나
  축소하지 않았다.

## 요약

`raceUnderHeldLock()` 추출은 유지보수성 관점에서 뚜렷한 순개선이다 — 9파일 11블록에 손으로
복제되던 공허성 가드 로직(가장 위험한, "빠뜨리면 조용히 거짓 초록이 되는" 부분)을 한 곳으로
모아 재사용 가능하고 테스트(음성 대조군 실측 11 RED)로 검증된 함수로 만들었고, 매직 넘버
`1_500` 도 이름 있는 상수로 집중시켰다. 함수 자체는 짧고 단일 책임이며 중첩도 얕다. 지적한
두 건은 모두 상수 선언 위치(사용부보다 아래)에서 파생되는 사소한 가독성·문서 중복 이슈로,
같은 한 줄 이동으로 함께 해소되며 기능이나 안전성에는 영향이 없다.

## 위험도

LOW
