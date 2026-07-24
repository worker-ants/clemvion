# 정식 규약 준수 검토 — `spec/4-nodes/6-presentation`

## 검토 범위에 대한 메모

이번 브랜치의 실제 코드 diff(`git diff origin/main`)는 `codebase/frontend/src/components/editor/run-results/output-shape.ts` 의 **JSDoc 주석 재작성(영→한 번역 + 재구성)** 뿐이며, 로직 변경도 `spec/4-nodes/6-presentation/**` 변경도 없다(해당 spec 디렉토리는 `origin/main` 대비 diff 0). 즉 이번 변경 자체가 새로 도입한 정식 규약 위반은 없다. 아래는 orchestrator 가 지목한 target 영역(`spec/4-nodes/6-presentation`)을 `spec/conventions/**`(특히 `node-output.md`, `conversation-thread.md`, `interaction-type-registry.md`, `error-codes.md`, `.claude/skills/project-planner/SKILL.md` 문서 구조 규약) 대비 직접 대조한 standing 감사 결과다.

검증 방법: `spec/conventions/node-output.md`(Principle 0~11 전문), `spec/conventions/conversation-thread.md`(헤딩·앵커), `spec/conventions/interaction-type-registry.md`, `spec/conventions/error-codes.md` 를 실제 워크트리에서 직접 Read 하여 target 문서의 각 인용·표·JSON 예시와 라인 단위로 대조했다. 주요 대조 결과:

- `output`/`config`/`meta`/`port`/`status` 5필드 사용 패턴, `interaction.data` shape(`button_click`/`button_continue`/`form_submitted`), 동적 포트 명명(`__item_<idx>`), config-echo 직교성(Principle 1.1), 판별자 금지(Principle 1.1.4), `previousOutput` 과도기 예외 서술은 모두 `node-output.md` 원문과 **정확히 일치**한다.
- `conversation-thread.md` 로의 앵커(`#12-conversationturn`, `#14-text-변환-규칙`, `#16-llm-facing-보안-마커`, `#24-opt-out` 등)는 실제 헤딩과 슬러그가 일치해 dangling 링크 없음.
- `interaction-type-registry.md` 의 `WaitingInteractionType`(`form`/`buttons`/`ai_conversation`/`ai_form_render`) · `PresentationType`(5종) 값과 target 의 `meta.interactionType` 사용이 일치.
- 에러 코드 표기(`INVALID_PAYLOAD`, `RESUME_INCOMPATIBLE_STATE`, `RETRY_STATE_NOT_FOUND`, `STATE_MISMATCH` 등)는 모두 `UPPER_SNAKE_CASE` — `error-codes.md` §1 표기 규율 준수.
- 문서 명명: `spec/4-nodes/_product-overview.md` 존재 확인(다중 spec 영역의 `_product-overview.md` 컨벤션), `0-common.md`/`1-carousel.md`~`5-template.md` 의 `N-name.md` 정렬 넘버링 확인 — `.claude/skills/project-planner/SKILL.md` §명명 컨벤션 준수.
- API 문서 규약(OpenAPI/Swagger 데코레이터·DTO 명명, `swagger.md`)은 본 target 문서에 REST DTO/Swagger 서술이 전혀 없어 **적용 대상 아님**(N/A) — presentation 노드 spec 은 내부 `NodeHandlerOutput` 계약만 다룬다.

## 발견사항

- **[WARNING] `3-chart.md` 에 `## Rationale` 섹션 부재**
  - target 위치: `spec/4-nodes/6-presentation/3-chart.md` (파일 끝, §7 캔버스 요약 이후 — 352줄로 종료, `## Rationale` 헤딩 없음)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §"Spec 문서 구조 (3섹션 권장)" — `## Overview` / 본문 / `## Rationale` 3섹션. CLAUDE.md 도 "각 spec 문서는 3섹션 (Overview / 본문 / Rationale)" 를 명시.
  - 상세: 같은 디렉토리의 형제 문서 `0-common.md`·`1-carousel.md`·`2-table.md`·`4-form.md`·`5-template.md` 는 전부 `## Rationale` 섹션을 갖는데 `3-chart.md` 만 없다. 더구나 `3-chart.md` §6 안에 "⚠ Caveat (P1) — `chartType` schema/handler 불일치" 라는 실제 설계 결정/알려진 갭 서술(왜 5종 vs 3종이 갈라졌는지, 두 해소안 A/B)이 표 아래 산문으로 끼어 있다 — 이 내용은 성격상 Rationale 섹션에 속하는 정보(결정 배경·미해결 갭 추적)인데 본문 표 뒤에 캐주얼하게 붙어 있어 형제 문서들의 "## Rationale" 관례와 어긋난다.
  - 제안: `3-chart.md` 끝에 `## Rationale` 섹션을 신설해 위 caveat 를 이관하거나(형제 문서 패턴과 정합), Rationale 이 정말 불필요하다는 판단이면(예: Chart 는 아직 캐노니컬 미해결 갭만 있고 확정 결정이 없어 Rationale 로 승격할 내용이 없다는 것이 의도라면) 그 사실 자체를 짧게 명시(예: "본 문서는 §6 caveat 외 별도 Rationale 이 없다 — 사유: …")해 누락이 아니라 의도임을 표시.

- **[INFO] `0-common.md` 섹션 번호가 §8 → §10 로 건너뜀 (§9 없음)**
  - target 위치: `spec/4-nodes/6-presentation/0-common.md` — `## 8. 출력 구조 색인` (line 277) 다음이 바로 `## 10. AI Tool 모드` (line 289)
  - 위반 규약: 명시적 규약 위반은 아님(정식 규약이 섹션 번호 연속성을 강제하지 않음) — 문서 구조 일관성 관점의 형식 제안.
  - 상세: 같은 디렉토리의 다른 5개 노드 문서(`1-carousel.md`~`5-template.md`)는 모두 `## 1` ~ `## 7`/`## 8` 까지 빠짐없이 연속 번호를 쓰는데, `0-common.md` 만 `§9` 가 빠져 있다. 문서 내부에서 `§9` 를 참조하는 곳은 없어(dangling 링크는 아님) 기능적 문제는 없으나, 향후 독자가 "§9 가 삭제됐나/원래 없었나"를 오인할 소지가 있다.
  - 제안: `§10` 을 `§9` 로 당기거나(번호 재정렬), 의도적으로 예약된 번호라면 그 사유를 주석으로 남긴다. 낮은 우선순위.

## 요약

이번 PR 의 실제 diff 는 spec 을 전혀 건드리지 않는 JSDoc 주석 재작성 한 건뿐이라 신규 정식 규약 위반은 없다. Orchestrator 가 지목한 target 영역(`spec/4-nodes/6-presentation` 전체)을 `node-output.md`/`conversation-thread.md`/`interaction-type-registry.md`/`error-codes.md`/문서 구조·명명 컨벤션과 직접 대조한 결과, 5필드 출력 계약·`interaction` payload shape·동적 포트 명명·config-echo 직교성·판별자 금지·에러 코드 표기·파일 명명(`_product-overview.md`, `N-name.md`, `0-` prefix)까지 폭넓게 원문과 정확히 일치했다. 유일한 구조적 흠은 `3-chart.md` 에 형제 문서들과 달리 `## Rationale` 섹션이 없고 그 자리에 있어야 할 설계 배경(chartType enum 5종/3종 drift)이 본문 표 아래 캐주얼하게 얹혀 있는 점(WARNING), 그리고 `0-common.md` 의 섹션 번호가 §9 를 건너뛰는 사소한 형식 문제(INFO)뿐이다. 둘 다 이번 diff 로 새로 생긴 문제가 아니라 기존 spec 의 residual 이다.

## 위험도

LOW
