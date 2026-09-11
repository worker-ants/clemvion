# 부작용(Side Effect) 리뷰

## 조사 방법 메모

프롬프트에 diff 가 생략된 두 파일(`triggers.service.ts`, `triggers.service.spec.ts`)은
`git diff origin/main...HEAD -- <path>` 로 전문을 직접 열람해 대조했다. 저장소 트리에는
아무것도 쓰지 않았다(`git status --short` 로 조사 종료 시점 clean 확인 — 신규 미추적 파일은
이 리뷰 세션 산출물 디렉터리 자신뿐).

## 발견사항

- **[INFO]** `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 추가 — 기존에 (버그로) 통과하던
  `botToken: ''` 요청이 이제 400 을 반환하는 **의도된 동작 변경**
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192`
  - 상세: `OmitType(ChatChannelConfigDto, ['botToken', 'inboundSigningPlaintext'])` 목록에
    `botToken` 이 포함돼 있어(`chat-channel-config.dto.ts:385`), `ChatChannelUpdateConfigDto`
    는 이 데코레이터를 상속하지 않고 자신의 `@IsEmpty()` 를 따로 선언한다 — 즉 이번 강화는
    **POST(생성) 경로에만** 정확히 스코프됐고 PATCH 경로로 새지 않는다(검증: `grep` 로 omit
    목록 직접 확인 + `[C]`/캐너리 테스트가 이 경계를 단언). 다만 이 필드는 `@nestjs/swagger`
    로 공개 OpenAPI 스펙에 이미 `minLength: 1` 이 광고돼 있었으므로, 클라이언트 관점에서는
    "선언된 계약을 뒤늦게 강제"하는 것에 가깝다 — 그래도 지금까지 빈 문자열을 보내고 있던
    (버그 의존적인) 호출자가 있었다면 그 호출은 이제 실패한다. 이 항목은 이전 라운드
    (`review/code/2026/09/11/11_05_27/api_contract.md`)에서 이미 INFO 로 식별돼 있어 신규
    회귀는 아니다.
  - 제안: 조치 불필요(의도된 버그 수정, 테스트로 뒷받침됨). 외부 공개 API 라면 릴리스 노트에
    한 줄 남기는 정도로 충분.

- **[INFO]** 잔존 부작용 윈도우 — 공백 전용 `botToken`(`'   '`)은 여전히 `rotate()` 의
  "실패 전에 시크릿 먼저 저장" 경로를 통과한다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:187-192`
    (가드 범위) / `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:129-144`
    (`rotate()` 의 UPSERT, 이 PR 의 변경분 아님)
  - 상세: `@MinLength(1)` 은 길이만 검사하므로 `'   '` 는 통과해 `triggers.service.ts` 의
    `setupChatChannel` `[쓰기 ①]` 이 `SecretResolver.rotate(botTokenRef, ws, '   ')` 를 그대로
    실행한다 — provider 호출 실패가 그 뒤이므로 "요청 실패, 시크릿 행 잔존" 상태 윈도우가
    이 값에 대해서는 그대로 남는다. PR 자신의 diff 주석·CHANGELOG(`CHANGELOG.md:30-31`)가 이
    경계를 명시적으로 스코프 아웃했다고 적어 두었으므로 은닉된 결함은 아니지만, 부작용 관점의
    범위 확인 결과로 기록한다.
  - 제안: 조치 불필요(문서화된 별개 결정). 후속 trim 정책 항목으로만 추적.

- **[INFO]** 신규 공유 상수 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 가 `Readonly` 로 잠겨 있지
  않아 두 계층(DTO 파이프 / 서비스 가드)이 참조하는 단일 mutable 객체
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
    (타입 선언부, `Record<ChatChannelBlockedField, string>`)
  - 상세: `CHAT_CHANNEL_BLOCKED_FIELDS` 는 `as const` 튜플이라 원소 재할당이 타입 에러지만,
    `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 는 `Readonly<Record<...>>` 가 아니라 값 재할당이
    타입 레벨에서 막히지 않는다(`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES.botToken = 'x'` 가
    컴파일된다). 이 diff 안에서 실제로 그런 mutation 을 하는 코드는 없다 — 두 소비처
    (`dto/chat-channel-config.dto.ts`, `triggers.service.ts`) 모두 read-only 참조만 한다.
    다만 이 상수가 "두 층이 절대 갈리면 안 된다"는 등가성을 코드로 강제하려는 의도로
    설계됐다는 점을 생각하면, 런타임 보호(`Object.freeze` 또는 `Readonly<>`)가 없는 것은
    그 의도와 약간 어긋난다 — 제3의 코드가 실수로 값을 덮어쓰면 두 계층이 동시에, 조용히
    오염된다.
  - 제안: 급하지 않음. `Record<ChatChannelBlockedField, string>` → `Readonly<Record<...>>` 로
    타입만 바꾸거나 `Object.freeze()` 로 런타임 방어를 추가하면 이 리스크가 닫힌다.

- **[INFO]** `code: 'INVALID_FIELD'` 생산 지점이 여전히 세 가지 다른 방식(리터럴 vs enum
  참조)으로 나뉘어 있다 — 이번 diff 가 값을 통일했지만 "참조 방식"은 아니다
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts:58`(리터럴, pre-existing) ·
    `codebase/backend/src/common/utils/password.util.ts:66,87` 부근(리터럴, 이 PR) ·
    `codebase/backend/src/modules/triggers/triggers.service.ts`(`ErrorCode.INVALID_FIELD` enum
    참조, 이 PR — 이전 라운드 WARNING 반영 확인: `ErrorCode` import 추가·13곳 전부 치환)
  - 상세: `nodes/core/error-codes.ts:116` 의 `ErrorCode.INVALID_FIELD = 'INVALID_FIELD'` 가
    유일한 canonical 값인데, `password.util.ts` 는 diff 주석에 남긴 대로 "`common/` 이
    `nodes/` 를 import 하는 선례가 0건"이라는 계층 경계 판단으로 의도적으로 리터럴을
    유지한다. 값 자체는 지금 세 곳 모두 `'INVALID_FIELD'` 로 동일해 **현재는** 드리프트가
    없지만, 만약 나중에 이 enum 값이 바뀌면 `triggers.service.ts` 만 자동으로 따라가고
    `password.util.ts`·`validation.pipe.ts` 는 리터럴이라 정적으로 남는다 — 부작용이라기보다
    향후 drift 가능성에 대한 관측이다. 이전 리뷰 라운드(`architecture.md` WARNING)가 지적한
    항목의 일부만(모듈 계층) 해소됐고, 낮은 계층(common/)은 트래커 항목으로 명시적으로 defer
    했다는 점을 diff 주석으로 확인했다.
  - 제안: 이 PR 을 막을 사유 아님 — 이미 트래커 항목으로 분리 인지됨.

- **[INFO]** `password.util.ts`·`triggers.service.ts` 두 예외 payload 형태 변경은 **순수
  additive**(`details[]` 원소/객체에 `code` 키 추가)이고, 호출자 검색 결과 이 값을 엄격하게
  단언하는 다른 소비처는 없음 — 회귀 없음 확인
  - 위치: `codebase/backend/src/common/utils/password.util.ts` (호출부:
    `codebase/backend/src/modules/auth/auth.service.ts:109,729`,
    `codebase/backend/src/modules/users/users.service.ts:306`)
  - 상세: 세 호출부 모두 `validatePasswordStrength(...)` 를 호출만 하고 예외를 그대로
    전파시킨다(catch 후 payload 를 재가공하는 코드 없음). `grep` 으로 해당 모듈·e2e 테스트
    전체를 뒤졌으나 password 오류의 `details` 정확한 shape(`toEqual`)을 단언하는 다른 spec
    파일은 없어, 이번 payload 확장이 다른 테스트를 깨뜨리지 않는다.
  - 제안: 조치 불필요.

## 범위 밖(비대상)으로 확인한 것 — 명시적으로 기재

- `ChatChannelUpdateConfigDto`(PATCH DTO)로 `@MinLength(1)` 이 새지 않음을 `OmitType` 목록
  직접 확인으로 검증(위 첫 항목).
- `CHAT_CHANNEL_BLOCKED_FIELDS`/`MESSAGES` 신규 export 를 소비하는 파일은 diff 에 포함된
  5개(`dto/chat-channel-config.dto.ts`, `triggers.service.ts`, `dto/trigger-dto-validation.spec.ts`,
  `triggers.service.spec.ts`, 상수 파일 자신)뿐 — 순환 import 나 예상 밖의 소비처 없음.
  상수 파일 자체는 다른 모듈을 import 하지 않는 순수 데이터 파일.
  `chat-channel-rejection-messages.const.ts` 헤더 주석이 존재하지 않는 전용 spec 파일을
  가리킨다는 이전 라운드(`architecture.md`)의 WARNING 은 현재 HEAD 에서 이미 정정돼 있음을
  직접 열람으로 확인(신규 발견 아님, 재기재 불필요).
- `review/**`·`plan/**` 하위 변경 파일들은 프로세스 산출물(이전 리뷰/일관성 라운드의
  SUMMARY·개별 리포트·meta.json 커밋)이라 런타임 부작용 검토 대상이 아님 — 신규 전역 상태·
  파일시스템 부작용·네트워크 호출 없음.
- 네트워크 호출·환경 변수 읽기/쓰기·이벤트/콜백 배선 변경 없음(diff 전체가 예외 payload
  객체 리터럴 필드 추가 + DTO 데코레이터 1개 추가 + 상수 파일 신설로 국한).
- `TriggersService`·`ChatChannelConfigDto`·`validatePasswordStrength` 등 기존 공개 함수/메서드
  **시그니처**는 전부 그대로다 — 변경은 전부 함수 본문 내부의 throw payload 리터럴, 또는
  데코레이터 인자(문자열 리터럴 → 상수 참조) 치환.

## 요약

이번 diff 는 새 상태·전역 변수·파일시스템·네트워크·이벤트 배선을 도입하지 않는다. 유일한
런타임 동작 변경은 `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 을 추가해 POST(생성)
경로에서 빈 문자열을 거부하는 것인데, `OmitType` 목록 직접 확인 결과 PATCH 경로로 새지 않고
스코프가 정확하다. 나머지는 기존 `BadRequestException` payload 객체에 `details[].code` 키를
15자리 additive 하게 배선하고 5개 거부 메시지를 공유 상수로 통합한 것으로, 함수 시그니처·
공개 인터페이스·환경 변수·네트워크 호출에는 영향이 없다. 신규 상수 `CHAT_CHANNEL_BLOCKED_
FIELD_MESSAGES` 가 `Readonly` 로 잠겨 있지 않은 점과 `INVALID_FIELD` 값의 생산 방식(리터럴
vs enum 참조)이 파일마다 갈리는 점은 부작용이라기보다 향후 drift 가능성에 대한 저위험
관측이며, 둘 다 병합을 막을 사유는 아니다. 공백 전용 `botToken`(`'   '`)이 여전히 시크릿을
먼저 저장하는 잔존 윈도우는 PR 스스로 문서화하고 스코프 아웃한 기지(旣知) 항목이다.

## 위험도

LOW
