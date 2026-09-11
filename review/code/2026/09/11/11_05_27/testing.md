# 테스트(Testing) 리뷰 — `details[].code` 배선 + botToken MinLength + 메시지 상수화

## 발견사항

- **[INFO]** PATCH 경로의 `details.code` wire-level(e2e) 증거가 없다 — POST 생성 경로만 커버.
  - 위치: `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` (5곳, 게이트 191/247/272/348/371) — 전부 `POST /api/triggers`. `PATCH /api/triggers/:id` 의 `chatChannel` 거부 응답에 `code`가 실제 HTTP round-trip으로 나가는지 검증하는 e2e는 없다(`trigger-workflow-ref.e2e-spec.ts`의 PATCH 케이스는 `workflow` relation 재조회를 보는 것이지 에러 페이로드를 안 본다).
  - 상세: plan(`plan/in-progress/impl-details-code-wiring.md` §"e2e가 유일한 wire 증거였다")도 스스로 "그 5자리에 code를 반영"했다고만 적어, PATCH 쪽은 unit(`triggers.service.spec.ts`의 `[A]`/`[등가성]` it.each)에만 의존한다는 것을 인정하고 있다. unit은 `getResponse()`를 직접 읽어 NestJS 예외 필터의 직렬화(GlobalExceptionFilter → 실제 응답 바디 형태)를 통과하지 않는다 — 같은 PR이 "unit은 이 축을 못 본다"는 이유로 POST e2e 5곳을 새로 고정했는데, 정확히 같은 논리가 PATCH 쪽에도 적용된다.
  - 제안: 최소 1개의 PATCH e2e 케이스(`botToken` 또는 `botTokenRef`)에 `error.details`를 `toEqual`로 고정해 두 진입점(POST/PATCH) 모두 wire 레벨 증거를 갖추게 한다. CRITICAL은 아님 — unit 커버리지 자체는 두텁고, 이 PR 범위(A/B/C/D)에 명시적으로 포함되지 않은 항목이라 후속으로 미뤄도 무방.

- **[INFO]** `triggers.service.spec.ts`의 `[A]`와 `[등가성]` 두 `it.each` 블록이 픽스처·실행 로직을 통째로 중복한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`... 아니, 테스트 파일 기준 `codebase/backend/src/modules/triggers/triggers.service.spec.ts:3100-3133`([A]) 과 `:3142-3173`([등가성]) — 두 블록의 `it.each` 배열(5개 필드 fixture)과 `setup()`→`triggerRepo.findOne.mockResolvedValue`→`service.update(...)`→`try/catch` 골격이 완전히 동일하고, 마지막 `expect`만 `details` vs `message`로 갈린다.
  - 상세: 각 블록이 5개 케이스마다 `setup()`(NestJS 테스트 모듈 재컴파일)을 새로 돌리므로 동일 입력에 대해 모듈을 10회 부트스트랩한다. 두 단언(`code`+`message`)을 한 `it.each` 안에서 함께 검증하면 module 재컴파일 횟수가 절반으로 줄고, "같은 예외 하나에서 두 속성을 함께 본다"는 것이 더 명확해진다(현재는 두 테스트가 독립적으로 "우연히 같은 예외"를 두 번 재현하는 형태).
  - 제안: 한 `it.each`에서 `expect(thrown).toMatchObject({ message: ..., details: { field, code: 'INVALID_FIELD' } })` 형태로 통합. 강제 사항은 아니고 가독성/실행시간 개선 제안.

- **[INFO]** `[등가성]` 파이프 테스트가 `details` 배열 길이를 단언하지 않아, "정확히 이 필드 하나만 거부됐다"는 전제가 암묵적이다.
  - 위치: `codebase/backend/src/modules/triggers/dto/trigger-dto-validation.spec.ts:915-925` — `observed[field] = res?.details?.[0]?.message;`로 인덱스 0만 취한다.
  - 상세: `cardBody('telegram')`의 나머지 필드가 항상 유효하다는 전제 하에 안전하지만, 향후 `cardBody`가 확장되거나 다른 필드가 우연히 동시에 위반되면 `details[0]`이 의도한 필드가 아닐 수 있는데도 테스트는 조용히 통과할 수 있다(판별력 저하). `[A]` 테스트(934-941번 줄)는 같은 패턴을 쓰지만 단일 필드(`botToken`)만 다루므로 상대적으로 안전하다.
  - 제안: `expect(res?.details).toHaveLength(1)`을 등가성 루프 안에 추가하면 이 가정을 명시적으로 고정할 수 있다. 현재도 실질적으로 깨질 가능성은 낮음(LOW).

- **[INFO]** `botToken` `@MinLength(1)`이 공백 전용 문자열(`'   '`)은 막지 못한다 — 범위 밖으로 명시돼 있으나 테스트에 그 경계가 문서화돼 있지 않다.
  - 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:192`(`@MinLength(1)`), 관련 테스트 `trigger-dto-validation.spec.ts`의 `[C]` 케이스(약 957번째 줄 부근, `botToken: ''`만 검증).
  - 상세: plan 자체가 "`rotate` 자체의 빈 값 가드는 별개 항목"이라고 명시적으로 스코프 아웃했으므로 결함은 아니다. 다만 `'   '.trim() === ''`인 입력이 `SecretResolver.rotate`에 사실상 빈 시크릿으로 들어가는 것은 이번에 고친 버그(`''`)와 증상이 동일한데 테스트가 이를 언급하지 않아, 다음 사람이 "빈 문자열 문제는 다 닫혔다"고 오독할 여지가 있다.
  - 제안: `[C]` 테스트 JSDoc에 "공백 전용 문자열은 이 MinLength(1)로 안 막힌다 — 별도 미결정"이라는 한 줄을 덧붙이면 충분. 차단 사유 아님.

## 강점 (참고)

- 뮤테이션 기반 검증 방법론이 실제로 판별력을 만든다: `plan/in-progress/impl-details-code-wiring.md`의 1차 뮤테이션에서 `toMatchObject`의 재귀 부분일치 때문에 `type`/`chatChannel`/`provider`/`authConfigId` 4자리가 생존했고, 이를 실제로 `toEqual`/명시적 `details` 단언으로 보강한 흔적이 diff에 그대로 드러난다(`triggers.service.spec.ts:707-716`, `875-880`, `908-911`, `3257-3261`, `3395-3401`). "GREEN은 증거가 아니다"를 코드로 실천한 사례.
- `password.util.spec.ts`의 신규 `it.each`(길이 분기 vs 종류 분기)는 서로 다른 코드 경로를 판별하는 fixture를 명시적으로 골랐고(`'P@ss1'`=3종 충족+8자 미만, `'alllowercase'`=8자 이상+1종), JSDoc에 그 판별 근거를 남겨 다음 사람이 fixture를 훼손해도 의도를 복원할 수 있게 했다.
- DTO 층(`chat-channel-config.dto.ts`)과 서비스 층(`triggers.service.ts`)의 거부 메시지를 `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES` 단일 상수로 묶고, 양쪽 테스트가 그 상수를 리터럴 복사 없이 참조하게 만든 `[등가성]` 테스트 쌍(`trigger-dto-validation.spec.ts:915-925` ↔ `triggers.service.spec.ts:3142-3173`)은 두 층의 문면 drift를 구조적으로 봉쇄한다 — 상수만 고치면 두 곳 다 자동 갱신되고, 리터럴을 박아넣는 실수는 두 테스트 중 하나가 즉시 잡는다.
- `triggers.service.spec.ts`의 `setup()`이 매 테스트마다 `Test.createTestingModule(...).compile()`로 새 모듈을 만들어 mock을 재주입하므로 테스트 간 상태 공유가 없다 — 격리가 잘 지켜져 있다.
- 회귀 테스트 유효성: `code` 필드가 새로 추가된 응답 페이로드에 대해, 기존의 `toMatchObject` 기반 단언들(예: `triggers.service.spec.ts:3082` 근방의 `botToken 이 실리면 400`)은 부분 일치라 `code` 추가로 깨지지 않는다. 반대로 정확 일치(`toEqual`)를 쓰던 자리(e2e 5곳, `[A]`/`[등가성]` 신규 테스트)는 전부 `code`를 반영해 갱신됐다 — 갱신 누락 0건을 grep으로 확인(`toEqual`+`details` 조합 전수 대조, 관련 없는 `webhook-trigger.e2e-spec.ts`의 `endpoint_path`/`orderId`/`amount` 자리는 이 PR이 건드리지 않는 도메인 코드라 정상적으로 미변경).

## 요약

이번 변경은 15개 에러 페이로드 자리에 `code` 키를 배선하면서, 그 각각을 개별 뮤테이션(빼고-RED 확인)으로 검증하고 1차 뮤테이션에서 드러난 약한 단언(`toMatchObject` 재귀 부분일치, `details` 미단언, `.toThrow()`만 쓰는 spec)을 실제로 보강한 흔적이 코드에 남아 있어 테스트 방법론 자체가 모범적이다. DTO/서비스 두 층의 거부 메시지를 공유 상수로 묶고 그 상수를 리터럴 복사 없이 참조하는 등가성 테스트 쌍을 신설해 향후 drift를 구조적으로 막았고, `botToken` MinLength 회귀(선언보다 좁은 구현)도 새 단위 테스트로 즉시 캐너리화됐다. 남은 갭은 전부 INFO 수준이다 — PATCH 경로의 `code` wire-level e2e 증거 부재(POST만 커버), `[A]`/`[등가성]` it.each 두 블록의 픽스처 중복, 등가성 테스트의 `details.length` 미단언, 공백 전용 botToken 미커버(의도적 스코프 아웃이나 문서화 부족) — 모두 차단 사유가 아니며 후속 개선 항목으로 충분하다.

## 위험도
LOW
