# 요구사항(Requirement) 리뷰 — impl-details-code-wiring (2라운드, `0710021f0` + `0fb691248`)

## 검증 방법

`codebase/backend/src/{common/utils/password.util.ts,modules/triggers/{triggers.service.ts,chat-channel-rejection-messages.const.ts,dto/chat-channel-config.dto.ts}}` 를 `Read`/`grep` 으로 직접 열어 diff 와 대조했다. `grep -n "field:"` 로 `triggers.service.ts`·`password.util.ts` 전체를 훑어 15자리(`triggers.service.ts` 13 + `password.util.ts` 2) 전부에 `code` 가 실렸는지, `field` 없는 `{ reason }`/도메인 특화 `rethrowEndpointPathConflict`(`:1852`, `TRIGGER_ENDPOINT_PATH_CONFLICT`)가 의도대로 손대지 않았는지 확인했다. `spec/5-system/2-api-convention.md §5.3`·`spec/5-system/15-chat-channel.md §5.4.1/§5.4.1.2`·`spec/conventions/error-codes.md §4.2`를 Read로 대조했다. `triggers.service.spec.ts`(`BLOCKED_FIELD_CASES` 공유 fixture, `[A]`/`[등가성]`/커버리지 단언)·`trigger-dto-validation.spec.ts`(`[등가성]`/`[A]`/`[C]`)를 직접 열어 1라운드 리뷰(`11_05_27`) W3/W4/W5 반영이 실제 소스에 반영됐는지 확인했다. 저장소에 뮤테이션을 가하지 않았다 — `git status --short`는 이 리뷰 세션 산출물(`review/code/2026/09/11/11_33_35/`) 외 변경 없음.

## 발견사항

- **[WARNING]** `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md` §5.4.1.2 가 여전히 "`details[].code` 는 **현재** 두 항목(`chatChannel`/`provider`) 모두 서비스 가드 갈래라 싣지 않는다 … 배선은 **뒤따르는 developer PR** 이 한다. **그 PR 이 머지되기 전까지** 이 문단은 '아직 안 실린다'를 서술할 뿐 '싣지 않기로 했다'가 아니다" 라고 서술하는데, 바로 이 diff(`triggers.service.ts:734,745`)가 정확히 그 두 필드에 `code: ErrorCode.INVALID_FIELD` 를 배선한다. 코드는 spec 이 스스로 선언한 계약값(§5.3 「`field` 를 실으면 `code` 도 싣는다」, `INVALID_FIELD`)을 정확히 구현했으므로 **코드는 옳다** — 문제는 §5.4.1.2 문단의 시제뿐이다. 참고로 같은 절 §5.4.1(표 위, 375행)의 동일 주제 문단은 이미 시제-중립적으로 정정돼 있어("위 「`code` 없음」은 배선 전 관측값이다") 문제가 없다 — §5.4.1.2 만 남은 갭이다.
  - 위치: `spec/5-system/15-chat-channel.md:411-416` (§5.4.1.2)
  - 상세: `plan/in-progress/impl-details-code-wiring.md` 의 "1라운드 리뷰 처분" 표(W1)가 이 정확한 항목을 1라운드(`11_05_27`)에서 이미 지적받았고, "planner 턴으로 분리 — 자기-반증형 소정정 조건 1 불성립(그 문장은 `#1316` planner 턴이 썼다)"로 올바르게 처분했다 — developer 가 spec 을 직접 고치지 않은 것은 규약 위반이 아니라 규약 준수다. 다만 이 2라운드 diff(31개 파일)에도 `spec/5-system/15-chat-channel.md` 는 포함돼 있지 않으므로, 이 코드가 머지되는 시점에 spec 은 여전히 stale 상태로 남는다.
  - 제안: 코드는 유지. 후속 planner 턴에서 §5.4.1.2 해당 문단을 §5.4.1(375행)과 동일한 패턴("배선 전 관측값 → 2026-09-11 이 PR 로 배선 완료, `code: 'INVALID_FIELD'`")으로 정정. plan 체크리스트에 이미 "트래커 앵커 문구로 지목" 항목이 있으므로 그 항목이 실제로 반영됐는지 후속 세션에서 재확인 필요.

- **[INFO]** `SecretResolverService.rotate()` 자체는 여전히 빈 값 가드가 없음 — 이번 PR 이 닫은 것은 `ChatChannelConfigDto.botToken`(DTO 계층, `@MinLength(1)`)뿐이며, 코드 주석·plan·테스트 JSDoc 모두 정확히 이 사실을 명시하고 있어 은폐된 갭이 아니다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:187-192` 주석, `plan/in-progress/impl-details-code-wiring.md` §C
  - 제안: 처분 불요(이미 추적 상태 확인).

- **[INFO]** 공백 전용 문자열(`'   '`)은 `@MinLength(1)` 로 막히지 않음 — plan·코드 주석·테스트 JSDoc(`trigger-dto-validation.spec.ts` `[C]`) 모두에 "trim 정책은 별개 결정" 이라 명시돼 스코프 아웃이 문서화돼 있다. 신규 발견 아님.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192`
  - 제안: 처분 불요.

## 1라운드(`11_05_27`) 대비 재검증 — W3/W4/W5 반영 확인

- **W3(canonical `ErrorCode.INVALID_FIELD` 미재사용)**: `triggers.service.ts` 13곳 모두 `import { ErrorCode } from '../../nodes/core/error-codes'` 를 통해 `ErrorCode.INVALID_FIELD` 참조로 전환됨(`grep` 재현, `error-codes.ts:116` 값 `'INVALID_FIELD'` 와 일치). `password.util.ts` 2곳은 리터럴 유지 + "`common/` → `nodes/` import 선례 0건, 같은 층의 `validation.pipe.ts` 도 리터럴" 근거를 직접 grep 으로 재확인했다(`common/pipes/validation.pipe.ts:13,58` 리터럴 확인, `grep -rln "from '.*nodes/core/error-codes'" codebase/backend/src/common/` 결과 0건). 근거가 실측과 일치 — 반영 확인.
- **W4(존재하지 않는 스펙 파일 인용)**: `chat-channel-rejection-messages.const.ts` 헤더 주석이 실제 두 테스트 위치(`dto/trigger-dto-validation.spec.ts` `[등가성]`, `triggers.service.spec.ts` `[등가성]`)로 정정됨 — 반영 확인.
- **W5(`it.each` fixture 중복)**: `triggers.service.spec.ts:3099` 에 `BLOCKED_FIELD_CASES` 공유 상수 신설, 두 `it.each`(`:3138`,`:3170`)가 이를 참조. 추가로 "중복 제거만으로는 손으로 적은 목록이 `CHAT_CHANNEL_BLOCKED_FIELDS` 와 어긋날 수 있다"는 자기 지적에 대해 `toEqual` 커버리지 단언(`:3118-3122`)까지 신설해, 원 WARNING 이 지적한 "6번째 필드 추가 시 drift" 위험을 상수화보다 한 단계 더 닫았다 — 반영 확인, 오히려 원 제안보다 강한 조치.

## 관점별 확인 결과

1. **기능 완전성** — `details[].code` 배선 15자리(`triggers.service.ts` 13 + `password.util.ts` 2) 전수를 grep 으로 재현, diff 와 정확히 일치. `field` 없는 6곳(`{ reason }` 2곳 확인, 나머지는 `workspaces.service.ts` 등 §5.3 명시 비대상)과 도메인 특화 코드 보유 자리(`rethrowEndpointPathConflict`)는 의도대로 미변경.
2. **엣지 케이스** — `botToken: ''`(생성, `[C]`)·`null`/`''`(PATCH, 서비스 가드 flat 경로) 양쪽 커버. `inboundSigningPlaintext` 5개 소스 자리 각각 개별 `code` 배선 확인(707/794/809/821/830 라인대).
3. **TODO/FIXME** — 신규 diff 에 없음.
4. **의도와 구현 간 괴리** — 없음. 상수 파일의 "왜 상수인가(등가성)" 설명과 실제 사용처(DTO 3곳 + PATCH DTO 2곳 + 서비스 5곳)가 일치, W4 반영 후 인용도 정확.
5. **에러 시나리오** — 모든 신규 자리가 `BadRequestException({code, message, details})` 형태를 유지, top-level `code`(`VALIDATION_ERROR`/`AUTH_CONFIG_NOT_FOUND`)와 `details[].code`(`INVALID_FIELD`)를 겹쳐 쓰지 않는다(§5.3 "둘을 겹쳐 쓰지 않는다" 준수) — `rethrowEndpointPathConflict` 만 예외적으로 도메인 코드를 쓰며 이는 §5.3 이 명시한 정당한 갈래다.
6. **데이터 유효성** — `botToken` 의 Swagger 선언(`minLength: 1`)과 검증 체인(`@MinLength(1)`) 불일치가 해소됨. `OmitType` 이 PATCH DTO 에서 그 데코레이터를 올바르게 제거해(`ChatChannelUpdateConfigDto` 직접 확인) PATCH 의 `null`/`''` 통과 요구사항과 충돌하지 않는다.
7. **비즈니스 로직** — R-CC-21 5필드 거부 로직·PATCH vs POST 분기에 동작 변경 없음(D 는 메시지 리터럴 상수 이동만, 등가성 테스트로 바이트 동일성 고정).
8. **반환값** — `validatePasswordStrength` 는 void, 모든 실패 경로에서 예외, 통과 시 무반환 — 기존 계약 유지.
9. **spec fidelity** — `2-api-convention.md §5.3`(2026-09-11 규약)의 "field 있으면 code 필수, 형태 무관" 규칙과 line-level 일치. `error-codes.md §4.2` 는 별개 파이프라인(Manual/Webhook trigger 파라미터)이라 이 변경과 무관함을 확인 — `INVALID_FIELD` 값 충돌 없음. 유일한 잔여 불일치는 위 SPEC-DRIFT(§5.4.1.2 시제).

## 요약

2라운드 diff 는 1라운드(`11_05_27`) 리뷰의 WARNING 3건(W3 canonical 상수 미재사용·W4 오류 인용·W5 fixture 중복)을 실제 소스 레벨에서 정확히 반영했고, W5 는 원 제안보다 한 단계 더 강한 커버리지 단언까지 추가했다. `details[].code` 배선 15자리는 `2-api-convention.md §5.3` 규약과 line-level 로 정확히 일치하며, `botToken` `@MinLength(1)` 은 선언-구현 간극을 정당하게 닫았고 PATCH DTO 의 `OmitType` 처리로 회귀도 없다. 기능 완전성·엣지 케이스·에러 시나리오·반환값 모두 정상이며 TODO/FIXME 는 없다. 유일한 실질 발견은 `spec/5-system/15-chat-channel.md` §5.4.1.2 의 "배선 전" 시제 문단이 이 diff 의 착지로 stale 해지는 SPEC-DRIFT(WARNING)로, developer 자신이 쓴 문장이 아니라 자기-반증형 소정정 조건 1이 불성립해 planner 턴으로 정확히 분리·기록돼 있다 — 코드를 되돌릴 사안이 아니라 후속 spec 갱신이 필요하다.

## 위험도

LOW
