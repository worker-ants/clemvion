# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위와 방법

- `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts`,
  `codebase/backend/src/modules/triggers/triggers.service.ts` — 프롬프트에는 diff 가 크기 제한으로
  생략돼 있어 원본 파일을 직접 `Read`, 그리고 `git diff 2ae81077c HEAD --stat` 로 **이전 리뷰 라운드
  (`review/code/2026/09/11/15_31_54`) 이후 이 두 파일이 한 줄도 바뀌지 않았음을 확인**했다. 즉 이번
  라운드에서 실질적으로 새로 추가된 코드는 `chat-channel-input-rules.spec.ts`(신규 185줄) 뿐이고,
  두 소스 파일은 직전 라운드의 `maintainability.md` 가 이미 평가한 그대로다(WARNING 1 · INFO 3,
  위험도 LOW). 중복 채점을 피하기 위해 그 항목들은 재제기하지 않고 "여전히 유효하며 트래커에
  등재됐는지"만 확인하는 방식으로 처리했다.
- `plan/in-progress/impl-chat-channel-binder.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`
  — 코드가 아니라 작업 계획/트래커 문서라 유지보수성 코드 리뷰 대상에서 제외(직전 라운드와 동일 기준).
- `review/code/2026/09/11/15_31_54/**`, `review/consistency/2026/09/11/14_59_33/**` — 이전 세션이
  생성한 리뷰 산출물(리포트/상태 파일)이며 애플리케이션 코드가 아니므로 제외.

## 발견사항

- **[INFO]** 직전 라운드가 지적한 4건(에러 봉투 생성 중복 7회 이상·매직 넘버 `256`·이중 캐스팅
  반복 2곳·`TriggersService` 잔존 크기)이 이번 커밋에서 실제로 durable 트래커에 등재됐는지 확인 —
  등재 확인됨, 새로 조치할 것 없음
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 추가된 항목,
    `chat-channel-input-rules.ts 의 구조 정리 6건` 표제 아래 (a)~(f))
  - 상세: `chat-channel-input-rules.ts`, `triggers.service.ts` 는 이번 라운드에서 바뀌지 않았으므로
    직전 리뷰가 찾은 4건은 코드상 여전히 그대로 존재한다. 이번 커밋(`6dc2b7d600`)이 "planner 항목으로
    등재했다"던 앞선 주장이 거짓이었음을 스스로 반증하고 실제로 등재한 것이 이번 diff 의 핵심이라,
    grep 으로 실재를 확인했다: `chat-channel-input-rules.ts` 의 구조 정리 6건이 (a) 에러 봉투 생성
    반복, (b) "입력 규칙" 이름과 출력측 변환(`translateSetupChannelError`) 혼재, (c) 매직 넘버 `256`,
    (d) 이중 캐스팅 2곳, (e)(f) 인접 주석 2곳의 귀속 표기 부정확화까지 정확히 대응한다. 실제 소스와
    대조해도 항목 서술이 정확하다(예: 캐스팅은 `chat-channel-input-rules.ts:96`·`:141` 두 곳,
    `.slice(0, 256)` 은 `:310`·`:316` 두 곳 — 직전 리뷰의 인용 줄과 일치).
  - 제안: 없음 — 이미 트래커에 있고 이번 PR 의 "동작 보존" 스코프 밖이라는 처분도 타당하다. 다음에
    이 파일을 만지는 사람이 그 트래커 항목을 실제로 처리하는지만 후속 라운드에서 확인하면 된다.

- **[INFO]** 신규 `thrown()` 테스트 헬퍼의 반환 타입이 파일 안에서 두 번 별도로 인라인 정의된다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` `thrown` 함수
    (파일 상단 근처, `getResponse() as { code: string; message: string; details: {...} }`), 그리고
    `translateSetupChannelError` describe 블록의 지역 `res` 헬퍼(`getResponse() as { code: string }`)
  - 상세: 두 헬퍼가 같은 `BadRequestException.getResponse()` 봉투를 각자 다른 익명 타입으로 캐스팅한다.
    (`res` 는 `translateSetupChannelError` 가 `details.field` 를 안 채우므로 `thrown` 의 타입을 그대로
    재사용할 수 없어서 새로 정의한 것으로 보인다.) 기능상 문제는 없고 코드베이스의 다른 spec 파일들도
    지역 `thrown`/캡처 헬퍼를 파일마다 독립적으로 정의하는 것이 기존 관례라 일관성 위반은 아니지만,
    두 헬퍼가 한 파일 안에 있어 다음 사람이 세 번째 변형을 추가할 유인이 생길 수 있다.
  - 제안: 우선순위 낮음. 굳이 손댈 필요는 없으나, 후속으로 이 파일에 assert 케이스를 더 추가할 때는
    공유 타입(`type ChatChannelErrorResponse = {...}`)으로 통합해도 좋다.

## 좋았던 점 (참고)

- 신규 `chat-channel-input-rules.spec.ts` 는 `TriggersService` 를 통하지 않고 순수 함수를 직접
  호출해 `Test.createTestingModule` 없이 가드 하나하나를 검증한다 — 파일 docstring 이 "이 이동의
  두 번째 동기"로 명시한 목표(`translateSetupChannelError` 처럼 서비스 경유로는 비싸서 테스트가
  0건이던 자리를 커버)를 그대로 달성했다.
- `it('PATCH 는 값 필드(botToken)도 거부한다 — create 는 받는다', ...)` 의 인라인 주석이 "provider 를
  왜 slack 으로 뒀는가"(telegram 을 쓰면 다른 이유로 던져 대조군이 조용히 흡수된다)를 명시적으로
  설명한다 — 판별 fixture 선택 근거를 코드 옆에 남기는 습관으로, 다음 사람이 이 테스트를 "정리"하며
  provider 를 되돌려 대조군을 다시 죽이는 사고를 막는다.
- `translateSetupChannelError` 의 캐너리 테스트(`[캐너리] discord verify_key 불일치는 **지금은**
  502 로 떨어진다`)가 알려진 결함을 고치지 않고 현재 동작을 고정한 뒤, 그 이유(이 PR 의 유일한
  주장이 동작 보존)와 추적 위치(`plan/in-progress/spec-draft-nullable-notation-followups.md`)를
  주석에 남겼다 — 결함을 숨기지 않으면서도 스코프를 지키는 방식이 정직하고 추적 가능하다.
- `it.each` 로 세 내부 필드(`botTokenRef`/`inboundSigningRef`/`inboundSigning`)를 한 테이블로 묶어
  거의 동일한 세 개의 `it` 블록을 반복하지 않았다.

## 요약

이번 라운드에서 유지보수성 관점에 실질적으로 새로 들어온 코드는 신규 단위 테스트 파일
(`chat-channel-input-rules.spec.ts`) 뿐이며, 품질이 양호하다 — 판별 fixture 선택 근거·캐너리 테스트
사유·설계 배경을 코드 옆에 남기는 이 코드베이스의 문서화 습관을 그대로 따르고, `it.each` 로 반복을
줄였다. 소스 파일 두 개(`chat-channel-input-rules.ts`, `triggers.service.ts`)는 직전 라운드
이후 변경이 없어 그때의 평가(WARNING 1·INFO 3, LOW)가 그대로 유효하며, 이번 커밋이 그 4건을 실제
durable 트래커에 정확하게 등재했음을 확인했다(등재 내용과 실제 소스 줄 번호가 일치). 새로 도입된
결함이나 퇴행은 없다.

## 위험도

LOW
