# 정식 규약 준수 검토 — `plan/in-progress/widget-presentation-restore.md`

## 발견사항

- **[INFO]** plan 파일명이 `spec-draft-<name>.md` 관례를 따르지 않음
  - target 위치: 파일 경로 `plan/in-progress/widget-presentation-restore.md` 전체
  - 위반 규약: `spec/conventions/**` 자체는 아니나, 이 checker 를 호출한 `.claude/skills/consistency-checker/SKILL.md` §호출자 워크플로("spec 변경안을 `plan/in-progress/spec-draft-<name>.md` 에 작성")·`.claude/skills/project-planner/SKILL.md` §3("draft 작성: `plan/in-progress/spec-draft-<name>.md`")이 명시하는 명명 패턴
  - 상세: 본 문서는 `--spec` 모드로 검토되는 spec 변경안(§4-1)을 포함하지만 파일명에 `spec-draft-` prefix 가 없다. `plan/complete/` 에는 `spec-draft-*.md` 형태가 30건 이상 일관되게 존재해 이 패턴이 실질적 관례임을 보여준다. 다만 하드 강제(build guard/hook)는 없고, 이 저장소에는 spec 영향 항목을 포함하면서도 bare 이름을 쓰는 하이브리드 plan(조사+spec 정정+개발 후속)도 다수(`resume-llm-usage-attribution.md`, `node-cancellation-inflight-followups.md`, `trigger-param-output-enricher.md` 등) 존재해 완전한 위반이라 보기는 어렵다. frontmatter 스키마(`worktree`/`started`/`owner`)는 `.claude/docs/plan-lifecycle.md` §4 요구를 정확히 충족한다.
  - 제안: 정정이 필요할 만큼의 사안은 아니나, 순수하게 스타일 일관성을 원하면 `spec-draft-widget-presentation-restore.md` 로 리네임 가능. 그대로 두어도 무방(하이브리드 plan 관례 범위 내).

## 검증한 준수 항목 (참고)

- **명명 규약**: target 이 인용하는 식별자(`presentations?`, `PresentationPayload{type,toolCallId,renderedAt,payload,truncation?}`, `ConversationTurnSource`, `appendAiAssistantMessage`, `asEnvelope`)는 모두 `spec/conventions/conversation-thread.md` §1.1~§1.2 및 `spec/4-nodes/3-ai/1-ai-agent.md` §7.10 의 실제 명명과 정확히 일치한다. `PresentationPayload.truncation` 이 `payload` **바깥** 최상위 필드라는 target §3 의 핵심 주장은 §7.10 의 `type PresentationPayload` 블록(`truncation?: { itemsTruncated?, rowsTruncated?, itemsTotalCount?, rowsTotalCount? }`, `payload` 와 형제 필드)과 정확히 일치 — 오기입 없음.
- **출력 포맷 규약**: `output.rowsTruncated`/`output.itemsTruncated`/`output.{items|rows}TotalCount` 로 흡수하겠다는 §4-2 변경안은 `spec/4-nodes/6-presentation/0-common.md` §10.4("`output.{itemsTruncated|rowsTruncated}` … 와 동등한 메타가 top-level `presentations[i].truncation` 에 surface")를 코드가 아직 못 지킨 상태를 바로잡는 방향이며, `spec/conventions/node-output.md` Principle 1.1("런타임에 계산된 값 → `output`")·Principle 2 표 비고("Carousel/Table 의 `itemsTruncated`/`rowsTruncated` 같은 cap 정보는 `output` 에 둔다")와도 정합한다. `meta` 로 옮기거나 새 top-level 필드를 만드는 위반 패턴은 제안되지 않았다.
- **문서 구조 규약**: 최종 반영 대상인 `spec/7-channel-web-chat/1-widget-app.md` 는 이미 `## Overview` / 본문(§1~§3) / `## Rationale` 3섹션 구조를 갖추고 있고(8~121행), target 의 §4-1 변경안은 그 안의 §2 한 섹션만 정정하는 scope 라 구조를 깨뜨리지 않는다. plan 문서 자체도 frontmatter 필수 3필드를 충족하고 말미에 `## Rationale`(R1/R2/R3)을 두어 project-planner SKILL §3 의 "본문 끝에 `## Rationale`" 요구를 만족한다.
- **금지 항목**: R2 는 명시적으로 `ConversationTurnSource` 5-source enum(`conversation-thread.md` §1.1)을 확장하지 않는 방향을 택했고, 어떤 신규 inline marker(§1.6 금지 대상)도 제안하지 않는다. `data-hydration-surfaces.md` 의 "신규 output field 추가 시 매트릭스 갱신 필수" 절차도 이번 변경(`truncation` 은 이미 §7.10 에 정의된 기존 필드를 위젯이 못 읽던 버그 수정이지 신규 필드 추가가 아님)에는 해당하지 않아 매트릭스 미갱신이 위반이 아니다.
- **API 문서 규약(Swagger/DTO)**: 본 변경은 REST/WS DTO·컨트롤러 표면을 건드리지 않으므로 해당 없음(N/A).

## 요약

target plan 은 `spec/conventions/**` 이 정의하는 실제 규약(§1.1 5-source enum, §1.2 `presentations` 필드, AI Agent §7.10 `PresentationPayload` type, 0-common §10.4 truncation surface 계약, node-output.md Principle 1.1/2)을 정확히 인용하고 그 경계를 넘지 않는 변경안을 제시한다. 유일하게 눈에 띄는 것은 파일명이 project-planner/consistency-checker SKILL 이 기술하는 `spec-draft-<name>.md` 관례를 따르지 않는다는 점인데, 이는 `spec/conventions/**` 자체의 규약이 아니고 저장소에 하이브리드 plan 의 bare-naming 선례도 다수라 INFO 수준의 스타일 참고 사항에 그친다. CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.

## 위험도
NONE
