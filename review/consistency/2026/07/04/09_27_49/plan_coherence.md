# Plan 정합성 검토 — spec-draft-c3-context-drift.md vs plan/in-progress/refactor/06-concurrency.md C-3

## 발견사항

- **[WARNING]** C-3 plan 본문의 "PR3 에서 자연 해소" 전제가 stale — target 이 Rationale 에서만 정정하고 plan 은 갱신하지 않음
  - target 위치: `plan/in-progress/spec-draft-c3-context-drift.md` Δ4 3번째 불릿 — "segmentStartMs in-memory 성은 수용된 trade-off(Graceful Shutdown under-count) — 세그먼트-start 영속은 **PR4** 이연(PR3 미해소, 2026-07-04 정정). 전면 Redis store 미채택."
  - 관련 plan: `plan/in-progress/refactor/06-concurrency.md` C-3 섹션 — 다음 4곳이 여전히 "PR3(Redis/DB 영속)에서 자연 해소" 를 전제로 서술
    - L69 체크박스: "기존 plan exec-intake-queue-impl.md **PR3** 연동 (독립 작업화 금지)"
    - L71 spec 대조 근거: "`segmentStartMs` 소실은 ... **PR3(Redis/DB 영속)에서 자연 해소**로 이미 예정"
    - L83 옵션 A 장점: "PR3 에서 자연 해소로 이미 예정 — 중복 작업 없음"
    - L86 권장 근거: "유일한 실손실(segmentStartMs)은 **PR3** 가 이미 해소를 예정"
    - L88 검증 계획: "**PR3 착수 시** active-running 누적 연속성 테스트 추가"
  - 상세: `exec-intake-queue-impl.md` L57 을 보면 PR3 는 이미 **완료**됐고(2026-07-04, `exec-park-durable-resume.md` 로 이관), 실제 스코프는 "크래시 RUNNING checkpoint 재개"(§7.5 case B re-drive)로 재확정됐다 — `segmentStartMs`/context 영속과는 무관하다. 즉 06-concurrency C-3 이 전제한 "PR3 가 segmentStartMs 를 자연 해소" 라는 가정은 이미 근거를 잃었다. target 의 Δ4 는 이를 인지하고 "PR4 이연" 으로 정정했지만, 이 정정은 **spec Rationale 텍스트에만** 반영되고 원본 plan(`06-concurrency.md` C-3)의 L69/71/83/86/88 은 그대로 "PR3" 를 가리킨 채 남는다. 문서 간 SoT 가 갈라진다 — plan 을 읽는 사람은 여전히 PR3 를 기다리게 되고, spec Rationale 을 읽는 사람만 PR4 를 알게 된다.
  - 제안: `06-concurrency.md` C-3 의 L69/71/83/86/88 을 target 의 Δ4 문구에 맞춰 "PR3 완료(범위 재확정, segmentStartMs 무관) → segmentStartMs 영속은 PR4 미정 과제로 재이관" 으로 갱신. target PR(developer 트랙) 범위에 이 plan 문서 수정도 포함해야 두 SoT 가 재정합된다.

- **[WARNING]** PR4 가 실제로 segmentStartMs 를 다룬다는 근거가 plan 어디에도 없음 — target 의 "PR4 이연" 자체가 새로운 미확정 결정
  - target 위치: `plan/in-progress/spec-draft-c3-context-drift.md` Δ4 3번째 불릿("PR4" 로 지정)
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` L58 — "PR4 — stalled-job 일원화 + 관측성: `recoverStuckExecutions` 절대 30분 일괄 fail → BullMQ stalled 재배달로 대체. `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의. `waiting_for_input` 무관 보장 재확인. DLQ/관측성 정리."
  - 상세: PR4 의 기술된 스코프는 stalled-job 처리·heartbeat 재정의·DLQ/관측성이며 `segmentStartMs`/context 영속을 전혀 언급하지 않는다. `segmentStartMs` 라는 단어가 plan 전체에서 등장하는 유일한 곳은 `exec-intake-queue-impl.md` L54 인데, 이는 PR3 스코핑 조사 중 "Map L723 잔존" 이라는 **현황 관찰**일 뿐 PR4 산출물 약속이 아니다. 즉 target 이 "PR4 이연" 이라 단정하는 것은 실제로는 **아직 아무 plan 도 담보하지 않은 새 결정**을 target 문서가 일방적으로 만들어 넣는 것에 가깝다 — "선행 plan 미해소"에 해당.
  - 제안: (a) PR4 plan 항목에 segmentStartMs 영속 과제를 명시적으로 추가하거나, (b) target Rationale 문구를 "PR4 후보(미확정, 별도 결정 필요)" 정도로 완화하고 "이연(deferred)" 이라는 확정적 표현을 피한다. 사용자에게 "PR4 가 segmentStartMs 를 실제로 다룰 것인가" 확인 후 두 plan 문서(06-concurrency C-3, exec-intake-queue-impl PR4)를 함께 갱신하는 것이 안전.

- **[INFO]** target 자체 근거(§Δ4)와 06-concurrency C-3 권장안(옵션 A) 결론은 일치 — 실질 충돌 아님
  - target 위치: `plan/in-progress/spec-draft-c3-context-drift.md` 변경 핵심 + Δ4
  - 관련 plan: `06-concurrency.md` C-3 L86 "권장: A"
  - 상세: target 의 "Redis context store 미채택 + in-memory 정직화" 결론은 06-concurrency C-3 옵션 A(PR3 cross-link + 드리프트 banner)의 실행 결과와 방향이 같다 — "전면 Redis 스토어 신설 없이 spec 정직화" 라는 핵심 판단은 어긋나지 않는다. 어긋나는 부분은 오직 "누가/언제 segmentStartMs 영속을 다루는가" 라는 taxonomy(PR3→PR4) 뿐이다. 따라서 CRITICAL 은 아니고, plan 문서 갱신 누락(WARNING) 수준으로 판단.

## 요약
target spec-draft 는 06-concurrency C-3 이 전제한 "PR3 가 segmentStartMs 영속을 자연 해소한다" 는 가정이 stale 함을 정확히 인지하고 있으나(PR3 는 크래시 재개로 재스코핑·완료됨), 그 정정을 spec Rationale 텍스트에만 반영하고 원본 plan(`06-concurrency.md` C-3 L69/71/83/86/88)은 여전히 PR3 를 가리킨 채 방치한다. 또한 "PR4 이연" 이라는 새 지정은 `exec-intake-queue-impl.md` PR4 항목의 기술된 스코프(stalled-job/관측성)에 segmentStartMs 언급이 전혀 없어, 실제로는 아직 어떤 plan 도 담보하지 않은 미확정 결정을 target 이 확정적 어조로 도입하는 셈이다. 두 문서(06-concurrency.md C-3, exec-intake-queue-impl.md PR4)를 함께 갱신하거나 최소한 target 문구를 "미확정 후보"로 완화해야 plan 간 SoT 가 재정합된다. Redis 미채택이라는 핵심 방향성 자체는 06-concurrency 옵션 A 권장과 합치하므로 CRITICAL 로 볼 근거(미해결 결정 우회)는 없다.

## 위험도
MEDIUM
