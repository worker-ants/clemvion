# 유지보수성(Maintainability) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (라운드 6)

## 검토 방법

이 세션은 이미 5라운드(`16_17_57` → `16_39_18` → `17_02_19` → `17_23_34` → `17_39_51`)를 거쳤고,
매 라운드 maintainability reviewer 가 독립적으로 훑어 CRITICAL/WARNING 없이 LOW 수준 INFO 만
남긴 상태다. `git log`로 확인한 결과 라운드 5(`17_39_51`) 이후 HEAD(`f978f8d77`)가 그대로이며
`codebase/**`에 새 커밋이 없다 — 이번 라운드는 새로 볼 코드 델타가 없다.

독립 검증을 위해 이전 라운드 판정을 그대로 승계하지 않고 핵심 파일을 다시 `Read`로 직접
열어 재확인했다: `chat-channel-input-rules.ts`(전문), `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`(전문),
`triggers.service.ts`의 `rotateBotToken` 6단계 오케스트레이션(전문), `triggers.controller.ts`의
데코레이터 블록, `repo-guards/__tests__/dto-class-name-collision-guard.ts`(전문) 및 형제 가드
(`dto-jsdoc-citation-guard.ts` 등 9개)의 AST 순회 방식 대조(`grep -l forEachChild`).

저장소 파일은 조회만 했다 — 뮤테이션·쓰기 없음. `git status --short` 결과 이 리뷰 산출물 디렉터리
외 변경 없음, 원복 불필요.

## 발견사항

- **[INFO]** `throwInvalidField(field: string, message: string)`의 `field`가 넓은 `string`이라,
  `rejectBlockedField`를 경유하지 않고 리터럴을 직접 넘기는 6개 호출부는 `ChatChannelBlockedField`
  유니언이 주는 오타-컴파일에러 보호를 못 받는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts:56`(선언), 직접
    호출부 `:205-207`(`'chatChannel'`), `:222-226`(`'provider'`), `:270-273`·`:284-287`·
    `:293-297`·`:300-304`(`'inboundSigningPlaintext'` 리터럴 4회 반복).
  - 상세: `rejectBlockedField`는 인자를 `ChatChannelBlockedField`로 좁혀 "필드명을 한 번만
    쓴다"는 목표를 달성했지만, `assertChatChannelAlreadySetUp`·`assertInboundSigningPlaintextByProvider`는
    저수준 헬퍼를 직접 불러 그 보호 밖에 있다. 각 호출부에 `details.field`를 단언하는 테스트가
    붙어 있어(`chat-channel-input-rules.spec.ts`) 오타는 런타임에 곧바로 RED로 드러나므로 실제
    회귀 위험은 낮다. 5라운드 연속 동일하게 관찰·이월된 항목(재발 아님).
  - 제안: 즉시 조치 불요. 호출부가 더 늘거나 실제 오탐이 나면 리터럴 유니언으로 좁히는 것을 고려.

- **[INFO]** `dto-class-name-collision-guard.ts`의 AST 순회가 형제 가드와 스타일이 갈린다 —
  최상위 statement만 보고(비재귀), `SRC_ROOT`도 가드 모듈이 소유(export)하지 않는다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts:33`
    (`for (const stmt of source.statements)`), `dto-class-name-collision.spec.ts`의
    `const SRC_ROOT = path.resolve(__dirname, '..', '..');` (spec이 직접 계산, 가드 모듈에서
    import하지 않음).
  - 상세: 같은 디렉터리의 `dto-jsdoc-citation-guard.ts`를 비롯해 9개 형제 가드가 `ts.forEachChild`로
    재귀 순회한다(`grep -l forEachChild`로 재확인). 이번 신규 가드만 최상위만 보는 비재귀 순회를
    쓴다. 실측으로는 무해하다 — 저장소의 모든 DTO 클래스가 최상위에 선언돼 있어(`export class`가
    블록 내부에 중첩된 사례 0건, 형제 가드들도 동일 전제) 지금 당장 결과가 틀리지는 않지만, 이
    가드의 존재 이유가 "정본 파서로 완전하게 세겠다"인데 그 완전성의 범위(최상위만)가 코드에
    문서화돼 있지 않아 형제 가드와 나란히 보면 "왜 여기만 다른가"를 다음 사람이 되물어야 한다.
  - 제안: 급하지 않음. 스코프를 의도적으로 최상위로 고정할 것이면 JSDoc에 그 범위를 명시하거나,
    형제 가드처럼 재귀 순회 + `SRC_ROOT` export로 통일.

- **[INFO]** `findDtoClassCollisions`가 파일당 불변인 상대경로(`toPosixRelative`)를 그 파일의
  클래스 수만큼 재계산한다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts:56-57`
    (`for (const name of exportedClassNames(file)) { const rel = toPosixRelative(srcRoot, file); ... }`).
  - 상세: `rel`은 `file`에만 의존해 안쪽 루프 반복마다 동일한 값을 다시 계산한다. 114개 파일
    규모에서 성능 영향은 없고 결과도 정확하지만, 바깥 루프로 옮기면 "이 값이 클래스마다 달라질
    수 있나"라는 순간의 오독을 없앨 수 있다.
  - 제안: 급하지 않음(순수 스타일). 다음에 이 함수를 만질 때 정리.

- **[INFO]** `chat-channel-input-rules.spec.ts`에 동일한 `it.each([['null', null], ['빈 문자열', '']])`
  골격이 필드만 바꿔 두 번 반복된다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts:94-106`(botToken) /
    `:108-125`(inboundSigningPlaintext).
  - 상세: 두 블록은 케이스 배열·기대 `code`(`INVALID_FIELD`) 구조가 동일하고 대상 필드명·
    `details.field` 값만 다르다. 필드 목록을 바깥 루프로 한 번 더 감싸 합칠 수도 있으나, 현재
    형태가 각 테스트 제목에 필드명을 그대로 노출해 실패 시 무엇이 깨졌는지 더 직접적으로 보이는
    트레이드오프가 있다.
  - 제안: 조치 불요 — 가독성 vs 중복 제거의 트레이드오프이며 이미 트래커에 등재된 저위험 관찰.

## 확인했으나 문제 없음

- **`chat-channel-input-rules.ts` 8개 함수** — 각 함수가 단일 책임(봉투 생성/필드 존재 판정/
  차단-필드 조합/모드별 검증/이미-설정됨 판정/평문 제거/provider 분기/에러 변환)을 갖고, 최대
  중첩은 2단(`if` 안 `if`), 함수당 순환 복잡도도 5 미만이다. `assertChatChannelInputSafe`의
  오버로드 선언 + 구현 시그니처 패턴은 `mode`/DTO 타입 짝을 컴파일 타임에 묶는 의도가 JSDoc에
  명시돼 있어 다음 사람이 왜 오버로드인지 재구성할 필요가 없다.
- **매직 넘버/문자열** — `'VALIDATION_ERROR'`·`ErrorCode.INVALID_FIELD`는 헬퍼 하나
  (`throwInvalidField`)로 모여 종전 11곳의 반복이 사라졌고, provider label 문자열
  (`'Slack signing secret'` 등)은 정규식·에러 메시지와 함께 `assertInboundSigningPlaintextByProvider`
  한 곳에서만 정의된다.
- **`TriggersService.rotateBotToken` 6단계 오케스트레이션** — 90줄 안팎으로 길지만 번호를 붙인
  주석(`// 1.` ~ `// 6.`)이 각 단계 경계를 명확히 표시하고, 각 단계가 순차 부작용(secret 조회 →
  백업 → 저장 → 외부 호출 → 발급 저장 → 컬럼 갱신 → 감사 로그)이라 쪼개면 오히려 트랜잭션 순서
  근거가 흩어진다. 반환 타입도 도메인 타입(`NonNullable<ChatChannelConfig['botIdentity']>`)을
  참조하는 한 곳으로 모아 손으로 형태를 두 번 적는 중복(과거 라운드가 잡은 결함)을 제거했다.
- **신규 응답 DTO(`chat-channel-rotate-bot-token-response.dto.ts`) 네이밍** —
  `ChatChannelRotateBotIdentityDto`/`ChatChannelRotateBotTokenDto`는 기존 `ChatChannelConfigDto`
  소유의 `ChatChannelBotIdentityDto`와 이름이 겹치지 않고, 왜 합치지 않고 별도 클래스로 두는지
  근거(입력 검증 DTO vs 응답 DTO, 필드 필수 여부 차이)가 파일 헤더에 남아 있다.
- **`triggers.controller.ts`의 신규 데코레이터 블록** — `@ApiNotFoundResponse`/
  `@ApiOkWrappedResponse` 추가분은 인접한 `@ApiBadRequestResponse`/`@ApiBadGatewayResponse`와
  동일한 형태(`description:` 개행 스타일)를 따라 일관적이다.
- **`dto-class-name-collision` 가드의 핵심 설계** — 정규식이 아니라 `typescript` AST 파서를 쓴
  판단, 대조군(fixture 2종: 충돌 검출 + 정규식이었으면 오탐할 자리) 구성, `> 100` 하한 단언으로
  vacuous 통과를 막은 점은 이 저장소가 반복 학습한 패턴을 그대로 따른다.
- **회귀 없음** — 라운드 5 이후 `codebase/**`에 새 커밋이 없음을 `git log`로 확인했고, 직접 재열람한
  8개 애플리케이션/가드 파일 모두 이전 라운드가 기록한 상태와 동일하다.

## 요약

라운드 5 이후 `codebase/**`에 추가된 커밋이 없어 이번 라운드에서 새로 발견된 CRITICAL/WARNING급
유지보수성 결함은 없다. 8개 애플리케이션 파일은 헬퍼 추출(`throwInvalidField`/`hasField`/
`rejectBlockedField`)로 11곳의 반복 에러 봉투 생성을 제거했고, 각 설계 판단(3번째 인자 생략 이유,
`never` 반환 이유, 타입 좁히기로 오타를 컴파일 에러화한 이유, DTO 형태를 두 번 적지 않기로 한 이유)이
코드 주석에 근거와 함께 남아 다음 사람이 재발명할 필요가 없다. 함수 길이·중첩 깊이·순환 복잡도
모두 낮고 네이밍은 기존 컨벤션과 일치한다. 남은 관찰 사항은 5라운드 내내 동일하게 유예돼 온 저위험
INFO 4건(`throwInvalidField`의 넓은 타이핑, 신규 가드의 비재귀 순회·`SRC_ROOT` 소유권 불일치, `rel`
재계산, `it.each` 구조 중복)뿐이며 전부 실측으로 현재 무해함이 확인돼 즉시 조치를 요하지 않는다.
수렴 상태로 판단한다.

## 위험도

LOW
