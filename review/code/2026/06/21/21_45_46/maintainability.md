# 유지보수성(Maintainability) 리뷰

세션: `review/code/2026/06/21/21_45_46`

## 발견사항

### 파일 1: V101__add_user_email_lower_index.sql

- **[INFO]** 주석 품질 우수 — non-unique 선택 이유·IF NOT EXISTS 의미·DOWN 스크립트까지 명확히 서술되어 있어 나중에 마이그레이션을 읽는 사람이 맥락 없이도 의도를 파악할 수 있다.
  - 위치: 파일 전체
  - 상세: 매직 넘버/문자열 없음. 단일 DDL 문이라 함수 길이·중첩 논점 해당 없음.
  - 제안: 없음.

---

### 파일 2: auth.service.spec.ts (추가된 테스트)

- **[INFO]** 테스트 이름이 동작·기대값·비대칭 근거("request 와 비대칭, spec §1.1.B")를 한 줄에 담아 의도가 명확하다.
  - 위치: `it('W2 — 메일 발송 실패 시 토큰 롤백하지 않음 …')`

- **[INFO]** `usersService.update.mock.calls[0]` 접근 시 타입 캐스팅 `as [string, Partial<User>]`를 사용하는 패턴은 기존 파일의 관례와 일치한다. 단, 이 호출 인덱스(`[0]`)는 `toHaveBeenCalledTimes(1)` 단언과 짝을 이뤄야 의미가 있으며 두 단언이 인접해 있어 가독성이 좋다.
  - 위치: 108-112행
  - 상세: 특이사항 없음.

---

### 파일 3: users-email-change.e2e-spec.ts

- **[INFO]** `seedPendingEmailChange` 헬퍼 추출로 4회 반복되던 raw UPDATE 쿼리가 제거되어 DRY 원칙이 준수되었다. 매직 문자열(`"NOW() + INTERVAL '1 hour'"`)은 기본 파라미터로 캡슐화되어 호출 측의 가독성이 향상되었다.
  - 위치: 149-163행

- **[INFO]** `expiresSql` 파라미터 이름은 의도("SQL 표현식을 직접 삽입")를 전달하지만, SQL 인젝션 패턴임을 함수 시그니처만으로는 알기 어렵다.
  - 위치: `seedPendingEmailChange` 함수 시그니처 (`expiresSql = "NOW() + INTERVAL '1 hour'"`)
  - 상세: 이 함수는 테스트 전용 헬퍼이며 외부 입력을 받지 않는다(상수 리터럴만 전달). 프로덕션 SQL 인젝션 위험은 없으나, 미래에 가변 값을 넣으려는 개발자가 파라미터화해야 함을 놓칠 수 있다.
  - 제안: JSDoc 한 줄 추가 — `// expiresSql: SQL 표현식 직접 삽입 (테스트 내부 상수 전용, 파라미터화 금지)`. 차단 불필요.

- **[INFO]** `before` / `after` 변수명은 의미는 전달하나 좀 더 구체적이면(`beforeResend` / `afterResend`) 중첩 단언 블록에서 오독 위험이 준다. 단, 한 테스트 스코프 안이라 현재 수준도 수용 가능.
  - 위치: resend 테스트 240-256행

- **[INFO]** `60_000` 타임아웃은 파일 내 모든 it 블록에 일관되게 사용되어 숫자 자체가 컨벤션(e2e 기본 타임아웃)임을 암묵적으로 전달하고 있다. 명시적 상수(`const E2E_TIMEOUT = 60_000`)로 추출하면 변경 시 한 곳만 수정하면 된다.
  - 위치: 269, 279, 310행
  - 제안: 파일 상단에 `const E2E_TIMEOUT = 60_000;` 상수를 선언하는 것을 고려. 차단 불필요.

---

### 파일 4: verify-email-change.test.tsx (신규 파일)

- **[INFO]** `tFromKo` i18n mock 구현이 `profile-info-card.test.tsx`(혹은 다른 파일)에도 동일하게 존재한다(이전 리뷰 SUMMARY INFO 3 참조). 동일 로직이 두 파일에 복제되어 있으면 i18n 구조 변경 시 두 곳을 함께 수정해야 한다.
  - 위치: 357-368행 (`tFromKo` 구현 블록)
  - 상세: 테스트 전용 util이므로 프로덕션 영향은 없으나, 향후 `ko` dict 구조 변경 시 두 파일을 동시에 수정해야 하는 중복 유지보수 비용이 발생한다.
  - 제안: `codebase/frontend/src/test-utils/i18n-mock.ts` 등의 공통 모듈로 추출. SUMMARY INFO 3과 동일 항목 — 비차단, 선택.

- **[INFO]** 모듈 레벨 변수 `mockToken`을 `let`으로 선언하고 `beforeEach`에서 재설정하는 패턴은 vitest에서 일반적이다. `vi.mock` 팩토리 클로저에서 변수를 캡처하는 패턴이어서 의도 파악에 약간의 맥락이 필요하지만, 파일 내 일관적으로 사용되어 코드베이스 관례를 따른다.
  - 위치: 333-374행

- **[INFO]** `replace`와 `setAccessToken`을 모듈 레벨 `vi.fn()`으로 선언하고 `beforeEach(() => vi.clearAllMocks())`로 정리하는 패턴이 기존 코드베이스와 일치한다.

---

### 파일 5: profile-info-card.test.tsx (변경)

- **[INFO]** `renderCard` 헬퍼 시그니처에 `pendingEmail?: string | null`을 추가한 것은 최소 변경으로 하위 호환을 유지한다. 기존 호출 3개는 수정 없이 그대로 동작한다.
  - 위치: 530-534행

- **[INFO]** 신규 테스트 3개가 각각 하나의 UI 속성(링크 href, pending 미표시, pending 표시)을 검증하는 단일 책임 구조로 작성되었다. 명확하고 간결하다.

---

## 요약

이번 변경 세트는 유지보수성 측면에서 전반적으로 양호하다. 핵심 개선 사항인 `seedPendingEmailChange` 헬퍼 추출(이전 리뷰 W3 fix)은 중복 SQL을 효과적으로 제거했다. SQL 마이그레이션 파일은 상세한 주석으로 의도를 명확히 설명한다. 단위 테스트 추가(W2 fix)는 비대칭 동작(resend vs request 롤백 정책)을 명확히 문서화하고 있어 향후 이 로직을 수정하는 개발자에게 명시적 가이드가 된다. 지적할 항목은 `tFromKo` i18n mock 중복(테스트 유틸 추출 권고), `60_000` 타임아웃 상수화, `expiresSql` 파라미터 주석 보강 정도이며 모두 비차단 수준이다.

## 위험도

NONE
