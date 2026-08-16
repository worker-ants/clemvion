# 부작용(Side Effect) 리뷰

## 검토 범위와 방법

프롬프트에 포함된 73개 파일 중 실제 런타임 부작용을 검토할 대상은 6개 TypeScript
파일이다 (나머지는 `plan/**`·`review/**`·`spec/**`·`CHANGELOG.md`·
`.claude/docs/plan-lifecycle.md` 로 전부 문서/메타데이터라 실행 경로가 없다):

- `codebase/backend/src/shared/utils/redact-stored-error.ts` (신규)
- `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/executions/executions.service.spec.ts`
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts`

프롬프트에서 diff 가 생략된 `executions.service.ts`/`executions.service.spec.ts` 는
`git diff origin/main...HEAD -- <path>` 로 전문을 직접 열어 확인했다. `stop()` ·
`findById()` · `getChain()` · `ExecutionDetailWithTrigger` / `ResponseExecution` 타입의
실제 소비처는 저장소 전체를 grep 해 교차 검증했다 (`interaction.service.ts`,
`hooks.service.ts`, `executions.controller.ts`, `websocket.gateway.ts`).

이 diff 는 직전 라운드(`review/code/2026/08/16/17_12_34/side_effect.md`)가 이미 이
코드 경로를 검토해 WARNING 1건·INFO 2건을 남겼고, `RESOLUTION.md` 가 WARNING 을
"문서화 + 실측"으로 처리했다고 기록하고 있다. 아래는 그 처리가 실제로 코드에
반영됐는지 독립적으로 재검증한 결과다.

## 발견사항

- **[INFO]** `ExecutionsService.stop()` 반환값의 정체성(참조 동일성·prototype)이
  바뀌는 계약 변경 — 직전 라운드 WARNING 이 실제로 해소돼 있음을 재확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `stop`/
    `stopInternal`/`toResponseExecution` 메서드
  - 상세: 종전 `stop()` 은 재조회한 **엔티티 인스턴스**를 그대로 반환했으나(마스킹·
    relation strip 없음), 이번 변경으로 `stop()` → `toResponseExecution(stopInternal())`
    경유로 바뀌어 (1) `trigger`/`executor` 제거, (2) `error` 마스킹, (3) 새 plain
    object 로 복사(참조 동일성·엔티티 prototype 상실)가 함께 적용된다. 반환 타입도
    `Promise<Execution>` → `Promise<ResponseExecution>` 로 좁아졌다(공개 메서드
    시그니처 변경).
    직접 확인한 결과, 이 메서드의 외부 호출부 3곳 — `interaction.service.ts:226`,
    `:248`, `hooks.service.ts:407` — 는 전부 `await this.executionsService.stop(...)`
    로 반환값을 **버리고** 있어 영향이 없다. `executions.controller.ts:145` 는
    반환값을 그대로 HTTP 응답으로 흘려보내는데, 이 서비스는
    `ClassSerializerInterceptor`/entity 상 `@Exclude`·`@Expose` 데코레이터를 쓰지
    않는 것으로 확인돼(grep 0건) prototype 손실이 JSON 직렬화에 영향을 주지 않는다.
    `Execution` 엔티티에는 컬럼 데코레이터 외 커스텀 메서드/getter 도 없어(grep 0건)
    prototype 손실 자체가 무해하다. `trigger`/`executor` 관계는 `stopInternal` 의
    `findOne({ where: { id } })` 가 `relations` 를 지정하지 않아(엔티티 정의상
    `eager` 도 아님) 애초에 로드되지 않았으므로, 타입에서 빠졌다고 해서 응답에서
    사라지는 값이 실제로는 없다 — JSDoc 의 "실측" 주장을 코드로 재확인했다.
    `executions.service.spec.ts` 의 `expect(result).toBe(afterCancel)` →
    `toMatchObject` 교체, 그리고 신규 `Execution.error 응답 마스킹 — 표면 전수` 스위트의
    `④`/`④-b` 케이스가 이 계약 변경을 회귀 테스트로 고정하고 있다.
  - 결론: 직전 라운드가 제안한 "JSDoc 에 참조 비동일성 명시"가 실제로
    `stop()`/`toResponseExecution()` 의 TSDoc(`## 반환 계약이 바뀌었다 (2026-08-16)`)에
    반영돼 있고, 실측 근거(관계 미로드)까지 문서화됐다. 추가 조치 불요 — 기록만 남긴다.

- **[INFO]** `redactStoredErrorForResponse` 가 `sanitize-error-message.ts` 의 기존
  모듈 레벨 `WeakMap` 캐시(`DEEP_REDACT_CACHE`)를 공유한다 — 새 부작용이 아니라 기존
  전역 캐시의 소비자 증가
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts` (함수 본문의
    `deepRedactSecrets(err)` 호출) — 캐시 정의 자체는 이번 diff 대상이 아닌
    `sanitize-error-message.ts` 에 있다
  - 상세: 이번 PR 이 신설한 4개 신규 호출 지점(`ExecutionsService.toResponseExecution`
    · `findById` 의 `nodeExecutions[]` map · `toExecutionDto` · `BackgroundRunsService`
    의 `toNodeExecutionDto`)이 전부 이 공유 `WeakMap` 캐시를 타게 된다. 키가 매 쿼리마다
    새로 생성되는 TypeORM row 객체라 요청 간 교차 오염 가능성은 없고, 함수 자체가
    "입력 불변·copy-on-change" 를 전용 테스트(`redact-stored-error.spec.ts` "입력
    객체를 변이하지 않는다")로 고정하므로 실질 위험은 없다. `executions.service.spec.ts`
    의 "DB 원문은 건드리지 않는다 — egress-only (§R17)" 케이스도 동일 보장을
    독립적으로 재확인한다.

- **[검토했으나 문제 없음]** `nodeExecutions[]` 마스킹의 copy-on-change 준수
  - 위치: `executions.service.ts` `findById` 내부 `reconciledNodeExecutions` 조립부
  - 상세: `error == null` 인 행(절대다수)은 원본 참조를 그대로 반환하고, `error` 가
    있는 행만 `{ ...ne, error: redactStoredErrorForResponse(ne.error) }` 로 얕은
    복사한다. 자매 함수 `reconcilePreParkWaitingStatus` 가 지키는 "무변이 원칙"과
    동일한 관례를 유지하며, 원본 엔티티 배열/객체는 변이되지 않는다(전용 테스트로
    확인).

- **[검토했으나 문제 없음]** `ExecutionDetailWithTrigger`/`ResponseExecution` 신규
  export 타입의 외부 영향
  - 위치: `executions.service.ts` 상단 타입 선언
  - 상세: 저장소 전체 grep 결과 두 타입을 참조하는 곳은 `executions.service.ts`
    자신뿐이다(0건 외부 소비). `getChain()` 의 반환 타입이 `Execution[]` →
    `ResponseExecution[]` 로, `findById`/`ExecutionDetailWithTrigger` 가 `Execution &
    {...}` → `ResponseExecution & {...}` 로 좁아졌지만, 두 메서드의 유일한 호출부인
    `executions.controller.ts` 는 반환값을 그대로 HTTP 응답으로 넘길 뿐 타입에
    의존한 분기가 없고, `websocket.gateway.ts:399` 의 `findById` 소비도 마찬가지로
    payload 에 그대로 실을 뿐이다. 인터페이스 변경의 실질 영향은 없음.

- **[검토했으나 문제 없음]** 신규 함수 `redactStoredErrorForResponse` — 전역
  변수·환경 변수·네트워크·파일시스템 부작용 없음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts`
  - 상세: 순수 함수이며 DB/네트워크/파일 I/O 가 없다. import 는 기존 leaf 모듈
    (`sanitize-error-message.ts`, 그 자신은 추가 import 0건)뿐이라 #1175 가 해소한
    ES-module 순환(ws.service ↔ gateway ↔ event-emitter)에 재유입하지 않는다.
    `background-runs.service.ts` 의 신규 import 도 동일 leaf 모듈이라 순환 위험이 없다.

- **[검토했으나 문제 없음]** `stop()`/`findById` 등 시그니처·본문 변경이 `console.*`,
  `process.env`, `fs.*`, HTTP 클라이언트 호출을 새로 추가하지 않음
  - 위치: `executions.service.ts`, `background-runs.service.ts`,
    `redact-stored-error.ts` 전체 diff
  - 상세: 위 3개 파일의 diff hunk 를 전부 대상으로 `console.`/`process.env`/`fs.`/
    `fetch(`/`axios`/`http.request` 패턴을 grep 했으나 매치 0건.

## 요약

이번 diff 의 실질적 런타임 부작용은 egress 마스킹 유틸(`redactStoredErrorForResponse`)
신설과 그 소비처(내부 REST 4표면 + background-runs body 목록) 배선으로 국한된다. 함수
자체는 순수하고 입력을 변이하지 않으며 전용 테스트로 그 보장을 고정했다. 유일하게
주목할 만한 지점 — `ExecutionsService.stop()` 반환값이 "엔티티 참조" 에서 "마스킹된
복사본" 으로 바뀐 시그니처/계약 변경 — 은 직전 리뷰 라운드에서 WARNING 으로 지적됐던
것인데, 이번 세션에서 실제 코드·JSDoc·회귀 테스트·호출부 3곳을 모두 재확인한 결과
제안된 조치(문서화 + 무해성 실측)가 정확히 반영돼 있다. 새로 등장한 issue 는 없다.
공유 전역 `WeakMap` 캐시(`DEEP_REDACT_CACHE`)의 소비자가 늘어난 점도 기존 인프라의
확장일 뿐 신규 위험을 만들지 않는다. 전역 변수 신설, 환경 변수 읽기/쓰기, 파일시스템
부작용, 의도치 않은 네트워크 호출, 이벤트/콜백 발생 패턴 변경은 발견되지 않았다.

## 위험도

LOW
