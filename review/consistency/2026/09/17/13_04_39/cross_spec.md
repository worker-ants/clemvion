# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-prep)

## 검토 범위와 방법

target 은 `spec/2-navigation/` (실질적으로 `2-trigger-list.md` 가 핵심, `1-workflow-list.md`·
`3-schedule.md` 동반)이며, 세션의 실제 작업은 `plan/in-progress/trigger-save-partial-patch.md`
(`TriggersService.update()` 의 통째 `save` → 부분 객체 `save` 전환, `spec_impact: none`)이다.
Cross-Spec 조립 프롬프트는 컨텍스트 예산으로 `spec/2-navigation/` 밖 파일 대부분이 절단됐으므로,
target 이 직접 인용하는 교차 spec — `1-data-model.md §2.8/§2.9/§2.9.1/§2.17.2`,
`data-flow/10-triggers.md`, `data-flow/11-workflow.md`, `5-system/1-auth.md §3.2/§4.1`,
`5-system/2-api-convention.md §5.4`, `5-system/14-external-interaction-api.md §4/§7.1/§7.3`,
`5-system/15-chat-channel.md §5.4/§5.4.1/§5.4.1.1/§5.4.1.2/R-CC-10/R-CC-21`,
`2-navigation/4-integration.md` (cafe24-token-refresh 락 기각 근거), `2-navigation/6-config.md`,
`4-nodes/7-trigger/providers/_overview.md`, `conventions/chat-channel-adapter.md` — 를 직접 Read 로
열어 대조했다.

## 발견사항

- **[INFO]** Chat Channel §5.4 에러 표가 새로 추가된 CASCADE-race 404 사유를 나열하지 않는다
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3 "동시 쓰기 직렬화" 註 — *"락으로 막을
    수 없는 삭제 경로가 있다 … 병합 쓰기가 0행에 매치되면 쓰지 못한 것으로 취급한다
    (rotate-bot-token 은 이때 404)"*
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4 에러 표 — `404 RESOURCE_NOT_FOUND` 행의
    사유를 *"trigger 미존재 또는 워크스페이스 권한 없음 (`triggers.service.ts:122 findById`)"*
    한 가지로만 적는다.
  - 상세: 두 문서가 같은 엔드포인트(`POST /api/triggers/:id/chat-channel/rotate-bot-token`)의
    같은 에러 코드(`404 RESOURCE_NOT_FOUND`)를 말하므로 값 자체는 모순되지 않는다. 다만
    `2-trigger-list.md` 가 (최근 PR #1342 로) 새로 서술한 "락 안 재읽기가 CASCADE 로 비어
    404" 라는 **두 번째 발생 경로**가 chat-channel 쪽 에러 표에는 반영돼 있지 않다 — chat-channel
    스펙만 읽으면 이 엔드포인트의 404 는 사전 `findById` 단계에서만 난다고 오독할 수 있다.
    이 자리는 정확히 이번 세션이 실측·수정하려는 CASCADE 창(`trigger-save-partial-patch.md`)과
    맞닿아 있어, 구현이 실제로 그 경로에서 404 를 내도록 고정되면 chat-channel 쪽 표도 원인
    한 줄을 추가해야 완결된다.
  - 제안: 코드 변경(창 1 실측·수정)이 이 rotate-bot-token 0행 케이스를 캐너리로 고정하는 시점에,
    `5-system/15-chat-channel.md §5.4` 에러 표의 `404 RESOURCE_NOT_FOUND` 행에 "동시 삭제
    CASCADE 창에서의 재조회 실패" 사유를 추가하는 소규모 planner 후속으로 동기화 권장. 이번
    developer PR 의 스코프(spec 불변)는 그대로 유지해도 무방 — 트래커(`spec-draft-nullable-
    notation-followups.md` 항목 7 또는 신규 항목)에 "chat-channel §5.4 에러 표 동기화" 를
    함께 등재.

## 대조했으나 충돌 없음 (근거)

아래는 target 이 다른 영역을 인용하는 주요 지점을 실제로 열어 대조한 결과이며, 전부 정합했다 —
"조사하지 않아서 안 보인 것"이 아니라 "열어서 확인했더니 일치"임을 밝혀 둔다.

- `1-data-model.md §2.8 Trigger` 의 `notification_secret_v2`/`chat_channel_token_v2`/
  `chat_channel_health` 등 컬럼 정의 ↔ `2-trigger-list.md §2.3.1` 필드 권한 매트릭스 서술 — 일치.
- `data-flow/10-triggers.md §1.4`·`§2.1`·`§3.1` (Schedule↔Trigger 양방향 동기화, FK CASCADE/SET
  NULL, `is_active` 상태 전이) ↔ `2-trigger-list.md §4.3`·`3-schedule.md §3` — 일치. 특히
  `data-flow/11-workflow.md` §"CASCADE 매핑" 표의 `trigger | CASCADE — … DB 레벨이라 트리거 단위
  advisory lock 을 거치지 않는다"` 행이 `2-trigger-list.md#43-cascade-동작` 을 직접 역참조하며
  정확히 같은 문장을 공유한다.
- `2-navigation/4-integration.md` 의 `cafe24-token-refresh` 락 기각 Rationale
  (*"lock 보유 중 HTTP 요청이 DB 커넥션 점유를 늘린다"*) ↔ `2-trigger-list.md §3` 의 "외부
  provider 호출은 락 밖" 근거 인용 — 원문과 정확히 일치.
- `5-system/1-auth.md §3.2` 권한 매트릭스(Trigger=CRUD/CRUD/CRUD/R, Auth Config=CRUD/CRUD/R/R)
  ↔ `2-trigger-list.md §4.1` 삭제 권한 표 + `§2.3.1` Auth Config 행의 "+ 새 인증 설정 만들기는
  Admin+" 서술 — 일치. `§4.1` 기록 대상 액션(`trigger.created/updated/deleted`,
  `trigger.notification_secret_rotated`/`chat_channel_bot_token_rotated`/
  `interaction_token_revoked`) ↔ `2-trigger-list.md §3` API 표의 감사 로그 각주 — 액션명 정확히
  일치.
- `5-system/2-api-convention.md §5.4` 의 (b) 기준("소비자가 부재를 정상 경로로 다룬다") ↔
  `2-trigger-list.md §3` "`TriggerDto.workflow` 는 키 생략형" 註, `3-schedule.md §4`
  "`trigger.workflow` 키 생략" 註 — 판정 근거 일치. 두 문서가 `id`+`name` vs `name` 단독으로
  의도적으로 다르다고 상호 주석한 것도 서로 모순 없이 정합.
- `5-system/14-external-interaction-api.md §7.1` 의 `config.notification{url,events,signing,retry}`
  / `config.interaction{enabled,tokenStrategy}` JSON 구조 ↔ `2-trigger-list.md §2.3.1` "External
  Interaction" 행 — 필드명 일치.
- `5-system/15-chat-channel.md §5.4.1/§5.4.1.1/§5.4.1.2`·R-CC-10·R-CC-21 의 PATCH 차단 규칙
  (`botTokenRef`/`botToken`/`inboundSigning`/`provider` 불변성, `details.field` nested-vs-flat
  분기) ↔ `2-trigger-list.md §3` PATCH 註의 동일 서술 — 문장 단위로 일치 (앵커까지 유효).
- `conventions/chat-channel-adapter.md` 의 `uiMapping.formMode`(`multi_step|native_modal|auto`)/
  `visualNode`(`text|photo|auto`)/`buttonLayout`(`auto|vertical|horizontal`) enum ↔
  `2-trigger-list.md §2.3.1` Chat Channel 행 — enum 값 일치.
- `2-navigation/6-config.md §3`·§A.4 의 `POST /api/auth-configs/:id/regenerate` (Admin+) ↔
  `2-trigger-list.md §3` "Webhook 인증 자격증명의 회전은 AuthConfig 책임으로 일원화" 註 — 일치.
- `4-nodes/7-trigger/providers/_overview.md §1` 의 v1 지원 provider(`telegram`/`slack`/`discord`)
  ↔ `2-trigger-list.md §2.3.1` Chat Channel `provider` 행 — 일치.

## 참고 — 이번 세션 스코프 밖으로 확인한 것

`spec/2-navigation/2-trigger-list.md §3` 의 ⚠️ *"실측되지 않은 잔여"* 문단(PATCH 기본 저장 경로의
CASCADE 창·락 밖 컬럼 경합)은 **같은 문서 내부의 자기 일관성** 이슈(구현이 그 문장을 반증할
예정이며 `plan/in-progress/trigger-save-partial-patch.md` 가 "이 PR 이 안 하는 것" 에서 planner
턴으로 명시 분리)라 Cross-Spec 관점의 판정 대상이 아니다. 그 정정은 developer 완료 후 별도
planner PR 로 처리되는 것이 계획대로다.

## 요약

target(`spec/2-navigation/`, 특히 `2-trigger-list.md`)이 인용하는 데이터 모델·API 계약·RBAC·
CASCADE·PATCH 차단 규칙은 실제로 열어본 교차 spec(`1-data-model.md`, `data-flow/10-triggers.md`,
`data-flow/11-workflow.md`, `5-system/1-auth.md`, `5-system/2-api-convention.md`,
`5-system/14-external-interaction-api.md`, `5-system/15-chat-channel.md`,
`2-navigation/4-integration.md`, `2-navigation/6-config.md`, `4-nodes/7-trigger/providers/
_overview.md`, `conventions/chat-channel-adapter.md`)와 문장 단위로 정합했다. 유일하게 남는
항목은 CASCADE-race 404 사유가 `chat-channel.md` 에러 표에 아직 반영되지 않은 완성도 격차(INFO)
뿐이며, 이는 이번 developer PR 이 그 창을 캐너리로 고정한 뒤 후속 문서 동기화로 닫으면 된다.
CRITICAL·WARNING 급 모순은 발견하지 못했다.

## 위험도

LOW
