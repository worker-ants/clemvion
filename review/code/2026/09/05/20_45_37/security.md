# 보안 리뷰 — §5.4 응답-계약 스윕 (trigger secret 유출 수정 + DTO 선언 정합)

## 요약

이번 diff 는 새 취약점을 들여오는 커밋이 아니라 **기존에 실제로 존재하던 secret 유출을 막는
수정** 그 자체다. 핵심 변경은 `TriggersService.sanitizeForResponse`(구
`sanitizeChatChannelForResponse`)가 (1) `config.chatChannel` 이 없을 때 조기 return 하던 것을
없애고, (2) `config.notification.signing.{secret,secretRef}` 를 새로 스트립 목록에 넣고, (3)
`trigger` 엔티티 컬럼(`notificationSecretV2` 평문 서명 secret, `chatChannelTokenV2` secret
store ref)을 응답 객체에서 `delete` 하는 3중 방어로 확장한 것이다. 아울러 `GET/PATCH/POST
/api/schedules`(+목록)가 `leftJoinAndSelect('s.trigger','t')` 로 실어 오던 **Trigger 엔티티
전체**를, 컨트롤러의 `toResponse()` 가 4필드(`id`·`name`·`workflowId`·`workflow.name`)로
좁히도록 배선했다.

코드를 직접 열어 대조한 결과:

- `TRIGGER_RESPONSE_STRIP_COLUMNS`(`notificationSecretV2`, `chatChannelTokenV2`) 는
  `codebase/backend/src/modules/triggers/entities/trigger.entity.ts` 의 전체 컬럼 중 실제로
  평문/참조 secret 을 담는 컬럼과 정확히 일치한다(다른 컬럼은 health enum·에러 메시지·
  timestamp 뿐). 누락된 secret 컬럼은 없다.
- `sanitizeForResponse` 를 거치는 경로(`findAll`/`findById(간접)`/`findOneDetail`/`create`/
  `update`)는 트리거를 응답으로 내보내는 모든 컨트롤러 엔드포인트(`GET /api/triggers`,
  `GET/POST/PATCH /api/triggers/:id`)를 커버한다. `TriggersController` 의 다른 어떤 곳도
  `Trigger` 엔티티를 직접 반환하지 않는다(grep 으로 확인).
- `SchedulesController.toResponse()` 는 `findAll`/`findOne`/`create`/`update` 4개 엔드포인트
  전부에 적용됐다. `runNow`/`getPreview`/`previewExpression` 은 스케줄 엔티티를 반환하지
  않으므로 대상 밖이다(정확).
- 새로 스트립된 객체는 `Object.assign(Object.create(proto), trigger, overrides)` 로 만든
  **새 객체**이고, 비밀 컬럼은 `delete` 로 키 자체를 제거한다(`undefined` 대입이 아님) — DB에
  붙어 있는 원본 엔티티는 변경되지 않는다.
- 두 회귀(초기 return 누락 / signing 키 누락 / 조인 유출) 모두에 대응하는 unit(`triggers.service.spec.ts`)
  ·e2e(`chat-channel-trigger-create.e2e-spec.ts`, `schedule-trigger.e2e-spec.ts`) 테스트가
  실제 secret 값을 채운 fixture 로 회귀를 고정하고 있다.
- `swagger-dto-contract-guard.ts` 의 신규 술어(`required:false`+`nullable:true` 응답 바디 금지
  조합 래칫)는 자기 검증(양성/음성 대조군 fixture)까지 갖췄고, 스캔 범위가 `src/modules` 로
  한정돼 대조군 fixture(`optional-nullable.fixture.ts`, 의도적 위반 포함)가 프로덕션
  베이스라인을 오염시키지 않는다는 것도 테스트로 확인된다.

새로 선언된 DTO 필드(`TriggerDto` 의 `chatChannelHealth/…RotatedAt` 7종, `IntegrationDto` 의
`appUrl/mallId/tokenExpiresAt/…` 6종, `KnowledgeBaseDto`·`AlertRuleDto` 필드들)는 전부 이미
컨트롤러가 엔티티를 그대로 반환해 wire 로 나가고 있던 필드를 사후에 문서화한 것이며, 실제
crypto secret·평문 자격증명은 포함하지 않는다(`ModelConfigDto.apiKey` 처럼 마스킹된 값이
드러나는 필드는 이번 diff 범위 밖, 기존 상태 그대로).

## 발견사항

- **[INFO]** `notificationLastError`/`chatChannelLastError` 가 §5.4 스윕으로 `TriggerDto` 에
  정식 선언됐다 — 값 자체는 이번 diff 이전부터 wire 로 나가고 있었다(변경 아님).
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts` (`chatChannelLastError`, `notificationLastError` 필드 선언부), 값의 출처는 `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `setupChatChannel` catch 블록(`chatChannelLastError: message.slice(0, 1024)`)
  - 상세: 외부 provider adapter(`slack.adapter.ts`/`discord.adapter.ts`/`telegram.adapter.ts`)가 만드는 에러 메시지는 provider 응답 필드(`result.error`/`res.message`)만 이어붙여 토큰 자체를 echo 하지는 않는 것으로 확인했다. 다만 이 필드는 "1KB 정도 truncate 권장" 수준의 방어만 있고, 향후 adapter 코드가 바뀌어 요청 페이로드(토큰 포함)를 에러 메시지에 넣게 되면 같은 워크스페이스 멤버에게 그대로 노출되는 경로가 된다. 워크스페이스 멤버로 접근 범위가 제한돼 있어 심각도는 낮다.
  - 제안: 새 결함은 아니므로 이번 PR 에서 조치할 필요는 없으나, adapter 에러 처리를 바꿀 때 "provider 원문 에러만 담고 요청 payload 는 절대 포함하지 않는다" 는 불변식을 주석/린트로 고정해두면 좋다.

- **[INFO]** `IntegrationDto.consecutiveNetworkFailures` 는 프런트엔드 소비가 0곳인 내부 health 카운터인데도 이번 스윕으로 정식 노출 필드가 됐다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (`consecutiveNetworkFailures` 필드)
  - 상세: 민감 정보(자격증명)는 아니지만 내부 운영 상태를 외부에 필요 이상으로 노출하는 최소 권한 원칙 관점의 사소한 노출이다. CHANGELOG 와 DTO 주석이 이미 "wire 변경(파괴적)이라 별도 항목으로 트래커에 남긴다" 고 스스로 인지하고 있다 — 이번 PR 의 스코프가 아니다.
  - 제안: 별도 트래커 항목(이미 존재) 그대로 진행. 이번 diff 에서 추가 조치 불필요.

이번 diff 범위 안에서 인젝션·하드코딩된 시크릿·인가 우회·안전하지 않은 암호화·의존성 취약점은
발견되지 않았다. 트리거 rotate/revoke 계열 엔드포인트(`rotate-secret`, `revoke-token`,
`rotate-bot-token`)는 모두 기존 `@Roles('editor')` + `findById(id, workspaceId)` 워크스페이스
스코핑을 그대로 유지하고 있어 이번 변경으로 인가 경계가 약화되지 않았다.

## 위험도

NONE — 이 diff 는 실재하던 secret 유출(§5.4 스윕이 검출한 두 벡터: 트리거 자신의 조기-return
회귀, 스케줄 응답의 조인-유출)을 닫는 수정이며, 검토 결과 새로 도입된 취약점은 없다.
