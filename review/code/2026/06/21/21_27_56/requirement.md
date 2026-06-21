# 요구사항(Requirement) Review — email-change-followup

## 발견사항

### [INFO] 파일 1: V101__add_user_email_lower_index.sql — 기능 완전성 양호
- 위치: 전체 파일
- 상세: `CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email))` 는 `UsersService.emailTakenByOther` 가 수행하는 `WHERE LOWER(u.email) = LOWER(:email)` 조회를 가속하는 올바른 함수 기반 인덱스다. non-unique 로 두는 이유(기존 case-sensitive UNIQUE 와의 의미 충돌 방지)가 주석에 정확히 설명되어 있다. `IF NOT EXISTS` 로 재실행 안전성이 확보됐고 DOWN 주석도 포함됐다.
- 제안: 이상 없음.

---

### [WARNING] 파일 2: users-email-change.e2e-spec.ts — resend 테스트에서 `email_change_expires_at` 갱신 미검증
- 위치: 테스트 `'resend → 200; 토큰·만료 시각 갱신'` (추가된 코드 블록 line 93-127, 전체 파일 line 211-426)
- 상세: 테스트 제목에 "토큰·만료 시각 갱신"이라고 명시하고, `before`/`after` 쿼리 모두 `email_change_expires_at` 를 SELECT 하고 있다. 그러나 실제 `after` 검증은 `email_change_token` 이 변경됐는지만 단언하고 `email_change_expires_at` 가 실제로 갱신됐는지는 검증하지 않는다. spec/5-system/1-auth.md §1.1.B "resend → 토큰 재발급(1h)" 과 `auth.service.ts resendEmailChange` 구현이 `emailChangeExpiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MS)` 를 갱신하므로 구현 자체는 올바르다. 하지만 테스트가 `expires_at` 갱신을 검증하지 않으면 향후 구현에서 `expires_at` 갱신이 누락돼도 테스트가 통과하는 갭이 생긴다.
- 제안: `after` 단언 블록에 `expect(new Date(after.rows[0].email_change_expires_at).getTime()).toBeGreaterThan(new Date(before.rows[0].email_change_expires_at).getTime())` 를 추가해 만료 시각이 실제로 뒤로 밀렸는지 확인한다.

---

### [INFO] 파일 2: users-email-change.e2e-spec.ts — resend without pending → VALIDATION_ERROR 검증 완전
- 위치: 테스트 `'resend without pending → 400 VALIDATION_ERROR'` (추가 코드 line 129-137)
- 상세: spec/2-navigation/9-user-profile.md §6.1 "pending 없으면 400 VALIDATION_ERROR" 와 구현(`auth.service.ts resendEmailChange` 의 `!user.pendingEmail` 분기) 모두 일치. 이상 없음.

---

### [INFO] 파일 2: users-email-change.e2e-spec.ts — race condition(선점) 테스트 완전
- 위치: 테스트 `'verify 시점 신규 이메일 선점 → 409 + pending 정리'` (추가 코드 line 139-175)
- 상세: spec/5-system/1-auth.md §1.1.B 운영 시나리오 표 "신규 이메일이 타 계정 사용 중(verify 시): 트랜잭션 내 UNIQUE 재검사 → 선점 시 409 + pending NULL화" 와 구현(`auth.service.ts verifyEmailChange` 의 `emailTakenByOther` + `clearPendingEmailChange` + 409 ConflictException) 및 테스트가 모두 일치. `email`, `pending_email`, `email_change_token` 세 필드 상태 검증도 포함됨.

---

### [INFO] 파일 3: verify-email-change.test.tsx — 토큰 부재 오류 메시지 부분 일치
- 위치: 테스트 `'토큰 없는 링크 → 에러 표시, verify 미호출'` line 575
- 상세: `toHaveTextContent("유효하지 않은 링크")` 는 partial match 이므로 실제 i18n 값 `"유효하지 않은 링크예요."` 에 일치한다 (testing-library 기본 동작). 테스트가 실패하지 않으므로 기능 검증은 통과한다. 다만 완전한 문자열로 단언하면 i18n 키 오타 등을 더 일찍 잡을 수 있다.
- 제안: `toHaveTextContent("유효하지 않은 링크예요")` 로 구체화하면 단언 정밀도가 높아진다 (선택 개선, 비차단).

---

### [INFO] 파일 3: verify-email-change.test.tsx — 성공 경로 검증 완전
- 위치: 전체 파일
- 상세: spec/2-navigation/9-user-profile.md §6.1 verify 엔드포인트 "전 세션 revoke + 현재 디바이스 재발급({accessToken}+refresh 쿠키 회전)"의 프론트엔드 측 동작(accessToken 교체 + /profile 리다이렉트) 검증, 실패 경로(에러 표시·리다이렉트 없음), 토큰 부재 경로 세 케이스를 모두 커버한다. `ran.current` ref 를 통한 strict mode 중복 실행 방지 로직도 테스트 구조상 `vi.clearAllMocks()` 로 간접 검증됨.

---

### [INFO] 파일 4: profile-info-card.test.tsx — pendingEmail 표시 및 CTA 링크 검증
- 위치: 추가된 세 테스트 케이스 (line 707-728)
- 상세: spec/2-navigation/9-user-profile.md §2 와이어프레임 "Email: … [변경하기 →] / pending 있으면 확인 대기 중: new@… 표시" 와 구현(`profile-info-card.tsx` 의 `profile-change-email-link`, `profile-email-pending` testid) 이 일치. `renderCard` 의 타입을 `pendingEmail?: string | null` 로 확장한 것도 `ProfileInfoCardProps` 인터페이스(`user: { name: string; email: string; pendingEmail?: string | null }`)와 일치.

---

### [INFO] 파일 5-6-7: 플랜 문서 — 완료 상태 정확
- 위치: `plan/complete/email-change-followup-email-lower-index.md`, `plan/complete/impl-email-change.md`, `plan/complete/spec-draft-email-change.md`
- 상세: 세 플랜 모두 `status: complete` 이며 `worktree`, `spec_impact` frontmatter 가 올바르게 기입됨. `impl-email-change.md` 체크리스트 §5/6/7 항목에 `[ ]` (미체크)가 하나 남아 있으나 바로 아래 `[x] 5/6/7. 구현 + 테스트` 로 완료 확인됨 — 불일치가 아니라 단계별 분기 표기다. 이상 없음.

---

### [INFO] 파일 8: spec/data-flow/2-auth.md §1.7.1 + §2.1 — spec 정확성 양호
- 위치: 추가된 §1.7.1 블록 및 §2.1 표 행
- 상세: 흐름 기술이 `auth.service.ts` 구현(request 발송 실패 시 rollback, resend 실패 시 토큰 유지, verify 선점 재검사, 전 family revoke + 재발급, 옛 이메일 통지 best-effort)과 line-level 로 일치한다. `V101 — emailTakenByOther 대소문자 무시 조회` 인덱스 명시도 파일 1 마이그레이션과 일치.

---

### [WARNING] 전체 — `resend` 메일 발송 실패 시 갱신 토큰 유지 동작의 e2e 테스트 부재
- 위치: 파일 2 전체
- 상세: spec/5-system/1-auth.md §1.1.B "메일 발송 실패 처리(request vs resend 비대칭)": `resend` 발송 실패 시 **갱신된 토큰을 유지**하고 사용자가 재호출로 복구한다. `request` 의 발송 실패(롤백) 와 다른 핵심 비대칭 동작이다. 이 동작에 대한 e2e 또는 unit 테스트가 추가된 파일들에 없다. MailService stub 을 사용하는 unit 테스트(`users.service.spec.ts` 등)에서 커버하고 있을 가능성은 있으나, 현재 변경된 e2e 파일에서는 검증되지 않는다.
- 제안: 비용이 크면 unit 테스트로 `mailService.sendEmailChangeVerification` 실패 시 `usersService.update` 호출이 롤백되지 않고 토큰이 유지되는지 mock 검증을 추가한다. e2e 에서 SMTP를 조작하기 어렵다면 service-level mock 으로 대체 가능.

---

## 요약

네 개의 코드 변경 파일(SQL 마이그레이션·e2e 테스트·프론트엔드 유닛 테스트 두 개)과 네 개의 문서 파일을 분석했다. 기능 완전성 측면에서 이메일 변경 흐름의 핵심 시나리오(request/verify/resend/cancel + race condition 선점 + 토큰 없는 링크 + 인증 실패)가 전반적으로 잘 커버되어 있으며, spec/5-system/1-auth.md §1.1.B, spec/2-navigation/9-user-profile.md §6.1 의 요구사항과 구현이 line-level 로 일치한다. 주요 갭은 두 가지다: (1) `resend` e2e 테스트가 `email_change_expires_at` 갱신을 단언하지 않아 테스트 제목과 실제 검증 범위가 불일치하고 (2) resend 메일 발송 실패 시 갱신 토큰 유지라는 spec 명시 비대칭 동작에 대한 테스트가 없다. 두 항목 모두 기능을 차단할 회귀는 아니나 회귀 방지 안전망이 불완전하다.

## 위험도

LOW
