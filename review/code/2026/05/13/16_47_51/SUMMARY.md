# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `void → await` 전환 자체는 정확하고 안전하나, 핵심 불변 조건(응답 전 INSERT 완료·DB 실패 시 인증 보호)을 검증하는 단위 테스트가 부재하여 회귀 방지 체계가 미흡함.

---

## Critical 발견사항

없음

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `await` 전환에 대한 회귀 방지 단위 테스트 부재 — `void`든 `await`든 mock이 동일하게 통과하므로 미래에 실수로 되돌려도 감지 불가 | `auth.service.ts` 13곳, `sessions.service.ts` 2곳 | 지연 Promise(`setTimeout(res, 50)`)를 주입해 응답 시점에 `record`가 완료됐는지 검증하는 테스트 추가 |
| 2 | Testing | `record()` 예외 격리 보장에 대한 명시적 테스트 없음 — `void` 시절과 달리 이제 `record()` 내부 try/catch가 올바르게 동작해야 응답이 나옴 | `login-history.service.ts:75` | `repository.save`가 throw할 때 `login()`이 정상 응답을 반환하는 시나리오 테스트 추가 |
| 3 | Testing | race condition 수정이 e2e 테스트 단 하나에만 의존 — 해당 테스트가 flaky해지거나 skip되면 race가 조용히 재발 | `backend/test/session-revocation.e2e-spec.ts` | 해당 케이스에 `// regression: void → await race (fix-login-history-race)` 형태의 주석으로 의도 고정 |
| 4 | Security | DB 불가 시 보안 크리티컬 이벤트(`token_reuse_detected`, `login_failed`) 무음 소실 — `record()` 내부 예외 swallow로 ERROR 로그 한 줄만 남고 영구 유실 | `login-history.service.ts:75–86` | 단기: 현 tradeoff 유지 가능. 중기: `token_reuse_detected` 등 고위험 이벤트에 인메모리 큐 + 재시도 또는 메트릭 카운터 보완 |
| 5 | Documentation | Plan 문서 라이프사이클 불일치 — 모든 체크박스가 `[x]`이나 파일이 `in-progress/`에 잔류 (scope, requirement, documentation 3개 에이전트 동일 지적) | `plan/in-progress/fix-login-history-race.md` | `git mv plan/in-progress/fix-login-history-race.md plan/complete/fix-login-history-race.md` 즉시 실행 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `await` 규약이 JSDoc에만 존재, 타입 시스템 미강제 — 미래 개발자가 `void` 재도입해도 빌드 통과 | 전체 call site | `backend/.eslintrc`에 `@typescript-eslint/no-floating-promises` 활성화 |
| 2 | Maintainability | `AuthContext → LoginEventInput` 매핑(`ip ?? null`, `userAgent ?? null`) 15개 호출부에 산재 — `AuthContext` 필드 변경 시 수정 지점 15곳 | `auth.service.ts` 전체, `sessions.service.ts` | `historyInput(ctx, partial)` private 헬퍼 또는 `recordFromCtx()` 오버로드로 매핑 집중화 |
| 3 | Documentation | `toDto()` 주석이 구현과 불일치 — "Backwards-compatible alias for callers that still expect to receive raw rows"는 `private` 변환기 실제 동작과 맞지 않음 | `login-history.service.ts:toDto()` | 주석 삭제 또는 `// Maps a LoginHistory row to the public DTO shape.`로 단순화 |
| 4 | Security | `ACCOUNT_LOCKED` 메시지가 계정 존재 여부 노출 — 다른 실패 경로는 모두 `'Invalid email or password'`로 통일되어 있으나 이 경로만 예외 | `auth.service.ts:249–255` | `'Invalid email or password'`로 통일하거나, 의도된 UX라면 spec에 명시 |
| 5 | Security | `pruneOlderThanRetention` 인라인 SQL 보간 패턴 — 현재는 서버 내부 값만 바인딩되어 안전하나, 향후 user-controlled 값 유입 시 인젝션 벡터 가능성 | `login-history.service.ts:142–149` | TypeORM `.subQuery()` 체인 방식으로 리팩토링 |
| 6 | Concurrency / Database | `record()` 호출이 메인 트랜잭션 외부 — 트랜잭션 커밋 후 DB 장애 시 audit row 유실 가능 (best-effort 설계의 의도된 tradeoff) | `auth.service.ts:registerWithInvitation`, `verifyEmail` | `record()` JSDoc에 "best-effort, not transactional" 명시 |
| 7 | Testing | `forgotPassword` 의도적 생략에 대한 테스트 없음 — 추후 "누락된 record 호출"처럼 보여 실수로 추가될 수 있음 | `auth.service.ts:forgotPassword` | `expect(loginHistory.record).not.toHaveBeenCalled()` 단언 추가 |
| 8 | Database | cursor 기반 페이지네이션 복합 인덱스 확인 필요 — `(user_id, created_at DESC, id DESC)` 인덱스 없으면 테이블 성장 시 seq scan | `login-history.service.ts:findForUser()` | 마이그레이션에 해당 복합 인덱스 존재 여부 확인 |
| 9 | Requirement | `forgotPassword`/`resetPassword` 경로에 audit 이벤트 없음 — 보안 감사 사각지대 가능성 (pre-existing, 이번 PR 범위 외) | `auth.service.ts:forgotPassword`, `resetPassword` | 별도 이슈로 추적 |
| 10 | Performance | 성공 경로에서 `generateTokens()`와 `record()` 병렬화 기회 — 두 호출이 서로 독립적 | `auth.service.ts:login()` 등 success path | `Promise.all([generateTokens(...), record(...)])` — 단, bcrypt가 지배적 비용이므로 현재 규모에서 낮은 우선순위 |
| 11 | Concurrency | `pruneOlderThanRetention` 다중 인스턴스 동시 실행 시 삭제 카운트 과소 집계 가능 | `login-history.service.ts:pruneOlderThanRetention()` | `total` 반환값을 모니터링 지표로 직접 신뢰하지 않을 것; 분산 락 또는 단일 스케줄러 고려 |
| 12 | Requirement | TOTP 챌린지 발급 시 history 이벤트 없음 — "챌린지 → 시간 초과 만료" 경로 흔적이 history에 미기록 | `auth.service.ts:login()` TOTP 분기 | 의도된 설계로 허용 가능; 필요 시 `totp_challenge_issued` 이벤트를 spec 레벨에서 논의 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| Testing | MEDIUM | 핵심 불변 조건(await 보장, 예외 격리) 검증 테스트 부재 |
| Security | LOW | DB 불가 시 고위험 이벤트 무음 소실; ACCOUNT_LOCKED 계정 열거 |
| Architecture | LOW | await 규약이 ESLint 미강제; 트랜잭션 경계 불일치 문서화 필요 |
| Concurrency | LOW | 트랜잭션 외부 record() 호출 (의도된 tradeoff); prune 동시성 |
| Database | LOW | 트랜잭션 분리 best-effort 설계; cursor 인덱스 확인 필요 |
| Maintainability | LOW | ctx 매핑 15곳 산재; toDto 주석 불일치 |
| Performance | LOW | 실패 경로 latency 소폭 증가; 병렬화 기회 존재 |
| Documentation | LOW | plan 문서 in-progress 잔류; toDto 주석 불일치 |
| Requirement | LOW | forgotPassword audit 없음; TOTP 챌린지 미기록 |
| Side Effect | LOW | 실패 경로 latency 증가 (plan 문서 미반영) |
| Scope | NONE | 변경이 선언된 범위에 정확히 수렴 |
| API Contract | NONE | 외부 계약에 영향 없음 |
| Dependency | NONE | 신규 외부 의존성 없음 |

---

## 발견 없는 에이전트

**API Contract**, **Dependency** — 두 에이전트 모두 이번 변경이 외부 API 계약 및 의존성 그래프에 영향을 주지 않음을 확인.

---

## 권장 조치사항

1. **[즉시] Plan 문서 이동** — `git mv plan/in-progress/fix-login-history-race.md plan/complete/fix-login-history-race.md` 실행 (CLAUDE.md 규약 위반 해소)

2. **[단기] 테스트 보강 3건**
   - 지연 Promise를 주입해 응답 전 `record()` 완료를 검증하는 단위 테스트
   - `repository.save` throw 시 `login()`이 정상 응답 반환하는 예외 격리 테스트
   - `forgotPassword`에 `expect(loginHistory.record).not.toHaveBeenCalled()` 단언

3. **[단기] ESLint `no-floating-promises` 활성화** — `backend/.eslintrc`에 규칙 추가로 `void loginHistory.record(...)` 재발을 컴파일 타임에 차단

4. **[단기] `toDto()` 주석 정정** — "Backwards-compatible alias..." 문구를 삭제하거나 실제 동작 설명으로 교체

5. **[중기] `AuthContext → LoginEventInput` 매핑 중앙화** — 15곳 반복 패턴을 `historyInput()` 헬퍼로 집약

6. **[중기] cursor 페이지네이션 인덱스 확인** — `(user_id, created_at DESC, id DESC)` 복합 인덱스 마이그레이션 존재 여부 점검

7. **[중기] `ACCOUNT_LOCKED` 메시지 계정 열거 검토** — UX 의도 확인 후 spec 명시 또는 제네릭 메시지로 통일

8. **[중기] `record()` JSDoc에 "best-effort, not transactional" 명시** — 트랜잭션 경계 설계 결정을 코드 레벨에 영속화