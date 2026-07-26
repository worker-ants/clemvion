# 보안(Security) Review — linear-cancel-mechanism (7R)

## 리뷰 대상의 성격 (선행 확인)

`git show HEAD --stat` 로 실제 코드 diff 를 직접 확인했다 (프롬프트의 diff-list 는
`review/code/2026/07/26/{13_47_42,14_45_30}/**` 산출물만 담고 있어 이번 HEAD 커밋의
실제 소스 변경이 생략돼 있었기 때문). HEAD(`3428129b1`)의 실질 변경은 두 파일뿐이다.

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — W26:
  `finalizeCancelledExecution` 의 JSDoc 블록(17줄)을 `markNodeCancelled` 함수 뒤·
  `finalizeCancelledExecution` 함수 선언 앞으로 이동(순수 comment 재배치, 코드 로직 변경 0).
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — W27:
  기존 W15 회귀 테스트에 단언 2줄 추가.

나머지 변경은 `review/code/2026/07/26/15_56_53/**` 리뷰 산출물(md/json)과
`15_29_59/meta.json` 삭제로, 코드가 아니므로 보안 스코프 밖이다.

## 중점 검증 — 블록 이동이 `ExecutionCancelledError` client 노출 차단을 깨지 않았는가

`git show HEAD -- .../execution-engine.service.ts` 로 diff 를 직접 대조한 결과, 이동된
17줄은 전부 JSDoc 주석(`/** ... */`)이며 코드 라인은 diff 에 전혀 나타나지 않는다 —
`-` 로 삭제된 라인과 `+` 로 추가된 라인이 문자 그대로 동일한 주석 텍스트다. 이동 전후로
`markNodeCancelled`(4566행)와 `finalizeCancelledExecution`(4617행)의 함수 본문은
`git diff` 컨텍스트 상 전혀 건드려지지 않았다.

이동 후 파일을 직접 열어 재확인:

- `markNodeCancelled`(4566행) 본문: `if (errorEnvelope) nodeExecution.error = errorEnvelope;`
  — envelope 를 넘기지 않으면 `error` 필드가 세팅되지 않는다. WS emit payload 도
  `...(errorEnvelope ? { error: errorEnvelope } : {})` 로 동일 조건.
- 호출부 확인(5854~5859행, `executeNode` catch 의 `ExecutionCancelledError` 분기):
  `await this.markNodeCancelled(nodeExecution, node, context, executionId);` —
  `errorEnvelope` 인자 없이 호출. sentinel 의 message(executionId 포함)는 넘어가지 않는다.
- `finalizeCancelledExecution`(4617행, top-level Execution 종결) 호출부(4532~4534행,
  `runExecution` catch): `await this.finalizeCancelledExecution(savedExecution, 'runExecution');`
  — 두 번째 인자는 로그 태그 문자열(`'runExecution'`)일 뿐 에러 객체가 아니고, 헬퍼
  본문(4617~4630행) 어디에도 `savedExecution.error` 를 건드리는 코드가 없다.
- `grep -n "top-level 실행을 CANCELLED 로 종결하는 공통 처리"` 로 이동 후 중복 잔존 여부를
  확인 — 1건만 존재, 복제/유실 없음. 두 JSDoc 모두 자기 함수와 다시 인접했다(고아 상태 해소).

**결론**: 이동은 순수 comment relocation 이며 `ExecutionCancelledError` message 의 client
노출 차단 로직(조건부 `errorEnvelope` 전달)에는 어떤 영향도 주지 않았다.

## 중점 검증 — 신규 단언 2줄이 노출 차단을 강화했는가

`execution-engine.service.spec.ts` 의 W15 회귀 테스트("Sub-Workflow 노드에서
ExecutionCancelledError 가 발생하면 ... FAILED 로 오분류하거나 NODE_FAILED 를 emit 하지
않는다")에 추가된 두 줄:

```ts
expect(ne?.error).toBeUndefined();
expect(cancelCall?.[3]).not.toHaveProperty('error');
```

기존 단언은 `expect(JSON.stringify(cancelCall?.[3] ?? {})).not.toContain('cancelled externally')`
— 직렬화된 payload 문자열에 특정 문구가 없음만 확인하는 **부정(negative) substring 단언**이었다.
이는 (a) `error` 키 자체는 존재하되 값의 텍스트 형태만 달라지는 경우, (b) `message` 문구가
바뀌어도 executionId 가 다른 필드/포맷으로 실리는 경우를 놓칠 수 있는 약한 가드다.

신규 단언은 두 소비 지점(DB 영속 엔티티 `NodeExecution.error`, WS emit payload `error` 키) 모두에
대해 **구조적으로 키/필드 자체가 생기지 않는다**를 양성 단언한다:

- `NodeExecution.error` 컬럼은 `@Column({ type: 'jsonb', nullable: true })` (default 없음) —
  `nodeExecution.error = errorEnvelope` 대입이 없으면 in-memory 값은 `undefined` 로 유지되므로
  `toBeUndefined()` 단언이 실제로 대입 여부를 정확히 반영한다(엔티티 정의로 대조 확인).
- 커밋 메시지가 명시한 mutation 검증(임의의 leaked `error` 를 DB 필드·WS payload 양쪽에
  강제 주입 → 기존 4개 단언은 GREEN 유지 → 신규 2줄 추가 후 RED → 복원 GREEN)과 부합하는
  구조로, 이전 라운드에서 실제로 뚫렸던 취약점 클래스(substring 단언 우회)를 구조적으로 닫는다.

**결론**: 신규 단언은 기존 부정 substring 검사보다 엄격한 상위 호환 가드이며, `error` 키의
존재 자체를 막는 방식으로 executionId 노출 차단을 **강화**했다(약화·회귀 없음).

## 그 외 diff 범위 스캔

- `review/code/2026/07/26/15_56_53/**` 신규 리뷰 산출물(md/json)은 코드가 아니며, 하드코딩된
  시크릿·인젝션 표면·인증/인가 로직을 포함하지 않는다(내용 확인 — 전부 이전 라운드 리뷰
  텍스트/라우팅 메타데이터).
- `15_29_59/meta.json` 삭제는 정리성 변경으로 보안 영향 없음.
- 신규 로직·신규 엔드포인트·신규 의존성·SQL/쿼리 형태 변경 없음 — 인젝션·인증/인가·암호화
  관점에서 이번 diff 가 여는 새 표면이 없다.

## 발견사항

없음. (7라운드 누적 감사에서 이미 해소 확인된 W15/W16/W19 등은 재론하지 않음 — 지시대로.)

## 요약

HEAD 커밋(`3428129b1`)은 `git show HEAD` 로 직접 대조한 결과 순수 JSDoc 블록 이동(코드 로직
변경 0)과 기존 W15 회귀 테스트에 대한 단언 2줄 추가로 구성된다. 블록 이동은
`markNodeCancelled`/`finalizeCancelledExecution` 함수 본문을 전혀 건드리지 않았고, 두
함수 모두 이동 후 자기 JSDoc 과 재인접했으며 중복·유실도 없다. `ExecutionCancelledError`
sentinel message(executionId 포함)의 client 노출 차단은 두 호출부(`executeNode` catch,
`runExecution` catch) 모두에서 이동 전과 동일하게 유지된다 — `errorEnvelope` 를 넘기지 않는
조건부 로직 자체가 손대지지 않았다. 신규 테스트 단언 2줄은 기존의 약한 substring 부정 검사를
DB 엔티티·WS emit payload 양쪽에 대한 구조적 "키 부재" 양성 단언으로 대체해 보호를 강화했다.
이번 라운드에서 새로 발견된 보안 결함은 없다.

## 위험도

NONE
