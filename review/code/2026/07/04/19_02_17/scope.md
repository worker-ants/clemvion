# 변경 범위(Scope) Review — priority 3-tier (triggerType threading)

## 리뷰 대상 요약

`ExecuteOptions.triggerType` 필드 신설 + `execute()`/webhook/chat-channel/schedule-runner 호출부
threading(3곳) + 대응 spec 3-tier flip + 관련 unit 테스트 갱신. 총 16개 변경 파일 중:

- 코드 3파일(execution-engine.service.ts, hooks.service.ts, schedule-runner.service.ts)
- 테스트 3파일(각 서비스 대응 .spec.ts)
- spec 1파일(4-execution-engine.md, §4/§4.3/§8/§9.3 4곳 flip)
- plan 1파일(exec-intake-queue-impl.md — `spec_impact` frontmatter 추가)
- consistency-check 산출물 6파일(review/consistency/2026/07/04/18_33_09/**, --impl-prep 신규 세션)

## 발견사항

- **[INFO]** `plan/complete/exec-intake-queue-impl.md`의 `spec_impact` frontmatter 추가는 이번 PR 범위 밖처럼 보이나 확인 결과 정당
  - 위치: `plan/complete/exec-intake-queue-impl.md` frontmatter (diff L1133-1143)
  - 상세: 이 plan 파일은 이미 완료 상태로 `complete/`에 있고, "priority 3-tier" 구현 자체와 직접 관련 없어 보일 수 있다. 그러나 git 이력 확인 결과 직전 커밋(`2816ec774`, PR #802, "exec-intake 큐 백로그 완료 → complete/ 이동")이 이 파일을 `in-progress` → `complete`로 이동시키면서 `spec_impact` 키를 **당시 추가하지 않고 누락**시켰던 것으로 보이며, 이번 변경이 그 frontmatter(`spec_impact: [...]` 5개 spec 경로)를 보강하는 회귀 조치임을 사용자가 사전 확인했다(prompt 지시: "Gate C spec_impact fix 는 #802 회귀 보강 — 확인"). `.claude/docs/plan-lifecycle.md`/Gate C 정책상 완료 plan은 `spec_impact` 리스트(또는 `none`)가 frontmatter에 필수이므로, 이 추가는 이번 PR이 우연히 건드린 무관한 파일이 아니라 직전 PR의 정합성 결손을 메우는 의도된 보강으로 판단된다. 변경 범위 관점에서는 "관련 없는 파일 수정"으로 보일 수 있으나 근거가 확인됐으므로 CRITICAL/WARNING 사유 아님.
  - 제안: 조치 불요(이미 확인됨). 커밋 메시지에 "#802 spec_impact 보강" 근거를 한 줄 남겨두면 향후 리뷰어의 재질의를 줄일 수 있음(선택).

- **[INFO]** `review/consistency/2026/07/04/18_33_09/**` 6개 신규 산출물은 코드 변경이 아니라 프로세스 산출물이며 스코프 내
  - 위치: `review/consistency/2026/07/04/18_33_09/{SUMMARY,cross_spec,rationale_continuity,convention_compliance,plan_coherence,naming_collision}.md`, `_retry_state.json`, `meta.json`
  - 상세: CLAUDE.md 규약상 developer는 구현 착수 직전 `consistency-check --impl-prep` 의무이며, 산출물은 `review/consistency/**`에 저장하는 것이 정식 위치다. 이번 PR의 실제 구현 대상(priority 3-tier)과 정확히 일치하는 세션이고, 5개 checker 전부 BLOCK:NO로 착수 근거를 남긴 정상 워크플로 산출물이다. 커밋에 포함된 것은 "plan 체크박스 = 실제 상태" 규약(및 review 산출물이 gitignore 대상이 아님)과도 합치한다.
  - 제안: 없음. 정상 스코프.

- **[INFO]** consistency-check 산출물 내 payload 조립 결함 지적(plan_coherence.md, naming_collision.md)은 이번 코드 변경과 무관한 tooling 이슈이나, 해당 문서 자체에만 기록되어 코드에 영향 없음
  - 위치: `review/consistency/.../plan_coherence.md` "페이로드 결함" 단락, `naming_collision.md` 인용문
  - 상세: orchestrator payload 조립이 `spec/5-system/1-auth.md`/`10-graph-rag.md` 등 무관 파일만 실어 보낸 결함을 checker가 자체 발견해 파일시스템 직접 열람으로 우회했다고 기록한 것으로, 이번 code diff에 어떤 실질 코드 변경도 유발하지 않았다. 스코프 이탈 아님(기록용 부수 관찰).
  - 제안: 없음.

- **[INFO]** `execution-engine.service.ts`의 리팩터(`const triggerType = ... 2-tier` → `triggerType: ExecutionRunTriggerType = ...` 3-tier)는 요청 범위와 정확히 일치
  - 위치: `execution-engine.service.ts` L3234-3243(diff)
  - 상세: 기존 TODO(PR2) 주석이 정확히 이 변경을 예고하고 있었고, 실제 diff는 주석 갱신 + 조건식 확장(executedBy 우선 → triggerType fallback) 뿐이다. 불필요한 추가 리팩터링·기능 확장·무관한 코드 정리 없음.
  - 제안: 없음.

- **[INFO]** 테스트 변경은 신규 동작(3-tier)을 검증하는 추가 테스트 + 기존 테스트의 주석/픽스처만 갱신 — 과잉 없음
  - 위치: `execution-engine.service.spec.ts`(신규 `it` 1건 추가 + 기존 주석 1줄 수정), `hooks.service.spec.ts`(4곳 기대값에 `triggerType: 'webhook'` 추가), `schedule-runner.service.spec.ts`(2곳 기대값에 `triggerType: 'schedule'` 추가)
  - 상세: 모든 테스트 변경이 실제 코드 변경(신규 필드 threading)의 직접적 결과이며, 무관한 테스트 리팩터·삭제·포맷팅 변경은 없음. `schedules.service.ts`(runNow, `executedBy`) 관련 테스트는 변경되지 않았으며 이는 diff에도 반영대로(코드도 미변경) — cross_spec 체커가 지적한 "runNow는 manual 유지, 변경 대상 아님" 결정과 정확히 합치.
  - 제안: 없음.

- **[INFO]** spec 변경(`4-execution-engine.md`) 4곳은 모두 "Planned" → "구현 완료" 상태 flip이며 신규 정책·요구사항 추가 없음
  - 위치: §4 상단 구현 상태 배너, §4.2 PR1 메모, §8 상단 배너, §9.3 큐 카탈로그 표 `execution-run` row
  - 상세: 값 자체(3-tier 매핑, executedBy 우선)는 이미 §Rationale/§4.3에 사전 합의된 설계였고, 이번 diff는 "Planned" 표기 해제 및 구현 완료 사실 반영만 수행한다. 신규 요구사항이나 범위 확장이 아님.
  - 제안: 없음.

## 요약

이번 변경은 사전에 합의·예고된 좁은 범위("priority 3-tier / triggerType threading")를 정확히 구현한다 — 코드 3파일 + 대응 테스트 3파일 + spec 4곳 flip으로 구성되며, 무관한 리팩터링·포맷팅·기능 확장은 발견되지 않았다. 유일하게 스코프 경계에서 의문을 살 만한 두 항목(`plan/complete/exec-intake-queue-impl.md`의 `spec_impact` frontmatter 추가, `review/consistency/2026/07/04/18_33_09/**` 신규 산출물)은 각각 (1) 사용자가 사전 확인한 대로 직전 PR #802의 Gate C 회귀 보강이고 (2) CLAUDE.md가 의무화한 `--impl-prep` 워크플로 산출물로, 둘 다 이번 PR의 목적과 직접 연결된 정당한 부수 변경이다. Critical/Warning 없음.

## 위험도
NONE

STATUS: SUCCESS
