# 요구사항(Requirement) 리뷰 — chatChannel PATCH 비밀 차단 (D-1·D-2·D-3), fix 이후 재검토

이 라운드는 이전 리뷰(`review/code/2026/09/10/23_21_57`)가 잡은 CRITICAL 1건(slack/discord
`inboundSigningRef` fail-open) · WARNING 5건이 `771801fca`로 조치된 **이후** 상태를 검토 대상으로
한다. 조치 내역은 `triggers.service.ts`를 직접 읽고, `triggers.service.spec.ts` 회귀 테스트를
`npx jest`로 실제 실행해(179 passed / 1 skipped, 2 suites) 확인했다.

## 확인 — 이전 CRITICAL·WARNING은 실제로 닫혔다

- **CRITICAL (inboundSigningRef fail-open)**: `triggers.service.ts:1162-1163`의
  `inboundSigningRefSurvives = providerIssuedStored || Boolean(preservedInboundSigningRef)`가
  `internalCfg`(:1168)·`mergedChannel`(:1199)·실패 시 `fallbackConfig`(:1232-1238, `internalCfg`를
  그대로 재사용) 세 자리 모두에 동일하게 적용된다. `update()`가 `mergeExternalConfig` 호출
  **이전에** `previousInboundSigningRef`를 `trigger.config`에서 미리 집어(:526-528) `setupChatChannel`에
  넘긴다(:590) — "병합 전에 집어야 한다"는 스스로 남긴 근거와 실제 호출 순서가 일치한다.
  `triggers.service.spec.ts`의 `it.each(['slack','discord'])('… inboundSigningRef 가 살아남는다 …')`,
  `telegram — server-issued 재발급 경로에서도 ref 가 실린다`, `setupChannel 이 실패해도(degraded)
  inboundSigningRef 를 잃지 않는다` 세 케이스로 세 자리 모두 회귀 고정됐다. 실행 결과 GREEN.
- **WARNING (provider 전환 미차단)**: `assertChatChannelAlreadySetUp`(:710-732)에 provider 비교
  분기가 추가됐고(`2-trigger-list.md R-12` "변경하려면 트리거 삭제·재생성"과 정합), 컨트롤러
  Swagger 설명(`triggers.controller.ts:122-127`)에도 "provider 를 바꾸려는 경우:
  details.field='provider'"로 반영됐다. 테스트 `PATCH 로 provider 를 바꾸면 400` GREEN.
- **WARNING (JSDoc mode 미반영)**: `assertChatChannelInputSafe` 상단 JSDoc에 `mode==='update'`
  절이 추가됐다(:627-630) — "slack/discord 는 필수" 서술의 주어가 create 한정임을 명시.
- **WARNING (import 중간 타입 선언)**: 두 `type` 선언이 이제 전체 import 블록(1-48행) 뒤,
  `export type TriggerDetail` 앞(50-73행)에 위치 — import 블록이 더 이상 쪼개지지 않는다.
- **WARNING (컨트롤러 Swagger 미반영)**: `@ApiBadRequestResponse`가 세 신규 400 사유
  (비밀 필드/최초 setup/provider 전환)를 명시하도록 갱신됨.

이 다섯 건은 재-flag하지 않는다.

## 발견사항

- **[WARNING]** `chatChannel` PATCH가 비밀 필드를 거부할 때, `details.field`가 **값이 비어있는지
  여부에 따라 flat/중첩 두 가지 형태로 갈라진다** — 그런데 이 갈림이 컨트롤러 Swagger 문서에도,
  이 갈림을 실측하려던 신규 테스트에도 반영돼 있지 않다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:683-699`
    (`assertPatchCarriesNoSecrets` — `details: { field: 'botToken' }` / `details: { field:
    'inboundSigningPlaintext' }`, **flat**, 단일 object) · `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:827-849`
    (`[실측] 차단 5필드의 details.field 는 전부 중첩 경로다` — 다섯 필드 모두 `'x'.repeat(40)`
    **비어있지 않은** 값만 사용) · `codebase/backend/src/modules/triggers/triggers.controller.ts:122-127`
    (`@ApiBadRequestResponse`가 `details.field="chatChannel.botToken"`를 조건 없이 서술).
  - 상세: 실측(저장소 파일 변경 없음, 기존 클래스 `class-validator`/`CustomValidationPipe`를
    그대로 호출):
    1. `IsOptional()+IsEmpty()` 조합에 `undefined`/`null`/`''`/`'abc'`를 넣고 `validate()`를
       직접 호출 — `undefined`·`null`·`''`는 전부 **PASS**(에러 없음), `'abc'`만 FAIL.
    2. 실제 `ChatChannelUpdateConfigDto`(`UpdateTriggerDto` 경유)를 `CustomValidationPipe`에
       통과시켜 `botToken: null`/`''`/`'nonempty-value'`를 비교:
       `null`/`''` → `pipe.transform`이 **정상 통과**(에러 없이 object 반환, 즉 컨트롤러→서비스로
       그대로 흘러간다). `'nonempty-value'` → pipe가 `BadRequestException`을 던지며
       `details: [{ field: 'chatChannel.botToken', ... }]` (**배열**, **중첩 경로**).
    3. 따라서 `botToken: null` 또는 `''`가 실린 실제 HTTP PATCH 요청은 DTO 레이어를 통과해
       서비스까지 도달하고, `assertPatchCarriesNoSecrets`가 `typeof carried.botToken !==
       'undefined'`로 이를 잡아 `BadRequestException({code:'VALIDATION_ERROR', details:{field:
       'botToken'}})`을 던진다 — `GlobalExceptionFilter`(`common/filters/http-exception.filter.ts:65`)는
       `resp.details`를 가공 없이 그대로 싣으므로, 실제 HTTP 응답의 `details`는 **단일 object**
       `{field: 'botToken'}`이다(배열도 아니고 `chatChannel.` 접두도 없다).
    4. 즉 **동일한 논리적 위반**("PATCH에 botToken을 실었다")이 값의 형태에 따라 서로 다른
       `details.field` 표현을 낳는다 — `'chatChannel.botToken'`(비어있지 않은 문자열) vs
       `'botToken'`(null/빈 문자열). 같은 패턴이 `inboundSigningPlaintext`뿐 아니라 기존
       내부 필드 3종(`botTokenRef`·`inboundSigningRef`·`inboundSigning` — 모두 동일한
       `@IsOptional()+@IsEmpty()` 패턴, `triggers.service.ts:638-660`에서 동일하게 flat
       `details`로 던짐)에도 그대로 적용된다.
    5. 이 갈림이 문제가 되는 이유는 두 곳이 "전부 중첩 경로"라고 **무조건** 서술하기 때문이다.
       (a) 컨트롤러 Swagger: "details.field='chatChannel.botToken' 또는
       'chatChannel.inboundSigningPlaintext'". (b) `[실측]` 테스트 자신의 결론(주석) —
       "전역 파이프의 flattenErrors 는 중첩 경로를 만든다... 이 단언이 그 실측의 정본이다 —
       후속 planner 턴이 §5.4.1·§5.4.1.1 의 표기를 고칠 때 여기 값을 근거로 쓴다." — 그런데 그
       "실측"은 non-empty 값만 시험했다. spec 자신도 이 자리를 정확히 "details.field는
       미확정 — 후속 e2e 확인 대기"로 표시해 두고 있다(`spec/5-system/15-chat-channel.md:375`
       `botToken` 행, `:392` rotation 행) — 즉 이 PR이 그 placeholder를 채우는 근거로 쓰려는
       실측 자체가 edge case(빈 값)에서는 반증된다. planner가 이 테스트만 근거로 §5.4.1을
       "PATCH의 botToken/inboundSigningPlaintext 차단은 항상 `chatChannel.<field>` 중첩
       경로"라고 확정하면, null/빈 문자열 케이스에서 spec과 실제 응답이 다시 어긋난다.
  - 제안: 둘 중 하나. (a) 서비스 레이어에서 다루기 힘들면, `assertPatchCarriesNoSecrets` 등
    서비스단 검증 실패도 `details: [{ field: 'chatChannel.botToken', ... }]` 형태(배열 +
    중첩 경로)로 통일해 DTO 레이어와 표현을 맞춘다. (b) 표현을 통일하지 않기로 결정한다면,
    `[실측]` 테스트에 `null`/`''` 케이스를 추가해 "값이 비어있으면 flat, 비어있지 않으면
    중첩"이라는 **완전한** 표를 만들고, 그 완전한 표를 planner 턴에 넘긴다(현재 plan의
    "이 턴에 실측해 planner 로 넘길 것" 표는 이 분기를 담고 있지 않다).

- **[INFO]** `assertChatChannelAlreadySetUp`의 함수 JSDoc이 실제로 수행하는 두 검증 중
  하나만 설명한다 — 이름과 문서가 "최초 setup 여부"만 말하는데 실제로는 "provider 불변"도
  같은 함수가 검사한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:703-709`(함수 JSDoc,
    "[Spec Chat Channel §5.4.1 표 1행] 최초 setup 은 생성 POST 한정이다"로 시작)~`732`(함수 끝).
  - 상세: JSDoc 3문단은 전부 "최초 setup 차단"만 설명하고, 함수 본문 후반(:722-731)의 provider
    전환 차단 로직은 인라인 주석으로만 설명돼 있다(문서화 리뷰 관점의 "함수명·최상단 JSDoc과
    실제 구현의 괴리"에 해당하지만, 인라인 주석이 그 갭을 이미 메우고 있어 심각도는 낮다).
  - 제안: 함수 최상단 JSDoc에 "및 provider 전환 차단 — R-12" 한 줄을 추가하거나, 두 책임을
    `assertChatChannelAlreadySetUp` / `assertChatChannelSameProvider` 두 함수로 분리한다
    (전자가 이전 라운드 security.md WARNING #2의 제안이기도 하다).

## 확인한 것 — 문제 없음

- D-1(`ChatChannelUpdateConfigDto`)·D-2(`storeUserSuppliedSecrets` 게이팅)·D-3(ref 재유도)
  세 설계축 모두 `spec/5-system/15-chat-channel.md` §5.4.1·§5.4.1.1·R-CC-21,
  `spec/2-navigation/2-trigger-list.md` R-12와 line-level로 일치한다. §5.4.1 표 1행("최초
  트리거 생성"만 botToken 신설)·§5.4.1.1 telegram 행(server-issued는 v1 차단 대상 아님, 저장
  건너뛰면 401)·R-12("provider 변경하려면 트리거 삭제·재생성")를 각각 코드가 정확히 구현한다.
- `create()`/`update()` 양쪽 다 `assertChatChannelInputSafe`에 `mode`를 명시적으로 넘기고,
  `mode==='create'`에서만 `assertInboundSigningPlaintextByProvider`(slack/discord 필수)가
  타고, `mode==='update'`에서만 `assertPatchCarriesNoSecrets`가 타 두 요구가 상충하지 않는다
  — `CreateTriggerDto`는 이 diff에서 손대지 않아 생성 경로 무회귀가 테스트로 고정돼 있다.
  실행 확인: `trigger-dto-validation.spec.ts` + `triggers.service.spec.ts` 2 suites,
  179 passed / 1 skipped(무관한 기존 skip).
  `ChatChannelUpdateConfigDto`의 provider 필드는 `OmitType`으로도 유지되는 필수 필드라
  `assertChatChannelAlreadySetUp`의 `incoming.provider &&` 방어적 가드는 사실상 도달
  불가능하지만 안전한 방향의 여분 방어라 문제는 아니다.
- TODO/FIXME/HACK/XXX: 변경된 7개 코드 파일에 없음.
- 반환값: `create()`/`update()`는 모든 분기(chatChannel 유무·setupChannel 성공/실패)에서
  `sanitizeForResponse(result)`를 반환하고, 검증 실패 분기는 전부 `throw`로 빠져나가
  암묵적 `undefined` 반환 경로가 없다.

## 요약

이전 라운드에서 CRITICAL로 판정된 slack/discord `inboundSigningRef` fail-open과 5건의
WARNING은 커밋 `771801fca`로 모두 조치됐고, 그 조치는 대칭 케이스(slack·discord 양쪽)·실패
경로(degraded)·telegram 재발급 경로까지 커버하는 회귀 테스트로 뒷받침된다 — 직접 실행해
GREEN을 확인했다. D-1·D-2·D-3 설계는 spec(§5.4.1·§5.4.1.1·R-CC-21·R-12)과 line-level로
일치한다. 이번 라운드에서 새로 찾은 것은 CRITICAL이 아니라, `chatChannel` 비밀 필드 차단의
`details.field` 표현이 **값이 비어있는지에 따라 flat/중첩으로 갈리는데, 그 갈림을 컨트롤러
문서도 신규 "[실측]" 테스트도 포착하지 못했다**는 WARNING 하나다 — 이 PR의 "실측"이 바로
그 자리(spec의 "미확정" placeholder)를 채우는 근거로 쓰일 예정이라, 지금 edge case를 넣지
않으면 다음 planner 턴이 불완전한 실측을 spec에 확정하게 된다.

## 위험도

LOW
