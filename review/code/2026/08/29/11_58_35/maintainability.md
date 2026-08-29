# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** "예외 캡처 + vacuity-guard" 보일러플레이트가 같은 파일 안에서 거의 그대로 반복된다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:147-162`(기존 "cause 보존" 테스트) 과 `:177-190`(신규 C2 캐너리)
  - 상세: 두 테스트 모두 `const config = { url: '{{ $input. }}' }` → `let thrown: unknown; try { service.resolveConfig(...) } catch (err) { thrown = err; }` → `expect(thrown).toBeInstanceOf(Error)` → `const cause = (thrown as Error).cause` → `expect(cause).toBeInstanceOf(Error)` 순서를 문자 그대로 반복한다. "vacuity 방지" 주석 문구도 표현만 다를 뿐 같은 내용이다. 동일한 패턴이 `codebase/backend/src/nodes/data/code/code.handler.spec.ts:205-218`(기존 "원본 컴파일 예외를 cause 로 보존한다")와 `:244-261`(신규 C2 캐너리) 사이에도 반복된다 — 둘 다 `{ code: 'this is ( not valid js' }` 로 `handler.execute()` 를 호출하고 같은 try/catch 캡처를 쓴다. 이번 diff 로 각 파일에서 이 패턴의 인스턴스가 1개→2개로 늘어나, 지금이 추출을 정당화하는 시점이다 — 세 번째 캐너리가 추가되면 복붙이 3회가 된다.
  - 제안: `throwsAndCapture(fn: () => unknown): unknown` 같은 로컬 헬퍼(또는 `captureThrown`)로 try/catch 캡처 부분을 추출하고, 각 테스트는 헬퍼 호출 + 고유 단언만 남긴다. vacuity-guard 주석은 헬퍼 자체의 JSDoc 으로 한 번만 적으면 두 파일 다섯 곳(기존 2 + 신규 2 + 형제 파일)에 흩어진 동일 설명을 한 곳으로 모을 수 있다.

- **[INFO]** 신규 테스트 앞에 붙은 근거 주석이 코드 본문보다 훨씬 길다
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:164-176`(C2 캐너리 앞 13줄 주석, 실제 테스트 본문은 14줄)
  - 상세: 이 파일의 기존 관례(예: 147행 이전 133-146행 주석)와 같은 스타일이라 이번 diff 가 새로 만든 문제는 아니다. 다만 "화이트리스트는 실측이다", "enumerable 인 이유" 같은 근거 설명이 테스트 파일에 그대로 박혀 있어, 향후 §6.3.1 판정 기준이 바뀌면 이 자리도 함께 갱신해야 한다 — 실제로 같은 주석이 이미 한 번 "C1 만 적고 있어 정본과 갈렸다"는 이력을 언급한다(137-139행). `code.handler.spec.ts:237-238`은 이 설명을 반복하지 않고 "그쪽 주석에 있다"로 참조만 해 중복을 피한 점은 좋다.
  - 제안: 현 상태를 막을 필요는 없으나, "enumerable 을 쓰는 이유"·"화이트리스트 실측 방법론" 같은 축 설명 자체는 정본(`spec/5-system/3-error-handling.md` §6.3.1 또는 그 Rationale)에 한 번만 두고, 테스트 파일에는 "이 자리가 어떻게 만족하는가"만 남기는 원칙을 한 단계 더 밀어붙이면 3중 동기화 비용을 줄일 수 있다.

- **[INFO]** 두 신규 C2 캐너리의 단언 형태가 다르다 (화이트리스트 vs 빈 집합) — 의도된 차이인지 확인 필요
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:190`(`Object.keys(cause).sort()).toEqual(['code', 'name', 'position'])`) vs `codebase/backend/src/nodes/data/code/code.handler.spec.ts:260`(`Object.keys(cause as object)).toEqual([])`)
  - 상세: 하나는 정렬 후 화이트리스트와 비교, 다른 하나는 빈 배열과 비교라 정렬이 필요 없다. 두 테스트 모두 새 속성이 하나라도 붙으면 실패하는 fail-closed 설계는 동일하지만, 표현 방식(정렬 유무)이 갈리는 이유가 각 파일 주석에 설명돼 있어(실측 결과가 다르다) 실제로는 일관성 문제가 아니라 데이터 차이의 정확한 반영이다. 리뷰 시점에 "왜 다른가"를 헷갈릴 수 있어 INFO 로만 남긴다 — 조치 불요.

## 요약

이번 변경은 대부분 세 spec 파일에 `cause` 의 enumerable own key 를 잠그는 회귀 테스트("C2 캐너리")를 추가하고, `secret-resolver.service.ts` 에 판정 근거를 보강하는 주석 한 문단을 붙이고, plan 문서의 체크박스·실측 기록을 갱신한 것이다. 새로 추가된 프로덕션 코드는 없고 전부 테스트·주석·plan 이라 구조적 위험은 낮다. 다만 새 캐너리 두 건이 바로 위에 있는 기존 "cause 보존" 테스트의 캡처 보일러플레이트를 문자 그대로 복제해, 같은 패턴의 인스턴스가 파일당 2개로 늘었다 — 지금 추출하면 향후 세 번째 캐너리가 붙을 때 비용이 줄어든다. 그 외에는 네이밍·중첩·매직넘버·복잡도 면에서 기존 파일 컨벤션과 일관되고 문제될 부분이 없다.

## 위험도
LOW
