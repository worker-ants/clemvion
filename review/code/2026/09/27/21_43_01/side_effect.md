# 부작용(Side Effect) 리뷰 — cross-workspace-refs

## 발견사항

- **[INFO]** 폴더 재부모화(`PATCH /api/folders/:id` 의 parentId 변경) 400 응답 바디가 `details` 없는 형태에서 `details` 배열 포함 형태로 바뀐다 — 의도된 확장이지만 공개 API 응답 형태 변경
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` (게이트 127~128, 옛 인라인 `findOne`+`throw new BadRequestException({code, message})` 블록을 `assertParentInWorkspace` 호출로 교체)
  - 상세: 종전 코드는 `throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Parent folder not found in this workspace' })` 로 `details` 키 자체가 없었다. 이제 `assertReferenceInScope` → `throwInvalidReferences` 경로를 타면서 `details: [{ field: 'parentId', message, code: 'INVALID_FIELD' }]` 가 추가된다. `code`/`message` 문자열은 그대로 유지되므로 하위 호환은 유지되지만, 이 필드의 유무로 분기하던 소비자가 있다면 영향을 받을 수 있다.
  - 제안: CHANGELOG(`CHANGELOG.md` 게이트 26~42)에 이미 이 변경이 문서화되어 있어 별도 조치는 불필요. 프런트엔드가 이 응답을 소비하는 자리가 있다면 `details` 존재를 전제하지 않는지만 한 번 확인 권장.

- **[INFO]** 새로 추가된 소속 검사 전부가 상태 변경(저장/트랜잭션) **이전에** 배치되어 fail-fast 구조를 유지한다 — 실측 결과, 부작용 없음을 확인
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 게이트 482~496(`assertReferenceInScope` 가 `mergeExternalConfig`·`triggerRepository.save`·`chatChannelBinder.setupChatChannel` 등 외부 부작용을 유발하는 호출보다 앞), `codebase/backend/src/modules/schedules/schedules.service.ts` 게이트 183~193(트리거 생성 전), `codebase/backend/src/modules/nodes/nodes.service.ts` 게이트 51~55·78~82(`Object.assign` 이전), `codebase/backend/src/modules/edges/edges.service.ts` 게이트 56~59(`edgeRepository.create` 이전), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 게이트 160·243(`kbRepository.save`/필드 대입 이전) — 그리고 diff 가 생략된 `codebase/backend/src/modules/workflows/workflows.service.ts` 는 함수 `assertFolderInWorkspace`(트랜잭션 시작 전 호출) · `validateCanvasReferences`(트랜잭션 시작 전 호출) · `assertNewNodeIdsUnused`(`syncNodes` 트랜잭션 내부이지만 삭제/저장 로직보다 먼저 호출)로 직접 `git diff` 확인.
  - 상세: 검증 실패 시 이미 커밋된 부분 쓰기나 이미 나간 외부 호출(시크릿 스토어 마이그레이션, chat-channel adapter setup, 감사 로그 기록)이 남지 않는다는 점을 전 호출부에서 확인했다. `assertReferenceInScope`/`throwInvalidReferences` 는 순수 조회(`repo.exists`) + 예외 던지기만 하고 DB 쓰기·전역 상태 변경·네트워크 호출을 하지 않는다.
  - 제안: 없음(양호 확인 기록용).

- **[INFO]** `assertReferenceInScope` 패턴이 check-then-act(TOCTOU) 레이스를 새 호출부마다 반복 도입한다 — 기존 코드베이스에 이미 존재하던 패턴과 동일한 성격
  - 위치: `codebase/backend/src/common/utils/reference-in-scope.ts` 게이트 42~45(`assertReferenceInScope`) 및 이를 호출하는 모든 서비스(트리거/스케줄/알림규칙/폴더/워크플로 folderId)
  - 상세: `repo.exists({ where })` 로 참조 존재를 확인한 뒤 실제 insert/update 는 별도 쿼리(별도 트랜잭션인 경우도 있음, 예: `alerts.service.ts`·`triggers.service.ts`·`schedules.service.ts` 는 검사와 저장이 같은 트랜잭션이 아니다)로 수행한다. 검사와 쓰기 사이에 참조 대상이 삭제되면 FK 위반으로 500 이 날 수 있다. 다만 이는 이 PR 이전에도 `folders.service.ts`(재부모화 `assertReferenceInScope` 도입 전의 인라인 `findOne`)·`workflow-ownership.util.ts`(`assertWorkflowInWorkspace`) 등에서 이미 쓰이던 것과 같은 성격의 레이스이며, 이 PR 이 새로 발명한 취약점은 아니다.
  - 제안: 별도 조치 불필요(기존 컨벤션과 동일 수준). 후속으로 이런 레이스를 전면 강화할지는 별도 결정 사항.

- **[INFO]** `WorkflowsService.assertNewNodeIdsUnused` 는 워크스페이스/워크플로 범위가 아니라 **전체 `Node` 테이블**을 대상으로 id 충돌을 조회한다 — 의도된 설계이나 스코프가 넓다는 점을 기록
  - 위치: `codebase/backend/src/modules/workflows/workflows.service.ts` 함수 `assertNewNodeIdsUnused`(diff 가 프롬프트에서 생략되어 게이트 없음, `git diff` 로 직접 확인: `manager.find(Node, { where: { id: In(fresh.map(({id}) => id)) }, select: { id: true } })` — `workflowId`/`workspaceId` 조건 없음)
  - 상세: 함수 docstring 이 "TypeORM `save` 는 id 로만 행을 찾아 있으면 UPDATE 한다" 는 정확한 근거로 전역 스코프 조회를 정당화하고 있어 의도적 설계다(다른 워크플로/워크스페이스의 노드 id 와 충돌해도 잡아야 하므로). 부작용을 일으키는 것은 아니며 순수 조회이지만, "워크스페이스 경계 검사"라는 이 PR 의 다른 검사들과 스코프 성격이 달라(전역 vs 워크스페이스) 다음 사람이 검토할 때 혼동하지 않도록 기록해 둔다.
  - 제안: 없음(설계 의도가 docstring 에 이미 명시되어 있어 정보성 기록).

- **[INFO]** 모듈 배선(`@InjectRepository`) 변경 다수를 순환 의존/DI 해석 실패 관점에서 실측 확인 — 문제 없음
  - 위치: `codebase/backend/src/modules/edges/edges.module.ts` 게이트 10(`Node` 추가), `codebase/backend/src/modules/workflows/workflows.module.ts` 게이트 23~30(`Folder` 추가), `codebase/backend/src/modules/triggers/triggers.module.ts` 게이트 30~36(`Workflow` 추가)
  - 상세: 모두 `TypeOrmModule.forFeature([...])` 에 엔티티 클래스만 추가하는 방식이라, 해당 엔티티의 소유 모듈(`FoldersModule`/`NodesModule`)을 실제로 import 하지 않는다 — 순환 모듈 의존을 만들지 않는다(기존에도 `Node`/`Edge`/`Workflow` 가 여러 모듈에 이런 식으로 교차 등록돼 있다). `alerts.module.ts`·`schedules.module.ts` 는 `Workflow` 가 **이미** 등록되어 있어 이번 PR 에서 module 파일 변경이 필요 없었고(실제로 diff 목록에 없음), `workflow-assistant.module.ts` 도 `LlmModule`(→`LlmService` export)이 이미 import 되어 있어 새 생성자 파라미터가 DI 실패 없이 해석된다. 프로덕션 코드에서 이 서비스들을 `new` 로 직접 생성하는 자리도 없음을 grep 으로 확인(테스트 파일만 생성자를 직접 호출하며, 해당 `.spec.ts` 들은 이미 이 PR 에서 함께 갱신됨).
  - 제안: 없음(양호 확인 기록용).

- **[INFO]** `WorkflowAssistantSessionService.assertLlmConfigInWorkspace` / `KnowledgeBaseService` 의 모델 설정 검증이 외부 LLM 프로바이더로 네트워크 호출을 하지 않음을 실측 확인
  - 위치: `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts` 게이트 199~210, `codebase/backend/src/modules/llm/llm.service.ts` `resolveConfig`(1행 `if (!llmConfigId) return;` 가드로 해당 함수의 "기본 설정 폴백" 분기는 호출되지 않음을 확인), `codebase/backend/src/modules/model-config/model-config.service.ts` `findEntity`(순수 `repo.findOne` — 외부 호출 없음)
  - 상세: `resolveConfig` 는 `llmConfigId` 가 falsy 면 워크스페이스 기본 설정을 조회해 없으면 `MODEL_CONFIG_DEFAULT_MISSING` 을 던지는 분기가 있는데, `assertLlmConfigInWorkspace` 는 `if (!llmConfigId) return` 으로 그 분기에 도달하기 전에 리턴하므로 의도치 않게 "기본 LLM 미설정" 에러를 새로 유발하지 않는다. `findEntity`/`resolveConfig` 모두 DB 조회만 하고 실제 LLM API 로의 네트워크 호출은 없다.
  - 제안: 없음(양호 확인 기록용).

- **[INFO]** 리뷰 산출물(`review/consistency/2026/09/27/**`)·plan 문서(`plan/**`)·CHANGELOG 변경은 코드 부작용 관점에서 검토 대상이 아님(문서/아카이브 파일)
  - 상세: 이번 diff 의 상당 부분(파일 25~62)은 이전 세션의 consistency-check 산출물과 plan 갱신으로, 런타임 부작용과 무관하다. 부작용 관점 검토는 `codebase/backend/**` 의 7개 서비스 파일 + 유틸 신설(`reference-in-scope.ts`) + 모듈 3곳 배선 변경에 집중했다.

## 요약

이번 변경은 기존 워크스페이스/워크플로 소속 검사 유틸(`assertReferenceInScope`/`throwInvalidReferences`)을 신설해 트리거·스케줄·알림규칙·폴더·노드·엣지·워크플로(folderId)·캔버스 저장·워크플로 어시스턴트 세션·지식베이스 등 다수 쓰기 경로에 저장 전 검증을 추가한다. 전 호출부를 실측한 결과 새 검증은 예외 없이 실제 상태 변경(저장·트랜잭션 커밋·시크릿 스토어 마이그레이션·chat-channel adapter setup 등 외부 부작용)보다 먼저 실행되도록 배치되어 있어, 검증 실패 시 부분 쓰기나 의도치 않은 외부 호출이 남지 않는다. 모듈 배선(`@InjectRepository`) 추가는 전부 이미 존재하는 엔티티/모듈 export 를 재사용하는 표준 TypeORM `forFeature` 패턴이라 순환 의존이나 DI 해석 실패 위험이 없고, LLM/ModelConfig 검증 경로도 순수 DB 조회로 확인되어 의도치 않은 외부 네트워크 호출은 없다. 유일하게 짚어 둘 만한 것은 폴더 재부모화 400 응답이 `details` 없는 형태에서 배열 포함 형태로 바뀌는 의도된(그리고 CHANGELOG 에 문서화된) 인터페이스 확장과, 이 PR 이 새로 도입하지 않았지만 여러 호출부로 반복되는 check-then-act 레이스(참조 대상이 검사 직후 삭제되면 500 가능) 정도이며 둘 다 차단 수준은 아니다.

## 위험도

LOW
