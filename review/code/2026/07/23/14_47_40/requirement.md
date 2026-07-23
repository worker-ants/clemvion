# 요구사항(Requirement) 리뷰

## 변경 개요

리뷰 sub-agent 프롬프트에 "실제 소스 라인 번호 게이트"(gutter)를 도입하는 harness 자체 개선. 실측 사고(`review/code/2026/07/17/20_06_14/` 세션에서 7건 전수가 조립 프롬프트 내 오프셋으로 잘못 인용됨, 예: 99줄짜리 파일에 "line 1362")를 근거로 신규 모듈 `.claude/skills/code-review-agents/lib/line_anchors.py` 를 추가하고, `code_review_orchestrator.py`(`build_files_section`, `build_agent_prompt_body`, `build_router_prompt_body`)에 배선했으며, 13개 `*-reviewer.md`(user-guide-sync-reviewer 제외)에 "위치 표기 규약" 안내 블록을 동일 텍스트로 추가, 게이트 오버헤드(+8%)만큼 `REVIEW_MAX_FILE_SIZE`/`REVIEW_MAX_PROMPT_SIZE` 기본값을 상향(README.md/SKILL.md 동반 갱신), 신규 테스트 `.claude/tests/test_line_anchors.py`(31 케이스, 실제 git 히스토리 재생 포함) 추가. 대상은 `codebase/` 제품 코드가 아니라 `.claude/` 리뷰 harness 자체.

## 발견사항

- **[INFO]** 관련 `spec/` 문서 없음 (spec fidelity, 항목 9)
  - 위치: 변경 전체 (`.claude/agents/*.md`, `.claude/skills/code-review-agents/**`, `.claude/tests/test_line_anchors.py`)
  - 상세: `spec/` grep(`line_anchors`, `위치 표기 규약`, `line-number gutter`) 결과 0건. 이는 결함이 아니라 CLAUDE.md 규약상 당연한 결과다 — `spec/` 는 `codebase/` 제품 정의 SoT 이고, 본 변경은 `.claude/` 리뷰 harness(개발 도구) 영역이라 스코프 밖이다. 이 영역의 사실상 "spec" 은 `.claude/skills/code-review-agents/README.md` §환경변수·`SKILL.md` §환경변수이며, 코드( `DEFAULT_MAX_FILE_SIZE=int(51200*1.08)=55296`, `DEFAULT_MAX_PROMPT_SIZE=int(131072*1.08)=141557` )와 두 문서 표의 값(`55296`/`141557`)이 정확히 일치함을 직접 계산으로 확인했다.
  - 제안: 조치 불요 (수정 대상 spec 없음).

- **[WARNING]** `_split_hunks` 의 "bare empty line" 방어 코드 주석이 실제 호출 경로와 불일치
  - 위치: `.claude/skills/code-review-agents/lib/line_anchors.py:122-127` (주석) vs `line_anchors.py:199` (`lines = text.splitlines()`)
  - 상세: 주석은 "빈 문자열이 나타나는 이유는 `text.split(\"\n\")` 의 trailing element 이기 때문" 이라고 설명하지만, 실제로 `annotate_unified_diff` 는 `text.splitlines()` 를 호출해 `lines` 를 만든다. `"a\nb\n".splitlines()` 는 트레일링 개행에 대해 빈 문자열을 만들지 않으므로 (`"a\nb\n".split("\n")` 과 달리), 주석이 서술하는 트리거 상황은 실제 호출 경로에서는 사실상 발생하지 않는다 — 사실상 도달 불가능한 방어 분기이거나, 최소한 주석의 근거 설명이 실제 구현과 어긋난다(항목 4: 의도-구현 괴리). Fail-open 설계 덕에 이 분기가 오발동해도 "annotate 안 함" 이라는 안전한 결과만 낳으므로 기능적 결함(잘못된 번호 출력)으로 이어지지는 않는다 — 이 모듈의 핵심 불변식("확신 없으면 아무 번호도 내지 않는다")은 깨지지 않는다.
  - 제안: 주석을 `splitlines()` 동작 기준으로 정정하거나 (예: "unified diff 는 각 줄이 항상 ' '/'+'/'-'/'\\' 로 시작하므로, 빈 문자열은 이 구조와 어긋나는 방어적 종료 조건"), 실제로 도달 불가능하면 코드/주석에서 그 사실을 명시. 코드 fix (harness 내부 nit, LOW impact).

- **[INFO]** `user-guide-sync-reviewer.md` 는 이번 "위치 표기 규약" 배선 대상에서 제외됨 — 의도적, 결함 아님
  - 위치: `.claude/agents/user-guide-sync-reviewer.md:49-57` (`## 출력 형식`)
  - 상세: 신규 테스트 `ReviewerDefinitionContractTest._reviewers_reporting_a_location()` 는 `- 위치:` 문자열을 가진 `*-reviewer.md` 만 대상으로 하며 `assertGreaterEqual(len(reviewers), 13, ...)` 로 검증한다. `user-guide-sync-reviewer.md` 를 직접 확인한 결과 해당 리뷰어는 "위치" 필드 대신 "변경 파일"/"매트릭스 항목"/"누락된 동반 갱신" 필드를 쓰는 다른 출력 스키마를 갖고 있어 애초에 라인 번호를 인용하지 않는다 — 13/14 만 갱신된 것은 누락이 아니라 올바른 스코핑이다.
  - 제안: 조치 불요.

## 검증 (직접 실행)

- `python3 -m unittest discover -s .claude/tests -p 'test_line_anchors.py' -v` → 31/31 통과, `GutterCorrectnessAgainstRealGitTest`(실제 git 히스토리 재생, 100+ 개 게이트 번호 대조) 포함.
- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` (harness 전체 self-test, 373건) → 전부 통과 — 이번 배선 변경이 기존 orchestrator 상태기계/가드 테스트를 깨뜨리지 않음을 확인.
- `DEFAULT_MAX_FILE_SIZE`/`DEFAULT_MAX_PROMPT_SIZE` 계산을 직접 재현: `int(51200*1.08)=55296`, `int(131072*1.08)=141557` — README.md/SKILL.md 표 값과 정확히 일치.
- 흥미로운 자기 검증: 본 리뷰의 입력 프롬프트(`requirement.md`) 자체가 새 `build_files_section`/`line_anchors` 로 생성됐다 — 실제로 각 코드 블록 왼쪽에 게이트 숫자가 붙어 있고, 파일 19(`test_line_anchors.py`, 490줄)의 "전체 파일 컨텍스트" 블록은 예상대로 `"... (프롬프트 크기 제한으로 250/490 줄만 표시 — 나머지는 원본 파일 참조) ..."` 로 줄 경계에서 정확히 잘렸다. end-to-end 배선이 실제로 동작함을 리뷰 페이로드 자체가 증명한다.

## 기타 점검 (엣지 케이스 / 반환값 / 에러 시나리오)

- `truncate_to_line_boundary`: `max_chars<=0`, 빈 텍스트, 예산보다 큰 첫 줄(0줄만 유지) 등 경계값 모두 명시적으로 처리되고 테스트로 pin 됨. 항상 `(kept_text, kept_count, total_count)` 3-tuple 을 모든 경로에서 반환 — 반환값 누락 없음.
- `annotate_unified_diff`/`_hunk_is_consistent`: 헌크 헤더 파싱 실패·개수 불일치·combined(`@@@`) diff·바이너리 diff 모두 "원문 그대로 반환 + 게이트 비움" 으로 fail-open — CRLF 소스 파일 등 이론적 edge case 가 있어도 "틀린 번호를 내지 않는다"는 핵심 불변식이 깨지지 않는 방향으로 설계됨.
- TODO/FIXME/HACK/XXX: 변경된 파일 전체에 0건.
- 13개 `*-reviewer.md` 파일의 "위치" 블록 byte-identical 여부: `ReviewerDefinitionContractTest.test_the_location_block_is_byte_identical_across_all_reviewers` 로 pin, 실제로 diff 를 육안 대조한 결과도 13개 파일 전부 동일 텍스트.

## 요약

이번 변경은 `codebase/` 제품 기능이 아니라 리뷰 harness 자체의 결함(리뷰어가 조립 프롬프트 오프셋을 실제 소스 줄 번호로 착각해 인용하던 실측 사고)을 고치는 인프라 개선이다. 신규 모듈은 "확신 없으면 번호를 내지 않는다"는 명확한 불변식을 fail-open 설계로 전 분기에서 지키고, 실제 git 히스토리 재생 테스트로 정확성을 검증하며, 오버헤드 보정된 사이즈 캡·README/SKILL 문서·13개 리뷰어 프롬프트가 서로 수치·문구까지 정확히 일치한다. 관련 `spec/` 문서는 스코프상 존재하지 않는 것이 정상이며, 발견된 유일한 흠은 죽은 코드에 가까운 방어 분기의 주석이 실제 호출 경로(`splitlines()`)와 어긋난다는 낮은 영향도의 문서/구현 불일치뿐이다. Critical 은 없다.

## 위험도

LOW
