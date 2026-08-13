# Cross-Spec 일관성 검토 — cross_spec

## 검토 범위 재확인

prompt payload 는 컨텍스트 예산 초과로 target 문서 본문·`git diff` 인용이 전부 생략되어
있었다(19개 spec/5-system 파일 + 95개 관련 spec 파일 전부 미포함). 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서 직접
`git diff origin/main...HEAD`(13 커밋)를 실행해 실제 변경 범위를 확인했다.

**`spec/**` 자체는 이번 diff 범위에 전혀 변경이 없다** (`git diff --name-only -- spec/` 결과
0건). target 으로 지정된 `spec/5-system/` 은 draft 본문 변경이 없는 상태이며, 실질 변경은
아래 코드/plan 파일 8개뿐이다 (review/** 산출물 제외):

- `codebase/backend/src/common/utils/assert-row-array.ts` (신규) / `.spec.ts` (신규)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/executions.service.ts` / `.spec.ts`
- `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts`
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts` (테스트 전용 —
  소스 `chat-channel.dispatcher.ts` 자체는 diff 에 없음)
- `plan/in-progress/backend-lint-gate-broken-on-main.md`
- `plan/in-progress/spec-draft-eia-notification-payload-contract.md`

이전 라운드(`17_05_10`, `18_50_06`)가 이미 거의 동일한 diff 를 NONE 으로 판정했다. 이번
라운드는 그 이후 두 커밋(`ef4ff8d5d` "throw 의 근거가 틀렸다 — attempts:1 이라 재배달은
없다", `e38eddaf3` "18_50_06 RESOLUTION")만 추가됐는지 확인했다 — **코드 로직 변경이 아니라
주석/근거 문구 정정과 plan frontmatter·RESOLUTION 문서 정리뿐**임을 diff 로 직접 검증했다.

## 발견사항

이번 diff 범위에서 CRITICAL/WARNING 급 cross-spec 충돌은 발견되지 않았다.

- **`assertRowArray` 4개 적용처 — 판정 로직 불변, 진단만 추가.** `admitExecutionOrDefer`
  (§8 admission gate), `lockNonTerminalExecutionRow`(§7.5 rehydration 계열),
  `computeChainDepth`(RR-PL-05), `updateExecutionStatus`(EIA §6 종결 이벤트) 네 곳 모두
  "raw SQL 결과가 배열이 아니면 즉시 throw" 만 추가했고, 배열인 정상 경로(빈 배열 포함)의
  의미는 그대로다. 각 지점을 spec 원문과 대조:
  - `RR-PL-05` — `spec/5-system/13-replay-rerun.md` §RR-PL-05(chain 깊이 32 제한, 에러 코드
    `RERUN_CHAIN_DEPTH_EXCEEDED`, L110/L241)와 `executions.service.ts` 의
    `RERUN_CHAIN_DEPTH_LIMIT`·`computeChainDepth` 가 일치. 가드가 막는 것은 "배열 아님 →
    `rows[0]` undefined → `depth ?? 1` 로 조용히 제한 우회"라는 **fail-open** 방향이라 기존
    제한을 더 엄격히 보존하는 방향.
  - `EIA §6 종결 이벤트` — `spec/5-system/14-external-interaction-api.md` L562 "종결
    이벤트의 필드 집합 (normative)" 이 `execution.completed`/`failed`/`cancelled` emit
    계약의 SoT. 가드가 막는 건 "false 로 넘어가 종결 이벤트가 관측 불가능하게 유실"되는
    경로이며, 필드 집합·봉투·`cancelled` 행동 계약 어느 것도 바꾸지 않는다.
  - `§8 admission gate` — `spec/5-system/4-execution-engine.md` L1138 "admission gate
    원자성(TOCTOU)" 서술(per-workspace advisory lock + 조건부 UPDATE RETURNING)과 코드
    주석이 정확히 대응. throw 시 `runExecutionFromQueue` 가 잡아 `releaseExecutionRouting`
    후 재전파하는 것도, spec 이 이미 문서화한 "deferred/cancelled 양쪽 다 routing context 를
    release 한다"는 기존 패턴을 throw 경로에 동형 확장한 것뿐이라 새 계약이 아니다.
- **`attempts:1` 재배달 주석 정정 — 독립 검증 완료.** `execution-run.queue.ts` 의
  `EXECUTION_RUN_QUEUE_DEFAULT_OPTS`(`attempts: 1, removeOnComplete: true,
  removeOnFail: false`)를 직접 읽어, "명시 throw 는 BullMQ job attempts 재시도로
  재배달되지 않는다"(재배달은 §7.1 stalled-job 전용 별개 카운터)는 최신 주석 서술이
  맞음을 확인했다. spec 쪽(`spec/5-system/4-execution-engine.md` §7.1/§7.4 stalled 재배달·
  §8 orphan-pending backstop 서술)과도 모순 없음 — 이 정정은 코드 로직이 아니라 근거
  서술만 바꿨으므로 spec 계약에 영향이 없다.
- **`executions-rerun.service.spec.ts`/`executions.service.spec.ts`/
  `execution-engine.service.spec.ts` 신규 테스트** — 위 가드들의 fail-closed/fail-open
  방향을 가르는 회귀 테스트만 추가, 프로덕션 계약 변경 없음.
- **`chat-channel.dispatcher.spec.ts`** — 대상 소스(`chat-channel.dispatcher.ts`)는 이번
  diff 에 없다(테스트 harness 추출 + null 이벤트 로그 레벨(`debug` vs `warn`) 분기 회귀
  테스트만 추가). `spec/5-system/15-chat-channel.md`·`spec/conventions/chat-channel-adapter.md`·
  `spec/data-flow/14-chat-channel.md` 어느 쪽도 새 동작을 서술할 필요가 생기지 않는다.
- **`plan/in-progress/spec-draft-eia-notification-payload-contract.md`** — 체크리스트
  자기모순 잔재(직전 라운드가 이미 지적) 제거 + `worktree:` frontmatter 정정. 이 파일이
  서술하는 spec 상태(EIA §6 도입부, WS §4.1 포인터화 등)는 이미 `origin/main` 에 병합된
  별도 PR(#1166 계열) 결과의 사후 기록이며, 이번 diff 는 그 기록을 정리했을 뿐 spec 본문을
  추가로 건드리지 않는다.

## 참고 (INFO, 이번 diff 기인 아님 — 재확인만)

`spec/5-system/14-external-interaction-api.md` §R8("Idempotency-Key 와 `submit_form`
검증 실패의 관계")과 `spec/5-system/15-chat-channel.md` R8("Fan-out facade 의 분리")이
서로 다른 결정에 동일 로컬 레이블 `R8` 을 쓴다. 각 문서가 파일 단위로 독립적으로 R1..Rn 을
번호 매기는 기존 컨벤션이고 cross-reference 는 항상 문서명을 동반해 모호성이 실질적으로
없다(직전 두 라운드에서도 액션 불필요로 확정). task 이름("eia-r8-cache-scope")이 이
`R8` 과 `SNAPSHOT_CACHE_MAX_ENTRIES`(execution `findById` 결과의 인스턴스-로컬 LRU, EIA
idempotency 캐시와 무관)를 연상시킬 수 있으나 이번 diff 는 `SNAPSHOT_CACHE_MAX_ENTRIES`
자체를 건드리지 않았다(export 전환은 `17_05_10` 라운드에 이미 검토·확정). 액션 불필요.

## 요약

이번 라운드의 실제 diff(`origin/main...HEAD`, 13 커밋)는 `spec/5-system/**` 문서 변경
없이 순수 코드 하드닝(4개 지점 `assertRowArray` 적용)·회귀 테스트·주석 정정(재배달
근거 오서술 수정)·plan 문서 정리로만 구성된다. 각 하드닝 지점을 대응하는 spec 절(§8
admission gate·RR-PL-05 chain depth·EIA §6 종결 이벤트 필드 집합)과 대조하고, `attempts:1`
같은 정정된 사실 주장도 코드에서 직접 재확인한 결과, 데이터 모델·API 계약·요구사항 ID·
상태 전이·RBAC·계층 책임 6개 관점 어디에서도 직접적 모순을 찾지 못했다. 이전 두 라운드의
NONE 판정과 일치하며, 이번에 추가된 두 커밋은 논리 변경이 아니라 근거 서술 정정이라 판정을
바꿀 요인이 없다.

## 위험도
NONE
