# API 계약(API Contract) 리뷰 — cross-workspace-refs (3R, HEAD `b2780f3f6`)

대상: 쓰기 요청 본문의 참조 id 가 다른 워크스페이스(구조 참조는 다른 워크플로) 행을 가리키면 저장 전에 거부하는 변경
(`codebase/backend/src/common/utils/reference-in-scope.ts` 신설 + `alerts`·`edges`·`folders`·`knowledge-base`·`nodes`·
`schedules`·`triggers`·`workflow-assistant`·`workflows` 서비스 배선, e2e `cross-workspace-references.e2e-spec.ts` 18케이스,
CHANGELOG). 이번 라운드는 1R(`review/code/2026/09/27/21_43_01`, 조치 `698ad8ab7`)·2R(`review/code/2026/09/27/22_11_22`, 조치
`421b69088`, W2·W3 수렴 예외 등재)이 이미 API 계약 관점을 두 차례 독립적으로 검토한 뒤의 상태다. `git diff --stat 421b69088 HEAD
-- codebase/backend/src`·`git diff --stat c747f2405 HEAD -- codebase/backend/src codebase/backend/test` 로 실측한 결과,
2R 이후 `codebase/backend/src` 는 무변경이고 `codebase/backend/test`(엄밀히는 `workflows.service.spec.ts`)에 2R W1 조치로
추가된 뮤턴트 M6 회귀 테스트 19줄만 늘었다 — 이번 라운드에서 API 계약 표면 자체는 바뀌지 않았다.

## 발견사항

이번 라운드에서 새로 발견된 Critical/Warning 없음. 1R·2R 리포트의 발견사항(메시지 문구 두 갈래 "in this canvas"/"in this
workflow", 지식베이스 모델 설정 검증만 첫 위반에서 멈추는 비대칭, 기존 관례와 동형인 TOCTOU 창)은 모두 INFO 로 이미 처분됐고
코드 변화가 없으므로 유효성도 그대로다. 아래는 이번 라운드에서 독립적으로 재확인한 결과다.

- **[INFO]** (재확인, 신규 아님) 종전엔 다른 워크스페이스 폴더를 가리키는 `parentId` 거부 응답에 `details` 필드가 아예 없었는데,
  이번 변경으로 `details: [{ field: 'parentId', message, code: 'INVALID_FIELD' }]` 가 추가됐다 — 필드 **추가**이지 기존 필드
  제거·형 변경이 아니라 하위 호환에 영향 없다.
  - 위치: `codebase/backend/src/modules/folders/folders.service.ts` `validateParentChange`(구 인라인 400, 이제
    `assertParentInWorkspace` 호출로 치환된 자리)
  - 상세: `git diff origin/main -- codebase/backend/src/modules/folders/folders.service.ts` 로 확인 — 옛 코드는
    `{ code: 'VALIDATION_ERROR', message }` 만 던졌고 `details` 키가 없었다. `details` 를 읽지 않는 기존 클라이언트는 영향이
    없고, 읽는 클라이언트는 이제 필드 경로까지 얻는다.
  - 제안: 조치 불요.

- **[INFO]** 불변 참조 필드는 업데이트 경로에 검사가 없고, 이는 DTO 설계와 정확히 대응한다(실측 재확인)
  - 위치: `codebase/backend/src/modules/triggers/dto/create-trigger.dto.ts:25`(`workflowId: string`, `UpdateTriggerDto` 에는
    없음), `codebase/backend/src/modules/schedules/dto/create-schedule.dto.ts:19`(동형, `UpdateScheduleDto` 에 없음),
    `codebase/backend/src/modules/alerts/dto/alert-rule.dto.ts:66`(`CreateAlertRuleDto.workflowId`, `UpdateAlertRuleDto` 에
    없음), `codebase/backend/src/modules/edges/edges.controller.ts:41,64,94`(`GET`/`POST`/`DELETE` 만 노출, `PATCH` 없음)
  - 상세: `grep -n workflowId` 로 각 update DTO 를 열어 직접 대조했다 — 세 서비스 모두 `workflowId` 가 생성 후 재배정 불가능한
    필드라 create 경로에만 소속 검사를 추가한 것이 맞다. 엣지도 PATCH 엔드포인트 자체가 없어 create-only 검사로 충분하다.
    누락된 update-path 갭은 없다.
  - 제안: 조치 불요(확인 목적의 기록).

- **[INFO]** 신규 검사는 기존 DTO 레벨 형식 검증(`@IsUUID` 등) 위에 얹히는 시맨틱(소속) 검증이라 요청 검증 계층이 중복되지 않고
  분리돼 있다
  - 위치: `codebase/backend/src/modules/edges/dto/create-edge.dto.ts`(`@IsUUID() sourceNodeId/targetNodeId`),
    `codebase/backend/src/modules/schedules/dto/create-schedule.dto.ts:19`(`@IsUUID() workflowId`),
    `codebase/backend/src/modules/nodes/dto/{create,update}-node.dto.ts`(`containerId?/toolOwnerId?: string | null`, empty
    string → null 변환 spec 은 `node-dto-validation.spec.ts` 로 별도 고정)
  - 상세: 형식이 틀린 UUID 는 여전히 `CustomValidationPipe` 가 400 `VALIDATION_ERROR` 로 먼저 잡고, 형식은 맞지만 소속이 틀린
    id 만 이번 PR 의 `assertReferenceInScope`/`throwInvalidReferences` 가 잡는다 — 책임이 겹치지 않는다.
  - 제안: 없음.

## 검증한 항목 (문제 없음, 이번 라운드 독립 재확인)

- **응답 봉투 일관성**: e2e `cross-workspace-references.e2e-spec.ts` 의 `expect400` 헬퍼가 `res.body.error.code === 'VALIDATION_ERROR'`
  와 `Array.isArray(res.body.error.details)` 를 명시적으로 단언하며 18케이스 전부가 이 헬퍼를 공유한다 — 표면마다 응답 형태가
  갈리지 않는다는 것이 이번 PR 자신의 회귀 그물로 고정돼 있다. 모델 설정 참조(어시스턴트 세션 `llmConfigId`, KB 세 필드)는
  기존 `findEntity`/`resolveConfig` 의 404 `MODEL_CONFIG_NOT_FOUND` 를 그대로 재사용해 새 코드를 만들지 않는다.
- **CHANGELOG 정확성**: `CHANGELOG.md` Unreleased 항목이 트리거/스케줄 `workflowId`, 캔버스 저장 `nodes[i].id`/`containerId`/
  `toolOwnerId`/엣지 끝점, 그 외 `folderId`/`parentId`/`workflowId`(알림), 모델 설정 4필드까지 실제 코드 변경과 1:1 로 대응함을
  diff 로 확인했다 — 문서가 구현보다 넓게 말하는 곳이 없다.
- **하위 호환성**: 종전에 (의도치 않게) 성공하던 cross-workspace/cross-workflow 참조 요청을 이제 400/404 로 거부하는 의도적
  breaking change 다. IDOR 성격 보안 결함의 수정이고 CHANGELOG 에 영향 범위·이전 동작이 명시돼 있어, 자기 워크스페이스/
  워크플로 id 만 참조하는 정상 클라이언트는 영향받지 않는다.
- **URL·버전·페이지네이션·인증**: 새 엔드포인트·경로 변경 없음(기존 핸들러 내부 로직만 변경). 목록 API 변경이 없어 페이지네이션
  무관. 인증/인가 가드 변경 없이, 오히려 누락돼 있던 cross-tenant 인가 경계(IDOR)를 메운다.

## 요약

3R 시점 `codebase/backend/src` 는 2R(`421b69088`) 이후 무변경이며, 이번 라운드에 늘어난 것은 2R W1 조치로 추가된 회귀
테스트 19줄뿐이다(`git diff --stat` 실측). API 계약 표면(엔드포인트·요청 검증·응답 스키마·에러 코드·인증) 자체가 바뀌지
않았으므로 1R·2R 이 이미 Critical 0 · Warning 0(잔여 Warning 2건은 수렴 예외로 트래커 등재, 1건은 커밋으로 조치)으로 수렴한
판정이 그대로 유지된다. 이번 라운드에서 독립적으로 재확인한 결과도 동일하다 — 새 저장-전 소속 검증은 기존
`GlobalExceptionFilter`/`CustomValidationPipe` 의 `VALIDATION_ERROR`+배열 `details` 봉투를 그대로 따르고, 모델 설정 참조는
기존 404 코드를 재사용하며, 불변 필드는 create 경로에만 검사가 있어 DTO 설계와 정합하고, 하위 호환성 측면에서는 의도된
보안 breaking change 로 CHANGELOG 에 명시돼 있다. 새로 지적할 Critical/Warning 은 없다.

## 위험도

NONE
