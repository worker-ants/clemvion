# 보안(Security) 코드 리뷰

## 검토 범위

실제 애플리케이션 코드 변경(파일 1~9):

- `codebase/backend/src/common/utils/password.util.ts` / `.spec.ts`
- `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` (신규)
- `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`
- `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.service.ts` / `.spec.ts`
- `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts`
- `CHANGELOG.md`

나머지(`plan/in-progress/impl-details-code-wiring.md`, `review/code/2026/09/11/11_05_27/**`,
`review/consistency/2026/09/11/10_28_52/**`)는 이전 리뷰/컨시스턴시 라운드 산출물(정적
markdown/json)이며 실행 코드가 아니라 보안 관점 검토 대상에서 제외했다.

변경의 본질은 (A) 검증 실패 응답 `details[]` 원소에 `code: 'INVALID_FIELD'` 를 15자리 배선,
(B) DTO/서비스 두 층에 중복돼 있던 chatChannel 거부 메시지 리터럴을
`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 상수로 단일화, (C) `ChatChannelConfigDto.botToken` 에
`@MinLength(1)` 추가, (D) 이를 검증하는 unit/e2e 테스트 보강이다. 신규 인젝션 경로, 신규
인증/인가 로직, 신규 암호화 로직은 도입되지 않는다. `codebase/backend/src/modules/secret-store/
secret-resolver.service.ts`(rotate/store)를 직접 열어 이번 PR 이 고친 결함의 근본 원인 함수도
교차 확인했다(diff 밖 파일).

## 관측된 워킹트리 이상 상태 (내가 만들지 않음)

리뷰 도중 `git status --short` 로 확인한 결과, 이 리뷰가 시작되기 전부터 **이미 미커밋
상태로 수정돼 있던** 파일이 하나 있었다 — 나는 이 파일을 `Read` 만 했을 뿐 Write/Edit 하지
않았다:

```
 M codebase/backend/src/modules/triggers/triggers.service.ts
```

그 diff(읽기만 함, 되돌리지 않음):

```diff
@@ -1008,7 +1008,7 @@ export class TriggersService {
       throw new BadRequestException({
         code: 'AUTH_CONFIG_NOT_FOUND',
         message: 'Auth config not found in this workspace',
-        details: { field: 'authConfigId', code: ErrorCode.INVALID_FIELD },
+        details: { field: 'authConfigId' },
       });
     }
   }
```

이는 diff 가 배선한 `authConfigId` 자리의 `code: ErrorCode.INVALID_FIELD` 를 제거해 이전
상태로 되돌린 형태다 — 다른 병렬 reviewer(예: testing/mutation 검증 세션)가 진행 중인
뮤테이션 테스트의 흔적일 가능성이 높다("`authConfigId` 는 `details` 를 아예 단언하지
않았다"는 사실이 `CHANGELOG.md` 신규 항목에 이미 기록돼 있다). **내가 만든 변경이 아니며,
다른 reviewer 의 진행 중인 작업을 오염시키지 않기 위해 되돌리지 않았다.** 다음
리뷰어/오케스트레이터는 이 잔여물을 실제 코드 결함으로 오인하지 말고, 세션 종료 전 원
상태로 복원됐는지 확인이 필요하다.

## 발견사항

- **[INFO]** `botToken` 에 `@MinLength(1)` 을 추가해 닫은 갭이 `SecretResolverService.rotate()`/`store()` 자체에는 여전히 남아 있다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192`(`@MinLength(1)` 추가 줄) — 근본 원인 함수는 `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` `rotate`(129~145행)·`store`(112~126행), 이번 diff 에 포함되지 않음
  - 상세: 직접 `Read` 로 확인 — `rotate(ref, workspaceId, newPlaintext)` 는 `newPlaintext` 가 빈 문자열이어도 그대로 `encryptSecret` 후 UPSERT 한다. `store` 도 동일하게 `plaintext` 를 그대로 저장한다. 이번 PR 이 닫은 것은 `ChatChannelConfigDto.botToken`(생성 경로 DTO 계층)의 `''` 통과 문제뿐이라, 컨트롤러 방어(`rotateBotToken`)가 없는 다른 호출부가 향후 추가되면 같은 클래스의 "빈 시크릿 먼저 저장" 결함이 재발할 수 있는 구조다. plan(`plan/in-progress/impl-details-code-wiring.md` §C)이 이미 "rotate 자체의 빈 값 가드는 별개 항목"으로 명시해 뒀으므로 이번 PR 의 스코프 밖임을 인지하고 있다 — 신규 CRITICAL 아님, pre-existing 잔여 갭의 재확인.
  - 제안: 후속 항목으로 `SecretResolverService.rotate`/`store` 자체에 `newPlaintext`/`plaintext` 빈 값(및 가능하면 공백 전용) 거부를 내재화해 depth-in-defense 를 확보할 것을 권장.

- **[INFO]** `@MinLength(1)` 은 길이만 보므로 공백 전용 문자열(`'   '`)은 여전히 통과해 빈 시크릿 저장 경로가 부분적으로 남는다
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192`
  - 상세: `class-validator` 의 `@MinLength(1)` 은 `string.length >= 1` 만 검사한다. `'   '.length === 3` 이므로 통과하고, trim 되지 않은 채 `SecretResolver.rotate` 로 전달되면 사실상 빈 시크릿과 동일한 상태가 저장된다 — 증상은 이번에 고친 `''` 케이스와 동일하다. 코드 주석과 `trigger-dto-validation.spec.ts` `[C]` 테스트 JSDoc 에 이 경계가 "별개 결정으로 남겼다"고 이미 명시돼 있어 은폐된 결함은 아니다.
  - 제안: 별도 트래커 항목으로 trim 정책(`@Transform` + trim, 또는 정규식으로 공백 전용 거부) 결정을 남길 것. 이번 PR 을 막을 사유는 아니다.

- **[INFO]** 신규 상수 파일의 사용자 노출 메시지가 내부 API 경로를 그대로 안내한다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts:47-48`(`botTokenRef`), `:54-55`(`botToken`) — `POST /api/triggers/:id/chat-channel/rotate-bot-token` 인용
  - 상세: 에러 메시지가 실제 내부 라우트 경로를 문자열로 노출한다. 다만 이 라우트는 이미 Swagger 로 공개돼 있고(`triggers.controller.ts` `@ApiOperation`), 역할 기반 가드(`@Roles('editor')`)로 보호되는 뮤테이션 엔드포인트라 경로 노출 자체가 추가 공격 표면을 만들지는 않는다. 정보 노출 관점의 실질 위험 없음 — 참고용 기록.
  - 제안: 조치 불필요.

## 확인했으나 문제 없음

- `details.field`/`details.code` 에 실리는 값은 전부 화이트리스트된 필드명(`'botToken'`, `'chatChannel'` 등)과 고정 코드 문자열(`ErrorCode.INVALID_FIELD` 또는 리터럴 `'INVALID_FIELD'`)뿐이며, 실제 시크릿 값·해시·토큰 원문이 에러 응답에 실리는 자리는 없다. `triggers.service.ts:510`(`details: { field: 'type', disallowed, code: ... }`)의 `disallowed` 도 거부된 **필드 이름 배열**일 뿐 값이 아니다.
- 테스트 픽스처의 `'111:New'`, `'xoxb-fake-token'` 등은 명백한 placeholder/가짜 값이며(`triggers.service.spec.ts:1373` 등에서 `'xoxb-fake-token'` 로 이름 자체에 fake 표기), 실제 시크릿 하드코딩이 아니다.
- `password.util.ts` — `BCRYPT_ROUNDS = 12` 등 해시 알고리즘·정책 변경 없음. `validatePasswordStrength` 의 에러 메시지는 정책 설명만 담고 실제 입력 비밀번호를 반향하지 않는다.
- SQL/커맨드/경로 인젝션, LDAP 인젝션, XSS 로 이어질 수 있는 신규 입력 처리 경로 없음 — 이번 diff 는 고정 문자열 상수와 데코레이터 추가·에러 payload 필드 추가에 국한된다.
- 인증/인가 로직·세션 관리 변경 없음. `TriggersService` 의 검증 가드는 기존 분기 구조 그대로이고 `message`/`details` 리터럴만 치환됐다 — 우회 가능성이 새로 생기지 않았다.
- `@MinLength(1)` 추가는 "선언(`@ApiProperty({minLength:1})`)이 구현보다 넓었던" 방어 누락을 메우는 **보안 긍정적** 변경이며, 빈 문자열이 provider 호출 전에 secret store 에 먼저 저장되는 상태-불일치 경로를 차단한다. 15/15 자리에 대한 뮤테이션 테스트(개별 RED 확인)도 회귀 방지 측면에서 긍정적이다.
- 나(security reviewer)는 저장소 트리에 아무것도 Write/Edit 하지 않았다 — `Read`/`grep`/`Bash`(읽기 전용)만 사용했다. 위 "관측된 워킹트리 이상 상태" 절에 적은 1건은 세션 시작 시점에 이미 존재하던 남의 변경이며 내가 만든 것이 아니다.

## 요약

이번 PR 은 검증 에러 응답의 `details[].code` 배선(15자리), 거부 메시지 문자열의 DRY화, `botToken` 빈 문자열 거부(`@MinLength(1)`) 추가로 구성된 저위험 변경이다. 신규 인젝션·인증 우회·시크릿 하드코딩·암호화 약화는 없으며, `@MinLength(1)` 추가는 오히려 기존에 존재하던 "빈 시크릿 먼저 저장" 갭 하나를 막는 보안 긍정적 수정이다. 짚을 점은 두 가지 잔여 갭인데 둘 다 이번 diff 가 만든 결함이 아니라 이미 plan 에 별도 항목으로 명시된 pre-existing 잔여 갭이다: (1) `SecretResolverService.rotate()`/`store()` 자체가 여전히 빈 값을 가드하지 않아 새 호출부가 생기면 재발 가능하고, (2) `@MinLength(1)` 은 공백 전용 문자열(`'   '`)까지는 막지 못한다. 둘 다 CRITICAL/WARNING 이 아니라 후속 트래킹 대상 INFO 로 판단한다. 별도로, 세션 시작 시점에 이미 워킹트리에 남의(비-security) 미커밋 변경(`triggers.service.ts` 의 `authConfigId` `code` 제거)이 관측됐으며 — 내가 만든 것이 아니라 손대지 않고 위에 기록만 남긴다.

## 위험도

NONE
