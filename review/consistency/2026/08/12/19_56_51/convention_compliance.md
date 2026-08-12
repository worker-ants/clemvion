# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-eia-idempotency-key-scope.md`

## 발견사항

- **[WARNING] draft 문서에 `## Rationale` 섹션이 없다**
  - target 위치: 문서 전체 (헤더 목록 — `## Overview` / `## 왜 지금 하나…` / `## 무엇이 깨지는가…` / `## 스코프 식별자를…` / `## 제안 변경` / `## 구현 인계…` / `## 동반 갱신…` / `## 체크리스트`)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` §작업워크플로 3번("`plan/in-progress/spec-draft-<name>.md` 에 변경안 작성. **본문 끝에 `## Rationale` 로 결정 근거 명시**") 및 4번("BLOCK: NO + Warning → `## Rationale` 에 노트 남기고 진행") — CLAUDE.md 의 "문서 구조 규약(Overview/본문/Rationale 3섹션)"이 가리키는 바로 그 SKILL.md 조항.
  - 상세: target 은 결정 근거(무엇이 깨지는가, 왜 execution 단위인가, 왜 endpoint 축을 추가하는가)를 여러 주제별 섹션에 **분산 서술**하고 있고, 끝에 `## Rationale` 표제의 전용 섹션이 없다. 향후 `/consistency-check --spec` 실행 결과가 BLOCK:NO+Warning 으로 나오면 그 노트를 남길 지정 자리도 없다. 이 규약은 죽은 문구가 아니다 — `git ls-files plan/complete/spec-draft-*.md` 로 최근 완료된 draft 10건을 표본 확인한 결과 다수(`spec-draft-workspace-settings-api.md`, `spec-draft-refactor-04-security-drift.md`, `spec-draft-rag-reranking.md` 등)가 `## Rationale`(또는 `## Rationale (...)"）을 실제로 갖추고 있다. 다만 형제 draft `plan/in-progress/spec-draft-eia-r8-alignment.md` 도 동일하게 이 섹션이 없어(대신 `## 변경 N — …` 스타일로 사유를 본문 중간에 흩어 둠) 최근 두 신규 draft 모두에서 같은 이탈이 반복되고 있다.
  - 제안: (a) target 끝에 `## Rationale` 섹션을 신설해 "왜 execution 단위인가"·"왜 endpoint 축까지 넣는가"·"토큰 대신 executionId 를 쓰는 이유" 요약과, `consistency-check --spec` 결과 노트를 담는 것을 권장. 또는 (b) 만약 프로젝트가 실제로 "주제별 섹션에 근거를 분산 서술"하는 스타일로 전환하려는 의도라면, SKILL.md §작업워크플로 3·4번을 그 실제 관행에 맞게 갱신하는 편이 규약과 관행의 괴리를 없앤다.

- **[INFO] 제안 Redis 키가 `spec/5-system/4-execution-engine.md §9.1` 의 정식 키 패턴을 따르지 않는다 (스코프 경계 참고용)**
  - target 위치: `## 제안 변경` §1 표, `spec/data-flow/15-external-interaction.md` L93/L98/L258 변경안 — 새 키 `interaction:idempotency:<executionId>:<endpoint>:<key>`
  - 위반 규약: 엄밀히는 `spec/conventions/**` 소속 파일이 아니라 `spec/5-system/4-execution-engine.md §9.1`("모든 Redis 키는 `{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴을 따른다")이다. 다만 `spec/conventions/execution-context.md` §원칙4 가 "Redis 키 패턴(§9.1)"을 명시적으로 교차 참조하는 자매 규약이라 인접 사안으로 기록한다.
  - 상세: 기존 `interaction:idempotency:<key>` 도 이미 §9.1 패턴을 따르지 않는 상태였고(`workspaceId` 세그먼트 부재), §9.1 하단의 "패턴 예외 전역 키" 목록(`exec:recover:lock`, `exec:cont:seq:<executionId>`, `exec:seq:<executionId>`)에도 `interaction:idempotency:*` 는 등재돼 있지 않다 — 즉 이 키는 애초에 명명 레지스트리의 사각지대였다. target 은 이 키에 `<executionId>:<endpoint>` 두 세그먼트를 더 얹지만 §9.1 패턴에 맞추거나(예: `{service}:{workspaceId}:{resource}:{id}:{sub}` 형태로 재정렬) 예외 목록에 등재하는 방향으로는 다루지 않는다. 새 위반을 만드는 것은 아니고(이미 있던 이탈을 연장) 채택해도 다른 시스템 invariant 가 깨지지는 않는다.
  - 제안: 이번 draft 가 정확히 이 키를 손대는 시점이므로, `spec/5-system/4-execution-engine.md §9.1` 예외 목록에 `interaction:idempotency:<executionId>:<endpoint>:<key>` 를 한 줄(비-워크스페이스 스코프인 이유 — execution 단위 멱등성이라 명시)로 등재해 두면 다음에 이 표를 읽는 사람이 "빠졌나?"를 다시 조사하지 않아도 된다. 필수 아님(INFO) — 이 draft 의 `spec_impact` 범위(`data-flow/15`, `5-system/14`)에 `4-execution-engine.md` 가 포함돼 있지 않아, 하려면 `spec_impact` 목록도 함께 늘려야 한다.

- **[INFO] 새 키 세그먼트 `<endpoint>` 가 같은 문서 안의 기존 `endpointPath` 용어와 표기가 겹친다**
  - target 위치: `## 제안 변경` §1 표 — `interaction:idempotency:<executionId>:<endpoint>:<key>`
  - 위반 규약: 명시적 명명 규약 위반은 아니다 — 참고용 명료성 제안.
  - 상세: `spec/5-system/14-external-interaction-api.md` 는 이미 `endpointPath`(webhook trigger 식별자 slug, L170·L219·L796·L811·L920·L964)라는 전혀 다른 개념에 "endpoint" 어근을 쓰고 있다. target 이 새로 도입하는 `<endpoint>` 세그먼트(값은 `interact`|`cancel` 두 라우트 중 하나로 추정)는 같은 문서군 안에서 다른 의미로 재사용돼 착오 소지가 있다.
  - 제안: `<endpoint>` 대신 `<command>`/`<route>` 등으로 명명하거나, 표 옆에 "값은 `interact`|`cancel`" 처럼 값 도메인을 한 줄 명시해 `endpointPath`(webhook slug)와 혼동되지 않게 한다.

## 요약

target 은 스코프 취약점 자체의 분석·근거는 탄탄하고(실제 코드(`interaction.guard.ts`)의 `req.interaction.executionId` 필드명·형제 endpoint(`interact`/`cancel`) 존재를 정확히 인용하며, `EIA-IN-11`/`EIA-RL-02`/§R8 라인 인용도 실제 spec 내용과 일치한다), `spec_impact` frontmatter 도 YAML 리스트 형식으로 정상이다. 다만 정식 규약 관점에서는 project-planner SKILL.md 가 명시하는 draft 문서 구조("본문 끝에 `## Rationale`")를 갖추지 않았다는 점이 유일한 실질적 이탈이며, 이는 형제 draft(`spec-draft-eia-r8-alignment.md`)에서도 반복되고 있어 개별 실수라기보다 최근 두 draft 에 공통된 패턴이다. Redis 키 네이밍 관련 지적 두 건은 엄밀히 `spec/conventions/**` 밖(5-system 문서)의 패턴이라 등급을 낮춰 INFO 로 남긴다.

## 위험도

LOW
