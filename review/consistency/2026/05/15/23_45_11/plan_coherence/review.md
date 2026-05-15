# Plan 정합성 검토 — spec-draft-brand-rollback.md

검토 대상: `plan/in-progress/spec-draft-brand-rollback.md`
검토 모드: `--spec`
검토 시점: 2026-05-15

---

## 발견사항

### 1. 미해결 결정과의 관계 — 옵션 A 채택 명시, 정합 확인

- **[INFO]** `spec-update-brand-followup.md` P-4 는 옵션 A/B/C 중 결정을 project-planner 에 위임한 상태로 열려있었다. target draft 는 사용자 결정 (*"스펙도 당연히 롤백해야지"*) 을 근거로 옵션 A 를 명시 채택했다.
  - target 위치: draft 도입부 ("사용자 결정(2026-05-15 대화) 으로 옵션 A 채택")
  - 관련 plan: `plan/in-progress/spec-update-brand-followup.md` §P-4 선택지
  - 상세: P-4 는 developer 추천을 "B 또는 C" 로 제시하며 project-planner 결정을 기다리는 구조였다. target 은 사용자 직접 발언을 근거로 옵션 A 를 채택했으므로, 미해결 결정을 **우회**한 것이 아니라 사용자 결정으로 **해소**한 것이다. 충돌이 아닌 정상적 의사결정 경로.
  - 제안: `spec-update-brand-followup.md` 의 P-4 를 "사용자 결정 — 옵션 A 채택, 본 draft 로 처리 중" 으로 상태 갱신하면 추적이 명확해진다. (이미 target plan 의 "plan 정리 사항" 절에 P-1/P-3/P-4/P-5 close 경로가 명시되어 있어 사실상 반영 예정.)

---

### 2. worktree 단일 점유 확인 — 충돌 없음

- **[INFO]** target draft (`spec-draft-brand-rollback.md`) 와 `brand-refresh-impl.md` 는 모두 `worktree: brand-refresh-7a3f12` 로 동일 worktree 에 귀속된다. 동시 수정 대상 파일(`spec/6-brand.md`, `spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md`) 을 두 별개 worktree 가 동시에 손대는 상황이 아니다.
  - 관련 plan: `plan/in-progress/brand-refresh-impl.md` frontmatter `worktree: brand-refresh-7a3f12`
  - 상세: CLAUDE.md 의 "공유 자원 직렬화" 규칙(동일 spec 파일을 두 worktree 가 동시 수정 시 직렬화)은 해당 없음.
  - 제안: 현행 유지.

---

### 3. `brand-refresh-impl.md` 와의 선행 조건 관계

- **[INFO]** `brand-refresh-impl.md` §2 는 CSS 토큰 매핑 계획이 롤백으로 무효화됨을 명시하고, spec 정합성을 위해 `spec-update-brand-followup.md` P-4 를 project-planner 에 위임한다고 기록했다. target draft 가 바로 그 위임을 이행하는 문서이므로 선행 조건이 충족된 상태다.
  - 관련 plan: `plan/in-progress/brand-refresh-impl.md` §2 "테마 롤백" 절
  - 상세: 충돌 없음. 순서 연계가 명확히 기록되어 있다.
  - 제안: 현행 유지.

---

### 4. `brand-refresh-impl.md` 후속 항목과의 중복 또는 누락

- **[WARNING]** `brand-refresh-impl.md` §4.2 인증 화면 항목에는 "배경을 현재 그라데이션 → `bg-[hsl(var(--background))]` 단색으로 교체"(Vine dark-bg-base 자동 매핑) 로 체크완료 처리되어 있다. 그런데 target draft 의 `10-auth-flow.md §1` 동반 동기화는 배경을 *"제품 브랜드 색상 또는 그래디언트"* 로 복원한다고 기술한다. 즉, `brand-refresh-impl.md` 에 기록된 코드 상태(단색 `bg-[hsl(var(--background))]`)와 target draft 가 spec 에 쓰는 표현("또는 그래디언트") 이 미세하게 다르다.
  - target 위치: "동반 동기화 — `spec/2-navigation/10-auth-flow.md` §1" 제안 블록
  - 관련 plan: `plan/in-progress/brand-refresh-impl.md` §4.2 (체크 완료)
  - 상세: `brand-refresh-impl.md` §4.2 의 코드 체크 항목에는 "(auth)/layout.tsx 배경을 그라데이션 → 단색으로 교체" 가 완료 처리되어 있다. 그러나 같은 plan 의 §2 "테마 롤백" 절에 "auth/layout.tsx 배경도 `bg-gradient-to-br ...` 로 복원"이라 기록되어 있어, 최종 코드 상태는 다시 그라데이션으로 돌아온 것이다. R-13 의 부연("코드 상태: `bg-gradient-to-br ...` 패턴") 과도 일치한다. 따라서 target draft 의 *"또는 그래디언트"* 표현은 실제 코드 상태를 반영한 것이 맞다. 다만 `brand-refresh-impl.md` §4.2 의 체크 항목이 롤백 후 상태를 반영하지 않고 "단색 교체 완료" 로 남아 있어 오독을 유발할 수 있다.
  - 제안: `brand-refresh-impl.md` §4.2 의 해당 체크 항목에 롤백 사실 주석("→ 이후 롤백으로 다시 그라데이션 복원, spec 동기화는 spec-draft-brand-rollback.md 에서 처리")을 추가해 plan 기록을 정확히 유지할 것을 권장한다. plan 내부 inconsistency 이므로 spec 반영을 차단할 이유는 없다.

---

### 5. `spec-update-brand-followup.md` P-3 과 target draft 내용 비교

- **[INFO]** `spec-update-brand-followup.md` P-3 의 제안 표현은 *"배경: 제품 브랜드 색상 또는 그래디언트 (frontend 는 `bg-gradient-to-br ... --background → --muted → --background` 패턴 적용)"* 이고, target draft 의 제안 표현은 *"배경: 제품 브랜드 색상 또는 그래디언트"* 로 frontend 패턴 상세를 생략했다.
  - target 위치: "동반 동기화 — `spec/2-navigation/10-auth-flow.md` §1" 제안 블록
  - 관련 plan: `plan/in-progress/spec-update-brand-followup.md` §P-3
  - 상세: 내용의 방향은 일치. target draft 가 구현 상세(Tailwind 클래스 문자열)를 spec 에 박지 않는 쪽을 선택한 것은 spec 의 추상화 수준으로 적절하다. R-1 의 코드 상태 주석으로 실제 패턴을 보존한다.
  - 제안: 현행 유지.

---

### 6. `ai-review-subagent.md` worktree 와의 관계

- **[INFO]** `plan/in-progress/ai-review-subagent.md` 는 `worktree: ai-review-subagent-b7c8d9` 에 귀속된다. 해당 plan 은 `.claude/agents/`, `CLAUDE.md`, 각 SKILL.md 등을 손대는 작업이며 `spec/` 파일과의 직접 겹침은 없다. target draft 의 spec 3종(`spec/6-brand.md`, `spec/2-navigation/_layout.md`, `spec/2-navigation/10-auth-flow.md`) 과 충돌 없음.
  - 관련 plan: `plan/in-progress/ai-review-subagent.md`
  - 제안: 현행 유지.

---

### 7. `spec-update-brand-followup.md` P-2 처리 방식

- **[WARNING]** target draft 의 "plan 정리 사항" 절은 P-2 를 "§8.2 컬러 토큰 폐기로 자연 close" 라고 명시한다. 그러나 `spec-update-brand-followup.md` P-2 는 `spec/0-overview.md §3.4` 상태 색상 매핑 갱신이며, §8.2 폐기로 "자연 close" 가 되는지는 `spec/0-overview.md §3.4` 의 현행 내용에 달려있다. P-2 가 실제로 close 가능한지 확인 없이 complete 처리하면 `spec/0-overview.md §3.4` 에 폐기된 토큰명이 잔존할 수 있다.
  - target 위치: "plan 정리 사항" 절 — "P-2 는 §8.2 컬러 토큰 폐기로 자연 close"
  - 관련 plan: `plan/in-progress/spec-update-brand-followup.md` §P-2
  - 상세: `spec/0-overview.md §3.4` 가 Vine 토큰명을 직접 인용하고 있다면 별도 정리가 필요하다. 이를 확인하지 않고 P-2 를 close 처리하면 후속 문서에 낡은 토큰명이 남을 수 있다.
  - 제안: target draft 반영 전 또는 plan 정리 시 `spec/0-overview.md §3.4` 를 확인해 Vine 토큰명 인용이 있으면 P-2 를 별도 follow-up 으로 분리한다. 해당 내용이 없으면 자연 close 가 맞다. spec 반영을 차단할 CRITICAL 이슈는 아님.

---

### 8. 미체크 항목 (`[ ] 필수 consistency-check`)

- **[INFO]** target draft 의 검토 체크리스트 마지막 항목 `[ ] (필수) /consistency-check --spec ...` 은 현재 실행 중인 본 세션이 해당 항목을 이행하는 것이므로 정합 문제가 아니다. 세션 완료 후 체크 처리되어야 한다.
  - target 위치: "검토 체크리스트" 마지막 항목
  - 제안: 본 세션 결과 Critical 0 건 확인 후 체크 처리.

---

## 요약

`plan/in-progress/spec-draft-brand-rollback.md` 는 동일 worktree (`brand-refresh-7a3f12`) 에서 진행 중인 `brand-refresh-impl.md` 및 `spec-update-brand-followup.md` 와 방향이 완전히 정렬되어 있다. `spec-update-brand-followup.md` P-4 의 미해결 결정은 사용자 직접 발언으로 해소된 상태이며, 옵션 A 채택 근거가 draft 에 명확히 기록되어 있다. 다른 worktree (`ai-review-subagent-b7c8d9`) 와 손대는 파일 영역이 겹치지 않아 worktree 충돌도 없다. 주요 주의 사항은 두 가지다: (1) `brand-refresh-impl.md` §4.2 의 인증 화면 체크 항목이 롤백 후 실제 코드 상태를 반영하지 않고 있어 오독 여지가 있으나 spec 반영을 차단할 수준은 아니며, (2) P-2 ("spec/0-overview.md §3.4")를 자연 close 처리하기 전 해당 파일의 Vine 토큰명 잔존 여부를 확인하는 것이 권장된다. 두 건 모두 WARNING 수준으로, 이 draft 의 spec 반영을 막을 CRITICAL 이슈는 발견되지 않았다.

## 위험도

LOW
