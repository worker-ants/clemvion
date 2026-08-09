# 변경 범위(Scope) 리뷰 — plan-frontmatter.test.ts

## 검토 방법 메모

프롬프트에는 이 파일의 "전체 파일 컨텍스트"만 주어지고 unified diff 섹션이 없었다. `git log`/`git diff` 로
베이스라인(`f8c334947`, 이 harness 작업 시작 직전 커밋)과 HEAD 를 대조해 실제 누적 변경분을 확인한 뒤,
아래 위치 인용은 프롬프트의 게이트 숫자(=파일 1-기준 실제 줄 번호, `Read` 로 재확인 완료)를 사용했다.

누적 diff 요지:
- import 추가: `extractLinks`(spec-links), `collectCompletePlanMarkdown`/`collectLivePlanMarkdown`/`findNonTerminalCompletedPlans`(plan-scan) — 전부 파일 내에서 실사용됨.
- `collectTopLevelPlans` 를 손으로 짠 `readdirSync` 순회에서 `collectLivePlanMarkdown` 위임으로 교체 (라인 61-63).
- 헤더에 "2026-08-09" 배경 설명 블록 추가 (라인 33-50) + 정본 정정 노트 (라인 63-66).
- 신규 테스트 2건: `top-level in-progress plans have no broken relative links`, `the plan link scanner actually sees links (non-vacuity)` (라인 150-172).
- 신규 `describe("completed plans declare a terminal status", …)` 블록과 그 안의 2개 테스트 (라인 176-203).
- 기존 3개 테스트(`worktree`/`started`/`owner` 검증, `finds top-level in-progress plans`)는 로직 변경 없이 그대로 유지.

## 발견사항

- **[INFO]** 헤더 주석에 리뷰 라운드 이력(`ai-review documentation WARNING`, `#1108`, `#1117` 등)이 직접 코드에 누적 기록됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:24-26`, `:38-41`
  - 상세: 리뷰 이력 서술은 이 프로젝트 관행(spec `## Rationale` 섹션, in-code 배경 주석)과 일치하지만, 커밋마다 "몇 번째 리뷰에서 무엇을 지적받았는지"가 소스에 계속 누적되면 파일이 changelog 화될 수 있다. 실질적인 스코프 위반은 아니며 커밋 메시지에도 동일 내용이 이미 담겨 있어 정보 중복도가 다소 높다.
  - 제안: 현재 수준은 문제 없음. 다만 향후 라운드가 더 늘면 이력 서술은 커밋 메시지/plan 문서로 옮기고 코드 주석은 "현재 규칙이 무엇인가"만 남기는 편을 고려.

- **[INFO]** `collectTopLevelPlans` 를 `collectLivePlanMarkdown` 위임으로 교체한 것은 신규 게이트 2건 추가 요청 범위를 살짝 넘는 리팩터로 보일 수 있음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:57-63`
  - 상세: 다만 라인 57-60 주석이 명시하듯, 이 교체는 "이 파일이 직접 지적하는 '두 곳이 조용히 틀어진다' 문제를 이 파일 자신이 재현하고 있었다"는 실측된 버그(0-/_- 접두 필터 불일치)를 고치는 것이므로 이번 작업(plan 이동 시 스캔 소스 단일화)과 직접 연결된 정당한 범위 내 변경이다. 무관한 리팩터로 보지 않음.
  - 제안: 조치 불필요. 참고용 기록.

무관한 파일 수정, 사용하지 않는 임포트, 설정 파일 변경, 의미 없는 포맷팅 diff 는 발견되지 않았다. 기존 3개 테스트(worktree/started/owner)와 discovery 테스트는 로직 변경 없이 보존되어 있어 "요청 외 추가 수정"에 해당하는 항목이 없다.

## 요약

이 파일의 누적 변경은 커밋 메시지·in-code 주석이 명시하는 목표(plan 이동 시 발생하는 두 갭 — `complete/` status 모순 검사, 살아있는 plan 의 깨진 상대링크 검사 — 게이트화)와 그에 대한 여러 라운드의 ai-review 후속 수정(비-vacuity 캐너리 강화, 헤더 정본 정정)에 정확히 대응한다. 유일하게 논의할 만한 지점은 `collectTopLevelPlans` 위임 교체인데, 이는 같은 파일이 경고하는 "스캔 로직 이중 구현" 문제를 스스로 해소하는 것이라 범위 내로 판단한다. 무관한 파일·임포트·설정·포맷팅 변경은 없다.

## 위험도

NONE
