# 테스트(Testing) 리뷰

## 검증 방법

- 실제 소스(`codebase/backend/src/**`, `codebase/backend/test/**`)를 직접 열어 diff 가 생략된 파일(`triggers.service.ts`/`triggers.service.spec.ts`)까지 전수 확인했다.
- `npx jest src/common/utils/password.util.spec.ts src/modules/triggers/dto/trigger-dto-validation.spec.ts src/modules/triggers/triggers.service.spec.ts` 를 실행해 3 스위트 212개(1 skip, 기존 무관 `it.skip('structural anchor')`) 전부 GREEN 확인.
- 뮤테이션 검증 1건: `triggers.service.ts` 의 `details: { field: 'botTokenRef', code: ErrorCode.INVALID_FIELD }` 에서 `code` 를 제거 → `[A] botTokenRef — 서비스 가드가 details 를 { field, code } 로 낸다` 가 예측대로 RED(`toEqual` diff: `- "code": "INVALID_FIELD"`). 원본은 스크래치 디렉터리에 백업해 두고 `cp` 로 즉시 복원, `git status --short` 로 클린 확인(작업 종료 시점 저장소는 이 리뷰가 만든 잔여물 없음).
- `grep -c "code: ErrorCode.INVALID_FIELD" triggers.service.ts` = 13, `grep -c "code: 'INVALID_FIELD'" password.util.ts` = 2 → CHANGELOG 의 "15자리" 주장과 실측 일치.

## 발견사항

- **[WARNING]** e2e 파일 자체가 "`details.code` 는 wire 증거" 라고 선언하면서, 같은 파일 안의 배열-형태(DTO/파이프 경로) 케이스 하나가 그 축을 빠뜨렸다.
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` — `it('너무 짧은 plaintext (DTO @MinLength 발동) → 400 DTO envelope', ...)` 블록 (`Array.isArray(res.body.error.details)).toBe(true)` 다음 `res.body.error.details[0].field` 단언)
  - 상세: 이 파일 상단에 새로 추가된 주석은 "각 `it()` 의 `toEqual` 은 정확 일치라 `code` 가 빠지면 RED 가 된다 — 의도된 엄격함" 이라고 선언하지만, 같은 파일에서 `error.details` 가 배열(파이프/DTO 경로) 형태로 나오는 유일한 케이스는 `toEqual` 이 아니라 `res.body.error.details[0].field` 하나만 `.toBe()` 로 검사하고 `code` 를 전혀 보지 않는다. `trigger-dto-validation.spec.ts` 의 `[A] 파이프 details 원소는 field·message·code 세 키를 모두 싣는다` 가 unit 레벨에서는 이 축을 잡지만, 이 e2e 자리는 실제 HTTP round-trip 에서 배열-형태 `code` 를 검증하는 유일한 지점인데 그 검증이 빠졌다. 파일 주석이 약속한 "5번의 wire 증거" 는 전부 object-형태(`inboundSigningPlaintext` 서비스 가드)이고, 배열-형태 wire 증거는 0건이다.
  - 제안: `expect(res.body.error.details[0]).toMatchObject({ field: 'chatChannel.inboundSigningPlaintext', code: 'INVALID_FIELD' })` 로 한 줄만 보강하면 닫힌다.

- **[INFO]** "빈 `botToken` 이 시크릿을 먼저 저장한다" CRITICAL 버그의 회귀 방지가 DTO 단위 테스트 1건(`pipe.transform()` 직접 호출)에만 의존하고, 실제 HTTP round-trip으로 "400 이후 시크릿 미기록"을 확인하는 e2e/통합 테스트는 없다.
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts` — `it('[C] CreateTriggerDto 는 botToken 빈 문자열을 거부한다', ...)`
  - 상세: NestJS 의 `ValidationPipe` 는 컨트롤러 실행 전에 동작하므로 논리적으로는 이 unit 테스트만으로도 `setupChatChannel`/`SecretResolver.rotate` 가 호출되지 않음이 보장된다. 다만 이 버그 자체가 "쓰기 순서" 문제였던 만큼, 실제 POST 요청이 400 을 반환하고 DB 에 시크릿 행이 생기지 않는다는 것을 e2e 레벨에서 직접 확인하는 캐너리는 없다. `chat-channel-trigger-create.e2e-spec.ts` 는 현재 DB 조회 자체를 하지 않는 패턴이라(SELECT 쿼리 없음) 새 인프라가 필요해 비용이 있다 — CRITICAL 로 보진 않으나 후속 항목으로 남길 만하다.
  - 제안: 여유가 되면 `botToken: ''` 를 POST 로 보내 400 을 확인하고, 이후 같은 워크플로에 대한 트리거 목록 조회로 `chatChannelHealth`/시크릿 미존재를 간접 확인하는 e2e 1건 추가.

- **[INFO]** PATCH 경로(`chatChannel` 차단 5필드)의 `details.code` 는 unit(서비스 계층 mock) 레벨에서만 커버되고, 실제 HTTP wire 증거는 없다 — 파일 자신의 주석이 이를 "후속 항목" 으로 명시했다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts` — `it.each(BLOCKED_FIELD_CASES)('[A] %s — 서비스 가드가 details 를 { field, code } 로 낸다', ...)`
  - 상세: `chat-channel-trigger-create.e2e-spec.ts` 상단 주석이 "커버리지는 POST 생성 경로 전용이고 PATCH 경로의 wire 증거는 아직 없다(후속 항목)" 이라고 스스로 인정하고 있어 새로 발견한 갭은 아니지만, PATCH 는 이 PR 이 이틀 전 막은 CRITICAL 보안 경로(비밀 쓰기 차단)와 같은 표면이라 wire 증거 부재가 상대적으로 더 아쉽다. 기록된 추적 항목이므로 이번 PR 을 막을 사유는 아니다.

- **[INFO]** `password.util.spec.ts` 의 신규 `it.each` fixture 설명("`'P@ss1'`은 3종을 갖췄으나")과 실제 문자 구성이 살짝 어긋난다.
  - 위치: `codebase/backend/src/common/utils/password.util.spec.ts` — `it.each([...])` 앞 JSDoc, `'P@ss1'` fixture
  - 상세: `'P@ss1'` 은 대문자(P)·특수문자(@)·소문자(s)·숫자(1) 4종을 갖추고 있어 "3종" 이 아니라 4종이다. 길이 분기가 `typesCount` 검사보다 먼저 단락(short-circuit)하므로 테스트 정확성에는 영향이 없는 문서 표현상의 사소한 오차다.
  - 제안: 없음(선택적 문구 정정).

## 확인된 강점 (회귀·격리·가독성)

- **뮤테이션 근거가 실측됐다**: CHANGELOG 가 주장하는 "`code` 를 한 자리씩 빼고 RED 확인" 을 임의로 재검증했고 실제로 RED 였다(위 검증 방법 참조). 4개 사각지대(`toMatchObject` 재귀 부분일치·`authConfigId` 미단언·`password.util.spec.ts` 의 `.toThrow` 전용 단언)를 짚은 근거도 소스에서 직접 확인했다 — `triggers.service.spec.ts` 의 `authConfigId` 테스트가 실제로 `code` 만 `toMatchObject` 하고 `details` 를 전혀 보지 않던 것을 이번에 처음 `details: { field: 'authConfigId', code: 'INVALID_FIELD' }` 로 보강했다.
- **fixture 판별력**: `password.util.spec.ts` 의 `it.each` 는 길이 분기/종류 분기를 각각 단독으로 발동시키는 값을 쓴다(위에서 실측 확인). `triggers.service.spec.ts` 의 `BLOCKED_FIELD_CASES` 도 자기 자신을 SoT(`CHAT_CHANNEL_BLOCKED_FIELDS`)와 sorted 비교하는 캐너리(`[A] fixture 가 차단 5필드 전체를 덮는다`)를 둬서, 손으로 적은 배열이 6번째 필드 추가 시 조용히 갭을 내는 경로를 닫았다.
- **테스트 격리**: `TriggersService — chatChannel PATCH ...` describe 블록은 자동 `beforeEach` 없이 각 `it`/`it.each` 케이스가 명시적으로 `await setup(...)` 을 호출해 매번 새 `Test.createTestingModule` 을 만든다 — mock 상태(`secrets.rotate` 호출 카운트 등)가 케이스 간에 누수되지 않는다.
- **비-vacuous 패턴**: 신규 테스트들은 전부 `let thrown: unknown = null` 로 초기화한 뒤 `try/catch` 로 채우고, 예외가 없으면 `toMatchObject`/`toEqual` 이 `null` 에 걸려 실패하도록 구성돼 있다 — 예외가 던져지지 않을 경우 조용히 통과하는 형태(과거 반복 지적된 vacuous 패턴)가 아니다.
- **등가성(D) 테스트의 전이적 고정**: 파이프 층(`trigger-dto-validation.spec.ts`)과 서비스 층(`triggers.service.spec.ts`)이 각각 리터럴을 복사하지 않고 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 상수를 직접 참조해 동등성을 검증한다 — 상수를 고치면 두 스위트가 함께 반응하는지 원리적으로 보장된다.
- **회귀 캐너리 명시**: `[등가성] 값이 null/빈 문자열이면 DTO 를 통과한다` 케이스가 PATCH DTO 에서 `@MinLength(1)` 이 `OmitType` 을 넘어 새는 회귀를 잡도록 의도적으로 배치돼 있고, 주석에 그 의도가 명시돼 있다.

## 요약

이번 변경은 `details[].code` 배선(15자리)과 `botToken` 빈 값 검증 결함을 대상으로 상당히 꼼꼼한 테스트 보강을 동반한다. 자체 뮤테이션 검증(4개 사각지대 발견·수정) 주장을 실제로 재현해 확인했고, fixture 판별력·SoT 역방향 캐너리·비-vacuous 패턴·테스트 격리 모두 양호하다. 남은 갭은 두 종류다: (1) `chat-channel-trigger-create.e2e-spec.ts` 자신이 선언한 "wire 증거" 축에서 배열-형태(DTO/파이프 경로) 케이스 1곳이 `code` 검증을 빠뜨린 소규모 실수(WARNING), (2) PATCH 경로 wire 증거 부재와 빈 `botToken` e2e 캐너리 부재는 이미 저자가 스스로 인지·기록한 후속 항목(INFO, 이번 PR 을 막을 사유 아님). 전체적으로 병합을 막을 만한 결함은 없다.

## 위험도

LOW
