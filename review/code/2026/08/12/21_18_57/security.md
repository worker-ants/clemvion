# Security Review — `21_18_57`

## 검토 범위

- `CHANGELOG.md` (문서)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (프로덕션 코드 — 핵심 변경)
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts` (유닛 테스트)
- `codebase/backend/test/external-interaction.e2e-spec.ts` (e2e 테스트)
- `plan/complete/spec-draft-eia-idempotency-key-scope.md` / `plan/in-progress/...` (plan 이동, 문서)
- `review/code/2026/08/12/21_02_30/*` (직전 라운드 리뷰 산출물 — 신규 커밋. 코드 아님, RESOLUTION/SUMMARY/각 리뷰어 산출 markdown+json)

프로덕션 동작에 실질 영향을 주는 변경은 `idempotency.interceptor.ts` 한 파일(주석 포함 ~20줄)뿐이며,
나머지는 그 변경을 검증하는 테스트·spec 문서·리뷰 이력이다. `idempotency.interceptor.ts` 전체와
`interaction.guard.ts`, `interaction.controller.ts`(라우트 데코레이터 순서)를 `Read`/`Grep` 으로 직접
열어 주장을 실측했다.

## 변경의 성격

이 diff 는 멱등 캐시 키를 `interaction:idempotency:<key>` (헤더 값 단독) 에서
`interaction:idempotency:<executionId>:<route>:<key>` 로 스코프하는 **보안 수정**이다. 종전에는
서로 다른 execution 의 요청자가 같은 `Idempotency-Key` + 같은 body 를 쓰면 한쪽의 캐시된 응답이
다른 쪽에게 재생됐다 — 정보 노출(다른 execution 의 응답 body) + 명령 유실(피해자가 자기 명령이
서비스에 닿지 않았는데도 `202` 를 받음)의 두 결과를 낳는 broken-access-control 성격의 결함
(CWE-639 계열)이었다. 이번 변경은 그 결함을 정확히 겨냥해 닫는다.

## 검증한 핵심 주장

1. **`executionId` 는 클라이언트가 위조할 수 없다.** `idempotency.interceptor.ts:100` 의
   `req.interaction?.executionId` 는 `InteractionGuard.canActivate`
   (`interaction.guard.ts:97-147`) 가 토큰 검증(`iext`: JWT sub 매칭, `itk`: trigger 소유권 확인)을
   통과한 뒤에만 합성해 `req.interaction` 에 세팅하는 값이다. Guard 를 통과하지 못하면
   `req.interaction` 자체가 없다.
2. **Guard 가 인터셉터보다 먼저 돈다.** `interaction.controller.ts:58`
   `@UseGuards(InteractionGuard, InteractionRateLimitGuard)` (클래스 레벨) +
   `@UseInterceptors(IdempotencyInterceptor)` (메서드 레벨) — NestJS 요청 파이프라인 순서상 Guard 가
   Interceptor 보다 항상 선행하므로, 인증 우회 없이 스코프 값이 확정된 뒤 캐시 키가 만들어진다.
   인터셉터 코드 주석(§97-99)의 주장과 실제 데코레이터 배치가 일치함을 확인했다.
3. **ctx 부재 시 전역 키로 fallback 하지 않는다** (`idempotency.interceptor.ts:100-109`) — `!executionId`
   분기가 즉시 `next.handle()` 로 빠지고 캐시 GET/SET 을 아예 건너뛴다. 조용한 fallback 이 바로
   원래 취약점을 되살리는 형태이므로, 이 fail-closed(캐시 관점)/fail-open(요청 통과 관점) 처분이
   맞는 방향이다. warn 로그도 사용자 데이터를 포함하지 않는다.
4. **`route` 세그먼트(`context.getHandler().name`)는 리플렉션 기반**이라 minifier 도입 시 붕괴할 수
   있다는 점이 코드 주석(§113-118)에 명시돼 있고, 실 파이프라인에서의 값 고정은 e2e `IDEM-5`
   (`external-interaction.e2e-spec.ts` 신규 테스트)가 담당한다. `interaction.controller.ts` 의
   `interact`/`cancel` 핸들러명과 일치함을 실측했다. 이 리스크는 직전 라운드(`21_02_30`)에서 이미
   INFO 로 평가·수용됐고 이번 라운드에서 조치(주석 강화)까지 됐으므로 재상신하지 않는다.
5. **Redis 키 조립에 인젝션 위험 없음.** `rawKey`(클라이언트 헤더 값)는 `readKey()` 로 trim +
   길이 상한(200) 검증 후 문자열 그대로 키 세그먼트에 쓰이지만, ioredis 의 `GET`/`SET` 은 RESP
   프로토콜(길이-프리픽스 바이너리-세이프 문자열)로 전송되므로 `:` 등 구분자를 포함해도 커맨드
   파싱에 영향을 주지 못한다 — SQL/LDAP 인젝션류의 파싱 기반 인젝션과 다른 프리미티브다.
6. **e2e 테스트의 DB 접근은 전부 파라미터 바인딩**(`$1`, `$2`, …)이라 SQL 인젝션 표면 없음
   (`external-interaction.e2e-spec.ts` 신규 `IDEM-4`/`IDEM-5`).
7. **하드코딩 시크릿 없음.** `external-interaction.e2e-spec.ts` 상단의
   `JWT_SECRET = process.env.JWT_SECRET ?? 'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7'` 는
   이번 diff 의 컨텍스트 줄(변경 없음, 기존 코드)이며 e2e 전용 fallback 시크릿으로 이미 저장소에
   존재하던 패턴이다 — 이번 변경이 새로 추가한 것이 아니라 신규 발견사항 대상이 아니다.
8. **에러 처리 — 민감정보 노출 없음.** 캐시 GET/SET/직렬화 실패 로그(`idempotency.interceptor.ts:131-136,
   254-266`)는 `err.message` 만 남기고 요청 body·토큰·키 원문을 로그에 싣지 않는다.

## 발견사항

없음 — CRITICAL/WARNING 대상 신규 발견 없음.

리뷰 대상에 포함된 `review/code/2026/08/12/21_02_30/*` (직전 라운드 산출물)와
`plan/complete|in-progress/spec-draft-eia-idempotency-key-scope.md` 는 코드가 아닌 문서/이력 산출물이며
자격증명·시크릿·민감정보를 포함하지 않는다.

## 요약

이번 diff 는 실제 broken-access-control 결함(멱등 캐시 네임스페이스가 execution 간 공유돼 다른
사용자의 캐시된 응답이 재생되는 문제, CWE-639 계열)을 정확히 겨냥해 닫는 보안 수정이다. 스코프
식별자(`executionId`)는 인증 Guard 가 토큰 검증 후 서버 측에서 합성한 값이라 클라이언트가 조작할
수 없고, Guard→Interceptor 실행 순서도 코드로 확인했다. ctx 부재 시 전역 키로 fallback 하지 않고
캐시 자체를 건너뛰는 fail-closed 설계이며, Redis 키 조립·DB 쿼리 모두 인젝션 표면이 없다. 새로
도입된 하드코딩 시크릿이나 민감정보 로그 노출도 없다. 유일한 잔존 리스크(`getHandler().name` 리플렉션
의존)는 직전 라운드에서 이미 평가·수용되고 e2e 캐너리로 방어된 상태라 이번 라운드에서 재상신하지
않는다.

## 위험도
NONE
