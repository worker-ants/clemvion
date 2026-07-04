# Plan 정합성 검토 — admission 회귀 보강 (exec-intake-followups.md)

## 검토 대상
- 계획 작업: `plan/in-progress/exec-intake-followups.md` §"PR2b 후속" 의 **"admission 회귀 보강 (ai-review testing INFO)"** 항목 (TEST-ONLY: deferred/cancelled 시 `releaseExecutionRouting`·`runExecution` 미호출 통합 유닛, workspace-cap 초과 e2e 시나리오, admission raw SQL 파라미터 순서 assert 추가).
- target 문서(검토 프롬프트에 번들된 범위): `spec/5-system/1-auth.md`, `spec/5-system/10-graph-rag.md` — 실제로는 `spec/5-system/4-execution-engine.md`(admission gate §8 의 SoT) 가 이 작업의 진짜 target 인데 프롬프트 번들에 포함되지 않음. 직접 저장소를 읽어 `4-execution-engine.md` §4.1/§7.4/§8 과 `execution-engine.service.ts`/`execution-engine.service.spec.ts` 를 대조했다.

## 발견사항

- **[INFO]** 검토 프롬프트 번들 누락 — target 문서가 실제 작업 영역과 불일치
  - target 위치: 프롬프트 `## Target 문서` 섹션 (`spec/5-system/1-auth.md`, `10-graph-rag.md` 만 포함)
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` "admission 회귀 보강" 항목
  - 상세: `--impl-prep scope=spec/5-system/` 로 광범위하게 지정된 탓에 실제 관련 문서(`4-execution-engine.md`)가 번들에서 빠지고 무관한 auth/graph-rag 문서와 방대한 plan 목록(ai-agent-tool-connection-rewrite, ai-context-memory, cafe24-backlog 등)만 실려 있다. 과거 기록된 "impl-done spec bundle bug" 패턴과 동일 — prompt 크기 제한/번들링 로직이 넓은 scope 에서 관련 파일을 놓칠 수 있음.
  - 제안: 코드 변경 사항은 없으므로(TEST-ONLY) 이번 작업 자체는 영향받지 않지만, 향후 유사 `--impl-prep spec/5-system/` 광범위 scope 호출 시 대상 파일이 실제로 번들되는지 재확인 권장(오탐 방지 차원, 코드/spec 변경 불필요).

- **[WARNING]** `spec/5-system/4-execution-engine.md` 의 `exec-intake-queue-impl.md` 참조가 stale
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` (L9-13), 본문 L379, L1071, L1524
  - 관련 plan: `plan/complete/exec-intake-queue-impl.md` (이미 이동 완료) vs `plan/in-progress/exec-intake-followups.md` (실제 후속 추적 문서, exec-intake-followups.md L9: "완료·complete 이동됨. 본 plan 은 그 과정에서 명시적으로 후속 분리된 잔여 항목만 추적")
  - 상세: `exec-intake-queue-impl.md` 는 `plan/in-progress/` 에 더 이상 존재하지 않고(`plan/complete/exec-intake-queue-impl.md` 로 이동됨) 후속 잔여는 `exec-intake-followups.md` 로 분리됐다. 그러나 `4-execution-engine.md` 는 frontmatter `pending_plans` 와 §4.1·§8·§7 세 곳의 본문에서 여전히 `plan/in-progress/exec-intake-queue-impl.md` 를 "미구현 표면 추적" 링크로 가리킨다 — 깨진 경로 참조이며, "admission 회귀 보강"·"priority 3-tier"·"workflow-level cap DTO"·"orphan pending backstop" 같은 실제 잔여 항목의 SoT 인 `exec-intake-followups.md` 로 갱신되지 않았다.
  - 제안: 이 항목은 spec 문서 갱신(`project-planner` 트랙)이 필요하며, 현재 진행 중인 TEST-ONLY 작업의 범위 밖이다. 별도로 `pending_plans:` 및 본문 3개소를 `exec-intake-followups.md` 로 교체하는 spec-sync 후속을 만들 것을 권고(이번 admission 회귀 보강 작업이 직접 처리할 필요는 없음 — 코드/스펙 아닌 테스트 전용 작업이므로 차단 사유 아님).

- **[INFO]** "admission 회귀 보강" 항목 자체는 결정 대기 없음 — 즉시 착수 가능 확인
  - target 위치: `spec/5-system/4-execution-engine.md` §8 (L1069-1090), §7.4 (L864-923 orphan/stale 스캔 범위)
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` L20 "admission 회귀 보강" 항목, L21 "orphan pending backstop" 항목(별개, 결정 완료: best-effort/후속 확정)
  - 상세: 검증 결과 `admitExecutionOrDefer` 의 admitted/deferred/cancelled 3-way 분기는 `execution-engine.service.ts` L2596-2691 에 구현되어 있고, 이미 `execution-engine.service.spec.ts` L3035-3145 `describe('admitExecutionOrDefer / markQueueWaitTimeout (PR2b §8)')` 에서 각 분기의 상태 전이·이벤트 emit 은 검증된다. 그러나 "deferred/cancelled 일 때 호출자가 `releaseExecutionRouting`·`runExecution` 을 호출하지 않는다"는 것을 명시적으로 assert 하는 통합 유닛은 파일 전체를 검색해도 존재하지 않음(확인: `not.toHaveBeenCalled` 패턴 부재) — plan 이 기술한 갭이 실재하며 과장 없음. spec §8 의 admission gate 원자성(advisory lock)·큐 대기 타임아웃 규칙도 "PR2b 구현 완료"로 안정 상태이고 결정 대기(TBD) 항목이 없다.
  - 제안: 없음(정보성) — 이 항목은 계획대로 진행 가능. 단, `orphan pending backstop`(같은 plan 파일의 별도 체크박스)과 혼동해 스코프를 확장하지 않도록 주의 — 그 항목은 "pending AND queued_at stale" 확장을 다루는 별개 결정(현재 "낮은 확률 엣지, best-effort" 로 deferred 확정)이라 이번 회귀 보강 테스트 범위에 포함시킬 필요 없음.

## 요약
"admission 회귀 보강" 은 TEST-ONLY 로 스코프가 명확하고, 대상 로직(`admitExecutionOrDefer` 3-way 분기)은 이미 PR2b 로 구현·부분 테스트된 안정 표면이라 plan 이 남긴 "결정 필요" 항목과 충돌하지 않으며 선행 조건도 모두 충족돼 있다(spec §8 은 결정 대기 없이 "구현 완료" 로 확정됨). 다만 검토 프롬프트 자체의 target 문서 번들이 실제 관련 spec(`4-execution-engine.md`)을 놓쳤고, 그 문서의 `pending_plans`/본문 3곳이 이미 이동된 `exec-intake-queue-impl.md` 를 가리키는 stale 참조를 갖고 있다는 점을 발견했다 — 둘 다 이번 TEST-ONLY 작업을 차단할 사유는 아니며, 후자는 별도 project-planner 트랙의 spec-sync 후속으로 남기면 된다.

## 위험도
LOW

BLOCK: NO
STATUS: SUCCESS