# Security Review — `eia-r8-cache-scope` (idempotency 캐시 §R8 재설계, 6차 누적 라운드)

## 발견사항

- **[WARNING]** "idempotency 캐시 키가 execution/인증 컨텍스트로 미스코프됐다"는 보안 항목이 **4개 리뷰 라운드에 걸쳐 "plan 백로그에 이미 등재돼 있다"고 반복 주장**됐지만, 실제로는 어떤 plan 파일에도 기록된 적이 없다.
  - 위치: `plan/in-progress/backend-lint-gate-broken-on-main.md` (해당 항목 부재 — 전체 파일에서 "미스코프"/"redisKey"/"execution 스코프" 관련 backlog 체크박스가 0건, `grep` 로 직접 확인), 대조 인용: `review/code/2026/08/12/16_29_45/RESOLUTION.md:77`("유예 — 이번 PR 범위 밖. 다만 캐시 대상이 에러 응답까지 넓어졌으므로 후속 가치가 올라갔다"), `review/code/2026/08/12/16_53_26/RESOLUTION.md:32`("유예, 다만 우선순위 상향 기록 — **plan 백로그에 이미 있고**"), `review/code/2026/08/12/17_07_45/RESOLUTION.md:60`("유예 — **plan 등재**. 이번 fix 로 우선순위가 올라갔음을 재확인"), `review/code/2026/08/12/18_07_36/security.md:6`("**plan 백로그 항목이 이미 존재하므로** 새 항목 추가는 불필요"), `review/code/2026/08/12/18_52_47/security.md:3,25`("이미 발견·유예된 선재 설계이며 … **plan 백로그 기재**", "이미 plan 백로그에 등재, 우선순위 상향 근거 기록됨").
  - 상세: `idempotency.interceptor.ts:95`의 `redisKey = \`${REDIS_KEY_PREFIX}${rawKey}\`` 는 `executionId`/인증 주체를 포함하지 않는다 — 이 자체는 선재 설계이고 이번 PR 이 새로 만든 것이 아니다. 문제는 그 사실이 아니라 **처리 절차의 무결성**이다: 최소 4개 라운드(`16_29_45` → `16_53_26` → `17_07_45` → `18_07_36`/`18_52_47`)의 security reviewer 가 이 항목을 "이번 PR 을 막을 사유는 아니다, 다만 plan 백로그에 이미 있으니(또는 등재하니) 추적된다"는 근거로 통과시켰는데, `plan/in-progress/backend-lint-gate-broken-on-main.md` 를 직접 열어 대조한 결과 그 항목은 **한 번도 실제로 추가된 적이 없다**. 특히 `18_37_45` 라운드의 커밋(`567c1919d`, "test(eia): 'plan 에 기록하겠다' 고 처분해 놓고 안 적었다 …")은 정확히 이 실패 패턴("처분표에 쓴 것을 그 턴에 안 했다")을 **다른 항목**(`responseJson` 손상 무방비)에 대해 스스로 지적하고 고쳤으면서, 같은 커밋 메시지에서 "유예 — 캐시 키 미스코프 … plan 백로그 유지"라고 적어 **이 항목에 대해서는 같은 결함을 반복**했다 — 실제 plan diff(`git show 567c1919d -- plan/…`)에는 이 항목이 없다. 결과적으로 "낮은 우선순위지만 추적은 되고 있다"는 전제로 여러 라운드가 이 보안 항목을 반복 통과시켰는데, 그 추적 자체가 존재하지 않아 이 PR 이 머지되는 순간 이 정보가 review 산출물(향후 참조되지 않는 이력 파일)에만 남고 실질적으로 소실될 위험이 있다.
  - 제안: 이번 라운드(최종 라운드로 보임)에서 `plan/in-progress/backend-lint-gate-broken-on-main.md` 에 "idempotency 캐시 키가 `executionId`/인증 컨텍스트로 스코프되지 않음 — `409`/`410` 캐싱이 실제 발동 경로가 되며 노출 표면이 이론상 위험에서 실제로 전환됨" 항목을 **실제로** 추가할 것. 지금 추가하지 않으면 다음 세션이 이번에도 "이미 등재됨"이라는 이전 라운드의 (틀린) 진술을 근거로 또 건너뛸 가능성이 높다.

- **[INFO]** Idempotency 캐시 키가 `Idempotency-Key` 헤더 값에만 바인딩되고 `executionId`/인증 컨텍스트로 스코프되지 않는다 — 위 WARNING 이 다루는 바로 그 선재 설계이며, 이번 diff 로 `409`/`410` 캐싱이 도달 불가능한 dead code 에서 실제 동작 경로로 바뀌면서 노출 표면이 이론상 서술에서 실질로 전환됐다.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:95`(`redisKey` 구성, `executionId` 미포함), `:135-140`(캐시 히트 시 `409`/`410` 을 `HttpException` 으로 재현), `:186-201`(`catchError` 에서 `storeEntry` 호출 — 에러 응답 적재)
  - 상세: `InteractionGuard`/`InteractionRateLimitGuard` 가 인터셉터보다 먼저 실행되므로(`interaction.controller.ts:57` `@UseGuards(InteractionGuard, InteractionRateLimitGuard)` 클래스 레벨 적용, Nest 는 guard→interceptor 순서로 실행) 인증 우회는 없다. 다만 캐시 히트 판정은 `bodyHash`(요청 body 의 SHA-256) 일치만 추가로 보므로, 서로 다른 두 execution 에 대해 **각자 유효한 토큰**을 가진 호출자가 (a) 동일한 `Idempotency-Key` 값과 (b) 동일한 요청 body 를 우연히 또는 의도적으로 사용하면, 나중 요청자가 먼저 요청자의 캐시된 응답(이제 `409 STATE_MISMATCH`/`410 EXECUTION_TERMINATED` 본문 포함)을 그대로 돌려받을 수 있다. `interaction.service.ts` 의 실제 throw 지점(`:253`, `:431`, `:478`, `:505`)을 대조한 결과 이 두 예외의 payload 는 고정 문자열/`execution.status` enum 값만 담아 현재는 민감정보 노출로 이어지지 않는다. 익스플로잇 난이도(정확한 `Idempotency-Key` 값 + 동일 `bodyHash` 동시 추측)도 낮지 않다. 이번 diff 자체가 새로 만든 취약점은 아니다.
  - 제안: 후속 항목으로 `redisKey` 에 `executionId`(또는 인증된 scope 식별자)를 포함해 캐시를 요청 컨텍스트로 완전히 격리할 것을 권고 — 위 WARNING 조치(실제 plan 등재)와 함께 처리.

- **[INFO]** 캐시 대상 확장(`isErrorStatusCacheable`)이 닫힌 allowlist(409·410 두 값만)로 구현돼 있고, 캐시 적재 시 직렬화 실패(`storeEntry` 의 `try/catch`, `:222-233`)가 원 예외를 500 으로 대체하지 않도록 격리돼 있음을 확인 — 새로 도입된 정보 노출·가용성 결함 없음.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:214-241`(`storeEntry`), `:255-257`(`isErrorStatusCacheable`)
  - 상세: `catchError` 셀렉터 안에서 `JSON.stringify` 가 실패해도(순환 참조 등) `try/catch` 로 감싸 적재만 skip 하고 원 예외(`throwError(() => err)`)는 그대로 전파한다 — 부수 경로의 실패가 본 응답(클라이언트가 받는 상태코드)을 왜곡하지 않는다. `isErrorStatusCacheable` 은 `statusCode === 409 || statusCode === 410` 두 값만 통과시키는 닫힌 비교라 판정 함수 자체가 확장 공격면을 열지 않는다. 인젝션·역직렬화 위험도 없음(`JSON.parse`/`JSON.stringify` 만 사용, `eval` 류 없음).
  - 제안: 없음 — 참고 확인.

- **[INFO]** 캐시된 예외 payload(`err.getResponse()`)가 이제 Redis 에 24h 보존됨 — `interaction.service.ts` 의 향후 변경이 예외 메시지에 민감 정보를 섞으면 노출 창이 "요청 1회"에서 "24h 재현 가능"으로 늘어날 잠재 회귀 지점.
  - 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts:189-196`(`storeEntry(redisKey, bodyHash, statusCode, err.getResponse())`)
  - 상세: 이번 diff 범위(`interaction.service.ts`)는 변경되지 않았고 현재 두 throw 지점 모두 고정 코드/enum 값만 포함해 안전함을 확인했다(이전 라운드들과 동일 결론). 이 인터셉터 자체의 책임 밖이지만 후속 회귀 지점으로 남는다.
  - 제안: `interaction.service.ts` 의 409/410 throw 지점을 변경할 때 응답 payload 에 내부 diagnostic 이 실리지 않는지 재확인할 것 — 별도 조치 불요.

- **[INFO]** e2e 테스트(`external-interaction.e2e-spec.ts`)의 신규 `IDEM-1`~`IDEM-3` 블록은 파라미터화된 `pg` 쿼리(`$1`, `$2` placeholder)만 사용해 SQL 인젝션 표면이 없고, 테스트용 JWT 서명 시크릿(`JWT_SECRET`, line 119-120)은 이번 diff 가 아닌 기존 코드이며 `do-not-use-in-prod` 로 명명돼 `docker-compose.e2e.yml` 전용임을 확인.
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts` (신규 `IDEM-1`~`IDEM-3` `it` 블록 — 코드 전문은 상단 diff 미포함이라 파일 직접 대조로 확인)
  - 상세: 신규 테스트가 사용하는 `Idempotency-Key` 값은 매 실행마다 `randomUUID()` 로 생성해 하드코딩 시크릿·고정 키 재사용 없음.
  - 제안: 없음.

## 요약

`Idempotency-Key` 캐시 대상을 Spec EIA §R8 이 정한 닫힌 목록(`2xx`·`409`·`410`)에 맞게 재설계하고 RxJS error 채널까지 실제로 도달하도록 고친 버그 수정으로, 인증/인가 순서(`InteractionGuard`가 인터셉터보다 먼저 실행)에는 손대지 않았고 신규 인젝션·하드코딩 시크릿·암호화 약화·정보 노출 취약점은 코드 자체에서 발견되지 않았다. 유일한 코드 수준 관찰 항목은 idempotency 캐시 키가 execution/인증 컨텍스트로 스코프되지 않는 선재 설계(INFO)이며 이번 변경으로 그 노출 표면이 dead code 에서 실제 경로로 전환됐지만 익스플로잇 난이도는 낮지 않다. 이번 리뷰에서 새로 발견한 것은 코드가 아니라 **리뷰 절차의 결함**이다 — 바로 그 캐시 스코핑 항목을 최소 4개 이전 라운드가 "plan 백로그에 이미 등재돼 있다"는 근거로 반복 통과시켰는데, `plan/in-progress/backend-lint-gate-broken-on-main.md` 를 직접 대조한 결과 그 항목은 실제로 존재한 적이 없다. 코드 자체의 위험은 낮지만, 이 PR 이 머지되기 전에 그 backlog 항목을 실제로 기록해 두지 않으면 여러 라운드가 "추적되고 있다"고 믿었던 보안 관찰 사항이 조용히 소실된다.

## 위험도
LOW
