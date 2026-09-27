# 부작용(Side Effect) 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** 다수 서비스의 생성자 시그니처 변경(신규 repository 주입) — 프로덕션 영향 없음, 확인 완료
  - 위치: `codebase/backend/src/modules/edges/edges.service.ts`(`constructor` — `nodeRepository` 추가), `codebase/backend/src/modules/alerts/alerts.service.ts`(`workflowRepository` 추가), `codebase/backend/src/modules/schedules/schedules.service.ts`(`workflowRepository` 추가), `codebase/backend/src/modules/triggers/triggers.service.ts`(`workflowRepository` 추가), `codebase/backend/src/modules/workflows/workflows.service.ts`(`folderRepository` 추가), `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts`(`llmService` 추가)
  - 상세: 다섯 서비스 모두 생성자 파라미터가 늘었다. 전부 `@Injectable()`(Nest DI 관리)이라 프로덕션 코드에서 수동 `new`로 생성하는 곳이 없는지 저장소 전체를 grep 했다 — `new EdgesService(...)`(`edges.service.spec.ts`), `new AlertsService(...)`(`alerts.service.spec.ts`), `new WorkflowAssistantSessionService(...)`(`workflow-assistant-session.service.spec.ts`) 세 곳뿐이고 전부 이번 diff 안에서 새 인자까지 갱신돼 있다. `TriggersService`·`WorkflowsService`를 참조하는 다른 스펙(`websocket.gateway.spec.ts`·`workflows.controller.spec.ts`·`workflow-channel-authorizer.spec.ts`)은 해당 서비스를 mock 으로만 쓰므로 DI 갱신이 불필요하다. 각 모듈(`edges.module.ts`·`triggers.module.ts`·`workflows.module.ts`)의 `TypeOrmModule.forFeature` 도 새 엔티티(`Node`·`Workflow`·`Folder`)를 함께 추가해 DI 해석 실패 가능성도 없다. `alerts.module.ts`·`schedules.module.ts`는 diff에 없지만 확인 결과 `Workflow`가 이미 기존 목적(평가기·알림)으로 등록돼 있어 별도 wiring이 불필요했다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** `triggers.module.ts`에 `Workflow` 엔티티 추가 — 기존 순환 회피 관례를 그대로 따름, 순환 재도입 아님
  - 위치: `codebase/backend/src/modules/triggers/triggers.module.ts`(`TypeOrmModule.forFeature([Trigger, Execution, Schedule, AuthConfig, Workflow])`)
  - 상세: 같은 파일의 기존 주석("`TriggerResourceReleaserService`... import 하면 `WorkflowsModule`과 순환이 닫힌다")이 명시하듯 이 모듈은 의도적으로 `WorkflowsModule`을 import하지 않는다. 이번 변경은 `WorkflowsModule` 전체가 아니라 `Workflow` **엔티티**만 `forFeature`에 추가한 것이라 순환을 재도입하지 않는다 — 같은 패턴이 `edges.module.ts`(`Node` 엔티티만), `workflows.module.ts`(`Folder` 엔티티만)에도 쓰였고 기존 `Integration` 처리와 동형이다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** 새 사전검증 호출은 전부 DB-only, 신규 외부 네트워크 호출 없음
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`(`assertModelConfigRefsInWorkspace` → `modelConfigService.findEntity`), `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts`(`assertLlmConfigInWorkspace` → `llmService.resolveConfig`)
  - 상세: `LlmService.resolveConfig`는 `llmConfigId`가 falsy면 워크스페이스 기본 설정으로 폴백해 `MODEL_CONFIG_DEFAULT_MISSING`을 던질 수 있는 분기가 있으나, 호출부(`assertLlmConfigInWorkspace`)가 `if (!llmConfigId) return;`으로 먼저 걸러 그 분기에 진입하지 않는다. `resolveConfig`/`findEntity` 모두 `repo.findOne`류의 DB 조회이며 LLM 프로바이더 API를 부르지 않는다(소스 확인). 신규 사전검증 호출이 순차 `await`라 라운드트립이 다소 늘지만(`RESOLUTION.md` INFO 9로 이미 낮은 우선순위 처분됨) 부작용 관점의 문제는 없다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO]** 폴더 `parentId` 미소속 에러 응답에 `details` 배열 신규 추가 — 문서화된 의도적 API 응답 형태 확장
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts`(`assertParentInWorkspace`, `validateParentChange` 내 호출부)
  - 상세: 종전엔 `throw new BadRequestException({code:'VALIDATION_ERROR', message:'Parent folder not found in this workspace'})`로 `details` 필드가 없었다. 이번 변경으로 공용 `throwInvalidReferences`를 타면서 `details:[{field:'parentId', message, code:'INVALID_FIELD'}]`가 추가된다. `CHANGELOG.md`에 "그 밖의 참조... 거부에도 `details[].field`가 실린다"로 명시된 의도된 확장이고 필드 추가(additive)라 하위 호환 위험은 낮다.
  - 제안: 조치 불요 — 프런트가 이 특정 400 응답의 `details` 부재를 가정하는 코드가 있는지는 이번 리뷰 범위 밖(참고로 CHANGELOG에 이미 고지됨).

- **[INFO]** 저장 전 검사 삽입 위치는 모두 영속 부작용(트리거/스케줄 생성, secret store 이관, BullMQ 등록, 감사 로그) 이전 — 확인 완료
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts`(`create` — `assertReferenceInScope` 호출이 `triggerRepository.create/save` 이전), `codebase/backend/src/modules/triggers/triggers.service.ts`(`create` — `assertReferenceInScope` 호출이 `triggerRepository.save`·`normalizeNotificationSecretRef` 이전), `codebase/backend/src/modules/workflows/workflows.service.ts`(`create`/`update` — `assertFolderInWorkspace`가 `dataSource.transaction` 이전)
  - 상세: 각 서비스에서 새 검사가 기존의 실패 가능한 외부 호출(BullMQ 큐 등록, secret 이관)보다 먼저 실행돼, 거부 시 부분 쓰기·고아 자원이 생기지 않는다. 직접 코드를 읽어 순서를 확인했다.
  - 제안: 조치 불요 — 확인 목적의 기록.

## 요약

이번 PR은 공용 유틸 `assertReferenceInScope`/`throwInvalidReferences`(순수 함수, 부작용 없음)를 신설해 8개 서비스(alerts·edges·folders·knowledge-base·nodes·schedules·triggers·workflow-assistant·workflows)에 저장 전 워크스페이스/워크플로 소속 검증을 추가한다. 서비스 생성자 시그니처가 다수 바뀌지만 전량 Nest DI로만 소비되고, 직접 `new`로 인스턴스화하는 세 곳과 관련 모듈의 `TypeOrmModule.forFeature`가 모두 갱신돼 있어 런타임 DI 해석 실패 위험은 없다. `triggers.module.ts`의 `Workflow` 엔티티 추가는 기존에 명시된 "`WorkflowsModule` 순환 회피(엔티티만 import)" 관례를 그대로 따라 순환을 재도입하지 않는다. 신규 사전검증 호출(`findEntity`/`resolveConfig`)은 DB 전용이라 의도치 않은 외부 네트워크 호출이 없고, 모든 신규 검사가 영속 부작용(저장·큐 등록·secret 이관)보다 먼저 실행돼 거부 시 부분 쓰기가 남지 않는다. DB 마이그레이션·엔티티 스키마 변경은 없다. 유일하게 주목할 만한 지점은 폴더 `parentId` 미소속 400 응답에 `details` 배열이 새로 추가되는 API 응답 형태 확장인데, 이는 `CHANGELOG.md`에 이미 문서화된 의도적 변경이고 additive라 위험이 낮다. 저장소 파일 뮤테이션은 하지 않았고(`git status --short`로 확인), Critical·Warning 급 부작용은 발견하지 못했다.

## 위험도

NONE
