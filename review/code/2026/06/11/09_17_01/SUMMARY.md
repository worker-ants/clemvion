# Code Review 통합 보고서

## 전체 위험도
**LOW** — refresh 토큰 회전 원자화(05 C-1) 구현은 보안·정확성·요구사항 충족 면에서 양호하다. Critical 발견사항 없음. Warning 3건(유지보수성 2건, 테스트 Mock 명확화 1건)은 기능·보안·동시성에 영향 없는 코드 품질 개선 사항이다.

---

## Critical 발견사항

_없음_

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 유지보수성 | `generateTokens` 함수 내 영/한 주석 혼용 — 이번 변경에서 추가된 한국어 블록 주석과 기존 영어 인라인 주석이 같은 함수 스코프 안에 혼재해 읽기 흐름이 끊김 | `auth.service.ts` `generateTokens()` 내부 (line 778–782) | 같은 함수 스코프 내 주석 언어를 한국어로 통일 |
| W2 | 유지보수성 | `findOne` mock 설정이 4개 테스트 중 3개에서 동일하게 반복 — 신규 추가 케이스가 기존 중복 패턴을 답습해 `refresh` describe 블록 내 중복 누적 | `auth.service.spec.ts` 신규 케이스 lines 78–85, 106–113, 143–150 | `refresh describe` 내부 `beforeEach`에 공통 `findOne` mock 추출, `isRevoked: true`·만료 케이스만 per-test 오버라이드 |
| W3 | 테스트 | `propagates failure` 테스트에서 `refreshTokenRepo.update` 단언이 롤백 검증처럼 오독될 수 있음 — unit mock은 commit/rollback 없이 콜백을 직접 실행하므로 이 단언은 호출 시퀀스 검증이지 롤백 검증이 아님 | `auth.service.spec.ts` `propagates failure` 테스트 블록 | 해당 단언 옆에 "이 단언은 롤백 검증이 아님 — 호출 시퀀스 확인. 실제 롤백은 e2e 보장." 주석 명시 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 성능·동시성 | `resolveTokenWorkspaceContext`(최대 3회 순차 DB read, read-only)가 `dataSource.transaction` 콜백 내부에서 실행되어 트랜잭션 커넥션 hold time 불필요 연장 — 고트래픽 시 커넥션 풀 경쟁 가중 가능 | `auth.service.ts` `generateTokens()` → `resolveTokenWorkspaceContext()`, `refresh()` 트랜잭션 콜백 | workspace 조회와 JWT sign을 트랜잭션 콜백 진입 전 선계산, 콜백 내부는 revoke UPDATE + RefreshToken INSERT만 수행하도록 분리. 후속 plan 아이템으로 등록 권장 |
| I2 | 테스트 | `stored.user === null` null 가드(정상 회전 분기) 테스트 케이스 누락 — `isRevoked: false` + `expiresAt > now` 상태에서 `user: null`인 토큰이 `TOKEN_INVALID`로 거부됨을 검증하는 케이스 없음 | `auth.service.ts` lines 580–588 신규 `if (!user)` 가드; `auth.service.spec.ts` `describe('refresh')` | `findOne`이 `user: null`을 반환할 때 `TOKEN_INVALID` 거부 + `dataSource.transaction` 미호출을 단언하는 케이스 추가 |
| I3 | 테스트 | `affected: undefined/null` 드라이버별 분기 미검증 — 코드 주석에 "0/undefined/null 이면 거부"로 명시됐으나 테스트는 `{ affected: 0 }`만 검증 | `auth.service.ts` line 613 (`if (!result.affected)`), `auth.service.spec.ts` | `mockResolvedValueOnce({ affected: undefined })` / `{ affected: null }` 케이스 2개 추가 또는 파라미터화 |
| I4 | 보안 | 트랜잭션 실패 시 일반 `Error`가 클라이언트에 원문 노출될 가능성 — DB 에러 메시지(테이블명·컬럼명·제약조건명 등)가 응답 바디에 포함될 수 있음. 이번 변경이 새로 만든 경로가 아니라 기존 예외 전파 패턴과 동일 | `auth.service.ts` `refresh()` `dataSource.transaction` reject 전파 경로 | 글로벌 예외 필터에서 `instanceof HttpException`이 아닌 경우 `Internal Server Error`로 래핑하고 원본 `message`를 응답 바디에 포함하지 않도록 확인. 본 PR 범위 밖이나 인지 필요 |
| I5 | 아키텍처 | `generateTokens` positional 파라미터 5개 — 호출 시 순서 실수 유발 위험, `manager` 추가로 인지 부담 증가. `private` 경계 내이므로 즉각 문제 없음 | `auth.service.ts` `generateTokens` 시그니처 (line 759–767) | 다음 시그니처 변경 시점에 `GenerateTokensOptions` 인터페이스로 묶는 것 권장. 단기 현행 유지 허용 |
| I6 | 문서화 | [SPEC-DRIFT] `spec/data-flow/2-auth.md` §1.4 원자성 노트에서 구현 내부 식별자(`generateTokens`, `EntityManager`, `optional`) 참조 제거 여부가 diff에 포함되지 않아 직접 확인 불가 — RESOLUTION에서 반영 완료로 기재됨 | `spec/data-flow/2-auth.md` §1.4 원자성 blockquote | 병합 전 spec 파일 §1.4 원자성 노트에서 구현 내부 식별자가 실제 제거됐는지 최종 육안 확인 권장 |
| I7 | 문서화 | [SPEC-DRIFT] spec 원자성 노트(line 637)에서 "JWT sign은 트랜잭션 밖에서 선계산"으로 기술됐으나 코드에서 `jwtService.sign()`이 `generateTokens()` 내부(트랜잭션 콜백 안)에서 호출됨. JWT sign은 DB I/O 없는 순수 CPU 연산이라 원자성에 영향 없는 표현 불일치 | `spec/data-flow/2-auth.md` line 637, `auth.service.ts` `generateTokens()` | spec 표현을 구현 현실에 맞게 보정하거나 "JWT sign은 DB 트랜잭션 의미와 무관하므로 콜백 내 실행 허용"으로 단서 추가. 코드 버그 아님 |
| I8 | 유지보수성 | JSDoc `@param` 태그를 backtick으로 감싼 비표준 표기(`` `@param manager` ``) — IDE / TSDoc 파싱에서 파라미터 연결 끊김 가능 | `auth.service.ts` lines 751–757 (`generateTokens` JSDoc) | `` `@param manager` `` → `@param manager` 로 변경해 JSDoc 표준 형식 준수 |
| I9 | 유지보수성 | 매직 넘버 `900` (액세스 토큰 TTL, 초 단위) 인라인 잔존 — `refreshExpDays * 24 * 60 * 60 * 1000` 패턴 등과 일관성 부족 | `auth.service.ts` line 779 (`expiresIn: 900`) | `const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;` 상수 추출 권장. 기존 코드 정리 기회 |
| I10 | 유지보수성 | 매직 넘버 `86400000` (24시간 ms)이 테스트 파일 전체에 6회 이상 반복 사용 | `auth.service.spec.ts` lines 84, 112, 148 등 | 테스트 파일 상단에 `const ONE_DAY_MS = 24 * 60 * 60 * 1000;` 상수 추출 후 일괄 치환 |
| I11 | 테스트 스타일 | 신규 테스트 이름이 현재시제 동사(`rotates`, `rejects`, `does not open`, `propagates`) 패턴 — 기존 테스트의 `should ...` 패턴과 같은 describe 블록에서 혼재 | `auth.service.spec.ts` 신규 `it` 블록 4개 | 신규 케이스를 `should rotate ...` 등 기존 `should ...` 패턴으로 통일하거나 블록 전체를 현재시제로 통일 |
| I12 | 동시성 | 다중 인스턴스 배포 환경에서 앱-DB 시각 차이로 인한 `MoreThan(now)` 만료 경계 케이스 — JS 측에서 `now`를 바인딩하므로 DB 서버 시각과 수십 ms 차이 가능. 단일 인스턴스 또는 NTP 동기화 환경에서는 무시 가능 | `auth.service.ts` `refresh()` 트랜잭션 콜백 내 `expiresAt: MoreThan(now)` | 다중 인스턴스 + 고정밀 만료 요구 시 `() => 'expires_at > NOW()'` (DB 함수)으로 전환하거나 NTP 동기화를 인프라 요구사항으로 명시 |
| I13 | 범위 | 주석 언어 전환 2건(`// 15 minutes` → `// 15분`, `// Create refresh token` → `// refresh token 생성`)이 05 C-1 원자화 목표와 직접 무관한 범위 외 수정 — 해롭지 않고 RESOLUTION에 근거 기재됨 | `auth.service.ts` `generateTokens()` 주석 두 줄 | 수용 가능. 엄격한 scope 기준에서는 별도 커밋이 이상적 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | TOCTOU 차단·인증 우회 없음·기존 예외 전파 패턴 동일. 글로벌 예외 필터 확인 권장(INFO) |
| performance | LOW | `resolveTokenWorkspaceContext` 트랜잭션 내 실행으로 hold time 연장(INFO) |
| architecture | LOW | DIP 트레이드오프 JSDoc 명문화로 수용. 응집도·레이어 경계 기존 구조 유지 |
| requirement | LOW | spec §1.4 line-level 일치. spec 표현 미세 불일치(JWT sign 위치) 코드 버그 아님. SPEC-DRIFT 2건 |
| scope | NONE | 핵심 변경 목표와 정확히 일치. 사소한 범위 외 수정 2건 모두 수용 가능 |
| side_effect | LOW | 기존 호출처 동작 변경 없음. `resolveTokenWorkspaceContext` 트랜잭션 포함이 의도치 않은 hold time 연장(INFO) |
| maintainability | LOW | 영/한 주석 혼용(WARNING), findOne mock 반복(WARNING), 매직 넘버·JSDoc 형식·테스트 스타일(INFO) |
| testing | LOW | 핵심 4개 시나리오 커버리지 완전. `stored.user null` 가드 테스트 누락(INFO), `affected: undefined/null` 미검증(INFO) |
| documentation | LOW | 1차 리뷰 문서화 권고 대부분 반영 완료. spec 파일 구현 식별자 제거 최종 확인 권장(INFO) |
| concurrency | LOW | TOCTOU 차단 패턴 올바름. 트랜잭션 hold time 연장·앱-DB 시각 차이 경계 케이스 주의(INFO) |

---

## 발견 없는 에이전트

- **scope**: NONE 등급 (의미 있는 경고 없음, 범위 외 수정 2건 모두 수용 가능)

---

## 권장 조치사항

1. **[W1] 주석 언어 통일** — `generateTokens()` 내 영어 인라인 주석을 한국어로 통일해 같은 함수 스코프 내 일관성 확보.
2. **[W2] `findOne` mock 공통화** — `describe('refresh')` 내부 `beforeEach`에 기본 `findOne` 반환값 추출, reuse/만료 케이스만 오버라이드.
3. **[W3] 롤백 테스트 주석 보완** — `propagates failure` 테스트의 `update` 단언에 "호출 시퀀스 검증, 롤백 검증 아님" 명시.
4. **[I2] `stored.user null` 가드 테스트 추가** — 정상 회전 분기에서 `user: null` 토큰이 `TOKEN_INVALID`로 거부되고 트랜잭션이 열리지 않음을 단언하는 케이스 추가.
5. **[I6/I7] spec 파일 최종 확인** — 병합 전 `spec/data-flow/2-auth.md §1.4` 원자성 노트에서 구현 내부 식별자 제거 및 JWT sign 위치 표현 보정 여부 육안 확인.
6. **[I1] 트랜잭션 hold time 최소화(후속 plan 항목)** — `resolveTokenWorkspaceContext` + JWT sign을 트랜잭션 콜백 진입 전 선계산하도록 `generateTokens` 분리. 트래픽 증가 시 우선순위 상향.
7. **[I3] `affected: undefined/null` 테스트 보완** — 드라이버별 분기를 단위 테스트에서 명시적으로 검증.
8. **[I8] JSDoc `@param` 형식 수정** — `` `@param manager` `` → `@param manager` 로 표준 형식 준수.
9. **[I9/I10] 매직 넘버 상수 추출** — `ACCESS_TOKEN_TTL_SECONDS = 15 * 60`, `ONE_DAY_MS = 24 * 60 * 60 * 1000` 상수 추출 후 일괄 치환.

---

## 라우터 결정

라우터가 선별하여 일부 reviewer를 실행하고 일부는 제외함.

**실행** (10명): `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency`

**강제 포함(router_safety)** (7명): `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`

**제외** (4명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| dependency | 의존성 패키지 변경 없음 |
| database | 스키마 마이그레이션 없음 |
| api_contract | 외부 API 계약 변경 없음 |
| user_guide_sync | 사용자 가이드 관련 변경 없음 |