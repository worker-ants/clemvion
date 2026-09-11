# 요구사항(Requirement) 리뷰 — `impl-chat-channel-binder` (뮤테이션-공백 폐쇄 라운드, `81d2a8c18`)

## 스코프 확인

`origin/main` 대비 실제 코드/문서 diff 는 `HEAD`(`81d2a8c18`) 한 커밋이다. 리뷰 대상 11개 파일 중
실질 변경은 3개뿐이다 — `chat-channel-input-rules.spec.ts`(테스트 12건 → 19건), `chat-channel-input-rules.ts`(JSDoc 6줄 추가, 로직 무변경), `plan/in-progress/impl-chat-channel-binder.md`(체크리스트
수치 1줄 갱신). 나머지 8개(`review/code/2026/09/11/15_57_42/**`)는 직전 라운드가 만든 리뷰 산출물이
이번 커밋에 실려 커밋된 것뿐이라 요구사항 관점 검토 대상이 아니다.

검증 방법: `Read`/`git show`/`git log` 로 diff 를 직접 대조했고, `codebase/backend`에서
`npx jest src/modules/triggers/chat-channel-input-rules.spec.ts` 를 두 번(뮤테이션 전/후) 직접
실행했다. 뮤테이션은 저장소 밖 scratch 디렉터리(`/private/tmp/.../scratchpad/chat-channel-input-rules.ts.orig`)에 원본을 `cp` 로 백업한 뒤 저장소 파일을 직접 고치고, 검증 후 다시 `cp` 로
원복했다(`git checkout`/`restore` 미사용). 원복 후 `git status --short` 는 `review/code/2026/09/11/16_16_44/`(이 세션 자신의 산출물) 외 변경 없음을 확인했다 — 원복 완료.

## 발견사항

- **[WARNING] plan 체크리스트가 인용하는 최종 테스트 수치가 이 커밋 자신의 "검증" 절과 어긋난다 — 직전 라운드가 지적한 결함(W3)과 같은 클래스가 같은 커밋 안에서 다시 발생**
  - 위치: `plan/in-progress/impl-chat-channel-binder.md:163`
    (`- [x] \`run-test.sh\` 4단계 GREEN (backend **9,580** — T1 이동 시점 9,568 + 신규 spec 12 · ...)`))
  - 상세: 이 커밋의 목적 중 하나가 "plan 이 인용한 통과 수치(9,568)가 최종 수치(9,580)와 어긋난
    W3 를 고친다"(측정 시점을 함께 적는다)는 것이었다. 실제로 `:163` 을 `9,568`→`9,580`(T1 이동
    시점 값 + 6dc2b7d60 가 추가한 12건)으로 고쳤다. 그런데 **이 커밋 자신도 같은 파일
    (`chat-channel-input-rules.spec.ts`)에 7개 테스트를 더 추가한다** — `git show 6dc2b7d60:...spec.ts | grep -c "it(\|it.each("` 로 이전 상태(소스 레벨 10개 호출→실제 생성 테스트 12건), `git show 81d2a8c18:...spec.ts`(소스 레벨 15개 호출→실제 생성 테스트 19건)를 대조했고, 직접
    `npx jest .../chat-channel-input-rules.spec.ts` 를 실행해 **19 passed, 19 total** 을 실측
    확인했다(12+7=19, 정확히 일치). 즉 이 커밋이 최종적으로 만드는 backend 통과 수는 `9,580+7=9,587`
    이고, 커밋 메시지 자신의 `## 검증` 절도 정확히 `"backend **9,587**(+7)"` 이라고 적는다. 그런데
    plan 파일에 새로 써넣은 `:163` 은 `9,580` 에서 멈춰 있다 — **이 커밋이 스스로 추가한 7건을
    반영하지 못한 채 커밋되는, 정확히 W3 와 같은 종류의 "쓰는 시점에 최신이 아닌 측정값"** 이다.
    커밋 메시지 자신이 "측정 시점을 함께 적어 고쳤다"고 주장하는 바로 그 문장이, 같은 커밋 안에서
    다시 스스로 반증된다.
  - 제안: `plan/in-progress/impl-chat-channel-binder.md:163` 을
    `backend **9,587** — T1 이동 시점 9,568 + 6dc2b7d60 신규 12 + 이 커밋 신규 7` 형태로 정정한다.
    다음에 이 항목을 다시 손댈 때는 plan 편집을 **테스트 추가 이후 마지막에** 하는 순서로 바꾸면
    재발을 막을 수 있다.

- **[INFO] 정규식 스왑 뮤턴트 검증 주장(`3건 RED`)을 직접 재현해 사실로 확인**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:267,279`
    (`SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX` 대입) ·
    `chat-channel-input-rules.spec.ts:127-162`(교차 케이스 `it.each`)
  - 상세: 두 정규식 대입을 서로 바꿔치기하는 뮤테이션을 적용해 재실행한 결과 정확히 **3건 RED**
    (`PATCH 는 값 필드(botToken)도 거부한다 — create 는 받는다`(slack 생성 경로에 낀 교차
    영향) · `slack 는 hex32 를 요구한다 — 다른 provider 의 길이(hex64)는 거부한다` ·
    `discord 는 hex64 를 요구한다 — 다른 provider 의 길이(hex32)는 거부한다`)를 실측했다 —
    커밋 메시지의 주장과 정확히 일치한다. 새로 추가된 교차 케이스(자기 provider 의 유효 길이를
    반대쪽에 넣는 assertion)가 실제로 이 뮤테이션 클래스를 잡는 유일한 방어선임을 확인했다.
  - 제안: 없음 — 조치 불필요, 검증 완료 기록.

- **[INFO] discord verify_key 불일치 → 502(스펙상 기대값은 400 `BOT_TOKEN_INVALID`) — 신규 결함
  아님, 이미 트래커에 등재된 기존 결함을 캐너리로 고정한 것**
  - 위치: `chat-channel-input-rules.ts:299-303`(신규 JSDoc), `:312`(판별식 `/\b(401|403)\b/`) ·
    `spec/5-system/15-chat-channel.md:362`(§5.4 에러 표, 400 `BOT_TOKEN_INVALID` 기대) ·
    `codebase/backend/src/modules/chat-channel/providers/discord/discord.adapter.ts:94`
  - 상세: adapter 가 던지는 `'BOT_TOKEN_INVALID: Discord verify_key 가 등록된 public key 와
    불일치'`(정확히 일치함을 `grep` 으로 확인)는 숫자가 없어 `translateSetupChannelError` 의
    판별식에 걸리지 않고 fallback `CHAT_CHANNEL_SETUP_FAILED`(502)로 떨어진다. spec §5.4 표는
    이 경우도 400 `BOT_TOKEN_INVALID` 를 기대하므로 **코드가 spec 과 다르다** — 다만 이는 이번
    diff 가 새로 만든 것이 아니라 이동 전부터 있던 결함이고, 직전 라운드(`15_31_54` W3)가 이미
    식별해 `spec-draft-nullable-notation-followups.md` 트래커에 처방 후보까지 등재했다. 이번
    커밋은 그 사실을 소스 JSDoc 에도 각주로 남기고(신규 추가분) 캐너리 테스트로 현재 동작을
    고정했을 뿐 로직은 건드리지 않았다 — "동작 보존" 주장과 정확히 부합한다. 재-flag 는 오탐이므로
    CRITICAL 로 올리지 않는다.
  - 제안: 없음 — 이미 트래커에 등재된 별도 처방 항목, 이번 라운드 조치 불필요.

- **[INFO] 신규 "필드 부재" 테스트가 provider 별 에러 메시지(label) 문구는 단언하지 않는다**
  - 위치: `chat-channel-input-rules.spec.ts:164-176`(`%s 는 inboundSigningPlaintext 부재를
    거부한다`) vs `chat-channel-input-rules.ts:250-253`(`label` 분기: `'Slack signing secret'` /
    `'Discord application public key'`)
  - 상세: 이 테스트는 `details: { field, code }` 만 단언하고 `message` 문구는 확인하지 않는다.
    두 provider 의 `label` 문자열을 서로 바꿔치기하는 뮤테이션이 있어도 이 테스트는 여전히
    GREEN 이다. 다만 이 파일의 다른 provider 분기 테스트들도 대부분 같은 스타일(필드/코드만
    확인)이라 이번 diff 가 새로 만든 결함은 아니고, 이번 라운드가 닫으려던 커버리지 공백
    목록(W1·W2·INFO1-4)에도 "label 문구 단언"은 포함되지 않았다 — 우선순위 낮은 잔여 공백으로만
    기록한다.
  - 제안: 급하지 않음. 후속에서 `message` 를 `CHAT_CHANNEL 관련 상수화 + toMatchObject({message: ...})` 로 확장하면 label 스왑 뮤턴트까지 잡을 수 있다.

## 확인해 통과로 처리한 항목 (참고)

- `assertPatchCarriesNoSecrets`의 신규 `inboundSigningPlaintext` 케이스는 provider 와 무관하게
  값 필드 존재만으로 차단한다 — spec §R-CC-21 본문("차단의 기준은 필드명이 아니라 값이 바뀌는가")과
  정확히 부합한다(`spec/5-system/15-chat-channel.md:385`).
- `mode==='update'` 공개 진입점 디스패치 신규 테스트(`assertChatChannelInputSafe(..., 'update')`)는
  내부적으로 `assertPatchCarriesNoSecrets` 를 태우는 경로를 직접 실행해 검증한다 — 오버로드
  캐스팅(`as never`)으로 컴파일 타임 오버로드 검사를 우회하지만, 런타임 구현은 단일 함수라 실제
  분기 검증에는 영향이 없다.
- `assertChatChannelAlreadySetUp` 의 신규 "provider 동일 시 통과" 양성 경로 테스트는 기존 거부
  경로 테스트와 대칭을 이뤄 이 함수의 두 분기(허용/거부)를 모두 실행·단언한다.
- `botTokenRef`/`inboundSigningRef`/`inboundSigning` 내부 필드 차단은 이 파일에서
  `mode==='create'` 로만 테스트되지만, 세 검사는 `mode` 분기 이전에 무조건 실행되는 코드 구조이고
  `mode==='update'` 경로의 등가 검증은 `triggers.service.spec.ts`(`BLOCKED_FIELD_CASES`)가 이미
  담당한다는 것을 직전 라운드(`15_57_42/requirement.md`)가 확인해 뒀다 — 재확인 결과도 동일해
  갭이 아니다.
- 신규 테스트 19건을 `npx jest`로 직접 실행해 전부 GREEN 임을 실측했고, 원복 전/후 `git status --short` 로 저장소 잔여물이 없음을 확인했다.

## 요약

이번 라운드(`81d2a8c18`)는 직전 리뷰(`15_57_42`)가 실측으로 지적한 두 커버리지 공백(W1 대칭 필드,
W2 정규식 스왑)과 INFO 4건을 정확히 겨냥해 닫았다 — 정규식 스왑 뮤테이션을 직접 재현해 새 교차
케이스가 3건을 RED 로 잡아냄을 확인했고, 나머지 신규 테스트도 실제 코드 분기·spec 요구사항과
line-level 로 일치한다. 로직 변경은 없고(JSDoc 6줄 추가뿐), 기존에 알려진 discord verify_key
버그는 이미 트래커에 등재된 채 캐너리로 적절히 고정됐다. 유일한 실질적 흠은 **이 커밋이 스스로
"측정 시점의 정확성"을 고치겠다며 손댄 바로 그 plan 줄(`:163`)이, 같은 커밋이 추가한 7개 테스트를
반영하지 못해 커밋 착지 시점에 이미 stale 하다**는 점이다 — 커밋 메시지의 `## 검증` 절(9,587)과
plan 파일의 값(9,580)이 서로 다르다. 기능적 결함·엣지케이스 누락·에러 코드 오류·spec 불일치(신규)는
발견되지 않았다.

## 위험도

LOW
