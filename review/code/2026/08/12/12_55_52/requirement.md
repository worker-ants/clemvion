# 요구사항(Requirement) 리뷰 — `origin/main...HEAD` (backend lint warning 처분 시리즈, 5라운드째 확인)

대상 커밋(9개, `origin/main..HEAD`): `17221ecb9`→`e95201932`→`ba93680ab`(오염 revert)→
`9add2eba7`→`ee8e44e8f`→`67b7d7d77`→`7c7aee1c4`→`b0b57366f`→**`cec79b004`(이번 라운드가
새로 보는 마지막 커밋 — 직전 `12_40_58` 라운드 WARNING 1건 fix)**. 코드 변경 범위는
`codebase/backend` 14개 파일(+329/−30, 실질 로직 변경 없는 타입 전용 + idempotency 테스트
보강)이며, 이미 4라운드(`11_06_12`/`12_05_39`/`12_24_14`/`12_40_58`)의 `/ai-review` 를 거쳐
발견된 WARNING 은 모두 이전 라운드에서 조치됐다. 이번 라운드는 그 마지막 fix 커밋
(`cec79b004`)을 중심으로 **독립 재검증**했다.

## 독립 재검증 (직접 실행 — 이전 라운드 주장을 그대로 믿지 않음)

| 검증 | 방법 | 결과 |
|---|---|---|
| eslint 게이트 | `npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings 0` | **exit 0** (errors 0 / warnings 0) |
| 타입체크 ratchet | `python3 scripts/check-backend-typecheck-ratchet.py` | `OK: 199건 / 38파일 — baseline 과 일치` |
| `idempotency.interceptor.spec.ts` + `migrate-node-output-refs.spec.ts` | `npx jest <두 파일>` | **56 passed**(11+45), 주장과 일치 |
| `cec79b004` 실제 diff | `git show cec79b004 -- .../idempotency.interceptor.ts` | 프롬프트의 파일 8 diff와 완전히 동일 — 소스 코드가 실제로 이 커밋으로 반영됨을 확인 |
| Spec EIA §R8 원문 | `spec/5-system/14-external-interaction-api.md:1053` Read | "4xx 응답 중 `400 VALIDATION_ERROR` 만 idempotency cache 에서 제외하고, 그 외(성공 2xx / `409 Conflict` / `410 Gone`) 는 캐시한다" — 이전 라운드들의 인용과 정확히 일치 |
| `workspace-reflection-canary.ts` `as object` 제거 | 소스 직접 열람 | `typeof cls !== 'function'` 가드로 `cls` 가 이미 `Function` 으로 좁혀진 뒤 `handlerConsumesWorkspaceId(controllerClass: object, …)` 에 전달 — `Function` 은 구조적으로 `object` 의 부분집합이라 안전 |
| `SetupResult` 타입 정합 | `chat-channel/types.ts:454-467` vs `triggers.service.ts:1077` | `let result: SetupResult;` 와 `adapter.setupChannel(): Promise<SetupResult>` 선언이 정확히 일치 |
| TODO/FIXME/HACK/XXX | `git diff origin/main...HEAD -- codebase/` grep | 0건 |

## 발견사항

- **[INFO]** `IdempotencyInterceptor` 클래스 레벨 docstring 은 `400 VALIDATION_ERROR` 캐시
  제외만 언급하고, 바로 아래 `cacheTapped()` 의 private 메서드 docstring 이 상세히 설명하는
  "409·410 도 함께 캐시 제외되는 선재 결함(Spec EIA §R8 위반)" 은 반복하지 않는다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:51-62`
    (클래스 docstring, 특히 `:57` `- \`400 VALIDATION_ERROR\` 응답은 캐시 제외 …`)
  - 상세: 이 줄 자체는 **거짓이 아니다** — `400 VALIDATION_ERROR` 가 캐시 제외된다는 것은
    R8 과 정합하고, `12_40_58` fix 커밋이 이 줄을 "무고" 로 판정해 손대지 않은 것도 타당했다
    (`RESOLUTION.md` 표 확인). 다만 클래스 상단 docstring은 이 인터셉터를 처음 읽는 사람이
    가장 먼저 보는 자리인데, 실제로는 `409`/`410`/그 외 `5xx` 도 전부 캐시 제외된다는 사실은
    이 docstring 에 없고 90줄 아래 private 메서드 docstring(`:119-131`)에만 있다. 클래스
    docstring만 보고 넘어가면 "4xx 는 400 만 특별 취급, 나머지는 R8 그대로 캐시된다"로
    오독할 여지가 남는다.
  - 판단 근거: `[SPEC-DRIFT]` 아님(spec 이 권위이고 구현이 아직 spec 을 못 따라간 상태이며,
    이미 코드가 스스로 그 사실을 인정·문서화·캐너리로 고정했다) — 단순 문서 완결성 갭.
  - 제안: 강제 수정 아님. 다음에 이 클래스 docstring 을 만질 일이 생기면 `:57` 뒤에 "409/410
    도 현재는 함께 제외됨 — 선재 결함, `cacheTapped()` docstring 참조" 한 줄만 추가하면
    완결된다.

- **[INFO]** `intercept()` 의 `from(this.redis.get(redisKey))` 호출에 대한 오류 처리 부재는
  클래스 docstring 의 "Redis 미가용 시 fail-open" 주장과 완전히 정합하지 않을 수 있다 —
  단, 이번 diff 범위 밖(미변경 줄).
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:87`
    (`return from(this.redis.get(redisKey)).pipe(switchMap((cachedJson) => {...}))`)
  - 상세: 클래스 docstring(`:61`)은 "Redis 미가용 시 fail-open + warn 로그"라고 말하는데,
    이 fail-open 은 실제로는 **생성자 시점에 `this.redis` 가 null 인 경우**(`:82`
    `if (!rawKey || !this.redis) return next.handle();`)에만 적용된다. `this.redis` 가
    non-null 인 상태에서 `.get()` 호출이 런타임에 reject(네트워크 단절·`maxRetriesPerRequest`
    초과 등)되면 이 observable 은 에러로 종결되고, `cacheTapped()`(`:149-155`)의 `.set()` 처럼
    `.catch()` 로 감싸 fail-open 시키는 처리가 없어 요청 자체가 실패할 수 있다(문서가 약속한
    "멱등성은 클라이언트 측 retry 로 보강" 이전에 요청 자체가 500 으로 끝나는 경로).
  - 이 라인은 `git diff origin/main...HEAD` 범위 밖(이번 14개 파일 diff 중 어느 hunk 도 이
    줄을 건드리지 않음) — **이번 lint 처분 PR 이 만든 문제가 아니고, PR 의 "타입 전용/런타임
    미접촉" 정체성과도 무관**하다. R8 항목처럼 이번 PR 이 이 함수에 새 JSDoc(`HttpResponseLike`)
    을 붙였지만, 그 JSDoc 은 `getResponse()` 자리에 대한 것이지 이 `.get()` 자리에 대한 것이
    아니라서 R8 사례와 달리 "이번 PR 이 정면으로 문서화하며 재확인한 자리"도 아니다.
  - 제안: 이번 PR 을 막을 사유 아님. 관찰만 남긴다 — 필요하면 `plan/in-progress/backend-lint-gate-broken-on-main.md`
    §후속에 별도 항목으로 등재할 만하지만, 이 리뷰의 범위(diff 가 건드린 자리)를 벗어나므로
    강제하지 않는다.

- 그 외 관점 1~8(기능 완전성·엣지 케이스·TODO·의도-구현 일치·에러 시나리오·데이터
  유효성·비즈니스 로직·반환값)과 관점 9(spec fidelity)에서 새로 발견된 CRITICAL/WARNING
  없음. 이전 4라운드가 발견한 WARNING(테스트 이름의 §R8 오귀속, 손상 JSON 케이스 미검증,
  README 문구 불일치, 소스 주석의 §R8 오귀속)은 전부 후속 커밋(`b0b57366f`, `cec79b004` 등)에서
  조치됐고, 이번 라운드의 독립 재실행(위 표)이 그 조치의 실효성을 재확인했다. `execution-engine.service.ts`
  admission-control 의 `Array.isArray(rows)` 런타임 가드 미비, idempotency 캐시 제외 조건이
  `>= 400`으로 R8 보다 넓은 선재 결함은 여전히 **의도적으로 유예**된 상태이며(캐너리 테스트로
  고정, plan 백로그에 spec 인용과 함께 등재, fail-closed/영향 범위 명시), 이 판단은 4라운드에
  걸쳐 일관되게 재확인됐다.

## 요약

이번 라운드가 새로 보는 유일한 실질 변경(`cec79b004`)은 직전(`12_40_58`) 라운드가 지적한
"테스트 이름은 §R8 오귀속을 고쳤는데 소스 주석 3곳은 그대로 남았다"는 WARNING을 정확히
조치한다 — `git show`로 diff 전체를 확인하고 `spec/5-system/14-external-interaction-api.md`
§R8 원문을 재대조한 결과, 정정된 주석(`:42`, `:118-130`, `:157-159`)은 spec 원문과 정확히
일치하며 "무고"로 판정돼 손대지 않은 `:54-55`도 실제로 R8 과 정합한다. 독립 재실행으로
eslint 게이트(`--max-warnings 0` 통과)·타입체크 ratchet(199건/38파일 baseline 일치)·관련 jest
스위트(56 passed) 를 직접 재현해 커밋 주장과 모두 일치함을 확인했다. TODO/FIXME/HACK/XXX,
반환값 누락, 정의되지 않은 에러 경로는 발견되지 않았다. 새로 남기는 것은 INFO 2건뿐이다 —
(1) 클래스 docstring이 R8 선재 결함의 전모를 반복하지 않는 완결성 갭(하위 private 메서드
docstring 에는 이미 있음), (2) `intercept()`의 `redis.get()` 미보호 reject 가능성이 클래스
docstring 의 "fail-open" 주장을 완전히 충족하지 못할 수 있다는 관찰(단, 이번 diff 가 건드리지
않은 기존 줄이라 이 PR의 스코프 밖). 둘 다 강제 수정 사유가 아니며 이 PR 을 막을 근거가
아니다. `execution-engine.service.ts` admission shape 미검증과 idempotency 캐시 범위 초과라는
두 선재 결함은 4라운드에 걸쳐 일관되게 "의도적 유예 + 캐너리 고정 + plan 백로그 등재"로
처리됐고 이번 라운드도 그 판단을 뒤집을 근거를 찾지 못했다.

## 위험도

NONE

STATUS: OK
