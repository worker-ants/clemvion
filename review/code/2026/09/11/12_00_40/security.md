# 보안(Security) 코드 리뷰

## 검토 범위

실제 애플리케이션 코드 변경:

- `codebase/backend/src/common/utils/password.util.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (신규)
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts` / `.spec.ts`
- `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`
- `CHANGELOG.md` / `*.mdx` 문서

`plan/in-progress/impl-details-code-wiring.md`, `review/code/2026/09/11/11_05_27/**`,
`review/code/2026/09/11/11_33_35/**`, `review/consistency/2026/09/11/10_28_52/**` 는 이전
리뷰/컨시스턴시 라운드 산출물(정적 markdown/json)이며 실행 코드가 아니라 보안 관점 검토
대상에서 제외했다. `git diff origin/main -- codebase/backend/src/modules/triggers/triggers.service.ts`
로 실제 코드 diff 전문을 직접 확인했다(프롬프트에서는 파일 크기 제한으로 생략되어 있었음).

변경의 본질은 (A) 검증 실패 응답 `details[]` 원소에 `code: ErrorCode.INVALID_FIELD` 를 15자리
배선(순수 additive, 값 자체는 변경 없음), (B) DTO/서비스 두 층에 중복돼 있던 chatChannel
거부 메시지 리터럴을 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 상수로 단일화, (C)
`ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 추가(빈 문자열 시크릿이 provider 검증
전에 먼저 저장되던 결함 수정), (D) 이를 검증하는 unit/e2e 테스트 보강이다. 신규 인젝션
경로, 신규 인증/인가 로직, 신규 암호화 로직은 도입되지 않는다.

`triggers.service.ts` 의 `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/
`assertChatChannelAlreadySetUp`/`assertInboundSigningPlaintextByProvider` 가드 로직 자체(문자열
리터럴이 아닌 분기·순서·오버로드)는 이번 diff 로 바뀌지 않았음을 `git diff` 로 직접
확인했다 — PATCH 비밀-쓰기 차단(R-CC-21/D-1)의 실질 방어선은 그대로다.

## 발견사항

- **[INFO]** `@MinLength(1)` 은 길이만 검사하므로 공백 전용 문자열(`'   '`)이 여전히 통과해
  "빈 시크릿을 provider 검증 전에 먼저 저장" 결함의 축소된 형태가 남는다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192`(`@MinLength(1)`)
  - 상세: `class-validator` 의 `@MinLength(1)` 은 `string.length >= 1` 만 본다. `'   '.length === 3`
    이므로 통과해 `SecretResolver.rotate(botTokenRef, ws, '   ')` 로 공백 문자열이 secret store 에
    먼저 저장되고, provider 호출(401 → `BOT_TOKEN_INVALID`)은 그 뒤에 실패한다 — 이번 PR 이
    고친 `''` 케이스와 증상이 동일하다. 다만 코드 주석과 `trigger-dto-validation.spec.ts` `[C]`
    테스트 JSDoc 이 이 경계를 "trim 정책은 별개 결정으로 스코프 아웃"이라고 이미 명시했으므로
    은폐된 결함이 아니라 **의도적으로 유예된 잔여 갭**이다. 공백 값 자체가 기밀성·인가를
    직접 훼손하지는 않으며(외부 노출 없음, 저장소 오염 정도), 신규 CRITICAL/WARNING 은 아니다.
  - 제안: 별도 트래커 항목으로 trim 정책(`@Transform` + trim, 또는 공백-전용 거부 정규식)
    결정을 남길 것. 이번 PR 을 막을 사유는 아니다(이미 plan 문서·CHANGELOG 에 스코프 아웃으로
    기록됨).

- **[INFO]** `SecretResolverService.rotate()`/`store()` 자체는 빈 값 가드가 없어, DTO 계층
  방어(`@MinLength(1)`)에 의존하지 않는 새 호출부가 추가되면 같은 클래스의 결함이 재발할 수
  있는 구조가 여전히 남는다
  - 위치: 근본 원인 함수는 `codebase/backend/src/modules/secret-store/secret-resolver.service.ts`
    (이번 diff 밖 — `rotate`/`store`). 이번 PR 은 `ChatChannelConfigDto.botToken`(생성 경로 DTO
    계층) 한 자리만 닫았다.
  - 상세: defense-in-depth 관점에서 시크릿을 실제로 쓰는 최종 함수가 스스로 빈 값을 거부하지
    않고 호출부(DTO 검증)에만 의존하는 구조는, 이 PR 처럼 한 호출부의 방어가 누락됐던 사례가
    보여주듯 다른 호출부에서도 반복될 수 있는 설계다. `plan/in-progress/impl-details-code-wiring.md`
    가 이미 "rotate 자체의 빈 값 가드는 별개 항목"으로 스코프 아웃해 뒀다 — 신규 결함 아님,
    pre-existing 잔여 갭의 재확인.
  - 제안: 후속 항목으로 `rotate`/`store` 내부에 빈 값(및 가능하면 공백 전용) 거부를 내재화할
    것을 권장.

- **[INFO]** 신규 상수 파일의 사용자 노출 메시지가 내부 API 경로를 그대로 안내한다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
    (`botTokenRef`/`botToken` 메시지 — `POST /api/triggers/:id/chat-channel/rotate-bot-token` 인용)
  - 상세: 이 라우트는 이미 Swagger 로 공개돼 있고 역할 기반 가드로 보호되는 뮤테이션
    엔드포인트라, 에러 메시지에 경로 문자열이 노출돼도 추가 공격 표면이 생기지 않는다.
    실질적 정보 노출 위험 없음.
  - 제안: 조치 불필요.

## 확인했으나 문제 없음

- `details.field`/`details.code` 에 실리는 값은 전부 고정 필드명(`'botToken'` 등)과 고정 코드
  문자열(`ErrorCode.INVALID_FIELD`)뿐이며, 실제 시크릿 값·해시·토큰 원문이 에러 응답에 실리는
  자리는 없다. `triggers.service.ts` 의 `details: { field: 'type', disallowed, code: ... }` 의
  `disallowed` 도 거부된 **필드 이름 배열**일 뿐 값이 아니다.
- 테스트 픽스처(`'111:New'`, `'xoxb-fake-token'`, `'secret://x'` 등)는 명백한 placeholder/가짜
  값이며 실제 시크릿 하드코딩이 아니다 — `git diff origin/main` 으로 신규 추가된 모든
  token/secret 유사 문자열을 확인.
- `password.util.ts` — 해시 알고리즘·정책 변경 없음(diff 는 `details[]` 에 `code` 필드
  추가뿐). `validatePasswordStrength` 에러 메시지는 정책 설명만 담고 실제 입력 비밀번호를
  반향하지 않는다.
- SQL/커맨드/경로 인젝션, LDAP 인젝션, XSS, ReDoS 로 이어질 수 있는 신규 입력 처리 경로 없음
  — 이번 diff 는 고정 문자열 상수·데코레이터 추가·에러 payload 필드 추가에 국한된다. 정규식
  (`SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX`)은 이번 diff 로 변경되지 않았다.
- 인증/인가 로직·세션 관리 변경 없음. `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`
  등 가드의 **분기 구조 자체**는 `git diff` 로 직접 대조해 동일함을 확인했고, `message`/`details`
  리터럴만 치환·additive `code` 필드 추가만 있었다 — 우회 가능성이 새로 생기지 않았다.
- `@MinLength(1)` 추가는 "선언(`@ApiProperty({minLength:1})`)이 구현보다 넓었던" 방어 누락을
  메우는 **보안 긍정적** 변경이며, 빈 문자열이 provider 호출 전에 secret store 에 먼저
  저장되는 상태-불일치 경로(요청은 실패하는데 시크릿 행은 남는 레이스)를 차단한다. 15/15
  자리에 대한 개별 뮤테이션 RED 확인(테스트 JSDoc 기록)도 회귀 방지 측면에서 긍정적이다.
- `ChatChannelUpdateConfigDto`(PATCH DTO)는 `OmitType` 으로 부모의 `@IsString()`/`@MinLength`
  를 떼고 `@IsEmpty()` 를 새로 선언하므로, 이번에 추가된 `@MinLength(1)` 이 PATCH 경로로
  누출돼 `''` 를 거부하는 의도(= PATCH 는 `''` 를 통과시켜 서비스 가드가 flat 코드로 잡아야
  함)를 깨지 않는다 — `trigger-dto-validation.spec.ts` `[C]` 테스트가 이 방향을 캐너리로 고정.
- 세션 시작 시점 `git status --short` 확인 결과 워킹트리 이상 상태 없음(직전 라운드
  `review/code/2026/09/11/11_33_35/security.md` 가 보고했던 `authConfigId` 의 `code` 필드
  누락 anomaly는 현재 코드에 정상 복원되어 있음을 직접 `sed`/`grep` 으로 재확인). 이번
  리뷰에서 나(security reviewer)는 저장소 트리에 아무것도 Write/Edit 하지 않았다.

## 요약

이번 PR 은 검증 에러 응답의 `details[].code` 배선(15자리, 순수 additive), 거부 메시지
문자열의 DRY 화, `botToken` 빈 문자열 거부(`@MinLength(1)`) 추가로 구성된 저위험 변경이다.
신규 인젝션·인증 우회·시크릿 하드코딩·암호화 약화는 없으며, `@MinLength(1)` 추가는 오히려
기존에 존재하던 "빈 시크릿을 provider 검증 전에 먼저 저장" 결함 하나를 닫는 보안 긍정적
수정이다(요청 실패 시에도 시크릿 행이 남던 상태-불일치 제거). PATCH 가 비밀을 쓰지 못하게
막는 핵심 가드(`assertPatchCarriesNoSecrets` 등)의 분기 구조는 이번 diff 로 변경되지 않았음을
`git diff` 로 직접 확인했다. 남는 항목은 전부 INFO 수준의 pre-existing 잔여 갭이다: (1)
`@MinLength(1)` 이 공백 전용 문자열까지는 막지 못함(의도적으로 스코프 아웃, 문서화됨), (2)
`SecretResolverService.rotate`/`store` 자체가 여전히 빈 값을 가드하지 않아 새 호출부가 생기면
같은 클래스의 결함이 재발할 수 있는 구조, (3) 거부 메시지가 내부 라우트 경로를 그대로
노출하지만 이미 공개 Swagger 경로라 실질 위험 없음. CRITICAL/WARNING 급 보안 결함은
발견되지 않았다.

## 위험도

NONE
