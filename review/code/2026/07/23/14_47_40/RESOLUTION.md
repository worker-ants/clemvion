# Resolution — review/code/2026/07/23/14_47_40

대상 커밋: `f4be1d27e` (리뷰어 위치 기재를 소스 라인에 고정 — 프롬프트 오프셋 인용 차단)
SUMMARY 위험도: **LOW** / CRITICAL 0 / WARNING 3

## CRITICAL

없음.

## WARNING

### WARNING 1 — 위치 표기 규약이 SoT 없이 흩어짐 → **부분 반영**

지적 내용: 규약이 `LINE_ANCHOR_LEGEND`(프롬프트 동적 주입)와 13개 `*-reviewer.md`
hand-copy 블록에 이중으로 존재하는데, 13개 파일 **상호간** byte-identical 만 테스트로
고정되고 LEGEND 와의 일치는 검증되지 않는다. 한쪽만 고치면 조용히 drift.

조치 — 리뷰어가 제시한 두 선택지 중 **교차검증 테스트** 채택:
`LegendAndDefinitionAgreementTest` 신설. LEGEND 와 13개 정의가 3개 load-bearing 규칙
(게이트 지칭 / 번호 날조 금지 / 프롬프트는 조립 문서)에 대해 **양방향으로** 일치하는지
검증한다. 한쪽에서만 규칙이 사라지면 실패한다.

`subagent-call-contract.md` 로 SSOT 이관은 **미채택**. 그 문서는 sub-agent **호출 규약**
(prompt_file/output_file/STATUS 라인)을 담는 곳이고, 위치 표기는 reviewer 역할의 **출력
형식**에 속한다. 호출 규약 문서에 출력 형식을 넣으면 문서 경계가 흐려지고, 13개 정의를
"참조 한 줄"로 축소하면 sub-agent 가 자기 system prompt 만 읽고는 규칙을 알 수 없게 되어
(정의 파일 = 실행되는 system prompt) 오히려 신뢰성이 낮아진다. 중복은 유지하되 drift 를
테스트로 막는 쪽이 이 구조에 맞다.

검증: SKILL.md 의 문구를 한 곳만 바꾸는 mutant → `FAILED (failures=2)`. 복원 후 green.

### WARNING 2 — 사이즈 상한 기본값이 코드/문서 3곳 하드코딩, drift 가드 부재 → **반영**

조치: `DocumentedDefaultsMatchTheCodeTest` 신설. orchestrator 를 실제로 실행해
`DEFAULT_MAX_FILE_SIZE` / `DEFAULT_MAX_PROMPT_SIZE` 를 읽고, SKILL.md·README.md 의 표
행이 그 값을 인용하는지 대조한다. `_GUTTER_OVERHEAD` 재조정 시 문서가 stale 하면 실패.
프로젝트 선례(`test_doc_sync_matrix.py`)와 같은 종류의 cross-format 바인딩.

검증: SKILL.md 의 `141557` → `131072` mutant → `FAILED`, 메시지가 실제 코드값을 지목.
복원 후 green.

### WARNING 3 — `_split_hunks` 방어 분기 주석의 근거가 실제 호출 경로와 불일치 → **반영**

지적이 정확했다. 주석은 bare empty line 이 `text.split("\n")` 의 trailing element 라고
설명했으나, `annotate_unified_diff` 는 `splitlines()` 로 분할하므로 그 상황이 발생하지
않는다. 근거 문장이 **검증용 probe 스크립트의 산물**(probe 는 `split("\n")` 사용)을 그대로
프로덕션 주석에 옮긴 것이었다.

조치: 주석을 실제 동작 기준으로 정정 — (a) git 이 hunk 내부에서 빈 컨텍스트 줄도 항상
선행 문자와 함께 내보낸다는 **실측 근거**(이 저장소 히스토리에서 bare empty 0건), (b) 이
경로에서는 도달 불가능하며 hand-assembled payload 를 위한 경계라는 점, (c) 설령 도달해도
hunk 카운트 불일치로 fail-open 된다는 점을 명시. 코드 동작은 무변경(behaviour-preserving).

## INFO

8건 전부 **미조치**. 사유:

- INFO 1 (`DEBUG_LOG_FILE` symlink race) — 사전 존재 코드, 이번 diff 범위 밖. 리뷰어도
  "범위 밖, 참고만" 으로 분류.
- INFO 2 (`lib/session.py::truncate_to_budget` 영어 문구 잔존) — 소비자가 겹치지 않아 실질
  충돌 없음. 별건 정리 대상.
- INFO 3 (shallow clone 전제) — 현재 non-issue. 해당 테스트는 `if not commits:
  self.skipTest(...)` 로 이미 degrade 한다.
- INFO 4 (truncation 3분기 단위 테스트) — 타당하나 선택 사항. 3분기 모두 mutation 으로
  실효성이 확인된 상태(M10 mid-line 절단 mutant killed). 별건 백로그.
- INFO 5·6 (README 기능 서술 / tests README 선례 추가) — 문서 보강 성격. **doc-only 루프
  회피**를 위해 이번 턴 미반영 (Critical 0 + 코드 WARNING 0 수렴 원칙).
- INFO 7 (타입힌트 불균일) — 스타일. 이 모듈은 `from __future__ import annotations` 기반
  점진 표기이며 harness 전반이 부분 표기 관례.
- INFO 8 — 조치 불요로 리뷰어가 직접 판정.

## 검증

- harness suite **376건 green** (WARNING 반영 전 373 → 신규 가드 3건 추가).
- 신규 가드 2종 mutation 실측: 문서 stale mutant·LEGEND 규칙 삭제 mutant 모두 **killed**,
  복원 후 green.
- 주석 정정 후 `--prepare` 재실행 → 게이트 **1,863개 실제 소스 대조, 불일치 0**.

## 잔여

없음 (WARNING 3건 전부 처리, INFO 는 위 사유로 미조치).
