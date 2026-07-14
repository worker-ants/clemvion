# API 계약(API Contract) 리뷰

> 대상: `spec/5-system/15-chat-channel.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/6-websocket-protocol.md` (모두 spec 문서 diff — 실제 구현 코드 diff 는 payload 에 포함되지 않음). 아래는 spec 에 기술된 계약 텍스트를 기준으로 한 리뷰이며, 실제 DTO/컨트롤러/게이트웨이 구현 diff 확인은 별도 필요.

## 발견사항

- **[WARNING]** F-5 신규 400 검증의 PATCH 스코프(재검증 범위)가 spec 상 불명확 — 무관 필드 PATCH 가 레거시 데이터 때문에 막힐 위험
  - 위치: `spec/5-system/15-chat-channel.md` §4.1.1 "control-plane raw-send 키의 등록 시점 검증 (F-5)" 문단 (diff L36/L310)
  - 상세: `provider === 'telegram'` 이고 7개 control-plane 키(`help`/`groupChatRefusal`/`unsupportedMessageKind`/`executionStillRunning`/`surfaceMismatch`/`formValidationFailed`/`formNextField`)의 override 에 unescaped MarkdownV2 특수문자가 있으면 "등록 시점"에 `400 VALIDATION_ERROR`(`UNSAFE_TELEGRAM_MARKDOWN:<field>:<char>`)로 거부한다고만 기술되어 있다. "등록 시점"이 (a) 최초 생성(POST)에만 적용되는지, (b) `PATCH /api/triggers/:id` 로 `languageHints` 와 무관한 필드(예: `rateLimitPerMinute`, `isActive`)만 바꿀 때도 nested DTO 전체가 재검증되어 함께 걸리는지가 spec 에 없다. class-validator 기반 nested DTO 는 보통 object 전체가 재검증되는 경우가 흔해, F-5 도입 이전에 이미 저장된(위반) `languageHints` override 를 가진 기존 telegram 트리거는 이후 무관한 PATCH 조차 400 으로 막힐 수 있다. 이는 기존 클라이언트/운영 스크립트 입장에서 "이전에 성공하던 요청이 이후 실패"하는 하위호환성 회귀다.
  - 제안: PATCH 검증 스코프(변경된 필드만 검증 vs 전체 재검증)를 spec 에 명시하고, 전체 재검증이라면 F-5 도입 시점의 기존 위반 데이터에 대한 backfill/마이그레이션 또는 유예 정책을 함께 기술.

- **[WARNING]** F-5 에러 메시지 포맷이 같은 문서 내 다른 `VALIDATION_ERROR` 관례(`details.field`)와 불일치
  - 위치: `spec/5-system/15-chat-channel.md` §4.1.1 F-5 문단 vs §5.4.1/§5.4.1.1 (`details.field='botTokenRef'` 등)
  - 상세: 같은 트리거 DTO 검증군에서 다른 케이스들(`botTokenRef` PATCH 차단, `inboundSigningPlaintext` 차단 등)은 구조화된 `details.field` 를 사용하는데, F-5 는 구조화 정보(field, 위반 문자)를 `message` 문자열에 `UNSAFE_TELEGRAM_MARKDOWN:<field>:<char>` 형태로 콜론 인코딩한다. 표준 에러 envelope(`{ error: { code, message, details? } }`, API Convention §5.3)의 취지상 기계가 파싱할 정보는 `details` 에 두는 것이 일관적이며, 동일 API 그룹 안에서 두 가지 다른 표현 방식이 공존하면 클라이언트가 케이스별로 다른 파싱 로직을 둬야 한다.
  - 제안: `details: { field, char }` 로 구조화하고 `message` 는 사람이 읽는 설명 문자열로 통일.

- **[WARNING]** F-6: `execution.submit_message` / `execution.end_conversation` 의 기존 필드(`nodeId`)에 서버 검증이 신설되어, 필드 추가 없이 서버 배포만으로 기존 클라이언트의 동작이 바뀜 (하위호환성 영향)
  - 위치: `spec/5-system/4-execution-engine.md` §7.5.1 표 diff, `spec/5-system/6-websocket-protocol.md` §4.2 명령 표/ack 설명 diff
  - 상세: `submit_message`/`end_conversation` 는 기존에도 frontend 가 `nodeId` 를 payload 에 실었지만 서버는 이를 사용하지 않았다("미적용"). F-6 이후 서버가 이 필드를 lookup 된 대기 노드와 **대조**해 불일치 시 `INVALID_EXECUTION_STATE` 로 거부한다. 클라이언트 payload shape 자체는 바뀌지 않으므로 프론트 코드 변경 여부와 무관하게 서버 배포 시점부터 즉시 동작이 바뀐다. 정상적인 race(사용자가 명령을 보낸 직후 노드가 이미 다음 단계로 진행됐거나, 클라이언트가 잠깐 stale 한 대기노드 상태를 들고 제출하는 경우 등)에서 과거엔 server-lookup 만으로 성공 처리되던 요청이 이제 새로 거부될 수 있다. (반대로 `execution.click_button` 의 `nodeId?` 는 이번에 **신규 추가된 optional 필드**이고 frontend 가 아직 보내지 않아 실질 no-op — 이쪽은 순수 additive/하위호환.)
  - 제안: 배포 전 실제 프론트/채널 어댑터가 항상 "현재" 대기 노드의 nodeId 를 정확히 들고 있는지(낙관적 UI, 캐시된 상태 등 stale 가능 경로 포함) 검증. 필요 시 관측(로그) 우선 단계적 롤아웃(soft-reject → hard-reject) 고려, 또는 최소한 spec 의 "호환성"(§8) 섹션에 "기존에 무시되던 필드가 이제 강제 검증된다"는 영향 범위를 명시적으로 기록.

- **[INFO]** WS `INVALID_EXECUTION_STATE` vs REST 422 `INVALID_STATE` 이원화는 의도된 설계로 문서화되어 있음 — cross-transport 통합 SDK 관점만 유의
  - 위치: `spec/5-system/4-execution-engine.md` L623 (변경 없는 컨텍스트 라인, F-6 신규 트리거 경로가 이 기존 코드를 재사용)
  - 상세: 동일 의미(대기 노드 불일치)의 에러가 WS 에서는 ack 내 `INVALID_EXECUTION_STATE`, REST 에서는 HTTP 422 `INVALID_STATE` 로 분기되며, 문서가 "의도적 분리"라는 근거를 명시적으로 남겼다. F-6 은 새 에러 코드를 만들지 않고 기존 `INVALID_EXECUTION_STATE` 를 재사용한다는 점은 긍정적(코드 남발 방지). 다만 REST/WS 를 모두 다루는 통합 클라이언트 SDK가 있다면 두 코드를 정규화하는 매핑 계층이 필요함을 상기.
  - 제안: 별도 조치 불필요, 참고만.

- **[INFO]** F-5 가 검증하는 7개 control-plane 키 중 3개(`unsupportedMessageKind`/`formValidationFailed`/`formNextField`)가 §4.1 예시 `languageHints` config JSON 에 나타나지 않아 문서 완결성이 떨어짐
  - 위치: `spec/5-system/15-chat-channel.md` §4.1 예시 config(L247-283 부근) vs §4.1.1 F-5 문단의 7개 키 목록
  - 상세: 이 3개 키는 문서 내 다른 곳(§4.1 표 밖)에서 이미 정의된 기존 키로 추정되나, 이번 diff 범위 안에서는 예시 스키마에 없어 독자가 "검증 대상 전체 키 카탈로그"를 한 곳에서 파악하기 어렵다. API 계약(요청 검증) 문서화 완결성 관점의 사소한 gap.
  - 제안: §4.1 예시 config 또는 §4.1.1 에 3개 키에 대한 cross-link 보강.

## 요약

이번 변경은 코드 diff 가 아니라 이미(또는 곧) 구현된 동작을 기술하는 spec 문서 갱신이며, chat-channel 의 telegram MarkdownV2 안전성 강화(F-5)와 WS continuation 명령의 nodeId 사후 검증 강화(F-6) 두 계약 변경을 다룬다. F-5 는 신규 write-path 검증을 추가해 기존 persisted 데이터의 런타임 동작 자체는 깨지 않지만, PATCH 시 nested DTO 전체 재검증 여부가 spec 에 명시되지 않아 무관 필드 수정이 레거시 위반 데이터 때문에 차단될 잠재 리스크가 있고, 에러 메시지가 프로젝트 표준 `details.field` 관례 대신 문자열 인코딩(`UNSAFE_TELEGRAM_MARKDOWN:<field>:<char>`)을 택해 내부 일관성이 떨어진다. F-6 은 `click_button` 의 `nodeId?` 추가는 순수 additive 라 문제없으나, `submit_message`/`end_conversation` 은 필드 추가 없이 기존에 무시되던 값을 서버가 갑자기 강제 검증하는 구조라 배포 시점부터 기존 클라이언트의 정상 요청이 새로 거부될 가능성이 있다(다만 기존 에러 코드 `INVALID_EXECUTION_STATE` 를 재사용해 신규 코드 난립은 피했음). 전반적으로 설계 의도는 타당하고 근거(Rationale)도 잘 남아 있으나, 하위호환성 영향 범위와 에러 응답 포맷 일관성 두 가지는 구현/문서 보강이 필요하다.

## 위험도

MEDIUM
