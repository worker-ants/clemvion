# Security Review — 이메일 변경 후속 (V101·테스트·data-flow·plan)

세션: `review/code/2026/06/21/21_45_46`

## 발견사항

### 파일 1: V101__add_user_email_lower_index.sql

- **[INFO]** non-UNIQUE 표현식 인덱스 — LOWER() 조회 가속 목적이며 보안 속성 없음
  - 위치: `CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email));`
  - 상세: 인덱스 자체는 데이터 노출·인젝션 경로가 아님. LOWER()를 사용한 case-insensitive 중복 검사는 계정 열거(email enumeration) 억제에 기여하는 올바른 설계임. 별도 UNIQUE 제약이 커밋 시 최종 가드 역할을 유지하므로 race 조건으로 중복 이메일이 삽입될 위험도 없음.
  - 제안: 없음. 현행 설계 유지.

### 파일 2: auth.service.spec.ts (신규 테스트)

- **[INFO]** 테스트 파일 — 프로덕션 보안 표면 없음
  - 위치: 전체
  - 상세: 단위 테스트만 변경됨. 실제 토큰·비밀번호·시크릿은 포함되지 않음. `'SMTP down'` 등 에러 메시지 문자열은 테스트 목 전용이며 프로덕션 코드에 반영되지 않음. `resendEmailChange` 메일 실패 시 `pendingEmail`을 NULL화하지 않는(롤백 없음) 비대칭 동작이 테스트로 명시적으로 검증됨 — 이는 보안 관점에서 올바름(실패 후에도 pending 상태가 유지되어 사용자가 재시도 가능, 토큰 자체는 재발급됨).
  - 제안: 없음.

### 파일 3: users-email-change.e2e-spec.ts (e2e 테스트)

- **[INFO]** `seedPendingEmailChange` 헬퍼 — 파라미터화 쿼리 사용
  - 위치: `seedPendingEmailChange` 함수 내 `db.query(... [$1, $2, $3] ...)` (라인 156-163)
  - 상세: DB 직접 시드 쿼리가 `$1/$2/$3` 위치 바인딩 파라미터를 사용하여 SQL 인젝션 위험이 없음.

- **[INFO]** `expiresSql` 파라미터 — 인터폴레이션 주의
  - 위치: `seedPendingEmailChange` 함수의 `expiresSql = "NOW() + INTERVAL '1 hour'"` 파라미터
  - 상세: `expiresSql`이 쿼리 문자열에 직접 인터폴레이션(`${expiresSql}`)된다. 이 함수는 e2e 테스트 파일 내부에서만 호출되며, 두 호출처 모두 리터럴 문자열(`"NOW() + INTERVAL '1 minute'"`)을 넘기므로 사용자 입력이 도달하지 않는다. 프로덕션 코드가 아닌 테스트 헬퍼이므로 실질 위험은 없으나, 향후 호출처 추가 시 SQL 인젝션 가능성에 유의해야 함.
  - 제안: 테스트 범위 한정으로 실제 위험 없음. 다만 함수 시그니처에 `/** @internal test-only */` 주석으로 외부 입력 금지를 명시하면 더 안전.

- **[INFO]** `rawToken` 값이 e2e 고정 문자열
  - 위치: `rawToken = 'race-token-${userA.userId}'`, `rawToken = 'e2e-token-${user.userId}'`
  - 상세: 예측 가능한 토큰이지만 테스트 환경 전용이며 실제 토큰 생성 로직(`uuidv4`)과 분리됨. 보안 위험 없음.

- **[INFO]** verify race 케이스 409 + pending 정리 검증
  - 위치: `'verify 시점 신규 이메일 선점 → 409 + pending 정리'` 테스트
  - 상세: TOCTOU(time-of-check/time-of-use) race를 명시적으로 테스트함. 409 반환 시 `pending_email`과 `email_change_token`이 NULL화되는지 검증 — 보안적으로 올바른 동작(선점된 이메일로의 변경 시도 차단 + 상태 정리).
  - 제안: 없음. 설계 우수.

### 파일 4: verify-email-change.test.tsx (프론트엔드 단위 테스트)

- **[INFO]** 토큰 없는 링크 처리 — 에러 표시 + verify 미호출 검증
  - 위치: `'토큰 없는 링크 → 에러 표시, verify 미호출'` 테스트
  - 상세: `token=null`인 경우 API 호출 없이 에러 표시를 검증함. 이는 빈 토큰으로 서버에 요청하는 것을 방지하는 프론트엔드 방어 로직을 커버.

- **[INFO]** `setAccessToken` 교체 검증
  - 위치: `expect(setAccessToken).toHaveBeenCalledWith("new-AT")`
  - 상세: 이메일 변경 완료 후 access token 교체를 검증함. 테스트 코드 자체에 실제 토큰은 없으며(`"new-AT"` 는 목 값) 보안 위험 없음.

### 파일 5: profile-info-card.test.tsx (프론트엔드 단위 테스트)

- **[INFO]** `pendingEmail` UI 노출 검증
  - 위치: `'pendingEmail 이 있으면 확인 대기 주소를 표시한다'` 테스트
  - 상세: `pendingEmail`이 화면에 출력되는 것을 검증. 이 값이 서버로부터 오는 사용자 본인 데이터임을 감안할 때, XSS 방어는 React의 기본 이스케이핑에 의존하는 구조인 것으로 보임. 테스트 코드 자체로는 이스케이핑 검증이 없으나, React 환경에서의 텍스트 렌더링은 자동 이스케이핑되므로 별도 취약점 없음.

### 파일 6~10: plan/complete/*.md, SUMMARY.md, RESOLUTION.md

- **[INFO]** 문서 파일만 변경 — 보안 표면 없음
  - 상세: 경로·설계 결정·리뷰 결과를 기록한 마크다운 파일. 하드코딩된 시크릿·토큰·자격증명 없음. 설계 문서에서 보안 결정 사항(`email_change_token` SHA-256 저장, OAuth-only 차단, `@Public` 미사용, audit details PII 최소화 등)이 올바르게 문서화됨.

---

## 요약

이번 변경 세트는 전부 테스트 코드(백엔드 단위 테스트, e2e 테스트, 프론트엔드 단위 테스트), DB 마이그레이션(표현식 인덱스 추가), 문서/plan 파일로 구성된다. 프로덕션 보안 표면 변경이 없으므로 직접적인 취약점은 발견되지 않았다. e2e 헬퍼 `seedPendingEmailChange`의 `expiresSql` 파라미터가 직접 인터폴레이션되지만 테스트 파일 내부 전용이며 모든 호출처가 리터럴 문자열이다. 설계 문서에서 확인된 보안 결정(SHA-256 at-rest 토큰, verify 인증 필수, OAuth-only 계정 변경 차단, audit details PII 최소화, TOCTOU race 대응)은 모두 올바르고 이번 변경에서도 일관성 있게 유지된다.

## 위험도

NONE
