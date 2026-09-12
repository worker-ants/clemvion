# 보안(Security) 코드 리뷰

## 컨텍스트 — 이번 라운드(17_39_51)는 순수 주석 수정 라운드

이 세션은 `chat-channel-rules-cleanup` PR 에 대한 5번째 리뷰 라운드다. 직전 라운드(`17_23_34`)가
낸 유일한 WARNING(문서 인용 형식 — bare `hh_mm_ss` → 전체 경로)은 커밋 `01f03524c` 로 조치됐다.
그 커밋의 실제 diff 를 직접 열어 확인한 결과:

```
codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts                        | 2 +-
codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts | 6 +++---
codebase/backend/src/modules/triggers/triggers.service.ts                                     | 2 +-
```

세 파일 모두 **주석 문자열 안의 인용 경로**(`` `/ai-review` `16_17_57` `` → `` `review/code/2026/09/12/16_17_57` ``)만 바뀌었고, 실행 코드·타입 선언·검증 로직·에러 메시지는 한 글자도 바뀌지 않았다. 따라서 이번 라운드에서 **새로 검토해야 할 보안 표면은 없다**.

## 누적 diff(전체 PR) 재확인 — 이전 라운드 판정과 달라진 것 없음

`origin/main..HEAD` 전체 diff(5개 코드 커밋)에 대해 이전 4개 라운드가 이미 CRITICAL/WARNING 을
낸 항목(스키마 이름 충돌·응답 DTO 필드 누락·bare 인용)은 전부 조치·해소됐고, 그 조치가 보안 축의
새 결함을 만들지 않았음을 아래와 같이 직접 재확인했다.

- **인가/인증**: `codebase/backend/src/modules/triggers/triggers.controller.ts` 의
  `rotateBotToken` 은 `@Roles('editor')` · `@WorkspaceId()` · `@CurrentUser('sub')` 를 그대로
  유지한다(게이트 258행 부근). 이번 PR 전체에서 이 데코레이터 체인을 건드린 diff 는 없다 —
  `@ApiUnauthorizedResponse`/`@ApiForbiddenResponse`/`@ApiNotFoundResponse` 추가는 swagger
  **문서화**일 뿐 런타임 가드 로직이 아니다.
- **시크릿 비노출**: 신규 응답 DTO
  (`codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts`)
  를 직접 열어 확인한 결과 `botToken`/`botTokenRef`/`inboundSigningRef`/`inboundSigningPlaintext`
  등 비밀 필드는 어디에도 없다 — `rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity`
  (`botId`/`username`/`teamId?`/`publicKey?`)만 있고, `publicKey` 는 주석대로 ed25519
  **공개**키라 비민감이다. `SS-SE-01`(secret-store.md §4, "응답에는 포함하지 않는다")과 정합.
- **입력 검증 로직 무변경**: `chat-channel-input-rules.ts` 전체를 다시 읽어 확인한 결과,
  차단 필드(`botTokenRef`/`inboundSigningRef`/`inboundSigning`/`botToken`/
  `inboundSigningPlaintext`) 5종에 대한 `rejectBlockedField`/`hasField`/`throwInvalidField`
  체인은 리팩터 전후로 필드명·메시지·검사 순서가 동일하며(여러 라운드가 이미 글자 단위로 대조),
  `assertChatChannelAlreadySetUp` 의 provider 전환 차단(크로스-테넌트 토큰 재사용 방지 목적,
  게이트 210-227행)도 그대로다.
- **에러 처리**: `translateSetupChannelError` (게이트 329-348행)는 provider 원문·URL 을 응답
  본문에 싣지 않고 고정 client-safe 메시지만 반환한다는 계약이 이번 diff 로 바뀌지 않았다.
- **하드코딩된 시크릿**: 신규/변경 파일 전체에서 실제 자격증명 패턴(`AKIA`/`sk-`/`ghp_`/
  `xox[baprs]-<real>` 등) grep 0건. 테스트의 `'1:a'`/`'xoxb-a'` 류는 명백한 가짜 값이다.
- **의존성**: 신규 외부 의존성 없음(`@nestjs/swagger`·`typescript` 컴파일러 API 는 기존
  저장소 의존 재사용 — 신규 `dto-class-name-collision-guard.ts` 가 쓰는 `typescript` 패키지도
  다른 repo-guard 들이 이미 사용).
- **repo-guard 신규 파일**(`dto-class-name-collision-guard.ts`/`.spec.ts` + fixtures): 파일
  경로는 호출자가 `collectTsFiles` 로 저장소 내부에서만 수집하며 외부/사용자 입력을 받지 않는다.
  `ts.createSourceFile` 파싱은 정적 분석 목적으로 신뢰된 로컬 소스만 대상이라 인젝션·경로 탐색
  표면이 없다(dev-time CI 가드, 런타임 프로덕션 코드 아님).

## 발견사항

없음 — 이번 라운드 diff(주석 인용 경로 3곳)와 누적 PR 전체 모두에서 CRITICAL/WARNING 급 보안
결함을 발견하지 못했다.

## 검증/뮤테이션 메모

이번 리뷰는 저장소 파일을 수정하지 않았다 — `Read`/`Bash`(`git show`/`git log`/`grep`/`sed -n`)
만 사용했다. `git status --short` 는 리뷰 시작 전부터 있던 `review/code/2026/09/12/17_39_51/`
(본 리뷰 출력 디렉터리) untracked 상태만 보였고, 리뷰 도중 다른 미커밋 변경(예: 과거 라운드가
보고한 `hasField` 뮤테이션 잔여물)은 관측되지 않았다.

## 요약

이번 라운드의 실제 코드 변경은 3개 파일의 주석 안 인용 경로 표기(`` /ai-review `hh_mm_ss` ``
→ `` review/code/YYYY/MM/DD/hh_mm_ss ``)뿐이며 실행 로직·타입·검증·인가·에러 메시지에 변화가
없다. 누적 PR 전체(에러 봉투 헬퍼화, `assertChatChannelInputSafe` 오버로드, 신규 응답 DTO,
repo-guard 신규 가드)를 다시 훑어도 인가 데코레이터·시크릿 처리(SS-SE-01)·응답 계약(§5.4,
provider 원문 비노출)이 모두 유지되고 있으며, 이전 라운드들이 지적한 스키마 이름 충돌·응답
필드 누락은 실측(전 DTO 클래스 256개 스캔 + 필드 단위 대조, 신규 회귀 가드까지 추가)으로
해소됐음이 재확인된다. CRITICAL/WARNING 없음.

## 위험도

NONE
