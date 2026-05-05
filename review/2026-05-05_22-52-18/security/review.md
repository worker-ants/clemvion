### 발견사항

---

**[WARNING] Bearer Token 비교에 타이밍 안전 비교(Timing-Safe Comparison) 미사용**
- 위치: `hooks.service.ts` — `verifyAuth()` 메서드, `authType === 'bearer'` 분기
- 상세: `token !== config.bearerToken` 는 일반 문자열 비교이므로 응답 시간 차이를 측정하는 타이밍 공격으로 토큰을 한 문자씩 추측하는 것이 이론적으로 가능하다.
- 제안:
  ```typescript
  if (
    !token ||
    token.length !== (config.bearerToken ?? '').length ||
    !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(config.bearerToken ?? ''))
  ) {
    throw new UnauthorizedException(...);
  }
  ```

---

**[WARNING] `crypto.timingSafeEqual` 버퍼 길이 불일치 시 TypeError 미처리**
- 위치: `hooks.service.ts` — `verifyAuth()`, HMAC 분기 마지막 검증부
- 상세: `timingSafeEqual(Buffer.from(signature), Buffer.from(expected))` 는 두 버퍼 길이가 다르면 `ERR_CRYPTO_TIMINGSAFEEQUAL_LENGTH` TypeError를 throw한다. 현재 코드는 이를 잡지 않으므로, 외부 공격자가 잘못된 길이의 서명 헤더를 전송하면 500 에러가 발생한다(개별 요청 단위 DoS). `!signature || !rawBody` 가드는 이 경우를 커버하지 않는다.
- 제안: 비교 전 길이 체크를 추가한다.
  ```typescript
  if (
    Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) { ... }
  ```

---

**[INFO] OTEL 트레이스 엔드포인트 기본값이 평문 HTTP**
- 위치: `instrumentation.ts` — `OTLPTraceExporter` url 기본값
- 상세: `http://localhost:4318/v1/traces` 는 로컬호스트 기본값이므로 개발 환경에서는 무해하다. 그러나 `OTEL_EXPORTER_OTLP_ENDPOINT` 환경 변수를 설정하지 않고 외부 Collector를 사용하는 경우, 트레이스 데이터(쿼리 파라미터, 사용자 ID, 실행 메타데이터 등 민감 정보 포함 가능)가 평문으로 전송될 수 있다.
- 제안: 운영 환경에서는 반드시 HTTPS 엔드포인트로 설정하고, 이를 배포 체크리스트에 명시한다.

---

**[INFO] `executedBy` / `triggerId` UUID 형식 검증 부재**
- 위치: `execution-engine.service.ts` — `execute()` 메서드, `executionRepository.create()` 호출부
- 상세: `options?.executedBy` 와 `options?.triggerId` 는 DB에 직접 저장되지만 UUID 형식 검증 없이 그대로 쓰인다. 현재 호출 경로(JWT `user.sub`, DB Entity의 `trigger.id`)는 모두 신뢰 가능한 소스이므로 실질적 위험은 낮다. 그러나 향후 새로운 호출자가 추가될 때 방어 계층이 없다.
- 제안: 서비스 레이어에서 UUID 형식 검증(`/^[0-9a-f]{8}-[0-9a-f]{4}-…/`) 또는 TypeORM Column 레벨 `@IsUUID()` 데코레이터 추가를 고려한다.

---

### 요약

이번 변경의 핵심인 `execute()` 시그니처 옵션 객체화와 `triggerId` 전파 로직 자체는 보안 측면에서 적절하다. `executedBy` 는 JWT guard를 통과한 `user.sub` 에서, `triggerId` 는 DB Entity에서 오므로 신뢰 체인이 유지된다. 다만 기존 코드(`hooks.service.ts`)에 존재하던 두 가지 취약점이 이번 리뷰에서 식별되었다: Bearer 토큰 비교가 타이밍 안전하지 않고, HMAC 검증 시 버퍼 길이 불일치로 인한 unhandled exception 가능성이 있다. 두 이슈 모두 외부 공격자가 직접 호출하는 `/api/hooks/*` 엔드포인트에서 발생할 수 있어 실질적인 위험이 존재한다.

### 위험도

**LOW** (기존 코드 내 MEDIUM 수준 이슈 2건 포함, 신규 변경 자체는 LOW)