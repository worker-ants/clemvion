# 신규 식별자 충돌 검토 — `spec/2-navigation/` (--impl-prep)

## 검토 대상 정리

번들의 실질 target 은 `spec/2-navigation/` 영역 자체(기존 spec, 신규 개정 없음)와 이번에 착수되는
`plan/in-progress/cross-workspace-refs.md`(교차 워크스페이스 참조 저장 전 검사, `spec_impact: none`)
다. 이 plan 이 실제로 도입을 제안하는 식별자 표면을 전수했다(plan 본문의 코드 스팬 전체 추출 —
`assertAuthConfigInWorkspace` / `ensureWorkflowBelongsToWorkspace` / `validateParentChange` /
`resolveConfig` 등은 plan 스스로 "대조군(기존)" 으로 인용한 **기존** 헬퍼이고, `VALIDATION_ERROR` /
`INVALID_FIELD` / `details.field` 도 기존 공용 에러 계약이다). plan 은 "에러 코드·필드명의 spec
미러링은 planner 몫 → 트래커" 라고 명시해, 구체적인 신규 코드명·DTO명·엔드포인트명을 이 문서 자체가
아직 확정하지 않는다 — 신규 식별자 충돌 표면이 원천적으로 좁다.

## 발견사항

- **[INFO]** "교차 워크스페이스 workflowId 참조" 에 두 개의 서로 다른 처리 계열이 생긴다 — 이름은 겹치지 않지만 독자가 혼동할 수 있다
  - target 신규 식별자: (제안) `POST /api/triggers` · `POST /api/schedules` 의 `workflowId` 교차 워크스페이스 참조 → `400 VALIDATION_ERROR` + `details:{field:'workflowId', code:'INVALID_FIELD'}` (plan 본문 "처방" 절, `plan/in-progress/cross-workspace-refs.md`)
  - 기존 사용처: `spec/4-nodes/2-flow/1-workflow.md:75,273`, `spec/5-system/3-error-handling.md:149` — sub-workflow 노드가 **다른 워크스페이스**의 워크플로를 실행 시점에 호출하면 `assertSameWorkspace` 가 던지고 `WORKFLOW_FORBIDDEN_WORKSPACE`(403, output.error.code 로 surface)로 매핑되는 **별개의 기존 typed 코드**
  - 상세: 두 계열 다 "요청/실행이 다른 워크스페이스의 workflow 를 가리킨다" 는 동일 불변식을 보호하지만, 하나는 (신설 예정) 저장 시점 generic `INVALID_FIELD`, 다른 하나는 (기존) 실행 시점 typed `WORKFLOW_FORBIDDEN_WORKSPACE` 다. 식별자 자체는 충돌하지 않으나("workflowId 교차 워크스페이스" 라는 같은 개념에 서로 다른 이름의 두 계약이 붙는다), plan 이 인용한 정당화 근거(`spec/5-system/3-error-handling.md` §1.11, AuthConfig binding 선례)는 이미 "저장 시점 = 입력 검증(400/INVALID_FIELD)" vs "실행 시점 = fail-closed typed 코드(403)" 를 구분해 두고 있어 설계 의도상 다른 계층으로 보인다 — 즉 이것은 사용자가 지적한 대로의 **실제 충돌은 아니고**, 다만 두 계약이 나란히 존재하게 됨을 향후 spec 반영(planner 트래커) 시 상호 참조로 명시해 둘 필요가 있다는 INFO 다
  - 제안: plan 이 실제 spec 반영 단계(트래커 처리)로 넘어갈 때, `1-workflow-list.md`/`2-trigger-list.md`/`3-schedule.md` 의 새 `INVALID_FIELD` 항목에서 `WORKFLOW_FORBIDDEN_WORKSPACE`(다른 계층·다른 시점의 동일 개념)를 상호 참조해 "이것은 그것과 다른 자리" 라고 한 줄 명시할 것을 권장. 코드 충돌은 아니므로 CRITICAL/WARNING 은 아님

## 축별 확인 결과 (충돌 없음)

- **요구사항 ID**: plan 은 신규 요구사항 ID 를 발급하지 않는다(`spec_impact: none`). 기존 `NAV-WF-07` · `AGM-07` · `W-6` 등과 겹치는 신규 ID 없음.
- **엔티티/타입명**: 신규 엔티티·DTO·인터페이스 이름 없음 — 모두 기존 필드(`workflowId`, `folderId`, `parentId`, `containerId`, `toolOwnerId`, `llmConfigId` 등)를 그대로 참조.
- **API endpoint**: 신규 endpoint 없음 — 기존 `POST /api/triggers`, `POST /api/schedules`, `POST /api/workflows/:id/save`, `POST /api/folders`, `POST/PATCH /api/workflow-assistant/sessions`, `POST/PATCH /api/knowledge-bases`, `POST /api/alerts` 등 기존 계약에 검사만 추가.
- **이벤트/메시지명**: webhook·queue·sse 신규 이벤트명 없음.
- **환경변수·설정키**: 신규 ENV/설정 키 없음.
- **파일 경로**: 유일한 신규 경로는 `codebase/backend/test/cross-workspace-references.e2e-spec.ts` (plan "테스트 설계" 절). `find codebase/backend/test -iname '*cross-workspace*'` 로 확인한 결과 기존 파일과 겹치지 않으며, 기존 e2e 명명 컨벤션(`<도메인>-<시나리오>.e2e-spec.ts`, 예: `trigger-workflow-ref.e2e-spec.ts`, `workspace-path-guard.e2e-spec.ts`, `folder-crud.e2e-spec.ts`)과 형태가 일치한다. 의미적으로 인접한 `workspace-path-guard.e2e-spec.ts` 는 **경로 파라미터**(`@WorkspaceParam`) 가드를 다루는 별개 축이라 이름·범위 모두 혼동 소지 없음.
- **에러 코드 재사용**: 제안된 `VALIDATION_ERROR`/`INVALID_FIELD` 조합은 이미 `AUTH_CONFIG_NOT_FOUND`(§1.11)·폴더 `parentId` PATCH(§3.1, `1-workflow-list.md:169`) 검증에서 동일 의미로 쓰이는 기존 계약의 **재사용**이며, 새 의미를 얹지 않는다. `nodes[i].id` 필드 경로 표기도 기존 관행(`error-handling.md`: "`nodes[3].type` 형식")과 일치한다.

## 요약

이번 target(`spec/2-navigation/` 번들 + 착수 예정 `plan/in-progress/cross-workspace-refs.md`)은
신규 식별자를 사실상 도입하지 않는다 — 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·ENV/설정키
어느 축에서도 새 이름이 만들어지지 않고, 유일하게 새로 생기는 파일 경로(`cross-workspace-references.e2e-spec.ts`)는
기존 명명 컨벤션과 충돌 없이 부합한다. plan 은 의도적으로 구체 식별자 확정을 "planner 트래커" 로
미뤄 두었고, 인용하는 에러 코드(`VALIDATION_ERROR`/`INVALID_FIELD`)·검증 함수 패턴은 모두 기존
선례(AuthConfig binding, 폴더 `parentId`)의 재사용이라 다른 의미로 충돌하지 않는다. 유일한 잠재
혼동 지점은 "workflowId 교차 워크스페이스 참조" 라는 같은 개념이 저장 시점(신규, generic
`INVALID_FIELD`)과 실행 시점(기존, typed `WORKFLOW_FORBIDDEN_WORKSPACE`)에서 서로 다른 계약으로
존재하게 된다는 점인데, 이는 이름 충돌이 아니라 향후 spec 반영 시 상호 참조를 남겨 두면 되는
문서화 수준의 INFO 다.

## 위험도

NONE
