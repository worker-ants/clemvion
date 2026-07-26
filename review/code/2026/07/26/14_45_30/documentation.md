# 문서화(Documentation) Review — linear-cancel-mechanism (4R, "인용 실체 불일치" 3연속 재발 정밀 대조)

대상: 이번 라운드 프롬프트는 실제로는 `review/code/2026/07/26/13_47_42/*` 산출물(3R 리뷰
문서 11개)이 diff 로 잡혀 있을 뿐, 3R 이후 실제 코드 변경 커밋(`2ca6ada66`, W14~W18 조치 +
INFO 문구 정정)과 그 결과를 기록한 `RESOLUTION.md`(`06eba6334`)는 프롬프트 파일 목록에
포함돼 있지 않다. 그러나 orchestrator 지시가 명시적으로 "직전 라운드 INFO(§5→§2.2 오인용 /
CHANGELOG 250ms 미명시)가 정정됐는지" 와 "13_47_42/RESOLUTION.md 서술이 실제와 일치하는지"
를 요구하므로, `git show`/`Read`/`Grep` 으로 커밋된 실제 소스(`execution-engine.service.ts`,
`CHANGELOG.md`, `plan/in-progress/node-cancellation-residual-signal-propagation.md`,
`RESOLUTION.md`)를 직접 열어 대조했다. 아래 위치는 모두 프롬프트 게이트가 아니라 대상 파일을
직접 읽어 확인한 **실제 소스 줄 번호**다(해당 파일이 이번 라운드 프롬프트 diff 에 포함되지
않아 게이트가 존재하지 않음 — 지침 §2 에 따라 지어내지 않고 직접 확인한 실제 줄 번호를 기재).

## 직전 라운드 지적사항 재검증 — 2건 중 1.5건 해소, 1건 신규 재발

### 1. plan 문서 "§5→§2.2" 정정 — 해소 확인

`git show 2ca6ada66 -- plan/in-progress/node-cancellation-residual-signal-propagation.md`
diff 로 확인: 177행의 "왜 무해한가" bullet 이 `§5(AbortError 분류)` → `§2.2(CPU 바운드 /
즉시 완료 노드)` 로 정확히 정정됐다. `spec/conventions/node-cancellation.md` §2.2(52-54행)에
실제로 "signal 미지원 — best-effort. 자기 작업 완료까지 계속 진행해도 무방" 문구가 있음을
재확인. 더 이상 재론할 사항 없음.

### 2. CHANGELOG·테스트 주석 "실채택 250ms 미명시" — 해소 확인

- `CHANGELOG.md:14` — "시간 기반 스로틀(200~300ms)" → "시간 기반 스로틀(200~300ms 권장
  범위, 실채택 250ms)" 로 정정됨(`git show 2ca6ada66` diff 로 확인, 현재 파일에서도 동일).
- `execution-engine.service.spec.ts` W10 회귀 테스트 주석(현재 파일 10309행 부근, `ai-review
  W17` 태그) — "200~300ms 권장 범위, 실채택 250ms" 로 정정됨. 둘 다 실제와 일치.

### 3. [WARNING] 동일한 "§5→§2.2 오인용" 결함이 **소스 코드 JSDoc 에 그대로 남아 있다** — 부분 수정

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:545`
  (`CONTAINER_CANCEL_CHECK_THROTTLE_MS` 필드 JSDoc, 536-550행 블록의 일부)
- 상세: 3R 문서화 리뷰가 지적한 "best-effort 문구는 §5 가 아니라 §2.2 에 있다" 오류는
  `plan/in-progress/node-cancellation-residual-signal-propagation.md` 에서는 정정됐지만,
  **완전히 동일한 문장**이 `CONTAINER_CANCEL_CHECK_THROTTLE_MS` 상수 자체의 JSDoc(545행)에도
  있다: `` `spec/conventions/node-cancellation.md` §5(`AbortError` 분류)가 명시하듯 취소
  전파는 애초부터 **best-effort** 계약이라 수백 ms 지연은 무해하다 ``. `git log -S` 로 확인한
  결과 이 문장은 커밋 `10b27c320`(3R 이전, W10 최초 도입)에서 추가된 뒤 커밋 `2ca6ada66`
  (이번 조치)의 diff 두 hunk(`@@ -5802,6 +5802,17` / `@@ -6931,6 +6942,13`) 어느 쪽에도
  포함되지 않아 **한 번도 손대지 않았다**. `spec/conventions/node-cancellation.md` §5
  (103-119행, `AbortError` 분류)는 `NodeExecution.status`/`errorPolicy` 분류 규칙만 다루며
  "best-effort" 단어가 없음을 재확인(코드베이스 전체에서 `grep -rn "§5(\`AbortError\` 분류)"`
  결과도 이 545행 1건뿐 — plan 문서 쪽은 이미 지워졌다).
  이 JSDoc 은 스로틀 상수 자체에 딸린 1차 근거 문서로, plan 문서보다 오히려 **더 자주
  참조될 위치**다(코드를 읽는 유지보수자가 "왜 250ms 인가"를 확인하려면 plan 문서가 아니라
  이 JSDoc 을 먼저 읽는다). 조치 커밋 메시지 자체가 "INFO: plan 의 'best-effort' 인용을
  §5 → §2.2 로 정정" 이라고만 적어 이 JSDoc 은 애초에 스코프에 없었던 것으로 보인다 — 즉
  같은 결함이 두 곳(plan 문서 + JSDoc)에 복제돼 있었는데 하나만 고쳐졌다.
  이 파일에서만 이미 **W1(전체 row→JSDoc 불일치) → W13(단일/2컬럼 문구) → 3R INFO
  (§5/§2.2, plan 문서)** 로 세 번 지적된 "인용이 실체와 어긋난다" 패턴이, 정정이 불완전해
  **네 번째로 코드 자체에 재발**한 사례다.
- 제안: `execution-engine.service.ts:545` 의 `§5(\`AbortError\` 분류)` 를 plan 문서와 동일하게
  `§2.2(CPU 바운드 / 즉시 완료 노드)` 로 정정. 두 위치(plan 문서 + JSDoc)가 같은 근거를
  인용하므로, 향후 drift 방지를 위해 JSDoc 쪽에서 plan 문서를 링크하고 근거 문장 자체는
  한 곳에만 두는 것도 고려할 만하다.

### 4. [WARNING] `containerCancelCheckedAtMs` 필드 JSDoc 의 "누수 방지" 서술이 W14 이후 stale — 정리 지점이 3곳인데 2곳만 기재

- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:536-538`
  (`containerCancelCheckedAtMs` 필드 JSDoc, "**누수 방지**" 문단)
- 상세: 이 JSDoc 은 "execution 종료 지점(`finalizeRehydrationCleanup`, `runExecution`
  catch/finally)에서 반드시 `delete` 한다" 고 명시하는데, 이는 W14 이전(정리 지점 2곳)
  기준 서술이다. 이번 조치 커밋(`2ca6ada66`)이 정확히 이 불변식의 구멍(background 경로
  누락)을 메우며 `executeBackgroundSubgraph` 의 `finally`(6951행)에 **세 번째** `delete` 를
  추가했지만(`RESOLUTION.md` 자신도 "정리 지점이 2곳(`:2670`·`:4544`)에서 **3곳**으로" 라고
  명시적으로 기록), 이 필드 JSDoc 은 여전히 두 지점만 나열해 갱신되지 않았다. "반드시
  delete 한다" 는 불변식을 서술하는 이 JSDoc 이야말로 향후 네 번째 정리 지점이 필요해질 때
  (예: 새 큐 프로세서 추가) 개발자가 "정리해야 할 지점이 몇 곳인지" 확인하러 오는 SoT
  위치인데, 지금은 W14 가 고친 바로 그 클래스의 결함(정리 지점 목록 불완전)을 문서 자신이
  반복하고 있는 셈이다.
- 제안: 536-538행을 "`finalizeRehydrationCleanup`, `runExecution` catch/finally,
  `executeBackgroundSubgraph` finally(3곳, ai-review W14)" 로 갱신.

### 5. [WARNING] W14~W16 이 CHANGELOG 에 반영되지 않음 — 동일 섹션의 기존 관례와 불일치

- 위치: `CHANGELOG.md:3-16` (`## Unreleased — 외부 cancel(Stop) 후에도 하류 노드 dispatch·
  부수효과가 계속되던 결함 수정` 섹션, 항목 1-5)
- 상세: 이 섹션은 이미 "이어진 리뷰에서 드러난 갭"(항목 1의 세 하위 불릿), "(ai-review W10)"
  태그(항목 5) 등으로 **라운드마다 발견된 후속 수정을 같은 섹션에 계속 추가해 온 관례**가
  있다. 그런데 이번 조치 커밋(`2ca6ada66`)의 diff 는 `CHANGELOG.md` 를 딱 한 줄(항목 5의
  "200~300ms"→"실채택 250ms" 표기)만 건드렸을 뿐, 다음 3건은 새 항목으로 추가되지 않았다:
  - **W14** — `executeBackgroundSubgraph` 의 `containerCancelCheckedAtMs` Map 누수(무제한
    누적, 싱글턴 서비스 필드).
  - **W15** — `executeNode` 의 generic catch 가 `ExecutionCancelledError` 를 분류하지 않아
    Sub-Workflow 노드가 `cancelled` 대신 `failed` 로 오분류되고 **executionId 를 포함한
    내부 message 가 `NODE_FAILED` WS 이벤트로 노출**되던 결함.
  - **W16** — `RetryTurnService.failRetryExecution` 이 취소 시에도 `execution.error` 를
    무조건 DB 저장해 **REST `GET /executions/:id` 로 내부 message 가 노출**되던 결함.
  W15·W16 은 특히 "내부 오류 메시지 노출" 이라는 점에서 이미 CHANGELOG 항목 3("Background
  노드 본문의 부모 취소 오분류 수정")·항목 4("emit 계약 통일")과 같은 급의 사용자 영향
  변경이며, 같은 섹션에 이미 있는 "취소 시 오분류/노출" 서사의 직접적 연장선이다. 이번
  라운드가 이 섹션을 건드리면서(항목 5 수정) 새 항목을 추가하지 않은 것은 일관성 결여다.
- 제안: CHANGELOG.md 의 해당 섹션에 항목 6("Background 스로틀 상태 누수 수정")·항목 7
  ("Sub-Workflow 노드 취소 오분류·내부 메시지 노출 수정")·항목 8("재시도 턴 취소 시 내부
  메시지 노출 수정")을 추가. 필수는 아니나(아직 미배포 Unreleased 상태이므로 릴리스 노트
  누락으로 인한 실사용자 피해는 없음), 이 섹션 자체가 라운드별 후속 조치를 누적 기록해 온
  유일한 곳이라 생략 시 추후 릴리스 노트 작성자가 W14~W16 을 놓칠 위험이 있다.

## RESOLUTION.md (13_47_42, main 직접 작성) 대조 결과

`review/code/2026/07/26/13_47_42/RESOLUTION.md` 의 조치 표(W14~W18)를 실제 소스와 항목별로
대조했다.

- **W14** — "`execution-engine.service.ts:6951`" · "정리 지점이 2곳(`:2670`·`:4544`)에서
  3곳으로" → 세 위치(2670/4544/6951) 모두 실제 `containerCancelCheckedAtMs.delete(...)`
  호출과 정확히 일치(직접 확인).
- **W15** — "`executeNode` 의 generic catch" → 실제 diff(5802-5813행)에 정확히 그 위치,
  그 순서(FAILED 마킹/emit 이전)로 배치된 것을 확인. 서술과 일치.
- **W16** — "`retry-turn.service.ts:641-651`" → 641행(`isCancelled` 평가)부터 653행
  (`execution.error` 대입) 범위와 대체로 일치(± 몇 줄, 실질적 문제 없음).
- **W18** — "`execution-engine.service.spec.ts:3747`" → 실제로 3747행이 정확히 해당
  회귀 테스트(`cleans up containerCancelCheckedAtMs ... (W14 background leak
  regression)`)의 주석 시작부와 일치.
- **[INFO] W17 — 줄 번호 인용이 실제 위치와 다르다**: RESOLUTION.md 는 W17(스로틀 회귀
  테스트 `Date.now` 결정화)의 근거를 `execution-engine.service.spec.ts:10196` 으로
  기재하지만, 실제로 10196행 부근은 **W17 이 건드리지 않은 기존(2R) 테스트**("아이템 경계
  취소가 컨테이너 노드를 FAILED 로 오분류하거나 NODE_FAILED 를 emit 하지 않는다 (W9)")의
  주석이다. W17 이 실제로 수정한 위치는 `git show 2ca6ada66` 의 세 번째 hunk
  (`@@ -10217,11 +10301,22 @@`)이며, 새 `jest.spyOn(Date, 'now')` 는 현재 파일 기준
  10308행(`it('짧은 간격 내 아이템 경계 반복은 실제 DB 조회를 1회로 스로틀한다 (W10)'...)`)
  ~10318행 사이에 있다(`ai-review W17` 태그는 10309행). SUMMARY.md(3R)가 인용한 구 위치
  (`:10224`, 조치 전 줄 번호)와도 다르고, 조치 후 실제 위치와도 다른 **제3의 숫자**라
  단순 신구 라인 넘버 혼동이 아니라 인용 자체가 부정확하다. 실질 영향은 낮다(코드는 정확히
  수정됐고, 표의 다른 4개 항목·조치 내용 서술 자체는 모두 정확하다) — 다만 RESOLUTION.md
  "확인" 열의 목적이 향후 감사자가 그 줄을 열어 재검증하는 것이므로, 이 한 줄만 잘못
  짚으면 검증자가 엉뚱한 테스트를 보게 된다. 같은 클래스("인용이 실체와 어긋난다")의
  다섯 번째 사례이나, 대상이 review 산출물(RESOLUTION.md)이라 제품 코드 문서화보다는
  경미하게 취급해 INFO 로 분류한다.
  - 제안: `:10196` → `:10308`(또는 `:10309`)로 정정.

## 스코프 밖 항목 (참고, 유지)

- README/설정 문서 갱신 불요 — 여전히 새 환경변수·설정 플래그 없음.
- API 문서 갱신 불요 — HTTP/WS 계약 변경 없음(W15·W16 은 기존 emit/응답 필드의 **값**
  정확성 수정이지 스키마 변경이 아님).
- `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 의 위임
  절은 이전 라운드에 검증 완료, 재검토 불요.
- 이미 해소 확인된 C1~C5·W1~W13 은 재론하지 않음(지시 준수).

## 요약

직전(3R) 라운드가 지적한 두 항목 중 CHANGELOG·테스트 주석의 "250ms 미명시" 는 완전히
해소됐다. 그러나 "best-effort 문구는 §5 가 아니라 §2.2" 오인용은 **plan 문서에서만
정정되고 완전히 동일한 문장이 있는 소스 JSDoc(`execution-engine.service.ts:545`)에는
정정이 적용되지 않아** 절반만 해소됐다 — 이 파일에서 세 번(W1·W13·3R INFO) 지적된
"인용이 실체와 어긋난다" 패턴이 네 번째로, 이번엔 코드 자체에 재발한 것이다. 추가로
W14 가 정리 지점을 2곳에서 3곳으로 늘렸는데 그 불변식을 서술하는 필드 JSDoc(536-538행)은
갱신되지 않아 stale 해졌고(다섯 번째 유사 사례), CHANGELOG 에는 W14~W16(특히 내부 메시지
노출 수정 W15·W16)이 반영되지 않아 이 섹션의 기존 관례(라운드별 후속 수정을 누적 기록)와
어긋난다. `RESOLUTION.md`(main 직접 작성)는 W14/W15/W16/W18 의 조치 내용·줄 인용이 모두
정확했으나 W17 의 줄 인용(`:10196`)만 실제 위치(`:10308` 부근)와 달랐다 — 코드 정확성에는
영향이 없는 review 산출물 내 오류라 INFO 로 분류했다. 종합하면 이번 라운드의 실질 코드
변경(W14~W18)은 모두 올바르게 구현됐지만, "문서 인용을 실체에 맞춘다" 는 조치 자체가
불완전하게 적용돼 정확히 같은 종류의 결함이 코드 JSDoc 에 그대로 남아 있다는 점이
핵심 발견이다.

## 위험도

MEDIUM
