# 정식 규약 준수 검토 — target: `spec/5-system` (--impl-prep)

검토 대상: `spec/5-system/*.md` 전체 17개 기술 spec 파일 + `_product-overview.md`.
대조 규약: `spec/conventions/**`(특히 `error-codes.md`·`swagger.md`·`node-output.md`·`audit-actions.md`)
및 `CLAUDE.md`·`project-planner/SKILL.md` 의 문서 구조·명명 컨벤션.

이번 착수 작업(`removeMember` 권한 검사 순서)은 `spec_impact: none` 으로 spec 변경을 계획하지
않으므로, 본 검토는 **현재 `spec/5-system` 상태 자체**를 정식 규약 대비 점검하는 impl-prep
standing check 로 수행했다.

## 발견사항

- **[INFO]** `_product-overview.md` 를 제외한 17개 기술 spec 중 4개가 `## Overview` 표제를 쓰지 않는다
  - target 위치: `spec/5-system/11-mcp-client.md`(`## 1. 개요`로 대체) · `spec/5-system/5-expression-language.md`(`## 1. 개요`) · `spec/5-system/7-llm-client.md`(`## 1. 개요`) · `spec/5-system/16-system-status-api.md`(개요 표제 없이 본문 문단 직후 바로 `## 1. 대상 큐 레지스트리`로 진입)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" — `## Overview (제품 정의)` / 본문 / `## Rationale` 3섹션 권장
  - 상세: 같은 디렉터리의 13/17 파일(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`·`4-execution-engine.md`·`6-websocket-protocol.md`·`8-embedding-pipeline.md`·`9-rag-search.md`·`10-graph-rag.md`·`12-webhook.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`·`15-chat-channel.md`·`17-agent-memory.md`)은 명시적 `## Overview` 표제를 두고 있어, 이 4개 파일은 로컬 관행에서 벗어난다. `16-system-status-api.md` 는 개요 성격의 문단조차 번호 섹션 없이 표제 앞에 붙어 있어 나머지 세 파일(번호 섹션 `## 1. 개요` 형태로나마 존재)보다 이탈 폭이 크다. 규약이 "권장"이라 CRITICAL/WARNING 위반은 아니다.
  - 제안: 해당 4개 파일에 `## Overview` 표제를 추가해 나머지 13개와 형태를 맞추거나(내용은 그대로 두고 표제만 삽입), 또는 이 4개 파일 처럼 번호형 개요가 허용되는 로컬 예외임을 SKILL.md 에 명시해 규약과 실태의 괴리를 없앤다.

- **[INFO]** `## Overview` 표제 문구가 파일마다 다르다 (`## Overview` vs `## Overview (제품 정의)`)
  - target 위치: `spec/5-system/1-auth.md:27`·`3-error-handling.md:19`·`4-execution-engine.md:22`·`6-websocket-protocol.md:24` (표제만 `## Overview`) vs `2-api-convention.md:32`·`8-embedding-pipeline.md:21`·`9-rag-search.md:19`·`10-graph-rag.md:32`·`12-webhook.md:21`·`13-replay-rerun.md:20`·`14-external-interaction-api.md:39`·`15-chat-channel.md:37`·`17-agent-memory.md:14` (표제가 `## Overview (제품 정의)`, project-planner SKILL.md 의 정식 표기와 정확히 일치)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조" 표의 정확한 헤딩 문자열 `## Overview (제품 정의)`
  - 상세: 두 그룹 모두 내용상 "영역의 사용자 가치·요구사항·목표"를 담고 있어 실질 위반은 아니지만, 표제 문자열이 규약 원문과 다른 4개 파일이 존재해 `grep '## Overview (제품 정의)'` 류 기계적 점검을 하는 다음 사람에게 거짓 음성을 만들 수 있다.
  - 제안: 표제 문구를 `## Overview (제품 정의)` 로 통일하거나, 규약이 접미사를 필수로 요구하지 않음을 SKILL.md 에 명확히 해 둔다.

- **[INFO]** 나머지 관점(명명·출력 포맷·API 문서·금지 항목)은 위반 미발견
  - 확인한 것: (1) `3-error-handling.md` 의 전 에러 코드가 `UPPER_SNAKE_CASE` 이거나 `conventions/error-codes.md §3` historical-artifact 레지스트리에 명시적으로 등재된 lowercase 예외(`invitation_not_found` 계열)와 정확히 교차 참조된다 — 신규 미등재 lowercase 코드 0건. (2) 에러 응답 봉투(`{ error: { code, message, requestId, details? } }`)가 `2-api-convention.md §5.3` 과 `3-error-handling.md` Overview 간에 정합. (3) `swagger.md` 가 금지하는 `Patch*Dto` 패턴·`PUT` 메서드 사용이 `spec/5-system/**` 전체에서 0건. (4) `_product-overview.md` 는 다른 영역의 `_product-overview.md` 들과 동일하게 frontmatter(`id/status/code`) 없이 존재 — 이는 PRD 전용 파일의 기존 저장소 전반 패턴과 일치하며 위반이 아니다.

## 요약

`spec/5-system` 은 `spec/conventions/**` 규약(특히 에러 코드 명명·안정성 정책, 응답 봉투 형식, Swagger DTO 패턴)을 매우 촘촘하게 준수하고 있으며, 각 조문마다 SoT 경계·historical exception·rename 이력을 명시적으로 교차 참조해 두어 신규 CRITICAL/WARNING 급 위반은 발견되지 않았다. 유일하게 눈에 띄는 것은 "Overview/본문/Rationale 3섹션 권장" 이라는 연성 규약에서 4개 파일이 `## Overview` 표제를 생략하거나 다른 문구를 쓰는 문서 구조상의 국소적 비일관성으로, 이는 규약이 "권장"으로 명시한 항목이라 차단 사유가 되지 않는다. 금번 착수 작업(`removeMember` 권한 순서 정정)은 `spec_impact: none` 이며 spec 변경을 계획하지 않으므로 이 검토 결과가 착수를 막을 이유는 없다.

## 위험도

LOW
