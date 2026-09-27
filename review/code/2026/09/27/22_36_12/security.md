# 보안(Security) 리뷰 — cross-workspace-refs

## 발견사항

없음 (Critical/Warning 없음).

- **[INFO]** 신규 검증기(`assertReferenceInScope`/`throwInvalidReferences`)와 이를 사용하는 모든 호출부(트리거·스케줄·알림 규칙·워크플로·폴더·노드·엣지·지식베이스·어시스턴트 세션)를 확인한 결과, 이번 PR 은 순수 보안 강화(IDOR/교차 테넌트 참조 취약점 수정)이며 새로운 취약점을 도입하지 않는다.
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts:37`(`assertReferenceInScope`), `codebase/backend/src/modules/edges/edges.service.ts:72`(`assertEndpointsInWorkflow`), `codebase/backend/src/modules/nodes/nodes.service.ts:97`(`assertPlacementInWorkflow`), `codebase/backend/src/modules/folders/folders.service.ts:149`(`assertParentInWorkspace`), `codebase/backend/src/modules/workflows/workflows.service.ts:287`(`assertFolderInWorkspace`)·`:1111`(`validateCanvasReferences`)·`:1210`(`assertNewNodeIdsUnused`), `codebase/backend/src/modules/alerts/alerts.service.ts:31`, `codebase/backend/src/modules/schedules/schedules.service.ts:186`, `codebase/backend/src/modules/triggers/triggers.service.ts:486`, `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:206`(`assertModelConfigRefsInWorkspace`), `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts:204`(`assertLlmConfigInWorkspace`)
  - 상세: 모두 파라미터화된 TypeORM `where`/`In()` 조회만 사용해 SQL 인젝션 위험이 없다. 거부 응답(`VALIDATION_ERROR`/`MODEL_CONFIG_NOT_FOUND`)의 메시지는 고정 문자열이고, "없는 id"와 "다른 워크스페이스의 id"를 의도적으로 구분하지 않아(`reference-in-scope.ts` JSDoc) 존재 여부를 통한 열거(enumeration) 공격도 막는다. 스택트레이스·DB 원본 에러·내부 경로 등 민감 정보를 응답에 담지 않는다.
  - `PATCH` 대상 DTO(`update-node.dto.ts`, `update-workflow.dto.ts`, `update-folder.dto.ts`, `dto/alert-rule.dto.ts` 등)에는 `workspaceId`/`workflowId`/`id` 같은 소유권 필드가 노출되지 않아, `omitUndefined`+`Object.assign` 패턴을 통한 mass-assignment 로 소속 검사를 우회할 경로가 없다(`update-alert-rule.dto.ts`·`update-trigger.dto.ts`·`create-schedule.dto.ts` 는 `workflowId` 를 애초에 변경 불가 필드로 취급).
  - 노드/엣지/폴더/워크플로 id 는 관련 DTO 에서 `@IsUUID()`(또는 `@IsString()@MaxLength`) 로 형식 검증되어 임의 문자열이 그대로 쿼리에 들어가지 않는다.
  - 제안: 없음(확인 목적의 기록).

- **[INFO]** 캔버스 저장 경로(`saveCanvas`)는 `skipLegacyDataGates=true`(버전 복원)일 때도 `validateCanvasReferences` 를 건너뛰지 않도록 명시적으로 수정돼 있다(2R 에서 뮤턴트 M6 로 고정) — 옛 스냅샷 복원을 통한 우회 경로가 없음을 재확인했다.
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts:696`(`saveCanvas` 본문의 `this.validateCanvasReferences(dto);` 호출이 `skipLegacyDataGates` 조건문 밖에 있음), `codebase/backend/src/modules/workflows/workflows.service.spec.ts`(2R W1 회귀 테스트)
  - 제안: 없음.

- **[INFO]** 이번 PR 의 저장-전 검증은 신규 쓰기만 막고, 이미 DB 에 존재하는 교차 워크스페이스 참조 행(과거 저장된 트리거·스케줄의 `workflow_id` 등)은 소급 정리되지 않는다. 다만 이는 이번 코드 자체의 결함이 아니라 알려진 스코프 제한이며, 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 후속 조사 항목으로 명시적으로 이관돼 있다(직전 라운드 database.md 리뷰가 동일하게 확인).
  - 위치: 신규 검증 유틸 공통 — 실행 엔진(`execution-engine.service.ts`)이 워크플로/노드를 `findOneBy({ id })` 로만 읽는 기존 아키텍처(수정 대상 아님)
  - 제안: 별도 조치 불요(이미 후속 트래커에 등재).

## 요약

이번 PR 은 트리거·스케줄·알림 규칙·워크플로(폴더/저장/캔버스)·노드(컨테이너/도구 소유자)·엣지(끝점)·지식베이스(모델 설정)·어시스턴트 세션(모델 설정) 생성·수정 경로 전반에 걸쳐 "요청 본문의 참조 id 가 요청자 워크스페이스(워크플로 범위 필드는 같은 워크플로) 밖을 가리키면 저장 전에 400/404 로 거부"하는 공용 검증기를 추가해, 종전에 존재하던 교차 테넌트 IDOR/데이터 오염 취약점(다른 워크스페이스의 워크플로를 트리거로 실행, 다른 워크플로의 노드 행을 자신의 캔버스로 탈취 등)을 닫는 순수 보안 강화 변경이다. 신규 쿼리는 전부 파라미터화된 TypeORM `where`/`In()` 이라 인젝션 위험이 없고, 하드코딩된 시크릿이나 안전하지 않은 암호화·평문 전송은 없으며, 에러 응답은 존재/부재를 구분하지 않는 고정 메시지만 노출해 열거 공격과 정보 유출을 함께 방지한다. `PATCH` DTO 들이 소유권 필드(`workspaceId`/`workflowId`/`id`)를 노출하지 않아 mass-assignment 로 검증을 우회할 경로도 없다. 이미 저장된 과거 교차 워크스페이스 행에 대한 소급 정리는 범위 밖으로 트래커에 명시적으로 이관돼 있어 이번 PR 의 결함으로 보지 않는다. 종합적으로 보안 관점에서 차단 사유가 되는 지점은 없다.

## 위험도

NONE
