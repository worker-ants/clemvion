# 유지보수성(Maintainability) 리뷰

## 리뷰 범위

실질 코드 변경은 4개 파일이다.

- `codebase/backend/src/shared/testing/overlap-preconditions.ts` (신규, 순수 함수 2개)
- `codebase/backend/src/shared/testing/overlap-preconditions.spec.ts` (신규, self-spec)
- `codebase/backend/test/helpers/concurrency.ts` (기존 인라인 검사 2개를 위 순수 함수 호출로 치환)
- `PROJECT.md` (파일 위치 컨벤션에 예외 한 줄 추가)

나머지(`plan/in-progress/*.md`, `review/consistency/**/*`)는 작업 추적·리뷰 산출물이며 실행되는
소스 코드가 아니라서 가독성·네이밍·함수 길이 등 코드 품질 관점의 대상이 아니다 — 별도 findings
로 다루지 않는다.

## 발견사항

- **[INFO]** 에러 메시지에서 호출자 식별 접두어(`raceUnderHeldLock:`)가 빠짐
  - 위치: `codebase/backend/src/shared/testing/overlap-preconditions.ts:27-30`(`assertEnoughFiresForOverlap`), `:54-57`(`assertGuardBelowKnownTimeouts`)
  - 상세: 리팩터 전 `test/helpers/concurrency.ts` 의 인라인 검사는 메시지 앞에 `raceUnderHeldLock:` 을 붙여 "어느 함수가 던졌는지" 를 바로 드러냈다. 순수 함수로 분리되며 이 접두어가 빠졌다 — 지금은 유일한 호출부가 `raceUnderHeldLock` 이라 실질 영향은 없지만, 다른 호출부가 이 헬퍼를 재사용하게 되면 예외 메시지만으로는 어느 e2e 헬퍼에서 발생했는지 알기 어려워진다.
  - 제안: 汎用 헬퍼이므로 접두어를 다시 넣기보다, 호출부 쪽(`raceUnderHeldLock`)이 필요 시 `try/catch` 로 컨텍스트를 덧붙이는 편이 낫다는 점만 인지해 두면 충분하다 — 지금 당장 수정할 필요는 없음.

- **[INFO]** 모듈 최상위 import-time 부수효과가 유지됨
  - 위치: `codebase/backend/test/helpers/concurrency.ts:31` (`assertGuardBelowKnownTimeouts(VACUITY_GUARD_MS, KNOWN_LOCK_TIMEOUTS_MS);`)
  - 상세: 리팩터 전에도 최상위 `for` 루프로 같은 부수효과가 있었으므로 이번 diff 가 새로 만든 문제는 아니다. 다만 "규칙은 순수 함수로 분리해 테스트 가능해졌다" 는 리팩터의 취지와 별개로, `concurrency.ts` 를 import 하는 모든 테스트가 여전히 이 조건이 성립해야만 로드된다는 결합은 그대로 남는다. plan 문서(`race-helper-guard-tests.md` §B) 가 이 이음매를 선례(`src/shared/testing/` 5쌍)와 동급으로 명시적으로 수용한다고 밝히고 있어 의도된 트레이드오프로 보인다 — 그대로 두어도 무방하다.

- **[INFO]** 양호한 점: 이전 중복 JSDoc 제거
  - 위치: `codebase/backend/test/helpers/concurrency.ts:20-24` (VACUITY_GUARD_MS 주석), `codebase/backend/src/shared/testing/overlap-preconditions.ts:33-47`
  - 상세: 리팩터 전에는 검사 근거 설명이 `concurrency.ts` 안에 인라인 주석으로만 있었다. 지금은 `concurrency.ts` 쪽 주석이 "SoT 는 `assertGuardBelowKnownTimeouts` 의 JSDoc — 여기 복제하지 않는다" 라고 명시하고 실제로 복제하지 않는다. 정보가 한 곳에만 있어 향후 두 자리가 서로 어긋나는(drift) 위험이 사라졌다 — 이번 변경 중 가장 눈에 띄는 유지보수성 개선점이다.

## 세부 관점별 평가

1. **가독성**: 두 함수 모두 짧고(각 6줄, 9줄) 무엇을 왜 검사하는지 JSDoc 에 명확히 서술돼 있다. 조건문도 단순(`if`, `for`+`if`)해서 읽기 쉽다.
2. **네이밍**: `assertEnoughFiresForOverlap`/`assertGuardBelowKnownTimeouts` 모두 "assert" 접두어 + 검사 대상이 드러나는 이름으로 일관적이다. 파라미터명(`fireCount`, `guardMs`, `timeouts`)도 단위·의미가 분명하다.
3. **함수 길이**: 두 함수 모두 10줄 이하, 단일 책임(입력 검증 하나씩)만 수행한다.
4. **중첩 깊이**: 최대 2단계(`for` → `if`)로 과도하지 않다.
5. **매직 넘버**: `overlap-preconditions.spec.ts` 의 `5_000`/`3_000`/`4_000`/`6_000` 등은 전부 `['FIRST_TIMEOUT_MS', 5_000]` 형태로 이름과 짝지어 있어 "매직"하지 않다. 원본 함수의 `fireCount < 2` 의 `2` 도 JSDoc 이 그 값의 근거(겹침에 필요한 최소 발사 수)를 설명한다.
6. **중복 코드**: 이번 diff 의 핵심 목적이 "인라인 중복 검사 → 재사용 가능한 순수 함수" 전환이며 실제로 중복을 줄였다(위 INFO 참고).
7. **코드 복잡도**: 순환 복잡도 낮음(분기 1~2개/함수).
8. **일관성**: 에러 메시지가 한국어인 점, JSDoc 스타일, self-spec 파일명 규칙(`*.spec.ts` 옆에 나란히) 모두 저장소의 기존 `src/shared/testing/` 5쌍 선례와 일치한다.

## 요약

이번 변경은 "주석으로만 존재하던 두 방어 규칙을 순수 함수로 승격해 self-spec 으로 직접 검증한다"
는 리팩터로, 유지보수성 관점에서는 개선에 해당한다. 함수는 짧고 단일 책임이며 이름이 명확하고,
검사 근거를 담은 JSDoc 을 한 곳(순수 함수 쪽)에만 두어 기존에 있던 잠재적 문서 drift 요인을
제거했다. 매직 넘버·과도한 중첩·중복·긴 함수 등 전형적 유지보수성 결함은 보이지 않는다. 발견한
두 INFO 항목(에러 메시지 접두어 소실, import-time 부수효과 잔존)은 모두 기능적으로 안전하고
plan 문서에서 이미 트레이드오프로 인지된 사안이라 즉시 조치가 필요하지 않다.

## 위험도
NONE
