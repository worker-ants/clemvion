# 문서화(Documentation) 리뷰 결과

## 발견사항

- **[WARNING]** 새 "위치 표기 규약"(line-anchor gutter)이 SSOT 원칙을 어기고 13개 파일에 손수 복제됨 — 공유 규약 문서(`subagent-call-contract.md`)는 갱신되지 않음
  - 위치: `.claude/docs/subagent-call-contract.md:3` (미변경 파일 — 해당 diff 없음), 대조 대상: `.claude/agents/api-contract-reviewer.md:29`-`31` 등 13개 reviewer 정의 동일 블록, `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py:435`-`454` (`LINE_ANCHOR_LEGEND`)
  - 상세: `subagent-call-contract.md` 3번째 줄은 "각 agent definition 은 본 doc 을 한 줄로 인용하고 자신은 perspective + checklist + 위험도 등급 정의만 남긴다" 고 스스로 규정한다. 그런데 이번 변경은 "발견사항의 `위치` 를 적을 때" 규약(3문장, 게이트 숫자 사용·조립 문서 줄 세지 말 것·지어내지 말 것)을 이 공유 문서에 추가하는 대신 13개 `*-reviewer.md` 에 바이트 단위로 동일하게 손수 복제했다. `code_review_orchestrator.py` 의 `LINE_ANCHOR_LEGEND` 상수(프롬프트에 동적으로 주입되는 더 긴 버전)까지 합치면 사실상 같은 규약이 **세 곳**(공유 계약 문서엔 부재, 13개 hand-copied 블록, 코드 상수)에 흩어져 있다. `test_line_anchors.py::ReviewerDefinitionContractTest.test_the_location_block_is_byte_identical_across_all_reviewers` 가 13개 블록 상호간 drift 는 잡아주지만, 그 블록과 `LINE_ANCHOR_LEGEND` 문구가 서로 달라지거나 `subagent-call-contract.md` 가 계속 이 규약을 모르는 상태로 남는 drift 는 어떤 테스트도 잡지 않는다.
  - 제안: `subagent-call-contract.md` 에 "위치 표기 규약" 섹션을 신설해 SSOT 로 삼고, 13개 reviewer 정의의 "- 위치:" 블록은 그 섹션을 가리키는 짧은 인용 한 줄로 축소한다 (다른 공통 규약들과 동일 패턴). 최소한 `subagent-call-contract.md` 에 한 줄이라도 "line-anchor gutter 관련 세부는 각 reviewer definition 참고" 식의 포인터를 남겨 완전히 침묵하지 않게 한다.

- **[INFO]** README.md / SKILL.md 는 게이트 기능 자체를 서술하지 않고 사이즈 상한 수치의 부수효과만 기록
  - 위치: `.claude/skills/code-review-agents/README.md:206`-`207`, `.claude/skills/code-review-agents/SKILL.md:188`-`189`
  - 상세: 이번 변경으로 reviewer 프롬프트의 모든 코드 블록에 실제 소스 줄번호 게이트가 붙는 것은 리뷰어 payload 형태를 바꾸는 실질적 신규 기능이다. 그러나 두 운영 문서 모두 `REVIEW_MAX_FILE_SIZE`/`REVIEW_MAX_PROMPT_SIZE` 표의 각주("라인번호 게이트 도입 전 51200 → 게이트 오버헤드(+8%) 만큼 상향")로만 이 기능의 존재를 암시한다. README 의 "산출물 디렉토리 구조"·"환경변수" 절 어디에도 "reviewer 발견사항의 `위치` 는 이제 게이트 숫자를 인용해야 한다" 는 서술이 없어, 이 각주를 읽지 않으면 기능 존재 자체를 알기 어렵다.
  - 제안: README.md 에 짧은 "## 위치 표기(라인 앵커)" 절을 추가해 `lib/line_anchors.py` 의 역할과 reviewer 출력 형식에 미치는 영향을 1-2문단으로 요약.

- **[INFO]** `.claude/tests/README.md` 의 "prose-checking 예외" 컨벤션 문구가 새 선례(`test_line_anchors.py`)를 예시로 포함하지 않음
  - 위치: `.claude/tests/README.md:57` (전체 파일 컨텍스트 기준, "Deliberate exception... `test_summary_agent_contract.py` pins the load-bearing phrases" 문단)
  - 상세: 신설된 `test_line_anchors.py` 의 `ReviewerDefinitionContractTest` 독스트링(전체 파일 컨텍스트 421-422줄)은 스스로 "`.claude/tests/README.md` 가 부여하고 `test_summary_agent_contract.py` 가 이미 의존하는 예외" 를 원용한다고 밝히는데, 정작 그 예외를 정의하는 `.claude/tests/README.md` §Conventions 문단은 `test_summary_agent_contract.py` 만 예시로 들고 있어 두 번째 선례가 문서에 반영되지 않았다. 규칙 자체는 일반적으로 서술돼 있어 적용에는 문제없으나, 향후 세 번째 사례가 추가될 때 "몇 건이나 이 예외를 쓰고 있는지" 추적이 어려워질 수 있다.
  - 제안: 해당 문단 끝에 "`test_line_anchors.py::ReviewerDefinitionContractTest` 도 같은 예외를 원용" 한 줄 추가.

## 요약

이번 변경은 문서화 관점에서 이례적으로 높은 완성도를 보인다 — 신규 모듈 `line_anchors.py` 는 실제 프로덕션 사고(2026-07-17 세션에서 7개 인용 줄번호가 전부 조립 문서 오프셋으로 판명된 사례)를 근거로 모듈·함수 독스트링을 작성했고, `code_review_orchestrator.py` 의 매직 넘버(`1.08` 배율)에는 실측 수치와 근거 커밋 해시까지 남겼으며, `test_line_anchors.py` 와 `.claude/tests/README.md` 도 동반 갱신됐다. 유일한 아쉬운 점은 신설된 "위치 표기 규약"이 정작 그런 공통 규약을 위해 존재하는 SSOT 문서(`subagent-call-contract.md`)를 건드리지 않고 13개 reviewer 정의 파일에 손수 복제되는 방식으로 도입됐다는 것과, README/SKILL 이 기능 자체보다 그 부수효과(사이즈 상한 수치)만 기록했다는 점이다. 둘 다 차단 사유는 아니며 향후 drift 위험을 낮추는 정리 작업으로 남겨둘 만하다.

## 위험도
LOW
