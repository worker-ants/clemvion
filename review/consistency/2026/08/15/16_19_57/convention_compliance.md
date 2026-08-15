# 정식 규약 준수 검토 — spec/5-system/ (--impl-done)

> 검토 범위 확인: prompt 번들은 컨텍스트 예산 초과로 `spec/5-system/` 19개 파일 전부와
> `spec/conventions/` 268개 파일(주로 cafe24/makeshop 카탈로그) 본문을 생략했고, 실제 diff 도
> `<git diff origin/main...HEAD -- code_areas>` placeholder 로만 표기돼 있었다. "번들에 없다 = 없다"
> 로 오판하지 않기 위해 실측했다 — `git diff origin/main...HEAD --stat -- spec/5-system/` 결과
> **`spec/5-system/4-execution-engine.md` 단 1개 파일, 1줄 교체(diff +1/-1)** 만이 이번 턴의 실제
> target 변경분이다. 이 변경분을 실제 워크트리 파일(`spec/5-system/4-execution-engine.md`,
> `spec/conventions/node-cancellation.md`)과 코드(`execution-engine.service.ts`)를 절대경로로 직접
> Read/grep 해 대조했다.

## 발견사항

- **[INFO]** 직전 라운드(`--impl-prep`, `15_54_20`) convention_compliance WARNING 이 이번 diff 로 정확히 해소됨 — 확인 기록
  - target 위치: `spec/5-system/4-execution-engine.md` §7.1 "워커 크래시 복구 — BullMQ stalled-job",
    "(mid-operation stalled 트리거 — PR4 구현...)" 문단 말미에 추가된 문장
    ("**이 마감은 단일 트랜잭션이다(2026-08-15)**...")
  - 위반 규약: 해당 없음 — 오히려 규약 준수 사례. 직전 라운드(`review/consistency/2026/08/15/15_54_20/convention_compliance.md`)
    WARNING 은 "`finalizeStalledExhausted`(워커 크래시로 인한 `FAILED` 종결, cancellation 과 무관)를
    `spec/conventions/node-cancellation.md` §2.4(취소 관측 가드) 표에 등재한 것이 문서 자신의 선언된
    스코프(cancellation 전용) 위반이며, 자연스러운 SoT 는 `4-execution-engine.md §7.1`인데 그 문서는
    반영되지 않았다"는 지적이었다.
  - 상세: 현재 `spec/conventions/node-cancellation.md` 는 `origin/main` 대비 diff 가 **0** 이고
    (`git diff origin/main...HEAD -- spec/conventions/node-cancellation.md` 결과 없음), 파일 전체를
    grep 해도 `stalled`/`finalizeStalledExhausted` 문자열이 **전혀 없다** — 지적된 잘못된 위치의 행이
    제거됐다. 대신 그 사실이 지적된 정확한 SoT 인 `4-execution-engine.md §7.1` 본문에 편입됐다. 내용도
    코드(`execution-engine.service.ts:3340-3411` `finalizeStalledExhausted`)와 정확히 일치한다 —
    `dataSource.transaction` 으로 Execution `FAILED` UPDATE + 자식 `NodeExecution` cascade UPDATE 를
    묶는 것을 실측 확인했고(`:3354` 트랜잭션 개시, `:3384` 자식 cascade UPDATE), "자매"로 언급된
    `cancelParkedExecution`(`:1023`, 트랜잭션 `:1028`)과 `markWebChatIdleTimeout`(`:1152`, 트랜잭션
    `:1165`) 도 실제로 이미 `dataSource.transaction` 을 쓰고 있어 비교 서술도 정확하다.
    용어("단일 트랜잭션"·"원자성")도 같은 문서 §1.1 등 기존 용법과 일치한다.
  - 제안: 조치 불필요. 후속 라운드에서 유사 "구현 패턴 재사용(자매 함수) vs. spec 주제 소속" 재편입이
    또 발생하면 이번 해소 사례를 선례로 인용할 수 있다.

- **[INFO]** 신규 문장이 §7.1 본문에만 있고 같은 함수를 다루는 기존 `## Rationale` 하위 절
  ("PR4 — BullMQ stalled 자동 재배달")에는 미반영 — 규약 위반은 아니나 참고
  - target 위치: `spec/5-system/4-execution-engine.md` §7.1 신규 문장(위 항목) vs. 같은 파일 Rationale
    "### PR4 — BullMQ stalled 자동 재배달 (2026-07-04)" (라인 1457 부근, `finalizeStalledExhausted`
    의 zombie race 를 상세 서술)
  - 위반 규약: 명확한 위반 아님. CLAUDE.md "결정의 배경·근거는 Rationale" 원칙은 이미 §7.1 신규 문장
    안에 "종전엔 각각 autocommit 이라 부분 커밋 시 자식이 영구 RUNNING 으로 잔류" 라는 배경을 인라인으로
    갖추고 있고, 본 문서 자체가 §1.1 등 여러 곳에서 사실 서술에 짧은 "왜" 근거를 인라인으로 병기하는
    관례를 이미 갖고 있어(§1.1 원자성 보장 문단 등) 강제 위반으로 보긴 어렵다.
  - 상세: 다만 같은 함수의 다른 사실(zombie race)은 Rationale 절에 상세 서술이 있는데 이번 원자성
    사실은 그와 나란히 두지 않아, 같은 함수 서술이 본문·Rationale 두 군데로 흩어졌다. 이는 본 리뷰(정식
    규약 준수)보다 별도 rationale_continuity 검토 관점에 더 가까울 수 있어 CRITICAL/WARNING 으로
    올리지 않았다.
  - 제안: 선택 사항. Rationale "PR4 — BullMQ stalled 자동 재배달" 절 말미에 "(2026-08-15 원자화)" 한
    줄을 덧붙이면 두 위치의 서술이 완전히 정합해진다.

## 요약

이번 턴(`--impl-done`)의 실제 target 변경분은 `spec/5-system/4-execution-engine.md` §7.1 의 1문장
추가뿐이다(`git diff origin/main...HEAD --stat -- spec/5-system/` 실측 = 1파일/+1/-1). 이 추가는
직전 컨벤션 검토(`15_54_20`)가 지적한 "`finalizeStalledExhausted` 원자화 서술이 잘못된 SoT
(`node-cancellation.md` §2.4, cancellation 전용 스코프)에 등재됐다"는 WARNING을 정확한 위치
(`4-execution-engine.md §7.1`)로 옮겨 반영함으로써 해소한다 — `node-cancellation.md` 는 이번 diff 에서
전혀 건드리지 않았고 해당 행도 존재하지 않음을 실측 확인했다. 코드 대조 결과 트랜잭션 원자화 서술·
"자매" 함수 비교 모두 사실과 일치하며, 명명·출력 포맷·API 문서(Swagger/DTO)·금지 패턴 관점에서 이번
diff 범위 안에 새로운 위반은 발견되지 않았다. CRITICAL/WARNING 없음.

## 위험도

NONE
