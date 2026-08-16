# 부작용(Side Effect) 리뷰

## 검토 범위

이 diff 는 48개 파일을 건드리지만, 실제 런타임 동작(부작용 관점)이 있는 코드는 6개
TypeScript 파일뿐이다. 나머지(`.claude/docs/plan-lifecycle.md`, `plan/**`, `review/**`,
`spec/**`)는 전부 문서·plan·리뷰 산출물(prose/JSON 메타데이터)이라 부작용 관점에서
검토할 실행 경로가 없다. 코드 파일:

- `codebase/backend/src/shared/utils/redact-stored-error.ts` (신규)
- `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (신규)
- `codebase/backend/src/modules/executions/executions.service.ts`
- `codebase/backend/src/modules/executions/executions.service.spec.ts`
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`
- `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts`

프롬프트에서 diff 가 생략된 `executions.service.spec.ts` 는 `git diff origin/main...HEAD --
codebase/backend/src/modules/executions/executions.service.spec.ts` 로 직접 열어 전문을
확인했다. `stop()`/`toResponseExecution()` 의 실제 호출부(다른 모듈)는 저장소 전체를
grep 해 교차 검증했다.

## 발견사항

- **[WARNING]** `ExecutionsService.stop()` 의 반환값 정체성·내용이 조용히 바뀐다 — 시그니처(타입)는 그대로지만 동작 계약이 변한다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`stop` 메서드, 게이트 767~769줄 / `toResponseExecution` 922~928줄)
  - 상세: 종전 `stop(id): Promise<Execution>` 은 `executionRepository.findOne`/재조회로 얻은
    **엔티티 참조를 그대로** 반환했다(마스킹·relation strip 전혀 없음 — `getChain`/`findById`
    와 달리 `stripPrivateRelations` 를 타지 않던 유일한 공개 경로였다). 이번 변경으로
    `stop()` 은 내부 로직을 `stopInternal()`(private)로 옮기고, 공개 `stop()` 은
    `toResponseExecution(await this.stopInternal(id))` 을 반환한다 — 즉 (1) `trigger`/`executor`
    제거, (2) `error` 마스킹, (3) **새 객체로 복사**(참조 동일성 상실)라는 세 가지가 한꺼번에
    적용된다. `executions.service.spec.ts` 의 기존 단언 `expect(result).toBe(afterCancel)` 이
    이번 diff 에서 `toMatchObject` 로 교체된 것 자체가 이 정체성 변화의 직접 증거다.
    `ExecutionsService.stop()` 은 컨트롤러 외에도 `interaction.service.ts`(2곳,
    `:226`·`:248`)와 `hooks.service.ts`(`:407`) 세 곳에서 더 호출되는데, 세 곳 모두
    `await this.executionsService.stop(...)` 로 반환값을 **버리고** 있어 현재는 안전함을
    확인했다. 다만 이 메서드는 여러 모듈이 공유하는 서비스의 public 메서드라, 앞으로 이
    반환값을 사용하는 호출부가 추가되면(예: 취소 후 감사 로그에 원문 `error` 를 남기거나,
    반환 엔티티의 참조 동일성/후속 `save()` 를 기대하는 코드) 마스킹된 복사본이라는 사실을
    모른 채 조용히 오동작할 수 있다.
  - 제안: 이미 함수 docblock 에 "감싸는 쪽이 관문" 설명이 잘 남아 있으므로 문서 자체는
    충분하다. 다만 `stop()` 의 JSDoc/TSDoc 반환값 설명에 "응답은 마스킹된 **복사본**이며
    원본 엔티티와 참조 동일성이 없다" 를 한 줄 명시해 두면, 이후 새 호출부가 반환값을
    소비하기 시작할 때(현재는 없음) 이 계약을 놓치지 않는다.

- **[INFO]** `redactStoredErrorForResponse` 가 `sanitize-error-message.ts` 의 기존 모듈 레벨 `WeakMap` 캐시(`DEEP_REDACT_CACHE`)를 공유한다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:63` (`deepRedactSecrets(err)` 호출) — 캐시 자체는 `codebase/backend/src/shared/utils/sanitize-error-message.ts` (이번 diff 대상 아님)
  - 상세: `deepRedactSecrets` 는 depth-0 입력 객체 **참조 동일성**을 키로 하는 전역 `WeakMap`
    캐시를 이미 갖고 있다(WS sanitize·terminal-error-payload 등 기존 소비자들과 공유). 이번
    PR 이 신설한 4개 호출 지점(`toResponseExecution`·`findById` 의 `nodeExecutions[]` map·
    `toExecutionDto`·`background-runs.service.ts` 의 `toNodeExecutionDto`)도 이 공유 캐시를
    타게 된다. `WeakMap` 키가 매 쿼리마다 새로 생성되는 JS 객체(TypeORM row)이므로 요청 간
    교차 오염 가능성은 없고, 함수 자체가 "입력 불변·copy-on-change" 를 명시·테스트로
    고정하고 있어(`redact-stored-error.spec.ts` "입력 객체를 변이하지 않는다") 실질 위험은
    없다고 판단한다. 새 부작용을 만든 것은 아니고 기존 전역 캐시의 소비자가 늘었을
    뿐이므로 기록만 남긴다.

- **[INFO]** 4개 내부 REST 표면 + background-runs body 응답의 `error.message`/`error.details` 내용이 바뀐다(의도된 계약 변경)
  - 위치: `executions.service.ts` `toResponseExecution`(922~928줄)·`toExecutionDto`(883~888줄), `background-runs.service.ts` `toNodeExecutionDto`(296~304줄)
  - 상세: `GET /executions/:id`, `/workflow/:workflowId`, `/:id/chain`, `POST /:id/stop`,
    background-runs body 목록이 반환하는 `error` 필드의 **원문 문자열 내용**이 자격증명 패턴
    매치 시 `***` 로 치환된다. 이는 이 PR 의 명시적 목적(§R17 egress 마스킹 확장)이며
    함수/객체 형태(`{code, message, details?}`)는 보존되므로 프런트의 기존
    `error?.message` 렌더 경로는 그대로 동작한다. 다만 "부작용" 관점에서는 기존
    소비자(프런트 배너, 로그 상관관계 등)가 원문 문자열의 정확한 내용에 의존하고 있었다면
    영향받을 수 있다는 점은 명시해 둔다 — 새로 추가된 캐너리 테스트(`redact-stored-error.spec.ts`
    의 "평범한 에러 메시지는 손상하지 않는다")가 이 blast radius 를 자격증명 패턴에
    한정시켜 두었으므로 위험은 낮다.

- **[검토했으나 문제 없음]** private 메서드 개명(`stripPrivateRelations` → `toResponseExecution`)
  - 위치: `executions.service.ts:922`
  - 상세: `private` 이므로 외부 호출자가 없다. 저장소 전체 grep 결과 옛 이름은 이 PR 의
    설명용 주석(변경 이력 서술)에서만 등장하고 실제 참조는 0건이다. 시그니처·인터페이스
    영향 없음.

- **[검토했으나 문제 없음]** 신규 함수 `redactStoredErrorForResponse` — 환경변수·네트워크·파일시스템·전역 변수 도입 없음
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts`
  - 상세: 순수 함수, DB/네트워크/파일 I/O 없음. import 는 기존 leaf 모듈(`sanitize-error-message.ts`, 자체 import 0건)뿐이라 ES-module 순환(#1175 가 해소한 그것) 재유입도 없음을 확인했다.

## 요약

실질적인 런타임 부작용이 있는 코드는 egress 마스킹 유틸 신설과 그 소비처(내부 REST 4표면,
background-runs 목록) 배선으로 국한된다. 신규 함수는 순수하고 입력을 변이하지 않으며
(전용 테스트로 고정), 전역 변수·환경 변수·네트워크·파일시스템 부작용은 없다. 유일하게
주목할 지점은 `ExecutionsService.stop()` 의 반환값이 "원본 엔티티 참조" 에서 "마스킹된
복사본" 으로 바뀐 것인데, 시그니처(타입)는 유지되므로 컴파일러가 잡아주지 않는 암묵적
계약 변경이다. 현재 이 메서드의 3개 외부 호출부(`interaction.service.ts` 2곳,
`hooks.service.ts` 1곳)는 전부 반환값을 사용하지 않아 안전함을 직접 확인했지만, 향후
호출부가 반환값을 소비하기 시작하면 참조 동일성·원문 데이터를 암묵적으로 기대할 위험이
있어 WARNING 으로 기록한다. `deepRedactSecrets` 의 기존 전역 캐시를 새 호출부들이
공유하는 점은 신규 부작용이 아니라 기존 인프라의 소비자 증가이므로 INFO 로만 남긴다.

## 위험도

LOW
