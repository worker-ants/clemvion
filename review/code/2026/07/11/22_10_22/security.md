# 보안(Security) 리뷰 결과

## 범위 요약
본 변경은 `plan/in-progress/refactor-reaper-dry.md` 에 명시된 **behavior-preserving DRY 리팩터**다:
1. `Webchat` → `WebChat` 식별자 표기 통일 (클래스/메서드/함수명 4종 + 전 파일 rename, 파일명·큐 문자열·env
   변수명·wire `error.code` 값은 불변)
2. 두 BullMQ sweep(`webchat-idle-reaper.service.reap`, `interaction-token.service.reconcileTerminalRevocations`)
   의 `for(i+=C){slice;allSettled;forEach}` 청크 루프를 `common/utils/process-in-batches.ts` 로 추출
3. execution-engine 의 4개 cancel 경로가 공유하던 `try{emitExecution}catch{warn}` 보일러플레이트를
   `emitCancellationEvent` private 헬퍼로 통합
4. 나머지는 spec 문서(`14-external-interaction-api.md`, `1-widget-app.md`, `3-auth-session.md`,
   `data-flow/0-overview.md`, `data-flow/15-external-interaction.md`)의 클래스명 표기 동기화 및 테스트 rename

새 엔드포인트, 새 인증/인가 로직, 새 외부 입력 처리 경로는 도입되지 않았다. 아래는 리팩터 산출물이
기존 보안 속성을 그대로 보존하는지에 초점을 맞춘 검토다.

## 발견사항

- **[INFO]** `verifyPerExecution` 의 명시적 타입 캐스트 제거 — 런타임 영향 없음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` (verify 호출부, 옛 L203-206)
  - 상세: `payload = verify(jwtPart, this.secret, {...}) as { sub?: unknown; aud?: unknown; jti?: unknown };` 에서
    `as {...}` 캐스트가 제거됐다. `payload` 변수 자체가 이미 동일 타입으로 선언돼 있어(`let payload: { sub?: unknown; aud?: unknown; jti?: unknown };`) TS 컴파일은 그대로 통과하고(plan 상 build PASS 확인됨), 캐스트는 컴파일 타임 전용이라 `verify()`
    가 실제로 반환하는 런타임 객체나 이후의 `typeof payload.sub === 'string'` / `typeof payload.jti === 'string'` 방어
    로직에는 영향이 없다. HS256 고정 alg·audience 검증·blacklist 체크 등 인증 핵심 로직은 변경되지 않았다.
  - 제안: 기능적 위험은 없으나, `jsonwebtoken` 의 `verify()` 반환 타입이 `JwtPayload | string` 유니언이라 향후
    라이브러리 타입 정의가 바뀌면 캐스트 없이도 이 대입이 조용히 타입 체크를 우회할 여지가 있다. 리팩터 목적(순수
    naming/DRY)과 무관한 변경이므로, 별도 이유가 없다면 원래 캐스트를 유지하거나 `refreshPerExecution` 과 동일하게
    명시적 타입을 남기는 편이 일관적이다.

- **[INFO]** `processInBatches` 의 concurrency floor — 방어적으로 양호
  - 위치: `codebase/backend/src/common/utils/process-in-batches.ts`
  - 상세: `Math.max(1, Math.floor(concurrency))` 로 0/음수 입력을 1(직렬)로 floor 해 무한 루프(`i += 0` 이었다면
    발생했을 DoS)를 원천 차단한다. 현재 두 호출처(`RECONCILE_CONCURRENCY=20`, `REAP_CONCURRENCY=10`)는 하드코딩
    상수라 실사용 경로에서 트리거되진 않지만, 범용 유틸로 추출되며 향후 호출처가 외부 설정값을 그대로 넘길 가능성에
    대비한 안전한 기본값이다. `Promise.allSettled` 사용으로 개별 item 실패가 batch 전체를 막지 않는 fail-open 특성도
    리팩터 전후 동일하게 유지된다.
  - 제안: 없음 (이미 안전한 설계).

## 확인된 보안 속성 (변경 없음, 유지 확인)

- SQL: `findIdleWebChatExecutionIds`/`reconcileTerminalRevocations` 모두 TypeORM `QueryBuilder` 의 파라미터
  바인딩(`:waiting`, `:threshold`, `:...terminal`)만 사용 — 문자열 결합 없음, SQL 인젝션 벡터 없음(리팩터로 쿼리
  자체는 미변경).
- 인증: `InteractionGuard`/JWT 검증 로직(HS256 고정 alg, audience 체크, jti blacklist, timing-safe 대안 —
  `verifyPerTrigger` 의 `timingSafeEqual`)은 이번 diff 에서 로직 변경 없음.
- 시크릿: `DEV_EPHEMERAL_SECRET`(모듈 로드시 1회 `randomBytes(32)`)와 production fail-closed(`NODE_ENV=production`
  에서 env secret 미설정 시 throw) 정책은 diff 대상이 아닌 기존 코드로 그대로 유지.
- `cancelledBy` 는 여전히 닫힌 3값 union(`'user' | 'system' | 'timeout'`)으로 `emitCancellationEvent` 시그니처에
  고정되어 있어, 통합 이후에도 임의 문자열이 이벤트 payload 에 흘러들 수 없다.
- 에러 로그(`emitErr.message`, `err.message`)는 통합 전후로 동일한 내부 로거(`this.logger.warn/error`) 노출
  범위이며, 클라이언트 응답 경로로 전파되지 않는다 — 리팩터로 새로 노출된 경로 없음.
- 문서(spec) 변경은 전부 클래스/함수명 표기(`Webchat`→`WebChat`) 동기화 문자열 치환뿐이며 보안 정책·인가 규칙
  서술은 변경되지 않음.

## 요약
이번 변경은 순수 behavior-preserving 리팩터(식별자 표기 통일 + 중복 코드 추출)로, 인증/인가, SQL 쿼리 구성,
시크릿 관리, 에러 로깅 범위 등 보안에 민감한 로직은 실질적으로 변경되지 않았다. 유일하게 주목할 부분은
`verifyPerExecution` 에서 명시적 타입 캐스트가 제거된 점이지만 런타임 동작에는 영향이 없고 타입 안전성 관점의
경미한 참고사항일 뿐이다. 새로 추출된 `processInBatches` 헬퍼는 concurrency 0/음수를 방어적으로 floor 처리해
기존보다 오히려 견고하다. 인젝션·하드코딩 시크릿·인증 우회·평문 전송 등 CRITICAL/WARNING 급 이슈는 발견되지
않았다.

## 위험도
NONE
