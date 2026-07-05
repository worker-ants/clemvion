# Consistency SUMMARY — impl-prep spec/2-navigation/ (16_27_37)

모드: `--impl-prep` — V-05(실행 상세 노드 서브탭) 구현 착수 직전. 계획: 실행 상세 `page.tsx`가 에디터 `ResultDetail` 컴포넌트를 재사용해 Config·LLM Usage·메시지 레벨(Response/Request/LLM Usage) 탭을 추가(`14-execution-history.md` EH-DETAIL-03 §3.3/§3.4). spec 무변경(이미 ✅).

## BLOCK: NO

Critical 0. Warning 2(비차단, 아래) + INFO 다수. 모든 발견이 **"재사용(reuse), 재구현(reimplement) 금지"** 방향을 강화 — 구현 방침과 일치.

## Checker 결과

| Checker | 위험도 | 핵심 |
|---|---|---|
| cross_spec | LOW | **WARNING**: nav §3.3 기본탭 규칙이 editor `3-execution.md §10.6.1`의 두 뉘앙스(AI multi-turn retryable-error→Preview-over-Error, 탭 숨김 시 auto-fallback) 생략 → **ResultDetail 재사용이 이 동작을 자동 상속**하므로 default-tab 로직 재구현 금지로 해소. INFO: Config "unsupported node" 문구 차이 |
| rationale | LOW | INFO: (1) 재사용으로 §3.4.2 R-3 평탄화 자동 준수(재구현 시 옛 nested 구조 부활 위험), (2) R-1(list API가 nodeExecutions 제외)·R-4(skipped 제외) 회귀 테스트로 보존, (3) Config 탭 첫 노출 시 masking parity 확인 |
| convention | LOW | **WARNING**: `_llmCalls`/`_turnDebugHistory` internal 필드가 `spec/conventions/node-output.md` Principle 0 예외목록 미등재 — **기존 필드(에디터가 이미 소비)**라 본 작업 도입 아님. convention-doc 갭(별도 planner 트랙). INFO: 라우트 순서(선존) |
| plan_coherence | LOW | INFO: 구현 랜딩 후 plan V-05 체크박스 갱신. 인접 plan(C-7 FIXED·node-output-redesign 다른 계층) 충돌 없음 |
| naming | NONE | 신규 식별자 충돌 없음(기존 재사용) |

## 구현 방침 (impl-prep 반영)

- **전체 `ResultDetail` 재사용** — 우측 노드 상세 패널(page.tsx 712~866)을 `<ResultDetail/>`로 교체. ResultDetail이 헤더(label/type/status/duration + DryRunBadge)·BackgroundRunSection·완결 대화·live 상호작용(`useExecutionInteractionCommands` 내장)·전 탭을 이미 처리하므로 default-tab/평탄화 재구현 안 함(cross_spec·rationale WARNING 해소).
- **회귀 보호**: waiting form/buttons/conversation, skipped 제외(R-4), list 무변경(R-1) 테스트 유지·보강.
- **후속(별도)**: node-output.md Principle 0 예외목록에 `_llmCalls`/`_turnDebugHistory` 등재(convention WARNING) — planner 트랙, 본 PR 범위 밖.
