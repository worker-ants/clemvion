# 신규 식별자 충돌 검토 — spec/data-flow/ (--impl-done)

## 조사 방법

target 은 `spec/data-flow/` 전체(15개 도메인 문서 + 개요)가 번들됐으나, `origin/main...HEAD` 의
실제 diff 는 다음 **1개 코드 파일**뿐이다 (`git diff --stat origin/main...HEAD` 로 재확인):

```
codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts | 190 +++++++++++--------
1 file changed, 125 insertions(+), 65 deletions(-)
```

`spec/data-flow/**` 자체에는 이번 diff 로 변경된 라인이 없다 — 번들에 실린 15개 문서는 모두
diff-base(`origin/main`) 시점부터 존재하던 컨텍스트다. 즉 이번 PR 이 spec 표면에 **새로 부여한
식별자는 없고**, 유일한 신규 표면은 diff 안의 TypeScript private 식별자 2개
(`CacheLookup` interface, `resolveCacheHit` private method) 뿐이다. 이는 기존
`intercept()` 의 `switchMap` 콜백 본문을 별도 메서드로 추출하고 그 인자를 객체로 묶은 순수
구조 리팩터이며, HTTP 표면·에러 코드·Redis 키·큐·ENV var 는 전혀 신설되지 않았다.

worktree 절대경로에서 직접 grep 해 두 식별자의 사용 범위를 확인:

```
$ grep -rn "CacheLookup" spec/ codebase/
codebase/.../idempotency.interceptor.ts:72:interface CacheLookup {
codebase/.../idempotency.interceptor.ts:224:    lookup: CacheLookup,

$ grep -rn "resolveCacheHit" spec/ codebase/
codebase/.../idempotency.interceptor.ts:59:  (JSDoc {@link} 참조)
codebase/.../idempotency.interceptor.ts:190:  this.resolveCacheHit(...)
codebase/.../idempotency.interceptor.ts:222:  private resolveCacheHit(
```

둘 다 `private`/미export 로 단일 파일 스코프에 갇혀 있고, 동일 이름이 다른 파일·spec 문서에
등장하지 않는다.

## 점검 관점별 확인

1. **요구사항 ID 충돌** — diff 의 JSDoc 이 인용하는 `EIA-IN-11`·`§R8`·`EIA-RL-02` 는 모두
   `spec/5-system/14-external-interaction-api.md` 에 이미 정의된 기존 ID 의 재인용이다. 새 ID
   부여 없음. `spec/data-flow/15-external-interaction.md` 본문이 인용하는 EIA-RL-02/04/06/07,
   R7/R8/R10/R15/R19, NF-OB-02/07 등도 전부 기존 `5-system/` 정의를 가리키며 이번 diff 로 새로
   생긴 ID 는 하나도 없다.
2. **엔티티/타입명 충돌** — 신규 타입은 `CacheLookup`(interface) 하나. `spec/data-flow/` 15개
   문서 전체 grep 결과 동명 엔티티·DTO·인터페이스 없음. 인접 표(§2.2 Redis/BullMQ, `interaction:
   idempotency:<executionId>:<route>:<key>` 캐시 엔트리 설명)는 필드명(`redisKey`, `bodyHash`,
   `responseJson`, `statusCode`)을 서술할 뿐 `CacheLookup` 이라는 이름 자체는 spec 어디에도
   나타나지 않는다 — 충돌 표면 없음.
3. **API endpoint 충돌** — 신규/변경 endpoint 없음. HTTP 표면(`POST /api/external/executions/:id
   /interact` 등)은 이번 diff 로 건드리지 않았다.
4. **이벤트/메시지명 충돌** — 신규 webhook·queue·SSE 이벤트 없음. `IDEMPOTENCY_KEY_CONFLICT` 는
   기존 로직이 메서드 경계만 넘어 이동한 것이고, `spec/data-flow/15-external-interaction.md`
   §Rationale "Fail-open 정책의 일관 표기" 가 이미 서술하는 기존 어휘(엔트리 손상·payload 손상·
   `IDEMPOTENCY_KEY_CONFLICT`)와 정확히 일치한다 — 신설이 아니라 재확인.
5. **환경변수·설정키 충돌** — 신규 ENV var·config key 없음.
6. **파일 경로 충돌** — 신규 spec 파일 없음(`spec/data-flow/` 15개 파일 목록 불변, `0-overview.md
   §2` 도메인 인덱스도 변경 없음). 코드 파일 경로도 기존 `idempotency.interceptor.ts` 를 그대로
   수정했을 뿐 신규 파일이 아니다.

추가로 유사-혼동(WARNING 후보) 가능성도 점검했다 — `resolveCacheHit` 는 같은 모듈의
`resolveSigningSecret`(`notification-webhook.processor.ts`)·`resolveAlgorithm`·
`resolveWebChatIdleReapGraceMs` 와 동사 접두(`resolve*`)를 공유하지만, 이는 이 코드베이스 전반의
기존 명명 관례(조회/판정 결과를 반환하는 메서드에 `resolve` 접두)이고 대상 명사(`CacheHit` vs
`SigningSecret`/`Algorithm`/`IdleReapGraceMs`)가 뚜렷이 갈려 실질적 혼동 소지는 없다.

## 발견사항

없음 — 이번 PR 은 `spec/data-flow/` 표면에 아무 것도 새로 노출하지 않는 내부 코드 리팩터다.
유일한 신규 식별자(`CacheLookup`, `resolveCacheHit`)는 단일 파일 private 스코프에 있고
코드베이스·spec 전체에 동명 사용처가 없다.

## 요약

diff-base(`origin/main`) 대비 실제 변경은 `IdempotencyInterceptor.intercept()` 의 캐시-히트
판정 로직을 `resolveCacheHit()`(신규 private 메서드) + `CacheLookup`(신규 private interface)
으로 추출한 순수 구조 리팩터뿐이며, `spec/data-flow/**` 자체는 이번 PR 로 한 줄도 바뀌지 않았다.
번들에 포함된 15개 data-flow 문서(관측성·chat-channel·external-interaction·overview·audit 등)를
전수 grep 해도 새로 부여된 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV var·spec 파일
경로가 없고, diff 내부 신규 TS 식별자 2개도 단일 파일 스코프에 갇혀 다른 의미의 동명 사용처와
마주칠 표면이 없다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
