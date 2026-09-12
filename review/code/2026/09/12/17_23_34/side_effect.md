# 부작용(Side Effect) 리뷰 — chat-channel-input-rules 구조 정리 + rotateBotToken swagger 보강 (라운드 4)

## 검증 방법

`git diff origin/main..HEAD -- codebase/` 로 이 브랜치가 origin/main 대비 실제로 바꾼 13개
코드 파일 전체를 직접 열어 대조했다(프롬프트 diff 가 예산 초과로 일부 생략됐던 파일 —
`chat-channel-input-rules.ts` — 도 포함). `plan/**`·`review/**` 39개 파일은 이전 라운드
(`16_17_57`·`16_39_18`·`17_02_19`)의 산출물이 이번 커밋에 실린 것으로, 프로세스 문서이며 이번
diff 가 새로 만든 런타임 부작용 표면이 아니다.

## 발견사항

- **[INFO] 관측된 저장소 상태 이상 — 이번 diff 의 결함이 아니다, 조치 불요**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` — `hasField` 함수
    (게이트 70-72행)
  - 상세: 리뷰 도중 `git status --short` 로 확인한 결과 이 파일이 **워킹트리에서만
    미커밋 상태로 수정**돼 있었다 — `hasField` 의 판별식이 `typeof (...)[field] !== 'undefined'`
    에서 `!!(...)[field]` (truthy 판별)로 바뀌어 있다(`git diff` 로 확인, 커밋된 diff
    `origin/main..HEAD` 에는 이 변경이 없다). 이는 정확히 `plan/in-progress/chat-channel-rules-cleanup.md`
    §뮤테이션 검증과 이전 라운드 `RESOLUTION.md`(W3)·`review/code/2026/09/12/16_39_18/api_contract.md`
    가 문서화한 **동일한 뮤테이션**(`null`/`''` 가 두 층을 모두 통과하는지 보는 실험)이다 —
    16_39_18 라운드에서 이미 한 번 "다른 동시 세션이 남긴 잔여물"로 관측·기록된 바로 그 형태가
    이번 라운드에서도 다시 나타났다. 이 리뷰는 이 변경을 만들지 않았고(`Read`/`grep` 으로만
    조회), `git checkout`/`restore` 로 되돌리지도 않았다(공유 워크트리 뮤테이션 금지 규약).
    이번 리뷰의 판정은 커밋된 diff(`git diff origin/main..HEAD`)를 기준으로 했으므로 아래 판정에는
    영향이 없다.
  - 제안: 다음 사람이 이 잔여물을 이번 PR 이 만든 실결함으로 오인하지 않도록 기록만 남긴다.
    동시 진행 중인 다른 검증 세션(mutation testing)이 원복을 마치지 못한 것으로 보이며, 병렬
    리뷰 세션이 같은 워크트리를 반복 오염시키는 패턴이 재발했다는 사실 자체를 트래커에 적어 둘
    가치가 있다.

- **[INFO] 컨트롤러/서비스 반환 타입 선언 변경 — 타입 레벨 전용, 런타임·호출자 영향 없음**
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` (`rotateBotToken` 반환
    타입 `Promise<Awaited<ReturnType<TriggersService['rotateBotToken']>>>` →
    `Promise<ChatChannelRotateBotTokenDto>`), `codebase/backend/src/modules/triggers/triggers.service.ts`
    (`rotateBotToken` 리턴 객체 타입의 `botIdentity` 필드 선언을 손으로 적은 리터럴
    `{ botId: number; username: string; teamId?: string } | null` 에서
    `NonNullable<ChatChannelConfig['botIdentity']> | null` 로 교체)
  - 상세: 둘 다 컴파일 타임 타입 애노테이션만 바꾼다. `ChatChannelConfig['botIdentity']`
    (`codebase/backend/src/modules/chat-channel/types.ts:55-61`)를 직접 열어 대조한 결과 필드
    구성(`botId`·`username`·`teamId?`·`publicKey?`)이 신설 `ChatChannelRotateBotIdentityDto` 와
    정확히 일치하고, 이 타입은 이미 5번째 줄에서 import 돼 있어 신규 import 도 추가되지 않았다.
    함수 바디의 실제 반환 값(런타임 객체 형태)은 이번 diff 로 바뀌지 않는다. 두 메서드 모두
    HTTP 라우팅으로만 호출되고 직접 호출하는 내부 caller 가 없어(`grep` 확인) 시그니처 변경의
    호출자 영향은 없다.
  - 제안: 조치 불요.

- **[INFO] 공개 OpenAPI(swagger) 문서 확장 — additive-only, 기존 클라이언트 영향 없음**
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken` 데코레이터
    블록 (`@ApiUnauthorizedResponse`·`@ApiNotFoundResponse`·`@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto, ...)` 신규)
  - 상세: `POST /api/triggers/:id/chat-channel/rotate-bot-token` 이 노출하는 OpenAPI 스펙에 401/404
    응답과 200 응답 스키마가 새로 선언된다. 실제 HTTP 동작(상태 코드·응답 바디)은 이미 그렇게
    동작하고 있었다 — `TriggersService.rotateBotToken()` 은 이 PR 이전부터 동일한 필드
    (`rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity`)를 반환했다. 문서화 누락을 메우는
    것뿐이라 기존 클라이언트를 깨뜨리지 않는다.
  - 제안: 조치 불요.

- **[INFO] 파일시스템 변경 — 신규 파일 생성은 전부 명시적 import/참조로 소비되며 우발적 생성이 아니다**
  - 위치: `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts`(신규),
    `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts`(신규),
    `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision.spec.ts`(신규),
    `codebase/backend/src/repo-guards/__tests__/fixtures/dto-class-collision/{alpha,beta,decoy}.dto.ts`(신규)
  - 상세: DTO 파일은 `triggers.controller.ts` 가 import 해 실제로 사용한다. 가드 테스트 3파일은
    형제 파일(`dto-class-name-collision.spec.ts` → `dto-class-name-collision-guard.ts` → fixture
    3개)로 서로 소비 관계가 명확하다. 가드 함수(`exportedClassNames`/`findDtoClassCollisions`)는
    `fs.readFileSync`/`fs.readdirSync` 로 **읽기만** 하고 어떤 파일도 쓰거나 지우지 않는다 —
    스캔 루트도 `modules`/`common` 두 디렉터리로 유계이며 공유 유틸 `collectTsFiles` 가
    `node_modules`/`dist` 를 건너뛰므로 무한 재귀·과도한 fs 열람 위험도 없다(이 유틸 자체는
    이번 diff 의 변경 대상이 아니다).
  - 제안: 조치 불요.

- **[INFO] 헬퍼 추출(`throwInvalidField`·`hasField`·`rejectBlockedField`) — 전역/공유 상태 불변,
  module-private 로 공개 인터페이스 영향 없음**
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` (`throwInvalidField`
    56행, `hasField` 70행, `rejectBlockedField` 82행 — 커밋된 상태 기준. 위 첫 항목의 워킹트리
    잔여 뮤테이션과는 별개다)
  - 상세: `git diff origin/main..HEAD` 전체를 직접 대조한 결과 11곳의 인라인
    `throw new BadRequestException({...})` 블록이 헬퍼 호출로 치환됐을 뿐, `field`/`message`/검사
    순서(`botTokenRef → inboundSigningRef → inboundSigning`, `botToken → inboundSigningPlaintext`)
    는 원본과 완전히 동일하다. 세 함수 모두 `export` 되지 않아 모듈 바깥에서 참조할 수 없고,
    전역 변수·모듈 스코프의 가변 상태를 새로 도입하지 않는다(순수 함수, 예외 throw 만 부작용).
  - 제안: 조치 불요.

- **[INFO] 환경 변수·네트워크 호출·이벤트/콜백** — 이번 diff 어디에도 `process.env` 읽기/쓰기,
  `fetch`/`http`/외부 SDK 호출, EventEmitter/콜백 등록 변경이 없다(`grep -n "process.env"` 전
  파일 0건, adapter/네트워크 코드 무변경 — `translateSetupChannelError` 로직 자체도 이번 diff 로
  바뀌지 않았다).
  - 제안: 조치 불요.

## 요약

이번 diff(`origin/main..HEAD`, 코드 13개 파일)는 (1) `chat-channel-input-rules.ts` 의 반복
에러 봉투 생성을 `throwInvalidField`/`hasField`/`rejectBlockedField` 세 module-private 헬퍼로
추출한 동작 보존 리팩터, (2) `rotateBotToken` 엔드포인트의 swagger 응답 문서를 실제 서비스 반환
타입에 구조적으로 고정하는 additive-only 문서화, (3) DTO 클래스명 충돌을 잡는 신규 repo-guard
테스트로 구성된다. 시그니처가 바뀐 두 자리(컨트롤러 반환 타입, 서비스 `botIdentity` 필드 타입)는
모두 타입 레벨 변경이며 실제 반환 객체·호출자에 영향이 없음을 SoT 타입과 직접 대조해 확인했다.
전역 상태·환경 변수·네트워크 호출·이벤트/콜백에 대한 변경은 없고, 신규 파일은 전부 명시적으로
소비되는 의도된 추가다. 다만 리뷰 도중 `chat-channel-input-rules.ts` 의 `hasField` 가 워킹트리에서만
(커밋되지 않은 채) truthy 판별로 뮤테이션돼 있는 것을 관측했다 — 이는 이전 라운드에서도 한 번
보고된 것과 동일한 형태의 병렬 검증 세션 잔여물로 보이며, 이번 PR 의 커밋된 diff 에는 없는
변경이라 판정에는 영향을 주지 않았지만 다음 사람의 혼동을 막기 위해 기록해 둔다. 부작용 관점의
CRITICAL/WARNING 은 없다.

## 위험도

NONE
