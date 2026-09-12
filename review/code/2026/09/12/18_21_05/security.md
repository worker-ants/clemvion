# 보안(Security) 코드 리뷰

## 검토 범위 및 방법

`chat-channel-rules-cleanup` 브랜치 전체(`origin/main..HEAD`, 커밋 `18b0c6aa6`~`1e1d484c2`)의
`codebase/**` 변경 14개 파일을 대상으로 검토했다(`git diff --stat origin/main..HEAD -- codebase/`
로 확정). 프롬프트가 파일 1·2(`chat-channel-input-rules.{ts,spec.ts}`)의 diff 를 예산 초과로
생략했으므로, 저장소 워킹트리에서 `chat-channel-input-rules.ts` 전문을 직접 `Read` 하고
`triggers.controller.ts` 의 `rotateBotToken` 메서드 전문을 `origin/main` 버전과 대조했다.
저장소 파일에 아무것도 쓰지 않았다(`git status --short` 는 이 리뷰 출력 디렉터리 신규 생성만
보고).

이번 라운드는 이 세션의 7번째(누적) 보안 리뷰다 — 앞선 6라운드(`16_17_57`·`16_39_18`·
`17_02_19`·`17_23_34`·`17_39_51`·`17_52_34`)가 각각 독립적으로 검토해 전부 CRITICAL/WARNING
0·위험도 NONE 으로 수렴했고, 이번 라운드에서 코드 diff 자체는 마지막 코드 커밋(`e59141866`)
이후 변경되지 않았다(마지막 커밋 `1e1d484c2` 는 `plan/` 문서만 건드린다 — `git show --stat
1e1d484c2` 로 확인). 아래는 그 상태에 대한 독립 재검증이다.

## 발견사항

CRITICAL/WARNING 급 결함 없음. 참고용 INFO 만 남긴다.

- **[INFO]** `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe` 부재 — 이 PR 이전부터 있던 상태
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` — `rotateBotToken` 메서드
    시그니처 (`@Param('id') triggerId: string`)
  - 상세: 같은 컨트롤러의 `revokePerTriggerToken` 은 `@Param('id', ParseUUIDPipe) id: string` 을
    쓰는 반면 `rotateBotToken` 은 원문 문자열을 그대로 받는다. `git show origin/main:.../
    triggers.controller.ts` 로 대조한 결과 이 비대칭은 **이 PR 이전(`origin/main`)부터 존재**하며
    이번 diff 는 그 줄을 건드리지 않았다. 실제 위험은 낮다 — `TriggersService.findById` 가
    workspace 스코프 조회에 실패하면 `RESOURCE_NOT_FOUND` 로 귀결되므로 잘못된 형식의 `id` 가
    인가 우회로 이어지지는 않고, 최악의 경우 `TypeORM` 쿼리 파라미터 타입 불일치로 400 류 에러가
    나는 정도다. 다만 다른 형제 엔드포인트와의 일관성 결여는 사실이다.
  - 제안: 이번 diff 의 스코프 밖이며 이미 앞선 라운드들의 RESOLUTION 이월 목록에 등재돼 있다.
    재지적하지 않고 트래커 항목으로 유지 — 신규 결함으로 등재할 필요 없음.

- **[INFO]** 신규 repo-guard(`dto-class-name-collision-guard.ts`)의 `fs.readFileSync` 는 공격 표면이
  아니다
  - 위치: `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts` —
    `exportedClassNames` 함수
  - 상세: 파일 경로 인자가 `collectTsFiles(root)`(내부 테스트 유틸)가 저장소 내 고정 디렉터리
    (`modules/`·`common/`)를 순회해 만든 목록에서만 오고, 외부/사용자 입력이 이 함수에 도달할
    경로가 없다(테스트·빌드 타임 전용, 런타임 서버 코드가 import 하지 않음 — `grep -rn
    "dto-class-name-collision-guard" codebase/backend/src` 결과 `__tests__/` 밖에서 참조 없음).
    경로 탐색(path traversal) 결함으로 볼 근거 없음.
  - 제안: 없음.

- **[INFO]** 리팩터가 보안 회귀 표면을 줄이는 방향(기존 라운드 관찰 재확인)
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.ts` —
    `hasField`/`rejectBlockedField` 함수 (56~92행)
  - 상세: 종전 `Record<string, unknown>` 캐스팅 위에서 필드명을 두 번(존재 검사 + `details.field`)
    손으로 반복 기재하던 패턴을 `ChatChannelBlockedField` 리터럴 유니언 인자로 강제해, 필드명
    오타로 인한 "차단 가드가 조용히 무력화"되는 결함 클래스를 컴파일 타임 에러로 바꿨다. 신규
    회귀는 아니지만 순수 리팩터가 보안 방향으로도 개선된 사례라 기록한다.
  - 제안: 없음.

## 항목별 점검 (변경 파일 전체)

- **인젝션(SQL/XSS/커맨드/경로탐색)**: 이번 diff 는 DB 쿼리·쉘 실행·동적 파일 경로 조작을
  포함하지 않는다. 정규식(`SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX`)은 값 변경
  없이 위치만 그대로다.
- **하드코딩된 시크릿**: `chat-channel-input-rules.spec.ts`·`triggers.service.spec.ts`·
  `trigger-dto-validation.spec.ts` 의 토큰류 값은 모두 테스트 fixture(`'1:a'` 형 telegram
  더미, `botId`/`teamId`/`publicKey` 테스트값)이며, 저장소 전체 대상 시크릿 패턴
  (`AKIA`·`sk-`·`ghp_`·`xox[baprs]-` 등) grep 결과 실제 자격 증명 매치 0건.
- **인증/인가**: `rotateBotToken` 의 `@Roles('editor')`·`@WorkspaceId()`·`@CurrentUser('sub')`
  데코레이터 체인은 이번 diff 에서 변경되지 않았다. 추가된 `@ApiUnauthorizedResponse`/
  `@ApiNotFoundResponse` 는 문서화(swagger)일 뿐 실제 인가 로직에 영향 없음. 신규 응답 DTO
  (`ChatChannelRotateBotIdentityDto`/`ChatChannelRotateBotTokenDto`)에는 secret 필드가 없다
  (`botId`/`username`/`teamId`/`publicKey`/`rotatedAt`/`triggerId`/`chatChannelHealth` 뿐).
- **입력 검증**: `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/
  `assertInboundSigningPlaintextByProvider` 의 검증 로직(내부 필드 3종 차단, PATCH 비밀 금지,
  provider 별 hex 형식 강제)은 헬퍼 추출 전후로 필드명·메시지·순서가 동일함을 원본 대조로
  확인했다. `incoming.provider &&` falsy-guard 는 HTTP 경로에서 도달 불가임을
  `dto/trigger-dto-validation.spec.ts` 신규 테스트(`provider` 미지정/빈 문자열 → DTO 층
  거부)가 실측으로 뒷받침한다.
- **OWASP Top 10 기타**: 신규 엔드포인트 표면 없음(기존 `rotateBotToken` 라우트의 응답 타입/
  swagger 문서화만 변경). Mass assignment 류 위험 없음 — DTO 는 여전히 명시적 필드 화이트리스트.
- **암호화**: 해시/암호화 알고리즘 변경 없음. `inboundSigningPlaintext` 형식 검증(hex32/hex64)은
  `@workflow/chat-channel-validation` 공유 정규식을 그대로 참조(SoT 변경 없음).
- **에러 처리**: `translateSetupChannelError`(로직 미변경)는 provider 원문·URL 을 응답에 싣지
  않는 계약을 유지하며 그 계약을 고정하는 기존 테스트도 무편집이다. `RESOURCE_NOT_FOUND` 를
  "미존재 또는 워크스페이스 권한 없음"으로 뭉뚱그린 신규 swagger 설명은 리소스 존재 여부
  enumeration 표면을 늘리지 않는 방향.
- **의존성 보안**: 신규 외부 패키지 의존성 없음. `typescript` 패키지는 이미 다른 repo-guard 가
  쓰던 기존 의존성 재사용.

## 요약

이번 라운드에서 `codebase/**` diff 는 이전 라운드(`17_52_34`) 이후 추가 변경이 없고
(`1e1d484c2` 는 `plan/` 문서만 수정), 원본 소스(`chat-channel-input-rules.ts` 전문,
`triggers.controller.ts` 의 `rotateBotToken`)를 직접 열어 대조한 결과도 앞선 6라운드가 기록한
상태와 일치한다. 인가 데코레이터·시크릿 비노출 계약(SS-SE-01)·응답 계약(§5.4, provider 원문
비노출)이 모두 유지되고, 신규 응답 DTO 에는 민감 정보가 없으며, 신규 repo-guard 는 빌드/테스트
전용이라 런타임 공격 표면이 아니다. 유일한 INFO(`ParseUUIDPipe` 부재)는 `origin/main` 에도
이미 있던 상태로 이 PR 이 만든 결함이 아니며 낮은 위험도로 이미 트래커에 등재돼 있다.
CRITICAL/WARNING 없음.

## 위험도

NONE
