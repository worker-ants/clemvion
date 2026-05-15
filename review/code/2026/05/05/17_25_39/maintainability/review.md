### 발견사항

- **[WARNING]** `getPasswordStrength` 함수 중복 정의
  - 위치: `register-form.tsx:37-46`, `reset-password-form.tsx:25-34`
  - 상세: 동일한 로직이 두 파일에 각각 정의되어 있음. 시그니처, 분기 구조, 반환 타입 모두 동일.
  - 제안: `frontend/src/lib/utils/password-strength.ts` 같은 공유 모듈로 추출하고 두 컴포넌트에서 import.

- **[WARNING]** `hover:underline` → `underline` 패턴 변경이 4개 파일에 분산
  - 위치: `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`
  - 상세: 링크 스타일이 컴포넌트마다 인라인 className으로 하드코딩되어 있어, 향후 링크 정책 변경 시 다시 4곳을 수동으로 수정해야 함.
  - 제안: `cn("text-[hsl(var(--primary))] underline")` 조합을 `authLinkClassName` 상수나 `AuthLink` 래퍼 컴포넌트로 추출하면 한 곳 수정으로 일관성 유지 가능.

- **[INFO]** e2e 테스트의 axe scan 블록 구조 불일치
  - 위치: `smoke.spec.ts` — `login` 테스트(L23-37)는 위반 상세를 `console.log`로 출력하나, 신규 `forgot-password` 테스트(L84-91)는 출력 없이 바로 `expect`.
  - 상세: 실패 시 디버깅 편의가 테스트마다 다름. 패턴이 두 종류로 분기되면 앞으로 추가되는 페이지 테스트 작성자가 어떤 형식을 따를지 불명확해짐.
  - 제안: 두 방식 중 하나로 통일하거나(login 스타일 권장 — 실패 원인 즉시 파악 가능), `scanPage` 같은 헬퍼로 추출해 재사용.

- **[INFO]** `globals.css` 주석 내 `(Stage 10 a11y)` 태그
  - 위치: `globals.css:18-19`, `globals.css:43-44`
  - 상세: 주석에 구현 단계(Stage 10)를 명시하면 미래에 값이 변경될 때 주석이 오래된 컨텍스트를 달고 남을 수 있음. CLAUDE.md 규약상 "작업자 출처 참조는 PR description에" 남기는 것이 권장됨.
  - 제안: `(Stage 10 a11y)` 태그를 제거하고 WCAG 수치 근거(`~5.7:1`, `~7:1`)만 남김.

- **[INFO]** `result-detail.tsx`의 `MinusCircle` 에만 `aria-hidden="true"` 적용
  - 위치: `result-detail.tsx:73`
  - 상세: 같은 `StatusBadge` 내 `Loader2`, `CheckCircle`, `XCircle`, `PauseCircle`에는 `aria-hidden`이 없고 `MinusCircle`에만 추가됨. "Skipped" 텍스트가 이미 있으므로 다른 아이콘도 동일하게 처리해야 일관성 있음.
  - 제안: 모든 status 아이콘에 `aria-hidden="true"` 일괄 적용.

- **[INFO]** `voiceover-notes.md`의 체크리스트가 미완성 상태로 커밋
  - 위치: `review/2026-05-05_a11y/voiceover-notes.md:52-58`
  - 상세: "검증 일시: ___", "검증자: ___", "발견된 이슈: (없음 / 또는 ...)" 등 플레이스홀더가 채워지지 않은 채 repo에 병합됨. 이력 문서로서 신뢰도가 낮아짐.
  - 제안: 수동 검증 수행 후 결과를 채워 커밋하거나, 미수행 사실을 명시(`검증 미수행 — 자동 e2e 통과로 대체`).

---

### 요약

이번 변경은 WCAG AA 색 대비 수정, 링크 underline 상시 노출, 접근성 e2e 테스트 추가 등 목적이 명확하고 범위가 잘 통제된 작업이다. 가장 주목할 유지보수성 문제는 `getPasswordStrength`의 두 파일 중복으로, 향후 비밀번호 강도 기준 변경 시 하나를 빠뜨릴 위험이 있다. 링크 스타일의 인라인 중복도 4개 파일에 분산되어 있어 추후 정책 변경 시 산탄총 수술(shotgun surgery) 패턴을 유발한다. 나머지는 가독성·일관성 차원의 경미한 지적으로, 기능 정확성에는 영향이 없다.

---

### 위험도
**LOW**