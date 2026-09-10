# API 계약(API Contract) 리뷰 — `impl-chat-channel-patch-token` (7라운드, `84a6aeaa8` 기준)

## 검토 방법

`git diff origin/main...HEAD --stat -- 'codebase/**'` (16개 파일)과 핵심 파일(`chat-channel-config.dto.ts`·
`update-trigger.dto.ts`·`triggers.controller.ts`·`triggers.service.ts`·`trigger-dto-validation.spec.ts`·
`triggers.service.spec.ts`)의 전체 diff 를 직접 열어 재검증했다. 직전 `api_contract` 라운드
(`review/code/2026/09/11/01_27_26`, 커밋 `c817a44c4` 기준)와 현재 HEAD(`84a6aeaa8`) 사이의 델타를
`git diff c817a44c4..HEAD` 로 대조한 결과, 프로덕션 코드 변경은 주석 텍스트 정정(`SecretResolver.store`
→ `SecretResolver.rotate` 서술, 2곳) 뿐이고 API 표면(요청/응답 스키마·검증 로직·에러 코드·라우트)에는
변경이 없다. 신규로 추가된 것은 내부 3필드(`botTokenRef`/`inboundSigningRef`/`inboundSigning`)에
`null`/`''` 테스트 6건뿐이며 검증 로직 자체는 그대로다. 저장소 트리는 뮤테이션하지 않았고(읽기만
수행), `git status --short` 로 이 세션이 만든 산출물 외 잔여물이 없음을 확인했다.

추가로 프런트엔드 유일 소비자(`codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx`)를
직접 읽어 하위 호환성 주장을 재검증했다 — `edit` 모드는 `hasChatChannel`(기존 `chatChannel.provider`
존재)일 때만 진입하고, PATCH body 의 `provider` 는 항상 `chatChannel?.provider`(현재 값)를 그대로
되돌려 보낸다. 즉 이 카드는 구조적으로 "최초 부착"도 "provider 전환"도 만들 수 없어, 이번 PR 이 새로
막는 두 400 사유 모두에 걸리지 않는다.

## 발견사항

- **[INFO]** 신규 400 사유 중 "chatChannel 최초 부착 금지"·"provider 전환 금지" 두 가지는 이 저장소의
  `422 INVALID_STATE`(비즈니스 로직 오류·상태 전이 불가) 정의와 결이 겹친다 — 다만 같은 컨트롤러의
  기존 선례(스키마 타입에 따른 `disallowed` 필드 400)와는 형태가 일치해 선택 자체가 근거 없는 것은
  아니다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `assertChatChannelAlreadySetUp`
    (약 690번째 줄대, `private assertChatChannelAlreadySetUp(trigger: Trigger, incoming: ChatChannelInput)`)
  - 상세: `spec/5-system/2-api-convention.md` §6 은 400 을 "잘못된 요청(유효성 검증 실패)", 422 를
    "비즈니스 로직 오류"로 구분하고, 실제로 `INVALID_STATE`(422)는 "이미 실행 중인 워크플로우 삭제"처럼
    **입력 자체는 유효하지만 리소스의 현재 상태 때문에 거부**되는 사례에 쓰인다. 이번 PR 이 추가한 두
    사유("트리거에 아직 `chatChannel` 이 없는데 PATCH 로 처음 붙이려 함", "이미 설정된 provider 를 다른
    값으로 바꾸려 함") 는 문자 그대로 그 정의에 부합한다 — 요청 바디의 `provider`/`chatChannel` 필드
    자체는 형식상 완전히 유효하고, 오직 **트리거의 현재 상태**(chatChannel 유무, 기존 provider 값)와
    충돌해서 거부되기 때문이다. 다만 같은 `update()` 엔드포인트가 이미 "schedule 타입에 허용되지 않는
    필드"를 400 `VALIDATION_ERROR`(`details.field="type", details.disallowed=[...]`)로 다루는 선례를
    갖고 있어(`triggers.controller.ts` 기존 `@ApiBadRequestResponse` 서술, 이 PR 이전부터 존재), 이번
    선택이 그 지역 관례를 따른 것이라는 점도 분명하다. 즉 "완전히 근거 없는 선택"은 아니지만, 프로젝트
    전역 상태 코드 분류 기준으로 보면 422 가 더 정합적일 수 있는 여지가 있다.
  - 제안: 즉시 차단 사유는 아니다. 이미 6라운드에 걸쳐 `error-handling`/`api-convention` spec 정합을
    검증해 온 리뷰 이력에서 이 축이 한 번도 지적되지 않았고, 동일 엔드포인트 내 직접 선례가 있어 완전한
    일탈로 보기 어렵다. spec 정정이 필요하다고 판단되면 developer 권한 밖(§API 계약)이므로
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 류 트래커에 검토 항목으로만 남기고,
    이 PR 의 병합을 막을 사유로 쓰지 않기를 권한다.

- **[INFO]** (기존 추적, 변경 없음, 재확인) `ChatChannelUpdateConfigDto` 의 금지 필드 두 개
  (`botToken`·`inboundSigningPlaintext`)가 여전히 OpenAPI 상 `writeOnly: true` 로 선언돼 있어, 스펙만
  보는 코드젠 도구는 "쓸 수 있는 필드"로 오인할 수 있다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    `ChatChannelUpdateConfigDto.botToken`/`.inboundSigningPlaintext` 의
    `@ApiPropertyOptional({ ..., writeOnly: true })`
  - 상세: 1~6라운드 `api_contract` 가 이미 지적하고 "SDK 코드젠 계획이 생기기 전까지 조치 불요"로
    확정한 항목이다. 이번 라운드까지 이 필드의 스키마·데코레이터는 diff 에 등장하지 않아(`git diff
    c817a44c4..HEAD` 로 확인) 상태 변화 없음 — 재-flag 아니라 유지 확인.
  - 제안(유지): 별도 조치 불요.

## 확인된 것 — 8개 관점 재확인 (신규 결함 없음)

- **하위 호환성**: `PATCH /api/triggers/:id` 가 `chatChannel.botToken`/`.inboundSigningPlaintext`
  실림·최초 부착·provider 전환 3가지를 새로 400 으로 거부하는 **의도된 breaking change**다.
  `CHANGELOG.md` 에 wire 계약 변경으로 명시돼 있고, 유일한 알려진 소비자
  (`chat-channel-card.tsx`)를 직접 읽어 세 사유 어디에도 걸리지 않음을 재확인했다(위 검토 방법 참조).
- **버전 관리**: 이 저장소에 API 버전 접두사 체계가 없고(`/api/triggers/:id`, 기존과 동일), 이번 PR 도
  새로 도입하지 않는다 — 기존 관례 유지.
- **응답 형식**: `@ApiOkWrappedResponse(TriggerDto, ...)` 데코레이터·응답 envelope 은 diff 대상이
  아니다. `hasBotToken: boolean`/`inboundSigningRef` 등 파생 필드만 노출되고 평문 비밀은 여전히
  strip 된다(`stripChatChannelPlaintext`) — 응답 스키마 변경 없음.
  - 응답에 실리는 `chatChannelHealth`/`chatChannelLastError` 등 secret 비-노출 필드도 이번 diff 로
    변경되지 않았다.
- **에러 응답**: 신규 400 사유 모두 기존 봉투(`{ code: 'VALIDATION_ERROR', message, details }`)를
  그대로 쓴다. `details.field` 가 값의 형태(비어있지 않음 vs `null`/`''`)에 따라 배열/단일 object 로
  갈리는 비대칭은 **이 저장소 전역 관례**(`spec/5-system/2-api-convention.md` §5.3 "details 형태
  구분")를 그대로 따르는 것이며, 이번 diff 가 그 비대칭을 새로 만든 것이 아니다. 두 갈래 모두
  `trigger-dto-validation.spec.ts`(전역 파이프 경로)와 `triggers.service.spec.ts`(서비스 가드
  경로, 이번 라운드 델타에서 내부 3필드까지 null/`''` 로 확장)로 각각 실측·회귀 고정돼 있다.
- **요청 검증**: `OmitType` + `@IsEmpty()` 이중 방어(DTO 층) + `assertPatchCarriesNoSecrets`/
  `assertChatChannelAlreadySetUp`(서비스 층)의 이중 방어 구조이고, `mode: 'create' | 'update'`
  오버로드 시그니처로 DTO 타입과 검증 분기를 컴파일 타임에 결속해 "PATCH 인데 생성용 분기를 탄다"
  류의 재발을 타입 체커가 잡도록 했다. 생성 경로(`CreateTriggerDto`)가 회귀 없이 `botToken` 필수를
  유지함을 별도 테스트로 고정했다.
- **URL/경로 설계**: 신규 엔드포인트 없음, 기존 `PATCH /api/triggers/:id` 그대로. RESTful 관례·
  `rotate-bot-token` 서브리소스 액션 네이밍도 변경되지 않았다.
- **페이지네이션**: 해당 없음 — 단일 리소스 PATCH.
- **인증/인가**: `@Roles('editor')`·`@ApiUnauthorizedResponse`/`@ApiForbiddenResponse` 데코레이터는
  이번 diff 의 변경 대상이 아니다(`triggers.controller.ts` diff 는 `@ApiBadRequestResponse` 설명
  문자열 확장 한 곳뿐).
- `spec/**` 파일은 이번 diff(전체 `origin/main...HEAD`)에 0건 — API 계약 관련 spec 정정은
  developer 권한 밖으로 올바르게 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
  인계돼 있다(경계 유지 재확인).

## 요약

이번 7라운드에서 API 계약에 영향을 주는 `codebase/**` 코드는 직전 `api_contract` 라운드
(`01_27_26`, `c817a44c4` 기준) 이후 실질 변경이 없다 — 주석 문구 정정 2곳과 내부 필드 null/빈 문자열
회귀 테스트 6건뿐이다. 독립적으로 8개 관점을 처음부터 재확인한 결과도 동일한 결론이다: PATCH 가
비밀 필드·최초 부착·provider 전환을 거부하는 것은 의도된 breaking change 이고 CHANGELOG 에 명시돼
있으며, 유일한 실제 소비자(`ChatChannelCard`)는 세 사유 모두에 구조적으로 걸리지 않음을 소스
직접 대조로 재확인했다. 에러 봉투·요청 검증·URL·인증/인가 어느 축에서도 신규 CRITICAL/WARNING 급
결함은 없다. 유일한 잔여 항목은 (1) 두 신규 400 사유가 프로젝트 자체의 400/422 분류 기준상 422 에
더 가까울 수 있다는 관찰(같은 엔드포인트의 기존 선례로 근거는 있음, 비차단)과 (2) 여러 라운드에
걸쳐 조치 불요로 확정된 `writeOnly` 마커 잔존 뿐이며, 둘 다 병합을 막을 사유가 아니다.

## 위험도

NONE
