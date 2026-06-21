### 발견사항

- **[INFO]** SQL 인젝션: 해당 없음
  - 위치: 파일 2 (e2e spec) — db.query 호출 전체
  - 상세: 모든 DB 쿼리가 파라미터화된 쿼리(`$1`, `$2` 등)를 사용하고 있어 SQL 인젝션 위험 없음. 테스트 코드이지만 패턴 자체는 올바름.
  - 제안: 현행 유지.

- **[INFO]** 토큰 강도: e2e 테스트의 시드 토큰 패턴
  - 위치: 파일 2 라인 146, 284, 445 — `rawToken = \`e2e-token-${user.userId}\``, `\`race-token-${userId}\``
  - 상세: 이 토큰들은 테스트 전용 시드 값으로, 프로덕션 토큰 생성 로직(uuidv4)과 별개임. e2e 테스트 환경에서만 사용되며 실제 랜덤 토큰을 대체하는 의도적 단순화임. 프로덕션 코드에 유입될 위험 없음.
  - 제안: 현행 유지. 단, e2e 환경이 프로덕션 DB에 연결되지 않도록 `E2E_BASE_URL` 환경 분리가 중요함(이미 `http://backend-e2e:3011`로 분리되어 있음).

- **[INFO]** 하드코딩된 시크릿: `TEST_PASSWORD` 상수
  - 위치: 파일 2 — `import { TEST_PASSWORD } from './helpers/auth'`
  - 상세: 테스트 전용 헬퍼에서 임포트하는 테스트 비밀번호. 실제 자격증명이 아니라 테스트 픽스처이므로 하드코딩 문제가 아님.
  - 제안: 현행 유지.

- **[INFO]** 프론트엔드 XSS: 이메일 주소 렌더링
  - 위치: 파일 4 (profile-info-card 테스트) — `pendingEmail` 렌더링 확인 `toHaveTextContent("new@example.com")`
  - 상세: `pendingEmail`이 UI에 직접 렌더링되는 경로. React가 기본적으로 HTML 이스케이핑을 수행하므로 일반적인 XSS 위험은 없음. 단, 실제 컴포넌트 구현(이번 변경 범위 밖)에서 `dangerouslySetInnerHTML`을 사용하지 않는 것이 전제임.
  - 제안: 실제 `profile-info-card.tsx` 컴포넌트에서 `dangerouslySetInnerHTML` 미사용 확인 권장.

- **[INFO]** 이메일 대소문자 무시 인덱스 — non-unique 선택
  - 위치: 파일 1 (V101 마이그레이션) — `CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email));`
  - 상세: non-unique 표현식 인덱스로 조회 성능만 가속. 기존 case-sensitive UNIQUE 제약이 중복 방지 최종 가드로 유지됨. 대소문자 변형 이메일 중복을 허용하는 보안 함의가 있으나, 이는 이미 `emailTakenByOther`의 `LOWER()` 쿼리와 UNIQUE 제약이 조합으로 처리하는 설계 의도임.
  - 제안: 현행 설계는 적절함. 단, `emailTakenByOther`가 모든 이메일 등록/변경 경로에서 일관되게 호출되는지 확인 필요.

- **[INFO]** verify 엔드포인트의 토큰 바인딩 설계 — 긍정적 평가
  - 위치: 파일 2, 8 (spec 데이터 플로우)
  - 상세: `POST /email-change/verify`가 JWT 인증 필수(토큰이 인증된 사용자에 바인딩)로 설계되어 있음. 누출된 링크 단독으로는 이메일 변경 불가 — OWASP 정합 강화 설계.

- **[INFO]** 전 세션 revoke 설계 — 긍정적 평가
  - 위치: 파일 2 (e2e), 파일 8 (spec)
  - 상세: verify 성공 시 `revokeAllFamilies` 호출로 전 세션 무효화 + 현재 디바이스 재발급. 이메일이 로그인 식별자이므로 변경 시 전 세션 revoke는 OWASP Session Management 정합.

- **[INFO]** SHA-256 토큰 at-rest 저장
  - 위치: 파일 1~8 전반
  - 상세: `email_change_token`을 SHA-256 해시로만 DB에 저장(raw 토큰은 이메일로만 전달). 기존 `email_verify_token`, `password_reset_token`과 동일 패턴. SHA-256은 일방향 해시로 at-rest 토큰 보호 용도에 적합.

- **[INFO]** 레이스 컨디션(신규 이메일 선점) 처리 — 긍정적 평가
  - 위치: 파일 2 e2e 테스트 `'verify 시점 신규 이메일 선점 → 409 + pending 정리'`
  - 상세: verify 트랜잭션 내 선점 재검사 + pending NULL화 처리가 e2e로 검증됨. 정합.

- **[INFO]** resend 스로틀링
  - 위치: 파일 8 (spec data-flow) — `request/resend 5 req/min`
  - 상세: resend e2e 테스트에는 throttle 경계 케이스 테스트가 없음. 기능 정확성 테스트에 집중된 범위로 이해되며, throttle 자체는 spec에 명시됨.
  - 제안: 필요 시 별도 throttle 경계 테스트 추가 가능하나 현 범위에서는 비차단 INFO.

---

### 요약

이번 변경(V101 LOWER 표현식 인덱스 마이그레이션, e2e 테스트 3개 추가, 프론트엔드 단위 테스트, spec/plan 문서)은 보안 관점에서 전반적으로 양호하다. SQL 인젝션은 파라미터화 쿼리로 차단되어 있고, 토큰은 SHA-256 at-rest 저장을 일관되게 적용한다. verify 엔드포인트의 JWT 인증 의무화(누출 링크 단독 차단), verify 성공 시 전 세션 revoke, TOTP/WebAuthn 재인증 의무화(이메일 OTP 배제), 레이스 컨디션 선점 재검사 등 핵심 인증/인가 보안 설계가 e2e 테스트로 검증된다. 하드코딩된 시크릿은 없으며, 테스트 픽스처 토큰은 e2e 전용 환경(`backend-e2e:3011`)으로 격리된다. Critical 또는 Warning 수준의 보안 결함은 발견되지 않았다.

### 위험도

NONE
