# 보안(Security) 코드 리뷰 — `impl-chat-channel-patch-token`

## 개요

이번 PR 은 `PATCH /api/triggers/:id` 의 `chatChannel` 서브객체가 사용자 비밀
(`botToken`·`inboundSigningPlaintext`)을 받지 못하게 막는 `ChatChannelUpdateConfigDto` 신설(D-1)과,
`TriggersService.setupChatChannel` 의 secret 쓰기를 `storeUserSuppliedSecrets` 플래그로 게이팅하는
경로 차단(D-2)이 핵심이다. 이 PR 자체가 이전 라운드에서 발견된 두 CRITICAL — (1) `chatChannel` PATCH
가 `botToken` 을 필수로 요구해 R-CC-10 (bot token 변경 single-path) 을 우회하며 24h grace 백업·전용
audit action·`chatChannelRotatedAt` 갱신을 건너뛰던 결함, (2) 그 결함을 필드 차단(D-1)만으로 고치면
`inboundSigningRef` 보존 조건이 구조적으로 항상 거짓이 되어 세 provider 모두
`ChatChannelInboundAuthenticator` 가 `if (!config.inboundSigningRef) return;` 로 인입 웹훅 서명 검증을
건너뛰는 fail-open — 을 닫기 위한 fix 다. `origin/main...HEAD` 전체 diff(`codebase/**` 15개 파일,
1018+/166-)를 직접 읽고 아래를 확인했다.

## 발견사항

- **[INFO]** create 경로 `botToken` 에 `@MinLength(1)`/`@IsNotEmpty()` 가 없어 빈 문자열 토큰이
  `secrets.rotate()` 로 저장될 수 있다 (이번 PR 이 PATCH 경로에 대해 정확히 막은 것과 같은 클래스의
  문제가 POST 경로에는 남아 있음)
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` — `ChatChannelConfigDto.botToken` (`@IsString() @MaxLength(256)` 만 있고 하한 검증 없음, `provider` 필드 바로 아래)
  - 상세: create 경로는 `storeUserSuppliedSecrets: true` 로 항상 `secrets.rotate(botTokenRef, ws, chatChannelCfg.botToken ?? '')` 를 호출한다(`triggers.service.ts` `setupChatChannel` `[쓰기 ①]`). `botToken: ''` 을 보내면 `@IsString()` 은 통과하고 `secrets.rotate` 에도 빈 값 가드가 없어(같은 PR 의 커밋 서사가 그 사실을 R-CC-21 「처방의 함정」으로 직접 언급) 빈 토큰이 "활성"으로 저장된다. 다만 이는 비밀 유출이 아니라 가용성(봇이 401 로 죽음) 문제이고, 이전 라운드(`review/code/2026/09/10/23_55_23/RESOLUTION.md` 보류 항목, `review/code/2026/09/11/00_21_55/SUMMARY.md` INFO#1)에서 이미 식별·중앙 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 등재·스코프 밖 판정이 났다. 재확인 목적으로만 기재 — 신규 결함 아님.
  - 제안: 후속 PR 에서 `@MinLength(1)` 또는 provider 별 정규식 추가 검토(이미 등재됨, 이번 PR 을 막을 사유 아님).

- **[INFO]** 동시 PATCH 로 인한 `trigger.config`(JSONB) lost update 가 이번 PR 이 막은 fail-open 을
  단일 요청 기준이 아닌 동시성 경로로 재현할 이론적 여지
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `update()`(트리거 재조회~`save()` 구간, 낙관적 잠금 없음) · `setupChatChannel()` (첫 `save()` 커밋과 별도 `triggerRepository.update()` 사이 원자성 없음)
  - 상세: `previousInboundSigningRef` 보존 로직은 단일 요청 안에서는 올바르게 작동함을 확인했다(코드 직접 대조 — 병합 전에 `trigger.config.chatChannel.inboundSigningRef` 를 캡처해 인자로 전달, `inboundSigningRefSurvives = providerIssuedStored || Boolean(preservedInboundSigningRef)`). 그러나 같은 트리거에 대한 두 PATCH 가 동시에 `findById` → `save()` 를 인터리빙하면 나중에 커밋되는 요청이 먼저 요청의 `config` 갱신을 덮어써 `inboundSigningRef` 가 다시 사라질 수 있다. 이는 이번 PR 이 새로 만든 문제가 아니라 사전 존재 설계(CCH-SE-01, best-effort 2단계 커밋)이고, 이미 3라운드에 걸쳐 독립적으로 지적·중앙 트래커에 defer 확정된 사안이다.
  - 제안: 실제 동시 PATCH 트래픽이 관측되면 advisory lock 또는 `SELECT ... FOR UPDATE` 도입을 우선순위화(이미 등재됨).

## 확인한 것 — 문제 없음 (긍정적 검증)

- **비밀 필드 차단이 방어 심층화(defense-in-depth) 로 되어 있다.** `ChatChannelUpdateConfigDto.botToken`/`inboundSigningPlaintext` 는 `@IsEmpty()` 로 DTO 계층에서 1차 차단되고, `null`/`''` 처럼 `@IsEmpty()` 를 통과하는 값은 서비스 계층 `assertPatchCarriesNoSecrets` 가 `typeof carried.<field> !== 'undefined'` 로 다시 잡는다 — `undefined`(필드 미전송)만 통과한다. 직접 대조로 두 계층의 판정 경계가 정확히 상호 보완적임을 확인했다(경계에 구멍 없음).
- **내부 전용 필드(`botTokenRef`·`inboundSigningRef`·`inboundSigning`)가 create/update 양쪽에서 외부 입력으로부터 차단된다** (`assertChatChannelInputSafe`, mode 무관 공통 검사). 이게 없었다면 사용자가 임의 `botTokenRef` 문자열을 실어 다른 트리거/워크스페이스의 secret store 참조를 가리키게 하는 시도가 가능했겠지만, 그 표면이 막혀 있다.
- **provider 전환·최초 chatChannel 부착이 PATCH 로 불가능하도록 신설된 `assertChatChannelAlreadySetUp`** 이 크로스-provider 토큰 혼선을 막는다 — `botTokenRef` 는 trigger id 로만 재유도되므로, provider 전환을 허용했다면 새 adapter 가 이전 provider 용으로 저장된 토큰(평문은 옛 provider 것)을 그대로 사용해 외부 API 를 호출하는 오동작 표면이 열렸을 것이다. 이 검사가 그 경로를 원천 차단한다.
- **워크스페이스 격리 유지.** `update()` 는 여전히 `this.findById(id, workspaceId)` 로 스코핑된 트리거만 로드하고, 새로 추가된 검증(`assertChatChannelAlreadySetUp`)은 이미 로드된 트리거 객체만 참조한다 — 테넌트 경계를 우회하는 신규 경로 없음.
- **SQL 인젝션 표면 없음.** 모든 DB 접근은 TypeORM `Repository` 의 파라미터화 쿼리이고, 이번 diff 는 신규 raw query·마이그레이션을 도입하지 않는다.
- **신규 하드코딩 시크릿 없음.** `git diff origin/main...HEAD -- 'codebase/**'` 전체를 시크릿 패턴으로 스캔했고, 테스트 파일의 `botToken: '111:fake'`/`'xoxb-fake'` 류는 명백한 placeholder 값이다(진짜 시크릿 형식과 다르고 `fake` 접미).
- **에러 메시지에 민감정보 노출 없음.** 신설된 `BadRequestException` 3종(`assertPatchCarriesNoSecrets`, `assertChatChannelAlreadySetUp`)은 필드명·정책 안내만 담고, 실제 토큰 값이나 secret store 참조 원문을 echo 하지 않는다.
- **공개 API 문서(Swagger) 로의 내부 서사 유출을 스스로 발견·수정.** `ChatChannelUpdateConfigDto` 클래스 JSDoc 에 있던 구현 경위 설명("왜 OmitType 인가" 등)이 `introspectComments` 플러그인을 통해 공개 OpenAPI `description` 에 실리고 있던 것을 확인·`//` 주석으로 이동(커밋 `464f2ba1a`). 실제 시크릿이나 인프라 정보 유출은 아니었으나(구현 의사결정 서사 수준), 공개 스키마 최소 노출 원칙에 부합하는 방향의 수정이다.
- **신규 의존성/라이브러리 없음.** `package.json`/lock 파일 변경 0건 — 새 심볼은 전부 기존 고정 버전 패키지(`@nestjs/swagger`, `class-validator` 등)의 export.
- **암호화/해시 알고리즘 변경 없음, 평문 전송 신규 표면 없음** — secret 은 여전히 `SecretResolver`/secret store 경유로만 왕복하고, 이번 diff 가 다루는 것은 "언제 그 경로를 타는가"(게이팅)이지 그 경로 자체의 암호화 방식이 아니다.

## 요약

이 PR 은 두 개의 사전 존재 CRITICAL(비밀 회전 single-path 우회, 인입 웹훅 서명 fail-open)을 닫기
위한 수정이며, `origin/main...HEAD` 전체 diff 를 직접 대조한 결과 두 CRITICAL 이 실제로 코드 레벨에서
해소되어 있음을 확인했다. DTO 계층(`@IsEmpty`)과 서비스 계층(`assertPatchCarriesNoSecrets`)의 이중
방어가 `null`/`''` 우회 경로까지 정확히 상호 보완하고, 내부 전용 필드 차단과 provider 전환 차단이
크로스-리소스 토큰 혼선 표면을 추가로 막는다. 워크스페이스 격리·SQL 인젝션·하드코딩 시크릿·에러
메시지 정보노출·신규 의존성 축에서 새로 발견된 결함은 없다. 남은 두 항목(create 경로 빈 문자열
토큰 허용, 동시 PATCH 시 lost update 로 인한 이론적 fail-open 재현 가능성)은 이번 PR 이 만든 문제가
아니라 여러 라운드에 걸쳐 이미 식별·중앙 트래커에 등재되고 스코프 밖으로 확정된 사전 존재 설계이며,
이번 PR 을 막을 사유가 아니다.

## 위험도

LOW
