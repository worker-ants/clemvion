# 정식 규약 준수 검토 — spec/2-navigation/

## 검토 범위 메모

`meta.json` 이 지정한 target 은 `spec/2-navigation/` 전체다. 프롬프트 번들에는 컨텍스트 예산으로
`1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` 세 파일만 전문이 실렸고, 나머지 15개
파일(`4-integration.md` 등)은 절단됐다. 절단분 중 상대적으로 작은 파일들과 절단되지 않은 세 파일은
저장소에서 직접 `Read` 했고, 특히 두 발견사항은 대응 백엔드 컨트롤러 코드까지 직접 대조해 확인했다.
`4-integration.md`(1829줄) 등 대형 절단 파일은 전수 대조하지 못했다 — 부재를 "위반 없음" 의 근거로
쓰지 않는다.

또한 이번 실행의 `plan/in-progress/column-guard-gaps.md` (owner: developer, `spec_impact: none`,
대상은 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 백엔드 테스트 전용)는
`spec/2-navigation/` 과 무관해 보인다 — `--impl-prep scope=spec/2-navigation/` 지정 자체가 이번
plan 과 어긋나 있을 가능성이 있다. 이 스코프 정합성 판단은 본 checker(정식 규약 준수)의 관점 밖이라
`plan_coherence` checker 몫으로 남기고, 아래는 지정된 target 문서 자체의 규약 준수만 다룬다.

---

## 발견사항

- **[WARNING]** `GET /api/folders` 목록 응답의 출력 포맷이 선언되지 않음
  - target 위치: `spec/2-navigation/1-workflow-list.md` §3.1 폴더 관리 API, `GET /api/folders` 행
  - 위반 규약: `spec/conventions/swagger.md` §5-2(공용 래퍼 헬퍼 인벤토리 — `ApiOkWrappedArrayResponse`
    vs `ApiOkPaginatedResponse` 는 다른 wire shape) · `spec/5-system/2-api-convention.md §5.2`
  - 상세: 같은 §3 API 표의 `GET /api/workflows` 행은 "페이지네이션 응답 형식은 API 규약 §5.2 준수"
    를 명시하는데, `GET /api/folders` 행은 어떤 출력 형식(페이지네이션 `{data,pagination}` 인지,
    배열 `{data: Dto[]}` 인지)도 적지 않는다. 실제 구현(`codebase/backend/src/modules/folders/folders.controller.ts:43-54`)은
    `@ApiOkWrappedArrayResponse(FolderDto)` — 즉 `{ data: FolderDto[] }` **배열 wrap**이며 `pagination`
    필드가 없다. 이 사실이 spec 본문에 없으면 `--impl-prep` 단계에서 이 표를 읽는 사람이 형제 행의
    문구("§5.2 준수")를 보고 페이지네이션을 오추정할 여지가 있다.
  - 제안: `GET /api/folders` 행에 "배열 응답(`{ data: FolderDto[] }`) — 페이지네이션 없음, 워크스페이스
    전체 폴더를 한 번에 반환" 같은 한 줄을 추가해 세 가지 유효 출력 형태(단일 객체/배열/페이지네이션)
    중 어느 것인지 명시한다.

- **[WARNING]** `GET /api/triggers/:id/history` 응답의 출력 포맷·상한이 spec 에 없음
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 API 표, `GET /api/triggers/:id/history` 행
  - 위반 규약: `spec/conventions/swagger.md` §5-2 (`ApiOkWrappedArrayResponse` 반환 형태 선언 원칙)
  - 상세: 실제 구현(`codebase/backend/src/modules/triggers/triggers.controller.ts:155-173`)은
    `@ApiOkWrappedArrayResponse(TriggerHistoryItemDto, { description: '최근 실행 이력 (최대 10건)' })`
    — 즉 배열 wrap이며 **최대 10건**으로 명시적으로 캡핑돼 있다. 그런데 nav spec §3 표는 "호출 이력
    조회" 라고만 적어 배열 형태인지, 몇 건까지 오는지 전혀 언급하지 않는다. §2.1·R-6·R-13 이 이
    데이터를 "Recent Calls" 다이얼로그로 소비한다고 설명하면서도 상한을 밝히지 않아, 목록이 전체
    이력인지 최근 일부인지 이 문서만 보고는 판단할 수 없다.
  - 제안: §3 표 또는 §2.1/R-6 어느 한 곳에 "최근 10건 상한, 배열 응답(페이지네이션 없음)" 을
    명시한다.

- **[INFO]** `spec/2-navigation/` 파일 번호열에 `12-` 가 비어 있음
  - target 위치: `spec/2-navigation/` 디렉터리 전체 (파일명 나열: `0,1,2,3,4,5,6,7,8,9,10,11,13,14,15,16`)
  - 위반 규약: `.claude/skills/project-planner/SKILL.md` 명명 컨벤션 "`N-name.md` — 정렬 보장된 상세
    spec" (엄밀히는 연속성을 명시적으로 요구하지 않아 CRITICAL/WARNING 급 위반은 아님)
  - 상세: `git log --follow -- 'spec/2-navigation/12-*'` 로 확인한 결과 과거 워크플로우 버전 히스토리
    문서가 `12-` 를 점유했다가 이후 재배치(`cfffc1355` 등)되며 사라졌다 — 이번 작업이 만든 결손이
    아니라 오래된 상태다. 번호 자체는 정렬 목적이라 연속성이 필수는 아니지만, 신규 파일을 추가할 때
    실수로 `12-` 를 다른 의미로 재사용하면 과거 git 이력의 파일과 혼동될 수 있다.
  - 제안: 조치 불필요. 다음에 `spec/2-navigation/` 에 새 문서를 추가하는 사람이 번호를 고를 때
    `12-` 재사용을 인지하도록 참고만 남긴다 (규약 갱신 불필요, 조치 없이 종결 가능).

## 확인했으나 위반이 아닌 항목 (참고)

아래는 위반처럼 보일 수 있어 직접 대조했으나 **규약을 준수하고 있음**을 확인한 항목이다 — 향후
같은 지점이 재-flag 되지 않도록 남긴다.

- 에러 코드 표기: 세 파일 전체에서 사용된 에러 코드(`VALIDATION_ERROR`, `RESOURCE_CONFLICT`,
  `TRIGGER_ENDPOINT_PATH_CONFLICT`, `AUTH_CONFIG_NOT_FOUND`, `BOT_TOKEN_INVALID`, `INVALID_FIELD`,
  `DUPLICATE_NODE_LABEL` 등)는 전부 `UPPER_SNAKE_CASE`이며 `error-codes.md` §1 을 따른다.
  `details.field`/`details.code='INVALID_FIELD'` 패턴도 `2-api-convention.md §5.3` 의
  "도메인 세부 사유를 어디에 싣는가" 택일 기준과 정확히 일치한다.
- 감사 액션: `trigger.chat_channel_bot_token_rotated` · `trigger.notification_secret_rotated` ·
  `trigger.interaction_token_revoked` · `trigger.updated` · `trigger.deleted` 모두
  `audit-actions.md` §3 레지스트리에 등재된 값과 정확히 일치.
  토큰 구분자(언더스코어)도 준수.
- DTO 명명: `UpdateWorkflowDto`(top-level PATCH body) vs `WorkflowSettingsDto`(nested, prefix 없음)
  분리가 `swagger.md §1-7` Update 접두 범위 규칙과 일치. `PatchXDto` 형태의 위반 사례 0건(grep 확인).
  `ExportWorkflowDto`/`TriggerDto`/`ScheduleDto` 등도 이름 충돌·prefix 오적용 없음.
  `ScheduleDto.trigger.workflow`(name 만) vs `TriggerDto.workflow`(id+name) 의 의도적 비대칭도
  두 문서 모두 "한쪽을 다른 쪽으로 갈아 끼우지 말 것" 로 명시해 규약과 합치.
  `WorkflowSettingsDto` 필드(`maxConcurrentExecutions`)만 허용하는 strict DTO 정책, chat-channel
  `uiMapping.formMode/visualNode/buttonLayout` enum 값도 `chat-channel-adapter.md §2.3`
  `ChatChannelConfig` 선언과 1:1 일치.
- `pending_plans` frontmatter: `1-workflow-list.md` 의
  `plan/complete/workflow-duplicate-nodes-edges.md` 항목은 완료된 plan 인데도 남아 있어 처음엔
  누락 정리로 의심했으나, 그 plan 자체의 체크리스트에 "완료 시 `pending_plans:` 경로를
  `plan/complete/...` 로 치환했다"는 명시적 조치가 있고 `spec-pending-plan-existence.test.ts` 가
  이 형태(치환된 완료 경로)를 그대로 통과시키는 것으로 확인 — 의도된 처리이며 위반 아님.
  `2-trigger-list.md` 의 `pending_plans: [spec-draft-nullable-notation-followups.md]` 도 그 plan
  본문에 `GET /api/triggers` sort/order 미구현 항목이 미체크 상태로 실재해 정합.
- Swagger 컨트롤러 패턴: `@ApiTags`/`@ApiBearerAuth('access-token')`/역할별 `@ApiForbiddenResponse`
  요구가 언급된 API 들(폴더 `editor+`, 트리거 `editor+` 등)의 실제 컨트롤러 코드가 규약과 일치.
- Rationale 섹션: 세 문서 모두 `## Rationale` 로 종결하며 결정 배경·기각 대안을 담아
  project-planner SKILL 의 3섹션 원칙(다중 파일 영역이므로 Overview 는 `_product-overview.md` 로
  위임)을 따름 — 개별 문서에 `## Overview` 가 없는 것은 위반이 아니라 관례대로 위임된 것.

## 요약

`spec/2-navigation/1-workflow-list.md` · `2-trigger-list.md` · `3-schedule.md` (전문 검토 대상)는
에러 코드 표기, 감사 액션 명명, DTO 명명(Update 접두 범위), chat-channel enum 정합, `details` 배치
등 정식 규약을 매우 촘촘하게 준수하고 있으며 명백한 CRITICAL 위반은 발견되지 않았다. 발견된 두 건은
모두 "출력 포맷 규약" 관점의 **문서화 공백**(실제 구현은 이미 정상 동작하지만 spec 표가 그 형태를
명시하지 않아 --impl-prep 단계에서 오독 여지를 남김)이며, 코드 대조로 실측 확인했다. 나머지는
컨텍스트 예산으로 절단된 대형 파일(`4-integration.md` 등)이라 이번 회차에서 전수 검증하지 못했다는
한계가 있다.

## 위험도

LOW
