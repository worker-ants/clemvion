# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md` 신규 항목의 마크다운 링크가 깨져 있다 — `(경로)` 없이 `[텍스트]` 만 남음
  - 위치: `CHANGELOG.md:15`
  - 상세: `**\`nodeExecutions[].error\` 도 함께 마스킹한다** — [데이터 모델 §2.14] 가 \`Execution.error\` 를` —
    `[데이터 모델 §2.14]` 뒤에 `(spec/1-data-model.md#...)` 형태의 링크 타깃이 없다. 참조 정의
    (`[데이터 모델 §2.14]: ...`) 도 파일 어디에도 없다(`grep -n "데이터 모델 §2.14\]:" CHANGELOG.md` 결과
    0건). 렌더러는 이를 링크가 아니라 대괄호가 그대로 보이는 리터럴 텍스트로 표시한다. 같은 파일의
    다른 항목들은 정확히 이런 교차참조를 항상 하이퍼링크로 남긴다 — 예:
    `CHANGELOG.md:613` `([3-auth-session §3.1-2·§R4](spec/7-channel-web-chat/3-auth-session.md))`,
    `CHANGELOG.md:1169` `[Spec 실행 엔진 §6.3](spec/5-system/4-execution-engine.md#63-재실행조회-정책-replay-policy)`.
    이번 항목만 그 관행에서 이탈했다. 실제 근거 문서는 `spec/1-data-model.md` §2.14(*"최초 failed
    NodeExecution 의 에러 정보를 복사"*)로, 다른 리뷰 세션(`plan/in-progress/eia-internal-rest-error-masking.md`
    의 spec 초안 절)도 같은 근거를 인용하며 정확히 `[데이터 모델 §2.14](../../spec/1-data-model.md)` 형태로
    링크를 걸어 두었다 — 즉 대상 경로는 이미 알려져 있고 CHANGELOG 항목만 그 링크를 빠뜨렸다.
  - 제안: `[데이터 모델 §2.14](spec/1-data-model.md)` (또는 해당 절 앵커 포함)로 링크를 완성한다.

- **[WARNING]** `stop()`/`stopInternal()` 분리 리팩터 이후, TOCTOU/원자 UPDATE 계약을 설명하는
  JSDoc 이 실제 그 로직이 있는 함수가 아니라 얇은 wrapper 에 남아 있다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:783-810`
    (`stop()` 의 JSDoc 시작 지점 783, `async stop` 805, `stopInternal` 선언 810)
  - 상세: `stop()` 바로 위 JSDoc 첫 문장은 *"동시 stop 요청에 대한 TOCTOU 경쟁을 막기 위해, 최종
    상태 전환은 단일 원자 UPDATE(status WHERE status IN [전이 가능 상태]) 로 수행한다"* 이다. 그런데
    이번 diff 로 `stop()` 은 `return this.toResponseExecution(await this.stopInternal(id));` 두 줄짜리
    wrapper 가 됐고, 실제 원자 UPDATE 로직(`createQueryBuilder().update(Execution).set(...).where('id
    = :id').andWhere('status IN (:...stoppable)', ...)`, `updateResult.affected === 0` 분기)은 전부
    `stopInternal()`(`:810` 이하) 안으로 이동했다. 정작 `stopInternal()` 자신의 문서는
    `/** {@link stop} 의 본체. 반환은 **마스킹 전** 엔티티다 — 감싸는 쪽이 관문이다. */` 한 줄뿐이라,
    TOCTOU 방지 계약(가장 중요한 동시성 불변식)을 전혀 언급하지 않는다. `stopInternal` 코드만 단독으로
    보거나(예: IDE go-to-definition, 다른 호출부 추가 시) 열어 보는 사람은 이 함수가 지켜야 하는 원자성
    계약을 문서에서 찾지 못하고, 반대로 `stop()` 문서만 읽는 사람은 그 계약이 자신이 보는 2줄짜리
    함수의 것이라고 오인할 수 있다. 리팩터로 "무엇을 하는 코드"와 "그 코드를 설명하는 문서"가 서로
    다른 함수로 갈라졌는데 문서는 따라가지 않은 형태다.
  - 제안: TOCTOU/원자 UPDATE 문장을 `stopInternal()` 의 문서로 옮기거나(권장), 최소한 그 요지를
    한 줄 복제해 `stopInternal()` JSDoc 에도 남긴다. `stop()` JSDoc 은 지금처럼 "마스킹 관문" 설명에
    집중하고 "본체(TOCTOU 계약)는 `{@link stopInternal}` 참조"로 교차 링크하면 두 문서가 각자 담당
    함수의 실제 계약과 정확히 대응한다.

- **[WARNING]** 신규 plan 문서에 동일 3줄 문단이 그대로 두 번 반복된다 (편집 중 복사-붙여넣기 잔재로 보임)
  - 위치: `plan/in-progress/eia-internal-rest-error-masking.md:99-103` 와 `:122-126`
  - 상세: 아래 세 불릿이 글자 그대로 두 번 나온다 —
    `- **\`toTerminalErrorPayload\` 를 재사용하지 않는다.** …`, `- 내부는 \`deepRedactSecrets\` 로 동일 …`,
    `- DB 는 **원문 보존**(§R17 egress-only 원칙 그대로) …`. 첫 번째 블록(`:99-103`) 바로 뒤에
    `### 전제를 무수정 프로브로 먼저 실증했다` 절(표 + 설명, `:105-120`)이 이어지고, 그 절이 끝난 직후
    같은 3줄이 두 번째 블록(`:122-126`)으로 다시 등장한 뒤 `### 캐시 상호작용` 절로 넘어간다. 문맥상
    "전제 실증" 절을 이 설계 절 사이에 나중에 끼워 넣으면서 원래 블록을 옮기지 않고 복제한 것으로
    보인다. 내용 자체가 틀린 것은 아니지만, 같은 문단이 두 번 나오면 읽는 사람이 "두 자리가 미묘하게
    다른가" 하고 재대조하게 만들고, 이 문서가 이후 spec 초안 근거로 재인용되는 성격(정본 트래커·
    spec 반영 문서)임을 고려하면 불필요한 중복이다.
  - 제안: 두 블록 중 하나를 지운다 — "전제 실증" 절이 이 세 불릿(형태 보존·내부 방어 강도 동일·DB
    원문 보존)의 근거를 뒷받침하는 흐름이므로, `:122-126` 을 남기고 `:99-103` 을 지우는 편이 자연스럽다.

- **[WARNING]** `.claude/docs/plan-lifecycle.md` 의 "실측" 수치가 같은 PR 자신이 만든 변화를 반영하지
  못해 착지 시점 기준으로 이미 stale 하다
  - 위치: `.claude/docs/plan-lifecycle.md:88`
  - 상세: 신규 문장 *"실측(2026-08-16): spec 레벨 17건 · plan 레벨 3건"* 을 `origin/main`(이 PR 의
    base) 기준으로 frontmatter 만 정확히 파싱해 재현하면 정확히 spec 17 · plan 3 으로 **그 시점에는
    맞았다**(스크립트로 재현 확인: spec 17개 파일, plan 3개 파일 — `spec-draft-eia-error-masking-catalog.md`
    · `spec-draft-eia-notification-payload-contract.md` · `spec-draft-ws-types-canonical-location.md`).
    그런데 바로 이 PR 자신이 새로 만든 `plan/in-progress/eia-internal-rest-error-masking.md`(파일 9)의
    frontmatter 에 `pending_plans:` 가 **plan 레벨**로 선언돼 있어, 이 diff 가 착지한 시점(HEAD) 기준
    실제 plan 레벨 건수는 **4건**이다(같은 스크립트로 HEAD 기준 재현: spec 17 · plan 4). 즉 "3건" 이라는
    실측값은 이 PR 이 도입한 바로 그 신규 파일을 세지 못한 채로 같은 PR 안에 박제됐다 — 문서가 자기
    자신이 만드는 변화를 반영하지 못하는 형태다. gate 안에서 확인 가능한 범위(단순
    `grep "^pending_plans:"`)로는 spec 18 · plan 5 로 더 벌어지는데, 이는 예시 코드 블록 안의
    `pending_plans:` 문구(예: `spec/conventions/spec-impl-evidence.md`·`plan/complete/spec-draft-web-chat-console.md`
    본문의 스키마 예시)까지 잡히는 grep 오탐이라 frontmatter 만 파싱한 위 수치(17/3→17/4)가 맞다.
  - 제안: "spec 레벨 17건 · plan 레벨 3건" 을 "spec 레벨 17건 · plan 레벨 4건(본 PR 이 추가하는
    `eia-internal-rest-error-masking.md` 포함)"으로 갱신하거나, 애초에 "본 PR 이전 기준" 임을 명시한다.
    이 숫자는 가드에 쓰이지 않는 예시 데이터라 기능적 영향은 없지만, "실측" 이라 표기한 수치가
    당사자 PR 안에서부터 어긋나는 것은 이후 세션이 이 문서를 근거로 재인용할 때 오차를 그대로
    물려받는다.

## 확인했으나 문제 없음 (참고)

- `codebase/backend/src/shared/utils/redact-stored-error.ts` JSDoc 의 사실 주장(`GET
  /api/executions/:id` 에 `@Roles` 게이트 없음, `deepRedactSecrets` 위임·형태 보존, DB 원문
  보존 등)은 실제 컨트롤러(`executions.controller.ts`)·구현과 대조해 정확했다.
- `background-runs.service.ts`/`.spec.ts` 신규 주석("이 컨트롤러도 `@Roles` 게이트 없이 …")도
  `background-runs.controller.ts` 실제 데코레이터(둘 다 `@Roles` 없음)와 대조해 정확했다.
- `CHANGELOG.md` 신규 항목의 "4곳"(`findById`·`toExecutionDto`·`getChain`·`stop`) 주장,
  `stop()` 반환 타입이 `ResponseExecution` 으로 좁아진다는 서술은 실제 diff(`executions.service.ts`)와
  정확히 일치했다.
- `redact-stored-error.spec.ts` 의 "레거시 문자열·숫자 통과" 캐너리 테스트는 함수 JSDoc 의
  `@param` 서술("jsonb 라 레거시 문자열·숫자가 들어와도 타입을 보존하며 통과")을 정확히 검증한다 —
  직전 라운드(`17_12_34` testing WARNING)에서 지적된 "문서한 보장이 테스트로 고정 안 됨" 갭이
  이번 diff 로 실제로 메워졌다.
- `plan/in-progress/eia-internal-rest-error-masking.md` 의 `## 조치` 체크리스트 —
  *"정본 트래커 I1·D 닫기"* 항목(`:264`)이 직전 라운드(`17_12_34` documentation WARNING)에서 지적된
  stale 상태를 정확히 `[x]` + 사유로 정정해 두었다.
- `plan/complete/eia-terminal-emit-facade.md` 등 6개 plan 의 `in-progress/` → `complete/` 이동은
  frontmatter 를 그대로 보존했고, 이를 가리키던 다른 8개 in-progress plan 의 상대링크(`./X.md` →
  `../complete/X.md`)도 실제로 갱신됐다(`plan/in-progress/backend-lint-gate-broken-on-main.md`,
  `retry-turn-terminal-guard.md`, `spec-draft-eia-notification-payload-contract.md`,
  `ws-event-types-extract.md` 등 확인). §3 "인입 참조" 규칙 위반 없음.
- `spec/5-system/14-external-interaction-api.md` 에는 폐기된 함수명 `redactExecutionErrorValue`
  가 더 이상 남아 있지 않다 — grep 결과 `redactStoredErrorForResponse` 로 일관됨(직전 consistency
  라운드 `16_32_42` CRITICAL 이 `16_48_55` 에서 해소된 것을 코드 레벨에서 재확인).

## 요약

이번 diff 의 핵심 문서화 작업(신규 JSDoc, 테스트 주석, 5개 spec 문서 동기화, plan 라이프사이클
정리)은 대체로 정확하고 촘촘하다. 다만 네 가지 사소하지만 실재하는 흠이 있다 — (1) `CHANGELOG.md`
신규 항목의 교차참조 링크가 대괄호만 남고 URL 이 빠져 렌더링되지 않는다, (2) `stop()`/`stopInternal()`
분리 리팩터로 TOCTOU 계약 설명이 실제 로직이 있는 함수가 아니라 얇은 wrapper 에 남았다, (3) 신규
plan 문서에 같은 3줄 문단이 편집 잔재로 두 번 반복된다, (4) `plan-lifecycle.md` 의 "실측" 수치가
이 PR 자신이 추가하는 plan 파일 하나를 세지 못해 착지 시점 기준 이미 1건 어긋난다. 넷 다 기능·가드에
영향을 주지 않는 낮은 심각도이며, 각각 한두 줄 수정으로 해소된다.

## 위험도

LOW
