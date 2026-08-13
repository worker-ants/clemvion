# Cross-Spec 일관성 검토 — cross_spec

## 검토 범위 재확인

prompt payload 는 컨텍스트 예산 초과로 target 문서 본문·`git diff` 인용이 전부 생략되어
있었다. 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
직접 `git diff origin/main...HEAD`(11 커밋, 85 파일, +7072/-56)를 실행해 실제 변경 범위를
확인했다. 이 중 `review/**`(전량, 이전 라운드 ai-review·consistency 산출물) 를 제외하면
실질 변경은 아래 10 파일뿐이다.

- `codebase/backend/src/common/utils/assert-row-array.ts` (신규) / `.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts`
- `plan/in-progress/backend-lint-gate-broken-on-main.md`
- `plan/in-progress/spec-draft-eia-notification-payload-contract.md`

**`spec/5-system/**` 자체에는 이번 diff 범위에 변경이 없다.** 즉 target 은 "spec 문서
draft" 가 아니라, `spec/5-system/` 이 규율하는 코드 영역(execution-engine·executions·
chat-channel)에 대한 순수 구현 변경이다. 이전 라운드(`17_05_10`, HEAD 4커밋 시점)가 같은
방향의 부분집합을 이미 NONE 으로 판정했고, 이번 라운드는 그 이후 추가된 커밋(신규
`assertRowArray` 공용 헬퍼로의 리팩터 + 적용처 확장 4곳, admission throw 시 routing
context release, plan 체크리스트 자기모순 잔재 해소)까지 포함해 재검토했다.

## 발견사항

이번 diff 범위에서 CRITICAL/WARNING 급 cross-spec 충돌은 발견되지 않았다.

- **`assertRowArray` 4개 적용처 전부 판정 로직 불변, 진단만 추가** — `admitExecutionOrDefer`
  (§8 admission gate), `lockNonTerminalExecutionRow`(§7.5 rehydration 계열), `computeChainDepth`
  (RR-PL-05), `updateExecutionStatus`(EIA §6 종결 이벤트) 네 곳 모두 "raw SQL 결과가 배열이
  아니면 즉시 throw" 만 추가했고, 배열인 정상 경로(빈 배열 포함 — 즉 "0행 매칭"이라는 기존
  정당한 신호)의 의미는 그대로다. 각 지점에서 spec 원문과 대조했다:
  - `RR-PL-05` — `spec/5-system/13-replay-rerun.md` §RR-PL-05 (chain 깊이 32 제한)와
    `executions.service.ts` 의 `RERUN_CHAIN_DEPTH_LIMIT` 주석·에러 코드 `RERUN_CHAIN_DEPTH_EXCEEDED`
    가 일치. `spec/2-navigation/_product-overview.md` EH-DETAIL-11 의 앵커도 동일 절을
    가리켜 3중 상호 참조가 정합함을 확인.
  - `EIA §6 종결 이벤트` — `spec/5-system/14-external-interaction-api.md` "종결 이벤트의
    필드 집합 (normative)" 절(L562)이 `execution.completed`/`failed`/`cancelled` emit 계약의
    SoT 임을 명시. 코드 주석의 "false 로 넘기면 종결 이벤트가 조용히 유실된다" 는 이 계약을
    더 엄격히 보존하는 방향(관측 불가능한 유실 → 관측 가능한 실패)이며 필드 집합·채널별
    봉투·`cancelled` 행동 계약 어느 것도 바꾸지 않는다.
  - `§8 admission gate` — `spec/5-system/4-execution-engine.md` §8 "admission gate
    원자성(TOCTOU)" 서술(per-workspace advisory lock + 조건부 UPDATE RETURNING)과 코드
    주석이 정확히 대응. admission 이 throw 하면 `runExecutionFromQueue`(BullMQ consumer)가
    잡아 `releaseExecutionRouting` 후 재전파하도록 바뀐 부분도, 이미 spec 이 문서화한
    "deferred/cancelled 양쪽 다 routing context 를 release 한다"는 기존 패턴을 throw 경로에도
    동형으로 확장한 것뿐이라 새 계약이 아니다.
- **`executions-rerun.service.spec.ts`/`executions.service.spec.ts` 신규 테스트** — 위
  가드들의 fail-closed/fail-open 방향을 가르는 회귀 테스트만 추가, 프로덕션 계약 변경 없음.
- **`chat-channel.dispatcher.spec.ts`** — 대상 소스 `chat-channel.dispatcher.ts` 자체는
  이번 diff 에 없다(테스트 전용 harness 추출 + 로그 레벨 분기 회귀 테스트). `spec/5-system/15-chat-channel.md`·
  `spec/conventions/chat-channel-adapter.md`·`spec/data-flow/14-chat-channel.md` 어느 쪽도
  새 동작을 서술할 필요가 생기지 않았다.
- **`plan/in-progress/spec-draft-eia-notification-payload-contract.md`** — 이전 라운드
  (`17_05_10` plan_coherence WARNING 1)가 지적한 "체크리스트 잔재로 인한 완료/미완료 자기모순
  8줄"이 이번 diff 에서 제거·정리됐다(헤딩 구조 확인 완료 — 중복·깨진 헤딩 없음, `## 후속
  (developer)` 항목 수도 서술된 9건과 실제 일치). Cross-spec 관점에서 이 파일이 주장하는
  spec 상태(EIA §6 도입부 신설, WS §4.1 포인터화, `chat-channel-adapter.md` §1.2 축약 등)는
  모두 `origin/main` 에 이미 병합된 별도 PR(#1166 계열)의 결과 서술이며, 이번 diff 는 그
  사후 기록을 정리했을 뿐 spec 본문을 추가로 건드리지 않는다.

## 참고 (INFO, 이번 diff 기인 아님 — 재확인만)

`spec/5-system/14-external-interaction-api.md` §R8("Idempotency-Key 와 `submit_form`
검증 실패의 관계")과 `spec/5-system/15-chat-channel.md` R8("Fan-out facade 의 분리")이
서로 다른 결정에 동일 로컬 레이블 `R8` 을 쓴다. 각 문서가 파일 단위로 독립적으로 R1..Rn 을
번호 매기는 기존 컨벤션이고 cross-reference 는 항상 문서명을 동반해 모호성이 실질적으로
없다. task 이름("eia-r8-cache-scope")이 이 `R8` 과 `SNAPSHOT_CACHE_MAX_ENTRIES`(execution
findById 결과의 인스턴스-로컬 LRU, EIA idempotency 캐시와 무관)를 연상시킬 수 있으나 이번
diff 는 `SNAPSHOT_CACHE_MAX_ENTRIES` 자체를 건드리지 않았다(이전 export 변경은 `17_05_10`
라운드에 이미 검토·확정됨). 액션 불필요.

## 요약

이번 라운드의 실제 diff(`origin/main...HEAD`, 11 커밋)는 `spec/5-system/**` 문서 변경
없이, execution-engine/executions 모듈의 raw SQL 결과 shape 방어를 공용 헬퍼
(`assertRowArray`)로 통합하고 4개 지점(§8 admission gate·§7.5 rehydration 계열·
RR-PL-05 chain depth·EIA §6 종결 이벤트)에 적용한 순수 하드닝 + 회귀 테스트, 그리고 이전
라운드가 지적한 plan 체크리스트 자기모순의 해소로 구성된다. 각 적용처를 대응하는 spec 절
(§8 admission gate·§RR-PL-05·EIA §6 종결 이벤트 필드 집합)과 대조한 결과, 판정 로직·필드
집합·상태 전이·요구사항 ID 어느 것도 바뀌지 않았고 기존에 문서화된 fail-closed 원칙과
routing-context release 패턴을 일관되게 확장했을 뿐이다. 데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC·계층 책임 6개 관점 모두에서 직접적 모순을 찾지 못했다.

## 위험도
NONE
