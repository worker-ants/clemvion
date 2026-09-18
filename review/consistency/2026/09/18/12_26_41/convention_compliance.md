# 정식 규약 준수 검토 — spec/2-navigation/ (impl-prep, trigger-workflow-index)

## 사전 고지 — 이 리포트의 커버리지 한계

`_prompts/convention_compliance.md` 조립 시 컨텍스트 예산 초과로 `spec/conventions/` 산하 다수 파일이
**"본문 생략됨 — 컨텍스트 예산 초과"** placeholder 로 절단됐다 (`migrations.md`·`secret-store.md`·
`swagger.md`·`error-codes.md`·`spec-impl-evidence.md`·`redis-keys.md`·`chat-channel-adapter.md` 등
23개+). 이 checker 는 번들만으로는 이 문서들과의 정합을 검증할 수 없었으므로, **파일시스템에서 직접
해당 conventions 원문을 읽어** 검증을 보완했다 (아래 발견사항은 이 방식으로 얻은 결과). 이는 기존에
기록된 하네스 결함(`--spec` 모드 예산이 conventions 를 통째로 떨구는 문제)과 같은 클래스이며, 이 세션
한정 회피이지 하네스 수정은 아니다.

## 검토 범위

번들 target 은 `spec/2-navigation/**`(전체 파일 나열, 앞 3개 — `1-workflow-list.md`·`2-trigger-list.md`·
`3-schedule.md` — 만 전문 포함, 나머지는 예산 절단)이며, 이번 세션의 실제 작업 대상(진행 중 plan
`plan/in-progress/spec-draft-trigger-workflow-index.md`)은 `spec/1-data-model.md §3`·`Rationale` 과
`spec/data-flow/10-triggers.md §2.1`(fa1153e64 로 이미 커밋됨, `--impl-prep` 이전 단계)이다. 두 축을 모두
확인했다.

## 발견사항

- **[WARNING]** `plan/complete/` 로 아직 옮겨지지 않은 plan 파일을 이미 이동한 것처럼 참조
  - target 위치: `spec/1-data-model.md` `## Rationale` → `### Trigger \`(workflow_id)\` 인덱스 (2026-09-18)` 절 말미 (커밋 fa1153e64 로 추가)
    ```
    > 출처: 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` «부모 삭제 경로의 성능 후속». 실측 절차는
    > `plan/complete/spec-draft-trigger-workflow-index.md`, 구현은 V111.
    ```
  - 위반 규약: `spec/conventions/spec-impl-evidence.md`(§3.1 전이 규칙 · R-11) 가 전제하는 "spec 의 plan 참조는
    그 시점의 실제 파일 위치를 가리킨다" 는 원칙 — 및 이 PR 자신의 선행 draft(`plan/in-progress/spec-draft-trigger-workflow-index.md`
    §S2)가 제안한 문구와의 drift.
  - 상세: 현재 저장소 상태에서 해당 파일은 `plan/in-progress/spec-draft-trigger-workflow-index.md` 에만 존재하고
    (`ls plan/complete/spec-draft-trigger-workflow-index.md` → No such file), 그 plan 의 체크리스트도 `--spec` 항목만
    체크돼 있고 구현·`--impl-done`·"트래커 반영 · draft `complete/` 이동" 은 모두 미완이다. 그런데 방금 커밋된 spec 본문은
    이미 `plan/complete/…` 에 있다고 서술한다. `spec/**.md` 전체에서 `plan/complete/*.md` 를 가리키는 참조를 전수
    대조한 결과 **이 한 줄만** 대상 파일이 실재하지 않는다(다른 모든 `plan/complete/` 참조는 실재 파일과 일치) —
    고립된 슬립이며 반복 패턴은 아니다. 이 저장소의 실제 선례(V110/#1285, 커밋 `7eb9815ee`)는 같은 문구를
    **plan 이동과 같은 원자적 커밋**에서만 추가했다. 반면 이 PR 의 승인된 draft 본문(S2)은 더 조심스럽게
    "실측 절차는 이 draft(`plan/complete/` 로 이동)" 라고 **이동 예정으로 표현**했는데, 실제 커밋에서는 그 유보 표현이
    사라지고 경로가 기정사실처럼 박제됐다. 이 참조는 마크다운 링크(`[..](path)`)가 아니라 backtick 텍스트라
    `spec-link-integrity.test.ts` build 가드가 잡지 못한다 — 즉 plan 이동이 이 PR 안에서 정상적으로 일어나면
    조용히 참이 되지만, 만약 구현이 지연·보류되면 CI 로 걸러지지 않는 dangling 참조로 남는다.
  - 제안: 이번 PR 이 실제로 V111 구현 + 트래커 반영 + `plan/in-progress/spec-draft-trigger-workflow-index.md` →
    `plan/complete/` 이동까지 같은 PR 에서 완결한다면 실질적 위해는 없다(문구가 착지 시점에 참이 된다). 다만 안전하게
    가려면 (a) `--impl-done` 실행 전까지는 `plan/in-progress/spec-draft-trigger-workflow-index.md` 로 적었다가
    plan 이동 커밋에서 `plan/complete/…` 로 교체하거나, (b) 지금 표현을 유지하려면 이 커밋과 plan 이동 커밋을 분리하지
    않는다는 것을 plan 체크리스트에 명시해 두는 정도로 충분하다.

- **[INFO]** 컨벤션 다중 대조 결과 — 위반 없음 (양성 확인)
  - target 위치: `spec/2-navigation/2-trigger-list.md`, `spec/1-data-model.md §3`, `spec/data-flow/10-triggers.md §2.1`
  - 상세: 다음은 관련 정식 규약과 직접 대조해 **모두 준수**를 확인했으므로 참고용으로 남긴다.
    - 마이그레이션 명명(`spec/conventions/migrations.md §1·§2`): plan 이 제안한 `V111__trigger_workflow_id_index.sql`
      은 현재 `codebase/backend/migrations/` 최대 버전(V110)의 +1 이며 gap·중복·재사용이 없다. 인덱스 식별자
      `idx_trigger_workflow_id` 도 기존 관례(`idx_schedule_trigger_id`·`idx_execution_workflow_status`)와 동일한
      `idx_<table>_<column>` 패턴이며 `codebase/`·`spec/`·`plan/` 어디에도 아직 점유되어 있지 않다.
    - 감사 액션 명명(`spec/conventions/audit-actions.md §3`): `2-trigger-list.md` 가 쓰는
      `trigger.notification_secret_rotated` · `trigger.chat_channel_bot_token_rotated` · `trigger.interaction_token_revoked`
      는 레지스트리 등재 값과 정확히 일치.
    - Secret Store(`spec/conventions/secret-store.md §1.1`): `botToken`/`botTokenRef`/`inboundSigningRef` 를
      응답에 노출하지 않는다는 `2-trigger-list.md` §2.3.1 서술은 §1.1 이 명시한 "ref 도 비노출 대상" 규칙과 일치.
      인용 anchor(`#11-비대상-필드도-응답-바디에는-나가지-않는다`)도 실제 heading 과 slug 가 일치.
    - Swagger DTO 명명(`spec/conventions/swagger.md §1-7`): `UpdateWorkflowDto`(top-level 요청 바디, `Update` 접두)와
      `WorkflowSettingsDto`(nested 필드, 로컬 패턴, 접두 없음)의 구분이 규약과 일치.
    - 에러 코드(`spec/conventions/error-codes.md §1`): `2-trigger-list.md`/`1-workflow-list.md` 가 쓰는
      `VALIDATION_ERROR`/`RESOURCE_CONFLICT`(prefix-less 전역 공용 코드) 및 `TRIGGER_ENDPOINT_PATH_CONFLICT`(도메인
      prefix) 사용 패턴이 규약과 상충하지 않음.
    - Frontmatter 증거(`spec/conventions/spec-impl-evidence.md §2·§3`): `2-trigger-list.md`/`1-workflow-list.md` 의
      `status: partial` + `pending_plans:` 경로(`plan/in-progress/*` 및 `plan/complete/workflow-duplicate-nodes-edges.md`)
      가 모두 실재하고, `code:` glob 은 신규 추가분(`trigger-resource-release.ts` 등, `endpoint-path-conflict-wrap*.ts`
      포함) 전부 ≥1 매치.

## 요약

번들 자체는 컨텍스트 예산 절단으로 `spec/conventions/` 핵심 문서 다수가 빠져 있어 하네스만으로는 이번
검토를 완결할 수 없었고, 파일시스템 직접 대조로 이를 보완했다. 실사 결과 이번 trigger-workflow-index
작업(spec/1-data-model.md·data-flow/10-triggers.md 커밋 + 대상 spec/2-navigation/ 번들)은 마이그레이션
명명, 인덱스 식별자, 감사 액션, secret-store 노출 금지, swagger DTO 명명, 에러 코드, frontmatter
evidence 스키마 등 점검한 모든 축에서 정식 규약을 준수한다. 유일한 흠은 `spec/1-data-model.md` Rationale
이 아직 이동하지 않은 plan 파일을 `plan/complete/` 에 있는 것처럼 서술한 점으로, 자동 가드가 잡지 못하는
경로이며 이 PR 이 실제로 plan 을 완결·이동시키면 자연 치유되지만 현재 시점 기준으로는 사실과 다르다.

## 위험도

LOW
