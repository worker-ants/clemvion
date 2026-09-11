# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 2건(모두 문서/테스트 정합성 사안, 동작 결함 아님), SPEC-DRIFT 1건(코드가 spec 을 이미 앞섰음 — planner 정정 대기). forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 누락된 강제 reviewer 없음.

이번 세션은 `details[].code`(§5.3) 15자리 배선 + `chatChannel` 거부 메시지 상수화(D) + `botToken` `@MinLength(1)` 추가(C)를 다루는 PR 의 **4번째** `/ai-review` 라운드다. 14개 reviewer 전원이 성공했고 전문을 모두 확보했다. 앞선 3라운드가 지적한 WARNING(설명 문자열 중복·인용 규약 위반·`assertAuthConfigInWorkspace` 근거 부재)은 이번 라운드가 검토한 diff 안에서 이미 코드/주석으로 해소된 상태로 확인됐다.

## Critical 발견사항

없음.

## SPEC-DRIFT

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | `[SPEC-DRIFT]` `spec/5-system/15-chat-channel.md` §5.4.1.2 가 "`details[].code` 는 **현재** `chatChannel`/`provider` 두 항목 모두 서비스 가드 갈래라 싣지 않는다"고 서술하는데, 이 PR 이 정확히 그 두 자리(`chatChannel` 필드 거부·`provider` 불변 거부)에 `code: ErrorCode.INVALID_FIELD` 를 배선했다 — 그 문단이 스스로 예고했던 "뒤따르는 developer PR" 이 바로 이 PR 이며, 병합되면 그 문장이 거짓이 된다. 코드·unit/e2e 테스트·사용자 문서(`triggers.mdx`/`triggers.en.mdx`)는 이미 새 상태를 정확히 반영한다 — spec 본문만 낡았다. | `spec/5-system/15-chat-channel.md` §5.4.1.2 (해당 spec 파일은 이 diff 대상 아님) / 구현 측: `codebase/backend/src/modules/triggers/triggers.service.ts` (`chatChannel`·`provider` 거부 두 자리) | developer 는 이 문장을 직접 고칠 수 없다 — 자기-반증형 소정정 조건 1(그 문장을 developer 자신이 썼는가) 불성립(그 문장은 이전 planner 턴이 썼다). planner 턴에서 §5.4.1.2 를 같은 절의 §5.4.1/§5.4.1.1 처럼 "배선 전 관측값"이라는 시제-중립 표현으로 갱신할 것. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 와 `plan/in-progress/impl-details-code-wiring.md` 양쪽에 planner 대상 항목으로 durable 하게 등재돼 있다(신규 미검출 항목 아님). 이번 PR 병합을 막을 사유는 아니다. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `chat-channel-trigger-create.e2e-spec.ts` 파일 상단 주석이 "각 `it()` 의 `toEqual` 은 정확 일치라 `code` 가 빠지면 RED" 라고 스스로 "wire 증거"를 선언했는데, 같은 파일에서 `error.details` 가 **배열**(DTO/파이프 경로) 형태로 나오는 유일한 케이스(`'너무 짧은 plaintext (DTO @MinLength 발동) → 400 DTO envelope'`)는 `res.body.error.details[0].field` 만 `.toBe()` 로 검사하고 `code` 를 전혀 보지 않는다. 파일이 약속한 5번의 wire 증거는 전부 object-형태(서비스 가드)이고 배열-형태 wire 증거는 0건이다. | `codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts` — 위 `it()` 블록 | `expect(res.body.error.details[0]).toMatchObject({ field: 'chatChannel.inboundSigningPlaintext', code: 'INVALID_FIELD' })` 한 줄 보강. |
| 2 | 요구사항 | `authConfigId` 거부 자리(top-level 도메인 특화 코드 + generic `details.code` 병기)를 두고, 소스 주석("이 자리만 다른 이유 — §5.3 판정 **미해결**, planner 결정 대기")과 같은 PR 이 넣은 테스트 주석("§5.3 의 「둘을 겹쳐 쓰지 않는다」를 **어기지 않는다**")의 확신도가 서로 다르다 — 소스는 미확정, 테스트는 이미 결론 난 것처럼 서술한다. 기능 버그는 아니고 이 항목 자체는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 판정 대기로 durable 등재돼 있어 유실 위험은 없다. | `codebase/backend/src/modules/triggers/triggers.service.ts`(`assertAuthConfigInWorkspace` 주석) vs `triggers.service.spec.ts:710` 부근 주석 | 급하지 않음 — 테스트 주석에 "이 판정 자체는 planner 결정 대기(`spec-draft-nullable-notation-followups.md` 참조)" 한 문구를 덧붙이거나 소스 주석을 인용하는 정도로 다음 라운드에 정리. 동작 변경 불필요. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `@MinLength(1)` 은 길이만 검사해 공백 전용 문자열(`'   '`)이 여전히 통과 — "빈 시크릿 선(先)저장" 결함의 축소판이 남는다. `SecretResolverService.rotate()`/`store()` 자체도 빈 값 가드가 없어 DTO 계층 방어에만 의존한다. 코드·CHANGELOG·테스트 JSDoc 세 곳 모두 "trim 정책은 별개 결정"이라고 일관되게 스코프 아웃해 은폐된 결함이 아니다. | `chat-channel-config.dto.ts`(`@MinLength(1)`, `botToken`) / `secret-resolver.service.ts`(`rotate`/`store`, diff 범위 밖) | 이미 `plan/in-progress/impl-details-code-wiring.md` 후속 항목으로 등재됨. 이번 PR 은 조치 불요. |
| 2 | 아키텍처/유지보수성/의존성/API계약 | `ErrorCode.INVALID_FIELD`(node-핸들러 도메인 상수, `nodes/core/error-codes.ts`)를 `modules/triggers`(HTTP 계층)가 재사용하고, `common/utils/password.util.ts` 는 `common/`→`nodes/` import 선례 0건을 근거로 리터럴 `'INVALID_FIELD'` 를 유지해 같은 개념값의 정본이 계층별로 갈라져 있다. 값은 현재 동일하지만 한쪽이 바뀌어도 타입 시스템이 다른 쪽 drift 를 못 잡는다. | `triggers.service.ts`(13곳, `ErrorCode.INVALID_FIELD` import) vs `password.util.ts:60-65`(리터럴 유지 근거 주석) | 이미 developer 트래커에 "`INVALID_FIELD` 를 `common/`(또는 API 계약 전용 위치)로 승격" 항목으로 등재됨. 이번 PR 스코프 아님. |
| 3 | 유지보수성 | 동일 형태의 "필드 존재 → `BadRequestException` throw" 블록이 5곳 반복(`assertChatChannelInputSafe` 3곳 + `assertPatchCarriesNoSecrets` 2곳) — 필드 이름만 다르다. 이번 PR 이 만든 중복이 아니라 기존 중복 위에 `code` 배선을 동일하게 추가한 것. 사용자 노출 메시지 5개의 문체가 격식체/해요체로 혼재하는 것도 이번 PR 이 새로 만든 게 아니라 상수화로 한곳에 모이며 더 눈에 띄게 됐을 뿐. | `triggers.service.ts:652-672`, `:697-713` / `chat-channel-rejection-messages.const.ts:47-57` | 후속 헬퍼(`rejectIfPresent(value, field)`) 추출 및 문체 통일은 이미 이전 라운드 트래커(I4·I10)에 등재됨. |
| 4 | 테스트 | "빈 `botToken` 이 시크릿을 먼저 저장한다" 회귀 방지가 DTO unit 테스트 1건에만 의존하고, 실제 HTTP round-trip 으로 "400 이후 시크릿 미기록"을 확인하는 e2e 는 없다. PATCH 경로(`chatChannel` 5필드)의 `details.code` 도 unit(서비스 mock) 레벨에서만 커버되고 실제 HTTP wire 증거는 없다 — 파일 자신의 주석이 이를 후속 항목으로 명시. | `dto/trigger-dto-validation.spec.ts`(`[C]` 테스트) / `triggers.service.spec.ts`(`it.each(BLOCKED_FIELD_CASES)`) | 여유가 되면 `botToken: ''` POST → 400 확인 e2e, PATCH wire 증거 e2e 추가. 이번 PR 을 막을 사유 아님. |
| 5 | 문서화/유저가이드 동기화 | `triggers.mdx`/`triggers.en.mdx` 의 인접 문장(botToken/botTokenRef)과 provider 문서 6개(telegram/discord/slack × ko/en)가 여전히 `details.code` 를 언급하지 않는다 — pre-existing gap(파이프 계층은 이전부터 `code` 를 싣고 있었음), 직전 라운드가 이미 INFO·트래커(I12) 등재. e2e 파일 상단 주석의 "축(axis)" 서술도 spec 이 가리키는 PATCH 두-갈래 축보다 넓게 읽히나 같은 문단 4번째 줄에서 스스로 스코프를 좁힌다. | `triggers.mdx:431`, `triggers.en.mdx:420`, `telegram/discord/slack.{mdx,en.mdx}` 각 1~2곳 / `chat-channel-trigger-create.e2e-spec.ts` 파일 상단 주석 | 여유 있을 때 8개 문서 표기 통일. 급하지 않음. |
| 6 | 스코프 | 이번(4번째) 라운드가 developer 자신이 선언한 "최대 3라운드" 정지 규칙을 넘겼다 — 커밋 본문이 사유(직전 라운드가 넣은 review-citation 규약 위반 2곳을 그대로 머지하는 것이 상한 준수보다 나쁨)를 투명하게 명시했고, 실제 diff 는 인용 정정 2줄 + 근거 주석 추가뿐으로 A/B/C/D 스코프 밖 신규 동작 변경은 없다. | `plan/in-progress/impl-details-code-wiring.md` "정지 규칙" 절 vs 커밋 `9fcce3f47` | 코드 스코프 관점 조치 불요. 반복되면 정지 규칙 실효성 재검토 필요(메모리에 유사 8라운드 선례 있음). |
| 7 | 테스트 | `password.util.spec.ts` 신규 `it.each` fixture 설명("`'P@ss1'`은 3종을 갖췄으나")과 실제 문자 구성(대문자·특수문자·소문자·숫자 4종)이 어긋남 — 길이 분기가 먼저 단락(short-circuit)해 테스트 정확성에는 영향 없는 문서 표현 오차. | `password.util.spec.ts`(`it.each` 앞 JSDoc) | 선택적 문구 정정, 급하지 않음. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | INFO 3건(공백 botToken 잔여 갭, rotate 자체 가드 부재, 경로 노출 메시지) — 모두 유예된 known-issue |
| performance | NONE | 콜드 패스 O(1) additive 변경뿐, 우려 없음 |
| architecture | LOW | `ErrorCode.INVALID_FIELD` 계층 소유권 비대칭(known-debt), `TriggersService` SRP 누적(pre-existing, 후속 PR 분리됨) |
| requirement | LOW | SPEC-DRIFT 1건(§5.4.1.2 stale), WARNING 1건(authConfigId 주석 확신도 불일치) |
| scope | NONE | A/B/C/D 스코프 정확히 준수, 3라운드 상한 초과는 워크플로 규율 사안(투명하게 기록됨) |
| side_effect | LOW | 공개 에러 응답 shape additive 확장, `botToken` 빈 문자열 이제 거부 — 둘 다 의도된 정합화 |
| maintainability | LOW | 이전 라운드 WARNING(fixture 중복) 해결 확인, 잔여 INFO(문체 혼재·boilerplate 5곳·`INVALID_FIELD` 이중표현) |
| testing | LOW | WARNING 1건(e2e 배열-형태 code 미검증), 뮤테이션 검증 직접 재현 확인 |
| documentation | LOW | SPEC-DRIFT(§5.4.1.2) 재확인, e2e 주석 스코프 서술 INFO 1건 |
| dependency | NONE | 패키지 변경 0건, 신규 내부 상수 모듈만 |
| database | NONE | 스키마/쿼리/트랜잭션 영향 없음 |
| concurrency | NONE | 신규 비동기 흐름/공유 상태 없음, write-before-validate 순서 문제는 pre-existing·노출 축소 방향 |
| api_contract | LOW | additive 필드 확장, `authConfigId` 형태 불균일은 이전 라운드 처분 재확인 |
| user_guide_sync | LOW | provider 문서 6개 + 인접 문장 `details.code` 미표기(pre-existing, I12 등재) |

## 발견 없는 에이전트

- **database** — "발견사항: 없음"으로 명시. 스키마/쿼리/트랜잭션/마이그레이션 영향 대상 자체가 없음.

## 권장 조치사항

1. (planner 턴) `spec/5-system/15-chat-channel.md` §5.4.1.2 의 "현재 …싣지 않는다" 시한부 문장을 §5.4.1/§5.4.1.1 과 같은 시제-중립 표현("배선 전 관측값")으로 갱신 — SPEC-DRIFT, developer 권한 밖.
2. `chat-channel-trigger-create.e2e-spec.ts` 의 배열-형태(DTO/파이프) 케이스에 `code: 'INVALID_FIELD'` 단언 1줄 보강 (WARNING #1).
3. `authConfigId` 판정 자리의 테스트 주석 확신도를 소스 주석(미확정)과 맞추는 문구 보강 (WARNING #2).
4. 여유가 되면: provider 문서 6개 + `triggers.mdx` 인접 문장의 `details.code` 표기 통일(I12), `botToken` 공백 전용 trim, PATCH 경로 wire 증거 e2e, `INVALID_FIELD` 상수 계층 승격 — 모두 기존 트래커(`plan/in-progress/impl-details-code-wiring.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재된 후속 항목이며 이번 PR 병합을 막을 사유는 아니다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. 전체 reviewer(14명) 실행.
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success)
- **제외**: 없음
- **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing — forced 전원 결과 확보됨(누락 없음)
