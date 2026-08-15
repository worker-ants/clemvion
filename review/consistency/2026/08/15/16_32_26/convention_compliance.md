# 정식 규약 준수 검토 — spec/5-system/ (--impl-done)

> **검토 범위 확인**: prompt 번들은 컨텍스트 예산 초과로 `spec/5-system/` 19개 파일 전부와
> `spec/conventions/` 대부분(주로 cafe24/makeshop API 카탈로그)의 본문을 생략했고, 실제 diff 도
> `<git diff origin/main...HEAD -- code_areas>` placeholder 로만 표기돼 있었다. "번들에 없다 = 없다"
> 로 오판하지 않기 위해 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)
> 를 절대경로로 직접 Read/grep/`git diff` 로 실측했다.
>
> 실측 결과 — 이번 턴의 실제 target 변경분은 `spec/5-system/4-execution-engine.md` **1개 파일**
> (`git diff origin/main...HEAD --stat -- spec/`, +8/-1) 뿐이다. `spec/conventions/node-cancellation.md`
> 는 이번 diff 에서 전혀 건드리지 않았음(diff 0)을 확인했다. 관련 code(`execution-engine.service.ts`
> `finalizeStalledExhausted`/`cancelParkedExecution`/`markWebChatIdleTimeout`), `spec/conventions/error-codes.md`
> (`WORKER_HEARTBEAT_TIMEOUT` 레지스트리), `spec/conventions/node-output.md`(`output.error` 표준 형태)
> 를 대조 근거로 함께 열었다.
>
> **직전 두 라운드와의 연속성**: 같은 세션의 `review/consistency/2026/08/15/15_54_20/convention_compliance.md`
> (--impl-prep)가 "`finalizeStalledExhausted`(워커 크래시로 인한 `FAILED` 종결)를 `node-cancellation.md`
> §2.4(취소 관측 가드) 표에 등재한 것이 문서 자신의 선언된 스코프 위반" 이라는 WARNING 을 냈고,
> `16_19_57/convention_compliance.md`(--impl-done)가 그 WARNING 이 올바른 SoT(`4-execution-engine.md
> §7.1`)로 재편입돼 해소됐음을 확인하며 "같은 사실이 §7.1 본문에만 있고 Rationale 절에는 없다"는 선택
> 사항 INFO 를 남겼다. 이번 라운드의 diff 는 그 INFO 제안대로 Rationale
> "### PR4 — BullMQ stalled 자동 재배달" 절에 "dead-letter 마감의 원자성 (2026-08-15 정정)" bullet 을
> 추가해 §7.1 본문과 Rationale 양쪽의 서술을 정합시켰다 — 아래 발견사항은 이 최종 상태를 확인한다.

## 발견사항

- **[INFO]** 직전 라운드(`16_19_57`) INFO 제안이 이번 diff 로 실제 반영됨 — 확인 기록
  - target 위치: `spec/5-system/4-execution-engine.md` `## Rationale` → `### PR4 — BullMQ stalled
    자동 재배달 (2026-07-04)` 절, 신규 bullet "**dead-letter 마감의 원자성 (2026-08-15 정정)**"
  - 위반 규약: 해당 없음 — 규약 준수 강화 사례.
  - 상세: §7.1 본문("이 마감은 단일 트랜잭션이다(2026-08-15)…")과 Rationale 신규 bullet 이 같은 사실
    (`finalizeStalledExhausted` 의 Execution `FAILED` UPDATE + 자식 `NodeExecution` cascade UPDATE
    를 `dataSource.transaction` 으로 묶음, 자매 `cancelParkedExecution`/`markWebChatIdleTimeout` 과
    동형)을 각각 요약/상세 레벨로 서술하고, §7.1 문단 말미의 기존
    `([§Rationale "…" / "PR4 — BullMQ stalled 자동 재배달"](#rationale))` 링크가 그대로 유지돼 두
    위치를 연결한다 — 이는 CLAUDE.md "결정의 배경·근거는 Rationale" 원칙 및 본 문서가 §1.1 등 다른
    곳에서 이미 쓰는 "본문 요약 + Rationale 상세 링크" 패턴과 정확히 일치한다. 코드 대조
    (`execution-engine.service.ts:3322-3411` `finalizeStalledExhausted`, `:1023` `cancelParkedExecution`,
    `:1152` `markWebChatIdleTimeout`)로 트랜잭션 사용·"자매" 비교 서술이 사실과 일치함을 재확인했다.
  - 제안: 조치 불필요.

- **[INFO]** Rationale bullet 의 "정정" 표현이 이 저장소의 일반적 어휘와 다소 결이 다름 (엄밀 위반은 아님)
  - target 위치: 위와 동일, "**dead-letter 마감의 원자성 (2026-08-15 정정)**"
  - 위반 규약: 명시적 규약 없음 — `spec/conventions/**` 어디에도 "정정" 표기를 correction-only 로
    한정하는 규칙은 없다.
  - 상세: 이 저장소 관례상 "정정"은 대개 *이전에 기록된 서술이 틀렸음을 뒤집는* 이력에 쓰인다(예:
    `spec/conventions/node-cancellation.md` Rationale "이 항목은 2026-08-15 에 두 번 정정됐다" — 취소
    시각 보존 처방을 두 번 뒤집은 사례). 반면 이번 bullet 은 기존 §7.1/Rationale 이 "이전에 틀린 주장"을
    한 적이 없고(단지 원자성을 언급하지 않았을 뿐) 코드에 새 트랜잭션을 도입한 **신규 하드닝**을
    서술한다. 같은 문서의 다른 bullet 들(예: "`maxStalledCount=1` (bounded blast radius)")은 날짜 없이
    또는 "(PR4 구현, 2026-07-04)" 식으로 도입 사실만 표기하는 쪽이 더 흔하다.
  - 제안: 편집 취향 수준 — "정정" 대신 "원자화" 등으로 바꾸면 이 저장소의 correction-history 관례와 더
    깔끔히 구분되나, 강제 규약 위반이 아니므로 필수 아님.

- **[INFO]** `spec/conventions/error-codes.md` §3 `WORKER_HEARTBEAT_TIMEOUT` 레지스트리는 갱신되지
  않았으나 갱신 불필요 — 확인 기록
  - target 위치: `spec/conventions/error-codes.md` §3 표, `WORKER_HEARTBEAT_TIMEOUT` 행
  - 위반 규약: 해당 없음.
  - 상세: 이 레지스트리 행은 코드명이 "HEARTBEAT" 를 암시하나 실제로는 stalled 재배달 소진을 의미한다는
    **의미 진화**(PR1~PR2 → PR3 → PR4)를 추적한다. 이번 변경은 이 코드가 **언제 발행되는지**(트리거
    조건)를 바꾸지 않고 두 UPDATE 를 원자화했을 뿐이므로, §3 레지스트리의 "진실(의미)" 열을 갱신할
    이유가 없다. `node-output.md` §3.2 의 `output.error` 표준 형태(`code`=`UPPER_SNAKE_CASE`)도
    `NodeExecution.error.code = stalledError.code`(부모와 동일 상수 재사용) 로 그대로 준수된다 — 이
    부분은 이번 diff 가 손대지 않은 기존 코드(± 없음, context line)임도 확인했다.
  - 제안: 조치 불필요.

## 요약

이번 턴의 실제 target 변경분은 `spec/5-system/4-execution-engine.md` §7.1 본문 1문장 확장 + Rationale
"PR4 — BullMQ stalled 자동 재배달" 절 신규 bullet 1개뿐이다(`git diff origin/main...HEAD --stat --
spec/` = 1파일/+8/-1). 이는 직전 두 라운드(`15_54_20` WARNING → `16_19_57` INFO 제안)가 지적한 "잘못된
SoT 등재"와 "본문·Rationale 서술 분리" 를 모두 해소한 최종 상태로, 코드(`finalizeStalledExhausted`
트랜잭션 도입, `cancelParkedExecution`/`markWebChatIdleTimeout` 과의 "자매" 비교)와 정확히 일치함을
실측 확인했다. 명명 규약(함수/식별자 표기)·출력 포맷 규약(`error.code` UPPER_SNAKE_CASE, `output.error`
표준 형태 무변경)·문서 구조 규약(Overview/본문/Rationale, 본문→Rationale 앵커 링크 패턴 준수)·API 문서
규약(해당 diff 범위 밖 — Swagger/DTO 변경 없음)·금지 항목 어느 관점에서도 CRITICAL/WARNING 급 위반은
발견되지 않았다. 위 INFO 3건은 모두 확인/편집 취향 수준으로 조치 불필요.

## 위험도

NONE
