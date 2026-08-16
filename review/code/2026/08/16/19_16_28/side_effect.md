# 부작용(Side Effect) Review

## 컨텍스트

이 changeset 은 이미 6라운드(`17_12_34`~`18_58_22`) `/ai-review` + 2회 `--impl-done` 을
거친 **최종 수렴 상태**다. 코드 레벨 변경은 아래 8개 파일에 한정되고, 나머지(plan/spec/
review 문서 100여 개)는 이번 diff 에 새로 추가된 리뷰 산출물·plan 정리다:

- `codebase/backend/src/shared/utils/redact-stored-error.ts` (신규) + `.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` + `.spec.ts`
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` + `.spec.ts`
- `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts` (JSDoc 만)
- `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts` (JSDoc 만)

직전 라운드(`18_58_22`)에서 side_effect 리뷰어 자신이 이미 **NONE** 판정을 냈고, 그 근거였던
"`stop()` 반환값 정체성 변경" 은 그보다 앞선 `17_12_34` W3 에서 발견 → 문서화·실측(로 조치되어
있었다. 이번 라운드에서는 해당 판정을 **다시 소스를 직접 열어 독립 재검증**했다 — 프롬프트에
포함된 과거 리뷰 산출물을 그대로 신뢰하지 않고, 실제 `executions.service.ts` 전문·
`sanitize-error-message.ts`(재사용되는 leaf 모듈)·호출부 전수를 grep 으로 재확인했다.

## 발견사항

없음 (CRITICAL/WARNING 급 신규 부작용 미발견). 아래는 검토 과정에서 확인한 관찰 사항 —
전부 이미 의도되고 문서화된 것으로 판정, 조치 불요.

- **[INFO]** `stop()` / `getChain()` 반환 타입이 각각 `Execution` → `ResponseExecution`,
  암묵적 엔티티 배열 → `ResponseExecution[]` 로 좁혀졌다 — 공개 메서드 시그니처 변경
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:813`(`stop`),
    `:531`(`getChain`)
  - 상세: `stop()` 은 이제 원본 엔티티 참조 대신 `toResponseExecution()` 이 만든 **마스킹된
    복사본**을 반환한다(`:813-815`). 호출자를 전수 grep 으로 확인했다 — 내부 소비자
    `interaction.service.ts:226,248`, `hooks.service.ts:407` 는 반환값을 **버린다**
    (`await this.executionsService.stop(...)` 뒤에 결과 미사용, 각각 `break`/return 으로
    직행). 유일하게 반환값을 그대로 쓰는 곳은 `executions.controller.ts:145`
    (`return this.executionsService.stop(id)`) — HTTP 응답 표면이고, 이 변경 자체가 이
    PR 의 목적(마스킹 적용)이다. `getChain()` 도 컨트롤러 단일 호출자(`:311`)뿐이다.
    타입이 제외한 `trigger`/`executor` 필드는 `Execution` 엔티티(`entities/execution.entity.ts`)에
    `eager: true` 가 없고, `stop()`/`getChain()` 이 쓰는 두 조회(`stopInternal` 의
    `findOne({where:{id}})`, `getChain` 의 `createQueryBuilder('e').where(...).getMany()`)
    모두 그 관계를 join/select 하지 않아 애초에 로드되지 않는다 — 소스에서 직접 확인,
    "응답에서 사라지는 필드가 없다" 는 JSDoc(`:805-811`)의 주장과 일치한다.
  - 제안: 조치 불요. 이미 JSDoc·CHANGELOG·`RESOLUTION.md`(`17_12_34` #3)에 3중으로
    문서화·실측되어 있다.

- **[INFO]** 신규 소비처 2곳이 기존 module-level `WeakMap` 캐시의 사용 폭을 넓힌다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:96`
    (`const DEEP_REDACT_CACHE = new WeakMap<object, unknown>();`)
  - 상세: `redactStoredErrorForResponse`(신규)가 위임하는 `deepRedactSecrets` 는 depth-0
    호출을 객체 identity 로 캐싱하는 기존 `WeakMap` 을 재사용한다. 이 캐시 자체는 이번
    diff 이전부터 있던 것이고(`sanitizePayloadForWs` 와 동일 패턴을 미러링), 이번 PR 이
    새 호출부(`executions.service.ts` 4곳 · `background-runs.service.ts` 1곳)를 추가하며
    호출 빈도가 늘었을 뿐 캐시 자체의 동작(키=객체 참조, `WeakMap` 이라 GC 대상)은 바뀌지
    않는다. 키가 매 DB fetch 마다 새로 만들어지는 JS 객체(`execution.error`/`ne.error`)라
    요청 간 identity 충돌 여지가 없다 — 동시성 리뷰어의 기존 판정(`17_12_34` concurrency
    메모)과 일치.
  - 제안: 조치 불요. 새 전역 상태 도입이 아니라 기존 전역 상태의 소비처 확장이며, 안전
    경계(WeakMap identity 키)가 그대로 유지된다.

- **[INFO]** `findById` 의 `snapshotCache`(인스턴스 필드, `executions.service.ts:174-177`)에
  저장되는 값은 **마스킹 적용 후** 스냅샷이다 — 캐시 오염 없음
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:638-644`
    (`reconciledNodeExecutions` 조립), `:662-669`(`toResponseExecution` 적용 후 조립),
    `:672`(`writeSnapshotCache` 호출)
  - 상세: 마스킹(`redactStoredErrorForResponse`)이 트랜잭션 콜백 내부, `writeSnapshotCache`
    호출보다 **먼저** 적용된다. 즉 캐시가 원문을 저장했다가 나중에 마스킹을 우회해 내보내는
    경로는 없다. `readSnapshotCache` 는 캐시된 마스킹 완료 객체를 그대로 반환한다(`:569-570`).
  - 제안: 조치 불요.

- **[INFO]** `redactStoredErrorForResponse`/`deepRedactSecrets` 는 입력을 변이하지 않는다 —
  copy-on-change 확인
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:31-34`,
    `codebase/backend/src/shared/utils/sanitize-error-message.ts:145-166`
    (`deepRedactObject` — 값이 안 바뀐 하위 트리는 `mutated`/`result` 플래그가 그대로라
    **원본 참조**를 반환)
  - 상세: 소스를 직접 읽어 뮤테이션 지점이 없음을 확인했다. 배열 분기는 `mutated` 플래그로,
    객체 분기는 `result` 지연 초기화(`{ ...value }`)로 각각 "바뀐 게 있을 때만 얕은 복사"
    를 구현한다 — 원본 엔티티 객체(`execution`/`ne`)를 직접 수정하는 대신 항상 새 참조
    또는 동일 참조를 반환하므로, TypeORM 이 관리하는 엔티티 인스턴스가 응답 마스킹
    과정에서 오염될 위험이 없다.
  - 제안: 조치 불요.

## 교차 확인 (부작용 관점 8개 항목 전수)

1. **의도치 않은 상태 변경** — 없음. 신규/변경 로직은 모두 이미 조회된 데이터에 대한 순수
   변환(마스킹)이며, `snapshotCache`/`DEEP_REDACT_CACHE` 는 기존에 있던 캐시의 정상 사용
   범위 안에 있다.
2. **전역 변수** — 새 전역 변수 도입 없음. `redact-stored-error.ts` 는 상태를 갖지 않는
   순수 함수 모듈이다.
3. **파일시스템 부작용** — 코드 diff 에 파일 I/O 없음. (리뷰 산출물 자체의 파일 생성은
   review 워크플로의 의도된 동작이지 코드의 부작용이 아니다.)
4. **시그니처 변경** — `stop()`/`getChain()` 반환 타입 좁힘, 위 첫 항목에서 호출자 전수
   확인 완료. `ExecutionsService.toResponseExecution`(구 `stripPrivateRelations`)은 private
   메서드라 외부 영향 없음.
5. **인터페이스 변경** — `GET /executions/:id`, `POST /executions/:id/stop`,
   `GET /executions/:id/chain`, `GET .../background-runs/:id` 의 `error`/`nodeExecutions[].error`
   바이트 값이 자격증명 패턴에 한해 바뀐다(`***` 치환) — 이 PR 의 목적 그 자체이며
   CHANGELOG·DTO JSDoc·spec §R17 세 곳에 일관되게 문서화됨. 응답 필드 자체의 추가/삭제는
   없음(타입 좁힘은 컴파일 타임 전용, 런타임 JSON 필드 변화 없음).
6. **환경 변수** — 읽기/쓰기 없음.
7. **네트워크 호출** — 신규/변경 코드 어디에도 외부 호출 없음. `deepRedactSecrets` 는
   순수 in-memory 정규식 연산.
8. **이벤트/콜백** — 이번 diff 는 WS emit 경로(`websocket.gateway.ts`, `websocket.service.ts`,
   `event-emitter` 등)를 건드리지 않는다 — CHANGELOG 가 스스로 "WS `execution.node.*` emit
   은 잔여 갭" 이라 명시한 대로, 실제로 diff 에 해당 파일들이 없음을 `git diff --stat` 로
   재확인했다. 콜백 호출 순서·이벤트 발생 조건 변경 없음.

## 요약

이번 changeset 의 실질 코드 변경은 이미 DB 에서 조회·확정된 `Execution.error`/
`NodeExecution.error` 값을 응답 직전 마스킹하는 순수 동기 변환과, 그 마스킹을 4개 반환
표면(`findById`/`getChain`/`stop`/`toExecutionDto`, `background-runs` body)으로 수렴시키기
위한 소규모 리팩터(`stop()`/`stopInternal()` 분리, `toResponseExecution` 관문화)로 구성된다.
`stop()`/`getChain()` 의 반환 타입 좁힘은 유일하게 주목할 만한 인터페이스 변경이지만, 실제
호출자 전수(3곳)를 직접 grep·소스 대조로 재확인한 결과 응답 표면 하나(HTTP)에만 영향이
있고 그 표면조차 필드 손실이 없다(관계가 애초에 로드되지 않음, entity 정의로 직접 확인).
마스킹 함수 자체는 입력을 변이하지 않는 순수 함수이고, 재사용하는 module-level `WeakMap`
캐시는 이 PR 이전부터 있던 것으로 안전 경계(객체 identity 키)가 그대로 유지된다. 전역
변수·환경 변수·파일시스템·네트워크·이벤트 발생 경로 어디에도 새 부작용이 없다. 6라운드에
걸쳐 이미 수렴한 판정과 이번 독립 재검증 결과가 일치한다.

## 위험도

NONE
