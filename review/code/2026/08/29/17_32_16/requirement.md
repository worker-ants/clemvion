# 요구사항(Requirement) 리뷰 — `idempotency.interceptor.ts` `resolveCacheHit()` 추출

## 리뷰 범위 요약

- **파일 1** `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `intercept()` 의 `switchMap` 콜백(87줄, 7갈래 분기)을 `resolveCacheHit()` private 메서드로 추출하고 호출부 인자를 `CacheLookup` 인터페이스로 묶은 **순수 구조 리팩터** (커밋 `49b9f92b5`).
- **파일 2** `plan/in-progress/backend-lint-gate-broken-on-main.md` — 조건부 유예 항목 체크박스 `[ ]` → `[x]` 갱신 + 완료 근거 서술.
- **파일 3~4** `review/consistency/2026/08/29/17_23_43/*` — 이번 turn 의 `--impl-prep spec/5-system/` consistency-check 산출물(BLOCK: NO, Critical/Warning 0, INFO 4). SUMMARY.md 에 "INFO #4(필드 스왑으로 보이는 지점)는 개발자 자신이 검증용으로 주입했다 되돌린 뮤턴트" 라는 정정이 포함됨 — 아래에서 이 주장을 코드로 직접 재검증했다.

## 독립 검증 (재현)

1. **동작 불변 확인** — `npx jest idempotency.interceptor.spec.ts` 무수정 실행: **63 passed / 63 total**. 커밋 메시지의 "기존 spec 63건 전부 GREEN, 새 테스트 없음" 과 일치.
2. **"필드 스왑" 이 실제로 원복됐는지 직접 확인** — 현재 소스를 `Read` 로 열람: 호출부(`{ redisKey, bodyHash, context, next }`, L190)와 `resolveCacheHit` 내부 구조분해(`const { redisKey, bodyHash, context, next } = lookup;`, L226)가 **이름 기준**으로 정확히 대응한다. 왜곡 없음 — consistency SUMMARY.md 의 정정이 사실과 일치함을 코드로 확인.
3. **`CacheLookup` docstring 의 "13개 테스트가 죽는다" 주장을 무수정 프로브로 재현** — scratch 백업 후 `resolveCacheHit` 의 구조분해를 `const { redisKey: bodyHash, bodyHash: redisKey, context, next } = lookup;` 로 뮤테이션(요청·조회 키를 서로 바꿔치기)하고 재실행: **정확히 13 failed / 50 passed**. docstring 주장과 **정밀 일치**. 즉시 `cp` 로 원복, `git status --short` 로 트리 청결 재확인 (review 세션 산출물 디렉터리만 untracked, 그 외 diff 0).
4. **spec fidelity 대조** — `spec/5-system/14-external-interaction-api.md` §R8/EIA-IN-11/EIA-RL-02 을 직접 Read: 캐시 대상 닫힌 목록(`2xx`·`409`·`410`, `400 VALIDATION_ERROR`·`5xx` 제외), 에러 코드 `IDEMPOTENCY_KEY_CONFLICT`, 캐시 키 형식 `interaction:idempotency:<executionId>:<route>:<key>` 모두 코드와 line-level 로 일치. drift 없음.

## 발견사항

- **[INFO]** `resolveCacheHit()` 의 JSDoc 이 주장하는 나머지 두 뮤테이션 결과(분기 4 `ConflictException`→성공채널 시 RED 4건, 분기 6 `HttpException`→성공채널 시 RED 2건)는 이번 리뷰에서 독립 재현하지 않았다(가장 구조적 위험이 큰 필드 스왑 주장만 재현해 정밀 일치를 확인). 코드 결함 근거는 아니며, 후속 리뷰가 필요하면 같은 방식(scratch 백업→`cp` 뮤테이션→`jest`→`cp` 원복)으로 재현 가능.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` — `resolveCacheHit` JSDoc L218-220 (게이트 기준)
- **[INFO]** `CacheLookup` 인터페이스는 단일 파일 private 스코프(`naming_collision` checker 도 동일 결론)이며, 도입 근거(무수정 프로브 실측)가 docstring 에 정확히 남아 있다. 향후 이 인터페이스에 필드를 추가할 때도 "타입이 순서를 막아준다" 는 근거를 쓰기 전에 뮤테이션으로 먼저 확인하라는 self-correction 이 이미 주석에 반영돼 있음 — 반영 상태 양호, 조치 불요.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:72` (interface `CacheLookup`)

CRITICAL/WARNING 없음.

## 관점별 결론

1. **기능 완전성** — `intercept()` 의 `switchMap` 콜백 로직이 `resolveCacheHit()` 로 100% 이동. 분기 순서(캐시 미스 → 엔트리 문법손상 → 형태불일치 → bodyHash → payload손상 → 상태코드 재현)가 원본과 동일하게 보존됨. 완전 이행.
2. **엣지 케이스** — `cachedJson === null`(캐시 미스), `JSON.parse` throw(문법 손상), `'null'`/`'42'`/`'[]'`(형태 손상, `isIdempotencyEntry` 로 차단), `responseJson` 개별 손상 — 전부 원본 그대로 보존. 새로 깨진 경계 없음.
3. **TODO/FIXME** — 신규 도입 코드에 TODO/FIXME/HACK/XXX 없음.
4. **의도-구현 괴리** — `resolveCacheHit` JSDoc 의 "일곱 갈래" 표가 실제 분기(1~7)와 line-level 로 정확히 대응. `CacheLookup` docstring 의 "타입이 아니라 이름이 근거" 라는 주장은 §독립 검증 3 에서 실측 재현으로 확인됨.
5. **에러 시나리오** — `catchError`(GET 실패 fail-open) 위치가 `switchMap` **앞**이라는 위치 계약이 원본 그대로 유지(뒤로 옮기면 `ConflictException` 도 삼켜지는 위험, 주석·캐너리 테스트로 고정). `resolveCacheHit` 내부의 `throw`(4·6 분기)가 `switchMap` project 함수 안에서 호출되므로 RxJS 가 error 채널로 정상 변환 — 원본과 동일 계약.
6. **데이터 유효성** — `isIdempotencyEntry`/`isHttpStatusCode` 형태 검증 로직 변경 없이 그대로 이동.
7. **비즈니스 로직** — bodyHash 판정이 payload 파싱보다 먼저라는 순서 계약(§R8, 손상 엔트리에서 409 소실 방지) 그대로 보존. §R8 닫힌 목록(2xx/409/410) 로직도 `isErrorStatusCacheable` 그대로 재사용.
8. **반환값** — `resolveCacheHit` 은 모든 경로에서 `Observable<unknown>` 또는 `throw`(RxJS 가 error 로 변환) 반환. 누락 경로 없음 — `processFresh()`, `discardCorruptEntry(...)`, `of(cachedPayload)`, 두 개의 `throw` 로 전 분기 커버.
9. **spec fidelity** — `spec/5-system/14-external-interaction-api.md` §R8/EIA-IN-11/EIA-RL-02 과 코드가 정확히 일치(§독립 검증 4). 이번 turn 의 consistency-check(`BLOCK: NO`, Critical/Warning 0)와 결론 일치.

## 요약

이번 diff 는 `intercept()` 의 87줄짜리 `switchMap` 콜백을 `resolveCacheHit()` private 메서드로 옮기고 호출 인자를 `CacheLookup` 으로 묶은 **순수 구조 리팩터**이며, 이전 두 라운드가 걸어 둔 "6번째(실제 7번째) 분기 발생 시 재검토" 조건부 유예를 정확히 이행한 것이다. 동작 변경이 없다는 주장은 기존 spec 63건 전원 GREEN 으로 직접 재현했고, 가장 위험도가 높은 docstring 주장("redisKey/bodyHash 필드 스왑 시 13개 테스트가 죽는다")도 동일 뮤테이션을 독립적으로 주입·재현해 정밀 일치를 확인했다(원복 후 트리 청결도 재확인). consistency-check SUMMARY.md 가 지적한 "필드 스왑으로 보이는 지점"은 개발자 자신의 검증용 뮤턴트가 리뷰 시점과 겹쳐 관찰된 것이며 현재 트리에는 남아 있지 않음을 직접 소스 열람으로 확인했다. spec(§R8/EIA-IN-11/EIA-RL-02)과 코드도 line-level 로 일치해 drift 가 없다. CRITICAL/WARNING 발견 없음.

## 위험도

NONE
