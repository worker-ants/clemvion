STATUS=success cross_spec review complete — 0 CRITICAL / 0 WARNING / 0 INFO

===REPORT_MARKDOWN_BELOW===

# Cross-Spec 일관성 검토 — `spec/data-flow/` (impl-done)

## 검토 대상 요약

`git diff origin/main...HEAD` 는 아래 3개 파일에 한정된다 (spec/ 파일 변경 없음):

- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (프로덕션 코드)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (unit)
- `codebase/backend/test/external-interaction.e2e-spec.ts` (e2e)

변경 내용은 `IdempotencyInterceptor` 의 Redis 캐시 키를 `Idempotency-Key` 헤더 값 단독에서
`interaction:idempotency:<executionId>:<route>:<key>` 로 스코프하는 구현 + 테스트 하드닝
(execution 축·route 축 분리, GET/SET 양쪽 단언, ctx 부재 시 fallback-없는 skip)이다. 이 요구사항
(`Spec EIA §R8` "캐시 키 스코프", `EIA-IN-11`, `EIA-RL-02`)은 diff 이전부터
`spec/5-system/14-external-interaction-api.md` 와 `spec/data-flow/15-external-interaction.md`
양쪽에 **이미 문서화**되어 있었다 — 즉 이번 변경은 spec 을 새로 정의한 것이 아니라 기존 spec 에
코드가 뒤늦게 맞춘 케이스다.

## 점검한 교차 지점

1. **데이터 모델 충돌** — 없음. 새 엔티티/필드 없음. Redis 캐시 엔트리 shape(`{bodyHash,
   responseJson, statusCode}`)도 불변.
2. **API 계약 충돌** — 없음. `Idempotency-Key` 요청 헤더 계약(클라이언트 관점)은 그대로다. 변경은
   서버 내부 Redis 키 네임스페이스에 한정되어 외부에 노출되지 않는다.
3. **요구사항 ID 충돌** — 없음. `EIA-IN-11`(`spec/5-system/14-external-interaction-api.md:81`),
   `EIA-RL-02`(동 파일:140), `§R8`(동 파일:1053~1066)은 diff 이전부터 이미 이 의미로만 쓰이고
   있었고 코드 주석의 `[Spec EIA §R8]` 인용과 정확히 일치한다. 새로 부여된 ID 없음.
4. **상태 전이 충돌** — 대상 아님(캐시 키 스코프는 상태 머신과 무관).
5. **권한·RBAC 충돌** — 없음. `InteractionGuard`(`interaction.guard.ts`)가 `iext_*`/`itk_*` 두
   토큰 family 모두에서 동일하게 `req.interaction.executionId` 를 세팅하며(L118, L142), 캐시
   스코프가 "토큰이 아니라 execution 단위" 라는 spec 서술(`spec/5-system/14-external-interaction-api.md:1066`
   "스코프 단위는 토큰이 아니라 execution 이다")과 정확히 일치한다. refresh-token 회전 후에도
   같은 executionId 로 재현되어야 한다는 `EIA-RL-02` 요건도 코드가 만족한다.
5-부수. `IdempotencyInterceptor` 는 컨트롤러의 `interact`/`cancel` 두 메서드에만 method-level
   `@UseInterceptors` 로 부착되어 있고(`interaction.controller.ts` L66, L112), 이는 spec 이 말하는
   "route 축 = `interact`\|`cancel`" 과 정확히 일치한다. 다른 모듈에서 이 인터셉터를 재사용하는
   지점은 없다(`grep IdempotencyInterceptor` → 컨트롤러 1곳 + 주석 1곳뿐).
6. **계층 책임 충돌** — 없음. NestJS 실행 순서상 `@UseGuards(InteractionGuard, ...)` (클래스
   레벨)가 `@UseInterceptors(IdempotencyInterceptor)` (메서드 레벨)보다 항상 먼저 실행되므로,
   인터셉터가 소비하는 `req.interaction`은 항상 Guard 가 채운 뒤의 값이다 — "Guard 가 인증/컨텍스트
   합성, Interceptor 는 그 결과만 소비" 라는 기존 계층 분리와 일치한다.

## 참고 — 이번 세션에서 접근 불가했던 영역

`spec/5-system/14-external-interaction-api.md` 는 prompt 번들에서는 컨텍스트 예산 초과로
생략되어 있었으나(§R8 canonical 정의 소재), 위 검토는 이를 리포지토리에서 직접 `Read`/`grep` 하여
확인했다. 다른 생략 파일 93개 중 idempotency/캐시 키와 명시적으로 교차하는 파일은 발견되지
않았다(`grep -rn "interaction:idempotency"` 전체 저장소 결과가 spec 2파일 + 코드 3파일로 닫힘).

## 요약

이번 diff 는 spec 을 변경하지 않고, 이미 `spec/5-system/14-external-interaction-api.md`(§R8·
EIA-IN-11·EIA-RL-02)와 `spec/data-flow/15-external-interaction.md`(§1.2·§2.2)에 명시된 캐시 키
스코프 요구사항에 코드(`idempotency.interceptor.ts`)와 테스트(unit+e2e)를 맞추는 구현/하드닝
PR이다. 두 spec 문서 간 키 포맷 표기(`interaction:idempotency:<executionId>:<route>:<key>`)가
동일하고, Guard→Interceptor 계층 순서, 두 토큰 family(`iext`/`itk`) 처리, route 축 스코프(컨트롤러
메서드 바인딩) 모두 spec 서술과 정합한다. 다른 spec 영역(데이터 모델·API 계약·요구사항 ID·상태
전이·RBAC·계층 책임)과의 충돌 지점은 발견되지 않았다.

## 위험도

NONE
