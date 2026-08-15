# 신규 식별자 충돌 검토 — naming_collision

## 조사 방법 메모

`_prompts/naming_collision.md` 에 번들된 target 은 `spec/5-system/` 전체였으나, 컨텍스트
예산 초과로 `1-auth.md`/`2-api-convention.md`/`3-error-handling.md` 를 제외한 나머지
(`4-execution-engine.md`, `14-external-interaction-api.md` 등 이 worktree 의 실제 작업
대상 포함)는 본문이 전부 절단되어 있었다. 번들만으로는 이번 턴에 **실제로 무엇이 새로
도입됐는지** 판단할 수 없어, `git status`/`git diff`(uncommitted) + `git show HEAD:...`
(직전 커밋 상태) 로 이 worktree 의 실제 변경분을 직접 대조했다.

실제 변경분 (uncommitted):

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`
- `spec/conventions/node-cancellation.md` (+1행)
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (체크박스 갱신)
- `plan/in-progress/eia-stalled-atomicity.md` (신규 plan)

`spec/5-system/**` 자체에는 diff 가 없다 (번들 절단으로 "target" 처럼 보였으나 이번
턴의 실제 변경 대상이 아니다).

## 변경 내용 요약

기존 함수 `finalizeStalledExhausted`(PR4, 2026-07-04 도입·다수 spec/코드에 이미 정착된
식별자)의 **본문만** 수정 — 기존에 각각 autocommit 이던 Execution UPDATE + NodeExecution
cascade UPDATE 두 문장을 `dataSource.transaction()` 단일 트랜잭션으로 묶었다. 자매 함수
`cancelParkedExecution`/`markWebChatIdleTimeout` 과 동형 패턴. `node-cancellation.md` 의
기존 커버리지 표에 이 함수를 가리키는 행 1개가 추가됐다.

## 점검 관점별 확인

1. **요구사항 ID 충돌** — 신규 ID 없음. `node-cancellation.md` 표의 신규 행은 기존 §2.4
   섹션 안에 붙었고 새 ID 를 채번하지 않는다.
2. **엔티티/타입명 충돌** — 신규 엔티티·DTO 없음. `Execution`/`NodeExecution` 은 기존
   엔티티 그대로 재사용.
3. **API endpoint 충돌** — 신규 endpoint 없음. wire 표면(REST/emit) 불변.
4. **이벤트/메시지명 충돌** — 신규 이벤트 없음. `EXECUTION_FAILED` emit·`WORKER_HEARTBEAT_TIMEOUT`
   에러 코드 모두 기존 값 재사용 (`error-codes.md` 에 이미 등재, rename 아님).
5. **환경변수·설정키 충돌** — 없음.
6. **파일 경로 충돌** — 신규 plan 파일 `plan/in-progress/eia-stalled-atomicity.md` 는
   `eia-*.md` 명명 컨벤션(기존 `eia-command-waiting-surface-guard.md` 등 다수 선례)과
   일치하고, `find plan -iname "*stalled*"` 로 확인한 결과 기존에 동명 파일이 없다.
   신규 브랜치명 `claude/eia-stalled-atomicity` 도 겹치는 기존 브랜치 없음.

## 부수 확인 — 테스트 헬퍼 명

`execution-engine.service.spec.ts` 에 신규 로컬 헬퍼 `installStalledTx` 를 추가했다.
같은 파일의 기존 헬퍼 `installCancelTx`(다른 `describe` 블록 스코프)와 이름이 유사하지만
의도적 대칭 명명("자매 `installCancelTx` 와 동형" 주석으로 명시)이며, 둘 다 각 `describe`
콜백의 지역 `const` 로 스코프가 분리돼 있어 실제 JS 스코프 충돌은 없다. export 되지 않으므로
모듈 경계를 넘는 충돌 가능성도 없다.

`finalizeStalledExhausted` 자체는 `grep -rn` 결과 `spec/5-system/4-execution-engine.md`,
`spec/data-flow/3-execution.md`, `spec/conventions/error-codes.md`,
`spec/2-navigation/0-dashboard.md`, `execution-run.processor.ts` 등 다수 문서/코드에서
이미 동일 의미로 일관되게 쓰이고 있다 — 새 이름이 아니라 기존 식별자의 재사용이다.

## 발견사항

없음 — 이번 턴이 도입하는 신규 식별자(요구사항 ID·엔티티·endpoint·이벤트·env var·config
key·spec 파일 경로) 자체가 없다. 유일한 "신규"는 로컬 테스트 헬퍼 `installStalledTx` 와
plan 파일 `eia-stalled-atomicity.md` 이며 둘 다 기존 명명 컨벤션과 정합하고 충돌 없음.

## 요약

이번 turn 의 실제 diff 는 기존에 이미 정착된 함수 `finalizeStalledExhausted` 의 내부
구현을 자매 함수와 동형으로 트랜잭션화하는 버그 수정으로, 새 요구사항 ID·엔티티·API
endpoint·이벤트명·환경변수·spec 파일 경로를 전혀 도입하지 않는다. 유일한 신규 산출물인
로컬 테스트 헬퍼명과 plan 파일명은 기존 저장소 명명 컨벤션(자매 헬퍼 대칭 명명,
`eia-*.md` plan 슬러그)과 정합하며 기존 사용처와 겹치지 않는다. 다만 orchestrator 가
전달한 번들은 이 worktree 의 실제 target 파일(`spec/5-system/14-external-interaction-api.md`
등) 본문을 컨텍스트 예산 초과로 전부 절단했다는 점은 별도로 인지할 필요가 있다 — 이번
턴은 git diff 직접 대조로 우회했지만, 향후 이 파일들에 대한 naming-collision 검토가
번들 콘텐츠에만 의존하면 거짓 음성(false negative)이 될 수 있다.

## 위험도

NONE
