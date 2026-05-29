---
worktree: harness-improve-b64468
started: 2026-05-29
owner: developer
---

# `.claude/` 하네스 개선

5개 서브시스템 감사(skills / agents / hooks+cmds / docs+PROJECT / native-fit) 결과를
종합한 개선 제안을 순차 구현. 제안 원문의 Top-5 + 테마6 quick-win 묶음을 본 PR 로,
고-churn·고위험 2건은 별 PR 로 분리.

핵심 진단: 이 하네스는 over-engineered 가 아니라 **손으로 동기화하는 지점이 너무
많은** 성숙 시스템. 레버리지는 "구조 변경" 이 아니라 "수작업 동기화를 테스트/SSOT 로
고정" 하는 데 있다.

## 완료 (본 PR)

- [x] **#4 `.claude/tests/` stdlib unittest 하네스** — pytest 미설치 + Python CI
  부재 + 훅 stdlib-only 철학에 맞춰 `unittest` 채택. `python3 -m unittest discover`.
  `harness-checks.yml` CI 추가. (commit `3da1c90`)
- [x] **#1/#3 agent registry drift 가드** — `role_instructions.py`(SSOT) ↔
  `.claude/agents/*.md` ↔ `.claude.project.json` ↔ README 표 일치 검증.
  **제안 정정**: "checklist verbatim 일치" 는 부정확 — `.md` 는 의도적으로 손질된
  human-facing 렌더링(예: cross-spec-checker.md 가 괄호주 생략, analyzer 가 git diff
  힌트 추가)이라 prose parity 강제는 false-positive. registry-level invariant 만 검증.
  (commit `3da1c90`)
- [x] **#2 design/output skill 6종 완전 uninstall** — 사용자 결정(완전 uninstall).
  외부 `Leonxlnx/taste-skill` import orphan, `skills-lock.json` 에서 제거 + 디렉토리
  삭제. `.claude/OPTIONAL_SKILLS.md` 에 source·재설치 절차 기록. (commit `626a39d`)
- [x] **테마1(축소) matrix-reference 가드** — 아래 "별 PR 분리" 참고. 매트릭스가
  참조하는 `*.test.ts`/`spec/...md` 실존 검증만 본 PR. (commit `0f5790f`)
- [x] **테마6 문서 quick-win** — docs/README 인덱스, agent 레지스트리(+stale "3-layer"
  → "4-layer" 수정), subagent-call-contract §3.1 extension 카탈로그,
  spec-coverage README 신설, merge-coordinator Phase4 rollback. (commit `830c7f9`)

## 재검토 후 미진행 — 제안과 다른 결정

- [x] **#5 summary agent 3종 통합 → 반려(미진행 결정 확정).**
  제안은 "거의 동일하니 `summary-aggregator` 로 통합" 이었으나, 코드 확인 결과
  **거의 동일이 아님**: 공통 boilerplate(호출 규약·STATUS)는 이미
  `subagent-call-contract.md` 로 위임돼 있고, 남은 본문은 실질적으로 다르다 —
  `code-review-summary`(router skip-aware), `consistency-summary`(BLOCK:YES),
  `integration-risk-summary`(통합 순서 표 + branches/base). 파라미터 1개 agent 로
  합치면 분기 복잡도가 늘고 명확성이 **떨어진다**. 통합은 net-negative 라 반려.
  대신 `.claude/README.md` agent 레지스트리에 3종의 소속 흐름을 명시해 navigability
  만 보강(테마6 에 포함).

## 잔여 항목 추가 진행 (사용자 요청 — 본 PR 에 포함)

- [x] **테마1 full JSON-SSOT 추출** — `.claude/config/doc-sync-matrix.json` 19행 SSOT.
  매트릭스가 substantially semantic 이라 spine 만 추출 + 의미 행 `match:"semantic"`
  무손실 표기. PROJECT.md 표는 사람용 뷰로 유지, test 가 행수 1:1 + 참조 실존 binding.
  user-guide-sync-reviewer 를 JSON-first 로 갱신. (commit `8464703`)
- [x] **테마4-② 선행 groundwork** (live rewrite 는 분리 유지) —
  - orchestrator 상태기계 테스트 `test_orchestrator_state.py`(subprocess CLI 구동,
    13 케이스): bucket 전이 / rate-limit episode·reset-hint / routing 선별·forced /
    fallback / resume. 마이그레이션을 *대조할* 행위 스펙.
  - 설계 노트 `.claude/docs/orchestrator-workflow-migration.md`: 빌링 단일경로 gating
    질문 + 무손실/손실 매핑 + consistency-check 파일럿 경로 + 본 PR 비목표 명시.

## 테마4-② live 마이그레이션 (사용자 승인 후 본 PR 진행)

빌링 gate 해소 — 사용자 확인: **Workflow 는 `claude -p` 와 달리 플랜 토큰에 포함**되어
정책 부합. CLAUDE.md §외부 LLM 호출 정책에 명시.

- [x] **빌링 정책 갱신** — Workflow 를 plan-metered 허용 경로로 명시 (Agent tool 과 병기).
- [x] **consistency-check → Workflow 마이그레이션 + 라이브 스모크 검증** —
  `.claude/workflows/consistency-check.js` (parallel checkers → summary). orchestrator
  `--prepare` 는 유지(model-free), 수동 fan-out/STATUS/ScheduleWakeup 루프를 Workflow 가
  대체. 1 checker+summary 스모크로 end-to-end 확인(BLOCK:YES 정상 집계).
  - **발견(설계 노트 기록)**: Workflow sub-agent 의 report-file Write 는 차단됨
    (*"return findings as text"*). → checker 는 output_file Write(허용), **summary 는
    텍스트 반환 → main Claude 가 SUMMARY.md Write**. consistency-summary 에 `mode=workflow`
    분기 추가.
- [ ] **ai-review review-portion** (router+14 reviewer+summary) — 같은 패턴이라 적합하나
  더 큼 + 자체 스모크 필요. **resolution-applier(코드 수정·commit·e2e) 와 `/loop` 한도
  복구는 Workflow 부적합 → bespoke 유지.** 다음 격리 PR 권고.
- [ ] **merge-coordinate** — analyzer 는 적합하나 Phase2 confirm gate(AskUserQuestion)가
  background Workflow 에 부적합 → 대부분 main-driven 유지. 최저 우선순위.

> live rewrite 경계: Workflow 는 **fan-out + 집계 반환**에 적합. 코드 수정/commit/e2e
> (resolution-applier), 중간 사용자 confirm(merge), cross-turn 한도 복구(/loop)는
> bespoke 로 남긴다. 상세: [`.claude/docs/orchestrator-workflow-migration.md`](../../.claude/docs/orchestrator-workflow-migration.md).

## 검증

- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` — 45 tests OK.
- 변경 set 전부 `.claude/**`·`.github/**`·`*.md`·`skills-lock.json` → e2e 면제
  화이트리스트 부분집합 (PROJECT.md §e2e 면제 화이트리스트).
