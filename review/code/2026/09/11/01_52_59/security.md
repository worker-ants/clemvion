# 보안(Security) 코드 리뷰 — `impl-chat-channel-patch-token`

## 개요

`PATCH /api/triggers/:id` 의 `chatChannel` 서브객체가 사용자 비밀(`botToken` ·
`inboundSigningPlaintext`)을 받지 못하게 막는 `ChatChannelUpdateConfigDto` 신설(D-1)과,
`TriggersService.setupChatChannel` 의 secret 쓰기를 `storeUserSuppliedSecrets` 플래그로
게이팅하는 경로 차단(D-2)이 핵심이다. 이 PR 은 이전 라운드가 찾은 두 CRITICAL — (1) `chatChannel`
PATCH 가 `botToken` 을 필수로 요구해 R-CC-10(bot token 변경 single-path)을 우회하며 24h grace
백업·전용 audit action·`chatChannelRotatedAt` 갱신을 건너뛰던 결함, (2) 그 결함을 필드 차단만으로
고치면 `inboundSigningRef` 보존 조건이 구조적으로 항상 거짓이 되어 세 provider 모두
`ChatChannelInboundAuthenticator` 가 `if (!config.inboundSigningRef) return;` 로 인입 웹훅 서명
검증을 건너뛰는 fail-open — 을 닫기 위한 최종 상태를 담고 있다. `origin/main...HEAD -- 'codebase/**'`
전체 diff(16 파일, 1034+/170-)를 코드 레벨에서 직접 읽고 검증했다. 이번 라운드(최신 커밋
`84a6aeaa8`)의 실질 변경분은 (a) `SecretResolver.store` → `SecretResolver.rotate` 로 정정한 주석
2곳, (b) 내부 3필드(`botTokenRef`/`inboundSigningRef`/`inboundSigning`)에 대한 `null`/`''` 테스트
6조합 추가뿐이며, 런타임 분기 로직 변경은 없다.

## 발견사항

- **[INFO]** create 경로 `botToken` 에 하한 길이 검증(`@MinLength(1)`/`@IsNotEmpty()`)이 없어
  빈 문자열 토큰이 `secrets.rotate()` 로 저장될 수 있다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` —
    `ChatChannelConfigDto.botToken` (`@IsString() @MaxLength(256)` 만 있고 하한 없음)
  - 상세: create 경로는 `storeUserSuppliedSecrets: true` 로 항상
    `secrets.rotate(botTokenRef, ws, chatChannelCfg.botToken ?? '')` 를 호출한다
    (`triggers.service.ts` `setupChatChannel` `[쓰기 ①]`, 약 1122행). `botToken: ''` 을 보내면
    `@IsString()` 은 통과하고 `SecretResolver.rotate` 자체에도 빈 값 가드가 없다(이 PR 의 커밋
    서사가 R-CC-21 "처방의 함정" 으로 이미 명시). 다만 이는 비밀 유출이 아니라 가용성(봇이
    401 로 죽음) 문제이고, 여러 이전 라운드(`review/code/2026/09/10/23_55_23/RESOLUTION.md`
    보류 항목 · `review/code/2026/09/11/00_21_55/SUMMARY.md` · `review/code/2026/09/11/01_27_26/security.md`)
    에서 이미 식별·중앙 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)
    등재·스코프 밖 판정이 난 사전 존재 결함이다. 이번 diff 가 새로 만들거나 악화시키지 않았다.
  - 제안: 등재된 후속 항목 유지 — 이번 PR 을 막을 사유 아님.

- **[INFO]** 동시 PATCH 인터리빙이 이번 PR 이 닫은 fail-open 을 단일 요청이 아닌 동시성 경로로
  이론상 재현할 여지 (사전 존재 설계, CCH-SE-01)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()`(재조회~`save()`
    구간, 낙관적 잠금 없음) · `setupChatChannel()`(첫 `save()` 커밋과 별도 `triggerRepository.update()`
    사이 원자성 없음)
  - 상세: `previousInboundSigningRef` 보존 로직은 단일 요청 안에서는 정확하다 — 병합 전에
    `trigger.config.chatChannel.inboundSigningRef` 를 캡처해 `setupChatChannel` 인자로 넘기고
    (526행), `inboundSigningRefSurvives = providerIssuedStored || Boolean(preservedInboundSigningRef)`
    (1174행)가 성공·실패(catch) 양쪽 경로에서 동일하게 적용된다. 그러나 같은 트리거에 대한 두
    PATCH 가 `findById → save()` 를 인터리빙하면 나중 커밋이 먼저 요청의 `config` 갱신을 덮어써
    `inboundSigningRef` 가 다시 사라질 수 있다. 이 PR 이 새로 만든 문제가 아니라 이미 여러 라운드
    (`review/code/2026/09/11/01_27_26/security.md` 포함)에서 독립적으로 지적·중앙 트래커에 수렴
    예외로 defer 확정된 사안이다.
  - 제안: 실제 동시 PATCH 트래픽이 관측되면 advisory lock 또는 `SELECT ... FOR UPDATE` 도입
    우선순위화(이미 등재됨). 이번 PR 을 막을 사유 아님.

## 확인한 것 — 문제 없음 (긍정적 검증)

- **비밀 필드 차단이 방어 심층화(defense-in-depth) 로 구성돼 있고 경계에 구멍이 없다.**
  `ChatChannelUpdateConfigDto.botToken`/`inboundSigningPlaintext` 는 `@IsEmpty()` 로 DTO 계층
  1차 차단, `null`/`''` 처럼 `@IsEmpty()` 를 통과하는 값은 서비스 계층 `assertPatchCarriesNoSecrets`
  (695행)가 `typeof carried.<field> !== 'undefined'` 로 다시 잡는다. `typeof null === 'object'`,
  `typeof '' === 'string'` 이라 둘 다 `!== 'undefined'` 로 걸리고, 필드를 아예 안 보낸(`undefined`)
  경우만 통과한다 — 실제 `ChatChannelCard` 요청 바디(`uiMapping`/`rateLimitPerMinute`/`languageLocale`
  만 포함)와 정확히 일치한다. `trigger-dto-validation.spec.ts` 의 `[실측]` 테스트로 이 두 계층
  경계를 직접 코드로 검증했다.
- **내부 전용 필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`)가 create/update 양쪽,
  그리고 `null`/`''` 값까지 포함해 차단된다.** `assertChatChannelInputSafe` (636행)는 mode 무관
  공통 검사로 세 필드를 막고, 최신 커밋(`84a6aeaa8`)이 `triggers.service.spec.ts` 에 이 세 필드
  × `null`/`''` 6조합을 추가해 뮤테이션 검증(같은 typeof 가드를 falsy 체크로 완화 → RED)까지
  확인했다. 이 필드들이 뚫리면 사용자가 임의 `botTokenRef` 문자열로 다른 트리거/워크스페이스의
  secret store 참조를 가리키게 하는 시도가 가능했겠지만, 그 표면이 막혀 있다.
- **provider 전환·최초 chatChannel 부착이 PATCH 로 불가능하도록 신설된
  `assertChatChannelAlreadySetUp`** (722행)이 크로스-provider 토큰 혼선을 막는다 —
  `botTokenRef` 는 trigger id 로만 재유도되므로, provider 전환을 허용했다면 새 adapter 가 이전
  provider 용으로 저장된 토큰(평문은 옛 provider 것)을 그대로 사용해 외부 API 를 호출하는
  오동작 표면이 열렸을 것이다.
- **오버로드 시그니처(632~647행)로 `mode` 문자열 판별자와 DTO 타입을 컴파일 타임에 결속** —
  `mode: 'update'` 인데 생성용 DTO(`botToken` 필수)를 넘기는 짝 어긋남을 타입 체커가 잡아,
  이 함수가 지키는 보안 불변식(D-1/D-2 게이팅)이 캐스팅으로 조용히 우회되는 회귀를 원천 차단한다.
- **워크스페이스 격리 유지.** `update()`는 여전히 `this.findById(id, workspaceId)` 로 스코핑된
  트리거만 로드하고, 신규 검증(`assertChatChannelAlreadySetUp`)은 이미 로드된 트리거 객체만
  참조한다 — 테넌트 경계를 우회하는 신규 경로 없음. 컨트롤러 쪽도 `@Patch(':id')` +
  `@Roles('editor')` + `@WorkspaceId()` 데코레이터가 그대로 유지된다(`triggers.controller.ts`).
- **SQL 인젝션 표면 없음.** 모든 DB 접근이 TypeORM `Repository` 파라미터화 쿼리이고, 신규 raw
  query·마이그레이션 없음.
- **신규 하드코딩 시크릿 없음.** `git diff origin/main...HEAD -- 'codebase/**'` 전체를
  `xoxb-`/`AKIA`/PEM 헤더/`sk-`/`ghp_` 등 시크릿 패턴으로 스캔했고 매치 없음. 테스트 파일의
  `botToken: '111:fake'`/`'xoxb-fake'` 류는 명백한 placeholder(`fake` 접미) 다.
- **에러 메시지에 민감정보 노출 없음.** 신설된 `BadRequestException` 3종
  (`assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`)은 필드명·정책 안내만 담고,
  실제 토큰 값이나 secret store 참조 원문을 echo 하지 않는다. `recordAudit` 도 `{ type }` 만
  기록해 비밀을 감사 로그에 남기지 않는다(§5.4 감사 로그 유출 수정 `#1288` 과 같은 축에서 재확인).
  Swagger `description` (컨트롤러 `@ApiBadRequestResponse`)도 필드명·에러 형식만 서술하고
  구현 내부 서사(왜 `OmitType` 인지 등)는 `//` 주석으로 옮겨져 공개 OpenAPI 로 새지 않는다
  (`chat-channel-config.dto.ts` 363행 주석 참조).
- **신규 의존성/라이브러리 없음.** `package.json`/lock 파일 변경 0건 — 새 심볼(`OmitType` 등)은
  전부 기존 고정 버전 패키지의 export.
- **암호화/해시 알고리즘 변경 없음, 평문 전송 신규 표면 없음.** secret 은 여전히
  `SecretResolver`/secret store 경유로만 왕복하고, 이번 diff 는 "언제 그 경로를 타는가"만
  바꾼다.
- **문서(mdx) 정정이 사용자에게 실제 계약과 일치하는 안내를 준다.** 종전에 존재하지 않던 필드명
  (`botTokenRef` 를 사용자 입력 필드처럼 서술)을 정정해 `botToken`/`chatChannel.botToken` 으로
  바로잡았다 — 오래된 오문서가 사용자를 혼란시키는 방향(예: 실제로 막힌 필드명을 몰라 잘못된
  필드로 재시도)의 위험을 줄인다.

## 요약

이 PR 은 사전 존재 CRITICAL 두 건(비밀 회전 single-path 우회, 인입 웹훅 서명 fail-open)을 닫는
수정의 최종 상태이며, `origin/main...HEAD` 전체 diff 를 직접 대조한 결과 두 CRITICAL 이 코드
레벨에서 실제로 해소돼 있고 DTO 계층(`@IsEmpty`)·서비스 계층(`assertPatchCarriesNoSecrets`)의
이중 방어가 `null`/`''` 우회 경로까지 정확히 상호 보완함을 확인했다. 내부 전용 필드 차단(3필드 ×
null/빈 문자열까지 포함)과 provider 전환 차단이 크로스-리소스 토큰 혼선 표면을 추가로 막고,
워크스페이스 격리·SQL 인젝션·하드코딩 시크릿·에러 메시지 정보노출·신규 의존성·암호화 축에서
새로 발견된 결함은 없다. 남은 두 INFO(create 경로 빈 문자열 토큰 허용, 동시 PATCH 시 lost update
로 인한 이론적 fail-open 재현 가능성)는 이번 PR 이 만든 문제가 아니라 여러 라운드에 걸쳐 이미
식별·중앙 트래커에 등재되고 스코프 밖으로 확정된 사전 존재 설계이며, 이번 PR 을 막을 사유가
아니다. 뮤테이션 검증(내부 3필드 typeof 가드 완화 → RED)까지 최신 커밋에서 추가돼 회귀 방지
근거도 코드로 고정돼 있다.

## 위험도

LOW
