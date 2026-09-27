# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 2건, 둘 다 근본 원인이 developer(`--impl-prep`) 권한 밖(spec 문구 정정)이라 planner 인계 필요

## 전체 위험도
**CRITICAL** — `spec/2-navigation/1-workflow-list.md` 가 현재 없는 검증을 있다고 서술하고 있고(기존 결함), 이번 plan 의 캔버스 저장 검증 처방이 `spec/data-flow/11-workflow.md` 의 "무검증" 계약을 착지 즉시 깬다(신규 결함) — 둘 다 project-planner 턴 없이는 developer 가 고칠 수 없는 spec 텍스트 문제.

> **범위 캐비엇** (convention_compliance 보고): 프롬프트 번들이 컨텍스트 예산 초과로 `spec/2-navigation/` 18개 파일 중 3개(`1-workflow-list.md`·`2-trigger-list.md`·`3-schedule.md`)만 전문을 받았다. 나머지 15개는 이번 라운드 정식 규약 준수 여부가 검증되지 않았다 — "발견사항 없음"을 "위반 없음"으로 일반화하지 말 것. 5개 checker 보고서 전문은 모두 확보됨(재시도 필요 항목 없음).

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 폴더 생성 API 문서가 실제로 없는 "같은 워크스페이스" 검증을 있다고 서술 — data-model 의 무조건 제약을 근거로 들지만 실제 `folders.service.ts create()`→`getDepth()` 는 다른 워크스페이스의 `parentId` 에 대해 즉시 `undefined`→depth=1 로 통과시켜 검증하지 않는다(plan 자신의 (D) 표도 이를 확인) | `spec/2-navigation/1-workflow-list.md` §3.1 API 표 PATCH 행 + Rationale §3 | `spec/1-data-model.md` §2.5(무조건 제약) vs 실제 코드 · `1-workflow-list.md` §3.1 POST 행(워크스페이스 검사 미언급) | project-planner 턴에서 (i) POST 행에 워크스페이스 검사 명시 추가 또는 (ii) 현재 상태를 정확히 반영하도록 문구 되돌린 뒤, 구현 착지 후 "생성·부모 변경 양쪽 강제"로 재갱신 |
| 2 | cross_spec | plan 처방(캔버스 저장에 `containerId`/`toolOwnerId` 소속 검증 추가)이 "저장 경로는 검증 없이 그대로 저장한다"는 기존 spec 계약을 정면으로 반증하는 새 검증을 그 동일 경로에 추가 — `spec_impact: none` 으로 시작해 착지 즉시 그 문장을 거짓으로 만든다 | `plan/in-progress/cross-workspace-refs.md` §처방 (영향 코드: `workflows.service.ts saveCanvas`) | `spec/data-flow/11-workflow.md` §1.2/§2.1 "저장 경로는 `container_id`/`tool_owner_id` 를 검증 없이 그대로 저장"(cycle/type 검사는 런타임·ShadowWorkflow 로 명시적으로 이관) · `spec/3-workflow-editor/0-canvas.md` §11.2.1/§11.2.2 | `--impl-prep` 통과 전 project-planner 로 `data-flow/11-workflow.md` §1.2·§2.1(및 `0-canvas.md` §11.2.1 각주)을 "저장 시점엔 교차-워크플로 참조만 거부, 타입/순환 검증은 여전히 런타임·ShadowWorkflow 몫"으로 갱신 선행 — 또는 최소한 plan `spec_impact` 를 `none` 에서 이 파일들로 변경해 구현과 동일 PR 에 spec 갱신 동봉 |

## planner 인계 (권한 밖 Critical)

> 위 Critical 중 근본 원인이 호출자 권한 밖인 항목만. **여기 실려도 등급은 CRITICAL 그대로이고
> `BLOCK: YES` 도 그대로입니다** — 이 표는 차단을 푸는 장치가 아니라 다음 행동을 지정하는
> 장치입니다.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| 1 | developer(`--impl-prep`) 는 `spec/` 쓰기 권한 없음(read-only) — 자기-반증형 소정정 예외도 미해당(developer 가 쓴 예고 문장이 아니라 2026-07-05 자 확정 API 계약 서술) | project-planner | `spec/2-navigation/1-workflow-list.md` §3.1 PATCH 행 + Rationale §3 — POST 행과의 서술 불일치 해소 | `plan/in-progress/cross-workspace-refs.md` (spec_impact 현재 `none`, 갱신 필요) |
| 2 | 구현 중 spec 계약(데이터 검증 범위) 변경 필요 — CLAUDE.md "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙 적용 대상, 자기-반증형 소정정 조건 2(예고·트리거만 해당, API/데이터 계약 명시적 배제)에도 해당 없음 | project-planner | `spec/data-flow/11-workflow.md` §1.2·§2.1, `spec/3-workflow-editor/0-canvas.md` §11.2.1 각주 | `plan/in-progress/cross-workspace-refs.md` (spec_impact 현재 `none`, 갱신 필요) |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | Trigger(§2.8)/Schedule(§2.9) 항목에 Folder(§2.5)와 대칭되는 "같은 워크스페이스" 제약 문구 부재 | `spec/1-data-model.md` §2.8/§2.9 | `spec/1-data-model.md` §2.5 Folder "제약 조건" 블록(선례) | spec_impact 반영 시(위 Critical 처리와 같은 타이밍) §2.8/§2.9 에도 Folder §2.5 형식의 "`workflow_id` 는 같은 워크스페이스의 Workflow 만 가리킨다" 문구 추가 |
| 2 | plan_coherence | "이 PR 밖으로 넘기는 것" 두 항목(트리거 `config` 내 비밀 참조 미검증, 실행 경로 방어선·운영 데이터 점검)이 근거까지 확보됐으나 아직 트래커에 미등재 | `plan/in-progress/cross-workspace-refs.md` §"이 PR 밖으로 넘기는 것" | `plan/in-progress/spec-draft-nullable-notation-followups.md` (현재 관련 항목 없음) | `--impl-done` 전 두 항목이 실제로 `spec-draft-nullable-notation-followups.md` 에 추가됐는지 확인 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | generic `VALIDATION_ERROR`+`details.field`(vs §1.11 `AUTH_CONFIG_NOT_FOUND` 특화 코드)는 기각된 대안 재도입이 아니라 실제 다수 관행(12/13)에 부합 | `plan/in-progress/cross-workspace-refs.md` §처방 | plan 문구에 "§1.11 은 예외, 12/13 이 다수"라는 대조를 한 줄 남겨 두면 후속 planner 턴이 §5.3 재논쟁 반복 방지 |
| 2 | rationale_continuity | 폴더 생성 경로 소속 검사 추가는 2026-07-05 Rationale 이 이미 선언(그러나 코드 미달성)한 설계를 뒤늦게 실현하는 것 — 새 결정 아님 | `1-workflow-list.md` Rationale §3 | 커밋/CHANGELOG 에 "코드가 뒤늦게 선언에 도달"이라는 실측 기록 |
| 3 | rationale_continuity | Edge/Node "같은 workflow_id" 불변식은 `data-model.md` §2.7 에 이미 명문화 — 처방은 강제 지점 격상, 충돌 아님 | `1-data-model.md` §2.7 | 없음 |
| 4 | convention_compliance | `GET /api/folders` 응답 envelope 형태(`{data: FolderDto[]}`)를 target 문서가 언급 안 함 — 워크플로 목록 행은 "§5.2 준수" 명시로 비대칭 | `1-workflow-list.md` §3.1 | 폴더 목록 행에 "비-페이징 배열, `swagger.md §5-2 ApiOkWrappedArrayResponse` 참고" 한 줄 추가 가능(비필수) |
| 5 | plan_coherence | data-model·에러처리 규약이 이미 이 처방을 승인한 상태 — 새 정책 도입이 아니라 기존 선언의 뒤늦은 집행 | `1-data-model.md` §2.5/§2.7, `5-system/3-error-handling.md` §1.11 | CHANGELOG/PR 설명에 "기존 불변식 미집행 상태를 닫음"으로 기록 |
| 6 | plan_coherence | `1-workflow-list.md` frontmatter `pending_plans` 에 이미 완료된 plan 잔존 + 이 문서를 반복 지목하는 진행 중 트래커 누락 (이번 PR 범위 밖, 기존 상태) | `spec/2-navigation/1-workflow-list.md` frontmatter | planner 턴에서 frontmatter 정리 시 참고 |
| 7 | naming_collision / cross_spec | "교차 워크스페이스 workflowId 참조"에 두 계열 공존 — 저장 시점(신규, generic `INVALID_FIELD`) vs 실행 시점(기존, typed `WORKFLOW_FORBIDDEN_WORKSPACE`). 이름 충돌은 아니나 개념 중복으로 혼동 가능 | 신규 `INVALID_FIELD` 검증 대 기존 `spec/4-nodes/2-flow/1-workflow.md`/`5-system/3-error-handling.md` §1.11 | spec 반영(트래커) 시 두 계약을 상호 참조해 "다른 계층·시점"임을 한 줄 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | CRITICAL | 폴더 생성 검증 부재를 spec 이 "있다"고 서술(기존 결함) + 캔버스 저장 무검증 계약을 plan 처방이 깸(신규 결함) |
| rationale_continuity | LOW | 처방이 기존 Rationale·data-model 불변식과 정합, 새 결정 아님(3건 INFO) |
| convention_compliance | LOW | 검증된 3개 파일은 `spec/conventions/**` 전항목 준수, 단 15/18 파일 미검증(범위 캐비엇) |
| plan_coherence | LOW | 처방은 기존 선언의 뒤늦은 집행, 트래커 미등재 2건(WARNING)·frontmatter staleness(INFO) |
| naming_collision | NONE | 신규 식별자 사실상 없음, 유일한 INFO 는 개념 중복(코드 미충돌) |

## 권장 조치사항
1. **(BLOCK 해소)** project-planner 턴에서 `spec/2-navigation/1-workflow-list.md` §3.1 PATCH 행/Rationale §3 을 실제 코드 상태와 일치하도록 정정(POST 행에 검사 명시 추가 또는 현재 무검증 상태로 서술 되돌리기).
2. **(BLOCK 해소)** project-planner 턴에서 `spec/data-flow/11-workflow.md` §1.2·§2.1 및 `spec/3-workflow-editor/0-canvas.md` §11.2.1 각주를 "저장 시점 교차-워크플로 참조 거부 + 타입/순환은 여전히 런타임·ShadowWorkflow" 로 갱신하거나, plan `spec_impact` 를 `none` 에서 이 파일들로 바꿔 구현과 동일 PR 에 spec 갱신 동봉.
3. `spec/1-data-model.md` §2.8/§2.9 에 Trigger/Schedule 워크스페이스 제약 문구 추가(위 두 항목과 같은 타이밍).
4. `--impl-done` 전 "이 PR 밖으로 넘기는 것" 두 항목이 `spec-draft-nullable-notation-followups.md` 에 실제 등재됐는지 확인.
5. (비필수) CHANGELOG/PR 설명에 "새 정책 도입 아님 — 기존 불변식 미집행 상태를 닫음" 명시, `1-workflow-list.md` frontmatter `pending_plans` 정리는 별도 planner 턴에서.