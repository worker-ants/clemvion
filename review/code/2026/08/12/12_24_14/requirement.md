# 요구사항(Requirement) 리뷰 — backend lint warning 처분 누적 diff (3라운드째)

대상: `codebase/backend` lint `no-unsafe-*` warning 전량 처분(46→0) + `package.json`
`--max-warnings 0` 게이트 도입 + 관련 신규 테스트 + plan/review 산출물. 이 세션은 앞선 두
리뷰 라운드(`11_06_12`: CRITICAL 0/WARNING 0, `12_05_39`: CRITICAL 0/WARNING 2 — 둘 다
조치·재검증됨)의 누적 결과물을 다시 검토한다.

## 독립 재검증 (직접 실행)

| 검증 | 방법 | 결과 |
|---|---|---|
| eslint | `npx eslint "{src,apps,libs,test}/**/*.ts" -f json` (현재 워크트리 HEAD) | **errors 0 / warnings 0** — `--max-warnings 0` 게이트 실제 통과 확인 |
| 타입체크 ratchet | `python3 scripts/check-backend-typecheck-ratchet.py` | `OK: backend 타입 진단 199건 / 38파일 — baseline 과 일치` |
| `idempotency.interceptor.spec.ts` | `npx jest src/modules/external-interaction/idempotency.interceptor.spec.ts` | **9 passed**(신규 5건 포함) |
| `migrate-node-output-refs.spec.ts` | `npx jest src/scripts/migrate-node-output-refs.spec.ts` | **45 passed**(신규 Pass 2 1건 포함) |
| TODO/FIXME/HACK/XXX | 리뷰 대상 12개 소스 파일 grep | 0건 |
| `workspace-reflection-canary.ts` `as object` 제거 안전성 | `handlerConsumesWorkspaceId(controllerClass: object, …)` 시그니처와 `typeof cls !== 'function'` 가드 위치 직접 대조 | `cls` 는 이미 `Function` 으로 좁혀져 있고 `Function` 은 구조적으로 `object` 에 배정 가능 — 안전 |
| `SetupResult` 타입 정합 | `ChatChannelAdapter.setupChannel(): Promise<SetupResult>` (`chat-channel/types.ts:484`) vs `let result: SetupResult;` 사용부 | 일치 |

## 발견사항

- **[WARNING]** Idempotency 캐시가 Spec EIA §R8 이 명시한 것보다 넓게 캐시를 제외한다 — `400 VALIDATION_ERROR` 만이 아니라 `409`/`410` 을 포함한 **모든 4xx/5xx** 를 캐시 제외. 이번 diff 가 새로 심은 회귀 테스트가 이 동작을 "Spec EIA §R8" 이라는 이름으로 고정한다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:131`(`if (statusCode >= 400) return;`, `git blame` 확인 결과 이번 lint 델타 이전인 `35ff9c19b`(2026-05-21) originating commit — 이번 diff 는 바로 위 줄(`:128`)의 `getResponse()` → `getResponse<HttpResponseLike>()` 타입 인자만 추가했을 뿐 이 줄은 건드리지 않았다), 신규 테스트는 `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:212`(`it('4xx 응답은 캐시하지 않는다 (Spec EIA §R8)', …)`)
  - 상세: `spec/5-system/14-external-interaction-api.md` §R8 원문은 "4xx 응답 중 `400 VALIDATION_ERROR` **만** idempotency cache 에서 제외하고, 그 외 (성공 2xx / `409 Conflict` / `410 Gone`) 는 캐시한다" 라고 **명시적으로** 409·410 을 캐시 대상 예시로 든다. 근거 문단도 "validation 실패가 캐시되면 사용자가 form 수정 후 재제출 시 stale 에러가 반환된다"는 **400 에 한정된** 이유만 설명한다. 그런데 실제 코드는 `statusCode >= 400` 하나로 400/409/410/5xx 를 통째로 캐시 제외한다 — 즉 같은 `Idempotency-Key`+같은 body 로 `409 STATE_MISMATCH` 나 `410 Gone` 을 다시 보내면 캐시된 응답을 재생하는 대신 downstream 핸들러가 **매번 재실행**된다. 이는 `EIA-RL-02`("Inbound `submit_*` 는 멱등. `Idempotency-Key` 동일 시 동일 응답 24h 재현 | 필수")가 요구하는 멱등 재현을 그 범위에서 위반한다.
  - 방향 판정: **코드가 틀림(spec 이 권위)** — spec 문서가 409/410 을 캐시 대상으로 명시적으로 예시까지 들었고, 그 반대(현재 구현)로 읽힐 의도적 개선의 흔적(주석·커밋 이력)이 없다. SPEC-DRIFT 아님.
  - 이번 diff 와의 관계: 로직 자체는 2026-05-21 원본 구현(`35ff9c19b`)부터 있던 것으로 **이번 lint 정리 델타가 만든 결함은 아니다.** 다만 (a) 이번 델타가 `getResponse<HttpResponseLike>()` 타입을 붙이며 이 함수의 동작을 정면으로 다루는 문서화(`HttpResponseLike` 인터페이스 docstring)를 새로 추가했고, (b) 직전 라운드(`12_05_39`)의 testing WARNING 조치로 **이 동작을 고정하는 신규 회귀 테스트**가 이번 diff 에 추가되면서 "Spec EIA §R8" 이라는 부정확한 근거로 뮤테이션까지 검증해 굳혔다. 두 차례의 이전 리뷰(`11_06_12`/`12_05_39` requirement.md)는 모두 "이번 diff 는 로직을 바꾸지 않았으므로 spec 영향 없음"이라는 진단만 하고 그 밑에 깔린 **기존 로직 자체**가 R8 의 구체적 예외 범위(400 한정)와 다르다는 점은 대조하지 않았다.
  - 제안: 이 PR(순수 타입 정리)의 범위를 넘는 **동작 변경**이므로 이번 PR 을 막을 사유는 아니지만, `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 후속 백로그(현재 "선재 테스트 공백 2건"·"`Array.isArray(rows)` 가드" 두 항목이 등재된 절)에 세 번째 항목으로 "idempotency 캐시 제외 조건을 `statusCode === 400` 으로 좁힌다(409/410 캐시 대상 복원)"를 추가할 것을 권장한다. `developer` 스킬 권한으로 코드 fix, 필요 시 `project-planner` 에 spec 문구 재확인 위임(spec 은 이미 명확하므로 spec 수정은 불필요해 보임 — 코드만 spec 을 따라가면 됨).

- **[INFO]** 위 발견 외 — 12개 소스 파일의 diff 는 전부 콜백/변수/제네릭 타입 주석·`as` 단언 추가로, 앞선 두 라운드의 `side_effect` 검증(before/after emit JS md5 동일 6/8, 괄호 1쌍 차이 2/8)과 이번 세션의 독립 eslint/typecheck/jest 재실행이 서로 정합한다. 런타임 동작·에러 코드·필드명·기본값·상태 전이 변경은 발견되지 않았다.
  - 판정: 문제 없음.

- **[INFO]** `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 체크박스·수치(46→21→0, ratchet 199/38, README 문구 정정 경위)는 실제 커밋 이력·재측정과 모두 일치한다. 남은 미완료(`- [ ]`) 두 항목(dispatcher `logFn` 분기 테스트 공백, `execution-engine.service.ts` admission `Array.isArray` 가드)은 이번 diff 가 건드리지 않은 자리에 대한 정당한 유예로 문서화되어 있다.
  - 판정: 문제 없음.

## 요약

12개 소스 파일의 변경은 `no-unsafe-*` lint warning 처분을 위한 순수 타입 주석/제네릭/단언 추가로, 독립 재실행(eslint 0/0, 타입체크 ratchet 199건/38파일 baseline 일치, 관련 jest suite 전수 통과)이 커밋·plan·이전 리뷰가 주장한 수치와 정확히 일치했다. TODO/FIXME 류 미완성 표시, 반환값 누락, 에러 시나리오 미정의는 발견되지 않았다. 다만 spec 본문 대조(관점 9) 과정에서, 이번 diff 가 타입만 건드린 `idempotency.interceptor.ts` 의 밑바탕 로직(`statusCode >= 400` 캐시 제외)이 `Spec EIA §R8` 이 명시한 "400 VALIDATION_ERROR 만 제외, 409/410 은 캐시" 범위보다 넓다는 것을 확인했다 — 이는 2026-05-21 원본 구현부터 있던 선재 결함으로 이번 lint 정리 델타가 만든 것은 아니지만, 이번 diff 에 새로 추가된 회귀 테스트가 그 동작을 "Spec EIA §R8" 이라는 부정확한 근거로 고정시켰고, 두 차례의 이전 리뷰 모두 이 지점을 대조하지 않고 통과시켰다. 이 PR(순수 lint 정리) 자체를 막을 사유는 아니므로 WARNING 으로 등재하고 plan 백로그에 후속 항목으로 넘길 것을 제안한다.

## 위험도

LOW

STATUS: OK
