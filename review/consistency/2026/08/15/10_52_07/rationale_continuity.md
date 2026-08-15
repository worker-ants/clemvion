# Rationale 연속성 검토 결과

## 검토 범위 확인

prompt 의 bundle 은 `spec/5-system/` 전체를 --impl-done 번들로 담고 있으나, `git diff origin/main...HEAD`
로 실측한 결과 이번 라운드까지 포함한 실질 변경은 EIA 종결 이벤트 `durationMs` 3종 구현
(`plan/in-progress/eia-terminal-payload.md` "재판정 ④") + Re-run `/v1/` 세그먼트 정정이다.
워크트리 이름(`eia-r8-cache-scope-4ae434`)이 가리키는 R8(Idempotency-Key 캐시 스코프) 결정은
이미 완료·병합돼 있고 이번 diff 어디에도 건드려지지 않았다 — 동일 세션의 선행 세 라운드
(`08_45_50`, `09_00_27`, `09_58_31`)와 동일 결론을 코드 레벨(`git diff origin/main...HEAD -- spec/5-system/14-external-interaction-api.md`)로 재확인했다. 이번 라운드는 그 세 라운드 이후
추가된 두 fix 커밋(`6bedc7e3c` 콤마/trailing-comma, `8a0c2348b` 정규식 과잉범위 되돌림 +
§6.5 blockquote 분리)과, 그 사이 code-review 라운드(`10_18_38`, `10_34_51`)가 새로 발견해
plan 백로그에 등재한 항목들이 spec 본문의 Rationale 연속성에 영향을 주는지를 추가로 확인했다.

## 발견사항

- **[WARNING]** §6 "DB 와 wire 가 같은 값" 이라는 새 invariant 서술에 이미 알려진 예외(retry-turn 재진입)가 캐비엇 없이 빠져 있다
  - target 위치: `spec/5-system/14-external-interaction-api.md:575`(§6 필드 집합 표 `durationMs` 행)
    · `:808`(§6.5 blockquote) — 둘 다 "엔티티를 로드하지 않는 5경로는 UPDATE 문 안에서 SQL 로
    계산하고 `RETURNING` 으로 되받아 싣는다(**DB 와 wire 가 같은 값**)" 을 무조건적 사실로 적는다.
  - 과거 결정 출처: 이 문서 자신이 반복해서 세운 관행 — R14 "2026-08-11 범위 명확화", R17
    "**잔여 위험**" 절, §6.4 error 필드의 "종전의 '일부 경로는 string' 캐비엇은 해소됐다"
    표기, "§1.5 구현 갭 — 해소 이력" 캐비엇([data-flow/15-external-interaction.md Rationale](../data-flow/15-external-interaction.md)) 모두 **"알려진 갭·예외는 지우지 말고 명시한다"**
    는 동일 원칙을 공유한다.
  - 상세: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 이번 라운드에서
    새로 등재된 "retry-turn 재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다 (`10_34_51` W1)"
    항목을 코드로 직접 확인했다 — `retry-turn.service.ts` `finalizeGuarded` 의 CANCELLED
    재진입 분기(`live.status === target`)는 `COALESCE(duration_ms, :newDurationMs)` 로 DB 에
    **`stop()` 이 커밋한 T1 값을 보존**하는데, `failRetryExecution`(:964-971)의 emit 은
    `resolveTerminalDurationMs(execution)` 즉 **재진입 시점 in-memory T2** 를 싣는다 — DB(T1)
    ≠ emit(T2). plan 백로그 자신이 이를 "**이 PR 이 세운 'DB = wire' 불변식의 유일한 잔여
    위반**" 이라 명명했다. 즉 이 PR 이 spec 에 새로 못박은 invariant 가 이미 스스로 발견한
    반례를 하나 갖고 있는데, 그 반례가 spec 본문에는 전혀 반영되지 않았다 — §6.5 blockquote
    가 이미 `markQueueWaitTimeout` 예외(큐 대기 시간 vs 실행 시간)는 정직하게 캐비엇으로
    남기면서, 같은 절에서 재진입 예외만 빠뜨린 비일관이다.
  - 제안: §6 표 `durationMs` 행 또는 §6.5 blockquote 에 한 줄 추가 — 예: "**단, retry-turn
    CANCELLED 재진입 시 DB(최초 stop 값)와 emit(재진입 시점 값)이 어긋날 수 있다 —
    추적: `spec-sync-external-interaction-api-gaps.md` W1**". 코드 수정 자체(emit 전 재조회)는
    이번 라운드 스코프 밖이라는 plan 의 판단(과잉 스코프 반복 회피)은 타당하므로 유지하되,
    spec 의 "무조건 같다" 문구만이라도 이 문서의 기존 관행대로 예외를 명시할 것.

- **[INFO]** `spec/data-flow/3-execution.md` 시퀀스 다이어그램 미동기화 — 3라운드째 이월
  - target 위치: (범위 밖 미변경 파일) `spec/data-flow/3-execution.md:111`
  - 과거 결정 출처: `plan/in-progress/eia-terminal-payload.md` frontmatter `spec_impact` —
    직전 라운드(`09_00_27` plan_coherence W3)의 지적으로 4번째 항목으로 추가됐으나, 실제 파일
    편집은 이번 diff 에도 없다(`git diff origin/main...HEAD -- spec/data-flow/3-execution.md`
    빈 결과).
  - 상세: 직전 라운드(`09_58_31`)가 이미 "Rationale 위반 아님, 결과적으로 우연히 참이 됨,
    다만 새 캐비엇(큐 대기 시간 구분 등) 미반영" 으로 INFO 판정했고 상태는 변하지 않았다.
    frontmatter 에 `spec_impact` 로 선언은 됐으나 실행은 다음 턴으로 이연된 것으로 보인다.
  - 제안: 이번 PR 범위에서 처리하지 않는다면 plan 에 "이번 PR 범위 밖, 다음 턴 이연" 사유를
    명시적으로 남겨 다음 세션이 반복 조사하지 않게 할 것(이미 유사한 명시가 다른 이연 항목에는
    있다).

- **R8(Idempotency-Key 캐시 스코프) 결정 — 재확인, 회귀 없음** (선행 3라운드와 동일 결론)
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R8 (line 1242 부근),
    EIA-IN-11, EIA-RL-02
  - 과거 결정 출처: `plan/complete/spec-draft-eia-idempotency-key-scope.md` — 캐시 키를
    execution+route 로 스코프, 토큰(jti) 스코프·전역 키 복귀 모두 기각.
  - 상세: 이번 라운드의 diff(durationMs, `/v1/` 정정, 콤마 수정, §6.5 blockquote 분리, 정규식
    과잉범위 되돌림)는 이 결정의 어떤 표현도 건드리지 않는다.
  - 제안: 없음.

- **"삭제된 약속"(`finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`) 재도입 없음 — 재확인**
  - target 위치: `spec/5-system/14-external-interaction-api.md:577-580`(`git blame` 기준 라인은
    소폭 이동했으나 문구 동일)
  - 상세: 이번 라운드의 두 fix 커밋(`6bedc7e3c`, `8a0c2348b`)도 이 캐비엇을 건드리지 않았고,
    `chat-channel/types.ts` 의 `EiaCompletedEvent` 주석도 같은 결정을 재확인해 인용한다.
  - 제안: 없음.

- **Planned→구현됨 전환의 "해소" 보존 관행 — 이번 두 fix 커밋에도 유지됨**
  - target 위치: `spec/5-system/14-external-interaction-api.md:575, 698, 743-744, 804-808`
  - 상세: `6bedc7e3c`/`8a0c2348b` 는 순수 포맷(콤마·blockquote 분리) 수정이라 취소선+"(2026-08-15
    해소)" 형태의 이력 보존 문구 자체는 변경 없이 유지됐다. 직전 라운드(`09_58_31`)가 확인한
    상태와 동일.
  - 제안: 없음.

## 요약

이번 라운드까지 포함한 실질 diff(durationMs 3종 구현, Re-run `/v1/` 정정, 그 이후 code-review
라운드가 유발한 콤마/blockquote/정규식-과잉범위 수정)는 기존 Rationale 어느 항목도 재도입·
번복하지 않는다. R8 캐시 스코프 결정, "삭제된 약속" 캐비엇, Planned→구현됨 "해소" 보존 관행은
모두 선행 세 라운드와 동일하게 온전히 유지돼 있음을 재확인했다. 다만 이번 라운드가 새로 찾은
지점 하나는 — 이 PR 이 spec 에 처음 못박은 "durationMs 는 DB 와 wire 가 같은 값" invariant가,
같은 code-review 사이클에서 이미 스스로 찾아 plan 백로그에 등재한 반례(retry-turn CANCELLED
재진입)를 spec 본문에 캐비엇으로 반영하지 않은 것이다 — 이 문서 자신이 R14·R17·§6.4·§1.5에서
반복 증명한 "알려진 갭은 지우지 말고 명시한다" 원칙과 결이 어긋나는 WARNING 이다. 코드 수정
자체를 이번 라운드에 요구하지는 않는다(과잉 스코프 회피라는 plan 의 판단은 타당). 두 번째는
INFO 수준으로 이월된 `spec/data-flow/3-execution.md` 다이어그램 미동기화 — 3라운드째 상태 불변.

## 위험도

LOW
