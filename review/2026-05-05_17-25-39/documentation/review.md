## 발견사항

### [WARNING] `stages.md`가 `plan/complete/`에 위치하지만 미체크 체크박스 포함
- **위치**: `plan/complete/feature-roadmap/stages.md`, 32~37번 줄 "완료 정의" 섹션
- **상세**: CLAUDE.md 프로젝트 규약에 따르면 미체크 체크박스(`[ ]`)가 하나라도 있으면 `plan/in-progress/`에 위치해야 한다. `stages.md`의 "완료 정의 (Definition of Done)" 섹션에 6개의 미체크 체크박스가 있는 채로 `plan/complete/`에 커밋되었다.
- **제안**: 해당 섹션을 범용 기준 설명(non-checklist 형태)으로 변환하거나, Stage 10에 한정된 완료 체크리스트라면 체크 처리 후 이동

---

### [INFO] `smoke.spec.ts` describe 블록 이름이 실제 커버리지와 불일치
- **위치**: `frontend/e2e/a11y/smoke.spec.ts`, 추가된 블록 `"a11y smoke — forgot-password / reset-password"`
- **상세**: describe 이름에 `reset-password`가 명시되어 있으나 실제 테스트는 `forgot-password`만 검사한다. `reset-password` axe scan이나 키보드 진입 테스트가 없어 이름이 과잉 약속(overpromise)한다.
- **제안**: describe 이름을 `"a11y smoke — forgot-password"` 로 축소하거나, `reset-password` 페이지 axe scan을 동일 블록에 추가

---

### [INFO] 링크 `underline` 항시 노출 변경에 이유 주석 없음
- **위치**: `login-form.tsx:256`, `login-form.tsx:310`, `forgot-password-form.tsx:124`, `register-form.tsx:238,247,326`, `reset-password-form.tsx:223`
- **상세**: `hover:underline` → `underline` 전환은 WCAG 2.1 Success Criterion 1.4.1 (Use of Color) 및 `link-in-text-block` axe 룰 준수를 위한 것인데, 이 맥락을 모르는 개발자가 나중에 "왜 항상 underline이지?" 하며 `hover:underline`으로 되돌릴 위험이 있다. 프로젝트 코딩 규약("WHY가 비직관적일 때만 주석")에 해당하는 케이스다.
- **제안**: 대표 파일 한 곳(예: `globals.css` 상단 또는 `login-form.tsx`)에 한 줄 주석 추가: `{/* WCAG 1.4.1: link-in-text-block 룰 — 색만으로 링크 구분 금지, underline 항시 노출 */}`

---

### [INFO] `result-detail.tsx` 색상 변경에 맥락 없음
- **위치**: `result-detail.tsx:73` — `text-gray-500` → `text-gray-700`
- **상세**: Skipped 상태 뱃지의 텍스트 대비비 개선 변경인데 주석이 없다. `globals.css`의 `--muted-foreground` 변경에는 대비비 근거가 명시된 반면 이쪽은 무언. 하드코딩된 Tailwind 회색 클래스라 CSS 변수 패턴에서도 벗어나 있다.
- **제안**: 다른 상태 뱃지(running: `text-blue-600`, failed: `text-red-600`)와 달리 muted 색상을 쓰는 이유가 없다면, 짧은 주석으로 WCAG 대비 조정임을 명시하거나 `text-[hsl(var(--muted-foreground))]`로 통일

---

### [INFO] VoiceOver 체크리스트 모든 항목 미체크 상태로 `review/`에 저장
- **위치**: `review/2026-05-05_a11y/voiceover-notes.md`
- **상세**: 계획 문서는 이 파일을 "사용자가 직접 수행할 체크리스트"로 명시하고 있어 설계 의도는 이해되지만, `plan/complete/10-a11y.md`의 "결과" 섹션이 VoiceOver 검증을 완료된 것처럼 기술("VoiceOver 수동 검증 체크리스트 — 사용자가 macOS VoiceOver 로 직접 수행")하여 실제 수행 여부가 불분명하다.
- **제안**: `voiceover-notes.md` 상단에 `**상태**: 검증 미완 (사용자 수행 대기)` 표기를 추가하거나, `plan/complete/10-a11y.md`의 결과 기술에 "수동 검증 예정" 표현 명시

---

## 요약

전반적으로 이번 Stage 10 a11y 변경은 `globals.css`의 대비비 근거 주석, `10-a11y.md`의 단계별 커밋 이력, `prd/5-non-functional.md`의 구현 상세 기술 등 문서화 수준이 높다. 다만 `plan/complete/stages.md`에 미체크 체크박스가 남아 있어 프로젝트 고유의 plan 라이프사이클 규약을 위반하는 점이 유일한 실질적 문제이며, 그 외 링크 underline 변경의 WCAG 근거 누락과 `smoke.spec.ts` describe 이름의 과잉 약속은 향후 혼란 방지 차원에서 소폭 보완을 권장한다.

## 위험도

**LOW**