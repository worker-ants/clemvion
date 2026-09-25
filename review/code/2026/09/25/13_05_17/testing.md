# 테스트(Testing) 리뷰

## 범위 확인

이번 changeset(13개 파일)은 전부 `.claude/agents/documentation-reviewer.md`,
`.claude/skills/code-review-agents/lib/role_instructions.py`(checklist 문구 1줄),
`CHANGELOG.md`(기준 산문 + 백필 표), `plan/in-progress/*.md` 2건, 그리고
`review/consistency/2026/09/25/12_52_34/**` (직전 라운드 산출물) 로 구성된다.
`codebase/**` 를 건드리는 파일이 **0건**이라 신규 실행 경로·분기·엣지 케이스가
생기지 않는다 — 관점 1~4, 8(테스트 존재·커버리지·엣지 케이스·Mock·테스트 용이성)은
해당 없음(N/A)이다. 이 리뷰는 harness-only 변경이라 push 게이트(`codebase/**`
스코프)가 물지 않으며, CLAUDE.md 가 적은 대로 검증은 `python3 -m pytest
.claude/tests -q` 가 대신한다.

## 회귀 확인 (실측)

- `.claude/tests/test_agent_consistency.py` 단독 실행: `6 passed, 58 subtests
  passed`.
- 전체 harness 스위트 `python3 -m pytest .claude/tests -q`: `1175 passed, 1
  warning, 1326 subtests passed`(1건 warning 은 `guard_default_branch_bash.py`
  의 기존 `DeprecationWarning`, 이번 diff 와 무관).
- `role_instructions.py:141` 과 `documentation-reviewer.md:21` 의 checklist
  항목 6 텍스트를 직접 grep 대조 — 현재 byte 단위로 동일함을 확인.

회귀는 없다. 이번 PR 은 두 파일에 같은 문구를 손으로 동시에 반영했고, 지금 시점
기준으로는 정확히 일치한다.

## 발견사항

- **[INFO]** 두 곳에 중복된 checklist 문구의 byte-parity 를 지켜주는 테스트가 없다
  - 위치: `.claude/tests/test_agent_consistency.py` (docstring, 12~19줄) / 변경 대상
    `.claude/skills/code-review-agents/lib/role_instructions.py:141`,
    `.claude/agents/documentation-reviewer.md:21`
  - 상세: `test_agent_consistency.py` 는 registry-level 불변식(키↔`.md` 존재,
    `.claude.project.json` 토글, README 표, frontmatter `name`)만 확인하고,
    docstring 에 명시적으로 "Prose checklist wording is deliberately left
    unguarded" 라고 적어 checklist 문구 자체의 동기화는 의도적으로 비검증
    상태다. 이번 PR 은 `role_instructions.py`(orchestrator 가 프롬프트에
    주입하는 SSOT)와 `documentation-reviewer.md`(Agent tool 이 로드하는
    system prompt)에 같은 문장("CHANGELOG 항목이 필요한 변경인지 — 기준은
    `CHANGELOG.md` 상단 «무엇이 항목을 만드는가»…")을 사람이 손으로 각각
    편집해 넣었다 — 실제로 지금은 일치하지만, 다음에 이 기준 문구가 다시
    바뀔 때(예: `CHANGELOG.md` 기준 블록 위치가 `spec/conventions/` 로 옮겨져
    문구가 갱신되는 경우) 한쪽만 고치고 다른 쪽을 놓쳐도 어떤 테스트도
    실패하지 않는다. 같은 위험을 이 PR 이 생성한 일관성 검토 산출물 자체도
    `naming_collision` WARNING #2(`review/consistency/2026/09/25/12_52_34/SUMMARY.md`)
    로 별도 지적했다 — 그 지적은 "target 의 서술 전제가 실측과 어긋난다"는
    각도였고, 이 발견은 "그 어긋남을 자동으로 잡아줄 회귀 테스트가 없다"는
    보완적 각도다.
  - 제안: 필수는 아니다(설계가 의도적으로 prose 를 unguard 하기로 한 결정이며,
    이번 PR 은 그 결정을 어기지 않았다). 다만 이런 reinforcement-duplication
    패턴이 반복될수록(문서 6번 항목처럼 "SSOT 갱신 시 렌더링도 동반 갱신"이
    필요한 문구가 늘수록) `test_agent_consistency.py` 에 "지정된 소수의
    고위험 문구만" byte-diff 로 고정하는 선택적 테스트(전체 checklist 는
    여전히 unguard) 를 추가하는 편이 향후 drift 조기 발견에 도움이 된다.

## 요약

이번 changeset 은 `codebase/**` 변경이 없는 harness/문서 전용 PR 이라 전통적
의미의 신규 테스트 필요성·커버리지 갭·mock 적절성·테스트 격리 항목은 대부분
해당 없음이다. 유일하게 테스트 관점에서 의미 있는 관찰은 두 파일(SSOT ↔
system-prompt 렌더링)에 손으로 동시 반영한 checklist 문구를 지켜주는 자동
회귀 테스트가 없다는 점인데, 이는 `test_agent_consistency.py` 가 이미 문서화한
의도적 설계 트레이드오프이고 이번 PR 이 그 트레이드오프를 위반하지도 않았다
(실측 결과 byte-parity 유지, 전체 하네스 테스트 1175건 통과). 회귀 위험은
낮다.

## 위험도

LOW
