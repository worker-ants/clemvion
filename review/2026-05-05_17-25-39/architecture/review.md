## 아키텍처 코드 리뷰

### 발견사항

- **[WARNING]** `getPasswordStrength` 함수 중복 정의
  - 위치: `register-form.tsx:27-36`, `reset-password-form.tsx:25-35`
  - 상세: 동일한 5-점수 비밀번호 강도 로직이 두 파일에 그대로 복사되어 있다. 강도 기준(길이, 특수문자 조건 등)이 바뀔 때 양쪽을 모두 수정해야 하는 동기화 부담이 생기며, 현재도 두 함수가 100% 동일함에도 별도로 관리된다.
  - 제안: `@/lib/utils/password.ts`로 추출하고 두 폼에서 임포트하도록 변경.

- **[WARNING]** `test.describe("forgot-password / reset-password")` 내 reset-password 커버리지 공백
  - 위치: `e2e/a11y/smoke.spec.ts:85`
  - 상세: describe 블록 제목이 두 페이지를 모두 포함하지만 `/reset-password` 페이지에 대한 axe 스캔 및 키보드 진입 테스트가 없다. `/reset-password`는 토큰을 쿼리 파라미터로 받으므로 테스트가 없는 건 의도적일 수 있으나, 블록 제목이 오해를 유발한다.
  - 제안: 테스트를 추가하거나 describe 이름을 `"a11y smoke — forgot-password"`로 좁히는 것 중 하나를 선택.

- **[WARNING]** 인라인 링크 스타일링이 개별 파일에 분산 적용
  - 위치: `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx` 각 링크 요소
  - 상세: `hover:underline` → `underline` 변경이 4개 파일 6개 지점에 동일하게 적용되었다. 이번 변경은 일관성을 회복했지만, 다음에 링크 스타일 정책이 바뀌면 또 4개 파일을 수정해야 한다.
  - 제안: `className="text-[hsl(var(--primary))] underline"` 조합을 래핑한 `AuthLink` 컴포넌트나 Tailwind 컴포넌트 클래스(`@layer components`)로 추출하면 한 곳만 수정하면 된다. 단, 현재 규모에서는 오버엔지니어링일 수 있으므로 4개 이상의 추가 사용처가 생길 때 리팩토링하는 것도 합리적.

- **[INFO]** globals.css 대비비 주석이 사람이 확인한 값이며 자동 검증 없음
  - 위치: `globals.css:17-19`, `globals.css:42-44`
  - 상세: `~5.7:1`, `~7:1` 등 대비비 수치가 주석에만 존재한다. 값이 다시 변경될 때 주석이 stale 해질 수 있고, axe 는 contrast를 런타임에 검사하므로 CSS 변수 수준에서 정적 보증은 없다.
  - 제안: 현재 axe e2e 가 런타임에 color-contrast 룰을 커버하므로 자동 보증은 이미 갖춰져 있다. 현재 접근법(주석 + axe 테스트)은 실용적이며 조치 불필요. 다만 주석의 수치를 과신하지 않도록 팀 공유 필요.

- **[INFO]** `result-detail.tsx`의 `StatusBadge` — 아이콘 `aria-hidden` 부분 적용
  - 위치: `result-detail.tsx:70-77`
  - 상세: `MinusCircle`에만 `aria-hidden="true"`가 추가되고 `CheckCircle`, `XCircle`, `PauseCircle`, `Loader2`는 여전히 없다. 텍스트 라벨("Done", "Failed" 등)이 있으므로 시급한 a11y 위반은 아니나, 일관성이 깨진다.
  - 제안: `StatusBadge` 내 모든 장식 아이콘에 `aria-hidden="true"` 추가하거나, Badge 하위에 공통 래핑 처리.

- **[INFO]** plan 라이프사이클 이동이 정책(git mv)을 준수하고 있음
  - 위치: `plan/in-progress/stages/10-a11y.md` 삭제 + `plan/complete/feature-roadmap/10-a11y.md` 신규
  - 상세: diff 형태상 `git mv`가 아닌 삭제+추가로 보이지만 실제 실행 방법 확인 불가. CLAUDE.md 규약은 history 보존을 위해 `git mv` 사용을 명시한다.
  - 제안: `git log --follow`로 history가 이어지는지 확인. 깨져 있다면 다음 이동 시 `git mv` 적용.

---

### 요약

이번 변경사항의 핵심은 Stage 10 a11y 완료 처리(plan 이동, PRD 상태 갱신)와 WCAG AA 충족을 위한 CSS 변수 조정·링크 underline 항시 노출이다. 아키텍처적으로 레이어 경계는 올바르게 유지되고 있으며(CSS 토큰 단 수정 → 전체 컴포넌트에 자동 반영, e2e 테스트가 회귀 방어), 변경 범위가 프레젠테이션 레이어에 국한되어 있다. 주요 지적 사항은 이번 diff가 신규로 도입한 것이 아닌 기존 코드베이스의 `getPasswordStrength` 중복이고, 테스트 블록 이름과 실제 커버리지 불일치는 다음 사이클에 해소가 필요하다. 전반적으로 변경의 의도와 구현이 명확하게 정합되어 있다.

### 위험도

**LOW**