# 신규 식별자 충돌 검토 — `impl-chat-channel-patch-token` (spec/5-system, --impl-prep)

## 검토 범위 요약

target 은 이미 병합된 `spec/5-system/15-chat-channel.md` (§5.4.1 / §5.4.1.1 / R-CC-21 등, planner PR
#1311 산출)와, 이를 구현하는 진행 중 plan `plan/in-progress/impl-chat-channel-patch-token.md`
(D-1/D-2/D-3 설계) 다. spec 자체가 신규 요구사항 ID·엔드포인트·이벤트·ENV·컬럼을 새로 추가하지
않으므로 (모두 기존 CCH-*, R-CC-* 재참조), 실제로 "신규 도입"되는 식별자는 plan 의 D-1 설계가
제시하는 **`ChatChannelPatchConfigDto`** 클래스명 하나로 좁혀진다. 이를 codebase 전수 grep 으로
대조했다.

## 발견사항

- **[WARNING]** 신규 DTO 명 `ChatChannelPatchConfigDto` — 이 코드베이스에 없던 "Patch" 접두 패턴을 처음 도입한다
  - target 신규 식별자: `ChatChannelPatchConfigDto` (`plan/in-progress/impl-chat-channel-patch-token.md` D-1, "`UpdateTriggerDto.chatChannel` 만 이 타입으로 바꾼다")
  - 기존 사용처: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:16` 의 요청 DTO 는 `UpdateTriggerDto` (PATCH 엔드포인트에 매핑되지만 "Update" 어휘 사용). 같은 파일이 감싸는 다른 nested config 는 `NotificationConfigDto`(`notification-config.dto.ts:86`)·`InteractionConfigDto`(`interaction-config.dto.ts:27`) — 모두 create/update 공용이며 HTTP 동사 접두어가 없다. 저장소 전체(`grep -rn "class .*Patch" codebase/backend/src`)에 `Patch` 접두 클래스가 **0건**이다.
  - 상세: 직접적인 이름 충돌(동일 식별자가 다른 의미로 이미 쓰이는 경우)은 없다 — `ChatChannelPatchConfigDto`/`ChatChannelPatchConfig`/`PatchConfigDto` 어떤 형태로도 backend·frontend·spec·plan 전체에서 기존 사용례가 0건이다 (`grep -rn "PatchConfigDto\|ChatChannelPatchConfigDto" codebase spec plan` 확인). 다만 이 저장소의 확립된 명명 관례는 "Create/Update" 축이지 "Patch" 축이 아니다 — 부모 DTO 가 `UpdateTriggerDto` 인데 자식만 `Patch...Dto` 로 갈리면, 다음 사람이 "Create/Update/Patch 3-way 분기가 일반 패턴인가" 로 오독할 여지가 있다(실제로는 이 필드 한 곳의 secret-write 차단 목적 특례).
  - 제안: `ChatChannelPatchConfigDto` 대신 `UpdateTriggerDto` 의 기존 어휘에 맞춘 `ChatChannelUpdateConfigDto` (또는 `ChatChannelConfigDto` 를 `Omit`/`PickType` 으로 파생한 이름, 예: `ChatChannelConfigForUpdateDto`) 채택을 검토하거나, "Patch" 를 쓰는 근거(값이 아니라 "쓰기 자체를 막는다"는 의미 강조)를 D-1 설계 항목에 한 줄로 남겨 다음 사람의 오독을 예방.

## 그 외 점검 관점 — 충돌 없음 확인

- **요구사항 ID**: plan 은 CCH-*/R-CC-* 신규 ID 를 부여하지 않고 기존 R-CC-10/R-CC-21/CCH-SE-04 를 재참조만 한다. 충돌 없음.
- **API endpoint**: 신규 endpoint 없음 — 기존 `PATCH /api/triggers/:id` (body 의 `chatChannel` 서브필드 검증만 강화) 재사용. `POST /api/triggers/:id/chat-channel/rotate-bot-token` 도 기존 endpoint (R-CC-10, `spec/5-system/15-chat-channel.md:406` 이력에서 이미 개명 완료 확인). 충돌 없음.
- **이벤트/메시지명**: 신규 webhook/queue/SSE 이벤트 없음.
- **환경변수·설정키**: 신규 ENV var·config key 없음. `chat_channel_token_v2` 컬럼은 이미 병합된 기존 컬럼이며 `notification_secret_v2` 와의 명명 유사성은 spec Rationale §R-K 에서 이미 의미 차이("bot token reference" vs 별개 semantic)로 정합화되어 있어 재-flag 대상 아님.
- **파일 경로**: 신규 DTO 는 기존 `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (frontmatter `code:` 목록에 이미 등재)에 추가될 파일로, 새 경로를 만들지 않는다. 경로 충돌 없음.
- **`details.field` 값**: §5.4.1 표는 `botToken` 평문 필드 차단 시 `details.field` 값을 "미확정 — 후속 e2e 확인 대기"로 명시한다. class-validator 기반 파이프는 `ValidationError.property` (즉 DTO 필드명)를 그대로 `details.field` 로 사용하는 기존 관례이므로, 자연 귀결은 `details.field='botToken'` — 이미 정의된 `details.field='botTokenRef'` (ref 필드 차단, §5.4)와 프로퍼티명이 달라 자동으로 구별된다. 충돌 가능성 낮음 (INFO, 이미 plan 체크리스트 "details.field 실제 페이로드 캡처" 항목으로 추적 중이라 별도 조치 불요).

## 요약

target 이 실질적으로 새로 도입하는 식별자는 `ChatChannelPatchConfigDto` 클래스명 하나뿐이며, 저장소
전체 grep 대조 결과 기존에 같은 이름이 다른 의미로 쓰인 사례는 없어 CRITICAL 급 충돌은 없다. 다만 이
이름이 이 코드베이스에서 처음 등장하는 "Patch" 접두 DTO 패턴이고, 정작 그 부모 요청 DTO 는
`UpdateTriggerDto` 라는 다른 어휘를 쓰고 있어 명명 일관성 관점의 WARNING 하나를 남긴다. 요구사항
ID·엔드포인트·이벤트명·ENV/설정키·파일 경로 축에서는 신규 도입 항목이 없거나 이미 이전 PR
(R-K, 감사 액션 개명)에서 정합화가 끝나 재발 우려가 없다.

## 위험도

LOW
