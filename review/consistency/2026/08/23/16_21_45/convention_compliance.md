# 정식 규약 준수 검토 — `plan/in-progress/spec-update-assistant-masking.md`

## 검토 방법

target 은 spec 파일 자체가 아니라 **spec 에 쓸 계획을 서술한 planner 턴 plan 문서**다(spec
파일 `spec/3-workflow-editor/4-ai-assistant.md` · `spec/5-system/14-external-interaction-api.md`
는 아직 미수정 — git status 확인). 따라서 (a) plan 문서 자체의 frontmatter/구조 규약 준수와
(b) target 이 예고하는 spec 변경 내용이 `spec/conventions/**`, 특히 이 변경과 직접 겹치는
[`egress-masking.md`](../../../../../spec/conventions/egress-masking.md) 와 정합하는지 둘 다
확인했다. 코드(`3aaa4cd19`)를 대조해 target 이 서술하는 포맷 변경(`"***"`)이
`@workflow/masked-markers` 의 `VALUE_MASK_MARKER = "***"` 와 정확히 일치함을 실측 확인했다 —
이 부분은 규약 위반이 아니라 오히려 SoT 상수에 정합하는 방향의 정정이다.

## 발견사항

- **[WARNING]** `egress-masking.md` §1 좌표계 표(소비처 열)가 이 변경으로 낡는데 target 의
  "고칠 두 곳"/작업 체크리스트에 없다
  - target 위치: `## 고칠 두 곳` (전체), `## 작업` 체크리스트
  - 위반 규약: `spec/conventions/egress-masking.md` §1 표 2행("소비처 (심볼)" 열) — 해당
    문서는 스스로를 "어느 상한이 어느 연산자로 어느 마커를 **어느 소비처**에 남기는가" 의
    SoT 로 선언한다
  - 상세: 코드 diff(`3aaa4cd19`) 를 실측하면 `explore-tools.service.ts` 가 이번에
    처음으로 `deepRedactSecrets` 를 import 해 `redactAssistantFields` 를 통해
    `MAX_REDACT_DEPTH`/`VALUE_MASK_MARKER` 좌표계의 **신규 소비처**가 됐다. 그런데
    `egress-masking.md` 표 2행의 "소비처" 열은 현재 `deepRedactSecrets(REST 응답·저장
    에러·conversation thread) · hasMaskedLeaf(...)` 까지만 나열하고, `workflow-assistant`
    는 없다(이 열거는 `egress-masking.md` 가 직전 커밋 `2022fdbc8`—`3aaa4cd19` 의
    부모—에서 "게이트 통합 뒤에도 표는 무변경" 이라고 실측·기록한 시점보다 **뒤에** 생긴
    소비처라 그 실측에도 포함되지 않았다). 이 문서 자신의 Rationale 은 "같은 방어 문장을
    두 곳이 반복하는 것은 주인 없는 사실의 징후다" 라며 정확히 이런 종류의 drift 를
    막기 위해 신설됐고(§Rationale, PR #1192 CRITICAL 사례 인용), §3 은 "표가 낡는 진짜
    조건은 … 마스커가 늘거나·합쳐지거나·상한/연산자가 바뀌는 것" 이라 적어 두었다 — 이
    변경은 마스커 자체가 아니라 새 **소비처**의 추가라 이 문구를 문자 그대로 적용하면
    "표는 안 낡는다" 는 반론도 가능하나, 표의 "소비처" 열 자체가 소비처를 열거하는
    이상 신규 소비처가 실측되지 않은 채 남는 것은 그 열의 정확성을 깨는 것과 같다.
    기계 가드가 없는 문서(§3 "이 문서는 기계가 지키지 않는다")이므로 **invariant 파괴**
    수준은 아니라 CRITICAL 은 아니지만, 이 컨벤션이 존재하는 이유 자체가 이런 누락을
    막기 위함이라 WARNING 으로 판단한다.
  - 제안: target 의 "고칠 두 곳" 에 세 번째 항목으로 `egress-masking.md` §1 표 2행
    소비처 열에 `explore-tools.service.ts`(`redactAssistantFields`, workflow-assistant
    LLM 도구) 를 추가하거나, 의도적으로 표 밖에 두기로 했다면 그 판단 근거를 §3 에
    같은 문체(예: "표는 무변경이다 — 이유: …")로 남긴다. 후자를 택할 경우 규약
    자체를 갱신하는 편이 맞다.

- **[INFO]** `spec/3-workflow-editor/4-ai-assistant.md` 에 `egress-masking.md` 로의
  "관련 문서" 역참조가 없다
  - target 위치: `### 1. spec/3-workflow-editor/4-ai-assistant.md §4.1.1` 절
  - 위반 규약: 직접적 금지 규약은 아니며, 이 저장소 conventions 문서들이 공유하는
    관행(각 conventions 파일 상단 "> 관련 문서: …" 상호 링크 — 예:
    `egress-masking.md` 자신도 상단에 EIA §R17 · WS Protocol §4.1 · node-output.md ·
    error-codes.md §4.2 를 역참조로 건다) 과의 정합성 제안
  - 상세: `4-ai-assistant.md §4.1.1` 이 이번에 `deepRedactSecrets`(값-패턴 마스킹,
    `MAX_REDACT_DEPTH`/`VALUE_MASK_MARKER` 좌표계 소속)를 명시적으로 인용하게 되는데,
    그 좌표계의 SoT 는 `egress-masking.md` 다. 현재 `4-ai-assistant.md` 본문 어디에도
    `egress-masking.md` 인용이 없어 "이 상한이 어디서 왔는지" 를 찾으려면 코드 JSDoc
    까지 내려가야 한다(EIA §R17 은 이미 `@workflow/masked-markers` 를 이관·인용한다).
  - 제안: §4.1.1 마스킹 규칙 서술 또는 문서 상단 "관련 문서" 목록에
    `[Egress 마스킹 좌표계](../conventions/egress-masking.md)` 한 줄을 추가하면 좌표계
    SoT 발견성이 좋아진다. 필수는 아니다(EIA 도 §R17 안에서 인용을 갖고 있어 완전한
    고립은 아니다).

## 준수 확인된 항목 (참고 — 발견사항 아님)

- 마커 리터럴 `"***"` 를 spec 산문에 직접 적는 것은 `egress-masking.md` 의 "본 문서는
  마커 리터럴을 적지 않는다" 규율 위반이 **아니다** — 그 규율은 좌표계 문서 자신에
  한하고, "EIA §R17 이 마커 리터럴을 인용하는 것은 그쪽이 wire 계약 서술이라 정상"
  이라는 명시적 예외가 있다. `4-ai-assistant.md §4.1.1` 도 `get_execution_details`
  응답 구조를 서술하는 동형의 wire 계약 절이라 같은 예외가 적용된다. 실측:
  `VALUE_MASK_MARKER = "***"` (`codebase/packages/masked-markers/src/index.ts`) —
  target 이 예고하는 리터럴과 정확히 일치.
- plan frontmatter 3필드(`worktree`/`started`/`owner`) 모두 존재, `spec_impact` 는
  bare string 이 아닌 YAML 리스트(Gate C 위반 회피), 두 항목 모두 실존 spec 경로.
- `## Rationale` 절에 트레이드오프·실측을 남기겠다는 계획(`§4.1.1 마스킹 규칙 + Rationale`)
  은 CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 및 두 대상 spec
  문서가 이미 갖고 있는 `## Rationale` 최하단 섹션 구조와 정합.
  EIA §R17 잔여③ 을 "취소선 + 결정" 으로 덮는 방식은 같은 절 안의 잔여①·잔여②
  선례(`~~잔여 ①~~ 해소(2026-08-16)`, `~~잔여 ②~~ 해소(2026-08-20)`)와 동형 패턴이다.

## 요약

target plan 문서 자체의 frontmatter·구조는 정식 규약(plan-lifecycle 3필드, Gate C
spec_impact 리스트 형식)을 준수하며, 예고된 spec 변경의 핵심 — 마스킹 포맷 리터럴을
`"***"` 로 통일하는 것 — 은 코드로 실측한 SoT 상수 `VALUE_MASK_MARKER` 와 정확히
일치하고 마커 리터럴 인용도 EIA §R17 과 동형의 wire-계약 예외에 해당해 위반이 아니다.
다만 이 변경이 `egress-masking.md` 좌표계 표(§1)의 새 소비처(`explore-tools.service.ts`)
를 만드는데 target 의 "고칠 두 곳" 이 그 표를 갱신 대상에서 빠뜨렸다 — 이 문서가 정확히
이런 drift 를 막기 위해 신설됐다는 자기 서술과 대비되는 지점이라 WARNING 으로 표시한다.
기계 가드가 없는 human-maintained 표라 즉시 빌드를 깨지는 않으므로 CRITICAL 은 아니다.

## 위험도

LOW
