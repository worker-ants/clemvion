# 문서화(Documentation) 리뷰 — `details[].code` 배선 + 2라운드 fix-up 누적 diff

이 라운드(`12_00_40`)는 `origin/main` 대비 누적된 3개 커밋(`0710021f0` 최초 구현 →
`0fb691248` 1차 리뷰(`11_05_27`) WARNING 4건 반영 → `2d0270fbd` 2차 리뷰(`11_33_35`) WARNING 2건
반영)을 통째로 담고 있다. 아래는 직전 두 라운드의 `documentation.md`/`requirement.md`/
`user_guide_sync.md` 가 지적한 항목들이 실제로 코드에 반영됐는지 파일을 직접 열어 재검증한
결과와, 그 위에서 새로 관측한 사항이다.

## 발견사항

- **[WARNING]** `spec/5-system/15-chat-channel.md` §5.4.1.2 가 여전히 "배선 전" 시제를 유지한다 —
  이 PR(HEAD 기준)이 바로 그 배선을 완료했는데도 spec 파일 자체는 이번 diff 50개 파일 목록에
  없다 (2라운드 연속 carry-over, 여전히 미해소)
  - 위치: `spec/5-system/15-chat-channel.md:411-416` (§5.4.1 표 아래 문단, "`details[].code` 는
    **현재** 두 항목 모두 서비스 가드 갈래라 싣지 않는다 … 그 PR 이 머지되기 전까지 이 문단은
    *"아직 안 실린다"* 를 서술할 뿐 *"싣지 않기로 했다"* 가 아니다" 문장) — 산문이라 함수/블록명
    특정 불가, 절 제목으로 기재.
  - 상세: 직접 `Read` 로 재확인했다. §5.4.1 표 안(375행)과 §5.4.1.1 회전 행(426행)의 동일 패턴
    문장은 이미 시제-중립("배선 뒤에는 두 갈래 모두 `code` 를 싣는다. 위 「`code` 없음」은
    **배선 전 관측값**이다")으로 고쳐져 있어 병합 시점과 무관하게 참으로 남는다 — 이 두 곳은
    문제 없다. 그러나 §5.4.1.2(411-416행)만은 "그 PR 이 머지되기 전까지"라는 **명시적 시제**로
    남아 있고, 실제로 `triggers.service.ts:734,745`(`chatChannel`/`provider` 필드 거부)가 이번
    diff 에서 `code: ErrorCode.INVALID_FIELD` 를 정확히 그 배선 대상으로 삼아 완료했다 — "뒤따르는
    developer PR" 이 바로 이 PR 이므로, 이 브랜치가 병합되는 순간 그 문장은 거짓이 된다. plan
    파일(`plan/in-progress/impl-details-code-wiring.md:207`)도 "세 자리(375·411-416·426) 전부"
    라고 적어 §5.4.1.2 만 남았다고 명시적으로 종결·인지하고 있다.
  - **developer 가 직접 고칠 수 없다** — 자기-반증형 소정정 조건 1(그 문장을 developer 자신이
    썼는가) 이 불성립한다. 그 문장은 `#1316` planner 턴이 썼다(plan `184`행). 이번 라운드도
    코드를 되돌릴 사안이 아니라 **spec 문서 쪽의 planner 턴 정정**이 필요하다는 점은 변하지
    않았다.
  - 제안: 병합을 막을 사유는 아니다(2라운드 연속 동일 판단, 프로젝트 컨벤션상 정상 절차) —
    다만 WARNING 을 유지해 "다음 세션이 이미 해결됐다고 오독"하지 않도록 한다. planner 턴에서
    §5.4.1.2 를 §5.4.1/§5.4.1.1 과 같은 시제-중립 패턴으로 정정할 것.

- **[INFO]** `triggers.mdx`/`triggers.en.mdx` 의 인접 문장 하나가 방금 고친 두 문장과 나란히
  있으면서도 여전히 `details.code` 를 언급하지 않는다 (이 PR 이 만든 gap 은 아니나, 방금의 fix 로
  같은 단락 안에서 눈에 띄게 불일치해졌다)
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx:420` (`Token changes go
    through the rotate API only. Sending `config.chatChannel.botToken` in a PATCH body returns
    400 `VALIDATION_ERROR` (`details.field='chatChannel.botToken'`)…`) / 한국어판
    `triggers.mdx:431` 동일 문장.
  - 상세: `2d0270fbd` 가 바로 위 문단(`triggers.en.mdx:417`)의 `chatChannel`/`provider` 두 문장에
    `details.code='INVALID_FIELD'` 를 추가해 이 라운드가 지적했던 WARNING(#`11_33_35` W2)을
    해소했다. 그런데 바로 다음 문장(`chatChannel.botToken` PATCH 거부)은 그대로 남아
    `details.field` 만 인용한다. `git show origin/main:…triggers.en.mdx` 로 대조한 결과 이
    문장은 이번 PR 이 손대지 않은 **기존(pre-existing) 서술**이고, 실제로 이 필드의 거부는
    `CustomValidationPipe.flattenErrors`(`validation.pipe.ts:58`)를 통해 **이 PR 이전부터 이미**
    `code: 'INVALID_FIELD'` 를 실어 왔다(architecture.md·requirement.md 가 이전 라운드에서 확인한
    "이 층은 원래부터 싣고 있었다" 사실과 일치). 즉 이 PR 의 회귀가 아니라 오래된 문서 갭인데,
    방금 위 두 문장을 고치면서 같은 단락 안 세 번째 문장만 남아 국지적 비일관성이 더 도드라지게
    됐다 — 독자가 "이 단락의 나머지 필드는 `code` 가 없다"고 오독할 위험.
  - 제안: 이번 PR 스코프는 아니나, 같은 파일을 이미 편집하는 김에 한 줄 추가(`details.code=
    'INVALID_FIELD'`)해 단락 전체의 일관성을 맞추는 것을 권장. 차단 사유 아님.

## 확인했으나 문제 없음 (직전 두 라운드 WARNING 6건의 반영 여부 재검증)

- **(`11_05_27` W1, canonical `ErrorCode` 미사용)** — **해소 확인.** `triggers.service.ts:48`
  `import { ErrorCode } from '../../nodes/core/error-codes'` 신설, 13곳 전부
  `ErrorCode.INVALID_FIELD` 참조로 치환됨(`grep -c` 로 리터럴 잔존 0건 재확인). `password.util.ts`
  2곳만 리터럴을 유지하되 그 이유(`common/`→`nodes/` 참조 선례 0건, 계층 경계)를 코드 주석으로
  남겼다 — 방치가 아니라 실측 근거가 있는 의도적 결정.
- **(`11_05_27` W4, 거짓 헤더 주석)** — **해소 확인.** `chat-channel-rejection-messages.const.ts`
  헤더가 실재하지 않는 `.spec.ts` 파일 인용을 정정해 "전용 spec 파일은 없다"고 명시하고, 실제
  두 등가성 단언 위치(`trigger-dto-validation.spec.ts`/`triggers.service.spec.ts`)를 정확히
  지목한다.
- **(`11_05_27` W5, `it.each` fixture 완전 중복)** — **해소 확인.** `BLOCKED_FIELD_CASES` 상수로
  통합됐고, 손으로 적은 목록이 6번째 필드 추가 시 조용히 뒤처질 수 있다는 점까지 별도 캐너리
  테스트(`[A] fixture 가 차단 5필드 전체를 덮는다`)로 방어했다.
- **(`11_05_27`, CHANGELOG 누락)** — **해소 확인.** `CHANGELOG.md` 상단에 신설된 섹션이 두 동작
  변경(`details[].code` 배선, `botToken` 빈 문자열 거부)과 뮤테이션 생존 4자리까지 정직하게
  기록했고, 범위 밖(`field` 없는 6곳·도메인 특화 코드 미신설)도 함께 적었다.
- **(`11_33_35` W2, `triggers.mdx`/`.en.mdx` `chatChannel`/`provider` 문장의 `details.code`
  누락)** — **해소 확인.** 위 발견사항의 인접 INFO 로 재확인했듯, 지적된 두 문장에는 정확히
  `details.code='INVALID_FIELD'` 가 추가됐다.
- **(`11_33_35` I7, `[C]` 테스트 판별력 불일치)** — **해소 확인.**
  `trigger-dto-validation.spec.ts:987-988` 가 `toContain` 단독에서
  `toHaveLength(1)` + `toContain` 조합으로 바뀌어, 같은 파일의 `[A]`/`[등가성]` 과 엄격도가
  통일됐다.

## 처음부터 문제 없다고 판단한 항목 (재확인)

- `password.util.ts`/`.spec.ts` JSDoc — 정책 설명·규약 인용(§5.3)·"canonical 상수를 안 쓰는
  이유"(층 경계 실측 근거) 모두 정확하고 최신 코드와 일치한다.
- `chat-channel-rejection-messages.const.ts` 헤더 — "왜 상수인가(등가성, DRY 아님)"·SoT 인용
  (`15-chat-channel.md` R-CC-21·§5.4.1, `2-api-convention.md §5.3`)·문면 규율 설명이 실제 코드
  사용처(DTO 3곳 + `ChatChannelUpdateConfigDto` 2곳 + service 5곳)와 정확히 일치.
- `trigger-dto-validation.spec.ts`/`triggers.service.spec.ts` 의 신규 `[A]`/`[등가성]`/`[C]` JSDoc
  — 판별 fixture 선택 근거(길이 분기 vs 종류 분기)·뮤테이션에서 생존한 4자리를 구체적으로 남겨
  다음 사람이 fixture 를 훼손해도 의도를 복원할 수 있다.
- `chat-channel-trigger-create.e2e-spec.ts` 상단 배경 설명 + 각 `it()` 의 짧은 앵커 — 반복 없이
  근거 위치가 한 곳에 모여 있다.
- `chat-channel-config.dto.ts` 하단 `OmitType`/JSDoc-vs-`//` 분리 규율 주석 — `swagger.md:315`
  매직넘버 인용이 절 제목 인용으로 대체돼 있고(`spec/conventions/swagger.md` 에서 해당 절 제목
  실재 확인), 이 저장소가 이미 겪은 "정적 줄-번호는 다음 편집에 깨진다" 교훈이 실천돼 있다.

## carry-over (재확인만, 신규 아님, 우선순위 낮음)

- **[INFO]** `ChatChannelConfigDto` 의 공개 Swagger JSDoc(5개 차단 필드 전부: `botTokenRef`
  (196-203행)·`inboundSigningRef`(218-221행)·`inboundSigning`(235-238행) 등)이 `details.field`
  의 두-갈래 shape 는 정확히 서술하지만 `details.code` 는 여전히 언급하지 않는다. 두 갈래 모두
  이제 `code: 'INVALID_FIELD'` 를 안정적으로 싣는데도(비어있지 않은 값 갈래는 파이프가 원래부터,
  `null`/`''` 갈래는 이번 PR 이 새로 배선), `introspectComments` 로 공개 OpenAPI `description` 에
  그대로 나가는 이 JSDoc 은 그 사실을 담지 않는다. 2라운드 연속 동일 INFO — 우선순위 낮음, 차단
  사유 아님.

## 요약

이번 diff(누적 3커밋)는 직전 두 라운드가 낸 문서화 관련 WARNING·INFO 6건 전부를 실제로 코드에
반영했고, 파일을 직접 열어 재검증한 결과 커밋 메시지의 주장과 실제 코드 상태가 일치했다
(canonical `ErrorCode` 참조 13/13, 거짓 spec 파일 인용 정정, fixture 중복 제거 + 커버리지
캐너리, CHANGELOG 신설, `triggers.mdx`/`.en.mdx` 의 `chatChannel`/`provider` 문장에 `details.code`
반영, `[C]` 테스트 판별력 통일). 유일하게 남은 실질 항목은 2라운드 연속 동일하게 지적된
SPEC-DRIFT — `spec/5-system/15-chat-channel.md` §5.4.1.2 가 "배선 전" 시제를 유지한 채 이 PR 로
stale 해지는데, developer 는 그 문장을 쓴 당사자가 아니라(자기-반증형 소정정 조건 1 불성립)
planner 턴을 기다려야 한다. 새로 관측한 것은 이번 fix 라운드가 `triggers.mdx`/`.en.mdx` 의 두
문장만 고치면서 바로 다음 문장(`chatChannel.botToken`)의 오래된 `details.code` 누락이 같은
단락 안에서 상대적으로 더 두드러지게 된 점(INFO, 이 PR 이 만든 결함 아님) 정도다. 코드를
되돌릴 사안은 없고, README·설정 문서·예제 코드 갱신은 이번 변경 범위(내부 에러 코드 배선·검증
강화·상수화)에 새 기능·환경변수·엔드포인트가 없어 해당 없음이다.

## 위험도

LOW
