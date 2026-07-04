# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `spec/5-system/4-execution-engine.md` §8 본문에 이번 PR과 모순되는 stale 문장 잔존
  - 위치: `spec/5-system/4-execution-engine.md:1090` ("admission gate 원자성(TOCTOU)" 문단 마지막 문장)
  - 상세: 같은 파일 §4(`:379`)·§8 배너(`:1071`)·§9.3 큐 표(`:1139`)는 이번 PR이 "우선순위 3-tier 도 구현 완료(2026-07-04, triggerType threading)"로 정확히 flip 했다. 그러나 §8 admission-gate 설명 문단 끝의 `"priority 3-tier(ExecuteOptions.triggerType threading)는 본 PR 스코프 아님 — 현 manual > 트리거 2-tier 유지, webhook/schedule 세분화는 별도 후속 PR."` 문장은 그대로 남아, 같은 문서 안에서 몇 줄 위 배너와 정면으로 모순된다. (참고: `:1528`~`:1537` "Rationale" 섹션의 동일 취지 문장은 "2026-07-04 당시 결정"을 기록하는 historical decision record이므로 그대로 두어도 무방 — §8 Rationale 관례상 과거형/배경 서술은 정상.)
  - 제안: `:1090`을 현재 시제(3-tier 구현 완료, admission gate 는 priority 와 직교 — 계속 유효)로 수정하거나, 최소한 "(2026-07-04 이전 상태, 이후 triggerType threading 으로 3-tier 구현됨 — §4.3 참조)" 각주 추가.

- **[WARNING]** `spec/data-flow/3-execution.md:68` — priority 3-tier "임시 2-tier" 서술이 flip 안 됨
  - 위치: `spec/data-flow/3-execution.md:68`
  - 상세: `"단 현재 ExecuteOptions 가 trigger type 을 싣지 않아 실제로는 manual > 그 외 이분 (schedule 도 webhook 우선순위 — 의도된 임시 처리, PR2 triggerType threading 후속)."` 이 파일은 이번 diff에 포함되지 않아(`git diff origin/main` 결과 무변경) 여전히 구 2-tier 상태·"PR2 후속" 표현을 그대로 노출한다. `spec/5-system/4-execution-engine.md` 가 SoT 이고 이 파일은 요약/미러 성격이지만, 사용자가 이 문서만 읽으면 여전히 미구현으로 오인한다.
  - 제안: `manual(1) > webhook(2) > schedule(3) — 호출부가 ExecuteOptions.triggerType 을 전달, 구현 완료(2026-07-04)`로 갱신하고 "PR2 후속" 문구 제거.

- **[WARNING]** `spec/data-flow/10-triggers.md:182` — 동일한 stale "2-tier·임시·threading 후속" 서술
  - 위치: `spec/data-flow/10-triggers.md:182` (execution-run 큐 카탈로그 행)
  - 상세: `"현재는 executedBy 유무로 manual/그 외 이분이라 schedule 발사도 webhook priority — 의도된 임시, triggerType threading 후속"` 문구가 이번 PR로 이미 사실과 어긋난다(이 파일도 diff 미포함, origin/main 대비 무변경 확인). §4/§4.3/§8/§9.3 flip 대상에서 이 큐 카탈로그 표는 빠졌다.
  - 제안: "manual=1 > webhook=2 > schedule=3 (executedBy 우선, 트리거는 ExecuteOptions.triggerType — 구현 완료 2026-07-04)"로 갱신.

- **[WARNING]** `spec/5-system/4-execution-engine.md:1246` — `EXECUTION_RUN_WORKER_CONCURRENCY` 환경변수 설명의 괄호 참조 "§8 동시성 cap(PR2)"이 이중으로 stale
  - 위치: `spec/5-system/4-execution-engine.md:1246`
  - 상세: 이 줄의 "PR2"는 concurrency-cap(PR2a/PR2b) 트랙을 가리키는 것으로 보이며 이번 PR이 만든 문제는 아니지만(사전 존재), §8 이 이제 "PR2b 구현 완료"로 flip된 상태에서 이 괄호는 여전히 미래형("토대")으로 남아 있어 독자가 헷갈릴 소지가 있다. 이번 리뷰 스코프(§4/§4.3/§8/§9.3 flip 완결성)에 인접한 잔존 stale 이므로 함께 정리 권장.
  - 제안: "§8 동시성 cap(PR2a/PR2b 구현 완료)의 토대"로 정정, 또는 이번 PR 스코프 밖이면 별도 후속 이슈로 명시.

- **[INFO]** `plan/in-progress/exec-intake-followups.md:13` 체크박스 미갱신
  - 위치: `plan/in-progress/exec-intake-followups.md:13`
  - 상세: `- [ ] **priority 3-tier (webhook/schedule 세분화)** ... execution-engine.service.ts TODO(PR2) 지점.` 항목이 여전히 미체크 상태다. 이번 PR이 정확히 이 항목(`ExecuteOptions.triggerType` 신설 + 3개 호출부 threading + `TODO(PR2)` 제거)을 구현했으나, followups plan 문서 자체는 diff에 포함되지 않아 체크박스가 갱신되지 않았다. 프로젝트 컨벤션(plan 체크박스 = 실제 상태, `.claude/docs/plan-lifecycle.md`)상 이 항목을 `[x]`로 갱신하고 완료 근거(PR/커밋)를 남겨야 한다.
  - 제안: `exec-intake-followups.md` 의 해당 항목을 `[x]`로 변경 + "구현 완료(2026-07-04, triggerType threading)" 각주 추가. `TODO(PR2)` 문구도 코드에서 이미 제거됐으므로 plan 문서 서술과 일치시킨다.

- **[INFO]** 코드 레벨 문서화(JSDoc/인라인 주석)는 양호
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:388-118`, `:3243-3249`
  - 상세: `ExecuteOptions` 유니온 타입에 추가된 `triggerType` 필드는 §4.3 참조·fallback 규칙·`Execution.triggerSource`(5-way, 실행이력 표시용)와의 구분 경계를 명확한 인라인 주석으로 설명한다. `execute()` 내부 우선순위 산정 로직 주석도 "executedBy 우선 → manual, else triggerType ?? webhook fallback" 순서를 정확히 서술해 코드와 주석이 일치한다. `hooks.service.ts`/`schedule-runner.service.ts` 호출부 주석도 각자 발화 유형(webhook/schedule)과 §4.3 참조를 정확히 남겼다. 별도 조치 불요.

- **[INFO]** README/CHANGELOG/공개 API 문서 영향 없음
  - 상세: 변경은 내부 타입(`ExecuteOptions.triggerType`)·내부 우선순위 산정 로직으로 공개 REST API 계약·swagger 스펙·환경변수·README 신규 항목에 영향 없음(consistency-check convention_compliance 체커도 동일 판정). 별도 갱신 불요.

## 요약

이번 PR은 코드 레벨 문서화(JSDoc·인라인 주석·테스트 코멘트)는 신뢰도 높게 갱신했고, spec SoT 파일(`spec/5-system/4-execution-engine.md`)의 §4/§4.3/§8/§9.3 배너 flip도 대부분 정확하게 반영했다. 다만 요청받은 "다른 곳 stale 'PR2 예정' 잔존 확인" 관점에서, 같은 SoT 파일 §8 본문 한 문장(`:1090`)이 방금 flip한 배너와 직접 모순되고, 미러/요약 성격의 두 데이터플로우 문서(`spec/data-flow/3-execution.md:68`, `spec/data-flow/10-triggers.md:182`)가 여전히 구 2-tier·"PR2 후속" 서술을 노출하며, followups plan 문서의 체크박스도 미갱신 상태로 남아 있다. 전부 사용자를 오도할 수 있는 실질적 문서 불일치이나 코드 동작에는 영향 없는 순수 문서 이슈다.

## 위험도
MEDIUM

STATUS: SUCCESS
