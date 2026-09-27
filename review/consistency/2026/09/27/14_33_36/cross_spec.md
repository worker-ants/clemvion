# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-done, diff-base `origin/main`)

## 전제 확인

- `spec/2-navigation/` 자체의 diff 는 0 파일 — 이 PR(`patch-omit-undefined`, HEAD `eea3a0d03`)은 스펙을 바꾸지 않았다.
- 실제 변경은 구현 diff 10 파일 / 654 줄: `omit-undefined.ts`(배열 거부 타입 강화) + `workflows.service.ts` / `nodes.service.ts` /
  `auth-configs.service.ts` 세 곳의 `update()` 가 `Object.assign(엔티티, 부분본문)` 통짜 병합에서 `omitUndefined()` 필터링 병합으로
  바뀌었다(각각 `spec/2-navigation/1-workflow-list.md`, `spec/3-workflow-editor/1-node-common.md`, `spec/5-system/1-auth.md`/
  `12-webhook.md` 가 `code:` 로 소유).
- 판정은 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/patch-omit-undefined`) HEAD 기준으로 했다.

## 발견사항

- **[WARNING]** PATCH tri-state(`§5.4`) 문서화가 `2-trigger-list.md` 에만 있고 `1-workflow-list.md`/`6-config.md` 에는 없다
  — **이미 tracker 에 등재된 기존 발견, 이 검토가 새로 만든 이슈 아님**
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.2 (workflow `settings` 병합 서술), `spec/2-navigation/6-config.md`
    §3 Authentication API (`PATCH /api/auth-configs/:id`) — 두 문서 모두 실제 확인함(`6-config.md` 는 이 프롬프트 번들에는
    예산 초과로 없어 직접 Read 함).
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` §3 註 — "키 생략 = 값 불변"(§5.4 tri-state)을 명시 서술. `spec/5-system/2-api-convention.md`
    §5.4 자체는 이 tri-state 를 요청 바디 일반 규약으로 이미 선언(`"PATCH 부분 업데이트는 키 생략(=값 불변)·null(=초기화)·값(=설정)의 tri-state"`).
  - 상세: 이번 diff 가 `workflows.service.ts`/`auth-configs.service.ts` 의 **코드 동작**을 §5.4 tri-state 에 맞췄다(빈 `settings: {}` 는
    이제 아무것도 안 바꾸고, 명시적 `null` 스칼라 필드는 값을 지운다). 그런데 그 동작을 설명하는 **문장은 여전히 `1-workflow-list.md`/
    `6-config.md` 에 없다** — `2-trigger-list.md` 만 갖고 있어 영역별 서술 비대칭이 남는다. 특히 워크플로 `settings` 는 최상위
    `settings: null` 이 **no-op**(스칼라 필드의 null=초기화와 다른 의미)이라는, 같은 엔드포인트 안에서 필드마다 null 의 뜻이 갈리는
    미묘함이 있어 문서 공백의 실질 비용이 있다.
  - **처분 상태**: `plan/in-progress/patch-omit-undefined.md` 의 `--impl-prep`(`review/consistency/2026/09/27/13_11_33`, BLOCK: NO) 이
    이미 이 정확한 문제를 W2(cross_spec)로 짚었고, `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 (7)에
    planner 턴 대기로 등재돼 있다(`settings` null=no-op vs 스칼라 null=초기화 구분까지 명시). `developer` plan 의 `spec_impact: none`
    은 규약대로 spec 쓰기를 planner 로 미룬 것이라 이 PR 자체의 결함이 아니다.
  - 제안: 신규 조치 불요(중복 등재 방지). 다음 planner 턴에서 tracker 항목 (7)을 그대로 소진할 것 — `1-workflow-list.md` §3.2,
    `6-config.md` §3 에 tri-state 한 문장씩(§2.3 필터 표 (8) 항목과 같은 배치로 처리 가능).

- **[INFO]** 요청 DTO `description` 필드의 `nullable` 미선언 — API 계약이 실제 지원 입력보다 좁음. **이미 tracker 등재**
  - target 위치: `codebase/backend/src/modules/workflows/dto/update-workflow.dto.ts` / `.../nodes/dto/update-node.dto.ts`
    (`description?: string`, `nullable: true` 미선언) — 두 서비스 모두 `spec/2-navigation/1-workflow-list.md` /
    `spec/3-workflow-editor/1-node-common.md` 가 `code:` 소유.
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.4 DTO 선언 형태 규칙("`null` 을 쓰는(상시 존재) 필드 → `@ApiProperty({ nullable:
    true })` + `field: T | null`"). 런타임은 `@IsOptional()` 이 `null` 을 통과시켜 실제로 값을 지우는데(이번 diff 의 워크플로 단위
    "명시적 null 은 로드한 값을 지운다" 테스트가 그 동작을 고정), OpenAPI 선언은 그 입력을 감춘다.
  - 상세: 이 diff 자체가 만든 회귀는 아니고(기존 drift), `/ai-review` 2R(`review/code/2026/09/27/14_20_00`)이 W2 로 짚어 "수렴
    예외"로 처리하고 `spec-draft-nullable-notation-followups.md` 새 항목("PATCH 부분 본문 후속")에 등재했다.
  - 제안: 신규 조치 불요. 다음 developer 턴에서 그 tracker 항목을 소진할 것(DTO 선언 정정 + 캐너리).

- **[INFO]** `NodeDto` 미선언 `workflow` 관계 응답 누출 제거 — 기존 계약 위반의 해소, cross-spec 충돌 아님
  - target 위치: `codebase/backend/src/modules/nodes/nodes.service.ts` `update()` — 반환 타입을 `Omit<Node, 'workflow'>` 로 좁히고
    저장된 엔티티에서 `workflow` 관계를 구조분해로 뗐다.
  - 확인: `codebase/backend/src/modules/nodes/dto/responses/node-response.dto.ts` 의 `NodeDto` 는 `workflowId` 만 선언하고
    `workflow`(부모 워크플로 행 전체)는 선언하지 않는다 — 즉 이 diff 는 기존에 있던 "선언 안 된 필드가 응답에 실리는" 계약 위반을
    닫는 방향이다. `spec/3-workflow-editor/1-node-common.md` 어디에도 `workflow` 관계를 응답에 포함하라는 서술이 없어, 이 변경은
    다른 영역 spec 과 충돌하지 않는다.
  - 제안: 조치 불요. (동일 형태의 응답 직렬화 계층 부재는 `/ai-review` 2R W1 이 이미 별도 항목으로 tracker 에 등재 — architecture
    관심사이지 이번 cross-spec 검토의 대상은 아님.)

## 확인했으나 충돌 없음으로 판정한 항목

- `spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/conventions/cross-node-warning-rules.md` 가 `workflows.service.ts` 를
  `code:` 로 같이 소유하지만, 이번 diff 는 그 파일의 `update()` 메서드만 건드렸고 두 spec 이 관심 갖는 캔버스 저장/그래프 경고
  로직은 그대로다 — 영향 없음.
- `spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스(AuthConfig = Owner/Admin CRUD), `spec/2-navigation/6-config.md` §3
  Authentication API 의 필드 목록(`name·IP·비-비밀 config·활성 토글`)은 이번 diff 가 건드린 shallow-merge 방식과 무관 — RBAC ·
  필드 목록 자체는 그대로 정합.
- `spec/1-data-model.md` §2.17 AuthConfig(`ip_whitelist` 저장 시점 검증) — 이번 diff 는 저장 시점 검증 로직을 바꾸지 않았고
  단지 PATCH 응답/병합에서 `undefined` 를 거를 뿐이라 데이터 모델 제약과 충돌하지 않는다.
- `Workflow.settings.maxConcurrentExecutions` 관련 서술(`1-workflow-list.md` §3.2, `1-data-model.md` §2.4,
  `5-system/4-execution-engine.md` admission gate 표)은 이번 diff 가 "빈/`null` `settings` 는 저장된 키를 지우지 않는다" 는
  방향으로 실제 구현을 강화했을 뿐, 세 문서가 서술하는 admission-gate 계약(§8, strict DTO, 기본값 3)과 모순되지 않는다.
- `omitUndefined` 의 새 타입 제약(`NotArray<T>`, 배열이면 컴파일 에러)은 이번 diff 의 세 호출부(`rest`/`dto`/`settings`, 전부
  object) 에 영향이 없고, 다른 spec 이 이 헬퍼로 배열을 병합하길 기대하는 자리도 없다.

## 요약

이번 PR 은 `spec/2-navigation/` 문서 자체를 바꾸지 않은 코드 전용 변경이며, 발견된 두 이슈(PATCH tri-state 문서화 비대칭,
`description` nullable 미선언)는 모두 이 세션이 처음 발견한 것이 아니라 `--impl-prep`/`/ai-review` 단계에서 이미 식별되어
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner/developer 후속 항목으로 정식 등재된 기존 drift 다.
`developer` 는 `spec_impact: none` 을 선언했고 규약대로 spec 쓰기를 planner 턴에 미뤘으므로 이는 프로세스 위반이 아니다. 코드
변경 자체(`omitUndefined` 를 세 서비스에 적용, `NodeDto` 미선언 `workflow` 누출 제거)는 오히려 `spec/5-system/2-api-convention.md`
§5.4 tri-state 규약과 `NodeDto` 계약 쪽으로 실제 동작을 정합시키는 방향이라, 다른 영역 spec 과 새로 충돌하는 지점은 확인되지
않았다.

## 위험도

LOW
