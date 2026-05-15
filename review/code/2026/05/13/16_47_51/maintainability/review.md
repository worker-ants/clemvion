### 발견사항

- **[INFO]** `loginHistory.record()` 호출 패턴이 서비스 전반에 걸쳐 15회 반복됨
  - 위치: `auth.service.ts` 전체, `sessions.service.ts`
  - 상세: `{ ip: ctx.ip ?? null, userAgent: ctx.userAgent ?? null }` 스프레드 패턴이 모든 호출부에서 그대로 반복된다. `AuthContext` → `LoginEventInput` 매핑이 호출부의 책임으로 흩어져 있어, `AuthContext` 구조 변경 시 수정 지점이 15곳이 된다.
  - 제안: `LoginHistoryService`에 `recordFromCtx(input: Omit<LoginEventInput, 'ip'|'userAgent'>, ctx: AuthContext)` 오버로드(또는 별도 헬퍼)를 두어 ctx 매핑을 한 곳으로 집중시키거나, `auth.service.ts`에 private 헬퍼 `historyInput(ctx, partial)` 를 도입해 반복을 줄인다.

- **[INFO]** `login()` 메서드의 순환 복잡도
  - 위치: `auth.service.ts:login()` (약 60줄, 분기 5개)
  - 상세: 변경 자체가 복잡도를 높이진 않았으나, `USER_NOT_FOUND` → `ACCOUNT_LOCKED` → `EMAIL_NOT_VERIFIED` → `PASSWORD_NOT_SET` → `INVALID_PASSWORD` 순으로 `record()` + `throw` 쌍이 반복되는 구조가 이번 diff로 더 명시적으로 드러났다. 각 분기가 동일한 패턴(record → throw)이므로 중복 의도가 있다.
  - 제안: 즉각적 리팩토링보다는 향후 `login()` 내부 분기를 `validateLoginPrerequisites(user, ctx)` 같은 도우미로 추출할 때 함께 처리하면 충분하다.

- **[INFO]** `toDto()` 메서드 주석이 실제 역할과 불일치
  - 위치: `login-history.service.ts:toDto()` (주석: "Backwards-compatible alias for callers that still expect to receive raw rows. Used by spec when asserting persisted shape.")
  - 상세: 현재 `toDto()`는 raw row를 반환하지 않고 `LoginHistoryItemDto`를 반환하는 순수 변환기다. "Backwards-compatible alias"라는 표현과 "callers that still expect raw rows"는 현 시점 코드와 맞지 않아 독자 혼란을 준다.
  - 제안: 주석을 제거하거나 "Maps a `LoginHistory` entity to the public DTO shape."처럼 실제 동작을 기술하는 짧은 한 줄로 교체한다.

- **[INFO]** `login-history.service.ts`의 `record()` 메서드 JSDoc 길이
  - 위치: `login-history.service.ts:record()` JSDoc (9줄)
  - 상세: 변경 후 JSDoc이 호출 규약과 race 조건 배경을 모두 담아 필요한 맥락을 제공하고 있다. 다만 CLAUDE.md 규약("WHY가 자명하지 않을 때만 짧은 한 줄 주석")과 비교하면 분량이 많다. 프로젝트 내 다른 서비스들의 주석 스타일과 편차가 생긴다.
  - 제안: race 배경은 `plan/` 문서나 git commit message에 위임하고, JSDoc은 **"호출부는 반드시 `await`. 내부에서 예외를 삼키므로 인증 흐름에 영향 없음."** 2줄 수준으로 축약해도 충분하다. 단, 팀이 이 파일에서만 상세 주석 정책을 허용한다면 현 상태도 수용 가능하다.

---

### 요약

이번 변경(`void` → `await` 일괄 치환)은 race 조건을 해소하는 명확한 수정이며, 변경 범위·의도·영향 분석이 plan 문서에 잘 정리되어 있다. 유지보수성 측면의 실질적 위험은 낮다. 다만 `AuthContext` → `LoginEventInput` 매핑 코드가 15개 호출부에 산재해 있어, `AuthContext` 필드가 변경될 경우 수정 지점이 많다는 구조적 부채가 있다. 즉각적인 수정이 필요한 CRITICAL/WARNING 항목은 없으며, 지적된 INFO 사항들은 다음 리팩토링 사이클에서 점진적으로 개선하면 충분하다.

### 위험도

**LOW**