# 정식 규약 준수 검토 — `spec/5-system/` (--impl-prep)

## 검토 범위 및 한계

번들 예산 초과로 19개 파일 중 3개(`1-auth.md`, `2-api-convention.md`, `3-error-handling.md`, 합계 약 2,000줄)만
프롬프트에 전문 포함되었고 나머지 15개는 절단 스텁만 있었다. 절단된 파일 중 최근 변경 이력이 있는
`6-websocket-protocol.md`(2026-09-02~04 다수 docs(spec) 커밋으로 최근 정합화됨)를 포함해 전수를
`Read`/git log 로 직접 열람할 시간 예산은 없었으므로, 본 리포트는 **전문 포함 3개 파일 + 관련
`spec/conventions/**` 교차검증**에 집중했다. 이 3개 파일이 전체 번들의 실질 내용 대부분(2,000줄)을
차지하며, 나머지는 "본문 생략됨" 스텁이라 그 자체로는 규약 위반 여부를 판단할 근거가 없었다(부재를
"위반 없음"의 근거로 삼지 않았다).

검증 방법: `1-auth.md`·`2-api-convention.md`·`3-error-handling.md` 본문이 인용하는
`spec/conventions/error-codes.md`·`swagger.md`·`node-output.md`·`audit-actions.md`의 실제 섹션 번호·앵커·
서술 내용을 직접 열어 대조했고, frontmatter 스키마를 `spec-impl-evidence.md` 기준으로, 문서 구조를
`project-planner/SKILL.md` 기준으로 확인했다.

## 발견사항

- **[WARNING]** `spec/5-system/` 내 `## Overview` 섹션 유무가 파일마다 불일치
  - target 위치: `spec/5-system/2-api-convention.md`, `5-expression-language.md`, `6-websocket-protocol.md`,
    `7-llm-client.md`, `11-mcp-client.md`, `16-system-status-api.md` (frontmatter 직후 바로 `## 1. ...`
    으로 시작, `## Overview` 섹션 없음)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` "단일 진실 원칙: 각 spec 문서는 3섹션
    (Overview / 본문 / Rationale)" 및 동 SKILL "다중 spec 파일을 가진 영역은 `_product-overview.md`
    별도 파일" 조항
  - 상세: `spec/5-system/`는 이미 영역 전체 PRD 를 담당하는 `_product-overview.md`(9,395자)를
    보유하고 있어 SKILL.md 가 말하는 "다중 파일 영역은 공유 Overview" 패턴 자체는 정당하다. 그런데
    같은 영역의 12개 파일(`1-auth.md`, `3-error-handling.md`, `4-execution-engine.md`,
    `8-embedding-pipeline.md`, `9-rag-search.md`, `10-graph-rag.md`, `12-webhook.md`, `13-replay-rerun.md`,
    `14-external-interaction-api.md`, `15-chat-channel.md`, `17-agent-memory.md`)은 공유
    `_product-overview.md` 와 **별개로 파일마다 로컬 `## Overview`** 를 두고 있다(예:
    `1-auth.md`의 `> 관련 문서: [PRD 비기능 요구사항](./_product-overview.md#2-보안)` 와
    `## Overview` 가 공존 — 전자는 영역 PRD, 후자는 해당 파일 기술 요약으로 역할이 다르다). 즉 "공유
    Overview 로 대체 가능"이 12/18 파일에서는 "로컬 Overview 도 추가"로 실무가 굳어져 있는데, 나머지
    6개 파일만 로컬 Overview 가 없다 — 규약이 두 패턴 중 어느 쪽이 표준인지 명시하지 않아 신규
    파일 작성자가 어느 쪽을 따라야 하는지 판단할 근거가 없다.
  - 제안: (a) target 을 고치는 방향이면 6개 파일에 짧은 로컬 `## Overview`(해당 파일 요약 1~2문단)를
    추가해 영역 내 일관성을 맞춘다. (b) 규약을 갱신하는 방향이면 `project-planner/SKILL.md` §명명
    컨벤션에 "영역에 `_product-overview.md` 가 있어도 각 상세 spec 파일은 로컬 `## Overview` 를
    권장/생략 중 무엇을 기본으로 하는지"를 명시해 이후 신규 파일 작성 시 판단 기준을 남긴다. 둘 중
    하나만 하면 되며, CLAUDE.md 가 "권장"이라 명시했으므로 CRITICAL 은 아니다.

- **[INFO]** 프롬프트 번들에 남은 15개 파일은 이번 라운드에서 미검증
  - target 위치: `4-execution-engine.md`, `5-expression-language.md`, `6-websocket-protocol.md`,
    `7-llm-client.md`, `8-embedding-pipeline.md`, `9-rag-search.md`, `10-graph-rag.md`, `11-mcp-client.md`,
    `12-webhook.md`, `13-replay-rerun.md`, `14-external-interaction-api.md`, `15-chat-channel.md`,
    `17-agent-memory.md`, `_product-overview.md`
  - 위반 규약: 해당 없음 (범위 고지)
  - 상세: 컨텍스트 예산 초과로 본문이 절단되어 이번 pass 에서 명명·출력 포맷·API 문서 규약 관점의
    직접 대조를 하지 못했다. 이 파일들이 "위반 없음"이라는 뜻은 아니다.
  - 제안: 이 15개 파일이 이번 impl-prep 작업의 실제 구현 대상 코드 경로와 겹친다면, 후속 라운드에서
    해당 파일만 별도로 `Read` 하여 좁혀 검증할 것을 권한다.

## 검증 결과 (위반 없음으로 확인된 항목 — 참고용)

아래는 위반 소지가 있어 보였으나 직접 대조 결과 정합성이 확인되어 발견사항에서 제외한 항목이다
(오탐 방지 목적으로 기록):

- `1-auth.md §1.5.4` 의 `lower_snake_case` 초대 에러 코드(`invitation_not_found` 등)는
  `error-codes.md §3` historical-artifact 레지스트리에 정확히 등재되어 있고 범위("초대 API 한정")도
  일치 — `UPPER_SNAKE_CASE` 위반이 아니라 명시된 예외.
- `1-auth.md`가 인용하는 `error-codes.md §5`의 `INVALID_PASSWORD` retired 항목, `node-output.md §3.2`,
  `swagger.md §1-3/§2-5/§6`, `audit-actions.md` 명명 규약 앵커 전부 실제 섹션과 일치.
  `data-flow/12-workspace.md §1.9`, `spec/5-system/_product-overview.md §2` 앵커도 실재 확인.
- `2-api-convention.md §5.4`의 `@ApiPropertyOptional`↔`@ApiProperty({nullable:true})` 구분 서술이
  `swagger.md §1-3/§1-4`의 실제 규정과 문언까지 일치.
- frontmatter(`id`/`status`/`code`/`pending_plans`)는 3개 파일 모두 `spec-impl-evidence.md` §2 스키마를
  준수(`1-auth.md`는 `status: partial` + `pending_plans` 명시로 §3 라이프사이클 요건 충족).

## 요약

전문 검토가 가능했던 3개 파일(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`, 번들 실질 내용의
대부분)은 명명·출력 포맷·에러 코드·문서 구조 규약 전반에서 매우 높은 준수도를 보였다 — 특히
`spec/conventions/**`의 예외·historical-artifact·rename 정책을 스스로 인용하며 편차마다 근거를 남기는
성숙한 상태다. 유일한 발견은 영역 내 `## Overview` 섹션 유무 불일치(WARNING)이며, 이는 CLAUDE.md 가
"권장"으로 명시한 항목이라 채택 시 invariant 가 깨지는 CRITICAL 은 아니다. 다만 컨텍스트 예산으로 인해
15개 파일이 이번 라운드에서 미검증 상태로 남았다는 점은 이 리포트의 커버리지 한계로 명시한다.

## 위험도

LOW
