# 신규 식별자 충돌 검토 — spec/5-system/ (--impl-prep)

## 조사 방법

`--impl-prep` 페이로드는 `spec/5-system/` 전체를 target 으로 번들했으나 컨텍스트 예산 초과로
`1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 만 본문이 실렸고 나머지(특히 실제
작업 대상인 `14-external-interaction-api.md`, `4-execution-engine.md`)는 절단되었다. 절단분은
worktree 파일시스템에서 직접 `Read`/`grep` 해 보완했다.

worktree 의 실제 uncommitted 변경은 spec 이 아니라 코드 1건뿐이다:

```
modified: codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts
  (115 insertions, 65 deletions)
```

diff 내용은 기존 `intercept()` 의 `switchMap` 콜백 본문을 `private resolveCacheHit()` 메서드로
추출하고, 그 인자를 개별 파라미터 대신 새 `private interface CacheLookup { redisKey, bodyHash,
context, next }` 로 묶은 순수 리팩터다. 새로 추가된 요구사항 ID·엔티티·엔드포인트·이벤트·ENV
var·spec 파일 경로는 없다 — 아래 각 관점별로 확인한 근거를 남긴다.

## 관점별 확인

1. **요구사항 ID 충돌** — 신규 메서드의 JSDoc 이 인용하는 `EIA-IN-11`·`§R8` 은 모두
   `spec/5-system/14-external-interaction-api.md` 에 이미 정의된 기존 ID 다
   (`EIA-IN-11`: L97, `EIA-RL-02` cross-ref: L156, `### R8. Idempotency-Key 와 submit_form
   검증 실패의 관계`: L1249). 새 ID 부여 없음 — 충돌 없음.
2. **엔티티/타입명 충돌** — 신규 타입은 `CacheLookup`(interface)·`resolveCacheHit`(private
   method) 둘. `grep -rn "CacheLookup" codebase/ spec/` 및 `grep -rn "resolveCacheHit"
   codebase/ spec/` 결과 두 식별자 모두 `idempotency.interceptor.ts` 내부(정의부 + 호출부)
   외에는 등장하지 않는다 — `private`/미export/단일 파일 스코프라 다른 모듈·spec 문서의 동명
   식별자와 마주칠 표면이 없다. 인접 헬퍼 `discardCorruptEntry`·`cacheTapped` 도 동일 파일
   기존 private 메서드로 이번 diff 의 신규 식별자가 아니다.
3. **API endpoint 충돌** — 신규/변경 endpoint 없음 (HTTP 표면 불변, 내부 로직 재구성만).
4. **이벤트/메시지명 충돌** — 신규 webhook·queue·SSE 이벤트 없음. 응답 코드
   `IDEMPOTENCY_KEY_CONFLICT` 도 기존 코드 그대로 이동됐을 뿐 신설이 아니다.
5. **환경변수·설정키 충돌** — 신규 ENV var·config key 없음.
6. **파일 경로 충돌** — 신규 spec 파일 없음. 코드 파일 경로도 기존 파일을 그대로 수정.

## 발견사항

없음 — 이번 diff 는 spec 표면에 아무 것도 새로 노출하지 않는 내부 리팩터이고, 새로 도입된
두 식별자(`CacheLookup`, `resolveCacheHit`)는 코드베이스·spec 어디에도 동명 사용처가 없다.

## 요약

worktree 의 실질 변경은 `IdempotencyInterceptor.intercept()` 의 캐시-히트 판정 로직을
`resolveCacheHit()`(신규 private 메서드) + `CacheLookup`(신규 private interface) 으로 추출한
순수 구조 리팩터이며, 두 식별자 모두 단일 파일 내부 스코프에 갇혀 있고 코드베이스·spec 전체를
grep 해도 다른 의미의 동명 사용처가 없다. diff 가 인용하는 요구사항 ID(`EIA-IN-11`, `§R8`)도
기존 spec 문서에 이미 정의되어 있는 것을 그대로 재인용한다. 신규 엔드포인트·이벤트·ENV
var·spec 파일 경로 등 다른 관점에서도 새로 부여된 식별자가 없어, 신규 식별자 충돌 관점에서는
지적할 사항이 없다.

## 위험도

NONE
