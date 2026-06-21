# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: V101__add_user_email_lower_index.sql

- **[INFO]** 마이그레이션 파일 주석 품질 우수
  - 위치: 전체 파일 (17줄)
  - 상세: 인덱스 추가 이유, non-unique 선택 근거, IF NOT EXISTS 재실행 안전성, DOWN 스크립트까지 명시. 이 크기의 마이그레이션에 이상적인 수준의 문서화.
  - 제안: 없음. 현행 유지.

---

### 파일 2: users-email-change.e2e-spec.ts (신규 테스트 3개)

- **[WARNING]** DB seed UPDATE 쿼리가 3개 테스트에 중복 작성됨
  - 위치: 라인 147-154 (`verify 시점 신규 이메일 선점` 테스트), 라인 287-294, 라인 341-348, 라인 362-368 (기존 테스트)
  - 상세: `UPDATE "user" SET pending_email=$2, email_change_token=$3, email_change_expires_at=NOW()+INTERVAL '1 hour' WHERE id=$1` 패턴이 파일 전체에 걸쳐 4회 반복 등장한다. 인자 순서·컬럼명이 동일한 쿼리라 helper 함수 추출 대상이다.
  - 제안: 테스트 helpers 파일(또는 파일 상단)에 `seedPendingEmailChange(db, userId, newEmail, rawToken, hoursFromNow=1)` 유틸을 추출하고, 각 테스트는 이를 호출한다.

- **[INFO]** `before`/`after` DB 조회 변수명이 맥락을 잘 표현함
  - 위치: 라인 103-125 (`resend → 200` 테스트)
  - 상세: resend 전후 토큰을 `before`/`after` 로 구분하고 `pending_email` 유지·`email_change_token` 변경을 순서대로 검증. 읽기 흐름이 명확.

- **[INFO]** `rawToken` 네이밍이 `sha256(rawToken)` 과의 대비를 명확하게 함
  - 위치: 라인 146, 284, 342, 364 등
  - 상세: raw/hashed 구분을 변수명으로 자명하게 전달해 SHA-256 at-rest 패턴 이해 용이.

---

### 파일 3: verify-email-change.test.tsx (신규 파일)

- **[WARNING]** `tFromKo` i18n 헬퍼가 두 테스트 파일(`verify-email-change.test.tsx`, `profile-info-card.test.tsx`)에 동일하게 복제됨
  - 위치: `verify-email-change.test.tsx` 라인 522-530 / `profile-info-card.test.tsx` 라인 739-748
  - 상세: `vi.mock("@/lib/i18n", async () => { ... tFromKo ... })` 블록이 두 파일에서 줄 단위로 동일. 더 많은 테스트가 추가될수록 drift 발생 위험이 있다.
  - 제안: `codebase/frontend/src/test-utils/i18n-mock.ts` 같은 공유 모듈을 만들어 `tFromKo` 함수와 `vi.mock("@/lib/i18n", ...)` 팩토리를 내보내고, 각 테스트에서 임포트해 사용한다.

- **[INFO]** 모듈 레벨 `let mockToken` + `beforeEach` 리셋 패턴이 명시적
  - 위치: 라인 495-538
  - 상세: `mockToken`을 top-level에 선언하고 `beforeEach`에서 기본값으로 복원해 각 테스트 격리를 보장. 의도가 가독 가능.

- **[INFO]** 세 가지 케이스(성공/실패/토큰없음)가 `it` 블록 하나씩으로 분리되어 단일 책임
  - 위치: 라인 541-578
  - 상세: 각 시나리오가 독립 `it` 으로 분리되어 실패 시 진단이 쉽다.

---

### 파일 4: profile-info-card.test.tsx (기존 파일 수정)

- **[INFO]** `renderCard` helper 타입 확장이 기존 시그니처와 일관됨
  - 위치: 라인 693-697
  - 상세: `pendingEmail?: string | null` 을 옵셔널로 추가해 기존 테스트를 깨지 않는 하위 호환 확장. 관례 준수.

- **[INFO]** 신규 3개 테스트의 `data-testid` 네이밍(`profile-change-email-link`, `profile-email-pending`)이 컴포넌트 역할을 잘 반영함
  - 위치: 라인 709, 714, 724

---

### 파일 5~7: plan/complete/*.md

- **[INFO]** plan 파일은 코드 유지보수성 관점의 직접 분석 대상이 아님. frontmatter 스키마(`worktree`, `status`, `owner`, `spec_impact`)가 프로젝트 컨벤션과 일치하고 내용이 구현 상태를 정확히 반영.

---

### 파일 8: spec/data-flow/2-auth.md

- **[INFO]** `§1.7.1` 추가 위치가 기존 `§1.7` 구조와 일관됨
  - 위치: 라인 1487-1506
  - 상세: 기존 번호 체계(1.7 → 1.7.1)를 따르고, 코드 블록 형식도 동일 파일의 `§1.7` 산문 + 번호 목록 패턴과 일치.

- **[INFO]** Schema 매핑 표 행이 기존 행과 동일한 형식으로 추가됨
  - 위치: 라인 1515
  - 상세: `Sink | 흐름 | read/write 컬럼 | 인덱스/제약` 컬럼 순서를 준수.

---

## 요약

이번 변경의 유지보수성은 전반적으로 양호하다. SQL 마이그레이션은 이유·근거·DOWN 스크립트를 모두 포함해 모범적이며, 테스트 네이밍과 케이스 분리도 명확하다. 주요 개선 여지는 두 가지다. 첫째, e2e 테스트 파일 내 DB seed UPDATE 쿼리가 4회 중복되므로 helper 함수로 추출하면 향후 컬럼 변경 시 수정 지점을 단일화할 수 있다. 둘째, `tFromKo` i18n 모킹 블록이 두 프론트엔드 테스트 파일에 그대로 복제되어 있어 공유 test-util 모듈로 통합하면 drift 위험을 제거할 수 있다. 두 항목 모두 기능 정확성과 무관한 테스트 코드 품질 이슈로 차단 수준에는 해당하지 않는다.

## 위험도

LOW
