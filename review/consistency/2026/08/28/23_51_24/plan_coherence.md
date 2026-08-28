STATUS=success plan_coherence review complete — Critical 0 · Warning 0 · Info 1
===REPORT_MARKDOWN_BELOW===
# Plan 정합성 검토 — eslint10-unblock-watch (target: spec/5-system/, diff-base=origin/main)

## 조사 범위

- target 은 `spec/5-system/` 전체 번들이지만, `origin/main` 대비 실제 diff 는 `spec/**` 에 0줄이고
  전부 코드다: `codebase/frontend/eslint.config.mjs` 주석 갱신 + 신규 파일
  `codebase/frontend/src/lib/repo-guards/__tests__/eslint10-unblock-guard.ts` /
  `eslint10-unblock.test.ts` (eslint 9→10 상향을 막는 "우리 트리 차단자 4개" 를 lockfile 에서
  읽어 배제 여부를 캐너리로 감시).
- 직접 관련 plan: `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 (eslint 9→10 상향, P3).
- 교차 확인: `backend-lint-gate-broken-on-main.md`(prettier 드리프트, 무관) ·
  `deps-guard-hardening.md`(overrides 하한 침식 감시, 무관) — 둘 다 이 diff 의 대상(react-hooks
  peer 배제)과 겹치지 않는다.

## 발견사항

- **[INFO]** §2 체크리스트 상단 요약이 "차단자 3개" 서술을 그대로 두고 있다
  - target 위치: (코드) `codebase/frontend/eslint.config.mjs` 헤더 주석 — "우리 트리의 차단자는
    넷이다" 로 이미 정정됨; `.../eslint10-unblock-guard.ts` 의 `BLOCKERS` 도 4개로 정의됨
  - 관련 plan: `plan/in-progress/deps-peer-gating-and-eslint10.md` — 체크리스트 `- [x] §2 eslint 10
    상향 — 11개 중 9개 완료(...)` 항목(§2 본문의 "실행 결과" 표 바로 아래, `### ⚠️ 정정
    (2026-08-28 후속 턴)` 절 이전에 위치)
  - 상세: 같은 plan 문서 안에서 §2 본문은 이미 "차단자는 셋이 아니라 넷" 이라는 정정 절과, 그
    정정을 반영한 체크리스트 하위 항목("차단자 4개의 peer range 를 lockfile 에서 읽어…")을
    모두 갖고 있다. 다만 그보다 앞선 체크리스트 요약 한 줄("`eslint-config-next` 의
    react/jsx-a11y/import 플러그인이 latest 조차 eslint 9 상한이다")은 정정 이전 표현 그대로
    남아 `eslint-plugin-react-hooks`(4번째 차단자, `pnpm-workspace.yaml` 의 7.0.1 exact 핀)를
    언급하지 않는다. target(코드)과 실질적으로 충돌하지는 않는다 — 코드·plan 본문·다른 체크리스트
    항목이 이미 4개로 일치하고, 이 요약 줄만 미러가 뒤처져 있다. 다음에 이 plan 을 다시 여는
    사람이 "차단자 3개" 요약만 보고 4번째(react-hooks 핀)를 놓칠 위험이 있다.
  - 제안: plan 쪽 그 한 줄에 "(및 `eslint-plugin-react-hooks` — 아래 §정정 참조)" 정도의
    포인터를 추가해 두 체크리스트 미러를 동기화. target 변경은 불필요.

## 검토했으나 문제 없음으로 판단한 항목

- **미해결 결정과의 충돌**: `deps-peer-gating-and-eslint10.md` §3 (frozen 게이트 사각지대,
  (a)/(c) 택일 미결)은 이 diff 의 범위(react-hooks 핀·캐너리 테스트)와 무관한 별개 결정 지점이라
  이 diff 가 그것을 우회하거나 선점하지 않는다.
- **선행 plan 미해소**: 이 diff 가 전제하는 사실("우리 트리는 `eslint-plugin-react-hooks: 7.0.1`
  exact 핀 때문에 registry latest(7.1.1)와 달리 여전히 eslint 10 을 배제한다")은 plan §2 의
  `### ⚠️ 정정 (2026-08-28 후속 턴)` 절에 동일한 lockfile 실측으로 이미 기록돼 있다 — diff 는 그
  기록을 코드(주석 갱신 + 신규 캐너리 가드)로 집행한 것이지 새로운 미해결 전제를 만들지 않는다.
  핀 자체를 올리는 것은 diff 범위 밖으로 명시적으로 남겨져 있고("그 핀에는 근거 주석이 없다 —
  올리기 전에 왜 exact 였는지부터 확인할 것"), 이를 뒷받침하거나 반박하는 별도 plan 항목은
  없어 새 선행조건 미해소가 아니다.
  - 참고로 plan frontmatter 의 `worktree: spec-small-followups` 는 실제 세션
    worktree(`eslint10-upgrade-5e3cf9`)/branch(`claude/eslint10-unblock-watch`)와 다르지만, 이는
    "다른 worktree 와의 동시 작업 충돌" 판정에 속하는 문제라 본 검토(plan_coherence)의 범위
    밖으로 명시적으로 제외돼 있어 보고하지 않는다.
- **후속 항목 누락**: `deps-guard-hardening.md`(오버라이드 하한 침식 감시)는 CVE 패치 하한 대조가
  목적이라 이번 diff 의 "major 상한 배제" 성격과 축이 달라 새 후속 항목을 만들 필요가 없다.
  `backend-lint-gate-broken-on-main.md`(prettier 드리프트)도 이미 별도 PR 로 해소돼 이 diff 와
  교차하지 않는다. `deps-peer-gating-and-eslint10.md` 자체는 §2 항목을 diff 와 같은 턴에
  갱신했고(정정 절 + 캐너리 가드 완료 기록), 이 diff 가 무효화하거나 새로 만들어야 할 다른 plan 의
  후속 항목은 확인되지 않았다.

## 요약

이번 diff(`codebase/frontend/eslint.config.mjs` 주석 정밀화 + `eslint10-unblock-guard.ts`/
`eslint10-unblock.test.ts` 신설)는 `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 가 같은
날 기록해 둔 "차단자는 셋이 아니라 넷" 정정을 그대로 코드에 집행한 것으로, plan 의 미해결 결정을
우회하거나 다른 plan 의 선행조건·후속 항목과 충돌하지 않는다. 유일한 흠은 같은 plan 문서 내
체크리스트 요약 한 줄이 정정 이전 표현("3개 플러그인")을 그대로 남겨 둔 사소한 미러 지연으로,
target 이 아니라 plan 쪽의 경미한 갱신 권고 사항이다.

## 위험도
LOW
