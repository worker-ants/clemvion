# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] V101 마이그레이션 — 인덱스 빌드 중 테이블 락 없음(IF NOT EXISTS 보호)
- 위치: `codebase/backend/migrations/V101__add_user_email_lower_index.sql` L46
- 상세: `CREATE INDEX IF NOT EXISTS` 는 PostgreSQL 에서 기본적으로 `ShareLock` 을 획득한다. 대용량 테이블에서 롤아웃 시 쓰기 차단이 발생할 수 있다. `CREATE INDEX CONCURRENTLY` 가 아닌 점을 의도적으로 선택한 경우라면 문서화 충분(마이그레이션 파일 주석에 근거 명시됨). Flyway 트랜잭션 내에서는 `CONCURRENTLY` 를 사용할 수 없으므로, 현재 방식은 Flyway 정합상 올바르다. 테이블 규모가 작은 서비스 초기 단계라면 위험 없음.
- 제안: 향후 대규모 배포 시 Flyway 외부에서 `CREATE INDEX CONCURRENTLY` 로 별도 실행하는 절차를 고려할 수 있으나, 현 단계에서는 문제 없음.

### [INFO] e2e 테스트 — DB 직접 UPDATE 시드 패턴의 격리 보장
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` L147-154, L287-294, L347-349
- 상세: 여러 테스트가 `db.query(UPDATE "user" ...)` 로 직접 DB 상태를 시드한다. 각 테스트는 `uniqueEmail(...)` 로 독립 사용자를 생성하므로 테스트 간 상태 오염은 없다. 단, afterAll 에서 생성된 사용자를 정리하는 cleanup 이 없어 테스트 실행마다 DB 에 잔류 데이터가 누적된다.
- 제안: 현 패턴은 기존 테스트 파일과 일관성 있으므로 새 부작용을 도입하지는 않는다. 장기적으로 afterAll 에 `DELETE FROM "user" WHERE email LIKE '%emchg%'` 형태의 정리 로직을 고려할 수 있으나, 현재는 INFO 수준.

### [INFO] e2e 테스트 — `verify 시점 선점` 케이스의 userB 잔류
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` L156-157
- 상세: `registerAndLogin(BASE_URL, newEmail, db)` 로 생성된 userB 는 테스트 목적상 의도적으로 DB 에 남는다. `uniqueEmail('emchg-race-new')` 패턴으로 격리되어 있으므로 다른 테스트에 영향 없음.
- 제안: 해결 필요 없음.

### [INFO] frontend 테스트 — `mockToken` 모듈 레벨 변수 공유
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx` L495
- 상세: `let mockToken: string | null = "tok-123"` 가 모듈 레벨에 선언되어 있고 `beforeEach` 에서 `"tok-123"` 으로 리셋된다. 세 번째 테스트("토큰 없는 링크")는 `mockToken = null` 로 변경하는데, `beforeEach` 가 이를 올바르게 리셋하므로 테스트 순서 의존성 문제는 없다. 의도된 패턴이며 Vitest 단일 파일 내에서 안전하게 격리된다.
- 제안: 문제 없음.

### [INFO] `renderCard` 시그니처 확장 — 기존 호출자 하위 호환
- 위치: `codebase/frontend/src/app/(main)/profile/components/__tests__/profile-info-card.test.tsx` L692-697
- 상세: `renderCard` 의 `user` 파라미터에 `pendingEmail?: string | null` 이 추가되었다. 선택적(optional) 필드이므로 기존 `renderCard({ name: ..., email: ... })` 호출은 전부 타입 오류 없이 그대로 동작한다. 테스트 내부 헬퍼 함수이므로 외부 API 영향은 없다.
- 제안: 문제 없음.

## 요약

이번 변경은 DB 마이그레이션(표현식 인덱스 추가), e2e 테스트 3개 케이스 추가, 프론트엔드 유닛 테스트 파일 신규 생성, 기존 테스트 헬퍼 시그니처 확장, plan 문서 2개 추가로 구성된다. 마이그레이션은 `IF NOT EXISTS` 로 재실행 안전하며 non-unique 인덱스라 기존 UNIQUE 제약에 영향이 없다. 모든 테스트는 `uniqueEmail()` 패턴으로 테스트 간 상태 격리가 보장되어 있고, `mockToken` 모듈 변수는 `beforeEach` 에서 올바르게 리셋된다. 공개 API 변경이나 전역 상태 변경, 의도치 않은 네트워크 호출, 파일시스템 부작용은 발견되지 않았다. plan 문서는 추적 목적의 Markdown 파일이며 런타임 부작용이 없다.

## 위험도

NONE
