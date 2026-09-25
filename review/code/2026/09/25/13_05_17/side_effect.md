# 부작용(Side Effect) 리뷰 — changelog-criteria

## 발견사항

- **[INFO]** `documentation` 리뷰어 "관점 6" 문구가 두 독립 경로(SSOT + 렌더링)에 수동 이중 유지되는 패턴을 이 PR 이 그대로 이어감
  - 위치: `.claude/skills/code-review-agents/lib/role_instructions.py:141` (`REVIEWER_INSTRUCTIONS["documentation"]["checklist"]` 항목 6), `.claude/agents/documentation-reviewer.md:21`
  - 상세: `role_instructions.py:141`은 orchestrator 가 `_prompts/<role>.md` 를 만들 때 읽는 SSOT 이고(`code_review_orchestrator.py`가 `REVIEWER_INSTRUCTIONS`를 import해 checklist 를 프롬프트 본문에 주입), `.claude/agents/documentation-reviewer.md`는 direct/fallback `Agent` 호출(예: `code-review-agents` SKILL 의 "평문 Agent fan-out 경로") 때 Claude Code 가 로드하는 system prompt다. 즉 같은 "관점 6" 문구가 **서로 다른 두 호출 경로**에서 각각 읽힌다. 실측 결과 이번 diff는 두 파일을 byte 단위로 동일하게 갱신했고(`sed -n '141p' role_instructions.py` == `sed -n '21p' documentation-reviewer.md`), 사전 실행된 `naming_collision` consistency-check(`review/consistency/2026/09/25/12_52_34/naming_collision.md` WARNING)이 지적한 "한쪽만 갱신" 문제는 최종 diff에서 이미 해소됐다. 다만 `test_agent_consistency.py`는 registry-level(키↔파일 존재) 만 가드하고 "Prose checklist wording is deliberately left unguarded"라고 docstring에 명시돼 있어, **다음에 이 checklist를 고치는 사람이 한쪽만 편집해도 어떤 테스트도 잡지 못한다** — Workflow 경로와 fallback Agent 경로가 같은 리뷰어 역할에 대해 조용히 다른 기준을 참조하게 되는 side effect가 재발 가능하다. 이 PR이 만든 결함은 아니고 이번 편집 자체는 정확했지만, 두 곳을 "같은 문구로" 유지하라는 처방(plan `changelog-criteria.md` §B 4행)이 자동 검증 없이 사람 손에 의존하는 구조를 그대로 남긴다.
  - 제안: 조치 불필요(이번 PR 범위에서 결함 없음). 후속으로 `role_instructions.py`의 `documentation.checklist`를 SSOT로 두고 `.claude/agents/documentation-reviewer.md`의 해당 항목을 생성/검증하는 스크립트(다른 analyzer군이 이미 쓰는 "regenerator script" 패턴)로 옮기거나, `test_agent_consistency.py`에 이 특정 항목만이라도 byte-diff 가드를 추가하는 것을 고려할 수 있음 — 지금 당장 블로킹할 사안은 아님.

## 요약

이번 변경 셋(`documentation-reviewer.md`·`role_instructions.py`의 checklist 문구 교체, `CHANGELOG.md` 상단 기준 블록 신설 + 헤딩 접두 보정 + 백필 항목 1건, 신규 plan 파일, 트래커 체크박스·항목 추가, 그리고 `review/consistency/2026/09/25/12_52_34/**` 리뷰 산출물 커밋)는 실행 코드 로직·함수 시그니처·전역 상태·환경 변수·네트워크 호출·이벤트/콜백을 전혀 건드리지 않는 문서·설정·plan 전용 편집이다. `role_instructions.py` 변경은 dict 리터럴의 문자열 값 하나만 바꾸는 것이라 `python3 -m pytest .claude/tests/test_agent_consistency.py`(6 passed, 58 subtests)로도 회귀가 없음을 확인했고, `CHANGELOG.md`의 헤딩 표기 변경(`## 부수` → `## Unreleased — (부수)`)을 파싱하는 툴링도 저장소 안에 존재하지 않아(grep 0건) 기계적 부작용도 없다. 유일하게 주목할 지점은 documentation 리뷰어 checklist 문구가 SSOT(`role_instructions.py`)와 렌더링(`.claude/agents/documentation-reviewer.md`) 두 경로에 수동으로 이중 유지된다는 구조적 사실이며, 이번 PR은 그것을 정확히 동기화했지만(사전 consistency-check WARNING이 지적한 문제는 최종 diff에서 해소됨) 자동 가드가 없는 상태 자체는 남아 있어 INFO로 기록한다.

## 위험도
NONE
