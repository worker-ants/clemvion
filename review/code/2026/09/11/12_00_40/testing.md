# 테스트(Testing) 리뷰 — details[].code 배선 + botToken MinLength + 메시지 상수화 (3라운드)

## 검증 방법

`git diff origin/main -- codebase/` 로 실제 코드 diff(10파일, +401/-42)를 확인했고, 프롬프트에서
전문이 생략된 `triggers.service.ts`/`triggers.service.spec.ts` 는 `git diff`로 직접 열어 대조했다.
`npx jest src/common/utils/password.util.spec.ts src/modules/triggers/dto/trigger-dto-validation.spec.ts
src/modules/triggers/triggers.service.spec.ts` 를 직접 실행해 GREEN(211 passed, 1 skipped — 기존
무관 skip)을 확인했다. 저장소에 뮤테이션을 가하지 않았다 — `git status --short` 에 이 리뷰가
만든 변경 없음(신규 `review/code/2026/09/11/12_00_40/` 세션 디렉터리만 untracked).

이 PR 은 이미 2라운드 리뷰(`11_05_27`, `11_33_35`)를 거쳐 `it.each` fixture 중복(WARNING) ·
canonical `ErrorCode` 미재사용(WARNING) 등이 반영된 상태(`0fb691248`, `2d0270fbd`)라, 이번
라운드에서는 잔여 갭 위주로 확인했다.

## 발견사항

- **[INFO]** 필드 없는 진단 payload(`{errors}`/`{offenders}`/`{reason}`) 가 `code` 를 계속 안 싣는다는
  스코프 경계를 잠그는 회귀 캐너리가 없다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (파일
    헤더 주석, "범위 밖" 서술) — 대응하는 테스트 파일 없음
  - 상세: `CHANGELOG.md`·상수 파일 헤더 주석·plan 문서가 공통으로 "`field` 가 없는 진단 payload
    6곳은 §5.3 이 명시적으로 범위 밖이라 손대지 않았다"고 적는다. 이 경계 판단 자체는 타당하다
    (제안대로 두면 §5.3 의 "top-level 특화 코드와 details.code 를 겹쳐 쓰지 않는다" 를 어긴다).
    다만 이 PR 이 세운 이 경계를 **테스트가 아무것도 고정하지 않는다** — 15자리는 뮤테이션으로
    개별 RED 를 확인했지만, "이 6곳은 `code` 가 없어야 한다"는 반대쪽 불변식은 어떤 spec 에도
    단언이 없다. 다음 PR 이 이 6곳에 무심코 `code` 를 얹어도(§5.3 의 겹쳐-쓰기 위반) 지금
    테스트 스위트는 감지하지 못한다. 이 저장소가 반복 강조해 온 "양성 대조(확인했으나 문제
    없음)를 테스트로도 고정한다" 관례(예: `[실측]` 캐너리들)와 대비된다.
  - 제안: 저비용 캐너리 하나로 충분하다 — 예를 들어 `triggers.service.spec.ts` 에 "`type` 불허
    필드 거부(`disallowed`)나 `endpointPath` 충돌처럼 필드-없는 진단 payload 는 `details.code` 를
    싣지 않는다"를 `toEqual`/`not.toHaveProperty('code')` 로 고정하는 테스트 1개를 추가. 이번 PR을
    막을 사유는 아니며, 후속 트래커 등재로도 충분하다.

- **[INFO]** `botToken` 공백-전용 문자열(`'   '`)이 여전히 테스트되지 않는다 — 단, 이미 세 군데
  (`chat-channel-config.dto.ts` 주석, `trigger-dto-validation.spec.ts` `[C]` JSDoc, `CHANGELOG.md`)에서
  명시적으로 "별개 결정으로 스코프 아웃"이라고 기록돼 있어 새로 발견한 갭이 아니다.
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` (`[C]` 테스트
    JSDoc, "공백 전용 문자열은 이 가드가 막지 못한다" 단락)
  - 상세: 재확인 목적으로만 기재 — 처분 불필요.

- **[INFO]** `authConfigId` 케이스의 top-level 단언이 `toEqual` 이 아니라 `toMatchObject` 를 유지한다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` (`AUTH_CONFIG_NOT_FOUND`
    케이스, `code`/`details` 단언 블록)
  - 상세: 1라운드 뮤테이션에서 "`details` 를 아예 단언하지 않았다"는 갭은 이번에 `details: { field:
    'authConfigId', code: 'INVALID_FIELD' }` 추가로 닫혔다. 다만 바깥 `toMatchObject` 는 여전히
    재귀 부분일치라, `details` 객체 자체에 나중에 세 번째 키가 추가돼도 이 테스트는 계속 통과한다
    (같은 파일의 `[A]`/`[등가성]` 케이스는 `details` 를 `toEqual` 로 정확 고정한 것과 비대칭).
    지금 당장 판별력에 문제가 되는 자리는 아니다(2차 뮤테이션에서 이 자리도 RED 로 확인됐다는
    plan 기록과 일치) — 스타일 일관성 수준의 관찰.
  - 제안: 급하지 않음. 여유가 있으면 `details` 단언만 `toEqual` 로 승격.

## 확인했으나 문제 없음 (양성 대조)

- **뮤테이션 근거의 재현성**: plan 문서가 주장하는 "15자리 개별 RED"는 diff 상 15개 throw 자리
  전부에 대응하는 단언(`toEqual`/`toMatchObject` 보강)이 실제로 코드에 존재함을 직접 대조로
  확인했다 — `triggers.service.ts` 13곳(`type`·`botTokenRef`·`inboundSigningRef`·`inboundSigning`·
  `botToken`·`inboundSigningPlaintext`×5·`chatChannel`·`provider`·`authConfigId`) + `password.util.ts`
  2곳. 각 자리에 대응하는 spec 단언(`triggers.service.spec.ts`/`password.util.spec.ts`)이 `code`
  키를 명시적으로 요구하는 형태(`toEqual` 전체 고정 또는 `details.code` 개별 단언)로 바뀌어 있다.
- **`it.each` fixture 중복 해소**: `triggers.service.spec.ts` 의 두 `it.each` 블록(`[A]`·`[등가성]`)이
  이제 `BLOCKED_FIELD_CASES` 하나를 공유하고, 그 배열이 `CHAT_CHANNEL_BLOCKED_FIELDS` 전체를
  덮는지 별도 테스트(`[A] fixture 가 차단 5필드 전체를 덮는다`)로 고정했다 — 손으로 적은 목록이
  SoT 배열과 어긋나면 이 테스트가 RED 가 된다. 1라운드 maintainability WARNING 이 실제로 닫혔다.
- **테스트 격리**: `triggers.service.spec.ts` 의 `setup()` 이 `it()`/`it.each` 케이스마다 새
  `Test.createTestingModule` 을 만들고 mock 을 매번 새로 주입한다 — 케이스 간 상태 누수 없음.
  `trigger-dto-validation.spec.ts` 의 `run()` 도 매 호출마다 독립적으로 `pipe.transform` 을 태운다.
  두 파일 모두 순서 의존적 단언(공유 mutable 상태) 없이 독립 실행 가능함을 확인했다.
- **판별력 있는 fixture**: `password.util.spec.ts` 신규 `it.each` 는 `'P@ss1'`(길이 미달, 3종
  충족)과 `'alllowercase'`(길이 충족, 1종)로 길이/종류 두 분기를 정확히 가른다 — 두 케이스가
  같은 이유로 실패하는 vacuous 위험이 없다.
- **PATCH vs POST 분기 판별**: `trigger-dto-validation.spec.ts` 의 `[C]`(`CreateTriggerDto` 의
  `botToken: ''` 거부)와 기존 `[실측]`(`ChatChannelUpdateConfigDto` 의 `botToken: ''` 통과) 이
  같은 값(`''`)을 서로 다른 DTO 에 흘려 반대 결과를 요구한다 — `@MinLength(1)` 이 `OmitType` 경계를
  넘어 새는 회귀를 두 방향 모두에서 잡는 좋은 discriminating pair.
- **Mock 적절성**: `SecretResolverService`/`ChannelAdapterRegistry` mock 이 실제 인터페이스
  시그니처(`resolve`/`store`/`rotate`/`delete`/`deleteByPrefix`/`exists`, `has`/`get`)를 그대로
  스텁하고 있고, 이번 PR 이 추가한 케이스들은 기존 mock 구조를 재사용할 뿐 새로 발산시키지
  않았다 — mock 과 실제 서비스 계약의 괴리 없음.
- **e2e 실측 근거**: `chat-channel-trigger-create.e2e-spec.ts` 5곳의 `toEqual` 이 §5.3 규약의
  유일한 실 HTTP wire 증거라는 파일 상단 주석의 주장이 실제로 그렇다 — unit 은 `getResponse()`
  (in-process 객체)만 보고, 이 e2e 만 직렬화·역직렬화를 거친 실제 응답 바디를 검증한다.
- **재실행 결과**: `npx jest` 직접 실행으로 3개 spec 파일 GREEN(211 passed / 1 skipped) 재확인 —
  plan 문서의 "GREEN" 주장과 일치.

## 요약

이번 PR 의 테스트 계층은 이미 2라운드 리뷰를 거치며 뮤테이션 근거(15자리 개별 RED)·fixture
중복 제거·집합 커버리지 캐너리(`CHAT_CHANNEL_BLOCKED_FIELDS` ↔ `BLOCKED_FIELD_CASES`)까지 갖춰
테스트 관점에서 성숙도가 높다. 직접 재실행으로 GREEN 을 확인했고, 격리·판별력·mock 적절성
모두 문제를 찾지 못했다. 유일하게 남은 갭은 "필드 없는 진단 payload 6곳은 `code` 를 안 싣는다"는
이 PR 이 스스로 세운 스코프 경계를 고정하는 회귀 캐너리가 없다는 점(INFO) — 반대 방향(양성
대조)을 테스트가 아니라 주석으로만 지키고 있다. 그 외 공백-전용 botToken 미차단·`authConfigId`
단언의 `toMatchObject` 잔존은 이미 문서화된 의도적 스코프이거나 판별력에 실질 영향이 없는
스타일 수준이다. CRITICAL/WARNING 급 테스트 결함은 발견하지 못했다.

## 위험도

NONE
