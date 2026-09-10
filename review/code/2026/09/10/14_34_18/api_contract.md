# API 계약(API Contract) 리뷰 — `trigger-workflow-ref-canary`

대상: `codebase/backend/src/shared/testing/trigger-workflow-ref.{ts,spec.ts}` ·
`codebase/backend/test/trigger-workflow-ref.e2e-spec.ts` (신규 3파일, DTO/컨트롤러 변경 없음).
라우터가 지정한 4개 관점을 순서대로 판정한다. 코드 근거는 모두 저장소 원본 파일을 직접
`Read`/`grep` 하여 확인했다(프롬프트 조립 오프셋이 아니라 각 파일의 실제 줄 번호로 인용한다).

## 발견사항

### [INFO] ① §5.4 판정 — 캐너리의 읽기가 정확하다

- **위치**: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:76-82` (헬퍼의 `!opts.present` 분기),
  대조군 `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:95-102`
  (`TriggerDto.workflow` 선언), `spec/5-system/2-api-convention.md:221-236` (§5.4 원문)
- **상세**: `TriggerDto.workflow`는 `@ApiPropertyOptional({ type: () => TriggerWorkflowRefDto })` +
  `workflow?: TriggerWorkflowRefDto`로 선언돼 있다 — `nullable: true`도 `| null`도 없다. 이는
  §5.4가 규정하는 "**키를 생략**하는 필드 → `@ApiPropertyOptional()` + `field?: T` (`| null` 금지)"
  선언 형태와 정확히 일치한다. 즉 이 필드는 **키 생략형**으로 선언돼 있고, `null`을 응답에
  싣는 것은 선언되지 않은 표현이라 그 자체로 §5.4 위반이다.
  캐너리(`trigger-workflow-ref.ts:77-81`)는 `present:false`일 때 `Object.hasOwn(record,'workflow')
  === false`만 통과시키고, `.spec.ts:51-57`의 `null` 케이스는 `present:true`/`false` **양쪽 판정
  모두**에서 실패하도록 검증한다. `null`을 "부재"로도 "존재"로도 인정하지 않는 것이 맞다 —
  선언에 `nullable: true`가 없으므로 `null`은 애초에 이 필드의 유효한 표현이 아니기 때문이다.
- **결론**: 라우터가 제기한 읽기는 **정확하다**. `@ApiPropertyOptional()` + `field?: T` 조합에서
  `null`을 실어 보내는 것은 부재의 다른 형태가 아니라 계약 위반이며, 캐너리가 그것을 정확히
  구분해서 문다.

### [WARNING] ② "생성 응답에만 부재"를 캐너리로 고정한 근거가 얇다 — 구현 아티팩트를 정지시키는 효과가 있다

- **위치**: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:132-138` (케이스 1),
  근거 문서 `spec/2-navigation/2-trigger-list.md:174-179`,
  DTO JSDoc `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:95-99`
- **상세**: 이 필드가 키 생략형으로 채택된 근거는 §5.4 기준 **(b)** — "선택적 부가 컨텍스트라
  소비자가 부재를 정상 경로로 다룰 때"다. 실제로 spec 문서(`2-trigger-list.md:175`)도 정확히
  그렇게 근거를 댄다: "(b) 의 판정 근거는 소비자가 부재를 정상 경로로 다룬다는 것이다." 그런데
  이 근거는 "**부재를 클라이언트가 안전하게 처리한다**"는 것이지, "**생성 시점에는 반드시
  부재여야 한다**"는 것이 아니다. `workflow?.name ?? workflowName ?? ""` 로 이미 양쪽(존재/부재)을
  다 흡수하는 소비자가 있다는 것은, 미래에 `create()` 가 workflow ref를 채워 보내기 시작해도
  (POST 바디에 이미 `workflowId`가 있으므로 조회 1회만 추가하면 됨) 기존 클라이언트 관점에서는
  **순수 additive 변경**이라 하위 호환성 문제가 없다는 뜻이다.
  이 캐너리(케이스 1)는 그런 변경이 들어오면 무조건 CI를 RED로 만든다 — 이는 "`create()`가
  관계를 로드하지 않는다"는 **구현 세부사항**을 "생성 응답은 `workflow`를 절대 실어서는 안 된다"는
  **정지된 계약**으로 승격시키는 효과가 있다. spec 문서 어디에도 "왜 create 응답이 특별히
  workflow를 담아서는 *안 되는지*"에 대한 긍정적 설계 근거(성능·일관성 등)는 없고, 오직
  "지금 `create()`의 구현이 그렇게 되어 있다"는 사실 서술만 있다.
- **판단**: 그럼에도 이 프로젝트의 SDD/TDD 관례상 이는 **바람직한 선택**으로 판단한다 — 이유는
  캐너리가 얼려버리는 것이 "영원한 제약"이 아니라 "명시적 spec 개정 없이는 못 바꾼다"는
  **프로세스 게이트**이기 때문이다. `CLAUDE.md`의 "구현 중 spec 변경 필요 시 developer 는 멈추고
  project-planner 위임" 규칙이 정확히 이런 상황(의도적으로 문서화된 현재 동작을 바꾸고 싶어짐)을
  위해 있다. 다만 이 캐너리가 막는 것이 "실제 계약 위반"이 아니라 "문서화된 현재 상태의 이탈"
  이라는 점은 향후 이 테스트를 마주칠 개발자에게 혼동을 줄 수 있다.
- **제안**: 후속 spec 정정 turn(planner, 이미 트래커에 등재됨 — `plan/in-progress/
  trigger-workflow-ref-canary.md:213-225` "후속으로 넘기는 것" §1)에서 `2-trigger-list.md`의
  "생성 응답에만 없다" 문장 옆에 한 줄만 추가할 것을 권고한다 — "이는 `create()`가 관계를
  로드하지 않는 현재 구현을 반영한 것이며, 이 필드를 생성 응답에도 채우는 것은 §5.4 (b) 소비자
  호환성상 breaking change가 아니다. 캐너리가 막는 것은 계약 위반이 아니라 문서와의 불일치다."
  이렇게 하면 다음 개발자가 이 캐너리의 RED를 "계약을 어겼다"로 오독하지 않는다.

### [INFO] ③ `TriggerWorkflowRefDto` 정확한 키셋 단언 — 저장소 관례와 일치, 애디티브 진화 리스크는 낮다

- **위치**: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:53-54,88-89`
  (`WORKFLOW_REF_KEYS = ['id','name']` + `Object.keys(ref).sort()` 등가 비교),
  대조군 `codebase/backend/src/shared/testing/schedule-trigger-ref.ts:29-31,44-48`
  (자매 헬퍼도 같은 스타일의 정확한 키셋 등가 비교),
  DTO `codebase/backend/src/modules/triggers/dto/responses/trigger-response.dto.ts:14-31`,
  `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts:11-24`
- **상세**: `TriggerWorkflowRefDto = {id, name}` / `ScheduleTriggerWorkflowRefDto = {name}`는
  DTO 자체의 JSDoc이 "**의도적으로 다르다** … 한쪽을 다른 쪽으로 갈아 끼우지 말 것"이라고
  명시한 **의도적으로 좁힌 참조 투영**이다 — 소비처가 실제로 읽는 필드만 담는다는 설계
  철학(entity 전체를 노출하지 않는다는 §5.4 인접 규약, `swagger.md §5-1`의 정신)이 이미
  이 두 DTO의 존재 이유다. 정확한 키셋 단언("이보다 많아도 적어도 실패다",
  `trigger-workflow-ref.ts:53`)은 이 설계 철학을 캐너리 레벨로 그대로 옮긴 것이며, 이미
  존재하는 자매 헬퍼 `expectNarrowedScheduleTriggerRef`가 같은 스타일(정확한 키셋 `toEqual`)을
  트리거 참조 객체 전체에 대해 쓰고 있어 신규가 아니라 기존 관례를 따른 것이다.
- **애디티브 진화 리스크 평가**: 만약 미래에 `TriggerWorkflowRefDto`에 필드(예: `slug`)가
  추가된다면 이 단언은 실패하지만, 그것은 **의도된 마찰**이다 — 이 DTO류는 "필요한 필드만
  담는다"는 것 자체가 계약이므로, 필드 추가는 그 계약을 재검토해야 하는 사건이지 조용히
  지나가야 할 사건이 아니다(일반적인 REST 엔티티 DTO의 "여분 필드는 무해한 additive
  change"라는 통념이 여기서는 적용되지 않는다 — 애초에 여분을 안 남기는 것이 설계 의도).
  실질적 유지보수 비용도 낮다 — 필드 하나 추가 시 이 헬퍼의 상수 배열 한 줄만 갱신하면 된다.
- **결론**: 리스크 없음. 저장소의 명시적 설계 의도(narrowed ref, "갈아 끼우지 말 것")와 정확히
  정렬된 선택이다.

### [CRITICAL] ④ PATCH 가 chat-channel bot-token single-path 정책을 실질적으로 우회한다 — 저자가 등재만 하고 판정하지 않은 질문에 대한 답: **예, 실제 갭이다**

- **위치**:
  - 정책 선언: `spec/5-system/15-chat-channel.md:368-380`(§5.4.1), `:608-612`(R-CC-10)
  - 차단 로직: `codebase/backend/src/modules/triggers/triggers.service.ts:574-590`
    (`assertChatChannelInputSafe` — `botTokenRef`/`inboundSigningRef`/`inboundSigning` **세 필드만** 차단)
  - 우회 경로: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:174-187`
    (`botToken: string` — `@IsOptional()` 없음, PATCH·POST 공용 DTO) +
    `codebase/backend/src/modules/triggers/triggers.service.ts:534-545`(`update()`가
    `chatChannel`이 있으면 무조건 `setupChatChannel` 호출) +
    `:947-952`(`setupChatChannel`이 무조건 `secrets.rotate(botTokenRef, ws, chatChannelCfg.botToken ?? '')` 실행)
  - 대조군(정식 rotate 경로): `codebase/backend/src/modules/triggers/triggers.service.ts:1238-1359`
    (`rotateBotToken` — 기존 토큰을 `v2Ref`에 백업 후 교체, `chatChannelTokenV2`/`chatChannelRotatedAt`
    갱신, 전용 audit action `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` 기록)
  - 저자의 등재: `plan/in-progress/trigger-workflow-ref-canary.md:161-167`,
    `plan/in-progress/spec-draft-nullable-notation-followups.md:1796-1808`
- **상세**: §5.4.1/R-CC-10이 실제로 막는 것은 **`config.chatChannel.botTokenRef`**(내부 secret-store
  참조 문자열) 필드다 — `assertChatChannelInputSafe`가 `typeof blocked.botTokenRef !== 'undefined'`
  일 때만 400을 던진다. 그런데 실제 토큰 **값**을 나르는 필드는 `botToken`(plaintext)이고, 이
  필드는 `ChatChannelConfigDto`에서 **필수**(`@IsString() @MaxLength(256)`, optional 아님)다 —
  PATCH·POST 양쪽에 같은 DTO가 쓰이며 `UpdateTriggerDto.chatChannel`도 `PartialType`이 아닌
  일반 `@ValidateNested()`다. `update()`는 body에 `chatChannel`이 있으면 무조건
  `setupChatChannel(saved, chatChannel)`을 호출하고, 그 안에서 **기존 값과의 비교 없이**
  `secrets.rotate(botTokenRef, workspaceId, chatChannelCfg.botToken ?? '')`를 실행해 **같은
  `botTokenRef`의 plaintext를 호출자가 보낸 값으로 덮어쓴다.**
  이는 `rotateBotToken`이 하는 일(같은 `botTokenRef`의 값 교체)과 **최종 효과가 동일**하지만,
  다음 세 가지를 건너뛴다:
  1. **24h grace 백업 부재** — `rotateBotToken`은 교체 전 기존 토큰을 `v2Ref`에 백업하지만
     (`:1301-1306`), `setupChatChannel`은 백업 단계 자체가 없다. 새 토큰이 잘못됐어도
     (`setupChannel` 401/403) 이전 토큰으로 되돌릴 수단이 없다 — 이미 CCH-SE-01에 따라
     `chatChannelHealth=degraded`로만 기록되고 실행은 계속된다.
  2. **전용 audit action 미기록** — `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED`는 `rotateBotToken`
     내부(`:1352-1358`)에서만 기록된다. PATCH 경로는 일반 `TRIGGER_UPDATED`(`:521-526`)만 남긴다.
     이는 spec이 PATCH 차단을 정당화하며 든 이유 (c)와 **정확히 일치하는 결과**다: "PATCH 로 직접
     교체 시 … audit log 가 `trigger.updated` 와 `trigger.chat_channel_bot_token_rotated` 로
     mixed" (`15-chat-channel.md:378`) — 정책은 이 상황을 막으려고 도입됐는데, 막힌 것은
     `botTokenRef` 필드 하나뿐이고 실제 토큰 교체 경로(`botToken`)는 막히지 않아 그 mixed 상태가
     지금도 재현된다.
  3. **`chatChannelRotatedAt` 미갱신** — `setupChatChannel`의 `triggerRepository.update`
     (`:1008-1016`)는 `chatChannelSetupAt`/`chatChannelHealth`/`chatChannelLastError`만 갱신하고
     `chatChannelRotatedAt`은 건드리지 않는다. 즉 응답 DTO의 `chatChannelRotatedAt`(있으면
     회전 이력을 보여주는 필드)이 PATCH를 통한 토큰 교체를 반영하지 못한다 — 클라이언트가 이
     필드로 "마지막 회전 시각"을 신뢰하면 잘못된 값을 보게 된다.
- **판정**: **예 — PATCH는 rotate 엔드포인트를 거치지 않고 bot token 값을 교체할 수 있고, 그
  결과 24h grace와 전용 audit trail을 모두 우회한다.** §5.4.1이 정의하는 "single-path"는 필드명
  (`botTokenRef`) 수준에서만 강제되고 있고, 정책이 실제로 보호하려는 대상(값 교체 자체)은
  강제되지 않는다. 이는 API 계약 관점에서 CRITICAL이다 — 문서화된 보안/운영 불변식
  (rotate 시 항상 grace + 전용 audit)이 대체 경로로 무력화될 수 있다.
- **범위**: 이 갭은 **이번 diff가 만든 것이 아니다** — 검토 대상 3파일(canary 테스트)은 이
  코드를 전혀 건드리지 않는다. 저자가 캐너리 스코프를 넓히지 않고 질문으로만 등재한 판단
  (`spec-draft-nullable-notation-followups.md:1804-1807` "캐너리 스코프를 넓히지 않기 위해
  질문으로만 등재한다")은 **적절하다**. 다만 이 리뷰는 그 질문에 대한 판정을 요구받았으므로
  명시한다: 이것은 별도 P1 보안/계약 수정 작업으로 즉시 트래킹돼야 한다.
- **제안**: (a) `assertChatChannelInputSafe`가 PATCH일 때 `botToken`이 기존 저장된 plaintext와
  다르면 차단하거나(비교하려면 resolve 필요 — 비용 있음), 더 간단하게는 (b) PATCH의
  `ChatChannelConfigDto`를 별도 타입(`botToken` 제외)으로 분리해 애초에 PATCH body에 plaintext
  토큰 필드 자체가 들어올 수 없게 한다 — POST(생성)만 `botToken`을 받고 PATCH는 `uiMapping`/
  `rateLimitPerMinute`/`languageLocale`/`languageHints`만 받는 narrower DTO를 쓰는 편이 R-CC-10의
  의도와 정확히 일치한다.

### [CRITICAL] ⑤ (보너스 발견 — 이 diff 범위 밖, ④ 조사 중 발견) `ChatChannelCard` 편집 저장이 이미 400으로 깨져 있다 — 프런트엔드가 `botToken` 필수 여부를 잘못 가정

- **위치**: `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx:341-367`
  (특히 `:348-350`, `:363-364` 주석과 `:346-361`의 `patchChatChannel` 객체 리터럴),
  대조 근거(DTO 필수 여부): `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:174-187`,
  `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts:99-105`,
  실측 확인: `codebase/backend/test/trigger-workflow-ref.e2e-spec.ts:189-191`
  ("**`botToken`은 생략할 수 없다** … 실측: 빼면 400 `VALIDATION_ERROR` /
  `chatChannel.botToken must be a string`")
- **상세**: `ChatChannelCard`의 저장(`saveMutation`)은 uiMapping/rateLimitPerMinute/languageLocale/
  languageHints만 편집하는 UI인데, 그 PATCH 바디를 만들며 `botToken`을 **의도적으로 생략**한다.
  코드 주석이 그 이유를 명시한다: "botToken 없으면 botTokenRef 유지 (mergeExternalConfig)",
  "단 botToken 은 미포함 — single-path 정책상 PATCH 로 토큰 변경 불가". 즉 프런트엔드는
  `botToken`이 **optional**이고 생략하면 서버가 기존 값을 보존한다고 가정하고 있다.
  그러나 `ChatChannelConfigDto.botToken`은 `@IsOptional()`이 없는 **필수 문자열**이고,
  `UpdateTriggerDto.chatChannel`도 `PartialType`이 아니라 전체 DTO를 `@ValidateNested()`로
  검증한다 — 이 diff의 e2e 테스트 저자가 바로 이 케이스를 직접 부딪혀 확인했다("처음
  `{provider, uiMapping}`으로 보냈더니 400").
  즉 **`ChatChannelCard`의 편집-저장 흐름은 현재 상태로는 항상 400을 받는다** — 사용자가 uiMapping/
  rateLimit/languageHints 중 아무거나 편집 후 저장을 누르면 `saveMutation`의 `onError`
  (`:375-381`)가 걸려 "저장 실패" 토스트만 뜨고 실제로는 반영되지 않는다. 이 컴포넌트에 대한
  단위 테스트 파일이 없고(`find … chat-channel-card* ` → 소스 1개만 존재), 백엔드 e2e/프런트
  Playwright 어디에도 "uiMapping만 PATCH" 경로에 대한 실제 통합 테스트가 없어 이 불일치가
  지금까지 감지되지 않았을 가능성이 높다.
- **판정 근거의 확실성**: DTO 선언(정적) + 이번 PR의 e2e 저자가 남긴 실측 로그(런타임, 같은
  필드) 두 축이 서로 다른 방향에서 같은 결론(“`botToken` 생략 시 400”)을 가리키므로 신뢰도가
  높다. 다만 나는 이 프런트엔드 코드를 실제로 실행해 재현하지는 않았다 — 뮤테이션 규약상
  저장소를 건드리지 않고 정적 대조로만 확인했다는 점을 명시한다.
- **제안**: 별도 버그 티켓으로 즉시 등재 권고(이 canary PR의 스코프는 아님). 수정 방향은 ④의
  제안과 자연히 합쳐진다 — PATCH 전용 `ChatChannelConfigDto` 변형(`botToken` 제외)을 만들면
  프런트엔드 코드는 그대로 두고 백엔드 검증만 프런트의 (원래 의도했던) 가정에 맞출 수 있다.
  반대로 프런트를 고치려면 "편집 시 기존 `botToken`을 어디서 구해 재전송할 것인가"라는 문제에
  부딪힌다 — 서버는 `botToken`을 응답에서 strip(`writeOnly: true`)하므로 프런트가 로컬 상태로
  들고 있지 않는 한 재전송 자체가 불가능하다. 이는 DTO를 분리하는 쪽(④ 제안 (b))이 유일하게
  일관된 해법임을 시사한다.

## 그 외 점검 관점 (해당 없음 확인)

- **버전 관리 / URL·경로 설계 / 페이지네이션**: 이번 diff는 테스트 파일 3개뿐이고 엔드포인트·
  경로·페이지네이션 파라미터를 도입하지 않는다 — 해당 없음.
- **인증/인가**: e2e(`trigger-workflow-ref.e2e-spec.ts`)는 기존 `registerAndLogin`/
  `createTeamWorkspace` 헬퍼로 정상 인증 플로우를 거치며, 워크스페이스 격리를 우회하지 않는다.
  별도 결함 없음.
- **에러 응답 형식**: 이번 diff는 에러 경로를 새로 만들지 않는다. 다만 ⑤에서 확인했듯
  `chatChannel.botToken must be a string` 400이 프런트에서 사용자에게 구체적 원인 없이 뭉뚱그려
  표시되는 기존 UX 문제가 있으나, 이는 별도 이슈(개발자 SKILL이 아닌 UX 리뷰 소관에 더 가깝다).

## 요약

라우터가 지정한 4개 질문에 대한 판정: ① §5.4에 대한 캐너리의 읽기(`null`과 키 생략을 별개로
취급)는 **정확**하다 — `TriggerDto.workflow`가 `nullable: true` 없이 optional로 선언돼 있으므로
`null`은 유효한 표현이 아니다. ② "생성 응답에만 부재"를 캐너리로 고정하는 것은 근거가 다소
얇지만(구현 아티팩트를 문서화된 사실로 서술한 것에 불과, 미래의 additive 강화를 막을
실질적 이유는 없음) 이 프로젝트의 SDD 관례상 "명시적 spec 개정 없이는 못 바꾼다"는 프로세스
게이트로서는 바람직하다 — 다만 spec 문서에 "이건 계약이 아니라 현재 구현의 반영"이라는 한 줄을
덧붙일 것을 권고한다. ③ `TriggerWorkflowRefDto`의 정확한 키셋 단언은 저장소가 이미 채택한
"의도적으로 좁힌 참조 DTO, 갈아 끼우지 말 것" 설계 철학과 정확히 정렬되며, 자매 헬퍼가 이미 같은
스타일을 쓰고 있어 애디티브 진화를 부당하게 막는 리스크는 낮다. ④ 저자가 판정을 보류한 질문 —
PATCH가 bot-token single-path 정책을 우회하는가 — 에는 **명확히 "예"** 로 답한다: `botTokenRef`
필드만 차단되고 실제 토큰 값을 나르는 `botToken` 필드는 PATCH에서도 필수·무조건 반영되어,
24h grace 백업·전용 audit action·`chatChannelRotatedAt` 갱신을 모두 우회한 채 토큰을 교체할 수
있다. 이는 spec이 그 정책을 도입한 이유(audit 혼재 방지 등)와 정확히 같은 결과를 재현하는
CRITICAL 갭이며, 이번 diff가 만든 것은 아니지만 즉시 별도 작업으로 추적돼야 한다. 조사 과정에서
부수적으로 ⑤ `ChatChannelCard`의 편집-저장 UI가 `botToken` 생략 가능이라는 잘못된 가정 위에
있어 현재 항상 400으로 실패하는 것으로 보이는 기존 버그도 발견해 별도로 등재를 권고한다.

## 위험도

**HIGH** — 검토 대상 diff(캐너리 3파일) 자체는 설계·구현 모두 건전하며 이 diff만 놓고 보면
LOW다. 그러나 요청받은 심층 대조(④)와 그 과정에서 드러난 부수 발견(⑤)이 각각 CRITICAL 등급의
**기존 프로덕션 계약/기능 결함**을 가리키므로 — 두 발견 모두 이번 diff의 범위 밖(신규 코드가
아니라 이미 배포된 로직)이라 이 PR을 차단할 사유는 아니지만, spec이 명시한 보안 불변식(bot
token rotation의 24h grace + audit 단일성)이 실제로 우회 가능하고, 관련 UI 기능이 이미 깨져
있을 가능성이 높다는 점에서 전체 위험도를 HIGH로 표기하고 별도 후속 작업으로 즉시 등재할 것을
권고한다.
