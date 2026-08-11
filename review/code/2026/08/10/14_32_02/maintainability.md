# 유지보수성(Maintainability) Review

## 조사 범위 메모

프롬프트에 파일 84개가 나열되어 있으나, 실질 코드/문서 변경은 앞의 8개
(`.claude/commands/ai-review.md`, `.claude/skills/code-review-agents/README.md`,
`.claude/skills/code-review-agents/SKILL.md`,
`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`,
`.claude/tests/README.md`, `.claude/tests/test_line_anchors.py`,
`.claude/tests/test_review_prepare_single_session.py`,
`plan/in-progress/harness-review-gate-followups.md`)뿐이다. 나머지 76개
(`review/code/**`, `review/consistency/**`)는 과거 리뷰/일관성 세션이 생성한 결과물
(markdown/json, 전부 순수 신규 추가)을 커밋으로 회수한 것으로, 자동 생성 리포트라
가독성·네이밍·함수 길이 등 유지보수성 판정 대상이 아니다(직전 라운드
`review/code/2026/08/10/14_09_31/maintainability.md` 도 동일 결론).

## 직전 라운드 WARNING 해소 여부 확인 (요청 사항)

직전 라운드(`review/code/2026/08/10/14_09_31/maintainability.md`)가 잡은 WARNING
두 건을 원본 소스를 직접 열어 재검증했다.

1. **ALL_AGENTS 손 나열** — 완전히 해소 확인.
   - `.claude/tests/test_review_prepare_single_session.py:185`
     (`class ForcedSetShrinksWithTheChangesetTest._forced()`)가 이제
     `orch.compute_forced_agents(ARG["paths"], orch.ALL_AGENTS, ARG["root"])` 로
     오케스트레이터 소유의 `ALL_AGENTS`(`.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:102-107`)를
     직접 참조한다. `grep -n "ALL = \[" .claude/tests/test_review_prepare_single_session.py`
     결과 0건 — 손으로 나열한 클래스 상수 `ALL`은 완전히 제거됐다.
2. **"20개까지 보여주고 나머지는 개수로" 블록 중복** — 완전히 해소 확인.
   - `code_review_orchestrator.py:1326-1339`에 `_bulleted_path_sample(paths, limit=_ROUTER_PATH_SAMPLE_MAX)`
     헬퍼가 신설되어 매직넘버 `20`(`_ROUTER_PATH_SAMPLE_MAX`)을 단일 정의로 뽑았고,
     `build_router_prompt_body` 내부 두 호출부(`:922`의 `src_paths`용, `:937`의
     신규 `unseen`용)가 모두 이 헬퍼를 호출한다. 손으로 다시 작성한 `shown`/`more`
     쌍은 두 곳 모두에서 사라졌다.

두 항목 다 근본 원인(손으로 유지하는 목록/포맷이 SoT와 갈라짐)을 구조적으로 제거한
형태이며 재발 여지가 낮다.

## 같은 클래스의 중복 전수 재확인

리뷰 대상 8개 파일 전체에서 (a) 후보/에이전트 이름을 손으로 나열하는 패턴, (b) "N개
보여주고 나머지는 개수로" 트렁케이션 포맷 패턴을 다시 훑었다.

- 에이전트 이름 나열(`"security", "performance", "architecture", ...` 형태)은
  `code_review_orchestrator.py:102-107`의 `ALL_AGENTS` 정의 한 곳에만 존재한다
  (`grep -rn '"security".*"performance".*"architecture"'`로 8개 파일 전수 확인, 매치
  1건). README.md/SKILL.md의 14-reviewer 표는 이번 diff로 건드리지 않은 기존 문서라
  범위 밖이다.
- "N개 보여주고 나머지는 개수로"류 트렁케이션은 같은 파일 안에 세 변형이 공존한다:
  신규 `_bulleted_path_sample`(고정 20개, `:1326-1339`), 그리고 이번 diff로 손대지
  않은 기존 `warn_if_committed_work_is_missing`(고정 10개, `:1404-1407`)과
  `_aggregate_omission_note`(바이트 예산 기반, `:1415-1449`)다. 직전 라운드가 이미
  이 세 번째 변형의 존재를 INFO로 지적했고("규칙이 서로 달라 통합 난이도가 높으므로
  우선순위 낮음"), 이번 diff는 그 두 기존 함수를 건드리지 않았다. 즉 이번 fix가
  새로 만든 두 인스턴스(920대·937대 줄)의 중복은 없앴고, 남은 두 개는 규칙(고정 개수
  vs 바이트 예산)이 달라 기계적 통합이 아니라 설계 판단이 필요한 사안이라 이번 diff
  범위에서 처리 안 한 것이 합리적이다. 새로운 회귀는 아니다.

## 발견사항

- **[INFO]** (직전 라운드에서 이미 지적, 여전히 미해소 — 우선순위 낮음) 신규
  `_warn_large_changeset`의 안내 문구가 영어 ASCII 배너를 쓰고, 같은 성격의 기존
  `warn_if_committed_work_is_missing`은 한국어 + 이모지를 쓴다.
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py`
    `_warn_large_changeset` 함수 (`print(f"!! LARGE CHANGESET — ...")` 블록) vs
    `warn_if_committed_work_is_missing` 함수 (`print(f"\n⚠️  이 브랜치는 ...")` 블록)
  - 상세: 두 함수 모두 "changeset 계산에 놓친 부분이 있을 수 있으니 호출 세션이 넓게
    판단하라"는 동일 성격의 stderr advisory인데 톤·언어가 갈린다. 기능적 결함은
    아니고 직전 라운드가 "급하지 않음"으로 분류한 그대로다.
  - 제안: 다음에 이 함수를 만질 기회에 한국어 톤으로 맞추면 일관성이 개선된다.
    지금 fix에서 필수 대응 사항은 아니다.

새로 도입된 결함은 발견되지 않았다.

## 요약

직전 라운드가 WARNING으로 잡은 두 건 — 테스트가 오케스트레이터 소유 `ALL_AGENTS`를
손으로 재나열한 것, "20개+나머지 개수" 포맷 블록이 두 번째로 복제된 것 — 은 각각
`orch.ALL_AGENTS` 직접 참조와 공용 헬퍼 `_bulleted_path_sample` 추출로 근본적으로
해소됐음을 소스를 직접 열어 확인했다. 같은 클래스의 중복이 이번 diff의 8개 파일에 더
없는지 전수로 훑었으나 추가 인스턴스는 발견되지 않았다 — 유일하게 남은 유사 패턴은
이번 diff가 건드리지 않은 기존 함수 두 개(`warn_if_committed_work_is_missing`,
`_aggregate_omission_note`)로, 트렁케이션 규칙 자체가 달라(고정 개수 vs 바이트 예산)
직전 라운드가 이미 "통합 난이도 높음, 낮은 우선순위"로 정리해 둔 사안이며 이번 fix의
회귀는 아니다. `main()`의 배치 분할 루프 제거는 오히려 순환 복잡도를 낮췄고, 신규
헬퍼(`_warn_large_changeset`, `_source_files_missing_from_changeset`,
`_bulleted_path_sample`)는 모두 단일 책임·짧은 길이·명확한 이름을 갖는다. 남은 것은
직전 라운드부터 이어지는 낮은 우선순위 INFO(안내 메시지 언어 톤 불일치) 하나뿐이다.

## 위험도

LOW
