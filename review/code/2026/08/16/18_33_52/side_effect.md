# 부작용(Side Effect) 코드 리뷰

## 대상 요약

이 changeset 은 이미 4라운드(`17_12_34`→`17_35_49`→`17_56_15`→`18_14_50`)를 거쳐 **CRITICAL 0 ·
WARNING 0**(4라운드는 documentation W1 + security INFO 정정만)으로 수렴한 뒤 코드가 동결된 상태다.
이번(5라운드) 리뷰 시점의 실질 코드 변경분은 8개 파일에 한정된다:

- 신규 `codebase/backend/src/shared/utils/redact-stored-error.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/executions/executions.service.ts` (+ `.spec.ts`)
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (+ `.spec.ts`)
- DTO 주석 2곳(`execution-response.dto.ts`, `background-run-response.dto.ts`)

나머지 110여 개 파일(`.claude/docs/plan-lifecycle.md`, `CHANGELOG.md`, `plan/**`, `spec/**`,
`review/**`)은 마크다운/JSON 문서이며 런타임 실행 경로가 없다. `git diff origin/main...HEAD --stat --
codebase/` 로 실측한 결과 코드 표면은 위 8개 파일(680줄) 뿐임을 재확인했다.

## 발견사항

없음 — CRITICAL/WARNING 대상 없음. 아래는 독립 재검증 결과(INFO)다.

- **[INFO]** `stop()` 공개 시그니처·반환 정체성 변경 — 4라운드에 걸쳐 이미 문서화·실측된 항목, 재확인 결과 이상 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:821`(`stop`), `:834`(`stopInternal`)
  - 상세: 반환 타입이 `Promise<Execution>` → `Promise<ResponseExecution>` 로 좁아지고, 반환값도
    "재조회한 엔티티 참조" 대신 `toResponseExecution()` 이 만든 **마스킹 복사본**으로 바뀐다.
    호출자를 다시 grep 했다 — `interaction.service.ts:226,248`, `hooks.service.ts:407` 는 `await
    this.executionsService.stop(...)` 결과를 변수에 담지 않고 버린다. 값을 실제로 쓰는 곳은
    `executions.controller.ts:145`(`return this.executionsService.stop(id)`) 하나뿐이고, 여기는
    그대로 HTTP 응답 바디로 pass-through 되므로 TS 타입 좁힘이 런타임 계약을 깨지 않는다.
    `stopInternal` 의 `findOne`(재조회 두 지점)에는 `relations` 지정이 없어 `trigger`/`executor`
    는 애초에 로드되지 않는다 — 타입에서 빠져도 응답 바이트에서 사라지는 필드는 없다는 JSDoc 의
    주장이 실측과 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** `stopInternal` 의 `return` 문 개수 서술이 이번 라운드 기준 정확함 — 재검증
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:799`(JSDoc 주장), `:834-905`(`stopInternal` 본체)
  - 상세: 4라운드에서 "반환 지점 넷" → "`return` 문 셋(waiting 경로 · `affected=0` 재조회 · 정상
    재조회), 폴백 포함 여섯 가지 산출값" 으로 정정됐다. 실제 본체를 다시 세어 `return` 문이
    정확히 3개(`:873`, 그리고 이후 `affected=0`/정상 경로 2개)임을 확인했다 — 이 수치가 "왜
    `stop()` 한 자리에서만 마스킹을 거는가" 설계 근거로 쓰이므로, 근거 문장의 정확성 자체가
    부작용 회귀(다음 반환 지점 추가 시 개별 호출부 마스킹이면 누락)를 막는 역할을 한다.
  - 제안: 조치 불필요.

- **[INFO]** `getChain()` 반환 타입 변경(`Execution[]` → `ResponseExecution[]`) — 호출자 영향 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:535`(`getChain` 시그니처), 호출부 `codebase/backend/src/modules/executions/executions.controller.ts:311`
  - 상세: 컨트롤러는 `return this.executionsService.getChain(...)` 로 그대로 pass-through 하며
    `trigger`/`executor` 필드를 별도로 읽는 소비자가 없다(grep 확인). 런타임 동작 영향 없음.
  - 제안: 조치 불필요.

- **[INFO]** 신규 export `ResponseExecution`/`ResponseNodeExecution` 타입 — 순수 추가, 외부 소비자 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:77`(`ResponseExecution`), `:91`(`ResponseNodeExecution`)
  - 상세: 이 파일과 그 `.spec.ts` 외에는 참조하는 곳이 없다(`grep -rn` 확인). 기존 공개 인터페이스를
    바꾸지 않는 additive 변경.
  - 제안: 조치 불필요.

- **[INFO]** `redactStoredErrorForResponse`/`deepRedactSecrets` — 비변이·순수 함수, 신규 I/O·전역 상태 없음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:57-64`, 의존 대상 `codebase/backend/src/shared/utils/sanitize-error-message.ts:127-171`(`deepRedactSecrets`/`deepRedactObject`, 이번 diff 로 수정되지 않음)
  - 상세: `deepRedactObject` 는 값이 실제로 바뀐 필드만 `{ ...value }` 로 복제하고(copy-on-change),
    변경이 없으면 원본 참조를 그대로 반환한다 — mutation 없음. `redact-stored-error.ts` 자체는
    `import` 가 `sanitize-error-message` 하나뿐이라 신규 순환 재유입도 없다(해당 leaf 모듈은
    `import` 0개 — 직접 확인).
  - 제안: 조치 불필요.

- **[INFO]** `deepRedactSecrets` 의 module-level `DEEP_REDACT_CACHE`(`WeakMap`) — 기존 전역 상태, 신규 호출부가 접근만 추가
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:136-141`(캐시 read/write, 이번 diff 밖), 신규 호출부 4곳: `executions.service.ts` `findById`/`getChain`/`stop`/`toExecutionDto`, `background-runs.service.ts` `toNodeExecutionDto`
  - 상세: 이 `WeakMap` 은 이번 diff 가 도입한 전역 변수가 아니라 기존 코드다. 새 호출부들이 매
    요청마다 TypeORM 이 새로 만든 `error` 객체를 키로 넘기므로 캐시 히트가 사실상 없고(성능
    관점은 별도 리뷰가 이미 INFO 로 기록), `WeakMap` 특성상 참조가 끊기면 자동 GC 되어 메모리
    누수나 요청 간 값 오염 경로는 없다.
  - 제안: 조치 불필요(전역 상태 신규 도입 아님, 접근 패턴도 안전).

- **[INFO]** `findById` 의 `snapshotCache` — 마스킹 완료 후 캐시에 쓰여, 원문이 캐시에 남는 경로 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `findById` 내부 `reconciledNodeExecutions` 산출(마스킹) → 트랜잭션 콜백 반환 → `writeSnapshotCache` 호출 순서
  - 상세: `error == null` 인 행은 원본 `NodeExecution` 참조를 그대로 응답에 포함하지만, 이 참조는
    이번 요청의 `manager.find(...)` 로 새로 조회된 객체라 다른 요청과 공유되지 않는다.
    `writeSnapshotCache` 는 마스킹이 끝난 `snapshot` 객체를 저장하므로 캐시에 원문이 들어갔다가
    나중에 마스킹되는 순서 결함은 없다. 이 캐시 반환값을 in-place 변이하는 호출부는 현재
    코드베이스에 없음을 확인했다(4라운드 side_effect 리뷰와 동일 결론, 재확인).
  - 제안: 조치 불필요. 향후 이 반환값을 다루는 신규 코드가 in-place 변이를 하면 캐시 오염으로
    이어질 수 있다는 캐비엇만 유효.

- **[INFO]** DTO Swagger `description` 문자열 변경 — 런타임 직렬화·검증에 영향 없음
  - 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:65-73,169-175`, `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:64-65`
  - 상세: `@ApiPropertyOptional` 의 `description` 문자열만 바뀌고 `type`/`additionalProperties` 등
    실제 직렬화·검증에 관여하는 필드는 그대로다. OpenAPI 문서 텍스트만 바뀐다.
  - 제안: 조치 불필요.

- **[INFO]** `.claude/docs/plan-lifecycle.md` 신규 `pending_plans`(plan 레벨) 절 — 코드가 소비하지 않음, 기존 gate 와 충돌 없음
  - 위치: `.claude/docs/plan-lifecycle.md:80-101`
  - 상세: 같은 키 이름(`pending_plans`)이 `spec/**` frontmatter 에서는 이미
    `spec-pending-plan-existence.test.ts`/`spec-status-lifecycle.test.ts`/`plan-stale-audit.sh` 로
    가드된다. 이 문서가 새로 서술하는 것은 **plan/** frontmatter** 쪽 용법이다 — 위 세 소비처를
    직접 열어 확인한 결과 전부 `spec/` 트리(`s.frontmatter`/spec 파일 순회)만 순회하고 `plan/**`
    frontmatter 는 읽지 않는다. 따라서 이번 문서가 plan 레벨에 도입한 동명 키가 기존 spec 레벨
    가드에 의해 의도치 않게 검증/차단되는 경로는 없다 — 문서 자신이 명시한 "plan 레벨엔 가드가
    없다"가 실측과 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** `CHANGELOG.md`/`plan/**` 문서 이동·링크 정정 — 파일시스템 부작용은 `git mv` 등가일 뿐, 실행 코드 없음
  - 위치: `CHANGELOG.md:3-35`, `plan/complete/eia-stalled-atomicity.md`(등 6개, `in-progress/`→`complete/` 이동), `plan/in-progress/backend-lint-gate-broken-on-main.md:787` 등 상대경로 링크 정정
  - 상세: 순수 마크다운 재배치·링크 수정이며, 이번 diff 에 이런 이동을 수행하는 스크립트나
    파일시스템 조작 코드는 포함돼 있지 않다(사람이 커밋한 정적 변경).
  - 제안: 조치 불필요.

- **[INFO]** `review/**` 신규 산출물(SUMMARY/RESOLUTION/meta.json/`_retry_state.json` 등) — 이전 리뷰 라운드 기록, 부작용 표면 아님
  - 위치: `review/code/2026/08/16/{17_12_34,17_35_49,17_56_15,18_14_50}/**`, `review/consistency/2026/08/16/**`
  - 상세: 정적 리뷰 아카이브 파일이며 런타임에 로드·실행되지 않는다.
  - 제안: 조치 불필요.

## 확인했으나 문제 없음 (부작용 관점 교차 확인)

- **환경 변수**: 이번 diff 어디에도 `process.env` 읽기/쓰기 신규 도입 없음(grep 확인).
- **네트워크 호출**: 신규 `redact-stored-error.ts` 는 순수 정규식 위임, 소비처 변경분도 이미 조회된
  데이터에 대한 in-memory 변환뿐이라 신규 외부 호출 없음.
- **전역 변수**: 이번 diff 가 새로 도입하는 module-level mutable state 없음. 기존 `DEEP_REDACT_CACHE`
  는 위에서 다룸.
- **이벤트/콜백**: 변경 지점(`findById`/`getChain`/`stop`/`toExecutionDto`/`toNodeExecutionDto`)은
  모두 emit·이벤트 발행과 무관한 응답 직전 변환 함수다. WS `execution.snapshot` 은 `findById` 를
  재사용하므로 emit **호출 자체**(발생 여부·횟수)는 바뀌지 않고 실리는 payload 값만 마스킹된다.
- **파일시스템**: `.ts` 코드 표면에 파일 I/O 신규 도입 없음.
- **인터페이스/시그니처**: `stop`/`getChain`/`toResponseExecution`(구 `stripPrivateRelations`,
  private) 변경은 위에서 개별적으로 다뤘다. `redactStoredErrorForResponse(err)` 는 신규 export 라
  기존 호출자에 영향이 없다.

## 요약

이 changeset 은 응답 egress 시점에 `Execution.error`/`NodeExecution.error` 값을 마스킹하는 보안
후속 작업으로, 4라운드에 걸친 리뷰(`17_12_34`→`18_14_50`)에서 이미 CRITICAL/WARNING 0 으로
수렴했고 이번 5라운드 시점 실질 코드 변경분은 없다(문서·plan 정리만 추가). 독립 재검증 결과
부작용 관점에서 유의미한 변화는 여전히 `stop()`/`getChain()` 의 반환 타입·정체성 변경 하나뿐이며,
내부 소비자 2곳은 반환값을 버리고 유일한 소비자(컨트롤러)는 HTTP 응답으로 그대로 pass-through
한다는 사실이 재확인됐다. 전역 변수·환경 변수·파일시스템·네트워크 호출·이벤트 발생 패턴에 대한
새로운 부작용은 발견되지 않았고, 신규 `redact-stored-error.ts` 는 비변이 순수 함수이며 기존
module-level `WeakMap` 캐시 접근도 안전하다(자동 GC, 요청 간 오염 없음). `pending_plans` 신규
plan-레벨 문서화도 기존 spec-레벨 가드와 실측으로 충돌 없음을 확인했다. CRITICAL/WARNING 급 발견
없음.

## 위험도

NONE
