# 정식 규약 준수 검토 — spec-draft-cafe24-countmax.md

대상: `spec-draft-cafe24-countmax.md` (Cafe24 카탈로그 규모 실측 정정 + 대형 카탈로그 allowlist 경고 명문화, D1~D4)
검토 모드: `--spec` draft 검토

## 발견사항

- **[WARNING] 실측 근거(측정방법론) 인용 위치가 문서 구조 규약(Overview/Rationale 분리)과 어긋남**
  - target 위치: D1 변경 1-1 (`4-cafe24.md` §Overview "지원 범위" 불릿, L29) — "(2026-07-17 실측 — 카탈로그 `supported` 행 = 백엔드 metadata operation, `catalog-sync.spec.ts` 가 양방향 강제)" 를 Overview 섹션 본문에 인라인 삽입
  - 위반 규약: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" / `project-planner` SKILL.md "Spec 문서 구조" — `## Overview (제품 정의)` 는 "영역의 사용자 가치·요구사항·목표", `## Rationale` 이 "결정 배경·근거"를 소유
  - 상세: 3중 교차검증 방법론(카탈로그 행 집계·백엔드 metadata 집계·`catalog-sync.spec.ts` 양방향 강제)은 "왜 485 를 신뢰할 수 있는가"라는 근거(rationale) 서술이지 제품 정의(Overview)가 아니다. 정작 이 수치가 실제로 쓰이는 §9 Rationale(변경 1-2, L446)에는 반대로 날짜·근거 언급 없이 숫자만 치환된다 — 근거 서술과 실제 사용처가 뒤바뀐 배치. repo 내 기존 관례도 이를 뒷받침한다: `spec/3-workflow-editor/2-edge.md` 의 "실측 보강" 서술은 `## Rationale` 하위 `### R-1~R-3` (날짜 타이틀 포함)에, `spec/7-channel-web-chat/1-widget-app.md` 의 "실측 확인" 서술도 `## Rationale` 하위 `### R8` 에 위치 — 둘 다 본문/Overview 가 아닌 Rationale 에 측정 근거를 둔다.
  - 제안: 변경 1-1 의 Overview 불릿은 결론값만("485 endpoint")으로 남기고, 3중 교차검증 방법론·날짜는 §9 Rationale 에 신설 서브섹션(예: `### 9.x 카탈로그 규모 실측 정정 (2026-07-17)`)으로 옮겨 변경 1-2 와 합치는 편이 기존 문서 구조 관례에 부합. draft 자신의 "검토 요청 관점 3"이 명시적으로 묻는 질문에 대한 답이기도 하다.

- **[WARNING] D1 만 날짜·출처가 명시되고 D2·D3·D4 는 동일 출처 수치를 무각주로 인용 — 출처·시점 표기 일관성 부재**
  - target 위치: D2 (`1-ai-agent.md §4.2` note), D3 (`11-mcp-client.md §5.8`), D4 (`0-overview.md §6.1`) — 세 곳 모두 "Cafe24 485" / "MakeShop 161" 을 별도 날짜·출처 표기 없이 리터럴로 인용
  - 위반 규약: 명시적 "정식 규약" 조항은 아니나, 본 draft 가 스스로 만드는 관례(D1 의 "2026-07-17 실측" 표기)와 내부 불일치. CLAUDE.md 의 단일 진실 원칙("기술 명세 → spec/<영역>/*.md 본문", "결정의 배경·근거 → Rationale")이 요구하는 "출처 추적 가능성"이 D2~D4 에는 결여
  - 상세: 이번 drift(`~180` 화석)의 원인 자체가 "카탈로그 실측치를 날짜 없이 산문에 리터럴로 박아넣고 이후 갱신을 추적하지 않은 것"이었다. D2·D3·D4 는 같은 2026-07-17 실측값을 다시 여러 문서(4곳: 4-cafe24.md, 1-ai-agent.md, 11-mcp-client.md, 0-overview.md)에 리터럴로 복제하면서 D1 을 제외한 3곳에는 날짜·SoT 링크가 없다 — 향후 카탈로그가 갱신되면 이 신규 인용들도 무신호로 재화석화(re-fossilize)될 위험이 있고, 이는 정확히 이번에 발견된 drift 패턴의 재현이다.
  - 제안: D2/D3/D4 의 485/161 언급에도 "(2026-07-17 실측, [Cafe24 카탈로그 §5](../../conventions/cafe24-api-catalog/_overview.md#5-coverage-matrix) 기준)" 류의 SoT 링크·날짜를 병기하거나, 최소한 D1(4-cafe24.md)만을 숫자의 SoT 로 규정하고 D2~D4 는 리터럴 대신 "[§지원 범위](../4-integration/4-cafe24.md) 참조" 형태의 링크 위주 서술로 낮추는 것을 고려.

- **[WARNING] draft 가 다루는 4개 파일 밖에도 동일 화석 수치가 남아있음 (미포함 잔여 인스턴스)**
  - target 위치: `spec/2-navigation/4-integration.md:1110` — "Cafe24 의 경우 도구 수가 많아(Resource × Operation = ~180) allowlist UI 가 카테고리 단위 grouping 으로 노출된다"
  - 위반 규약: `spec/4-nodes/4-integration/4-cafe24.md §9.3` 자신이 명시한 원칙 — "spec 본문에 endpoint enumeration 을 인라인하지 않는다 — **drift 방지 목적**". draft 의 존재 이유(§배경 "1. 수치 화석") 와 정면으로 같은 종류의 화석이 미수정 상태로 잔존
  - 상세: draft 의 "검토 요청 관점 1"이 명시적으로 "485 수치가 다른 spec 의 Cafe24 서술(`2-navigation/4-integration.md §5.8`, ...)과 충돌하지 않는가?"를 묻고 있는데, 실제로 확인한 결과 해당 파일 1110행에 동일한 `~180` 화석이 그대로 남아있고 D1~D4 어디에도 이 파일에 대한 수정 항목이 없다. draft 를 그대로 적용하면 "카탈로그 실측 485" 라는 새 사실과 "Resource × Operation = ~180" 이라는 구 서술이 spec 트리 안에 동시에 존재하게 되어, 이번 draft 가 해소하려는 바로 그 문제(수치 화석)를 완전히 닫지 못한다.
  - 제안: D5 로 `spec/2-navigation/4-integration.md:1110` 의 `~180` → `485` (또는 D1 로 링크하고 리터럴 제거) 정정을 D-list 에 추가.

- **[INFO] D2 의 §5.6 cross-link 이 heading anchor 를 누락 — 확립된 인용 패턴과 불일치**
  - target 위치: D2 (`1-ai-agent.md §4.2` 신설 note) — "`mcpServers[].enabledTools`([11-mcp-client §5.6](../../5-system/11-mcp-client.md))"
  - 위반 규약: 명시적 conventions 파일 조항은 아니고 `spec-link-integrity.test.ts` 가드도 앵커 부재 자체는 fail 시키지 않지만, 동일 대상(§5.6 도구 allowlist)을 가리키는 기존 cross-link 는 모두 heading anchor 를 포함하는 것이 확립된 패턴 — 예 `spec/2-navigation/4-integration.md:1110` 의 `[Spec MCP Client §5.6](../5-system/11-mcp-client.md#56-도구-allowlist)`, `spec/5-system/11-mcp-client.md:339` 의 `[AI Agent §4.2](../4-nodes/3-ai/1-ai-agent.md#42-도구-정의-payload-예산-tool-definition-payload-budget)`
  - 상세: 앵커 누락이 빌드를 깨지는 않으나(가드는 앵커가 있을 때만 slug 일치를 검증), 문서 전반에서 특정 절(§N.N)을 가리킬 때는 예외 없이 정확한 anchor slug 를 붙이는 것이 이 codebase 의 일관된 스타일이다.
  - 제안: `#56-도구-allowlist` 앵커를 붙여 `[11-mcp-client §5.6](../../5-system/11-mcp-client.md#56-도구-allowlist)` 로 통일.

- **[INFO] draft 파일이 아직 `plan/in-progress/` 에 있지 않음 (workflow 단계상 위치 확인 필요)**
  - target 위치: 대상 문서 경로 자체 — scratchpad 임시 경로 (`.../scratchpad/spec-draft-cafe24-countmax.md`)
  - 위반 규약: `project-planner` SKILL.md 워크플로 3단계 — "draft 작성: `plan/in-progress/spec-draft-<name>.md`" (본 검토(`--spec`)는 4단계에서 호출되는 것이 정석)
  - 상세: 파일명 자체(`spec-draft-cafe24-countmax.md`)는 명명 패턴을 정확히 따르나, 현재 orchestrator 가 scratch 경로에서 본 검토를 호출하고 있어 실제 `plan/in-progress/` 반영 여부를 알 수 없다. 검토 통과 후 정식 위치로 옮겨졌는지 확인 필요 — 순수 오케스트레이션 스테이징이라면 문제 없음.
  - 제안: 별도 조치 불필요 — 최종 반영 시 `plan/in-progress/spec-draft-cafe24-countmax.md` 실존만 확인.

## 그 외 검토 관점 — 위반 없음

- **명명 규약**: draft 는 "신규 식별자 0건"을 명시하며 실제로 D1~D4 모두 기존 식별자(`AI_AGENT_TOOL_COUNT_MAX`, `TOOL_DEFINITION_PAYLOAD_EXCEEDED`, `enabledTools` 등)만 재인용 — 위반 없음.
- **출력 포맷 규약**: API 응답·이벤트 페이로드·에러 코드 신규/변경 없음 — 해당 없음.
- **API 문서 규약**: OpenAPI/Swagger DTO·데코레이터 변경 없음 — 해당 없음.
- **금지 항목**: `4-cafe24.md §9.3` 의 "spec 본문에 endpoint enumeration 을 인라인하지 않는다" 는 draft 가 준수 (합계 수치만 병기, enumeration 미포함).
- **D2 note 의 blockquote + 날짜 타이틀 포맷** (`> **대형 카탈로그 주의 (2026-07-17)**: ...`) 은 `1-ai-agent.md`·`11-mcp-client.md` 전반에 이미 확립된 스타일(`> **구현 현황 (2026-07-06 갱신)**`, `> **비채택 (won't-do, 2026-07-16)**` 등)과 일치 — 위반 없음.
- **D4 의 대칭 개선**(MakeShop 행과 동일하게 Cafe24 행에 규모 병기)은 `0-overview.md §6.1` 기존 테이블 관례에 정확히 부합 — 위반 없음.

## 요약

본 draft 는 신규 식별자·API 계약·출력 포맷 변경이 전혀 없는 순수 문서 정정이라 명명·출력 포맷·API 문서 규약 관점에서는 위반이 없다. 다만 "정정 근거를 어디에 둘 것인가"(Overview vs Rationale)라는 draft 스스로 제기한 질문에 대해 실제로는 근거 서술이 Overview 에, 결과값 치환이 Rationale 에 놓이는 뒤바뀐 배치를 취하고 있어 CLAUDE.md 의 정보 저장 단일 진실 원칙 및 기존 repo 관례(edge.md/widget-app.md 의 Rationale 배치)에서 벗어난다. 또한 D1 에만 날짜·근거를 표기하고 D2~D4 는 동일 수치를 무각주로 재인용해 "출처·시점 표기"의 내적 일관성이 없으며, 이는 이번 drift(~180 화석)를 만든 것과 같은 패턴을 새 문서 3곳에 다시 심는 결과다. 가장 실질적인 결함은 `spec/2-navigation/4-integration.md:1110` 의 동일 화석(`~180`)이 D-list 에서 누락돼, draft 적용 후에도 spec 트리 안에 상충하는 두 수치가 공존하게 된다는 점이다. 이 세 WARNING 은 모두 spec 반영 전 draft 개정으로 저비용 해소 가능하며, CRITICAL 급 invariant 위반은 없다.

## 위험도

MEDIUM
