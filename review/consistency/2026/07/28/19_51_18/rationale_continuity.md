# Rationale 연속성 검토 결과

## 검토 범위에 대한 메모 (절차상 중요)

이번 호출 prompt 는 `scope=spec/5-system/` 를 lexicographic 순서로 채우다 컨텍스트 예산을 초과해
`1-auth.md` / `10-graph-rag.md` / `11-mcp-client.md` 3개만 전문이 포함되고, 나머지 18개 항목
(`12-webhook.md` ~ `_product-overview.md`, 그리고 파싱 잔여물로 보이는 `_selectedPort`/`$trigger`/
`$env`)은 명시적으로 생략됐다 — 그중 **`4-execution-engine.md`** 가 포함돼 있다.

현재 worktree(`retry-atomic-claim-4d9e77`)·`plan/in-progress/retry-turn-terminal-guard.md` 의 열린
후속 항목(W1 → 5R CRITICAL 승격 → 통합 목록 #1 "`applyRetryLastTurn` 원자 claim")·직전 impl-prep
게이트 세션(`review/consistency/2026/07/28/17_21_27`)을 교차 확인한 결과, 이번 게이트가 실제로
검증해야 하는 핵심 대상은 프롬프트에 없는 `spec/5-system/4-execution-engine.md` 다. 프롬프트 자체의
지시("여기 없다는 사실을 근거로 삼지 말 것 — 관련되면 Read 로 직접 열어라")에 따라 저장소에서
직접 Read/grep 하여 분석했고, 아울러 `plan/`·직전 세션 리포트·실제 코드(`continuation-execution.
processor.ts`, `retry-turn.service.ts`)까지 1차 사료로 교차검증했다.

---

## 발견사항

- **[CRITICAL]** `retry_last_turn` 원자 claim 부재가 spec 이 반복 단언하는 "동일 turn 이중 실행 0"
  불변식을 위반 — **직전 게이트(17_21_27)가 이미 발견·추적 중인 사안이며 아직 미해소** (설계상 지금
  해소돼 있으면 안 됨)
  - **target 위치**: `spec/5-system/4-execution-engine.md` (직접 Read 로 확인, 라인 번호는 실측)
    - §4.2 "작업 단위 — execution-level 세그먼트" PR2a 각주 (L425): `jobId = executionId` dedup 으로
      "동일 Execution 의 active 세그먼트는 항상 1개"라 선언하며 각주로 "**PR2b+ 재진입 경로**(예:
      `retry_last_turn` 으로 동시 active 세그먼트가 가능해지는 설계)가 추가되면 이 불변식이 깨질 수
      있으므로 **PR2b 착수 전 재검증한다**"고 자가 예고.
    - §7.3 "멱등성 보장" (L876-881): "동일 turn/세그먼트 이중 실행 0"을 지탱하는 "4중 계약"의 scope 를
      명시적으로 "재개·재구동(§7.5 case A waiting / case B 크래시)"로만 한정한다 — `retry_last_turn`
      (제3의 재진입 경로)은 애초에 이 계약 밖.
    - §7.4 "분산 실행" 메시지 타입 행 (L906): `retry_last_turn` 은 "대상 row 는 WAITING 이 아니라
      spawn 된 RUNNING 이므로 **WAITING_FOR_INPUT 사전검증을 거치지 않는다**" — 다른 5종 continuation
      이 쓰는 `claimResumeEntry` 원자 claim 이 구조적으로 적용되지 않음을 스스로 인정.
    - §7.4 "Worker 동시성" 행 (L914): 바로 위 행의 carve-out 을 무시하고 "재개 진입이 §7.5 의 DB
      원자 claim 으로 gate 되므로 concurrency 상향·멀티 인스턴스에서도 **'동일 turn 이중 실행 0'
      불변식이 유지된다**"고 전체 continuation 타입에 **무차별적으로** 재단언 — 바로 위 행과 내부 모순.
    - §8 admission gate 본문 (L1120) 및 Rationale "타임아웃을 active-running 누적 기준으로" 중
      "타임아웃 판정 비원자성" (L1607): 같은 `jobId=executionId` 근거로 "동일 Execution 동시 active
      세그먼트가 불가능"을 재사용하며 `retry_last_turn` 예외를 언급하지 않는다.
    - Rationale "park 즉시 해제 + slow-path 일원화" "불변식 보존" (L1537): 동일하게 전역 불변식으로
      재진술.
  - **과거 결정 출처**: 같은 문서 `## Rationale`
    - "재개 race 보장을 DB 원자 claim — 위 'running hop 회피' 결정의 부분 수정 (§7.5, 2026-07-02)"
      (L1354-1362): "optimistic claim 은 §1.3 `_retryState` 소비('affected=1 인 쪽만 진행')로 이미
      확립된 패턴의 **일반화**"라고 규정 — 이 원칙상 retry_last_turn 의 continuation 소비 단계에도
      같은 CAS 패턴이 적용돼야 문서 내적으로 일관된다.
    - "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (PR3, 2026-07-04)" 중 "§4.2 active-running
      직렬화 불변식 재검증" 단락 (L1372): 제목은 L425 각주의 의무("PR2b 착수 전 재검증")를 이행한
      것처럼 인용하지만, 실제로 재검증하는 대상은 **크래시 re-drive**(다른 기능)이지 원 각주가 예로
      든 **`retry_last_turn`** 이 아니다 — 이름은 같은 "재진입 경로"지만 실질은 다른 기능이다.
  - **상세 (코드 교차검증)**:
    - `continuation-execution.processor.ts` L44-49 (파일 JSDoc): "비원자 SELECT 재검증과 달리
      check-then-act 창이 없어 이중 실행 0 을 기계 보장" — 원자성의 필요조건을 스스로 명시.
    - 같은 파일 L83-86: `if (type !== 'cancel' && type !== 'retry_last_turn')` 로 `retry_last_turn`
      을 `claimResumeEntry`(조건부 UPDATE) 대상에서 **명시적으로 제외**하고, "자체 멱등 가드는
      `applyRetryLastTurn` 내부에서 수행한다"고 주석으로 위임.
    - `retry-turn.service.ts` L281-287 `applyRetryLastTurn`: 위임받은 "멱등 가드"는 `findOneBy` 로
      읽은 뒤 `if (spawnedRow.status !== NodeExecutionStatus.RUNNING) return;` 뿐 — **조건부 UPDATE
      가 아니라 평범한 read-then-branch** 다. 정상 처리 중에도 row 는 RUNNING 을 유지하므로, 같은
      continuation job 이 중복 배달(BullMQ stalled 재배달·`CONTINUATION_WORKER_CONCURRENCY` 상향·
      멀티 인스턴스)되면 두 delivery 모두 이 체크를 통과해 동시에 같은 row 를 처리할 수 있다.
    - `execution-continuation` 큐의 jobId 는 `${executionId}:${nodeExecutionId}:${monotonic-seq}`
      (§7.4 L907)라 매 enqueue 마다 유일 — `execution-run` 의 `jobId=executionId` dedup 과 달리
      BullMQ 레벨에서도 "같은 논리적 재진입"의 중복을 막지 못한다.
  - **이 발견은 신규가 아니다.** 직전 impl-prep 게이트(`review/consistency/2026/07/28/17_21_27`)의
    `rationale_continuity`·`plan_coherence` 두 checker 가 독립적으로 CRITICAL 판정했고,
    `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` **#10**
    ("`retry_last_turn` 원자성: 코드와 **동반 필수** spec 갱신")으로 이미 위임·추적 중이다. 그 항목은
    "⚠️ 이 항목은 별 planner PR 로 처리하지 말 것. checker 가 '코드와 동반 필수' 로 명시했다. P1
    원자 claim 구현 PR 에서 **같은 커밋**으로 반영한다"고 명시적으로 게이팅해 두었다. 오늘 착수된
    실제 spec 정정 커밋(`71ce6c12b`, 2026-07-28 19:50)도 커밋 메시지에서 "그 중 1건(retry_last_turn)
    은 그 작업 자신의 것(#10 으로 등재)"이라며 **이번엔 의도적으로 손대지 않았다**고 명시한다. 즉
    현재 상태(코드·spec 모두 미변경, #10 체크박스 4개 전부 `[ ]`)는 "방치"가 아니라 "코드 없이는
    쓸 수 없는 spec 문구를 코드와 같은 커밋으로 묶어 순서를 지킨" 의도된 설계다.
  - **제안**:
    1. 이 항목을 **새 백로그로 재등재하지 말 것** — `spec-update-node-cancellation-shutdown-
       classification.md` #10 이 유일한 진실(SoT)이다.
    2. 이번 impl-prep 게이트 판정에서는 이 CRITICAL 을 "구현 착수를 막는" 사유가 아니라 "구현이
       완료될 때 반드시 동반해야 하는 spec 갱신 4개 항목의 이행 여부를 이후 `--impl-done` 단계에서
       재확인해야 하는" 조건으로 다뤄야 한다 — #10 자체가 "지금 막으면 고칠 수단(코드)이 없다"는
       역설을 피하려 이렇게 설계됐다.
    3. `applyRetryLastTurn` 원자 claim(P1) 이 머지되는 **같은 커밋**에 다음이 함께 반영됐는지
       `--impl-done` 재검토 시 반드시 확인: (a) §4.2 L425 각주를 crash re-drive 항목이 아니라
       `retry_last_turn` 전용 신규 Rationale 로 재연결, (b) §7.4 L906/L914 갱신(신규 claim 위치
       반영), (c) §8/§Rationale L1607 부근 각주 추가, (d) §7.5 에 "spawn 단계 원자성만으론 왜
       불충분한가"를 다루는 대칭 Rationale 신설 — `plan` #10 의 4개 체크박스와 동일.

- **[INFO]** 직전 게이트가 지목한 "무관 기존 결함" 2건(CRITICAL #1·#3) — 확인 결과 해소됨, 새
  Rationale 동반
  - target 위치: `spec/5-system/1-auth.md` §3.2 (RBAC 매트릭스 "멤버 관리" 행),
    `spec/5-system/10-graph-rag.md` Rationale "도메인 용어" 절
  - 과거 결정 출처: 두 문서 모두 자신의 `## Rationale` 신규 항목.
  - 상세: 커밋 `71ce6c12b`("docs(spec): impl-prep 게이트 차단 2건 정정 — auth RBAC 표 · graph-rag
    엔티티 명명", 2026-07-28 19:50)이 직전 게이트(17_21_27) CRITICAL #1/#3 을 정정했다. 직접 확인한
    결과:
    - `1-auth.md` §3.2 "멤버 관리" 행이 이제 `CRUD | CRUD | R | R`(Admin 삭제 포함)이고, 신규
      Rationale "§3.2 '멤버 관리' 행의 Admin 열 정정 (CRU → CRUD, 2026-07-28)"이 실측 근거
      (`removeMember()`/`ADMIN_ROLES`)·기각 대안("멤버 초대/제거/역할변경 세분화")·발견 경로
      (`review/consistency/2026/07/28/17_21_27` CRITICAL #1)까지 명시 — "번복 시 새 Rationale 동반"
      모범 사례.
    - `10-graph-rag.md` Rationale "도메인 용어" 절에 "구현 식별자 주의" 문단이 신설돼 `Entity`/
      `Relation`/`ChunkEntity`(도메인 용어) vs `GraphEntity`/`GraphRelation`/`GraphChunkEntity`
      (TypeORM `@Entity` 충돌 회피용 실제 클래스명)를 명시적으로 구분한다.
  - 제안: 회귀 없음, 조치 불요. 다만 graph-rag 쪽 정정은 auth.md 정정과 달리 날짜·"발견 경로"
    인용이 없어 provenance 추적성이 약간 떨어진다 — 향후 유사 정정에는 auth.md 식 "발견 경로 + 날짜"
    관행을 템플릿으로 쓰는 편을 권장(사소, 비차단).

- **[INFO]** target 3개 문서 자체는 Rationale 연속성 위반 없음 (재확인)
  - target 위치: `spec/5-system/1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md` 전체 — 이번
    프롬프트에 전문이 포함된 유일한 3개 파일.
  - 과거 결정 출처: 각 문서 자신의 `## Rationale`.
  - 상세: 세 문서 모두 과거 결정을 뒤집을 때 새 Rationale 을 명시적으로 동반한다 — `1-auth.md`
    §2.3.D("아웃라이어 서술을 이미 확정된 1.1.B-4 에 정렬한 것이지 새 결정이 아니다"), `11-mcp-
    client.md` "R-wontdo-cached-capabilities"(비채택 사유·재개 트리거·표기 선례까지 명시),
    `10-graph-rag.md` "KB 단위 토큰 attribution... 2026-07-11 정직화". §8.4(MCP) 의 Internal Bridge
    401 자가회복 예외도 `spec/2-navigation/4-integration.md` Rationale "`call()` 의 401 자동
    회복"과 상호 인용하며 정합적으로 교차 반영돼 있다(양쪽 문서 모두 "이 예외가 반박에도 유효한
    이유"를 대칭적으로 서술).
  - 제안: 없음. 위 CRITICAL 항목의 spec 갱신 작업 시 이 세 문서의 서술 패턴(날짜 명시 + 기각 대안
    나열 + 선례 cross-link)을 템플릿으로 재사용 권장.

- **[INFO]** 커버리지 캐벗 — 프롬프트가 이번에도 `4-execution-engine.md` 를 예산 초과로 생략
  - target 위치: 이번 세션 프롬프트 "⚠️ 컨텍스트 예산 초과로 생략된 파일 18개" 목록.
  - 상세: 직전 게이트(17_21_27) SUMMARY 가 "향후 호출 시 대상 파일 우선순위를 브랜치명/열려있는
    plan 참조 파일 기준으로 재정렬"을 명시적으로 권고했으나, 이번 재실행에서도 동일하게 사전식/숫자순
    우선 채움 방식이 그대로 쓰여 이 worktree 의 실제 작업 대상인 `4-execution-engine.md` 가 다시
    생략됐다. 위 CRITICAL 발견은 프롬프트 자체 지시("생략을 근거로 삼지 말 것")에 따라 저장소에서
    직접 Read 해 보완했으나, 이는 개별 checker 판단에 의존한 우회이지 구조적 해결이 아니다. 생략
    목록에 `_selectedPort`/`$trigger`/`$env` 같은 비-파일 항목이 섞여 있는 점도 직전 세션이 지적한
    그대로 재발했다.
  - 제안: harness 파일 선택 로직에 "브랜치명·열린 plan 의 `spec_impact` 파일을 우선 포함"하는 규칙
    추가를 harness 백로그로 고려(중복 등재 방지를 위해 기존 `harness-consistency-summary-downgrade-
    rule.md` 류 문서에 이미 흡수돼 있는지 먼저 확인할 것).

---

## 요약

이번 호출에서 전문이 제공된 3개 target 문서(`1-auth.md`/`10-graph-rag.md`/`11-mcp-client.md`)는
Rationale 연속성 관점에서 문제가 없으며, 직전 게이트(17_21_27)가 지목했던 이 영역의 CRITICAL 2건
(auth RBAC 매트릭스, graph-rag 엔티티 명명)은 `71ce6c12b` 커밋으로 이미 정정되고 각각 새 Rationale
을 동반해 회귀 없이 해소됐다. 그러나 이 impl-prep 게이트가 실질적으로 겨냥하는 작업 영역(브랜치명
`retry-atomic-claim`, plan `retry-turn-terminal-guard.md` 통합 목록 #1)인
`spec/5-system/4-execution-engine.md` 는 이번에도 컨텍스트 예산으로 프롬프트에서 생략되었고, 프롬프트
지시에 따라 직접 Read/grep 및 코드 교차검증한 결과 직전 게이트가 발견한 CRITICAL(`retry_last_turn`
재진입 경로가 spec 이 6곳에서 반복 단언하는 "동일 turn 이중 실행 0" 불변식을 실제로는 충족하지 못함)
은 아직 그대로 남아 있음을 확인했다. 다만 이는 새로 발견된 결함이 아니라, 이미
`plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #10 으로 위임·추적
중이며 "코드(P1 원자 claim)와 spec 갱신을 같은 커밋으로 동반 필수, 별도 PR 금지"라는 명시적 게이팅
아래 **의도적으로 미해소 상태로 유지**되고 있다 — 실제로 오늘의 정정 커밋도 이 항목만은 의도적으로
건드리지 않았다고 밝히고 있다. 따라서 이번 검토의 핵심 가치는 새 결함을 알리는 것이 아니라, 이
CRITICAL 이 여전히 유효하며 P1 구현이 착수될 때 그 구현과 정확히 같은 커밋에 4개의 지정된 spec
갱신(§4.2/§7.4/§8/§7.5)이 함께 반영되는지를 `--impl-done` 단계에서 반드시 재확인해야 한다는 점을
재확인·강조하는 데 있다. 코드만 고치고 spec 을 그대로 두면, 이번에 (그리고 직전 세션에) 지적된
"spec 은 불변식이 전역 유지된다고 반복 단언하는데 코드는 한 경로에서 그 불변식을 충족하지 못한다"는
자기모순형 "결정의 무근거 번복"이 문서상 영구화된다.

## 위험도

HIGH
