# Plan 정합성 검토 — spec-draft-brand-refresh.md

검토 대상: `plan/in-progress/spec-draft-brand-refresh.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-05-15

---

## 발견사항

- **[WARNING]** `spec/2-navigation/_layout.md` §2.1 에 expanded/collapsed 로고 변종 규정 누락
  - target 위치: `spec-draft-brand-refresh.md` §8.4.6 로고 노출 자리 표 — "사이드바 상단 (`spec/2-navigation/_layout.md` §2.1) | expanded → Full logo (light) / collapsed → Icon mark"
  - 관련 plan: 직접 관련 plan 없음 (현행 `spec/2-navigation/_layout.md` §2.1 은 "로고 | 상단 | 제품 로고. 클릭 시 대시보드(홈, `/dashboard`)로 이동" 만 명시)
  - 상세: target draft 는 사이드바 expanded 상태에서 Full logo, collapsed 상태에서 Icon mark 를 쓰도록 정식화하고 있다. 그러나 현재 `spec/2-navigation/_layout.md` §2.1 의 "로고" 행은 클릭 동작만 기술하고, expanded/collapsed 별 변종 전환 규칙을 전혀 담고 있지 않다. 이로 인해 developer 가 Stage 2 구현 시 `spec/6-brand.md` §8.4.6 과 `spec/2-navigation/_layout.md` §2.1 을 동시에 읽을 때 두 spec 이 불일치하는 상황이 발생한다. §8.4.6 은 본 draft 가 `spec/6-brand.md` 에 반영된 뒤에야 확정되므로, `spec/2-navigation/_layout.md` §2.1 의 동반 갱신이 후속 항목으로 누락되어 있다.
  - 제안: `spec-draft-brand-refresh.md` 의 "다음 액션" 또는 "Stage 2 인수인계 항목"에 "`spec/2-navigation/_layout.md` §2.1 로고 행에 expanded/collapsed 변종 전환 규칙을 추가한다 (project-planner)" 를 명시한다. 또는 `spec/6-brand.md` 반영과 동시에 `spec/2-navigation/_layout.md` §2.1 을 갱신하는 작업을 Stage 1 완료 전에 포함시킨다.

- **[WARNING]** CSS 토큰 이름 확정이 Stage 2 로 완전히 위임되어 있어 Stage 1 spec 의 단일 진실 원칙이 불완전함
  - target 위치: `spec-draft-brand-refresh.md` §8.2.4 코드 토큰 매핑 — "코드 토큰 이름은 구현 시 결정한다"
  - 관련 plan: `plan/in-progress/spec-draft-brand-refresh.md` 의 "Stage 2 인수인계 항목 2. CSS 토큰 매핑"
  - 상세: `spec/6-brand.md` §8.2.4 는 "CSS 변수와 Tailwind theme 으로의 매핑은 developer skill 의 Stage 2 에서 수행한다. 코드 토큰 이름은 구현 시 결정한다" 고 명시한다. 이 자체는 의도된 위임이지만, CLAUDE.md 의 SDD 원칙은 "spec 이 구현보다 선행" 을 요구한다. Stage 2 plan 이 생성되기 전에는 CSS 변수명 결정이 미해결 결정으로 남아 있다. Stage 2 plan 이 생성되지 않은 채로 Stage 1 이 complete 처리될 경우, CSS 변수명을 developer 가 임의로 결정하게 되어 향후 일관성 점검에서 spec 레퍼런스가 없는 토큰이 발생할 수 있다. 현재 `frontend/src/app/globals.css` 의 `--primary` 는 Tailwind 기본(222.2 47.4% 11.2%) 으로 vine-700 과 전혀 다른 값이다.
  - 제안: `spec-draft-brand-refresh.md` 의 "다음 액션 4번" 을 "본 plan complete 이동 **및** 신규 `plan/in-progress/brand-refresh-impl.md` (Stage 2) 생성을 **동시에** 처리한다" 로 강조한다. Stage 2 plan 생성 전에 본 plan 을 complete 로 이동하지 않도록 순서를 명시적으로 결속한다.

- **[INFO]** `brand-refresh-impl.md` (Stage 2) 가 아직 존재하지 않아 다음 단계 추적이 단절될 가능성
  - target 위치: `spec-draft-brand-refresh.md` 전체 — "Stage 2 인수인계 항목" 섹션 및 "다음 액션 4번"
  - 관련 plan: 없음 (Stage 2 plan 미생성 상태)
  - 상세: target draft 는 Stage 2 에서 처리할 7개 항목(자산 9종 생성·배치, CSS 토큰 매핑, `<Logo />` 컴포넌트 신설, UI 자리 통합, Next.js metadata.icons, 회귀 테스트, README.md 임베드)을 상세히 기술하고 있다. 그러나 해당 항목을 추적할 `plan/in-progress/brand-refresh-impl.md` 가 아직 존재하지 않는다. 본 draft 가 채택(spec 반영)되는 시점과 Stage 2 plan 생성 시점 사이에 공백이 생기면, 7개 구현 항목의 plan 추적이 단절된다.
  - 제안: 현재 `spec-draft-brand-refresh.md` 의 "Stage 2 인수인계 항목" 내용이 매우 구체적이므로, spec 반영 직후(다음 액션 2번 완료 후) 즉시 `brand-refresh-impl.md` 를 생성하도록 다음 액션 4번에 명시적으로 포함시킨다. 이 메모는 plan 라이프사이클 단절 방지용이다.

- **[INFO]** `bg-monitoring-api-7c2a91` worktree 와 spec/6-brand.md 경합 없음 — 확인 완료
  - target 위치: target plan frontmatter `worktree: brand-refresh-7a3f12`
  - 관련 plan: `bg-monitoring-api-7c2a91` worktree 의 `plan/in-progress/` (background-monitoring-api.md 는 해당 worktree 의 `plan/complete/` 에 있음)
  - 상세: 현재 활성 worktree 는 `brand-refresh-7a3f12` 와 `bg-monitoring-api-7c2a91` 두 개다. `bg-monitoring-api-7c2a91` 는 `spec/6-brand.md` 를 전혀 건드리지 않으며(git diff 확인), 브랜드/로고 관련 plan 도 보유하지 않는다. worktree 충돌 없음.

---

## 요약

target plan `spec-draft-brand-refresh.md` 는 `spec/6-brand.md` §8 임시 가이드를 정식 Visual Identity spec 으로 대체하는 단독 draft 로, 다른 in-progress plan 과의 직접 충돌(미해결 결정 우회, 동일 파일 동시 수정)은 발견되지 않았다. 다만 두 가지 후속 항목 누락이 WARNING 으로 식별된다. 첫째, `spec/2-navigation/_layout.md` §2.1 이 §8.4.6 에서 정식화된 사이드바 expanded/collapsed 로고 변종 규칙을 담고 있지 않아, spec 반영 후 두 문서가 불일치 상태로 남는다. 둘째, CSS 토큰 이름이 "구현 시 결정" 으로 위임된 채 Stage 2 plan 이 미생성 상태이므로, plan complete 이동과 Stage 2 plan 생성이 원자적으로 묶이지 않으면 추적 공백이 생긴다. 두 WARNING 모두 target plan 의 "다음 액션" 또는 plan 라이프사이클 처리 순서를 보완하면 해소 가능하며, spec 반영 자체를 차단할 CRITICAL 사안은 없다.

---

## 위험도

LOW
