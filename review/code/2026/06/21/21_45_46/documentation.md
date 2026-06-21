# Documentation Review

## 발견사항

### [INFO] e2e 테스트 파일 상단 JSDoc — resend/race 케이스 미반영
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/test/users-email-change.e2e-spec.ts` 파일 상단 주석 블록
- 상세: 파일 최상단 JSDoc(`검증 대상` 목록)이 이번 변경에서 추가된 `resend → 토큰·만료 시각 갱신`, `resend without pending → 400 VALIDATION_ERROR`, `verify 시점 신규 이메일 선점 → 409 + pending 정리` 세 케이스를 열거하지 않고 있다. diff 에서 `resend` 와 `verify race` 두 항목은 추가됐으나, 구체적 시나리오 설명은 주석 수준에 머무르지 않는다. 독자가 파일이 다루는 계약 범위를 빠르게 파악하는 데 불편이 생긴다.
- 제안:
  ```ts
  *   - resend: 토큰·만료 시각 갱신 / pending 없으면 400 VALIDATION_ERROR
  *   - verify race: 신규 이메일 선점 시 409 + pending 정리
  ```
  항목을 `cancel` 행 앞뒤 적절한 위치에 추가한다. (이 항목은 RESOLUTION W1 fix 범위에 포함되어 diff 에서 이미 부분 반영됐으나, 상단 JSDoc 전체 목록과 완전히 일치하는지 재확인 권장.)

### [INFO] 신규 프론트엔드 테스트 파일 — 모듈 수준 JSDoc 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx` 파일 최상단
- 상세: 신규 생성된 `verify-email-change.test.tsx` 파일이 모듈 수준 설명 없이 바로 `vi.mock(...)` 으로 시작한다. 동일 프로젝트의 e2e 파일 및 `profile-info-card.test.tsx` 등이 파일 최상단 JSDoc 으로 검증 대상·관련 spec 섹션을 명시하는 관례를 갖고 있어 일관성이 깨진다. 기능 영향은 없다.
- 제안:
  ```ts
  /**
   * VerifyEmailChangePage 단위 테스트.
   * URL 토큰 수신 → verify API 호출 → access token 교체 → /profile 리다이렉트 흐름을 검증한다.
   * spec/5-system/1-auth.md §1.1.B / spec/2-navigation/9-user-profile.md §6.1
   */
  ```
  를 파일 최상단(import 구문 이전)에 추가한다.

### [INFO] seedPendingEmailChange 헬퍼 함수 — JSDoc 양호, 인라인 주석 적절
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/test/users-email-change.e2e-spec.ts` `seedPendingEmailChange` 함수 (diff 내 추가 블록)
- 상세: 새로 추출된 `seedPendingEmailChange` 헬퍼에 JSDoc 이 작성되어 있고("pending 이메일 변경 상태를 DB 에 직접 시드한다 ..."), 파라미터 의미(`expiresSql` 기본값 등)가 명확하다. 공개 유틸 함수 문서화 수준으로 적절하다.
- 제안: 현재 상태로 충분. 추가 조치 불필요.

### [INFO] V101 마이그레이션 SQL — 주석 문서화 수준 우수
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/migrations/V101__add_user_email_lower_index.sql`
- 상세: 목적(LOWER() 표현식 인덱스), 근거(seq scan 방지), non-unique 선택 이유, IF NOT EXISTS 재실행 안전성, DOWN 스크립트가 모두 주석으로 포함돼 있다. 마이그레이션 파일의 자기설명성(self-documenting) 기준으로 모범적이다. plan 파일(`plan/complete/email-change-followup-email-lower-index.md`)과 spec 참조(`spec/5-system/1-auth.md §1.1.B`)도 정확히 기재됐다.
- 제안: 없음.

### [INFO] plan/complete/email-change-followup-email-lower-index.md — 체크박스 형식 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/plan/complete/email-change-followup-email-lower-index.md` §할 일 섹션
- 상세: `status: complete` 인 plan 파일의 "할 일" 항목이 `- [x]` 체크박스가 아닌 일반 불릿으로 작성됐다. `impl-email-change.md` 등 동일 규약 파일들은 완료 항목을 `- [x]` 로 표시해 시각적으로 완료 상태를 명확히 한다. plan lifecycle 규약과의 불일치. (이 항목은 RESOLUTION INFO 12 fix 범위에 포함돼 있으므로 이미 처리됐을 가능성이 있음 — 실제 파일 최종 상태 확인 권장.)
- 제안: 마이그레이션 V101 추가 완료 항목을 `- [x]`로 변환하고, EXPLAIN ANALYZE deferred 항목은 `- [ ]` 로 유지하며 "deferred" 주석을 명시한다.

### [INFO] auth.service.spec.ts 신규 테스트 — 인라인 주석 정확하고 명확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/src/modules/auth/auth.service.spec.ts` W2 신규 테스트 블록
- 상세: `// request 와 달리 롤백 update 가 없다 — 토큰 재발급 1회만, pending 은 유지(NULL화 안 함).` 주석이 비대칭 동작의 의도를 명확하게 설명한다. spec 섹션 참조(`spec §1.1.B`)도 `it` 제목에 포함되어 있어 독자가 요구사항과 테스트를 연결하기 쉽다.
- 제안: 없음.

### [INFO] profile-info-card.test.tsx renderCard 시그니처 — pendingEmail 의미 주석 없음 (저위험)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/frontend/src/app/(main)/profile/components/__tests__/profile-info-card.test.tsx` renderCard 함수 확장 부분
- 상세: `pendingEmail?: string | null` 파라미터가 추가됐으나 짧은 주석이 없다. 내부 헬퍼 함수이고 타입 자체로 의미가 어느 정도 전달되지만, "확인 대기 중 신규 이메일" 의미를 한 줄 주석으로 명시하면 향후 케이스 추가 시 혼동을 줄인다. 기능 영향 없음.
- 제안: 선택적 개선. 필수 아님.

---

## 요약

이번 변경 세트(V101 인덱스 마이그레이션, e2e 테스트 3케이스 추가, 프론트엔드 단위 테스트 신규 파일, 백엔드 단위 테스트 추가, plan 파일 정리)의 문서화 수준은 전반적으로 양호하다. SQL 마이그레이션 파일의 주석은 목적·근거·DOWN 스크립트를 모두 포함해 모범적이며, 새로 추출된 `seedPendingEmailChange` 헬퍼에는 적절한 JSDoc 이 작성됐고, auth.service.spec.ts 의 신규 테스트는 비대칭 동작을 설명하는 인라인 주석이 명확하다. 발견된 항목은 모두 INFO 수준으로 기능·보안·API 계약과 무관하다: (1) e2e 파일 상단 JSDoc 목록이 신규 케이스와 완전히 동기화됐는지 재확인 필요, (2) 신규 프론트엔드 테스트 파일의 모듈 수준 JSDoc 누락이 프로젝트 관례와 불일치, (3) plan 체크박스 형식이 lifecycle 규약과 불일치(RESOLUTION INFO 12 에서 이미 처리됐을 수 있음). 이 세 항목은 차단 수준에 해당하지 않으며 선택 또는 저비용 후속 조치로 처리 가능하다.

## 위험도

NONE
