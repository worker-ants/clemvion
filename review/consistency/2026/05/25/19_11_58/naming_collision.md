# 신규 식별자 충돌 검토 — `spec/5-system/15-chat-channel.md`

검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-05-25

---

## 발견사항

### [INFO] `TRIGGER_NOT_FOUND` — 코드베이스 기존 사용처와 정합, spec 상위 enum 미등재 상태
- **target 신규 식별자**: `TRIGGER_NOT_FOUND` (§5.4 rotate-bot-token API 오류 표)
- **기존 사용처**:
  - `codebase/backend/src/modules/hooks/hooks.service.ts:93` — 이미 실제로 반환
  - `codebase/backend/test/webhook-trigger.e2e-spec.ts:91` — e2e 테스트에서 기대값으로 사용
  - `spec/5-system/3-error-handling.md §1.3` — `RESOURCE_NOT_FOUND` 가 404 범용 코드로 등재되어 있으나 `TRIGGER_NOT_FOUND` 자체는 enum 에 없음
- **상세**: target spec 이 `TRIGGER_NOT_FOUND` 를 rotate-bot-token API 응답 표에 명시하였고 코드베이스에도 동일 코드가 이미 쓰이므로 의미 충돌은 없다. 다만 `spec/5-system/3-error-handling.md` 의 top-level 에러 코드 enum 에는 `RESOURCE_NOT_FOUND` (범용 404) 만 있고 `TRIGGER_NOT_FOUND` 는 등재되어 있지 않다. 시스템 내 다른 리소스별 NOT_FOUND 코드(`EXECUTION_NOT_FOUND`, `INTEGRATION_NOT_FOUND`, `BACKGROUND_RUN_NOT_FOUND` 등)도 error-handling spec enum 에 없는 것과 일관된 패턴이므로 누락이 아니라 의도적 분산 정의일 가능성이 높다.
- **제안**: 현 상태 유지 가능. 다만 error-handling spec 에 리소스별 NOT_FOUND 코드들의 canonical 목록이 없으면 향후 drift 위험이 있으므로, 중기적으로 3-error-handling.md 에 "리소스별 404 코드 목록" 절을 보완하는 것을 별도 plan 으로 검토.

---

### [INFO] `CCH-AD-07` / `CCH-MP-06` — 선행 plan 에서 이미 정의됐고 target 과 정합
- **target 신규 식별자**: `CCH-AD-07`, `CCH-MP-06` (§3.1 어댑터 라이프사이클, §3.3 노드→채널 UI 매핑)
- **기존 사용처**:
  - `plan/complete/spec-draft-chat-channel-template-render-outbound.md:150,156` — 동일 ID 와 동일 의미로 정의됨
  - `spec/conventions/chat-channel-adapter.md:283` — CCH-AD-07 / CCH-MP-06 cross-ref 포함
  - `spec/4-nodes/7-trigger/providers/telegram.md:141,153` — CCH-MP-06 cross-ref 포함
- **상세**: target spec 의 `CCH-AD-07` / `CCH-MP-06` 는 선행 완료 plan 에서 기획된 ID 를 그대로 채택한 것이며, convention 과 provider spec 에도 동일 의미로 이미 cross-link 되어 있다. 의미 충돌 없음. `CCH-AD-06` 은 기존 정의로 유지되어 있고 `CCH-AD-07` 은 그 다음 시퀀스로 순서 일관성도 정합하다.
- **제안**: 변경 불필요.

---

### [INFO] `CCH-ERR-01 ~ CCH-ERR-05` — 신규 prefix, 기존 CCH-* 체계와 충돌 없음
- **target 신규 식별자**: `CCH-ERR-01`, `CCH-ERR-02`, `CCH-ERR-03`, `CCH-ERR-04`, `CCH-ERR-05` (§3.5 실행 실패 사용자 안내)
- **기존 사용처**:
  - `plan/in-progress/chat-channel-error-notify.md:52` — 동일 ID 범위를 미리 기획 명시 ("CCH-ERR-01 ~ 05")
  - `plan/in-progress/spec-draft-chat-channel-error-notify.md:33-37` — 동일 내용으로 draft 작성
  - `spec/4-nodes/7-trigger/providers/telegram.md, slack.md, discord.md` — `§5.6 Execution Failed (CCH-ERR-*)` 섹션 헤딩으로 cross-ref 이미 추가됨
  - `spec/conventions/chat-channel-adapter.md:305,329` — CCH-ERR-02 / CCH-ERR-04 cross-ref 포함
- **상세**: `CCH-ERR-*` prefix 는 기존 `CCH-AD-*`, `CCH-CV-*`, `CCH-MP-*`, `CCH-SE-*`, `CCH-NF-*` 와 서브그룹이 달라 충돌 없음. 기획 plan 과 convention, provider spec 모두 동일 의미로 선행 참조하고 있어 정합하다.
- **제안**: 변경 불필요.

---

### [INFO] `executionFailedThirdParty4xx` / `executionFailedThirdParty5xx` / `executionFailedThirdParty` / `executionFailedTimeout` / `executionFailedRateLimit` / `executionFailedInternal` — languageHints 신규 6키, 기존 5키와 네임스페이스 공유
- **target 신규 식별자**: `executionFailed*` 계열 6종 (§4.1 `languageHints` 객체 키)
- **기존 사용처**:
  - `spec/5-system/15-chat-channel.md` 기존 `languageHints` 키: `groupChatRefusal`, `executionStarted`, `executionCompleted`, `executionStillRunning`, `help` (5종)
  - `spec/2-navigation/2-trigger-list.md:107` — 기존 5키 목록 열거
  - `spec/conventions/chat-channel-adapter.md:293-298` — 6종 신규 키를 TypeScript union literal type 으로 정의
- **상세**: 신규 6키 모두 `executionFailed` prefix 로 시작해 기존 `executionStarted` / `executionCompleted` 패턴과 일관되며 상호 충돌 없다. `executionFailedThirdParty` 와 `executionFailedThirdParty4xx`/`executionFailedThirdParty5xx` 가 같은 prefix 를 공유하지만 접미사가 달라 lookup 시 정확히 구분된다. convention 파일에 TypeScript union literal 로 이미 등재되어 있어 명시적 검증 가능.
- **제안**: 변경 불필요.

---

### [INFO] `UNKNOWN_PLACEHOLDER` — `details[].code` 자리 신규 코드, 상위 error.code enum 미등재 (의도적)
- **target 신규 식별자**: `UNKNOWN_PLACEHOLDER` (§Rationale R-CC-15 (c))
- **기존 사용처**: 없음 (spec 및 코드베이스 전체에서 처음 등장)
- **상세**: target 이 명시적으로 "top-level `error.code` enum 자체에는 등재하지 않음" 을 Rationale 에서 선언하고 있다. `VALIDATION_ERROR` 의 `details[].code` 하위 세부 코드로 한정 사용. `spec/5-system/3-error-handling.md §2` 의 에러 응답 형식에서 `details` 는 자유 형식 객체로 정의되어 있어 본 코드가 다른 `details.code` 값과 충돌하지 않는다.
- **제안**: 변경 불필요. 다만 `UNKNOWN_PLACEHOLDER` 가 `VALIDATION_ERROR.details[].code` 자리에서 어떤 필드를 참조하는지 (`details[].field='languageHints.executionFailed*'`, `details[].code='UNKNOWN_PLACEHOLDER'`) 구현 시 `spec/5-system/2-api-convention.md` 의 `VALIDATION_ERROR` 응답 shape 와 정합되는지 개발자가 확인 필요.

---

### [INFO] `ChatChannelInternalEvent` — convention 에 이미 신설, 의미 일관성 정합
- **target 신규 식별자**: `ChatChannelInternalEvent` (§3.1 CCH-AD-07 참조)
- **기존 사용처**:
  - `spec/conventions/chat-channel-adapter.md §1.3` — 2026-05-25 신설로 동일 정의 이미 존재
  - `spec/5-system/14-external-interaction-api.md §R10` — "chat-channel-internal 추가 listener" 허용 범위 cross-ref 포함
- **상세**: target spec 이 convention 파일을 SoT 로 cross-link 하고 있고 convention 파일에 동일 의미로 이미 정의되어 있다. 충돌 없음.
- **제안**: 변경 불필요.

---

### [INFO] `R-CC-13` / `R-CC-14` / `R-CC-15` / `R-CC-16` — Rationale ID 시퀀스 정합
- **target 신규 식별자**: `R-CC-13`, `R-CC-14`, `R-CC-15`, `R-CC-16` (Rationale 절)
- **기존 사용처**:
  - `R-CC-13` — `spec/4-nodes/7-trigger/providers/discord.md:150` 에서 cross-ref 이미 존재
  - `R-CC-16` — `spec/5-system/14-external-interaction-api.md:913` 에서 cross-ref 이미 존재
- **상세**: target 의 `Rationale ID 컨벤션` 절이 `R-CC-N` prefix 를 사용하는 이유와 기존 `R1~R9`, `R-K` 의 하위 호환 유지를 명시하고 있다. R-CC-13~R-CC-16 각각에 대한 외부 spec 의 cross-ref 가 이미 정합되어 있다. EIA spec 의 `§R10` 과 chat-channel 의 `R-CC-*` 가 다른 prefix 로 구분되어 있어 검토자 혼동 위험도 없다.
- **제안**: 변경 불필요.

---

### [INFO] `chat-channel:{triggerId}:{conversationKey}` Redis 키 패턴 — 기존 키 목록과 충돌 없음
- **target 신규 식별자**: Redis 키 패턴 `chat-channel:{triggerId}:{conversationKey}` (§4.3)
- **기존 사용처**: `spec/0-overview.md §2.6` 에 `execution-continuation`, `background-execution`, `exec:recover:lock` 언급. `spec/2-navigation/4-integration.md` 에 `cafe24-token-refresh` BullMQ 큐 및 관련 Redis key 패턴 언급.
- **상세**: `chat-channel:` prefix 는 다른 모듈의 Redis key prefix 와 겹치지 않는다. target 도 "다른 모듈의 prefix 와 충돌 없음" 을 명시하고 있다. BullMQ 큐 이름(`execution-continuation`, `background-execution`, `cafe24-token-refresh` 등)과도 구분된다.
- **제안**: 변경 불필요.

---

### [WARNING] `TRIGGER_NOT_FOUND` — `RESOURCE_NOT_FOUND` 범용 규약과의 의미론적 분기
- **target 신규 식별자**: `TRIGGER_NOT_FOUND` (§5.4 rotate-bot-token 오류 표)
- **기존 사용처**: `spec/5-system/3-error-handling.md:40` — `RESOURCE_NOT_FOUND` 를 404 범용 코드로 정의. `spec/2-navigation/2-trigger-list.md:185` — 트리거 동시 삭제 케이스에 `RESOURCE_NOT_FOUND` 반환
- **상세**: 같은 트리거 리소스 조회 실패 상황에서 동시 삭제 시에는 `RESOURCE_NOT_FOUND` 를, rotate-bot-token API 의 트리거 미존재 시에는 `TRIGGER_NOT_FOUND` 를 사용한다. 동일한 리소스(`Trigger`) 의 404 상황에서 두 가지 코드가 혼재한다. 코드베이스(`hooks.service.ts:93`)에는 `TRIGGER_NOT_FOUND` 가 이미 구현되어 있어 실제로 분기가 존재하나, API 클라이언트 입장에서는 트리거 404 핸들링 시 두 코드를 모두 처리해야 하는 부담이 생길 수 있다.
- **제안**: 단기 차단 사안은 아니나, `2-trigger-list.md §3` API 문서에 트리거 관련 404 가 `TRIGGER_NOT_FOUND` 와 `RESOURCE_NOT_FOUND` 두 코드로 surface 될 수 있음을 cross-link 형태로 명시해 클라이언트 구현자의 혼선을 방지할 것을 권장.

---

## 요약

target 문서 `spec/5-system/15-chat-channel.md` 가 도입하는 신규 식별자(요구사항 ID `CCH-AD-07`, `CCH-MP-06`, `CCH-ERR-01~05`; languageHints 6키; error code `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `BOT_TOKEN_INVALID`, `CHAT_CHANNEL_SETUP_FAILED`; Redis 키 패턴 `chat-channel:*`; TypeScript 타입 `ChatChannelInternalEvent`; Rationale ID `R-CC-13~R-CC-16`)는 모두 기존 식별자와 의미 충돌이 없다. 선행 완료 plan 과 convention 파일에서 미리 정의·cross-ref 된 식별자들이어서 정합성도 높다. 유일하게 주의가 필요한 점은 Trigger 리소스 404 상황에서 `TRIGGER_NOT_FOUND`(rotate-bot-token API) 와 `RESOURCE_NOT_FOUND`(트리거 동시 삭제) 가 혼재하는 패턴으로, 이는 코드베이스 기존 구현을 반영한 것이지만 API 클라이언트 문서에 양쪽 코드가 명시되어 있지 않아 혼동 여지가 있다. CRITICAL 또는 HIGH 수준의 충돌은 발견되지 않았다.

## 위험도

LOW
