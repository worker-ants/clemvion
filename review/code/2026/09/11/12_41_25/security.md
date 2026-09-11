# 보안(Security) 코드 리뷰

## 검토 범위

`git diff origin/main...HEAD --stat` 로 실제 코드 변경분 전체를 확인했다(프롬프트가 파일 크기
제한으로 diff 를 생략한 파일 6·7·8 포함). 애플리케이션 코드 변경은 다음 6개 파일이다:

- `codebase/backend/src/common/utils/password.util.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (신규)
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts` / `.spec.ts`
- `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`

나머지(`CHANGELOG.md`·`*.mdx` 문서·`plan/**`·`review/**`)는 실행 코드가 아니라 검토 대상에서
제외했다. `review/**` 하위 파일들은 이전 라운드(`11_05_27`·`11_33_35`·`12_00_40`)의 리뷰
산출물이며, 이 세션은 그 세 라운드 뒤 추가된 커밋(주석·문서 정정 1건, `9fcce3f47`)까지 포함한
전체 diff 를 재검증했다. 해당 커밋은 `triggers.service.ts` 에 판정 근거 주석 1블록을 추가하고
spec 파일 2곳의 인용 형식을 고쳤을 뿐, 로직·분기·리터럴 값에는 변화가 없음을 `git show` 로
직접 확인했다.

변경의 본질: (A) 검증 실패 응답 `details[]` 원소에 `code: 'INVALID_FIELD'`(또는
`ErrorCode.INVALID_FIELD`)를 15자리에 순수 additive 로 배선, (B) DTO/서비스 두 층에 중복돼
있던 chatChannel 5필드 거부 메시지 리터럴을 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 상수로
단일화, (C) `ChatChannelConfigDto.botToken` 에 `@MinLength(1)` 추가, (D) 이를 검증하는
unit/e2e 테스트 보강. 신규 인젝션 경로, 신규 인증/인가 로직, 신규 암호화 로직은 도입되지
않는다.

## 발견사항

- **[INFO]** `@MinLength(1)` 은 길이만 검사하므로 공백 전용 문자열(`'   '`)이 여전히 통과해
  "빈 시크릿을 provider 검증 전에 먼저 저장" 결함의 축소된 형태가 남는다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` (`@MinLength(1)` — `botToken` 필드)
  - 상세: `class-validator` 의 `@MinLength(1)` 은 `string.length >= 1` 만 본다. 공백 3글자는
    길이 조건을 통과해 `SecretResolverService.rotate(botTokenRef, ws, '   ')` 로 secret store 에
    먼저 저장되고, provider 호출 실패(401 → `BOT_TOKEN_INVALID`)는 그 뒤에 일어난다 — 이번
    PR 이 고친 `''` 케이스와 증상이 동일한 축소판이다. 코드 주석과
    `trigger-dto-validation.spec.ts` `[C]` 테스트 JSDoc 이 이 경계를 "trim 정책은 별개 결정으로
    스코프 아웃"이라고 이미 명시했고, `plan/in-progress/impl-details-code-wiring.md` 에도
    잔여 개선 항목으로 등재돼 있어 은폐된 결함이 아니라 **의도적으로 유예된 잔여 갭**이다.
    공백 값 자체는 기밀성·인가를 직접 훼손하지 않는다(외부 노출 없음, 저장소 오염 정도).
  - 제안: 별도 트래커 항목(이미 등재됨)을 통해 `@Transform` + trim 또는 공백-전용 거부
    정규식으로 마감할 것. 이번 PR 을 막을 사유는 아니다.

- **[INFO]** `SecretResolverService.rotate()`/`store()` 자체는 빈 값 가드가 없어, DTO 계층
  방어(`@MinLength(1)`)에만 의존하는 구조가 남는다
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (이번 diff
    범위 밖 — `rotate`/`store` 메서드를 직접 열어 확인함, 빈 문자열 가드 없음)
  - 상세: defense-in-depth 관점에서, 시크릿을 실제로 쓰는 최종 함수가 스스로 빈 값(또는
    공백)을 거부하지 않고 호출부(DTO 검증)에만 의존하면, 이번 PR 이 메운 `ChatChannelConfigDto`
    같은 개별 호출부 누락이 다른 신규 호출부에서 재발할 수 있는 구조가 유지된다.
    `plan/in-progress/impl-details-code-wiring.md` 가 이미 "rotate 자체의 빈 값 가드는 별개
    항목"으로 스코프 아웃해 뒀다 — 신규 결함이 아니라 pre-existing 잔여 갭의 재확인이다.
  - 제안: 후속 항목으로 `rotate`/`store` 내부에 빈 값(및 가능하면 공백 전용) 거부를 내재화할
    것을 권장.

- **[INFO]** 신규 상수 파일의 사용자 노출 메시지가 내부 API 경로를 그대로 안내한다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts`
    (`botTokenRef`/`botToken` 메시지 — `POST /api/triggers/:id/chat-channel/rotate-bot-token`
    경로 인용)
  - 상세: 이 라우트는 이미 Swagger 로 공개돼 있고 역할 기반 인증/인가 가드로 보호되는
    뮤테이션 엔드포인트이므로, 에러 메시지에 경로 문자열이 노출돼도 추가 공격 표면이 생기지
    않는다.
  - 제안: 조치 불필요.

## 확인했으나 문제 없음

- `details.field`/`details.code`/`details.disallowed` 에 실리는 값은 전부 고정 필드명·고정
  코드 문자열·거부된 필드 이름 배열뿐이며, 실제 시크릿 값·해시·평문 토큰이 에러 응답에 실리는
  자리는 이번 diff 에 없다.
- `password.util.ts` — `hashPassword`/`comparePassword` 는 변경되지 않았고(bcrypt, cost
  `BCRYPT_ROUNDS = 12`), diff 는 `validatePasswordStrength` 의 `details[]` 에 `code` 필드
  추가뿐이다. 에러 메시지는 정책 설명만 담고 입력 비밀번호 원문을 반향하지 않는다.
- SQL/커맨드/경로/LDAP 인젝션, XSS, ReDoS 로 이어질 수 있는 신규 입력 처리 경로 없음 — 이번
  diff 는 고정 문자열 상수·검증 데코레이터 추가·에러 payload 필드 추가에 국한된다. 정규식
  (`SLACK_SIGNING_SECRET_REGEX`/`DISCORD_PUBLIC_KEY_REGEX`)은 변경되지 않았다.
- 인증/인가 로직·세션 관리 변경 없음. `assertChatChannelInputSafe`/`assertPatchCarriesNoSecrets`/
  `assertChatChannelAlreadySetUp`/`assertInboundSigningPlaintextByProvider` 가드의 분기·순서
  자체는 `git diff` 로 직접 대조해 동일함을 확인했다 — PATCH 비밀-쓰기 차단(R-CC-21/D-1)의
  실질 방어선은 그대로다. 마지막 커밋(`9fcce3f47`)이 `authConfigId` 분기에 추가한 것은 판정
  근거를 남기는 주석뿐이고 `code: ErrorCode.INVALID_FIELD` 값 자체는 직전 라운드에서 이미
  검증됨.
- `@MinLength(1)` 추가는 "선언(`@ApiProperty({minLength:1})`)이 구현보다 넓었던" 방어 누락을
  메우는 보안 긍정적 변경이며, 빈 문자열이 provider 검증 전에 secret store 에 먼저 저장되는
  상태-불일치(요청은 실패하는데 시크릿 행은 남는 레이스)를 차단한다.
- `ChatChannelUpdateConfigDto`(PATCH DTO)는 `OmitType` 으로 부모의 `@IsString()`/`@MinLength`
  를 떼고 `@IsEmpty()` 를 새로 선언하므로, 새로 추가된 `@MinLength(1)` 이 PATCH 경로로 누출돼
  PATCH 의 `''` 통과 의도(서비스 가드가 flat 코드로 잡아야 함)를 깨지 않는다 —
  `trigger-dto-validation.spec.ts` `[C]` 테스트가 이 방향을 캐너리로 고정.
- 테스트 픽스처(`'111:New'`, `'xoxb-fake-token'`, `x.repeat(40)` 등)와 신규 상수 파일 어디에도
  실제 시크릿·API 키·자격증명 하드코딩 없음 — `sk-`/`AKIA`/`password=`/`api_key=` 패턴 grep
  결과 0건.
- 의존성 변경 없음 — 이번 diff 는 `package.json`/lockfile 을 건드리지 않는다.

## 위험도

NONE
