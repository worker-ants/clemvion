# API 계약(API Contract) 리뷰 — 4라운드 (누적 변경 재검토)

## 스코프

1라운드(`review/code/2026/09/10/14_34_18`)의 ④⑤는 사전 존재 결함으로 트래커 등재 완료 — 재조사하지 않음.
②는 planner 후속 4번 등재 완료 — 재조사하지 않음. 본 라운드는 오케스트레이터 지시대로 **이후 3라운드에서 누적된 21건 수정이 API 계약 관점에서 새 문제를 만들었는지**만 3개 질문으로 좁혀 검증했다.

## 검증 내역

### 1. `expectedWorkflowId` 인자 + `id` 판별 fixture 교체 — 계약 검증 의미가 바뀌었는지

`codebase/backend/src/shared/testing/trigger-workflow-ref.ts:99-101`(JSDoc `@param expectedWorkflowId`)와 `:137-139`(구현)를 확인했다. `present:true`일 때 `typeof ref.id === 'string'`(:130) 검증이 **먼저** 통과해야 identity 비교(:137-139)에 도달하는 순서라, `expectedWorkflowId` 추가는 기존 shape 검증을 약화시키지 않고 "shape만 맞는 엉뚱한 relation" 오탐을 추가로 잡는 **강화**다(1라운드 ③에서 이미 지적된 갭의 처방).

`{ toString: () => WF_ID }` fixture(`trigger-workflow-ref.spec.ts:151`)는 실제 API 응답을 흉내 낸 것이 아니라 **헬퍼 자신의 타입 가드**(`expect(typeof ref.id).toBe('string')`)가 실제로 걸리는지 판별하기 위해 손으로 만든 값이다 — docstring(`:132-145`)도 "판별 fixture"라고 명시한다. 이 값이 실제 API 응답에서 나올 수 없다는 전제는 맞다: e2e 케이스(A~E)는 전부 `supertest`의 `res.body`(`JSON.parse` 산출) 또는 서버가 `JSON.stringify`한 응답을 소비하고, JSON은 함수·커스텀 `toString`을 가진 객체를 표현할 수 없다. 즉 이 fixture는 프로덕션 계약 검증 경로가 아니라 **테스트 헬퍼 자체의 self-spec**(회귀 가드)에서만 쓰이고, e2e 쪽 실제 계약 검증 호출부(`expectTriggerWorkflowRef(res.body.data, …)`)에는 전혀 개입하지 않는다. 계약 검증의 의미를 왜곡하지 않는다.

→ 새 문제 없음 (INFO).

### 2. case E docstring 의 R-CC-10 경고 — 계약 서술이 정확한지

`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:216-240`을 실제 구현과 대조했다.

- **경로**: 경고문이 인용하는 `POST /api/triggers/:id/chat-channel/rotate-bot-token`은 `triggers.controller.ts:247`(`@Post(':id/chat-channel/rotate-bot-token')`, `@Controller('triggers')` at `:46`)과 정확히 일치하고, `spec/5-system/15-chat-channel.md:608-612`(R-CC-10 본문)의 API 명과도 일치한다.
- **"건너뛰는 세 단계"**: `rotateBotToken()`(`triggers.service.ts:1238-1367`)의 6단계 중 (a) 기존 토큰 v2 백업(:1301-1306), (b) 전용 감사 액션 `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED`(:1352-1358, `TRIGGER_UPDATED`와 다른 상수), (c) `chatChannelRotatedAt` 컬럼 갱신(:1345)을 각각 확인했다. 반면 PATCH가 타는 `setupChatChannel()`(:915-969)은 `secrets.rotate(botTokenRef, …, chatChannelCfg.botToken ?? '')`(:948-952)를 **비교 없이** 즉시 덮어쓸 뿐 v2 백업이 없고, `update()`가 기록하는 감사는 일반 `TRIGGER_UPDATED`(`:524`)뿐이며, `chatChannelRotatedAt` 갱신 코드가 없다. 세 단계 모두 실제로 스킵됨을 코드로 확인 — 경고문의 서술과 일치한다.
- **"single-path" 표현**: spec 원문 R-CC-10 자체가 "single-path 채택"이라는 동일 어휘를 쓴다(`15-chat-channel.md:608`). 오용이나 과장 없음.

→ 계약을 잘못 서술하지 않는다. 새 문제 없음 (INFO) — 1라운드 ④ CRITICAL 판정을 코드 쪽에 정확히 미러링한 주석이다.

### 3. `TriggerDto` shape 반환 경로가 여전히 정확히 넷인지

`triggers.controller.ts`의 데코레이터를 다시 셌다: `findAll`(`:56` `ApiOkPaginatedResponse(TriggerDto)`) · `findOne`(`:75` `ApiOkWrappedResponse(TriggerDto)`) · `create`(`:94` `ApiCreatedWrappedResponse(TriggerDto)`) · `update`(`:119` `ApiOkWrappedResponse(TriggerDto)`) 넷뿐이고, `getHistory`·`remove`·`rotateNotificationSecret`·`revokePerTriggerToken`·`rotateBotToken`은 `TriggerDto` 전체 shape를 반환하지 않는다. 3라운드 동안 신규 엔드포인트가 추가되지 않아 1라운드 판정과 동일하다.

→ 재확인 완료, 변화 없음.

## 뮤테이션/저장소 변경 여부

이번 라운드는 읽기(Read/Grep/Bash `grep`)만 수행했고 저장소 파일을 고치지 않았다. `git status --short`로 별도 확인할 변경 없음(파일 뮤테이션을 시도하지 않았으므로 원복 절차 불요).

## 요약

이번 커밋의 실제 diff는 주석·라벨 전용이지만, 지시대로 **누적 21건 수정**을 세 축으로 재검증했다. `expectedWorkflowId` 인자와 판별 fixture는 계약 검증의 의미를 왜곡하지 않고(오히려 identity 오탐을 줄이는 강화), fixture가 실제 API 응답에서 나올 수 없는 값이라는 전제도 JSON 직렬화 특성상 맞다. case E docstring의 R-CC-10 경고는 경로·스킵된 세 단계·"single-path" 용어 모두 실제 컨트롤러/서비스/spec과 대조해 정확했다. `TriggerDto` shape 반환 경로는 여전히 정확히 4개(POST create·GET list·GET single·PATCH update)로 1라운드 판정과 변화 없다. 세 질문 모두에서 새로운 API 계약 결함을 찾지 못했다.

## 위험도

NONE — 이번 라운드에서 신규 API 계약 이슈 없음(기존 사전 존재 CRITICAL 2건은 트래커에서 별도 처리 중이며 본 라운드 스코프 밖).

STATUS: success
