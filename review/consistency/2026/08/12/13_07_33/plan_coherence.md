# Plan 정합성 검토 — spec/data-flow/ (impl-done, diff-base=origin/main)

## 검토 대상 요약

diff 는 `codebase/backend` 의 backend lint warning 46건 처분(타입 주석/제네릭/단언만,
런타임 미접촉)과 `package.json`/`README.md` 의 `--max-warnings 0` 게이트 도입이다.
`plan/in-progress/backend-lint-gate-broken-on-main.md` 가 이 작업을 처음부터 끝까지
추적해 온 plan 문서이며, 실제로 **그 plan 문서 자신도 이 브랜치에서 함께 갱신**돼
있다(`git diff origin/main...HEAD -- plan/in-progress/backend-lint-gate-broken-on-main.md`
로 확인 — §잔여/§후속 절에 "처분 완료 (2026-08-12)"·비교표·근거가 새로 추가됨).

## 발견사항

- **[INFO]** plan frontmatter `worktree:` 가 실제 작업 worktree 와 어긋난다
  - target 위치: (target diff 자체엔 없음 — diff 스코프가 `codebase/**` 라 plan frontmatter
    는 애초에 diff 대상이 아님)
  - 관련 plan: `plan/in-progress/backend-lint-gate-broken-on-main.md` frontmatter
    `worktree: backend-lint-gate-b72fdd`
  - 상세: 이 plan 문서의 "잔여 warning 처분" 절(§잔여·§후속)이 **이번 브랜치**
    (`claude/lint-warning-triage`, worktree 디렉토리 `lint-warning-triage`)에서
    체크박스 `[x]` 로 완결되고 상세 근거가 새로 추가됐다. 그런데 frontmatter 의
    `worktree:` 는 이 plan 이 원래 착수됐던 `backend-lint-gate-b72fdd` 그대로다
    (`git worktree list` 로 그 worktree 가 여전히 존재하며 branch
    `claude/backend-lint-gate-b72fdd` 에 남아 있음을 확인). `.claude/docs/plan-lifecycle.md`
    §3 "연결 판정" 은 `worktree:` 값이 현재 worktree 디렉토리(또는 `claude/` 뗀 branch
    이름)와 일치해야 그 plan 이 push-gate 의 "연결된 plan" 으로 잡힌다고 규정한다.
    지금 값으로는 `lint-warning-triage` 와 매칭되지 않아 이번 작업은 gate 상
    "연결된 plan 없는 ad-hoc" 로 자연 escape 된다 — 차단되진 않지만, 이 plan 이
    사실상 이 브랜치의 산출물인데도 plan↔worktree 귀속이 기록에 남지 않는다.
    같은 번들 안의 `deps-peer-gating-and-eslint10.md` 가 정확히 같은 상황(plan 이
    새 worktree 에서 계속됨)을 `worktree:` 갱신 + 근거 메모로 처리한 선례가 있어,
    이 누락이 의도적 판단이 아니라 단순 누락으로 보인다.
  - 제안: `plan/in-progress/backend-lint-gate-broken-on-main.md` frontmatter 의
    `worktree:` 를 `lint-warning-triage` 로 갱신(+ 필요하면 한 줄 메모로 "잔여
    warning 처분은 이 worktree 에서 이어졌다" 명시). 차단성 이슈는 아니므로 급하지
    않다.

## 그 외 확인한 정합성 포인트 (문제 없음 — 참고용)

- 미해결 결정과의 충돌 없음: 같은 plan 의 "`--max-warnings 0` 도입 여부가 선행 결정"
  이라던 대목이 "**결정 (2026-08-12): 도입한다**" 로 이미 해소돼 있고, diff 의
  `package.json`/`README.md` 변경이 정확히 그 결정을 집행한다.
- `idempotency.interceptor.ts`/`.spec.ts` 의 diff 는 `statusCode >= 400` 조건(Spec EIA
  §R8 대비 과도하게 넓은 캐시 제외 — 선재 결함)을 **그대로 유지**하고, 새로 추가된
  409 캐너리 테스트와 코드 주석이 명시적으로
  `plan/in-progress/backend-lint-gate-broken-on-main.md §후속` 을 백로그로 지목한다.
  plan 의 "이 PR(타입 전용)에서는 런타임을 건드리지 않는다" 는 서술과 diff 가 정확히
  일치한다 — 미해결 결정을 우회하지 않았다.
- `render-tool-provider.ts`/`ai-agent.schema.ts` 의 `unknown` 원소 타입 명시는
  `render_*` 프레젠테이션 도구 전용이며, `plan/in-progress/ai-agent-tool-connection-rewrite.md`
  (§1 "도구 등록 모델" 미결정)가 다루는 `tool_*` 일반 도구 연결 재설계와는 그 plan
  문서 자신이 명시한 대로 직교(prefix·의도·schema 출처 모두 다름) — 미결정 항목을
  건드리지 않는다.
- `deps-peer-gating-and-eslint10.md` (eslint 9→10 상향, P3, 미착수)와도 충돌 없음 —
  이번 diff 는 eslint 버전이 아니라 `--max-warnings` 플래그만 추가한다.
- `migrate-node-output-refs.ts`/`.spec.ts` 의 타입 주석 + 신규 Pass 2 테스트는 스크립트
  콜백 인자 타입 좁히기일 뿐이며, 관련 plan 의 후속 항목을 무효화하지 않는다.

## 요약

diff 를 지배하는 plan 문서(`backend-lint-gate-broken-on-main.md`)가 이 작업의 배경·결정
근거·스코프 경계(타입 전용, 런타임 미접촉)·유예 항목을 매우 상세히 선행 기록해 뒀고,
코드 diff 는 그 기록과 정확히 일치한다(선재 결함 유지·캐너리 추가·`--max-warnings 0`
결정 집행 등). 미해결 결정을 우회하거나 다른 plan 의 후속 항목을 무효화한 사례는
발견되지 않았다. 유일한 발견은 plan frontmatter `worktree:` 가 이번 작업 worktree
(`lint-warning-triage`)로 갱신되지 않은 것으로, gate 를 막지는 않지만 plan↔worktree
귀속 기록의 정확성을 위해 갱신을 권장한다.

## 위험도

LOW
