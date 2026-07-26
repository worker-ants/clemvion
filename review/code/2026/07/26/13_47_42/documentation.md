# 문서화(Documentation) Review — linear-cancel-mechanism (3R, W13 해소 검증 + 신규 스로틀 문서 대조)

대상: `review/code/2026/07/26/12_55_55` SUMMARY 의 C5·W9~W13(특히 W13 "status 단일 컬럼" 문구
불일치) 조치 커밋 `10b27c320` 검증 + 이번 커밋이 새로 도입한 아이템-경계 cancel 가드 스로틀
(`{ throttle: true }`, `CONTAINER_CANCEL_CHECK_THROTTLE_MS`)의 JSDoc·CHANGELOG·plan 기록이
실제 구현과 일치하는지 대조. 검증은 프롬프트 diff 뿐 아니라 `git show HEAD:<path>` 로 커밋된
스냅샷을 직접 열어 대조했다 — 작업 중 workspace 파일이 순간적으로 `// MUTATED-OUT:` 상태로
읽힌 사례가 있었으나(`execution-engine.service.spec.ts` W10 회귀 테스트의
`simulatedNow += 300;` 줄), `git status`/`git show HEAD` 로 재확인한 결과 커밋된 상태에는
정상 코드만 있다 — 동일 워크트리에서 진행 중인 별도 mutation 검증 프로세스의 순간적 파일
상태였을 뿐 실제 결함이 아니다(직전 라운드 documentation.md 가 이미 같은 현상을 "스코프 밖"
으로 기록해 둔 것과 동일 클래스).

## W13 재검증 결과 — 해소 확인

직전 라운드(`12_55_55`)가 지적한 "JSDoc/CHANGELOG 의 'status **단일** 컬럼' 서술이 실제
`select:{id:true,status:true}`(2컬럼)와 근소 불일치" 문제는 이번 커밋(`10b27c320`)으로
완전히 해소됐다.

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
  `assertExecutionNotCancelled` JSDoc(실제 파일 기준 7880-7885행)이 "노드 경계마다 PK 인덱스
  SELECT 1건(id/status 2개 컬럼 — ... `findOne({select:{id:true,status:true}})` 로 컬럼
  투영해 실제로 id/status 2개 컬럼만 왕복한다 — ai-review W13, 2026-07-26: 이전 JSDoc 이
  '단일 컬럼' 이라 서술했으나 `select` 는 `id`/`status` 2개를 명시한다)" 로 정정됐고, 실제
  구현(`select: { id: true, status: true }`, 같은 파일 7920행)과 문자 그대로 일치한다.
- `CHANGELOG.md:14` 도 "`id`/`status` 2개 컬럼만 투영하도록 변경" 으로 동일하게 정정됐다.
- 두 위치 모두 `git show HEAD`로 확정한 committed 상태 기준 대조를 마쳤다 — 더 이상 재론할
  사항 없음.

## 신규(W10) 스로틀 JSDoc·CHANGELOG·plan 기록 대조

`assertExecutionNotCancelled(executionId, { throttle: true })` 옵션과
`CONTAINER_CANCEL_CHECK_THROTTLE_MS = 250` 상수, 상태 Map `containerCancelCheckedAtMs`
관련 문서를 실제 코드와 항목별로 대조했다.

- **호출부 구분(아이템 경계 vs 노드 경계)** — JSDoc·CHANGELOG·plan 모두 "`executeContainerBody`
  (아이템 경계)만 스로틀 사용, `executeParallelBranchBody`/선형 dispatch loop(노드 경계)는
  매번 실제 조회" 라고 서술한다. 실제 코드 확인: `executeContainerBody` 는
  `assertExecutionNotCancelled(executionId, { throttle: true })` (실제 파일 6515행),
  `executeParallelBranchBody` 는 옵션 없는 `assertExecutionNotCancelled(executionId)`
  (실제 파일 7155행) — 서술과 정확히 일치.
- **누수 방지 위치** — JSDoc·plan 모두 "`finalizeRehydrationCleanup`, `runExecution`
  catch/finally 에서 delete" 라고 명시. 실제 코드에 `containerCancelCheckedAtMs.delete(...)`
  호출이 정확히 2곳(`finalizeRehydrationCleanup` 본문, `runExecution` 의 `finally` 블록)
  존재하고, `finalizeRehydrationCleanup` 자신은 재개/park 종결 경로 8곳에서 호출돼 세그먼트
  경계마다 정리된다 — 서술과 일치.
- **상수값(250ms)** — JSDoc(`CONTAINER_CANCEL_CHECK_THROTTLE_MS` 필드 주석, 실제 파일
  543-550행)은 "200~300ms 권장 범위의 중간값" 이라 명시하고 실제 상수는 `250`. plan 문서도
  "200~300ms 권장, 실채택 250ms" 로 recommendation 과 실채택값을 분리해 정확히 기록했다
  (`node-cancellation-residual-signal-propagation.md:132`, `:167`). 둘 다 정밀하다.

### [WARNING] plan 문서의 "왜 무해한가" 근거가 spec 의 잘못된 절을 인용한다 — best-effort 문구는 §5 가 아니라 §2.2 에 있다

- 위치: `plan/in-progress/node-cancellation-residual-signal-propagation.md:177-178`
  (`### 트레이드오프 — 아이템 경계 cancel 가드 스로틀 (W10, 2026-07-26)` 절, "왜 무해한가"
  bullet). 이 절 전체는 이번 커밋 `10b27c320` 이 새로 추가했다(`git show 10b27c320` diff
  로 확인 — 기존 파일에 없던 신설 절).
- 상세: 원문은 "`spec/conventions/node-cancellation.md` §5(`AbortError` 분류)가 전제하는
  취소 전파는 애초에 **best-effort** 계약이다" 라고 인용하는데, `spec/conventions/node-cancellation.md`
  §5(`AbortError` 분류, 103-119행)는 `NodeExecution.status`/`errorPolicy` 분류 규칙만
  다루며 "best-effort" 라는 단어 자체가 §5 본문에 없다(직접 확인). "signal 미지원 — best-effort.
  자기 작업 완료까지 계속 진행해도 무방" 문구는 **§2.2 (CPU 바운드 / 즉시 완료 노드, 52-54행)**
  에 있다. 같은 plan 문서 내에서도 다른 곳(예: 직전 라운드 `concurrency.md` "노드 경계
  관측(best-effort) 이 spec §5 와 정합한가" 판단문)은 §2.2/§2.3 을 정확히 인용했던 것과
  비교하면, 이번에 새로 추가된 이 한 줄만 절 번호가 어긋났다. 실질 피해는 낮다 — "best-effort
  계약이므로 수백 ms 지연이 무해하다" 는 **결론 자체는 spec 이 실제로 명문화한 정책과 일치**하고
  (§2.2 가 정확히 그 정책이다), 코드 동작에도 영향이 없다. 다만 향후 유지보수자가 이 근거를
  검증하려고 §5 를 열어보면 "best-effort" 문구를 찾지 못해 근거 없는 주장으로 오인하거나
  spec 을 다시 뒤져야 하는 마찰이 생긴다 — 정확히 이 파일이 앞서 두 차례(W1→W13) JSDoc/코드
  불일치로 지적받은 것과 같은 "인용이 실체와 어긋난다" 패턴의 재발이다(대상이 코드가 아니라
  spec 절 번호라는 점만 다르다).
- 제안: `§5(AbortError 분류)` → `§2.2(CPU 바운드 / 즉시 완료 노드)` 로 정정. 또는 §2.3 의
  "진행 중 노드의 abortSignal abort 통합 ... 현재는 다음 노드 경계에서 판정" 문구까지 함께
  인용해 "타이밍 허용" 근거를 보강해도 좋다.

### [INFO] CHANGELOG·회귀 테스트 주석의 "시간 기반 스로틀(200~300ms)" 표현이 실채택 고정값(250ms)을 명시하지 않아 근소하게 모호하다

- 위치: `CHANGELOG.md:14` ("컨테이너 아이템 경계 호출부는 이어서 시간 기반 스로틀(200~300ms)까지
  추가해..."), 그리고 같은 표현이 회귀 테스트 주석에도 반복된다
  (`execution-engine.service.spec.ts` 의 W10 테스트 상단 주석 "`assertExecutionNotCancelled`
  가 `executeContainerBody` 호출부에서만 시간 기반 스로틀(`{ throttle: true }`, 200~300ms)을
  적용하도록 수정됐다" — 실제 파일 10217-10220행 부근).
- 상세: 실제 구현은 **고정 상수 250ms 단일값**(`CONTAINER_CANCEL_CHECK_THROTTLE_MS = 250`)이지
  가변 범위가 아니다. 250 이 200~300 범위 안에 들어가므로 문자 그대로 틀린 서술은 아니지만,
  "(200~300ms)" 라는 괄호 표기만 읽으면 스로틀 창이 요청마다 200~300ms 사이에서 변하는
  것으로 오독될 수 있다. JSDoc(`CONTAINER_CANCEL_CHECK_THROTTLE_MS` 필드 주석)과 plan 문서는
  이미 "200~300ms 권장 범위의 중간값 / 실채택 250ms" 로 recommendation 과 실제값을 분리해
  정확히 적어 둔 반면, CHANGELOG·테스트 주석만 그 구분 없이 범위 표기만 남았다.
- 제안: `CHANGELOG.md:14` 를 "시간 기반 스로틀(250ms, 200~300ms 권장 범위의 중간값)" 정도로
  보강. 우선순위 낮음 — 성능·정확성에 실질 영향 없는 텍스트 정밀도 문제.

## 정합성 교차검증 (신뢰도 근거)

아래는 `git show HEAD:<path>` 로 committed 스냅샷을 직접 열어 diff 밖 문맥까지 대조했고,
전부 주석·JSDoc·테스트 서술과 실제 구현이 일치함을 확인했다:

- `runContainer` catch 최상단의 W9 재throw 가드 — 실제로 `if (err instanceof
  ExecutionCancelledError) throw err;` 가 FAILED 마킹/`NODE_FAILED` emit **이전**에 배치돼
  있음을 확인(주석이 정확히 서술).
- `ParallelExecutor` 의 C5 우회 재throw — `errorPolicy` 분기 이전에
  `failures.find((f) => f.error instanceof ExecutionCancelledError)` 로 취소를 우선
  재throw 하는 실제 코드가 주석·테스트 설명과 일치.
- `foreach-executor.ts`/`foreach-executor.spec.ts` 의 "`errorPolicy` 와 무관하게 즉시
  전파" 주석 — `describe.each(['stop','skip','continue'])` 테스트가 실제로 그 3정책 전부를
  대칭 검증.
- W10 회귀 테스트("짧은 간격 내 아이템 경계 반복은 실제 DB 조회를 1회로 스로틀한다")가
  RESOLUTION.md 의 주장("`findOne` 호출 수가 아이템 수보다 뚜렷이 작음")과 실제 단언
  (`toBeLessThan(itemCount)`)이 일치.
- `ExecutionCancelledError` 생성자의 신규 JSDoc("message 는 선택 — 기본값은 park 경로의
  기존 문구 유지")이 실제 시그니처(`constructor(message = 'Execution cancelled while
  waiting for input')`)와 일치.

## 스코프 밖 항목 (참고)

- README/설정 문서 갱신 불요 — 이번 diff 는 새 환경변수·설정 플래그를 추가하지 않는다
  (`CONTAINER_CANCEL_CHECK_THROTTLE_MS` 는 코드 상수이지 env var 가 아니다).
- API 문서 갱신 불요 — HTTP/WS 계약 변경 없음.
- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의
  "추가 위임 (2026-07-26 #6)" 절은 이전 라운드에 이미 검증 완료된 항목이라 재검토하지 않았다.

## 요약

W13("status 단일 컬럼" JSDoc/CHANGELOG 불일치)은 이번 커밋으로 완전히 해소됐다 — 두 위치
모두 committed 스냅샷 기준 "id/status 2개 컬럼" 으로 정정돼 실제 `select` 옵션과 문자
그대로 일치한다. 이번 커밋이 새로 도입한 아이템-경계 cancel 가드 스로틀(250ms)의 JSDoc·
CHANGELOG·plan 기록은 호출부 구분(아이템 경계만 스로틀 vs 노드 경계는 매번 조회)·누수
정리 위치·상수값 모두 실제 구현과 정확히 대조된다. 다만 이번에 새로 추가된 plan 문서의
"왜 무해한가" 근거 한 줄이 best-effort 계약의 출처를 `§5`(AbortError 분류)로 잘못 인용했다
— 실제로는 `§2.2`(CPU 바운드/즉시 완료 노드)가 그 문구의 출처다. 결론(수백 ms 지연은
무해)은 spec 의 실제 정책과 일치하므로 실질 피해는 없지만, 근거 검증 시 마찰을 유발하는
"인용 대상 불일치" 패턴이 이 파일에서 세 번째로(전체 row→JSDoc 불일치 W1, 단일/2컬럼
문구 W13 에 이어) 재발했다는 점에서 정정을 권한다. CHANGELOG·테스트 주석의 "200~300ms"
표기도 실채택 고정값(250ms)을 함께 적지 않아 근소하게 모호하다(INFO, 낮은 우선순위).

## 위험도

LOW
