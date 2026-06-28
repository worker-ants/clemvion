# 보안(Security) 리뷰

## 발견사항

### 인젝션 취약점

이번 변경의 모든 DB 쿼리(`external-interaction.e2e-spec.ts`, `e2e-chat-channel-fixture.ts`)는 parameterized query (`$1, $2, ...` 플레이스홀더 + 값 배열)를 사용한다. SQL 인젝션 위험 없음. `V102` migration은 DDL 전용으로 사용자 입력을 포함하지 않는다.

### 하드코딩된 시크릿

- **[WARNING]** `external-interaction.e2e-spec.ts` 1180번째 줄에 JWT_SECRET 폴백 리터럴 노출
  - 위치: `/codebase/backend/test/external-interaction.e2e-spec.ts` 라인 1179-1180
  - 상세: `const JWT_SECRET = process.env.JWT_SECRET ?? 'clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7';`
    리터럴 자체에 "do-not-use-in-prod" 경고 문구가 포함되어 있으며 e2e 전용 파일이다. 하지만 소스코드 이력(git history)에 영구 노출되며, docker-compose.e2e.yml 의 기본값과 동기화 유지를 강제한다. 악의적 운영자가 해당 값이 운영 환경에 주입되었는지 확인하기 어렵다.
  - 제안: 폴백 리터럴 대신 환경변수 미주입 시 테스트를 명시적으로 실패(`throw new Error('E2E_JWT_SECRET must be set')`)시키거나, 테스트 전용 상수를 별도 `test/constants.ts` 에 분리하고 `.gitignore`된 `.env.e2e.local` 에서 주입하는 방식 권장. 현재 패턴은 기존 PR에도 동일하게 존재하던 pre-existing 이슈로, 이번 변경이 신규 도입한 것은 아님.

- **[INFO]** `trigger-dto-validation.spec.ts` 에 `SLACK_SIGNING_SECRET`, `DISCORD_PUBLIC_KEY` 리터럴 존재
  - 위치: 라인 392-394 (`SLACK_SIGNING_SECRET = 'a1b2c3d4e5f6...'`, `DISCORD_PUBLIC_KEY = 'abcdef...'`)
  - 상세: 테스트용 픽스처 값이며 실 운영 키가 아닌 고정 hex 패턴. 테스트 파일 내 위치로 허용 가능. 이번 PR의 신규 변경 범위 외.

### 인증/인가

- **[INFO]** `external-interaction.e2e-spec.ts` 내 `createTriggerWithInteraction` 는 "auth 흐름 우회"를 명시적으로 주석에 표기하며 직접 DB INSERT를 수행한다. 이는 e2e 인프라 격리 환경 전용 패턴이며 production 코드 경로가 아니다. 변경 사항(`endpointPath = randomUUID()`)은 이 패턴을 유지하면서 UUID 형식 제약을 준수하도록 수정된 것으로 보안상 올바른 방향이다.

- **[INFO]** `mintInteractionToken` 함수(라인 1183-1190)가 `JWT_SECRET` 리터럴 폴백을 사용한다. 위 WARNING과 같은 원인.

### 입력 검증

- **[INFO]** `UpdateTriggerDto` 의 `endpointPath` 는 `@IsUUID('4')` + `@IsOptional()` 데코레이터가 올바르게 적용되어 있다. v4 UUID 형식 외의 값은 ValidationPipe 단에서 400으로 차단된다.

- **[INFO]** `V102` migration의 CHECK 제약 정규식 `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` 는 `class-validator` 의 `isUUID('4')` 와 동일한 형식을 DB 레벨에서도 강제하는 이중 방어다. NOT VALID 옵션으로 레거시 row에 영향 없이 신규 write만 제약하는 것은 운영 안전 관점에서 적절하다.

- **[INFO]** `e2e-chat-channel-fixture.ts` 의 `password_hash` 는 bcrypt round=1로 생성된다. 주석에 명시된 대로 e2e 속도 우선 결정이며 production 경로(`round 12`)와 분리되어 있다. 테스트 전용 파일이므로 허용.

### OWASP Top 10

- **[INFO]** endpoint_path 가 `randomBytes(6).toString('hex')` 기반 slug (`e2e-${slug}-<12hex>`) 에서 `randomUUID()` v4 UUID로 변경되었다. 이전 패턴은 48비트 엔트로피(12 hex chars), 새 패턴은 122비트 엔트로피. Spec WH-SC-01 "사실상 비밀 키" 요건에 부합하는 올바른 방향이다.

- **[INFO]** `system-status.e2e-spec.ts` 변경(EXPECTED_QUEUE_NAMES에서 `workspace-invitations-pruner` 중복 제거)은 순수 테스트 유지보수로 보안 영향 없음.

### 암호화

- **[INFO]** e2e E 시나리오(webhook-trigger.e2e-spec.ts 라인 1928-1931)에서 HMAC-SHA256 서명 검증 패턴이 올바르게 사용된다. `sha256=` prefix 방식은 GitHub Webhook 호환 패턴으로 적절.

### 에러 처리

- **[INFO]** e2e 테스트 F 시나리오(external-interaction.e2e-spec.ts 라인 1313-1315)는 `MESSAGE_TOO_LONG` 응답 바디에 `10000`/`10001` 등 내부 수치가 노출되지 않음을 명시적으로 검증한다. 에러 상세 정보 숨김이 테스트로 회귀 가드되어 있어 긍정적이다.

### 의존성 보안

이번 diff에서 신규 npm/pip 의존성 추가 없음. 점검 불필요.

---

## 요약

이번 변경은 전반적으로 보안을 강화하는 방향이다. `endpoint_path` 를 `randomBytes(6)` slug에서 `randomUUID()` v4 UUID로 교체하여 122비트 엔트로피를 확보하고, DB CHECK 제약(NOT VALID)으로 DTO 검증을 우회하는 직접 DB write 경로도 차단하는 이중 방어를 구축했다. 신규 보안 취약점은 발견되지 않는다. 유일한 지적 사항은 `external-interaction.e2e-spec.ts` 의 JWT_SECRET 폴백 리터럴인데, 이는 PR 신규 도입이 아닌 pre-existing 패턴으로 이번 변경 범위가 오히려 UUID 보안을 강화하는 수정임을 고려하면 이번 PR의 차단 요인은 아니다.

## 위험도

LOW
