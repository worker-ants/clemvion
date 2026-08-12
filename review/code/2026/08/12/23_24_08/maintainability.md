# 유지보수성(Maintainability) 코드 리뷰

## 대상

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (프로덕션 — `switchMap` 콜백 리팩터 + `discardCorruptEntry` 신설)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (테스트 — 4건 신규 추가)
- `plan/in-progress/backend-lint-gate-broken-on-main.md` (plan 문서, 코드 아님 — 이 관점의 평가 대상 아님)

## 발견사항

- **[INFO]** `discardCorruptEntry` 공유 docstring 이 두 호출부의 "종전 동작"을 부정확하게 하나로 뭉갠다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:194-201` (`discardCorruptEntry` 메서드 docstring)
  - 상세: 이 메서드는 `'엔트리'`(바깥 JSON 파싱 실패)와 `'payload'`(안쪽 `responseJson` 파싱 실패) 두 자리에서 호출되는데, docstring 은 "종전에는 엔트리 손상을 **조용히** 무시했다" 라고만 적는다. 그런데 이 PR 이 참조하는 plan(`plan/in-progress/backend-lint-gate-broken-on-main.md` L610-617, gate 610-617)에 따르면 두 자리의 "종전" 동작은 서로 다르다 — 바깥 JSON 손상은 실제로 조용히 무시됐지만, 안쪽 `responseJson` 손상은 무시된 게 아니라 방어 없는 `JSON.parse` 가 `SyntaxError` 를 그대로 던져 `GlobalExceptionFilter` 가 500 으로 마스킹했다(침묵이 아니라 크래시). 공유 docstring 이 이 차이를 뭉개면, 나중에 `payload` 호출부만 읽는 사람이 "예전엔 조용히 넘어갔다" 로 오해하고 실제 위험(캐시 손상이 요청 자체를 죽인다)을 과소평가할 수 있다.
  - 제안: docstring 에 두 시나리오를 분리해 "엔트리 손상은 조용히 무시, payload 손상은 방어 없는 파싱이 그대로 500 으로 새어나감" 식으로 명시하거나, 최소한 "조용히" 라는 표현을 "가시성 없이"(무시든 크래시든 warn 로그가 없었다는 공통점) 로 완화한다.

- **[INFO]** 신규 테스트 4건이 추가됐지만 파일 최상단 모듈 docstring 이 그 세부를 나열하지 않아 세 번째 describe 블록과 상세도가 어긋난다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:11-13` (두 번째 describe 를 요약하는 모듈 docstring 문단)
  - 상세: 세 번째 describe(Redis 런타임 장애 fail-open)를 요약하는 문단(같은 파일 17-25행)은 "조회 실패 · 적재 실패 · 비-Error reject · catchError 위치 캐너리 · 직렬화 불가 payload(양 채널)" 처럼 서브케이스를 낱낱이 열거하고 warn 단언 대상까지 구체적으로 짚는다. 반면 이번 diff 로 캐시 히트 describe 에 4건(엔트리 손상 warn · payload 손상 warn · 파싱 순서 캐너리 2건)이 새로 들어왔는데, 그 블록을 요약하는 11-13행은 여전히 "손상 캐시 JSON fallback" 한 문구로만 남아 있다. 헤더만 보고 테스트 커버리지를 파악하려는 사람은 payload 손상 방어나 파싱 순서 계약(바깥 손상과 별개로 "bodyHash 판정이 payload 파싱보다 먼저" 라는 계약)이 테스트로 고정돼 있다는 사실을 헤더에서 알 수 없다.
  - 제안: 11-13행에 이번에 추가된 서브케이스(엔트리 vs payload 손상 구분, 파싱 순서가 bodyHash 판정 뒤라는 계약, 에러 재현 분기도 같은 방어를 받는다는 점)를 한두 문장으로 보강해 세 번째 describe 요약과 상세도를 맞춘다.

- **[INFO]** `discardCorruptEntry<T>` 의 제네릭이 현재는 단일 구체 타입(`Observable<unknown>`)에만 쓰인다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:202-206` (메서드 시그니처)
  - 상세: 호출부 두 곳 모두 `processFresh: () => Observable<unknown>` 만 넘기므로 제네릭 `<T>` 가 실질적으로 하나의 타입만 대신한다. 잘못된 코드는 아니고 향후 다른 반환 타입이 생기면 바로 값을 발휘하지만, 지금 시점에서는 `Observable<unknown>` 으로 고정해도 동작·가독성에 차이가 없다. 매우 경미한 스타일 판단이라 굳이 되돌릴 필요는 없다.
  - 제안: 조치 불요(관찰만). 추후 세 번째 호출부가 생기면 그때 제네릭의 값이 실증된다.

## 요약

두 파일의 diff 는 유지보수성 관점에서 전반적으로 양호하다. 프로덕션 코드는 `if (cachedJson) { … }` 한 단계 중첩을 조기 반환(`if (!cachedJson) return processFresh()`)으로 평탄화했고, 종전에 catch 분기와 최종 분기 두 곳에 흩어져 있던 `next.handle().pipe(this.cacheTapped(...))` 호출을 `processFresh` 클로저 하나로 묶었으며, `JSON.parse(cached.responseJson)` 을 재현 분기 두 곳에서 각각 부르던 중복도 `cachedPayload` 로 한 번만 파싱해 제거했다. 신설한 `discardCorruptEntry` 사설 메서드는 "손상 시 warn + 신규 처리로 강등" 이라는 반복 패턴을 이름 있는 단일 지점으로 모아 두 실패 경로(바깥 JSON·안쪽 payload)가 항상 같은 로그 포맷·같은 fail-open 동작을 갖도록 강제한다. 매직 넘버·과도한 함수 길이·깊은 중첩·순환 복잡도 급증 같은 심각한 문제는 diff 안에서 발견되지 않았고, 기존 파일의 주석 밀도·네이밍·에러 로그 포맷 컨벤션과도 일관된다. 테스트 파일에 추가된 4건도 기존 파일의 이미 확립된 패턴(각 테스트가 독립적으로 mock 을 구성하고 근거를 설명하는 긴 주석을 앞세우는 방식)을 그대로 따른다. 지적한 두 건은 모두 "새 코드가 옳은데 인접한 서술형 docstring 이 그 세부를 정확히·완전히 반영하지 못한다" 는 문서 완성도 수준의 사소한 갭이며, 동작·구조에는 영향이 없다.

## 위험도

LOW
