# 아키텍처(Architecture) 리뷰 — chat-channel-input-rules 구조 정리 + 테스트 보강 (7회차 종합)

## 검증 방법

`git diff origin/main..HEAD -- codebase/backend/src/modules/triggers/ codebase/backend/src/repo-guards/`
로 실제 코드 변경분(9개 애플리케이션 파일 + `repo-guards` 신규 5개)을 전체 열람했다. 이번
diff 는 이전 6라운드(`16_17_57` ~ `17_52_34`)를 거치며 CRITICAL 1건(스키마 이름 충돌)·WARNING
다수를 이미 해소한 상태이고, 그 라운드들의 architecture 리뷰(`17_02_19`·`17_23_34`·`17_52_34`)가
이미 이 코드베이스를 검토해 위험도 NONE 으로 수렴시켰다. 이번 라운드는 그 결론이 여전히
유효한지 전체 diff 기준으로 재확인하는 것이 목적이다. `chat-channel-input-rules.ts` 는
`git diff` 상 기존 파일 수정(신규 파일 아님)임을 확인했다 — 이 세션 이전에 이미 `TriggersService`
에서 분리된 상태였고, `chat-channel/types` import 등 모듈 간 의존은 이 diff 가 새로 만든 것이
아니라 이전부터 있던 것이 그대로 이동·유지된 것이다. 저장소 파일은 조회만 했다.

## 발견사항

- **[INFO]** `chat-channel-input-rules.ts` 는 여전히 입력 검증(`assertChatChannelInputSafe` 등)과
  출력 에러 변환(`translateSetupChannelError`)이라는 서로 다른 책임을 한 파일에 갖는다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — 헤더 주석
    `// **입력만 있는 파일이 아니다**` 블록, `translateSetupChannelError` 함수 정의부.
  - 상세: 6라운드 전부에서 반복 관찰된 사항으로 새 결함이 아니다. 이번 diff 는 그 분리 보류를
    헤더 주석에 명문화하고 근거(파일 분리는 `15-chat-channel.md §7` 파일 트리를 건드려야 하는
    planner 축 결정)를 남겼을 뿐이다. SRP 관점에서 두 책임이 한 모듈에 있다는 사실 자체는
    유효하지만, 분리 비용과 권한 경계를 저울질해 명시적으로 유예한 상태이고 트래커에도
    planner 항목으로 등재돼 있다.
  - 제안: 조치 불요 — 이미 트래커 추적 중.

- **[INFO]** `TriggersController.rotateBotToken` 의 `Promise<ChatChannelRotateBotTokenDto>`
  반환 타입은 컴파일 타임 구조적 계약일 뿐, 런타임에 인터셉터가 실제로 그 클래스 인스턴스로
  변환·화이트리스트하지는 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken`
    시그니처, `triggers.service.ts` 의 반환 타입 선언(`NonNullable<ChatChannelConfig['botIdentity']>`).
  - 상세: 서비스 반환 타입을 도메인 타입(`ChatChannelConfig['botIdentity']`)에 직접 고정해
    구조적 타입 검사로 "선언이 실제보다 좁아지는" 회귀(라운드 1 W1)를 한 곳만 손보면 되도록
    막은 것은 이 PR 이 만든 정당한 개선이다. 다만 이는 정적 타입 정합일 뿐, `response-contract`
    같은 런타임 계약 검증(60개 엔드포인트 중 4개만 배선)이 이 엔드포인트엔 없다는 저장소
    전역 갭은 그대로 남아 있다 — 이번 PR 이 새로 만든 결함이 아니라 기존에 인지된 갭이다.
  - 제안: 조치 불요(기존 인지 갭). `response-contract` 배선을 넓힐 때 이 엔드포인트도 후보에
    포함.

- **[INFO]** `botIdentity` 형태가 세 곳(도메인 타입 `chat-channel/types.ts`, 입력 DTO
  `ChatChannelBotIdentityDto`, 응답 DTO `ChatChannelRotateBotIdentityDto`)에 독립 선언돼 있다.
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` (`ChatChannelConfig.botIdentity`),
    `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
    (`ChatChannelBotIdentityDto`), `codebase/backend/src/modules/triggers/dto/responses/
    chat-channel-rotate-bot-token-response.dto.ts` (`ChatChannelRotateBotIdentityDto`).
  - 상세: 세 선언은 계약이 다르다는 실측 근거(입력=optional·클라이언트 제공 가능, 응답=
    필수 필드+provider 별 부가 필드)와 저장소 선례(`TriggerWorkflowRefDto` vs
    `ScheduleTriggerWorkflowRefDto`)를 diff 자체 주석에 남겨 뒀고, 서비스 반환 타입을 도메인
    타입에 고정해 적어도 서비스↔응답 축의 드리프트는 컴파일러가 잡도록 만들었다. 계층 분리
    원칙(입력 계층/도메인 계층/응답 계층)에 부합하는 의도된 구조로 판단된다.
  - 제안: 조치 불요. 도메인 타입에 필드가 추가될 때 응답 DTO 를 손으로 따라가야 한다는
    사실만 인지하고 있을 것 — 기존 정적 가드(`dto-jsdoc-citation`·`swagger-dto-contract`)는
    "새 필드 추가 누락" 자체는 못 잡는다.

- **[INFO]** 신규 `dto-class-name-collision` 가드(`repo-guards/__tests__/
  dto-class-name-collision-guard.ts` + `.spec.ts` + fixtures 3개)는 이 PR 자신이 라운드 1에서
  만들었던 CRITICAL(동명 클래스 `ChatChannelBotIdentityDto` 재사용으로 `@nestjs/swagger` 스키마
  상호 덮어쓰기)을 영구 회귀 가드로 승격한 것이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts`
    (`exportedClassNames`/`findDtoClassCollisions`), `dto-class-name-collision.spec.ts`.
  - 상세: 기존 형제 가드(`dto-jsdoc-citation-guard.ts`, `swagger-dto-contract-guard.ts`,
    `audit-action-binding-guard.ts` 등)와 동일한 "순수 로직 파일(`*-guard.ts`) + 소비
    spec 파일(`*.spec.ts`) + `fixtures/` 격리" 관례를 그대로 따르고, 정규식이 아니라
    TypeScript AST(`ts.createSourceFile`)로 파싱해 주석/문자열 오탐을 피한다(이 저장소가
    이미 "정본 파서가 있으면 파서가 이긴다" 로 확립한 원칙과 일치). 스캔 범위를 `modules/`·
    `common/` 로 실측 제한하고 대조군(decoy) fixture 로 vacuous-test 를 막은 점도 형제 가드
    관례와 일치한다. 자기 결함을 1회성 스크립트로 확인만 하고 끝내지 않고 저장소가 계속 지니는
    정적 자산으로 전환한 점은 아키텍처 위생(fitness function 패턴) 측면에서 긍정적이다.
  - 제안: 없음(긍정적 관찰). `swagger.md §5-1` 에 이 불변식을 규약 프로즈로 등재하는 후속
    항목이 이미 트래커에 planner 축으로 별도 등재돼 있다.

- **[INFO]** `assertChatChannelInputSafe` 의 오버로드 시그니처(`mode: 'create'` ↔
  `ChatChannelConfigDto`, `mode: 'update'` ↔ `ChatChannelUpdateConfigDto`)로 판별자와 DTO 타입을
  컴파일 타임에 묶는 설계는 유지되고 있다.
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — 오버로드
    선언부와 구현부.
  - 상세: 문자열 판별자만 두면 "update 인데 생성용 DTO" 같은 짝 깨짐을 컴파일러가 못 잡는데,
    오버로드가 그 클래스를 원천 차단한다. 이번 diff 가 새로 만든 설계는 아니나(이전 세션
    도입) 헬퍼 추출 과정에서 그대로 보존됐다 — 리팩터가 기존 타입 안전성 계약을 깨지 않았음을
    확인.
  - 제안: 없음.

## 순환 의존성 · 모듈 경계

`chat-channel-input-rules.ts` 가 참조하는 외부 모듈(`../chat-channel/types` 의
`CREDENTIAL_REJECTED_CODE`/`isCredentialRejectedError`, `./entities/trigger.entity` 의
`Trigger`)은 이 diff 이전부터 있던 의존이며 이번 변경으로 새로 추가되지 않았다. `chat-channel`
모듈이 `triggers` 의 엔티티를 타입으로 참조하는 반대 방향 의존은 이미 존재하지만(이 PR 이전
커밋에서 컨트롤러 이전으로 forwardRef 순환을 해소했다고 주석이 명시), 이번 diff 는 그 경계를
건드리지 않았다. `repo-guards` 신규 파일은 `common/__test-utils__/source-scan` 의 기존 공유
유틸(`collectTsFiles`/`toPosixRelative`)을 재사용해 동일 로직 중복을 만들지 않았다. 새 순환
의존은 발견되지 않았다.

## 요약

이번 diff 는 (1) `chat-channel-input-rules.ts`/`.spec.ts` 내부의 반복 코드(에러 봉투 11곳,
이중 캐스팅 2곳)를 `throwInvalidField`/`hasField`/`rejectBlockedField` 세 헬퍼로 응집시킨 순수
구조 정리, (2) `rotateBotToken` 엔드포인트의 swagger 응답 계약을 신규 DTO + 서비스 반환 타입의
도메인 타입 고정으로 보강한 것, (3) 이 PR 자신이 라운드 1에서 낸 CRITICAL(DTO 클래스명 충돌)을
영구 정적 가드로 전환한 것으로 구성된다. 모듈 경계(순수 함수 모듈, 외부 협력자 0)·계층 분리
(입력/도메인/응답 DTO)·확장 지점(오버로드 기반 타입 안전, provider 분기 시 명시적 case 요구
주석)이 모두 잘 유지되고 있고, 새로 도입된 `repo-guards` 가드는 기존 저장소 관례(순수 로직 +
spec 분리, AST 파서, 대조군 fixture)를 정확히 재사용해 결합도를 늘리지 않는다. 유일하게 반복
관찰되는 항목(입력 검증과 출력 에러 변환이 한 파일에 공존)은 6라운드 내내 동일하게 지적됐고
매번 "분리는 spec §7 파일 트리를 건드리는 planner 축 결정" 이라는 근거로 명시적으로 유예된
상태이며, 이번 라운드에서 그 판단을 뒤집을 새로운 정보는 없다. 새로운 아키텍처 결함은 발견되지
않았다.

## 위험도

NONE
