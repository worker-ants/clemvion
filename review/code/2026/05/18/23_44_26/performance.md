# 성능(Performance) 리뷰 — 2FA WebAuthn 구현 (spec/review 문서군)

## 발견사항

- **[WARNING]** WebAuthn credential 조회가 로그인 핫패스에 추가 DB 쿼리를 유발
  - 위치: `spec/5-system/1-auth.md §1.4.2` 로그인 분기 로직 정의 / `review/consistency/2026/05/18/23_11_17/rationale_continuity.md` 발견사항 1 (`auth.service.ts login()` 라인 310-316)
  - 상세: spec §1.4.2 가 정의한 WebAuthn 우선 분기 로직은 `/auth/login` 의 비밀번호 검증 이후 `WebAuthnCredential` 테이블에서 사용자 credential 개수를 SELECT 해야 한다. 현재 `auth.service.ts` 의 `login()` 은 `user.twoFactorEnabled` 만 확인하는 1회 쿼리 경로이지만, WebAuthn 분기를 추가하면 (a) User row 조회 + (b) WebAuthnCredential count 조회 — 두 번의 DB 쿼리가 필요해진다. `WebAuthnCredential (user_id)` 인덱스(`spec/1-data-model.md §3`)가 정의되어 있어 COUNT 쿼리 자체는 O(1)에 가깝지만, 로그인 핫패스에 I/O 라운드트립이 추가된다. User entity에 `webauthn_credential_count` 카운터 컬럼을 추가하거나(write 경로에서 증감), credential 존재 여부(boolean)만 확인하는 `EXISTS` 서브쿼리를 사용하면 full COUNT 를 피할 수 있다. 또는 User 조회 쿼리에서 credential을 LEFT JOIN + COUNT로 한 번에 가져오는 방법도 있다.
  - 제안: `auth.service.ts` 의 `login()` 구현 시 `SELECT COUNT(*) FROM webauthn_credential WHERE user_id = $1` 대신 `SELECT EXISTS(SELECT 1 FROM webauthn_credential WHERE user_id = $1)` 를 사용하거나, TypeORM `loadRelationCountAndMap` 을 활용해 User 조회와 credential count를 단일 쿼리로 합친다. 혹은 User entity에 `webauthnCredentialCount: number` 덴어마이즈드 컬럼을 추가해 credential INSERT/DELETE 트리거(애플리케이션 레이어)로 갱신한다.

- **[WARNING]** `loginWithTotp()` 내 WebAuthn credential 조회 백스탑 — 추가 쿼리
  - 위치: `review/consistency/2026/05/18/23_11_17/rationale_continuity.md` 발견사항 2 (`auth.service.ts loginWithTotp()` 라인 338-395)
  - 상세: rationale_continuity 리뷰가 권고하는 백스탑("WebAuthn credential ≥ 1 이면 TOTP_FORBIDDEN 반환")을 구현하려면 `loginWithTotp()` 에서도 WebAuthn credential 존재 여부 쿼리가 한 번 더 필요하다. 이 경로는 `login()` 이후 호출되므로 동일 request 내에서 두 메서드 모두 WebAuthn credential을 조회하는 경우 최악 2회 중복 조회가 발생한다. `login()` 에서 발급하는 `challengeToken` JWT payload 안에 `method: 'totp' | 'webauthn'` 을 박으면(`naming_collision.md` 발견사항 5 권고) `loginWithTotp()` 가 DB 쿼리 없이 토큰 클레임만으로 method 불일치를 거부할 수 있어 추가 쿼리를 제거할 수 있다.
  - 제안: challengeToken payload 에 `method` 클레임을 포함시켜 `loginWithTotp()` 의 WebAuthn 백스탑 검사를 DB 쿼리 없이 JWT 검증만으로 처리한다. 이는 `naming_collision.md` 발견사항 5 의 제안과 일치하며 성능과 보안을 동시에 개선한다.

- **[WARNING]** optionsToken stateless JWT 설계 — 5분 윈도우 내 동일 challenge 재사용 시 `@simplewebauthn` verify 연산 이중 실행 가능성
  - 위치: `spec/5-system/1-auth.md §1.4.C Rationale` / `spec/1-data-model.md §2.21` WebAuthnCredential
  - 상세: spec §1.4.C 는 "같은 5분 윈도우 안에서 동일 JWT 의 두 번째 verify 가 시도되면 credential 의 counter 증가가 한 번만 발생하므로 인증 통과 불가" 라고 기술한다. 그러나 `verifyAuthenticationResponse` 는 counter 역행 시 credential row 삭제까지 수행하므로, 공격자가 5분 이내 동일 optionsToken으로 /authenticate/verify 를 병렬 다중 요청하면 서버가 복수의 `verifyAuthenticationResponse` 호출을 동시에 수행하고, 경쟁 조건(race condition)으로 counter 갱신이 꼬이거나 credential이 의도치 않게 삭제될 수 있다. DB 행 레벨 잠금(`SELECT ... FOR UPDATE` 또는 TypeORM `pessimistic_write`)이 counter 갱신 경로에 없으면 문제다.
  - 제안: `WebAuthnService.verifyAuthentication()` 구현 시 credential row를 `SELECT ... FOR UPDATE` 로 조회해 counter 갱신과 삭제 결정을 원자적으로 처리한다. TypeORM 에서는 `Repository.findOne({ lock: { mode: 'pessimistic_write' } })` 를 사용한다.

- **[INFO]** 복구 코드 검증 — SHA-256 해시 비교 시 타이밍 공격 방어 필요
  - 위치: `spec/5-system/1-auth.md §1.4.1` 복구 코드 저장 (SHA-256 해시 배열)
  - 상세: spec 은 복구 코드를 SHA-256 해시 배열로 저장하고 사용 시 항목을 제거한다고 정의한다. 해시 비교 구현 시 JavaScript 의 일반 `===` 비교나 `Array.find(c => c === hash)` 패턴은 타이밍 정보를 노출한다. Node.js 의 `crypto.timingSafeEqual()` 을 사용하지 않으면 timing side-channel 공격에 취약하다. 이는 성능 관점에서 올바른 구현(상수 시간 비교)이 보안과 직결되는 지점이다.
  - 제안: 복구 코드 해시 비교 구현 시 `crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(inputHash, 'hex'))` 를 사용한다. 배열 순회 시 모든 항목을 비교한 뒤 일치 여부를 반환(early-exit 금지)해 타이밍 일관성을 보장한다.

- **[INFO]** WebAuthn credential 목록 조회 — `publicKey` (BYTEA) 필드 노출 제외 명시, 불필요한 대형 컬럼 로딩 방지
  - 위치: `spec/5-system/1-auth.md §5` `GET /api/auth/2fa/webauthn/credentials` 응답 정의
  - 상세: spec §5 는 credential 목록 응답에서 `publicKey`·`counter` 를 미노출한다고 명시한다. 그러나 구현 시 TypeORM 기본 `find()` 는 `public_key` BYTEA 컬럼 전체를 메모리에 로딩한다. WebAuthn public key는 인증기마다 수백 바이트 규모이며, 다수의 credential을 가진 사용자 조회 시 네트워크·메모리 양쪽에서 불필요한 오버헤드가 발생한다.
  - 제안: `GET /api/auth/2fa/webauthn/credentials` 구현 시 TypeORM `select` 옵션으로 `publicKey`, `counter` 컬럼을 명시적으로 제외한다. 예: `credentialRepository.find({ where: { userId }, select: ['id', 'deviceName', 'transports', 'lastUsedAt', 'createdAt', 'aaguid'] })`.

- **[INFO]** LoginHistory 보존 정책(180일) 자동 삭제 배치 — 인덱스 활용 효율성
  - 위치: `spec/1-data-model.md §2.18.2` LoginHistory, `§3` 인덱스 표
  - 상세: spec 은 LoginHistory 에 180일 경과 row 를 일일 배치로 자동 삭제한다고 정의한다. 인덱스 표에 `(user_id, created_at DESC)`, `(email, created_at DESC)` 두 인덱스가 있다. 배치 삭제 쿼리가 `WHERE created_at < NOW() - INTERVAL '180 days'` 형태라면 `created_at` 단독 인덱스가 없는 상태에서 위 복합 인덱스가 부분적으로 활용될 수 있지만, 대규모 row 삭제 시 인덱스 선두 컬럼(`user_id`, `email`) 없이는 full table scan 이 발생할 수 있다. WebAuthn 추가로 `webauthn_failed` 이벤트가 쌓이면 테이블 볼륨이 증가한다.
  - 제안: 배치 삭제 쿼리 설계 시 `created_at` 만을 조건으로 하는 partial index(`CREATE INDEX ON login_history (created_at) WHERE created_at < NOW() - INTERVAL '170 days'`)를 추가하거나, 배치를 `user_id` 단위로 청킹해 기존 인덱스를 활용하는 방식을 고려한다. 또는 PostgreSQL 테이블 파티셔닝(월별 파티션)을 도입해 만료 파티션 DROP 으로 삭제 I/O를 제거한다.

- **[INFO]** meta.json 내 절대 경로 박제 — 환경 이동 시 재처리 비용
  - 위치: `review/consistency/2026/05/18/23_11_17/_retry_state.json` 전체
  - 상세: `_retry_state.json` 은 모든 `prompt_file`, `output_file` 경로를 `/Volumes/project/private/clemvion/...` 절대 경로로 박아 두고 있다. 이는 성능 문제는 아니지만, 다른 머신이나 경로에서 재시도할 때 모든 경로를 재계산해야 하는 운영 비용이 있다. 동일 파일이 대규모 review 세션에서 수백 개로 증가하면 경로 재처리 비용이 누적된다.
  - 제안: 세션 루트를 기준으로 한 상대 경로 + 세션 루트 절대 경로 분리 저장 방식으로 전환하면 이식성과 처리 효율이 모두 향상된다.

---

## 요약

이번 변경셋의 핵심 성능 관심사는 WebAuthn 분기 로직이 로그인 핫패스에 추가하는 DB 쿼리다. spec §1.4.2 가 요구하는 "WebAuthn credential 존재 여부 선 확인" 은 필연적으로 `login()` 에 추가 SELECT를 유발하며, `loginWithTotp()` 백스탑까지 구현하면 동일 요청 내 중복 조회 가능성이 생긴다. challengeToken 에 `method` 클레임을 포함시키는 설계(naming_collision.md 제안과 일치)가 이 중복 쿼리를 제거하는 가장 깔끔한 방법이다. optionsToken stateless JWT 설계는 DB 단명 row 를 제거한 좋은 선택이나, 병렬 verify 요청에 대한 행 레벨 잠금이 없으면 counter 경쟁 조건이 발생할 수 있어 구현 시 주의가 필요하다. 복구 코드 해시 비교의 상수 시간 구현, credential 목록 조회 시 BYTEA 컬럼 제외, LoginHistory 배치 삭제 인덱스 전략은 모두 구현 단계에서 선제 적용할 수 있는 INFO 수준 최적화다. 전반적으로 설계 문서에 성능 관련 치명적 문제는 없으나, 로그인 경로의 추가 DB 쿼리와 credential counter 갱신 경합 가능성은 구현 전 명시적으로 설계를 확정해야 할 WARNING 항목이다.

---

## 위험도

MEDIUM
