# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] SQL 마이그레이션 — 전역 DB 상태 변경 (의도된 부작용)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/migrations/V101__add_user_email_lower_index.sql`
- 상세: `CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email))` 는 전체 PostgreSQL 인스턴스의 `user` 테이블에 영구 인덱스를 추가한다. 이 자체는 의도된 스키마 변경이지만, 부작용 관점에서 고려할 점은: (1) non-CONCURRENTLY 실행이므로 마이그레이션 실행 시 `user` 테이블 전체에 `ShareLock`이 걸려 동시 INSERT/UPDATE가 차단됨. (2) `IF NOT EXISTS` 덕분에 재실행(idempotent) 부작용 없음. (3) 기존 case-sensitive UNIQUE 제약(`email`)은 그대로 유지되며 새 인덱스는 조회 경로만 영향 — 의미 충돌 없음. 새로운 global constraint를 도입하지 않으므로 기존 쿼리 플랜이 변경될 수 있으나(인덱스 추가로 seq scan → index scan 전환 가능) 이는 의도된 최적화다.
- 제안: 운영 대용량 환경 배포 시 `CREATE INDEX CONCURRENTLY`로 교체 고려(마이그레이션 트랜잭션 분리 필요). 현 규모에서는 비차단.

### [INFO] e2e 테스트 — `seedPendingEmailChange` 헬퍼의 DB 직접 조작
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/test/users-email-change.e2e-spec.ts` L149–163
- 상세: `seedPendingEmailChange` 헬퍼가 `UPDATE "user" SET pending_email, email_change_token, email_change_expires_at WHERE id = $1` 를 직접 실행한다. 테스트 코드의 DB 직접 조작은 테스트 환경에서 의도된 패턴이며, 모든 파라미터가 `$1/$2/$3` 플레이스홀더로 처리되어 SQL 인젝션 없음. `expiresSql` 파라미터는 문자열 인터폴레이션(`${expiresSql}`)으로 SQL에 삽입되는데, 이 인자는 코드 내부에서만 상수로 제공(`"NOW() + INTERVAL '1 hour'"`, `"NOW() - INTERVAL '1 minute'"`)되므로 외부 입력이 아니다 — 런타임 인젝션 위험 없음. 테스트 환경 격리가 전제되므로 부작용은 수용 가능.
- 제안: 현재 구조 적절. 테스트 이외 코드로 이 헬퍼가 노출되지 않도록 주의.

### [INFO] 프론트엔드 테스트 — 모듈 레벨 `vi.mock` 전역 상태 등록
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx` L334–368
- 상세: `let mockToken: string | null = "tok-123"` 이 모듈 스코프 변수로 선언되고 여러 테스트가 이를 공유한다. `beforeEach`에서 `mockToken = "tok-123"` 리셋을 수행하고 있어 테스트 간 상태 누출이 방지된다. `vi.mock("next/navigation", ...)` 내부의 `useSearchParams` 클로저가 `mockToken`을 캡처하므로, 테스트가 순서에 의존하지 않는다. `vi.clearAllMocks()`도 `beforeEach`에 포함되어 mock 호출 내역이 초기화됨. 전체적으로 격리가 올바르게 구현되어 있다.
- 제안: 별도 조치 불필요.

### [INFO] `renderCard` 함수 시그니처 변경 — 테스트 내부 헬퍼, 기존 호출자 영향 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/frontend/src/app/(main)/profile/components/__tests__/profile-info-card.test.tsx` L692–698
- 상세: `renderCard(user: { name: string; email: string })` 에서 `renderCard(user: { name: string; email: string; pendingEmail?: string | null })` 로 시그니처가 변경됐다. `pendingEmail`이 선택적(`?`) 파라미터이므로 기존 호출 코드 `renderCard({ name: "...", email: "..." })` 는 그대로 동작한다 — 기존 호출자에 대한 파괴적 변경 없음. 이 함수는 테스트 파일 내부 유틸이므로 외부 공개 API가 아니다.
- 제안: 별도 조치 불필요.

### [INFO] 단위 테스트 추가 — 프로덕션 코드 상태 변경 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/email-change-followup/codebase/backend/src/modules/auth/auth.service.spec.ts` L92–113
- 상세: `resendEmailChange` 의 메일 실패 시 롤백 비대칭 동작을 검증하는 단위 테스트가 추가됐다. `usersService`, `mailService` 등은 모두 `vi.fn()` / Jest mock으로 처리되어 실제 서비스 상태를 변경하지 않는다. `usersService.update.mock.calls` 접근도 mock 인스턴스에 대한 것이므로 전역/공유 상태 변경 없음.
- 제안: 별도 조치 불필요.

---

## 요약

이번 변경 세트는 SQL 마이그레이션 1건(V101 인덱스), 백엔드 단위 테스트 1건, e2e 테스트 확장, 프론트엔드 단위 테스트 신규 파일, plan/review 문서 파일들로 구성된다. 부작용 관점에서 실질적 위험 요소는 없다. V101 마이그레이션은 전역 DB 스키마에 인덱스를 추가하는 의도된 DDL이며 기존 UNIQUE 제약·쿼리 시맨틱을 변경하지 않는다. 테스트 코드의 모듈 레벨 mock 변수(`mockToken`)는 `beforeEach`에서 일관되게 리셋되어 테스트 간 상태 누출이 없고, `renderCard` 시그니처 변경은 optional 필드 추가로 하위 호환된다. e2e 시드 헬퍼(`seedPendingEmailChange`)의 `expiresSql` 문자열 인터폴레이션은 코드 내 상수만 사용하므로 인젝션 위험이 없다. 프로덕션 코드(서비스·컨트롤러·인터페이스)의 시그니처 변경은 이번 diff에 포함되지 않았다. 전체적으로 의도하지 않은 부작용은 발견되지 않는다.

## 위험도

NONE
