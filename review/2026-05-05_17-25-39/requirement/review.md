## Requirement Code Review — Stage 10 접근성 (WCAG 2.1 AA)

---

### 발견사항

- **[WARNING]** `smoke.spec.ts` — describe 명칭과 실제 커버리지 불일치
  - 위치: `e2e/a11y/smoke.spec.ts` describe: "a11y smoke — forgot-password / **reset-password**"
  - 상세: `/reset-password` 페이지에 대한 테스트가 없음. describe 이름에 포함됐으나 `forgot-password` 만 검사. `reset-password-form.tsx` 도 동일 단계에서 수정됐으므로 axe 회귀 감지가 누락됨.
  - 제안: `/reset-password?token=test` (또는 `?token=invalid`) 라우트에 대한 axe scan 테스트를 추가하거나 describe 명칭을 "forgot-password" 로만 한정.

- **[WARNING]** `smoke.spec.ts` — 키보드 첫 포커스 단언이 과도하게 관대함
  - 위치: `forgot-password 키보드 진입` 테스트 `expect(["A", "INPUT", "BUTTON"]).toContain(focused)`
  - 상세: `BUTTON` 이 포함돼 있어 email 입력 대신 제출 버튼에 포커스가 가도 통과. 코멘트는 "폼 내부 첫 input(email) 으로 직접 도달" 이라 의도를 명시하나 실제 단언이 그것을 보장하지 않음. 로그인/회원가입 페이지에는 이 테스트 자체가 없어 비교 기준도 없음.
  - 제안: `expect(focused).toBe("INPUT")` 또는 `page.locator('#email').isFocused()` 로 정밀화.

- **[WARNING]** `result-detail.tsx` — `aria-hidden` 처리 일관성 결여
  - 위치: `StatusBadge` — `skipped` case 만 `aria-hidden="true"` 추가
  - 상세: `running`(Loader2), `completed`(CheckCircle), `failed`(XCircle), `waiting_for_input`(PauseCircle) 아이콘은 동일 처리 없음. 스크린 리더에서 아이콘명이 낭독되는 조건이 일부 케이스에 남아 있음.
  - 제안: 모든 StatusBadge case의 아이콘에 `aria-hidden="true"` 일괄 적용.

- **[WARNING]** `voiceover-notes.md` — 체크리스트 미완 상태로 NF-A11Y-03 ✅ 처리
  - 위치: `review/2026-05-05_a11y/voiceover-notes.md` 전 항목 `[ ]`, "검증 일시: ___________"
  - 상세: PRD `prd/5-non-functional.md` 에서 NF-A11Y-03 을 `✅`로 갱신하면서 이 체크리스트를 근거로 인용하지만, 체크리스트 자체는 미수행 상태. 요구사항 완료 증거가 미완 문서를 가리킴.
  - 제안: 사용자가 VoiceOver 검증 수행 후 항목 체크 + 검증 일시·결과 기록 전까지 NF-A11Y-03 상태를 `🚧`로 유지하거나, 체크리스트와 PRD 갱신을 동시에 수행.

- **[INFO]** `smoke.spec.ts` — `forgot-password` h1 카운트 테스트 미추가
  - 위치: "forgot-password / reset-password" describe
  - 상세: login, register 에는 `h1 1개 존재` 테스트가 있으나 forgot-password 에는 없음. 페이지 헤딩 위계 회귀 감지 공백.
  - 제안: `test("forgot-password h1 1개 존재", ...)` 동일 패턴으로 추가.

- **[INFO]** `globals.css` — 채도(saturation) 변경이 주석에 미기재
  - 위치: `:root --muted-foreground`: `16.3%` → `25%`
  - 상세: 주석은 lightness(`46.9% → 35%`)만 언급. 채도 변경은 색조에도 영향을 주며, 의도적 변경인지 부수 조정인지 코드만으로는 불분명.
  - 제안: 주석에 "채도 16.3 → 25: 어두워질수록 채도 보정" 등 이유를 명시.

- **[INFO]** `stages.md` in `plan/complete/` — `완료 정의` 섹션에 미체크 체크박스 잔류
  - 위치: `plan/complete/feature-roadmap/stages.md` 하단 `- [ ] 스펙·PRD가 실제 구현과 일치` 외 5항목
  - 상세: CLAUDE.md 분류 기준상 미체크 체크박스가 있으면 `in-progress/` 위치 규정. 해당 항목들이 "각 stage의 DoD 템플릿"인지 "stages.md 파일 자체의 할 일"인지 의미가 모호.
  - 제안: DoD 항목들을 체크박스가 아닌 일반 리스트로 변환하거나, 명시적으로 "참고용 템플릿" 주석 추가.

---

### 요약

Stage 10 변경사항은 전반적으로 WCAG 2.1 AA 요구사항(`NF-A11Y-01`, `NF-A11Y-03`)의 핵심을 충실히 이행한다 — 색 대비 보강, 링크 underline 항시 노출, aria-hidden 추가, e2e axe 회귀 감지 추가. 다만 요구사항 충족 근거 문서(voiceover-notes.md)가 실제로 채워지지 않은 채 ✅ 처리됐고, `smoke.spec.ts` describe 범위와 실제 커버리지 간 불일치(reset-password 누락), 그리고 `aria-hidden` 처리의 StatusBadge 내 불균등 적용이 요구사항 완전성 관점에서 미결 항목으로 남는다.

---

### 위험도

**LOW** — 자동 회귀 테스트(axe 0 위반 강제)는 정상 작동하며 핵심 a11y 개선은 배포 가능 수준이나, 수동 검증 미완과 reset-password 커버리지 공백은 후속 처리 필요.