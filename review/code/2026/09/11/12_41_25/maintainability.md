# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위 및 방법

실제 애플리케이션/테스트 코드 변경은 `password.util.{ts,spec.ts}` · 신규
`chat-channel-rejection-messages.const.ts` · `chat-channel-config.dto.ts` ·
`trigger-dto-validation.spec.ts` · `triggers.service.{ts,spec.ts}` ·
`chat-channel-trigger-create.e2e-spec.ts` · `triggers.{en.,}mdx` · `CHANGELOG.md` 다.
`plan/in-progress/**` 및 `review/**` 하위(과거 라운드 `11_05_27`·`11_33_35`·`12_00_40`·
`review/consistency/**` 산출물)는 이 세션에서 누적 커밋된 워크플로 메타 산출물이라
유지보수성 검토 대상(실행되는 애플리케이션 코드)이 아니므로 제외했다.

`git diff origin/main..HEAD -- codebase/` 로 실제 소스 diff를 직접 열어 프롬프트가 생략한
`triggers.service.ts`/`triggers.service.spec.ts` 전체 변경분을 확인했고, 각 발견사항의
줄 번호는 현재 파일(`git show HEAD:<path>` 기준)의 실제 줄 번호다.

이번 diff는 이전 라운드(`11_05_27`)가 지적한 두 항목을 이미 해결한 상태로 들어왔다:

- **[해결 확인]** `it.each` fixture 중복(WARNING, `11_05_27/maintainability.md`) → 이번 커밋에서
  `triggers.service.spec.ts:3099` 의 `const BLOCKED_FIELD_CASES = [...] as const;` 로 통합되고,
  같은 파일의 두 `it.each(BLOCKED_FIELD_CASES)`(`:3130` 부근 `[A]`, `:3163` 부근 `[등가성]`)가
  이를 공유한다. 6번째 차단 필드가 추가될 때 fixture가 한쪽만 갱신되는 drift 경로가 닫혔고,
  `[A] fixture 가 차단 5필드 전체를 덮는다` 테스트가 그 커버리지 자체를 캐너리로 고정한다.
- **[해결 확인]** e2e 파일의 4줄 설명 주석 5곳 복제(INFO, `11_05_27/maintainability.md`) →
  `chat-channel-trigger-create.e2e-spec.ts` 상단(1~9행)에 배경 설명을 한 번만 두고, 각 `it()`
  자리에는 `// details.code 는 wire 증거다 — 파일 상단 주석 참조.` 한 줄 앵커만 남겼다
  (`:197`,`:250`,`:272`,`:345`,`:365` 부근). 근거 문구가 바뀔 때 고칠 자리가 1곳으로 줄었다.

## 발견사항

- **[INFO]** 사용자 노출 거부 메시지의 문체가 한 파일 안에서 두 갈래로 혼재한다 (격식체 vs 해요체)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts:47-57`
  - 상세: `botTokenRef`(47-48행)·`inboundSigningRef`(49행)·`inboundSigning`(50-51행)은
    `...입니다.`/`...하세요.` 격식체인데, `botToken`(54-55행)·`inboundSigningPlaintext`(56-57행)은
    `...없어요.`/`...주세요.` 해요체다. 이 PR은 두 층(DTO 데코레이터·서비스 가드)에 흩어져 있던
    기존 리터럴 값을 그대로 옮겨 상수화한 것이라 문체 자체는 이 PR이 새로 만든 것이 아니고,
    이미 이전 라운드(`review/code/2026/09/11/12_00_40/RESOLUTION.md` I10)가 "메시지 문체
    통일" 항목으로 등재해 유예했다. 다만 다섯 문구가 이제 한 파일·한 객체 리터럴 안에 나란히
    있어 불일치가 이전보다 훨씬 눈에 띈다.
  - 제안: 이번 PR을 막을 사유는 아님. I10 트래커 항목 처리 시 이 파일이 정확한 수정 지점.

- **[INFO]** 동일 형태의 "필드 존재 → BadRequestException throw" 블록이 5곳 반복된다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:652-672`
    (`assertChatChannelInputSafe` 내 `botTokenRef`/`inboundSigningRef`/`inboundSigning` 3곳)와
    `:697-713`(`assertPatchCarriesNoSecrets` 내 `botToken`/`inboundSigningPlaintext` 2곳)
  - 상세: 다섯 블록 모두 `if (typeof X !== 'undefined') { throw new BadRequestException({ code: 'VALIDATION_ERROR', message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.X, details: { field: 'X', code: ErrorCode.INVALID_FIELD } }); }` 형태로, 필드 이름만 다르다. 이 반복 구조는 이 PR 이전부터 있었고, 이번 PR은 각 블록에 `message`(상수 참조)·`code`(`ErrorCode.INVALID_FIELD`) 배선을 동일하게 추가했을 뿐이다 — 즉 기존 중복을 유지한 채 한 줄씩 더 늘렸다. 이미 이전 라운드가 `rejectBlocked(field)` 류 헬퍼 추출을 I4로 등재해 유예한 항목과 같은 자리다.
  - 제안: 이번 PR 스코프는 아님. 후속으로 `private rejectIfPresent(value: unknown, field: ChatChannelBlockedField): void`류 헬퍼로 추출하면 5곳이 1곳으로 줄고, `CHAT_CHANNEL_BLOCKED_FIELDS` 를 순회하며 호출하는 형태로 6번째 필드 추가 시 보일러플레이트 증가도 막을 수 있다. I4 트래커 처리 시 참고.

- **[INFO]** `'INVALID_FIELD'` 문자열이 계층에 따라 canonical 상수와 원시 리터럴로 나뉘어 반복된다
  - 위치: `codebase/backend/src/common/utils/password.util.ts:75,96` (원시 리터럴, 사유는 같은 파일 60-65행 주석에 명시) vs `codebase/backend/src/modules/triggers/triggers.service.ts:656,663,670,701,710,...` (13곳, `ErrorCode.INVALID_FIELD` canonical 상수 사용)
  - 상세: `triggers.service.ts`는 `nodes/core/error-codes.ts` 의 `ErrorCode.INVALID_FIELD` 를 일관되게 참조해 오탈자를 컴파일 타임에 막는다. `password.util.ts`는 `common/` → `nodes/` import 선례 부재를 근거로 원시 문자열을 의도적으로 유지하며, 그 판단 근거를 파일 내 주석(60-65행)에 명확히 남겼다 — 임의의 불일치가 아니라 계층 경계를 존중한 설계 결정이다. 다만 두 층이 같은 문자열 값을 별도로 손으로 유지하므로, 두 값 중 하나가 오탈자로 갈리면 타입 시스템이 잡아주지 못한다.
  - 제안: 이번 PR 을 막을 사유는 아님 — 근거가 문서화돼 있고 상수 승격은 9개 모듈의 import 경로를 건드리는 별개 작업이라 이미 트래커 항목으로 분리돼 있다(같은 주석 63-64행).

- **[INFO]** 새 `it.each` 두 블록(`triggers.service.spec.ts:3153,3185` 부근)이 파일 내 대다수 테스트가 쓰는 `.rejects.toMatchObject(...)` 대신 수동 `try/catch` + `getResponse()` 패턴을 쓴다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (신규 `[A]`/`[등가성]` `it.each(BLOCKED_FIELD_CASES)` 두 블록, `getResponse()` 호출 2곳)
  - 상세: 같은 파일에 `.rejects.toMatchObject(...)` 형태가 약 20곳 있는 반면, 이 두 블록은 캡처한 `thrown` 값에 대해 `toMatchObject`(전체 shape 느슨한 확인)와 `toEqual`(details 객체 완전 일치)을 순차로 따로 걸기 위해 수동 패턴을 쓴다 — `.rejects.toMatchObject` 체인 안에서는 중첩 필드만 골라 `toEqual` 로 강제하는 것이 자연스럽지 않기 때문으로 보인다. 목적이 있는 선택이라 결함은 아니지만, 스타일이 갈리는 자리라 다음에 같은 파일을 보는 사람이 "왜 여기만 다른가"를 판단해야 하는 비용이 약간 있다.
  - 제안: 조치 불필요. 필요하면 헬퍼(`async function getThrownResponse(promise)`)로 감싸 패턴 차이를 줄이는 것을 고려할 수 있으나 이번 PR 범위는 아니다.

## 요약

이번 변경은 기존 `BadRequestException` payload 객체/배열 리터럴 15곳에 `code: 'INVALID_FIELD'`
를 추가하고, 5개 사용자 노출 메시지를 `chat-channel-rejection-messages.const.ts` 신규 상수로
단일화하며, `botToken` 검증 데코레이터 하나(`@MinLength(1)`)를 추가한 국소적 리팩터링이다. 신규
상수 파일은 "왜 상수인가(등가성, DRY 아님)"를 명확히 설명하고 `Record<K, string>` 로 필드
집합-메시지 집합의 양방향 타입 결속을 강제하는 등 이 코드베이스의 문서화·타입-안전 관례를 잘
따른다. 특히 주목할 점은 **이전 라운드(`11_05_27`)가 지적한 WARNING(`it.each` fixture 중복)과
INFO(e2e 주석 중복)를 이번 커밋이 각각 공유 상수 배열(`BLOCKED_FIELD_CASES`)과 파일 상단 단일
주석+앵커 패턴으로 정확히 해결했다**는 것이다 — 재발하기 쉬운 두 종류의 drift를 구조적으로
막았다. 남은 발견사항은 전부 INFO 수준이며, 그 중 다수(메시지 문체 혼재 I10, boilerplate 헬퍼
추출 I4, `INVALID_FIELD` 상수 승격)는 이미 이전 라운드가 실측·문서화하고 별도 트래커 항목으로
명시적으로 유예한 것들이라 이번 PR을 막을 사유가 아니다. 함수 길이·중첩 깊이·순환 복잡도 측면에서
새로 나빠진 곳은 없다(추가된 것은 객체 리터럴 필드 1개, 데코레이터 1개, 상수 참조 치환뿐).

## 위험도

LOW
