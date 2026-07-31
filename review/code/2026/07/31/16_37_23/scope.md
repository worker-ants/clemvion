STATUS=success scope review complete — 0 CRITICAL, 0 WARNING, 1 INFO

===REPORT_MARKDOWN_BELOW===

# 변경 범위(Scope) 리뷰 — harness bundle correctness (4 commits)

## 검토 방법

프롬프트(`scope.md`)에는 5개 파일 모두 "전체 파일 컨텍스트"만 실려 있고 unified diff 블록이
없어(harness 쪽 이슈로 보임, scope 판단과 무관), `git diff origin/main...HEAD`(브랜치 4개
커밋: `1c8f16e6f`·`ad9701b3e`·`0b99b3757`·`e7bb8fb28`)로 실제 변경분을 직접 추출해 검토했다.
`git diff --stat`/`git diff --ignore-all-space --stat` 대조, 커밋별 diff 분리, 관련 plan
문서(`plan/in-progress/harness-consistency-summary-downgrade-rule.md`) 대조까지 수행.

## 발견사항

- **[INFO]** 마지막 커밋이 "이번 PR 이 건드리지 않은 기존 코드"를 자진 신고하며 함께 닫음
  - 위치: `.claude/skills/code-review-agents/scripts/code_review_orchestrator.py` 함수
    `build_files_section` (커밋 `e7bb8fb28`, "1R 리뷰 반영")
  - 상세: 커밋 메시지가 명시적으로 "이 줄 자체는 이번 PR 이 건드리지 않은 기존 코드지만 이 PR 의
    주제(번들 정확성)와 같은 결함 클래스이고 대형 파일마다 활성이라 함께 닫는다" 라고 밝히고
    있다. 즉 3개 커밋(`1c8f16e6f`/`ad9701b3e`/`0b99b3757`)이 완결한 원 스코프 밖의 CRITICAL
    (2단계 절단이 파일의 진짜 총 줄 수를 잘못 보고) 을 같은 PR 에 추가로 포함시켰다는 뜻이라
    "의도 이상의 변경" 점검 관점(①)에 정확히 해당하는 패턴이다.
  - 판단: 다만 (a) 수정 대상이 바로 앞 커밋(`ad9701b3e`)이 이미 리팩터링 중이던 동일 함수
    `build_files_section` 내부이고, (b) 버그 클래스가 PR 전체 주제("번들 정확성" — 절단·예산
    산술의 정확성)와 동일하며, (c) 이 저장소의 표준 워크플로("1R 리뷰 반영" 커밋 = 구현 직후
    자동 `/ai-review` 로 발견된 Critical/Warning 을 같은 턴에 반영)에 따른 것이고, (d) 자기
    스코프 확장 사실을 커밋 메시지에 완전히 투명하게 기록해 뒀다. 별도 파일·별도 함수·무관한
    영역을 건드린 것이 아니므로 CRITICAL/WARNING 이 아니라 기록 목적의 INFO로 남긴다.
  - 제안: 조치 불필요. 다음에 유사 상황이면 지금처럼 "이 줄은 PR 원 스코프 밖" 이라고
    커밋 메시지에 명시하는 관행을 유지할 것.

## 스코프 정합성 확인 (문제 없음으로 판정한 항목)

- **파일 범위**: `git diff --stat origin/main...HEAD` 는 정확히 5개 파일만 보고한다 — 리뷰
  대상 파일 목록(코드 2 + 테스트 2 + plan 1)과 1:1 일치. `lib/role_instructions.py`,
  `_shared/report_paths.py` 등 두 orchestrator 가 import 하는 인접 모듈은 전혀 건드리지 않았다.
- **포맷팅 오염 없음**: `git diff --stat` vs `git diff --ignore-all-space --stat` 결과가
  완전히 동일(`5 files changed, 277 insertions(+), 54 deletions(-)`) — 공백/줄바꿈만의 변경이
  실질 변경과 섞여 있지 않다. `git diff --check` 도 0건.
- **불필요한 리팩토링 아님**: `ad9701b3e`(`_charge_notice` 도입)는 "순수 리팩터" 로 명시돼
  있지만, 정확히 이 PR 이 다루는 예산 산술 버그가 "네 지점에 흩어진 손수 뺄셈이 두 번
  빠졌다"는 것이었으므로 그 산술을 한 곳으로 모으는 리팩터는 버그 클래스 자체의 해법이지
  현재 작업과 무관한 정리가 아니다.
  이름 변경(`_notice_cost`→`_notice_text`, `_BUNDLE_FILE_MARKER`→`_BUNDLE_FILE_SENTINEL`)
  후 구 식별자 잔존 참조를 `grep` 으로 확인 — 0건, 죽은 참조 없음.
  `ad9701b3e` 리팩터가 남긴 중복 rationale 주석은 다음 커밋(`e7bb8fb28`)에서 자체 발견·제거돼
  최종 상태에는 남아있지 않음을 직접 확인했다.
- **기능 확장(over-engineering) 없음**: 추가된 것은 helper 함수 1개(`_charge_notice`)와
  data 필드 2개(`source_lines`/`total_lines`) 뿐 — 요청받지 않은 신규 기능 없음.
- **임포트 변경**: `test_consistency_context_budget.py` 에 추가된 `import re` 는 새로 추가된
  테스트 3개에서 실제로 사용됨(`re.findall`/`re.escape`) — 죽은 임포트 아님. 그 외 파일에는
  임포트 변경 없음(`consistency_orchestrator.py` 의 `re` 는 이미 임포트돼 있던 것).
  두 orchestrator 가 여전히 model 을 직접 호출하지 않는 prepare-only 구조를 유지하는지도 확인
  (외부 LLM 호출 정책 위반 없음).
- **설정 변경 없음**: `.json`/`.yaml`/project-config 류 파일은 diff 에 없음.
- **plan 문서 bookkeeping 은 스코프 밖 작업이 아님**: `0b99b3757` 커밋 메시지가 "natural
  sort + stale 체크박스 정리" 를 함께 명시한다. 체크된 6개 항목 중 (a)/(b)/(c) 3건(하향 규약
  본체)은 이 PR 의 커밋들이 구현한 것이 아니라 — `.claude/agents/consistency-summary.md`,
  `.claude/skills/consistency-checker/SKILL.md` 는 이 브랜치 diff 에 전혀 등장하지 않음을
  확인 — 이미 다른 곳에서 반영된 사용자 결정(2026-07-31, 상단 배너 참조)을 체크리스트에
  뒤늦게 반영한 것뿐이다. 이 plan 파일 자체가 애초부터 "번들 결함"과 "하향 규약" 두 독립
  사안을 함께 추적하도록 설계돼 있었고(문서 최상단 배너: "두 사안은 독립이다"), 프로젝트
  컨벤션(plan 체크박스 = 실제 상태)에 따른 사실 정정이라 스코프 이탈이 아니다.
  plan 의 남은 미체크 항목 2건(diff 존재 여부 사전 확인, `spec_impact` 우선 번들링)은 실제로
  코드에 구현돼 있지 않음을 `grep spec_impact` 로 확인 — "다 했다고 우기지 않고 실제로 안 한
  건 안 했다고 남겨 둔" 상태와 코드가 일치한다.
- **테스트 변경도 동일 스코프**: 신규/변경된 테스트 3건(`test_a_document_that_writes_the
  _sentinel_cannot_forge_a_boundary` 등)은 모두 이 PR 이 도입한 `_neutralize_sentinel`/
  `_BUNDLE_FILE_SENTINEL`/자연정렬 동작을 정확히 겨냥한다. `subprocess.run` 에 추가된
  `timeout=30.0` 도 같은 파일이 대상이며 커밋 메시지가 "형제 파일 주석의 거짓 주장을 사실로
  만든다" 고 자진 신고 — 별도 관심사 혼입이 아니라 자기 파일 위생.
- **TODO/FIXME/디버그 잔재 없음**: `git diff` 추가분에 `TODO`/`FIXME`/`debugger` 매치 0건.

## 요약

4개 커밋(`1c8f16e6f`→`ad9701b3e`→`0b99b3757`→`e7bb8fb28`)이 건드린 파일은 정확히 리뷰 대상
5개 파일뿐이며, 전부 "harness 번들 정확성"(파일 경계 오인·자연정렬·예산 산술 중복 실수·
2단계 절단 총량 오보고)이라는 단일 주제 아래 있다. 공백-only 변경·죽은 임포트·orphaned
식별자·설정 파일 변경·무관 파일 수정은 전무하다. 유일하게 짚을 만한 지점은 마지막 커밋이
"이 PR 원 스코프 밖 기존 코드"를 자진 신고하며 함께 닫은 것인데, 같은 함수·같은 버그
클래스·같은 파일이고 이 프로젝트가 표준으로 강제하는 "구현 직후 리뷰 라운드 반영을 같은
턴에 처리" 관행과 정확히 일치해 문제로 보지 않는다. plan 문서의 체크박스 정리 역시 이미 다른
곳에서 반영된 결정을 사실대로 갱신한 것으로, 코드 변경(consistency-summary.md 등 미변경)과
대조해 실제로는 아무 새 작업도 대신하지 않았음을 확인했다.

## 위험도

NONE
