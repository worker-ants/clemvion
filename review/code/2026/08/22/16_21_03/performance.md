# 성능(Performance) 리뷰 — `16_21_03`

## 스코프 확인

이 changeset 의 유일한 **실행 코드** 변경은
`codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` 에 대한 테스트 8건 추가뿐이다.
`sanitize-error-message.ts`(프로덕션 구현, `deepRedactSecrets`/`deepRedactCore`)는 diff 에
없다 — 즉 이번 PR 은 **알고리즘·캐시·I/O 를 바꾸지 않는다.** 나머지 파일(`plan/**`,
`review/**`)은 문서·리뷰 산출물이라 성능 관점 대상이 아니다.

프로덕션 코드를 직접 열어 새 테스트가 실제로 무엇을 왕복하는지 확인했다(`sanitize-error-message.ts:222-272`):

```
deepRedactCore(value, depth, opts):
  string  → 값 패턴 검사(깊이 무관)
  object  → depth >= MAX_REDACT_DEPTH(10) 이면 즉시 VALUE_MASK_MARKER 로 치환하고 하강 중단
          → 아니면 자식으로 재귀
```

depth 10 에서 하강을 멈추므로, `nestObj(depth, leaf)` 로 만든 입력이 얼마나 깊든(`depth` 가
5000 이든 10 이든) `deepRedactSecrets` 의 실제 순회 비용은 **O(min(depth, 10))** 로 상수에
가깝다 — `depth` 에 대해 선형으로 불어나지 않는다. 신설 회귀 테스트(아래)는 바로 이 상한이
실제로 구현에 반영돼 있는지를 검사하는 것이라, 성능 관점에서는 오히려 **DoS 방지 회귀
가드**로 읽힌다(상한이 사라지면 공격자 제어 깊은 페이로드가 스택 오버플로를 일으킬 수 있는
경로를 캐너리로 고정).

## 발견사항

- **[INFO]** 스택오버플로 회귀 테스트가 5,000-레벨 체인을 두 번 생성·순회한다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:377-382` (`run()` 클로저를
    `expect(run).not.toThrow()` 와 `expect(run()).toEqual(...)` 양쪽에서 각각 호출)
  - 상세: `nestObj(5000, 'Bearer sk-DEEP-END')` 로 5,000 단계 객체 체인을 만들고 `deepRedactSecrets`
    를 태우는 호출이 `run()` 내부에 있고, 이 클로저가 `it` 안에서 두 번 실행된다 — 트리 생성
    자체는 O(depth)=O(5000) 이고 순회는 위에서 확인한 대로 O(10) 이라 실질 비용은 낮다. 실측:
    이 파일 전체 76 케이스가 `jest` 로 **0.195s** 에 통과(직접 재실행 확인). 별도 최적화가
    필요한 수준이 아니다.
  - 제안: 우선순위 낮음(선택). 굳이 다듬는다면 `nestObj(5000, ...)` 결과를 변수에 한 번 캐시해
    `run()` 을 호출 1회(`toEqual` 반환값을 `not.toThrow` 검사에도 재사용)로 줄일 수 있으나,
    현재 비용이 무시 가능한 수준이라 필수는 아니다.

- **[INFO]** `nestObj`/`nestArr`/`nestMixed` 헬퍼는 각각 단순 `for` 루프 O(depth) 구성 — 성능
  문제 없음
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:276-292`
  - 상세: 문자열 누적이나 배열 `push`/재할당 반복 같은 O(n²) 패턴 없음. 매 반복 새 wrapper
    객체/배열 1개만 생성한다. depth 상한이 10~5000 범위인 테스트 코드이므로 시간·메모리 모두
    무시 가능.
  - 제안: 조치 불필요.

- **[INFO]** 신설 테스트는 프로덕션 `DEEP_REDACT_CACHE`(depth-0 `WeakMap` 캐시, `sanitize-error-message.ts:202`)
  경로를 그대로 통과한다 — 캐시 무효화나 메모리 누수 우려 없음
  - 위치: `sanitize-error-message.ts:222-235` (참고, diff 밖)
  - 상세: 새 테스트가 만드는 입력은 모두 지역 변수라 각 `it` 종료 후 GC 대상이고, 캐시 키가
    `WeakMap` 이므로 참조가 사라지면 엔트리도 함께 회수된다. 반복 실행 간 캐시 오염·누적
    가능성 없음.
  - 제안: 조치 불필요.

## 요약

이번 diff 는 테스트 전용이며 프로덕션 알고리즘·쿼리·I/O·캐싱 로직에 변경이 없다. 신설된 8개
경계 테스트는 `deepRedactSecrets` 가 `MAX_REDACT_DEPTH`(10)에서 하강을 멈춘다는 것을
검증하므로, 오히려 깊은 중첩 입력에 대한 O(depth) 스택 사용/잠재적 DoS 를 막는 상한이 실제로
동작함을 고정하는 회귀 가드다. 유일하게 언급할 만한 것은 5,000-레벨 회귀 테스트가 트리를 두
번 만든다는 점인데, 실측 스위트 실행시간이 0.195s(76 테스트)로 성능 리스크가 전혀 없다.
CRITICAL/WARNING 급 발견 없음.

## 위험도
NONE
