# 변경 범위(Scope) 리뷰 — retry_last_turn 재진입 원자 claim (b351731f0)

대상 커밋: `b351731f0 fix(engine): retry_last_turn 재진입의 비원자 가드 — 조건부 UPDATE claim 으로 교체 (#10 동반)` (브랜치 `claude/retry-atomic-claim-4d9e77` 유일 커밋, `main` 대비 diff 전체가 이 한 커밋).

## 발견사항

- **[WARNING]** 이 fix 와 무관한 backlog 항목(#11, GraphRAG "노드/엣지" 명명 회피 규칙)이 같은 커밋에 신규 섹션으로 추가됨
  - 위치: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:576` (`## 추가 위임 (2026-07-28 #11) — 경량: 그래프 시각화 "노드/엣지" 명명 회피 규칙 미문서화` 섹션 전체 + 하위 체크박스 2개, 583줄까지). 이 파일은 리뷰 페이로드 3파일에 포함되지 않아 게이트 번호가 없으므로 `Read`/`Grep` 으로 직접 열어 확인한 실제 줄 번호.
  - 상세: 이 섹션은 Graph RAG 시각화 컴포넌트(`@xyflow/react` `Node`/`Edge`, 백엔드 `NodeDto`/`EdgeDto`)와 KB-GR-UI-07 그래프 시각화 "노드/엣지" 명명이 충돌한다는 관측을 다룬다. `retry_last_turn`/`execution-engine`/atomic-claim 어느 것과도 관련이 없고, 커밋 diff 자체가 언급하는 근거(`--impl-prep 19_51_18` WARNING #3)도 이 PR 의 작업(`#10`)이 아니라 별개 세션의 impl-prep 게이트 산출물이다. 커밋 본문(장문)도 이 항목을 전혀 언급하지 않는다 — 순수 부수 편집.
  - 제안: 별도 커밋(혹은 project-planner 턴)으로 분리해 "retry_last_turn 원자 claim" 이라는 이 커밋의 단일 관심사를 지킬 것. 단, 리스크는 낮음 — 문서 전용(`plan/**`)이고 런타임 영향이 없으며, "발견 즉시 plan/ 에 기록"(review 산출물은 SoT 아님)이라는 이 프로젝트의 확립된 관례에는 부합한다. 기록 자체가 아니라 **매개 커밋 선택**이 부적절하다는 지적.

- **[WARNING]** harness/tooling 관측 노트가 같은 커밋에 동반됨, 역시 이 fix 와 무관
  - 위치: `plan/in-progress/harness-consistency-summary-downgrade-rule.md:135` (`### 재발 관측 (2026-07-28, 같은 날 2회차) — 7번째 + 신규 축` 섹션 전체, 156줄까지). 마찬가지로 게이트 없는 파일 — 직접 확인한 실제 줄 번호.
  - 상세: `--impl-prep spec/5-system/` 게이트가 `4-execution-engine.md` 를 checker 프롬프트 예산에서 누락시켰다는 harness 결함 관측 + `convention_compliance` 카탈로그 문서 우선순위 이슈. 파일 제목("consistency-summary 가 Critical 을 하향할 수 있는가")·frontmatter(`worktree: (unstarted)`, `owner: developer`, `started: 2026-07-25`) 모두 이 커밋의 주제(atomic claim 교체)와 별개의, 이미 진행 중이던 standing tracker다. 이 fix 의 코드/스펙 변경과 인과관계가 없다.
  - 제안: 위와 동일한 이유로 별도 커밋 권장. 리스크 낮음(문서 전용, 이미 존재하는 표준 tracker 에 append).

- **[INFO]** 같은 plan 문서 상단의 "동반 커밋" 규약 완화 문구는 이 PR 자체의 전달 규약을 정의하므로 예외적으로 관련성 있음 (문제 아님)
  - 위치: `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:542-543` ("이 항목은 별 PR 로 처리하지 말 것" / "같은 PR(브랜치) 안에서 반영한다").
  - 상세: "같은 **커밋**" → "같은 **PR(브랜치)**" 완화는 바로 이 PR(`#10`, atomic claim)이 spec 을 어떤 단위로 동반해야 하는지를 규정하는 self-referential 수정이다. 위 두 건과 달리 이 커밋이 다루는 작업 자체의 거버넌스 노트이므로 스코프 이탈로 보지 않음.
  - 제안: 없음(참고용, 조치 불요).

## 핵심 코드 변경 3파일 평가 (리뷰 페이로드 대상)

`git show` 로 실제 diff 를 직접 대조한 결과, 아래 3파일은 커밋 의도(read-then-branch 가드를 조건부 UPDATE claim 으로 교체)와 **정확히 일치**하며 스코프 이탈 신호가 없다.

1. **`codebase/backend/src/modules/execution-engine/retry-turn.service.ts`** — diff 는 정확히 2개 hunk 뿐이다. (a) `applyRetryLastTurn` 의 기존 fast-path 주석을 "레이스 결정자 아님" 으로 정정(과거 이 주석이 `continuation-execution.processor.ts` 의 claim 제외 근거로 오용돼 5R CRITICAL 을 유발했다는 배경이 커밋 본문에 명시됨 — 정당한 주석 수정). (b) 그 직후에 조건부 UPDATE(`status='running' AND jsonb_exists(...)`) 원자 claim 블록 신규 추가. 두 조건 모두 커밋이 약속한 정확히 그 내용이며, import·포맷팅·비관련 리팩토링 변경 없음(`git show -w` 비교 결과 whitespace-only 변경 0). `finalizeGuarded`/`completeRetryExecution`/`failRetryExecution` 등 파일 내 다른 대형 JSDoc 블록은 이번 diff 밖(2026-07-27 이전 라운드에서 이미 존재)이라 이 리뷰의 스코프 관심사가 아님.
2. **`codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts`** — 신규 claim 코드에 필요한 `createQueryBuilder` mock 기본값 추가 + 기존 테스트 (b) 제목/주석을 "fast path" 로 명확화 + claim 을 직접 검증하는 신규 테스트 (b2)(claim affected=0 → discard)·(b3)(SET/WHERE/AND-WHERE SQL 형태 검증)뿐. 커밋 본문의 "mutation 4/4 RED" 주장과 1:1 대응.
3. **`codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts`** — diff 는 주석 블록 재작성 1건뿐이고 조건문(`type !== 'cancel' && type !== 'retry_last_turn'`) 자체는 미변경. 과거 "자체 멱등 가드" 서술이 자기모순이었다는 정정으로, 커밋 본문이 명시적으로 언급하는 수정.

## 참고 — 리뷰 페이로드 밖이지만 같은 커밋에 포함된 코드 파일

`codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 는 이번 리뷰의 3개 대상 파일에는 없었으나 같은 커밋에 포함되어 있어 `git show` 로 직접 확인했다. diff 는 통합 테스트용 `mockNodeExecutionRepo.createQueryBuilder().update()` 가 SELECT 형 기존 체인과 신규 UPDATE(claim) 체인을 혼동하지 않도록 `retryClaimQb` 별도 체인 객체를 분리한 것뿐이다 — `RetryTurnService` 를 real driver 로 구동하는 통합 스펙이 이번 fix 로 새로 호출하게 된 `createQueryBuilder().update()` 경로를 mock 하기 위한 필수 부수 변경이며, 스코프 이탈 아님.

또한 `spec/5-system/4-execution-engine.md` (§4.2 각주, §7.4 두 행, §7.5 신규 Rationale)·`plan/in-progress/retry-turn-terminal-guard.md` (frontmatter `worktree:` 값을 현재 worktree 로 갱신 — plan_guard 오판 방지, 커밋 본문에 명시)는 모두 이 fix 의 필수 동반 스펙/plan 갱신으로 스코프 내.

## 요약

핵심 코드 변경(3개 리뷰 대상 파일 + 확인차 대조한 `execution-engine.service.spec.ts`, `spec/5-system/4-execution-engine.md`, `retry-turn-terminal-guard.md`)은 "read-then-branch 가드 → 조건부 UPDATE claim" 이라는 커밋 의도에 정확히 부합하며, 불필요한 리팩토링·기능 확장·포맷팅 노이즈·임포트 변경·설정 변경은 전혀 없다. 오히려 `resumeGraphAfterRetry` JSDoc 이 "공통 helper 추출은 PR2 scope creep 회피를 위해 후속 plan 으로 분리" 라고 명시하는 등 스코프 절제가 코드 차원에서 잘 지켜지고 있다. 다만 같은 커밋에 `plan/in-progress/` 하위 두 개 문서(`spec-update-node-cancellation-shutdown-classification.md` 의 GraphRAG 명명 backlog, `harness-consistency-summary-downgrade-rule.md` 의 impl-prep 게이트 관측)가 이 fix 와 무관한 내용으로 함께 커밋됐다 — 문서 전용이라 런타임 리스크는 없고 "발견 즉시 plan 기록" 관례에는 부합하지만, 커밋 단위의 단일 관심사 원칙에서는 벗어난다.

## 위험도

LOW
