### 발견사항

---

**[WARNING] `--muted-foreground` 전역 CSS 변수 변경 — 앱 전체 컴포넌트에 시각적 부작용**
- 위치: `globals.css:17`, `globals.css:41`
- 상세: `:root`와 `.dark` 아래의 `--muted-foreground`는 앱 전체에서 공유하는 디자인 토큰이다. 이번 변경으로 auth 페이지 외에도 `result-detail.tsx`의 탭 비활성 텍스트, `docs-prose blockquote` 색, 노드 캔버스 컴포넌트, 사이드바 메뉴 항목 등 `text-muted-foreground` / `text-[hsl(var(--muted-foreground))]`를 참조하는 모든 곳이 영향을 받는다. 이 파일의 테스트 커버리지(axe smoke)는 auth 3개 페이지만 검증하므로, 나머지 페이지에서 오히려 대비비가 너무 높아지거나 UI 톤이 어색해질 수 있다.
- 제안: 변경 의도대로 auth 페이지 전용으로 스코프를 좁히려면 별도 클래스(`[data-layout="auth"]`)를 도입하거나, 적어도 캔버스·에디터 화면을 dark/light 양쪽에서 시각 확인하는 스모크 테스트를 추가한다.

---

**[INFO] light mode saturation 변경이 주석에 미기재 — `16.3%` → `25%`**
- 위치: `globals.css:17` (`--muted-foreground: 215.4 25% 35%;`)
- 상세: 주석은 lightness `46.9% → 35%` 변경만 설명하지만, saturation도 `16.3% → 25%`로 함께 바뀌었다. `35%` lightness에서는 시각적 차이가 크지 않지만, "muted"라는 이름과 어긋나게 파란 기가 더 도드라질 수 있다.
- 제안: 의도적이라면 주석에 saturation 변경 이유도 병기한다. 의도하지 않았다면 `215.4 16.3% 35%`로 saturation을 유지해야 한다.

---

**[INFO] `result-detail.tsx` — `MinusCircle`만 `aria-hidden` 추가, 나머지 상태 아이콘은 미적용**
- 위치: `result-detail.tsx:73`
- 상세: `StatusBadge`의 `running`, `completed`, `failed`, `waiting_for_input` case의 아이콘(`Loader2`, `CheckCircle`, `XCircle`, `PauseCircle`)에는 `aria-hidden`이 없다. "Skipped"만 `aria-hidden="true"`를 받아 스크린 리더 동작이 case마다 달라진다. 모든 상태 배지에는 가시 텍스트 라벨("Done", "Failed" 등)이 있으므로 아이콘은 전부 장식으로 보아야 한다.
- 제안: 나머지 case의 아이콘에도 동일하게 `aria-hidden="true"`를 추가해 일관성을 맞춘다.

---

**[INFO] `hover:underline` → `underline` 전환이 standalone 링크에도 적용**
- 위치: `login-form.tsx:255`, `forgot-password-form.tsx:124`, `register-form.tsx:241,250,326`, `reset-password-form.tsx:223`
- 상세: WCAG `link-in-text-block` 룰 대응으로 항시 밑줄을 적용한 것은 타당하다. 단, `login-form.tsx:255`의 "비밀번호를 잊으셨나요?" 링크는 단락 텍스트 안에 있지 않고 flex 행 오른쪽에 단독으로 위치한다. 항시 밑줄이 a11y 위반을 막진 않지만, 뒤에 디자인 결정을 재고할 때 이 구분이 필요하다.
- 제안: 현 시점에서 기능적 부작용은 없으며 일관성 측면에서 오히려 바람직하다. 필요하다면 "텍스트 내 인라인 링크"와 "독립형 액션 링크"를 Tailwind 클래스 variant로 분리한다.

---

**[INFO] smoke 테스트 — 키보드 첫 포커스 조건이 주석-의존적**
- 위치: `smoke.spec.ts:94`
- 상세: 주석에 "skip-to-main 이 `(auth)` layout 에 없으므로"라고 전제를 명시했다. 만약 나중에 `(auth)` layout에 skip-to-main이 추가되면 `A` 태그를 허용하는 느슨한 assertion 덕분에 테스트는 계속 통과하지만 주석은 거짓이 된다. 기능적 부작용은 없지만 misleading documentation이 생긴다.
- 제안: `page.waitForLoadState("networkidle")` 이후에 Tab을 누르도록 명시하면 플레이키 위험을 줄일 수 있고, 주석에 "skip-to-main이 없음"을 명시한 이상 `expect(focused).toBe("INPUT")` 처럼 더 구체적인 assertion이 의도를 더 정확히 표현한다.

---

### 요약

이번 변경 집합의 핵심 부작용 리스크는 `globals.css`의 `--muted-foreground` 토큰 수정이다. 이 변경은 WCAG AA 대비비를 달성한다는 명확한 목적이 있고 주석으로도 근거가 기재되어 있으나, 적용 범위가 auth 페이지를 훨씬 넘어 앱 전체 컴포넌트에 미친다는 점은 명시되지 않았다. 현재 axe smoke 테스트가 이를 부분적으로만 검증하므로, 에디터·캔버스·설정 화면에서 육안 또는 자동 대비 검사가 보완되어야 잠재적 시각 회귀를 완전히 배제할 수 있다. 그 외 변경들(링크 밑줄 항시 적용, 배지 텍스트 색 어둡게, `aria-hidden` 추가)은 범위가 좁고 의도적이며 기능적 부작용은 없다.

### 위험도

**LOW**