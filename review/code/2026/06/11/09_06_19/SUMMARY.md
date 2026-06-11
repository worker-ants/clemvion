# Code Review 통합 보고서

> 대상: auth-refresh-rotation-atomic (05 C-1 — refresh 토큰 rotation 원자화)
> 리뷰 세션: 2026/06/11 09_06_19

---

## 전체 위험도

**LOW** — 신규 Critical 발견 없음. 기능 정확성·보안·원자성 구현은 올바름. 하위 WARNING 4건(테스트 단언 보완, 유지보수성 개선 2건, 성능 후속 항목)과 SPEC-DRIFT 1건이 존재하나 차단 수준은 아님.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 해당 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Performance | `resolveTokenWorkspaceContext`(최대 3회 순차 DB 읽기)가 트랜잭션 콜백 내부에서 실행되어 커넥션 hold time 불필요 연장 | `auth.service.ts` `generateTokens()` — `dataSource.transaction` 콜백 안 | `resolveTokenWorkspaceContext` + JWT sign 계산을 트랜잭션 콜백 호출 전에 선계산하고 결과를 클로저로 전달. 이전 리뷰(08_45_18 INFO 1)에서 후속 plan 항목으로 수용된 사항이므로 즉시 차단 아님 |
| 2 | Testing | 롤백 테스트(`propagates failure when issuing the new token fails`)에서 `refreshTokenRepo.update` 호출 여부를 단언하지 않아 "revoke 시도 후 INSERT 실패 → 에러 전파" 흐름의 서술이 불완전 | `auth.service.spec.ts` lines 131–149 | `expect(refreshTokenRepo.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'rt-1', isRevoked: false }), ...)` 단언 추가 |
| 3 | Maintainability | `generateTokens` 함수 내 영/한 주석 혼용 — 기존 `// Create refresh token`, `// 15 minutes`(영어)와 신규 `// 05 C-1 —`(한국어)가 혼재 | `auth.service.ts` `generateTokens()` 내부 | 기존 영어 인라인 주석을 한국어로 통일하거나 신규 주석을 기존 스타일로 통일 |
| 4 | Maintainability | `mockRefreshTokenRepo` 클로저 의존 — `DataSource.transaction` mock이 `beforeEach` 지역 변수를 암묵적으로 캡처하여 선언 순서 결합 취약성 존재 | `auth.service.spec.ts` `beforeEach` DataSource mock 구성부 | DataSource mock 객체 구성 바로 위에 `// DataSource.transaction mock 은 위 mockRefreshTokenRepo 를 클로저로 캡처함 — 이 변수보다 나중에 선언해야 함` 주석 한 줄 추가 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] spec 시퀀스 다이어그램 라인 170이 조건부 UPDATE 조건을 반영하지 않아 낡음 — 코드는 `WHERE id=X AND is_revoked=false AND expires_at>now`를 사용하나 다이어그램은 단순 `WHERE id=X`만 표기 | `spec/data-flow/2-auth.md` 라인 170 vs `auth.service.ts` 라인 594–601 | 코드 유지 + spec 다이어그램 라인 170 UPDATE 행을 `WHERE id = row.id AND is_revoked = false AND expires_at > now`로 갱신 |
| 2 | Performance | 트랜잭션 콜백 내 `new Date()` 이중 생성 — 조건부 UPDATE용과 `lastUsedAt`용이 별도 생성돼 미세 타임스탬프 불일치 가능 | `auth.service.ts` L595, L598 | 콜백 상단에 `const now = new Date()` 한 번 선언 후 재사용 |
| 3 | Performance | `MoreThan(new Date())` 사용 — Node.js 시각을 파라미터로 전달; 멀티 리전 환경에서 app-DB 시각 차이 위험 | `auth.service.ts` L595 | 허용 가능 수준. 멀티 리전 환경이라면 DB `NOW()` raw 조건 사용 검토 |
| 4 | Architecture | `generateTokens` optional `EntityManager` 파라미터 — DIP 관점 인프라 결합이나 NestJS+TypeORM 관용구로 수용 가능. JSDoc `@internal` 명시됨 | `auth.service.ts` `generateTokens()` 시그니처 | 현행 유지 |
| 5 | Architecture | `refreshTokenRepository.manager.getRepository(User)` 패턴 — RefreshToken repo 경유 User 조회로 모듈 경계 불명확 (기존 부채, 이번 변경과 무관) | `auth.service.ts` `findUserByVerifyToken` 등 | 별도 후속 이슈로 `@InjectRepository(User)` 추가 추적 |
| 6 | Security | 트랜잭션 외부 `expiresAt` 사전 검사의 TOCTOU 창 — 단, 조건부 UPDATE의 `MoreThan(new Date())` 조건이 실질 보안 보장을 담당하므로 실질 위험 없음 | `auth.service.ts` `refresh()` 만료 검증 분기 | 현행 유지 가능. 트랜잭션 밖 검사는 성능 조기 거부용 |
| 7 | Security | reuse detection 분기 — family 전체 revoke + `loginHistory.record()` 가 트랜잭션 없이 순차 실행 (기존 코드, 본 변경 범위 외) | `auth.service.ts` `refresh()` `stored.isRevoked` 분기 | 현행 수용 가능. loginHistory 누락이 보안 침해가 아님(family 이미 revoke됨) |
| 8 | Security | 글로벌 예외 필터 재확인 권장 — 트랜잭션 실패 에러가 클라이언트에 원문 노출 안 되도록 | `auth.service.ts` `dataSource.transaction()` reject 전파 경로 | `HttpExceptionFilter` 등이 `Error.message` 직렬화 차단 여부 확인 (기존 인프라 책임) |
| 9 | Concurrency | reuse-detection 분기 및 만료 분기의 트랜잭션 밖 실행 — 동시 요청 시 멱등적 UPDATE이므로 데이터 손상 없음 | `auth.service.ts` lines 544–562 | 현행 유지. 필요 시 `loginHistory.record()` 단독 try/catch 격리 검토 |
| 10 | Maintainability | `if (!result.affected)` falsy 체크 — `null`/`undefined` 포함 여부가 명시적이지 않음 | `auth.service.ts` ~L602 | `result.affected === 0` 명시적 비교 또는 falsy 전체 거부 의도 주석 명시 |
| 11 | Maintainability | `generateTokens` positional 파라미터 5개 — optional 2개 혼재로 호출 시 순서 추론 부담 | `auth.service.ts` `generateTokens` 시그니처 | 다음 변경 시점에 `GenerateTokensOptions` 인터페이스로 묶기 권장. 현재는 유지 허용 |
| 12 | Maintainability | `const ACCESS_TOKEN_TTL_SEC = 900` 매직 넘버 추출 미적용 | `auth.service.ts` ~L768 | 상수 추출 권장 (이번 PR 필수 아님) |
| 13 | Maintainability | 테스트 `refreshTokenRepo.findOne` mock 4회 중복 setup | `auth.service.spec.ts` 신규 4개 케이스 | `refresh` describe `beforeEach`에 공통 mock 추출 |
| 14 | Maintainability | 테스트 이름 스타일 불일치 — 기존 `should ...` vs 신규 현재 시제 동사(`rotates`, `rejects` 등) | `auth.service.spec.ts` lines 68, 95, 114, 131 | 블록 단위 일관성 통일. RESOLUTION에서 경미로 처리된 사항으로 현행 유지도 허용 |
| 15 | Maintainability | spec `§1.4` 원자성 노트에 구현 내부 세부사항(`optional EntityManager`) 참조 잔존 가능성 — 이전 커밋(98aee7fb) 반영 여부 재확인 권장 | `spec/data-flow/2-auth.md` §1.4 원자성 blockquote | 동작 계약 수준("revoke와 INSERT는 단일 트랜잭션 안에서 원자적으로 수행")만 서술 |
| 16 | Documentation | `refresh()` public 메서드 레벨 JSDoc 부재 — 세 분기(reuse/만료/정상회전)가 공존하는 복잡 메서드 | `auth.service.ts` `refresh()` 상단 | 세 분기 요약 + 원자성 보장 사실 기술하는 JSDoc 블록 추가 권장 |
| 17 | Testing | `lastUsedIp: null` 단언이 원자성 테스트에 혼재 — 원자성과 무관한 IP 필드 값 단언이 포함돼 미래 변경 시 오탐 가능 | `auth.service.spec.ts` lines 84–91 원자성 테스트 | `lastUsedIp: null` 을 `expect.anything()`으로 완화하거나 별도 `it` 블록으로 분리 |
| 18 | Database | 조건부 UPDATE 인덱스 활용 — PK 단건 조건부 UPDATE이므로 추가 인덱스 불필요 | `auth.service.ts` 조건부 UPDATE | 현행 유지 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | TOCTOU는 조건부 UPDATE로 해소됨. 에러 메시지 클라이언트 노출은 기존 인프라 책임 |
| performance | LOW | `resolveTokenWorkspaceContext` 트랜잭션 내 실행으로 hold time 연장 (WARNING, 후속 plan) |
| architecture | LOW | 신규 Critical/Warning 없음. optional EntityManager 패턴은 NestJS+TypeORM 관용구로 수용 |
| requirement | LOW | 05 C-1 요구사항 완전 충족. 시퀀스 다이어그램 낡음(SPEC-DRIFT) |
| scope | NONE | 범위 이탈 없음. 변경된 모든 파일이 C-1과 직접 연관 |
| side_effect | LOW | 부작용 매우 안전. optional EntityManager 기존 호출처 무영향 확인 |
| maintainability | LOW | 영/한 주석 혼용(WARNING), 클로저 의존 주석 부재(WARNING) |
| testing | LOW | 핵심 4건 커버리지 추가됨. 롤백 테스트 revoke 단언 부재(WARNING) |
| documentation | LOW | 1차 리뷰 지적 반영 완료. `refresh()` JSDoc 부재(INFO) |
| database | LOW | 트랜잭션 원자화 올바름. hold time 연장은 기인식 후속 항목(INFO) |
| concurrency | LOW | 원자화 + affected=0 차단 올바름. 잔존 관찰은 멱등적 기존 코드 |

---

## 발견 없는 에이전트

- **scope**: 범위 이탈 발견 없음 (위험도 NONE)

---

## 권장 조치사항

1. **[WARNING-2 / 즉시 권장]** 롤백 테스트에 `expect(refreshTokenRepo.update).toHaveBeenCalledWith(expect.objectContaining({ id: 'rt-1', isRevoked: false }), ...)` 단언 추가 — "revoke 시도 후 INSERT 실패" 흐름을 완전히 서술
2. **[WARNING-3 / 즉시 권장]** `generateTokens` 내 영어 인라인 주석(`// Create refresh token`, `// 15 minutes`)을 한국어로 통일
3. **[WARNING-4 / 즉시 권장]** `auth.service.spec.ts` DataSource mock 구성 위에 클로저 의존성 주석 한 줄 추가
4. **[INFO-1 / SPEC-DRIFT / spec 갱신]** `spec/data-flow/2-auth.md` 라인 170 시퀀스 다이어그램의 UPDATE 조건을 `WHERE id = row.id AND is_revoked = false AND expires_at > now`로 갱신 (코드가 옳고 spec이 낡음)
5. **[WARNING-1 / 후속 plan]** `resolveTokenWorkspaceContext` + JWT sign 계산을 트랜잭션 콜백 밖으로 이동해 hold time 최소화 (이미 RESOLUTION.md 후속 항목으로 등록됨)
6. **[INFO-10 / 선택]** `if (!result.affected)` → `result.affected === 0` 또는 falsy 전체 거부 의도 주석 명시
7. **[INFO-16 / 선택]** `refresh()` 메서드 상단 JSDoc 추가 (세 분기 요약 + 원자성 보장)

---

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행** (11명): security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency
- **강제 포함 (router_safety)** (7명): documentation, maintainability, requirement, scope, security, side_effect, testing
- **제외** (3명, router 결정):

  | 제외된 reviewer | 이유 |
  |-----------------|------|
  | dependency | 의존성 변경 없음(새 외부 패키지 미추가, `EntityManager`·`MoreThan`은 기존 TypeORM 심벌) |
  | api_contract | API 시그니처·HTTP 계약 변경 없음(내부 서비스 로직만 변경) |
  | user_guide_sync | 사용자 가이드 영향 없는 내부 안전성 개선 |