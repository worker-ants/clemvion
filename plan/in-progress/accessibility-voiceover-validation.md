# macOS VoiceOver 수동 검증

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §D
> 선행 plan: `plan/complete/feature-roadmap/10-a11y.md` (자동화 ✅, 수동 검증 ⏸)

## 배경

PRD 5 §6 NF-A11Y-03 — 스크린 리더 호환:

> ✅ (Stage 10, 2026-05-05) — 폼 입력 `aria-invalid` + `aria-describedby` 연결, icon-only 버튼 `aria-label`, 장식 아이콘 `aria-hidden`, SlideDrawer Radix `FocusScope` 트랩, 실행 상태 `aria-live="polite"` announce 모두 적용 ✅. **macOS VoiceOver 수동 검증 체크리스트 (`review/2026-05-05_a11y/voiceover-notes.md`) 는 사용자 수행 대기** — 완료 시 ✅ 로 전환.

자동화 (axe smoke test) 는 ✅ 이지만 macOS VoiceOver 의 실제 사용성은 자동 검증으로 잡히지 않는다. 사용자가 직접 수행해야 하는 수동 체크리스트가 남아 있다.

## 관련 문서

- `prd/5-non-functional.md` §6 NF-A11Y-03
- `review/2026-05-05_a11y/voiceover-notes.md` — 체크리스트 본체
- `frontend/e2e/a11y/smoke.spec.ts` — 자동 회귀 (axe)

## 작업 단위

### 1. 체크리스트 수행 (사용자 수동)

본 작업은 LLM이 수행할 수 없다. 사용자(또는 QA 담당) 가 macOS + VoiceOver 환경에서 직접 수행해야 한다.

- [ ] `review/2026-05-05_a11y/voiceover-notes.md` 의 체크리스트를 macOS Safari + VoiceOver 로 수행
- [ ] 각 항목별 PASS/FAIL 기록 + FAIL 시 재현 단계·스크린리더 출력 캡처
- [ ] 동일 체크리스트를 Chrome 으로도 수행 (선택적이지만 권장 — Chrome 의 VoiceOver 지원이 다름)

### 2. FAIL 항목 처리 (LLM 가능)

수동 검증에서 FAIL 이 나오면 LLM 이 fix 가능.

- [ ] FAIL 항목별로 frontend 컴포넌트의 ARIA 속성·focus 관리·live region 보강
- [ ] 단위 테스트 + axe smoke test 회귀 추가
- [ ] `review/2026-05-05_a11y/voiceover-notes.md` 에 fix 결과 기록

### 3. PRD 갱신

- [ ] 모든 체크리스트 항목 PASS 시 `prd/5-non-functional.md` §6 NF-A11Y-03 의 "🚧 macOS VoiceOver 수동 검증 사용자 수행 대기" 표기를 ✅ 로 갱신
- [ ] `review/2026-05-05_a11y/voiceover-notes.md` 본 plan 의 결과 첨부 + RESOLUTION 작성

### 4. 회귀 방지

- [ ] CI 에서 Playwright + axe smoke test 가 매 PR 마다 실행되도록 확인 (이미 적용되어 있을 가능성 높음 — 확인만)
- [ ] VoiceOver 회귀가 의심되는 컴포넌트 변경 PR 에는 PR description 에 "VoiceOver 재검증 권장" 체크박스 추가 권장 (자동화는 어렵지만 가이드)

## 수용 기준

- VoiceOver 체크리스트 모든 항목 PASS
- FAIL 이 있었던 경우 fix → 재검증 → PASS
- PRD NF-A11Y-03 의 🚧 표기 제거

## 의존성·리스크

- **의존**: 사용자(QA) 의 수동 작업 — LLM 이 단독으로 완료할 수 없음
- **리스크**:
  - VoiceOver 동작이 macOS 버전에 따라 다름 — 검증 환경 (macOS 버전·Safari 버전) 명시 필요
  - FAIL 수정이 다른 시각 디자인을 깨뜨릴 수 있음 (focus ring 등) — design-taste 스킬과 충돌 주의
