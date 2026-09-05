# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** `TriggerDto.workflow` JSDoc 이 "생성 응답에만 없다" 고 단정하지만, `update()` 가
  `chatChannel` 을 포함한 PATCH 를 처리할 때는 **수정 응답에서도 `workflow` 가 사라진다** — 문서화된
  보장이 실제 구현보다 넓다.
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:94-102`
    (JSDoc: `목록·단건 조회와 **수정**(update() 가 findById 로 시작한다) 에서 로드된다. **생성
    응답에만 없다**`) / `codebase/backend/src/modules/triggers/triggers.service.ts:500-511`
    (`update()` 의 `if (chatChannel) { … const refreshed = await this.triggerRepository.findOne({
    where: { id: saved.id, workspaceId } }); if (refreshed) result = refreshed; }`)
  - 상세: `update()` 는 `findById(id, workspaceId)`(`relations: ['workflow']`)로 시작해 `trigger.workflow`
    를 로드한다. `chatChannel` 이 **없는** PATCH 는 그 `trigger` 참조를 그대로 `sanitizeForResponse`
    에 넘기므로 `workflow` 가 살아남는다 — 이 경로는 이미 이전 라운드(`review/code/2026/09/05/22_48_39`
    W3)가 검증해 JSDoc 을 "create() 만 없다" 로 고쳤다. 그런데 `chatChannel` 이 **있는** PATCH(예:
    Telegram/Discord/Slack chat-channel 트리거의 채널 설정 변경, bot token 회전과 무관하게 `chatChannel`
    필드를 다시 보내는 모든 요청)는 `setupChatChannel` 뒤 `triggerRepository.findOne({ where: { id,
    workspaceId } })` 로 **관계 없이(relations 인자 없음)** 재조회하고 그 결과로 `result` 를 덮어쓴다.
    `Trigger.workflow` 는 `@ManyToOne(() => Workflow, { onDelete: 'CASCADE' })` 로 `eager` 가 아니므로,
    관계를 명시하지 않은 조회에서는 로드되지 않는다 — 이 refetch 이후 `sanitizeForResponse` 의
    `narrowWorkflowRef` 가 `wf` 를 못 찾아 `workflow` 키가 응답에서 빠진다. 즉 JSDoc 이 "생성만 예외"
    라고 단정한 것과 달리, 실제로는 **수정 응답도 `chatChannel` 페이로드 유무에 따라 형태가 갈린다.**
    이 refetch 코드 자체는 이 PR 이 새로 만든 것이 아니지만(기존 `hasBotToken` staleness 방지용),
    이번 PR 이 새로 써 넣은 "생성 응답에만 없다" 는 단정 JSDoc 은 이 하위 경로를 놓쳤다 — 정확히
    같은 세션이 두 번 반복한 실수(create/update 클레임 오류 → 이번엔 update 내부의 분기 클레임 오류)의
    세 번째 변주다. 기능적으로는 안전하다 — `workflow` 는 §5.4 키 생략형(`@ApiPropertyOptional`)이라
    계약 검증자가 부재를 위반으로 잡지 않고, 프런트엔드도 `t.workflow?.name ?? ''` 로 방어한다. 다만
    e2e 중 `chatChannel` 을 포함한 `PATCH /api/triggers/:id` 를 때리는 케이스가 전무해
    (`chat-channel-discord/slack/trigger-create.e2e-spec.ts` 어디에도 `.patch(` 호출 없음), 이 편차는
    양성으로도 음성으로도 한 번도 단언된 적이 없다.
  - 제안: JSDoc 을 "chatChannel 을 포함한 PATCH 는 재조회가 관계를 안 실어 `workflow` 가 없다" 로
    한 문장 추가하거나, `triggers.service.ts:506-508` 의 재조회에 `relations: ['workflow']` 를 추가해
    문서의 "수정에서는 항상 로드" 주장을 실제로 맞춘다(후자가 §5.4 일관성 관점에서 더 낫다 — 같은
    엔드포인트가 요청 페이로드에 따라 응답 형태가 갈리는 것 자체가 이 PR 이 다른 곳(스케줄
    `isActive`)에서 이미 문제로 지목한 패턴과 동형이다).

## 요약

`sweep-response-contract` 브랜치는 §5.4 응답-계약 런타임 검증자(`response-contract.ts`)를 14개
e2e 파일에 배선하고, 그 과정에서 실측으로 드러난 트리거 회전 secret 2종(`notificationSecretV2`
평문 서명 secret, `chatChannelTokenV2` secret store ref)의 응답 유출을 `TriggersService.sanitizeForResponse`
(엔티티 컬럼 축 신설 + JSONB 세 축 통합) 와 `SchedulesController.toResponse`(조인된 Trigger 를 참조
4필드로 좁힘)로 차단한다. 함께 §5.4 금지 조합(`required:false`+`nullable:true`) 정적 래칫을
신설해 응답 DTO 78개 필드를 고정하고, 5개 DTO 24필드의 "선언 누락" 을 실제 wire 에 맞춰 보정했다.
13라운드에 걸친 선행 리뷰가 조기 return·JSONB 세 축 중 두 축 누락·`Object.assign` 의 `undefined`
덮어쓰기·엔티티 참조 동일성·CWE-209 정보 누출 등 이 클래스의 결함을 이미 조밀하게 걷어냈고,
각 수정이 뮤턴트 실측(RED→GREEN) 과 함께 unit/e2e 양쪽에 고정돼 있어 재확인한 핵심 경로
(secret strip 4축, `isActive` 무관 trigger 대입, DTO required/nullable 선언, `allowMissing`
경로 매칭)는 spec(`spec/5-system/2-api-convention.md §5.4`, `spec/conventions/secret-store.md
§1.1`)과 line-level 로 일치했다. 이번 라운드에서 새로 발견한 것은 `TriggerDto.workflow` 의
JSDoc 이 "생성 응답에만 없다" 고 단정하지만 `chatChannel` 페이로드를 포함한 PATCH 는 relations
없는 재조회를 거쳐 수정 응답에서도 그 필드가 빠지는 경로 하나이며, §5.4 키 생략형 설계 덕에
기능적 파손은 아니나 문서화된 보장이 구현보다 넓다는 점에서 WARNING 으로 기록한다. TODO/FIXME/HACK
류의 미완성 표식은 diff 전역에서 발견되지 않았고, 반환값 누락·에러 경로 미정의·엣지 케이스
방치는 관찰되지 않았다.

## 위험도
LOW
