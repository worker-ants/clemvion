# 문서화(Documentation) Review

## 검증: 이전 라운드 stale "2-tier" WARNING 3건 재확인

이전 리뷰(`review/code/2026/07/04/19_02_17`)에서 지적된 3곳 모두 이번 라운드에서 수정 확인됨.

1. `spec/5-system/4-execution-engine.md` §8 본문(L1071, L1090) — "priority 3-tier 는 본 PR 스코프 아님 …
   현 2-tier 유지" → "priority 3-tier 도 **구현 완료(2026-07-04, triggerType threading, §4.3)**" /
   "priority 3-tier(`ExecuteOptions.triggerType` threading)는 구현 완료" 로 갱신됨. 같은 파일 §4.2(L411,
   PR1 메모)·§9.3 큐 카탈로그 표(L1139)도 함께 "구현 완료" 서술로 일관되게 갱신됨(cross_spec.md INFO 확인과
   일치).
2. `spec/data-flow/3-execution.md` L68 — 옛 "단 현재 `ExecuteOptions` 가 trigger type 을 싣지 않아 실제로는
   manual > 그 외 이분 … 의도된 임시 처리, PR2 triggerType threading 후속" → "호출부가
   `ExecuteOptions.triggerType`(`Trigger.type`)을 threading 하고, `execute()` 가 `executedBy` 우선 판정한다
   … triggerType threading 구현 완료(2026-07-04)" 로 갱신. 같은 파일 L205 근처 큐 payload 표도 "priority
   manual > 트리거" → "priority 3-tier manual(1) > webhook(2) > schedule(3)" 로 갱신됨.
3. `spec/data-flow/10-triggers.md` L182 큐 카탈로그 표 — 옛 "현재는 `executedBy` 유무로 manual/그 외 이분이라
   schedule 발사도 webhook priority — 의도된 임시, triggerType threading 후속" → "호출부가
   `ExecuteOptions.triggerType`(`Trigger.type`) threading, `execute()` 가 `executedBy` 우선 판정 …
   triggerType threading 구현 완료 2026-07-04" 로 갱신.

`grep -rn "2-tier\|PR2 threading 후속\|본 PR 스코프 아님"` 로 대상 3개 파일 재검색한 결과, 남은 "본 PR
스코프 아님"/"Planned" 매치 2건(§8 L1071 "단일 Execution 최대 노드 수(500)만 여전히 Planned", L1088 "pending
스캔 확장은 본 PR 스코프 아님")은 3-tier 와 무관한 별개 잔여 항목(노드 수 상한·orphan pending 스캔)이라
stale 아님. **재발 없음.**

## 발견사항

- **[INFO]** `plan/in-progress/` 잔존 문서 2건에 이제는 stale 한 "3-tier Planned/제외" 서술 잔존
  - 위치: `plan/in-progress/spec-draft-concurrency-cap-pr2b.md` (제목 줄 "priority 3-tier 제외", L21
    "제외(후속): priority 3-tier(… 현 manual>트리거 2-tier 유지)", L37 "priority 3-tier 는 이번 스코프 아님
    명시", L56 "priority 3-tier 분리"), `plan/in-progress/spec-update-execution-engine-pr4.md` L32
    "(동시성 cap PR2b·우선순위 3-tier 는 여전히 Planned 로 유지.)"
  - 상세: 이번 PR 의 diff 범위에는 포함되지 않은 인접 계획 문서이나, 3-tier 가 구현 완료된 지금 시점에서
    읽으면 "아직 미구현"이라는 오래된 인상을 줄 수 있다. `review/consistency/2026/07/04/19_17_50/cross_spec.md`
    가 이미 동일 사항을 INFO 로 독립 포착했고(spec 본문 자체는 정확히 갱신되어 SoT 충돌은 아님, plan
    lifecycle 관할), 본 리뷰도 동일 결론에 도달함 — 중복 확인.
  - 제안: 두 문서가 `plan/in-progress/` 에 남아 있는 이유(잔여 작업 존재 여부)를 확인해 완료됐다면
    `plan/complete/` 로 이관하거나, 최소한 해당 문장에 "(2026-07-04 priority 3-tier 구현 완료 — 상세는
    `exec-intake-followups.md`)" 각주를 추가. 차단 사유는 아님(스펙 SoT 는 이미 정확).

- **[INFO]** `execution-engine.service.ts` `ExecuteOptions` 의 `triggerType` JSDoc 경계 표현이 타입 시그니처보다
  좁음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L386-109 부근
    (`triggerId` variant)
  - 상세: JSDoc 은 "`'webhook'`/`'schedule'`"로 한정해 설명하지만 실제 타입은 `triggerType?:
    ExecutionRunTriggerType`(3-way, `'manual'` 포함)이라 컴파일러가 `manual` 리터럴 대입을 막지 못한다. 다만
    이 갭은 이전 세션 SUMMARY/RESOLUTION 에서 이미 "discriminated union 컴파일 강제 한계" 로 식별·기록됐고
    (3개 실제 호출부 모두 안전 리터럴만 전달), 이번 라운드에서 재조치 대상이 아니다. 재확인 차원의 기록.
  - 제안: 없음(기존 기록된 의도적 잔여 사항, 재차단 불필요).

- **[INFO]** 신규 유닛 테스트명에 PR 라벨 `(PR2)` 하드코딩
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L40
    `'triggerType threading — manual>webhook>schedule 3-tier + fallback (PR2)'`
  - 상세: 이전 세션에서 이미 무해로 판정된 사항(테스트명은 실행에 영향 없음). 코드 변경 없음, 문서 관점의
    사소한 지적 수준.
  - 제안: 없음.

인라인 주석·JSDoc 정확성은 전반적으로 양호하다 — `ExecuteOptions` 의 `triggerType` 필드 주석(§4.3 참조,
`Execution.triggerSource` 와의 별개 필드 경계 명시, `ExecutionRunJob` payload 미포함 근거)과 `execute()` 본문
priority 계산부 주석이 코드 로직과 정확히 일치하며, `hooks.service.ts`/`schedule-runner.service.ts` 의
호출부 인라인 주석도 왜 해당 리터럴을 쓰는지(webhook 고정, schedule 자동발화 vs runNow manual 유지)를
정확히 설명한다. README/CHANGELOG/환경변수 문서화 대상 변경은 없음(HTTP API·공개 계약·신규 env var 없음 —
`api_contract.md`/`_routing_decision.json` 의 판단과 일치). plan 완료 이관(`exec-intake-followups.md` 체크박스,
`exec-intake-queue-impl.md` frontmatter `spec_impact`)도 이번 라운드에서 정확히 갱신됨.

## 요약

이전 라운드에서 지적된 3건의 stale "2-tier"/"PR2 threading 후속"/"본 PR 스코프 아님" 서술은
`spec/5-system/4-execution-engine.md`(§4.2·§8·§9.3 세 지점 모두), `spec/data-flow/3-execution.md`,
`spec/data-flow/10-triggers.md` 전부에서 "구현 완료(2026-07-04)" 서술로 정확하고 일관되게 갱신되었으며 재발
없음을 확인했다. 코드 인라인 주석(execute() priority 계산부, ExecuteOptions JSDoc, 호출부 3곳)도 실제 로직과
정확히 일치한다. 유일한 잔여 관찰은 이번 PR 의 diff 범위 밖에 있는 인접 `plan/in-progress/` 계획 문서 2건이
이제는 outdated 된 "3-tier Planned" 서술을 보유한다는 INFO 이며(SoT 인 spec 자체는 이미 정확), 이는
consistency-checker 가 이미 독립적으로 포착한 사항과 일치한다. Critical/Warning 없음.

## 위험도

LOW

STATUS: SUCCESS
