# 문서화(Documentation) Review

## 검토 방법

이번 프롬프트는 5차례 선행 코드리뷰(`16_29_45`~`18_37_45`) + 1차례 consistency-check(`18_27_29`)
산출물이 함께 커밋돼 부풀어 있다. 실질 코드/문서 변경은 `CHANGELOG.md` ·
`codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`(+`.spec.ts`) ·
`codebase/backend/test/external-interaction.e2e-spec.ts` · `plan/in-progress/backend-lint-gate-broken-on-main.md` ·
`plan/in-progress/spec-draft-eia-r8-alignment.md` · `spec/data-flow/15-external-interaction.md` 6개
파일이며, 나머지는 리뷰/consistency 세션 산출물이다. `git log`로 실제 최신 커밋(`567c1919d`,
직전 라운드 `18_37_45` WARNING 4건 조치)까지 반영된 최종 상태를 `Read`로 직접 열어 확인했다.

## 발견사항

- **[WARNING]** 마지막 커밋이 새로 추가한 모듈 docstring 문장이 실제 테스트 커버리지보다 넓게 주장한다 — "전부 단언한다"가 사실이 아니다
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts:21-23` (모듈 최상단 docstring, "세 번째 describe" 설명 끝부분), 대상 블록은 `describe('IdempotencyInterceptor (Redis 런타임 장애 fail-open)', ...)` (`:552-750` 부근)
  - 상세: 커밋 `567c1919d`(이번 diff에 포함된 최신 커밋, 직전 라운드 `18_37_45` WARNING #1·#3 조치)가 모듈 docstring에 "이 블록의 테스트는 전부 `Logger.prototype.warn` 을 함께 단언한다 — fail-open 은 '요청을 살린다' 와 '장애를 보이게 한다' 가 한 쌍이고, 로그 한 줄이 사라지는 회귀는 응답만 봐서는 잡히지 않기 때문이다" 라는 문장을 새로 추가했다. 그런데 이 describe 블록의 실제 `it` 7건 중 `warnSpy`(`jest.spyOn(Logger.prototype, 'warn')`)를 세우고 단언하는 것은 4건뿐이다 — `:553`("`get()` 이 reject 해도 요청은 통과하고 warn 을 남긴다"), `:628`("`set()` 이 reject 해도 응답 정상 + warn 로그"), `:680`("직렬화 불가 payload 여도 원 예외가 그대로 나간다"), `:722`("성공 채널에서도 직렬화 불가 응답이 요청을 죽이지 않는다"). 나머지 3건은 `warnSpy` 자체를 세우지 않는다 — `:583`("`get()` 이 reject 하면 캐시 미스로 취급해 새 응답을 적재한다", `redis.set` 만 단언), `:603`("fail-open 이 409 충돌까지 삼키지 않는다 — catchError 위치 캐너리", `rejects.toThrow(ConflictException)` 만 단언), `:663`("비-Error 값으로 reject 해도 로그 조립이 죽지 않는다", `result` 값만 단언). 즉 "전부(全部)"라는 서술은 4/7만 참인데 7/7인 것처럼 읽힌다. 이 코드베이스가 이번 세션 안에서도 반복적으로 학습한 "문서화된 보장이 실제 구현/테스트보다 넓다" 클래스(이 저장소 메모리에 그대로 이름 붙어 있는 패턴)와 정확히 같은 형태이며, 하필 "다음에 추가되는 테스트가 같은 자리를 빠뜨리지 않게" 하려고 적은 문장 자체가 현재 상태를 오도한다는 점이 아이러니하다 — 이 서술만 보고 "이 블록은 이미 전부 warn 을 검증한다"고 믿으면, 위 3건과 성격이 비슷한 새 케이스를 추가할 때 "관행이니 안 넣어도 되겠지"가 아니라 "이미 다 되어 있다고 착각"하는 반대 방향의 오독이 생길 수 있다.
  - 제안: "전부" 를 "적재/직렬화 관련 4건"처럼 정확한 부분집합으로 좁히거나, 혹은 의도가 사실 서술이 아니라 향후 규범("이 블록에 fail-open 부수효과를 검증하는 테스트를 추가할 때는 warn 도 함께 단언할 것")이었다면 "~단언한다" 대신 "~단언해야 한다" 류의 규범적 문장으로 바꿔 현재 상태에 대한 오해를 없앤다.

- **[INFO]** (재확인, 이미 처분됨) `plan/in-progress/backend-lint-gate-broken-on-main.md`의 `readKey`/`hashBody` 경계값 테스트 항목이 여전히 "클래스 docstring 에 R8 선재 결함 참조 한 줄 추가" 라는, 이미 해소된 전제를 인용한다
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md:569-571` (unchecked 항목)
  - 상세: 이 잔재는 `18_07_36` documentation 리뷰가 이미 발견해 "필수는 아님, 실질 영향 낮음"으로 낮은 심각도를 매겼고 이후 4개 라운드(`18_07_36`~`18_52_47`) 동안 의도적으로 미조치 상태다. 이번 라운드에서도 그 판단을 뒤집을 새 근거는 없다 — 새 지적이 아니라 상태 재확인.
  - 제안: 없음 — 기존 트리아지 유지. 그 unchecked 항목이 실제로 착수될 때 자연히 드러날 오류다.

- **[INFO]** CHANGELOG·구현 docstring/인라인 주석·e2e 신규 블록(`IDEM-1/2/3`)·spec 미러(`data-flow/15`)가 최종 상태(6라운드 누적) 기준으로 서로 정합함을 직접 대조로 재확인
  - 위치: `CHANGELOG.md:3-29`, `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:39-257`, `codebase/backend/test/external-interaction.e2e-spec.ts:361-550`, `spec/data-flow/15-external-interaction.md:258`
  - 상세: `idempotency.interceptor.ts` 를 직접 읽어 확인한 결과 클래스/메서드/필드 docstring 은 현재 구현(성공 채널 인라인 판정 + `isErrorStatusCacheable` named 함수 + `catchError` 기반 에러 재현 + `storeEntry` 직렬화 가드)과 정확히 대응하고, `isErrorStatusCacheable` JSDoc의 "네 경우 모두 spec 에 회귀 테스트가 있다"는 실제 409/410/5xx/404 네 테스트와 정확히 대응한다. e2e 의 `IDEM-1`/`IDEM-2`/`IDEM-3` 명명은 기존 `A..J` 순차 관행과 다른 `18_07_36` 라운드의 충돌(`I-2` 재사용) 수정 결과가 그대로 유지되고 있으며, plan 인용(`:548`)도 같은 ID로 동기화돼 있다. `spec/data-flow/15`의 갭 caveat 삭제는 실제로 갭이 닫혔으므로 정합하다. 새 env 변수·API 엔드포인트·README 대상 표면 변경은 없다.
  - 제안: 없음 — 참고용 기록.

## 요약

이번 프롬프트는 §R8 idempotency 캐시 정합화 작업이 6차례에 걸친 review-fix 루프를 거친 최종
누적 상태다. 5차례 선행 documentation 리뷰가 지적한 결함(테스트 모듈 docstring stale, plan
narrative 라운드 인용 누락)은 모두 해소돼 있고, 직접 코드를 열어 대조한 결과 CHANGELOG·구현
docstring·e2e 계약 테스트·spec 미러는 서로 정확히 일치한다. 다만 직전 라운드(`18_37_45`)의
WARNING을 조치한 바로 그 최신 커밋(`567c1919d`)이 새로 추가한 모듈 docstring 한 문장이 —
"이 블록의 테스트는 전부 `Logger.prototype.warn` 을 함께 단언한다" — 실제로는 7건 중 4건만
해당하는데도 "전부"라고 서술해, 이번 라운드에서 새로 관측되는 WARNING을 낳는다. 향후 회귀를
막으려던 문장 자체가 현재 상태를 부정확하게 서술하는 아이러니한 형태이며, 기능적 위험은 없지만
이 코드베이스가 반복 경계해 온 "문서화된 보장이 구현/테스트보다 넓다" 클래스의 재발이다. 그 외
plan 잔재(readKey/hashBody 항목의 stale 참조) 1건은 이미 여러 라운드 전부터 낮은 심각도로
확인·유지된 상태다. README·API 문서·환경변수 문서화가 필요한 새 표면은 없다.

## 위험도

LOW
