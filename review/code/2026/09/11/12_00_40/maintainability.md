# 유지보수성(Maintainability) 코드 리뷰

## 검증 방법

이번 세션(`12_00_40`)의 diff(`origin/main..HEAD`, 3커밋: `0710021f0`→`0fb691248`→`2d0270fbd`)는
직전 두 리뷰 라운드(`review/code/2026/09/11/11_05_27`, `11_33_35`)가 이미 maintainability
WARNING(`it.each` fixture 완전 중복) 및 architecture WARNING(canonical `ErrorCode` 미재사용,
존재하지 않는 스펙 파일 인용)을 지적하고 그 fix 를 검증까지 마친 상태다. 프롬프트에서 크기
제한으로 diff 가 생략된 `triggers.service.ts`·`triggers.service.spec.ts` 두 핵심 파일은 `git diff
origin/main -- <file>` 로 직접 열어 실제 최종 상태를 확인했고, 나머지 파일도 프롬프트 게이트
번호와 대조했다. 저장소에 뮤테이션을 가하지 않았다(`git status --short` 클린 확인).

## 발견사항

- **[INFO]** `TriggersService` 의 `chatChannel` 차단 필드 거부 로직에서 `throw new
  BadRequestException({ code: 'VALIDATION_ERROR', message: ..., details: { field, code:
  ErrorCode.INVALID_FIELD } })` 4~5줄 블록이 형태 그대로 약 10곳 반복된다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `assertChatChannelInputSafe`
    (656, 663, 670행 부근), `assertPatchCarriesNoSecrets`(701, 704-712행), `assertInboundSigningPlaintextByProvider`
    (794-802, 808-821, 826-836, 838-848행)
  - 상세: 이번 PR 은 "사람이 읽는 `message`" 문자열은 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`
    상수로, "기계가 읽는 `code`" 값은 `ErrorCode.INVALID_FIELD` 상수 참조로 각각 중복을
    제거했다(직전 라운드 WARNING 반영, 실측 확인 — 13곳 전부 `ErrorCode.INVALID_FIELD` 사용).
    다만 그 둘을 감싸는 `BadRequestException` 생성 보일러플레이트 자체는 여전히 각 호출부에
    손으로 반복돼 있다. `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets` 의 5개 차단
    필드 자리만 보면 `field`·`message` 두 값만 바뀌고 나머지 3줄은 완전히 동일한 형태다.
    이 파일이 이미 "등가성은 상수 하나로 고정한다"는 원칙(§CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES
    도입 근거)을 실천하고 있으므로, 이 반복도 같은 원칙의 연장선에서 마저 닫을 수 있다.
    다만 각 블록이 자기 완결적인 인라인 주석(왜 이 필드가 막히는지, SoT 인용)을 갖고 있어
    한 줄로 접으면 그 개별 주석의 위치가 애매해지는 트레이드오프가 있다 — 강제 사항은 아니다.
  - 제안: `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets` 두 곳(내부 필드 3종 + 값
    필드 2종)만이라도 `private rejectBlocked(field: ChatChannelBlockedField): never { throw new
    BadRequestException({ code: 'VALIDATION_ERROR', message: CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES[field],
    details: { field, code: ErrorCode.INVALID_FIELD } }); }` 형태의 사설 헬퍼로 묶으면 5개 호출부가
    각각 `this.rejectBlocked('botTokenRef')` 한 줄로 줄고, 신규 차단 필드가 생겨도 실수로
    `code` 를 빠뜨릴 표면이 원천적으로 사라진다. `assertInboundSigningPlaintextByProvider` 는
    필드가 항상 `inboundSigningPlaintext` 로 고정이고 provider 별 커스텀 `message` 를 쓰므로
    같은 헬퍼를 `message` 파라미터화해 재사용 가능. 급하지 않은 후속 개선 항목.

- **[INFO]** (검증 완료, 신규 아님) `triggers.service.spec.ts` 의 `it.each` fixture 중복 —
  직전 maintainability WARNING 이 온전히 해소됨을 재확인.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`BLOCKED_FIELD_CASES`
    상수 선언부, 바로 아래 `[A]`/`[등가성]` 두 `it.each(BLOCKED_FIELD_CASES)` 블록)
  - 상세: `git diff origin/main` 으로 직접 확인한 결과 두 블록이 하나의 `BLOCKED_FIELD_CASES`
    배열을 공유하고, 그 배열이 `CHAT_CHANNEL_BLOCKED_FIELDS` 전체를 덮는지 별도로 단언하는
    `it('[A] fixture 가 차단 5필드 전체를 덮는다', ...)` 캐너리까지 갖췄다. 단순 중복 제거를
    넘어 "손으로 적은 목록이 향후 6번째 필드에서 조용히 뒤처지는" 재발 경로까지 막았다.
  - 제안: 없음 — 이미 해소.

- **[INFO]** (검증 완료, 신규 아님) `chat-channel-rejection-messages.const.ts` 의 필드 배열
  ↔ 메시지 맵 동기화가 편도에서 양방향 컴파일-타임 강제로 반전됐음을 재확인.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
    (`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES: Record<ChatChannelBlockedField, string>`)
  - 상세: 직전 라운드가 지적한 "`satisfies` 는 원소→key 유효성만 검사, 메시지 쪽 초과분은
    못 잡는다" 문제가 `Record<...>` 타입으로 교체되며 해소됐다 — 메시지 쪽에 키가 빠지거나
    초과하면 양쪽 다 컴파일 에러가 난다. 파일 헤더 주석도 "전용 spec 파일은 없다"고 정확히
    자기 서술해, 존재하지 않는 파일을 가리키던 이전 결함이 남아있지 않다.
  - 제안: 없음 — 이미 해소.

- **[INFO]** (carry-forward, 신규 아님) `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 5개 메시지의
  문체가 격식체(`botTokenRef`/`inboundSigningRef`/`inboundSigning` — `...입니다`/`...하세요`)와
  해요체(`botToken`/`inboundSigningPlaintext` — `...없어요`/`...주세요`)로 혼재한다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
    (`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 객체 리터럴)
  - 상세: 두 차례 앞선 리뷰 라운드가 이미 동일 항목을 INFO 로 기록했다 — 리터럴 값 자체는
    이번 PR 이 바꾸지 않고 두 층에 흩어져 있던 것을 상수로 모으기만 했으므로 pre-existing
    이다. 다섯 값이 한 객체 안에 나란히 놓이면서 대비가 더 눈에 띄지만, 이 PR 의 스코프(A/B/C/D)
    밖이다.
  - 제안: 이번 PR 범위 밖 — 필요 시 별도 트래커에 "chatChannel 거부 메시지 문체 통일" 항목.

- **[INFO]** (carry-forward, 신규 아님) `TriggersService`(1868줄)의 provider-특화 검증 책임
  누적이 이번 PR 로도 계속된다(13개 throw 자리에 `code` 1개씩 추가, 순증가 소폭).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 전체
  - 상세: `plan/in-progress/impl-details-code-wiring.md` 가 "모듈 경계 추출(E)"을 후속 PR 로
    명시적으로 분리했고 그 근거(`forwardRef` 순환 회피를 위해 `chat-channel/` 이 아니라
    `triggers/` 내부 협력자로 추출해야 한다는 실측)도 남아 있다. 이번 diff 는 함수/클래스
    이동 없이 기존 throw 자리의 객체 리터럴만 확장했다 — 새 부채가 아니라 기존 추적 항목의
    연장.
  - 제안: 처분 없음(추적 확인용 기록). 후속 PR(E) 착지 여부만 확인.

## 확인했으나 문제 없음 (양성 대조)

- `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/`assertInboundSigningPlaintextByProvider`
  모두 함수당 단일 책임을 유지하고 중첩 깊이가 최대 2단계(early return + provider 분기)를
  넘지 않는다 — 이번 diff 가 새로 중첩이나 순환 복잡도를 늘리지 않았다.
- 신규 파일 `chat-channel-rejection-messages.const.ts` 는 네이밍(`SCREAMING_SNAKE_CASE` 상수,
  `PascalCase` 타입)·주석 스타일이 기존 코드베이스 관례와 일치한다.
- `password.util.ts` 가 `ErrorCode.INVALID_FIELD` 대신 리터럴 `'INVALID_FIELD'` 를 유지한
  비대칭은 방치가 아니라 계층 경계(`common/` → `nodes/` import 선례 0건, `grep` 으로 재확인)에
  근거한 의도적 결정이고 코드 주석에 그 근거가 실측 수치와 함께 남아 있다.
- `details: { field: 'authConfigId', code: ErrorCode.INVALID_FIELD }` (라인 1011, top-level
  코드는 `AUTH_CONFIG_NOT_FOUND`)처럼 top-level 도메인 코드와 `details.code` generic
  `INVALID_FIELD` 가 공존하는 자리가 있으나, `2-api-convention.md` §5.3 "둘을 겹쳐 쓰지
  않는다"(서로 다른 층의 서로 다른 정보)와 정합적이고 테스트 주석에도 그 근거가 명시돼 있어
  네이밍상 혼란으로 보지 않았다.

## 요약

이번 diff 는 새 기능이 아니라 두 차례 앞선 코드 리뷰 라운드가 지적한 유지보수성 WARNING(`it.each`
fixture 완전 중복, canonical `ErrorCode` 미재사용, 존재하지 않는 스펙 파일 인용)을 정확히 겨냥해
닫은 fix 누적본이며, 직접 `git diff` 로 최종 코드를 열어 세 항목 모두 표면적 패치가 아니라 근거
(층별 import 선례 실측, fixture 완전성 캐너리, 양방향 타입 반전)를 남기고 온전히 해소됐음을
재확인했다. 새로 도입된 코드는 함수 길이·중첩·순환 복잡도 어느 축에서도 새 부채를 만들지
않았다. 유일하게 새로 짚을 만한 지점은 `TriggersService` 의 차단-필드 거부 로직에서
`BadRequestException` 생성 보일러플레이트(약 10곳)가 여전히 손으로 반복되고 있어, 이미 이
파일이 메시지·코드 값 각각에 적용한 "등가성은 상수 하나로" 원칙을 예외 생성 자체에도 마저
적용할 여지가 있다는 것뿐이다(INFO, 급하지 않음, 인라인 주석과의 트레이드오프 있음). 문체
혼재·`TriggersService` 비대화는 pre-existing 이고 이미 트래커·plan 이 추적 중이라 신규 결함이
아니다. CRITICAL/WARNING 급 발견 없음.

## 위험도

NONE
