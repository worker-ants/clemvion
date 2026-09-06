# 정식 규약 준수 검토 — `spec/conventions/review-citations.md` · `spec/conventions/spec-impl-evidence.md`

검토 대상 델타: `spec/conventions/review-citations.md`(+28/-3), `spec/conventions/spec-impl-evidence.md`(+1/-1) —
`code:` 필드가 "준수 예시 vs 시행 코드"를 함께 담을 수 있고, YAML 블록 리스트 안에 `#`
주석을 넣지 않는다는 정정을 두 문서에 동기화한 라운드. (주의: 이 세션의 `_prompts` 번들에
실린 스냅샷은 이보다 한 라운드 전 상태 — YAML 인라인 주석이 아직 남아 있던 버전이다. 본
보고서는 HEAD 워킹트리의 실제 파일 내용을 기준으로 작성했다.)

## 발견사항

- **[CRITICAL] 이번에 신설한 금지 패턴("`code:` 블록에 YAML 주석 금지")이 같은 컨벤션이 관할하는 다른 spec 7개에 이미 살아 있고, harness 게이트가 41개 `code:` 항목을 조용히 못 본다**
  - target 위치: `spec/conventions/spec-impl-evidence.md` §2.1 `code` 필드 정의의 신규 문장(`"...다만 **범주를 YAML 주석으로 적지 않는다.** review_guard._parse_frontmatter_code 의 블록 리스트 루프가..."`), `spec/conventions/review-citations.md` Rationale 동일 정정
  - 위반 규약: `spec-impl-evidence.md` §1 적용 대상(`spec/2-navigation/**.md` · `spec/7-channel-web-chat/**.md` · `spec/conventions/**.md` 포함) + 이번 diff 로 §2.1 에 신설된 규칙 그 자체
  - 상세: 두 target 문서는 이번 라운드에서 "`code:` 블록 리스트 항목 사이에 `#` 주석을 넣으면 `.claude/hooks/_lib/review_guard.py::_parse_frontmatter_code` 의 블록 리스트 루프가 `- ` 로 시작하지 않는 첫 줄에서 `break` 해 그 뒤 항목이 전부 사라진다"는 사실을 처음 문서화했고, 자기 자신(`review-citations.md`)의 위반은 프로즈/표로 옮겨 고쳤다. 그런데 **같은 규칙이 적용되는 다른 spec 문서 7개에 이미 동일한 안티패턴이 남아 있다** — 실측(`_parse_frontmatter_code` 로직을 그대로 재현):

    | 파일 | 실제 `- ` entry 수 | harness 가 실제로 보는 수 | 조용히 누락 |
    |---|---|---|---|
    | `spec/2-navigation/_layout.md` | 5 | 3 | 2 |
    | `spec/2-navigation/10-auth-flow.md` | 11 | 3 | 8 |
    | `spec/2-navigation/11-error-empty-states.md` | 15 | 6 | 9 |
    | `spec/2-navigation/9-user-profile.md` | 17 | 2 | 15 |
    | `spec/7-channel-web-chat/3-auth-session.md` | 6 | 4 | 2 |
    | `spec/7-channel-web-chat/2-sdk.md` | 4 | 1 | 3 |
    | `spec/conventions/user-guide-evidence.md` | 7 | 5 | 2 |
    | **합계** | **65** | **24** | **41** |

    가장 심한 사례 — `codebase/frontend/src/app/(main)/[...rest]/page.tsx` 는 네 개 spec(`_layout.md`·`10-auth-flow.md`·`11-error-empty-states.md`·`9-user-profile.md`)이 각각 `code:` 로 선언하지만 **네 곳 모두** 주석 바로 뒤에 있어, `review_guard._spec_code_patterns()` 의 dedup 집합에 단 한 번도 들어가지 못한다 — harness 관점에서 이 catch-all 라우트 파일은 **완전히 spec-unlinked** 상태다.

    이 파서 분기(divergence) 자체는 `plan/in-progress/spec-draft-nullable-notation-followups.md`(2026-09-05 등재)에 "harness: `code:` 블록 리스트의 YAML 주석이 게이트 파서를 조용히 끊는다"로 이미 등재돼 있고, 그 항목이 예로 든 `spec/5-system/2-api-convention.md` 는 실제로 이미 시정돼 있다(확인함). 하지만 그 backlog 항목은 **파서 버그 클래스**만 겨냥할 뿐 "지금 이 순간 몇 개 파일이 이미 이 결함에 걸려 있는가"는 세지 않았고, 이번 diff 역시 새 규칙을 두 target 문서에 못박으면서 그 규칙이 **자기 관할 안에서 이미 어디서 깨지고 있는지 재지 않았다.** 이는 두 target 문서 스스로가 반복 강조하는 원칙 — *"범위를 넓히는 편집은 그 범위를 재는 일까지 포함한다"* (`review-citations.md` Rationale, `spec/**` 위반 0건 오판 사례에서 도출)· *"이 수치를 처음 셀 때 거짓 0 을 냈다"* — 와 정면으로 어긋난다. 정작 자기가 세운 원칙을 자기가 신설한 규칙에는 적용하지 않은 셈이다.

    영향은 문서 위생에 그치지 않는다 — `review_guard._spec_linked_changes()` 는 이 glob 집합으로 "이 codebase 변경이 spec 이 약속한 surface 를 건드리는가"를 판정해 `--impl-done` 게이트(spec-linked 여부, 사용자 메모의 "게이트가 둘이고 번갈아 stale 된다" 항목이 의존하는 바로 그 판정)를 결정한다(`review_guard.py:670-682`). 위 15개 항목이 빠진 `9-user-profile.md` 가 가리키는 `codebase/backend/src/modules/users/**` · `codebase/backend/src/modules/workspaces/**` 등을 고치는 PR 은 harness 관점에서 그 spec 과 무관한 변경으로 오판될 수 있다 — 정확히 `spec-impl-evidence.md` 가 스스로 존재 이유로 드는 "spec 약속 vs 구현 갭을 build-time/harness 가드로 닫는다"는 목적을 훼손하는 방향이다.
  - 제안: (a) 즉시 조치 — 7개 파일의 `code:` 블록에서 인라인 `#` 주석을 걷어내고 범주 설명은 본문 프로즈/표로 옮긴다(이번 diff 가 `review-citations.md` 자신에게 한 것과 동일한 방식). (b) `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 backlog 항목에 위 7-파일·41-entry census 를 추가해 "파서가 고쳐지기 전까지 몇 곳이 실제로 노출돼 있는지"를 등재한다. (c) 소급 정리를 미루기로 결정한다면 (기존 `review-citations.md` §4 "기존 인용은 소급 정리 대상이 아니다" 패턴처럼) 그 유예를 spec-impl-evidence.md §2.1 에 명시적으로 적어야 한다 — 다만 이 결함은 표기 스타일이 아니라 **게이트 무결성**을 건드리므로 같은 잣대로 유예해도 되는지부터 재검토가 필요하다.

- **[INFO] 지적 번호 인용 표기가 한 문서 안에서 `W2` / `INFO#2` / `Critical 1` 세 형태로 혼재**
  - target 위치: `review-citations.md` Rationale, `(`review/code/2026/09/06/12_28_02` W2)` / `(`review/consistency/2026/09/06/13_18_59` INFO#2)` / `(`review/code/2026/09/06/13_39_20` Critical 1)`
  - 위반 규약: `review-citations.md` §2 — "지적 번호를 함께 적으면 더 좁혀진다: `review/code/2026/09/04/23_02_51 W1`" 는 예시일 뿐 특정 약어 형식을 강제하지 않으므로 엄밀한 위반은 아님
  - 상세: 규약이 라벨 형식을 못박지 않아 자유이나, 같은 문서 안에서 `W2`(약어+숫자) / `INFO#2`(약어+#+숫자) / `Critical 1`(전체 단어+공백+숫자) 세 스타일이 섞여 있어 다음 저자가 어느 쪽을 따라야 할지 애매하다.
  - 제안: 강제 사항은 아니며, 여유가 있을 때 §2 예시 옆에 "지적 번호는 그 리뷰 산출물이 실제로 쓴 라벨을 그대로 옮긴다(`W1`/`INFO#1`/`Critical 1` 등 형식 통일 요구 없음)"는 한 줄만 덧붙이면 이 혼재가 의도된 것임이 분명해진다.

## 요약

두 target 문서(`review-citations.md`, `spec-impl-evidence.md`) 자체는 이번 diff 로 여러 라운드
자기 정정을 거쳐 상호 동기화됐고, 명명 규약(kebab-case `id`, 파일명)·문서 구조(Overview/본문/
Rationale 3섹션)·API 문서 규약(`swagger.md` §3 JSDoc-내부서사 분리 규칙과의 정합, 새 guard/spec
파일 명명이 기존 `<name>-guard.ts`+`<name>.spec.ts` 관례를 그대로 따름)·`code:` glob 문법(프런트
엔드 `globMatchesAny` 로 실측 검증)까지 모두 규약을 준수한다. 다만 이번에 신설한 "`code:` 블록에
YAML 주석을 넣지 않는다"는 규칙이 같은 컨벤션의 관할 영역(§1 대상) 안에서 **이미 7개 파일·41개
entry** 규모로 깨져 있고 harness 게이트가 그만큼의 spec-code 연결을 놓치고 있다는 사실을 이번
편집이 재지도 반영하지도 않았다 — 두 문서가 스스로 여러 차례 강조한 "범위를 넓히는 편집은 그
범위를 재는 일까지 포함한다"는 원칙이 정작 자기 규칙에는 적용되지 않은 사례다.

## 위험도
HIGH
