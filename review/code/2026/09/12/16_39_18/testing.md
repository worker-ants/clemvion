# 테스트(Testing) 리뷰 — chat-channel-rules-cleanup (라운드 2)

## 검토 방법 메모

`chat-channel-input-rules.{ts,spec.ts}` · `chat-channel-rejection-messages.const.ts` ·
`dto/chat-channel-config.dto.ts` · `dto/chat-channel-rotate-bot-token.dto.ts` ·
`dto/trigger-dto-validation.spec.ts` · `triggers.controller.ts` · `triggers.service.ts` 를 `Read` 로
직접 열어 diff 게이트와 대조했다(프롬프트 번들이 `chat-channel-input-rules.ts` diff 를 72/262줄에서
잘랐다). `triggers.controller.spec.ts` · `triggers.service.spec.ts` 도 회귀 확인을 위해 열었다.

**실행 검증**:
- `npx jest src/modules/triggers/chat-channel-input-rules.spec.ts src/modules/triggers/dto/trigger-dto-validation.spec.ts` → **2 suites, 110 tests, all pass**.
- **뮤테이션 재현(독립 검증)**: `hasField` 의 `typeof … !== 'undefined'` 존재 판별을 `!!value` truthy
  판별로 스크립트로 바꿔 같은 스펙을 재실행 → `chat-channel-input-rules.spec.ts` 에서 **4건 RED**
  (신규 `null`/`''` botToken·inboundSigningPlaintext 케이스 전부). `cp` 로 원본을 스크래치에
  백업해 두고 되돌렸다 — `git status --short` 로 해당 파일 diff 없음 확인 완료(원복 성공).
  이로써 라운드 1 testing WARNING("서비스 층이 실제로 거부한다는 절반이 미검증")이 이번 라운드의
  신규 테스트로 **실제로 닫혔음**을 직접 확인했다.

## 발견사항

- **[WARNING]** 새로 삽입된 두 `it.each` 블록이 기존 JSDoc 코멘트와 그 코멘트가 설명하던 테스트
  사이를 갈라놓아, 코멘트-테스트 대응이 깨졌다(orphaned comment)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:84-98`
    (JSDoc 두 블록) vs `:132`(그 첫 JSDoc 이 원래 설명하던 테스트)
  - 상세: `git log -p -S"대칭 필드도 막는다"` 로 확인한 결과, `:84-88` 의 JSDoc(**"대칭 필드도
    막는다. 첫 판본은 `botToken` 만 봤는데, 이 함수가 막는 것은 R-CC-21 의 **두 값 필드**다"**)는
    파일이 처음 만들어질 때부터 바로 아래 `it('PATCH 는 inboundSigningPlaintext 도 거부한다', ...)`
    (지금은 `:132`)를 설명하려고 그 자리에 있었다. 이번 diff 는 `@@ -86,6 +86,49 @@` 지점, 즉 그
    JSDoc 바로 뒤에 신규 JSDoc(`:89-98`, "두-층 등가성의 서비스 쪽 절반")과 두 `it.each` 블록
    (`:99-130`, `null`/`''` 케이스)을 끼워 넣었다. 그 결과 지금 위에서 아래로 읽으면 "대칭 필드도
    막는다" 코멘트 바로 다음에 등장하는 코드는 **그 코멘트와 무관한** null/빈문자열 뮤테이션
    테스트이고, 정작 "대칭 필드"(값 필드 두 종을 함께 막는다)를 실제로 검증하는 테스트(`:132`,
    유효 길이 문자열로 `inboundSigningPlaintext` 를 막는 케이스)는 44줄 뒤로 밀려 코멘트 없이
    남았다. 다음 사람이 "대칭 필드도 막는다" 를 읽고 바로 아래 `it.each` 를 그 근거로 오인하기
    쉽다 — 실제로는 두 번째 JSDoc(`:89-98`)이 그 `it.each` 의 진짜 설명이다. 동작에는 영향 없지만
    (`memory: feedback_my_own_fix_is_the_next_defect` 가 지적한 "orphan JSDoc" 재발 패턴과 같은
    형태), 테스트 가독성·다음 편집자의 판단 근거를 직접 훼손한다.
  - 제안: `:84-88` JSDoc 을 `:132` 테스트 바로 위로 옮기거나(원래 자리 복원), 신규 두 `it.each`
    블록 전체를 `:132` 테스트 **뒤**로 옮겨 코멘트-대상 인접성을 되살릴 것.

- **[INFO, 이월 — 이 PR 신규 결함 아님]** 신규 `ChatChannelRotateBotTokenDto`/
  `ChatChannelRotateBotIdentityDto` 에 런타임 shape 계약 테스트가 없다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-rotate-bot-token.dto.ts`(신규
    파일 전체) · `triggers.controller.ts:281-293`(`@ApiOkWrappedResponse` + 반환 타입 선언)
  - 상세: 컨트롤러 반환 타입을 `Awaited<ReturnType<...>>` 대신 DTO 로 선언한 이유가 주석에
    "서비스 반환 형태가 바뀌면 `tsc` 가 잡는다" 인데, 이는 **컴파일 타임**에만 유효하다. 저장소에
    이미 이 목적의 런타임 보완 장치(`shared/testing/response-contract.ts` 의
    `contractForDto`/`assertMatchesContract`)가 있는데 `rotateBotToken` 은 배선돼 있지 않다
    (`grep -rn "contractForDto\|assertMatchesContract" codebase/backend/src/modules/triggers/`
    → 0건, 직접 확인). `triggers.controller.spec.ts` 의 기존 `정상 —` 테스트는 mock 반환값과
    `toEqual` 구조 비교만 하고 DTO 의 `@ApiProperty` 선언과 실제 반환 shape 일치 여부는 검증하지
    않는다. **라운드 1 testing.md INFO 로 이미 지목됐고 `RESOLUTION.md` 의 "이월(INFO — 조치
    불요)" 목록에 등재된 항목**이라 새 결함은 아니지만, 아직 해소되지 않았다는 사실은 이번
    라운드에도 유효하다.
  - 제안: 우선순위 낮음. 다음 `response-contract` 확장 턴에서 4개 미배선 엔드포인트와 함께 처리.

- **[INFO, 이월]** `assertChatChannelAlreadySetUp` 의 `incoming.provider &&` falsy-guard가 이
  파일 자체의 테스트만으로는 여전히 검증되지 않는다
  - 위치: `chat-channel-input-rules.ts:222`(`if (incoming.provider && incoming.provider !== current.provider)`,
    신규 주석 `:210-221`) vs `chat-channel-input-rules.spec.ts` 의 `assertChatChannelAlreadySetUp`
    관련 3개 테스트(`:277-304`, 전부 `provider` 가 truthy 인 `cfg()` 사용)
  - 상세: 이번 plan 의 §설계 판단 (3)이 "DTO 층이 실제로 막는다는 사실은
    `trigger-dto-validation.spec.ts` 가 고정한다"고 명시적으로 정했고, 신규 테스트
    (`trigger-dto-validation.spec.ts:814-822`)가 실제로 `CustomValidationPipe` 를 태워 그 절반을
    고정한다 — 이 자체는 라운드 1 이 정확히 요구한 증거라 타당하다. 다만 그 결과 이 파일
    (`chat-channel-input-rules.spec.ts`) **자신은** `incoming.provider` 가 falsy 인 값으로
    `assertChatChannelAlreadySetUp` 을 직접 호출하는 테스트를 여전히 갖지 않는다 — "도달 불가"
    주장의 두 조각(HTTP 경로 차단 + 함수 자체의 falsy 무시 동작)이 서로 다른 두 파일에 나뉘어
    있어, 이 파일 하나만 읽으면 완결되지 않는다. 라운드 1 testing.md 가 이미 INFO 로 지목한
    항목과 동일하며 이번 라운드에서 조치되지 않았다(plan 상 의도적 defer).
  - 제안: 급하지 않음(설계 판단으로 defer 확정). 재발 방지 차원에서 `assertChatChannelAlreadySetUp(existing,
    cfg({ provider: undefined }))` 형태의 단일 호출 케이스를 이 파일에 추가하면 "도달 불가" 주장이
    단일 파일 안에서 완결된다.

## 긍정적으로 확인한 부분

- **라운드 1 WARNING 실제로 닫힘(비-vacuous)**: `botToken`/`inboundSigningPlaintext` 의 `null`/`''`
  케이스(`chat-channel-input-rules.spec.ts:99-130`)는 위에서 직접 뮤테이션으로 재현·검증한 대로
  `hasField` 의 존재-판별이 truthy-판별로 퇴화하면 **즉시 4건 RED** — 프록시가 아니라 실측으로
  확인했다.
- **레이블 스왑 판별 fixture(`:238-254`)**: `details` 가 두 provider 에서 동일해 그것만으로는
  못 가른다는 점을 정확히 지적하고, `expect(res?.message).toContain(ownLabel)` +
  `not.toContain(otherVendor)` 둘 다로 스왑을 이중으로 잡는다 — 한쪽만 있었다면 vacuous 할 뻔한
  자리다.
- **`update` × 내부 필드 3종(`:163-173`)**: `mode==='update'` 분기가 내부 필드 차단보다 먼저 걸리는
  순서를, 필드별로 이름까지 단언(`details: { field, code: 'INVALID_FIELD' }`)해 순서 역전 뮤턴트를
  검출할 수 있는 구조다.
- **`trigger-dto-validation.spec.ts` 의 provider 필수 테스트(`:814-822`)**: 실제
  `CustomValidationPipe` 를 태우는 기존 harness(`run`)를 재사용해, mock 이 아니라 실제 파이프
  동작으로 "DTO 층에서 막힌다"를 고정한다 — 새 mock 을 추가하지 않고 기존 인프라를 재사용한
  점이 테스트 용이성 측면에서 좋다.
- **회귀**: 순수 헬퍼 추출(`throwInvalidField`/`hasField`/`rejectBlockedField`)이 기존 11개
  `throw` 지점의 봉투 형태를 바꾸지 않았음을 실행으로 확인(110개 전부 GREEN, 기존 테스트 무편집).
- **테스트 격리**: 모든 테스트가 `cfg()`/`thrown()` 헬퍼로 매 호출마다 새 객체를 만들고, 공유
  mutable 상태나 실행 순서 의존이 없다. `CustomValidationPipe` 인스턴스도 상태가 없어(각
  `transform` 호출이 독립) `describe` 스코프에서 한 번만 생성해 재사용해도 오염 없음을 소스
  확인했다.

## 요약

라운드 1 testing WARNING(두-층 등가성의 서비스측 미검증)을 겨냥한 신규 테스트는 실제로 뮤테이션을
잡는 비-vacuous 테스트이며, 직접 재현 검증까지 마쳤다(원복 확인 완료). `update`-모드 내부 필드 순서,
provider label 스왑, DTO 층 provider 필수 테스트도 모두 판별 가능한 fixture 로 구성돼 있다. 다만
이번 diff 의 삽입 지점이 기존 JSDoc 코멘트와 그 설명 대상 테스트 사이를 갈라놓아 코멘트-테스트
매핑이 깨졌다(WARNING) — 동작에는 영향 없지만 다음 편집자가 오독할 자리다. 그 외 신규 swagger
응답 DTO 의 런타임 계약 테스트 부재와 `assertChatChannelAlreadySetUp` falsy-guard 의 단일 파일
내 미검증은 라운드 1 부터 이어지는 low-priority 이월 항목으로, plan 이 의도적으로 defer 한 것과
일치한다.

## 위험도

LOW
