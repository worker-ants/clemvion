# 신규 식별자 충돌 검토

## 검토 범위 요약

target: `spec/5-system/`, diff-base `origin/main`. 실제 diff 는
`spec/5-system/4-execution-engine.md` 단 1개 파일(+8/-1)이며, 대응 구현은
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` /
`.spec.ts`. 내용은 기존 함수 `finalizeStalledExhausted` 의 2-테이블 UPDATE(Execution
FAILED + 자식 NodeExecution cascade)를 단일 `dataSource.transaction` 으로 묶은
버그 수정(plan: `plan/in-progress/eia-stalled-atomicity.md`)이다.

## 발견사항

없음. 이 PR 이 도입하는 새 요구사항 ID·엔티티/DTO/인터페이스명·API endpoint·이벤트명·
ENV/config 키·spec 파일 경로가 **전무**하다. 근거:

- spec diff(`4-execution-engine.md`)가 참조하는 식별자 `finalizeStalledExhausted`,
  `cancelParkedExecution`, `markWebChatIdleTimeout`, `dataSource.transaction` 은 모두
  `origin/main` 시점에 이미 spec/코드 양쪽에 존재했다 (`git show origin/main:spec/5-system/4-execution-engine.md`
  및 `git show origin/main:codebase/backend/.../execution-engine.service.spec.ts` 에서 확인).
  이번 diff 는 기존 함수의 **주석/설명 보강**(트랜잭션화 사실 기록)일 뿐, 새 이름을
  부여하지 않는다.
- 코드 diff 는 `finalizeStalledExhausted` 내부를 `this.dataSource.transaction(async (manager) => {...})`
  으로 재구성했다. 새로 생긴 로컬 변수 `finalized`, `stalledDurationMs` 는 함수 스코프
  내부 플래그로, spec 이 다루는 "신규 식별자"(엔티티/DTO/endpoint/이벤트/ENV) 범주에
  해당하지 않는다.
- 테스트 diff 에 새 헬퍼 `installStalledTx` 가 추가됐으나, 이는 이미 존재하던 자매
  헬퍼 `installCancelTx`(`git show origin/main:...execution-engine.service.spec.ts:3281`)와
  동형으로 명명된 **비공개 테스트 유틸**이다. 오히려 기존 명명 관례(`install<Sibling>Tx`)를
  그대로 따라 일관성을 지켰다 — 충돌도, 명명 컨벤션 위반도 없다.
- `CHANGELOG.md` 항목도 위와 동일한 기존 식별자만 언급하며 신규 타입/엔드포인트를
  선언하지 않는다.
- API endpoint·webhook/queue/SSE 이벤트명·ENV var·config key·spec 파일 경로 자체의
  변경/신설은 diff 어디에도 없다 (`execution-run` 큐명, `WORKER_HEARTBEAT_TIMEOUT`
  에러코드 등은 모두 기존 값 그대로 재인용).

## 요약

이번 target(`spec/5-system/`) diff 는 신규 식별자를 전혀 도입하지 않는 순수 버그 수정
(트랜잭션 원자성 보강) 문서화다. 참조된 모든 함수명·에러코드·큐명·트랜잭션 API 는
`origin/main` 시점에 이미 존재했고, 새로 추가된 테스트 헬퍼도 기존 자매 헬퍼의 명명
패턴을 그대로 따랐다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
