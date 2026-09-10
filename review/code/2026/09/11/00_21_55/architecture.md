# 아키텍처(Architecture) 코드 리뷰 — chatChannel PATCH 비밀 차단 (D-1·D-2·D-3, 최종 수렴 라운드)

## 검토 방법

핵심 코드 6개(`chat-channel-config.dto.ts` · `trigger-dto-validation.spec.ts` · `update-trigger.dto.ts` ·
`triggers.service.spec.ts` · `triggers.service.ts` · `trigger-workflow-ref.e2e-spec.ts`)와
`triggers.controller.ts`·frontend 문서 4파일을 대상으로 삼았다. 프롬프트 diff 가 생략한 파일은
저장소에서 `Read`로 직접 열어 전체 컨텍스트(특히 `triggers.service.ts` 의 타입 선언·`create`/`update`·
`assertChatChannelInputSafe`·`assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp`·
`mergeExternalConfig`·`setupChatChannel`)를 확인했다. 이 changeset 은 같은 PR 의 1~2라운드
리뷰 산출물(`review/code/2026/09/10/{23_21_57,23_55_23}/**`)을 포함하므로, 그 두 라운드가 이미
낸 아키텍처 지적(특히 `review/code/2026/09/10/23_55_23/architecture.md`)과 대조해 **이번 최종
diff 에서 해소됐는지 vs 여전히 열려 있는지**를 우선 판별했다. 저장소 파일은 뮤테이션하지 않았다
(정적 대조만으로 충분).

## 발견사항

- **[INFO]** (carry-forward, 여전히 열려 있음) `ChatChannelInput`/`ChatChannelInputMode` 유니온 타입이 DTO 모듈이 아니라 서비스 파일에 선언돼 있다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:60`(`type ChatChannelInput = ChatChannelConfigDto | ChatChannelUpdateConfigDto;`), `:73`(`type ChatChannelInputMode = 'create' | 'update';`)
  - 상세: 두 타입은 `ChatChannelConfigDto`·`ChatChannelUpdateConfigDto` 두 DTO 클래스만을 조합한 순수 타입-레벨 개념이라 논리적 소속은 `dto/chat-channel-config.dto.ts` 인데, 서비스 파일에 정의돼 있어 "두 write-model 이 하나의 합집합을 이룬다"는 사실을 알려면 서비스 구현을 봐야 한다. 이전 라운드(`review/code/2026/09/10/23_55_23/architecture.md`)가 이미 INFO 로 지적했고 이번 diff 에서 이동되지 않았다 — 회귀는 아니고 원래부터 미해소 상태가 이어진 것.
  - 제안: 조치 불요(이미 낮은 우선순위로 트리아지됨). 다음에 이 유니온을 재사용하는 모듈이 생기면 `chat-channel-config.dto.ts` 로 이동을 재고.

- **[INFO]** (carry-forward, 여전히 열려 있음) `trigger.config.chatChannel` 을 가리키는 인라인 구조적 캐스팅이 파일 안에 최소 3곳 산재
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:526-528`(`update()` 의 `previousInboundSigningRef` — 이번 diff 신규), `:726-727`(`assertChatChannelAlreadySetUp` 의 `current`), `:1267-1269`(`teardownChatChannel` 의 `chatChannelCfg`, 이 diff 이전부터 존재)
  - 상세: 세 곳 모두 `trigger.config as { chatChannel?: {...} }` 형태의 그 자리 한정 구조적 단언으로 `chatChannel` 하위 필드를 꺼낸다. `chatChannel` JSONB 형태가 바뀌면 이 캐스팅 지점을 전부 찾아 손대야 하는데, 이번 PR 이 고친 CRITICAL(`inboundSigningRef` 유실 → fail-open) 도 정확히 "설정 필드가 조용히 사라지는" 같은 계열의 결함이었다. 이 diff 는 새 캐스팅 지점(526-528)을 하나 더 추가해 산재를 넓혔지만, 그 지점 자체가 CRITICAL 을 고치기 위한 정확한 수정이라 diff 단독으로는 정당하다.
  - 제안: 조치 불요(이전 라운드가 이미 INFO 로 남기고 트래커에 등재). `private readTriggerChatChannelConfig(trigger: Trigger)` 류 단일 접근자로 통합하면 향후 형태 변경 시 손댈 자리가 하나로 줄어든다는 제안이 여전히 유효.

- **[INFO]** `TriggersService` 가 계속 커지는 추세 — 이번 diff 가 `setupChatChannel`(186줄, 6~8개 관심사)에 `preservedInboundSigningRef` 축을 하나 더 얹었다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `setupChatChannel()` (1075~1260행) — 이번 diff 신규분은 옵션 파라미터 `preservedInboundSigningRef`(1080·1087행)와 `inboundSigningRefSurvives` 판정(1174-1175행)·fallback 경로 반영(1244-1249행)
  - 상세: 이 함수는 이미 secret store 3종 쓰기 게이팅·adapter 호출·config 병합·DB 갱신·리스너 등록·에러 처리(best-effort degraded)까지 한 private 메서드에 담고 있었고(1라운드 리뷰가 이미 WARNING #6 으로 지적), 이번 diff 는 그 위에 "PATCH 이전 ref 를 보존할지" 축을 추가했다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 후속 항목(`resolveChatChannelSecretWrites(...)` 분리)으로 이미 등재돼 있어 이번 라운드의 **신규 결함으로 보고하지 않는다** — 다만 `TriggersService` 전체(1855줄)가 이 PR 이후에도 계속 팽창하는 지점이 정확히 같은 자리(`setupChatChannel`)라는 사실은 기록해 둘 가치가 있다.
  - 제안: 이번 PR 범위 밖. 트래커의 처방(secret-write 게이팅과 ref 생존 판정을 별도 헬퍼로 분리)을 다음 손댈 때 적용.

- **[INFO]** DTO 계층이 "PATCH 는 이 두 필드를 금지한다"는 하나의 업무 규칙을 서로 다른 표현으로 4곳에 나눠 문서화·강제한다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:384-387`·`:398-401`(`@IsEmpty()` 메시지 + `@ApiPropertyOptional` description, 376-403행), `codebase/backend/src/modules/triggers/triggers.service.ts:695-713`(`assertPatchCarriesNoSecrets`), `codebase/backend/src/modules/triggers/triggers.controller.ts` `@ApiBadRequestResponse`(122-131행)
  - 상세: 같은 규칙("botToken/inboundSigningPlaintext 는 PATCH 로 못 바꾼다, rotate 엔드포인트를 써라")이 DTO 검증 메시지·DTO Swagger 설명·서비스 가드 메시지·컨트롤러 Swagger 설명 네 자리에 각각 하드코딩돼 있다. 서비스 단 이중 검증 자체는 JSDoc 이 근거(서비스가 컨트롤러 밖에서도 호출될 수 있음)를 명시해 방어적 설계로서 타당하지만, 규칙이 바뀔 때(예: 향후 rotate 를 통합) 네 자리를 동기화해야 하는 SoT 분산 상태다. `maintainability.md` 가 이미 메시지 문자열 중복(2곳)을 INFO 로 다뤘는데, 이 관찰은 그와 다른 축 — "몇 개 문자열이 같은가"가 아니라 "몇 개 레이어가 같은 업무 규칙을 독립적으로 표현하는가"이다.
  - 제안: 이번 PR 범위를 막을 사안 아님. 향후 손댈 때 규칙 문구(어느 필드가 금지고 대안 엔드포인트가 무엇인지)를 상수 모듈로 뽑아 4곳이 같은 값을 참조하게 하는 것을 고려.

## 확인된 것 — 문제 없음 / 긍정적 설계 (이전 라운드 WARNING 포함)

- **이전 WARNING 해소 확인**: `review/code/2026/09/10/23_55_23/architecture.md` 가 지적한 "`mode: 'create' | 'update'` 문자열 판별자가 실제 DTO 타입과 컴파일 타임에 상관되지 않는다"는 이번 diff 에서 함수 오버로드 2개(`triggers.service.ts:636-643`)로 정확히 처방대로 고쳐졌다 — `assertChatChannelInputSafe(chatChannel: ChatChannelConfigDto | undefined, mode: 'create')` / `(chatChannel: ChatChannelUpdateConfigDto | undefined, mode: 'update')` 두 시그니처가 호출부(`:430`·`:513`)와 정확히 대응하고, 내부 `as ChatChannelConfigDto` 캐스팅(`:685`)은 `mode==='create'` 오버로드 분기 안에서만 도달 가능해 안전하다. 이 함수가 지키는 것이 이 PR 이 닫은 보안 결함 클래스라는 점에서 이 처방은 정확한 우선순위였다.
- **LSP 함정 회피**: `ChatChannelUpdateConfigDto` 는 `botToken`(필수→금지)처럼 구조적으로 `ChatChannelConfigDto` 를 대체할 수 없는데, 상속 다형성으로 두 형태를 넘나들며 쓰지 않고 `ChatChannelInput = A | B` 명시적 합집합으로 다뤄 "가짜 is-a" 함정을 피했다. `OmitType` 을 쓴 이유(부모 `@IsString()` 필수와 자식 `@IsEmpty()` 금지의 데코레이터 충돌 회피)와 `Update` 접두 선택 이유(저장소에 `Patch` 접두 0건 실측)가 JSDoc(`chat-channel-config.dto.ts:357-366`)에 근거와 함께 남아 있다.
- **OCP**: write-model 을 오퍼레이션(POST/PATCH)별로 독립 DTO 로 분리해, 향후 세 번째 오퍼레이션이 생겨도 기존 두 DTO 를 건드리지 않고 확장 가능. `OmitType` 기반 파생이라 부모(`ChatChannelConfigDto`)에 새 optional 필드가 추가되면 자식이 자동으로 물려받는다.
- **레이어 책임 분리**: `triggers.controller.ts` 의 diff 는 Swagger 설명 문자열만 변경했고 라우팅/검증/비즈니스 로직에 손대지 않았다 — 컨트롤러가 얇게 유지된다. DTO 계층(구조·형식 검증)과 서비스 계층(업무 규칙·상태 전이·secret 오케스트레이션)의 역할 경계도 diff 전체에서 유지된다.
- **순환 의존성 없음**: `chat-channel-config.dto.ts → update-trigger.dto.ts → triggers.service.ts` 단방향 의존만 존재하고 역방향 참조는 없다. 새 export(`ChatChannelUpdateConfigDto`)도 같은 방향을 따른다.
- **secret 쓰기 게이팅 축**: `storeUserSuppliedSecrets` 게이팅이 provider 종류가 아니라 "누가 발급한 비밀인가"라는 올바른 축을 잡아, 세 번째 secret 쓰기(telegram server-issued)를 실수로 함께 막지 않도록 설계돼 있다(`setupChatChannel` JSDoc 표, `:1058-1070`). `preservedInboundSigningRef` 도 "병합 전 값을 호출자가 인자로 넘긴다"는 명시적 계약으로 구현돼, `mergeExternalConfig` 의 전체 교체 의미론과 부딪히지 않는다.

## 요약

핵심 아키텍처 리스크는 이번 최종 diff 에서 발견되지 않았다. 이전 라운드가 지적한 유일한 WARNING(`mode` 문자열 판별자와 DTO 타입의 컴파일 타임 미상관)은 함수 오버로드로 정확히 처방대로 해소됐다. 남은 관찰(유니온 타입의 모듈 소속, JSONB 인라인 캐스팅 산재, `setupChatChannel` 비대화, PATCH 금지 규칙의 4계층 분산 서술)은 전부 INFO 수준이고, 그중 앞의 셋은 이전 라운드가 이미 저위험으로 분류해 중앙 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재해 둔 항목의 연장이지 이번 라운드의 신규 결함이 아니다. DTO 계층을 오퍼레이션별로 분리한 설계(`OmitType` 기반)와 유니온 타입으로 LSP 함정을 피한 처리, provider-neutral 한 secret 쓰기 게이팅 축은 구조적으로 견고하며, 컨트롤러/DTO/서비스 3계층의 책임 경계도 diff 전체에서 유지됐다.

## 위험도

LOW
