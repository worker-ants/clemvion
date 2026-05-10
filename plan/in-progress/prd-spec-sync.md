# PRD/Spec ↔ 실제 구현 정합성 정리

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §E

## 배경

PRD/Spec 일부 항목이 **실제로는 코드에 구현되어 있는데도 ❌ 또는 🚧로 남아 있다**. 미구현 plan을 본격 작성하기 전에 baseline부터 정리해야 한다. 잘못된 표기를 그대로 두면 이후 plan 문서들이 잘못된 전제 위에 만들어진다.

본 plan은 새 기능을 만드는 것이 아니라 **PRD/Spec 문서를 코드 사실에 맞춰 갱신**하는 작업이다. 같은 작업 단위에서 서로 영향 받는 연관 문서까지 함께 손본다.

## 관련 문서

- `prd/9-graph-rag.md` (전체)
- `prd/5-non-functional.md` §5 NF-OB-05
- `prd/7-execution-history.md` §3.3 EH-NAV-04
- `spec/5-system/4-execution-engine.md` §3.3 Background 노드
- `spec/1-data-model.md` (Background 컨테이너 주석)
- `spec/3-workflow-editor/0-canvas.md` §5.3 / §10 (Background 컨테이너 렌더링 표기)
- `spec/3-workflow-editor/2-edge.md` (컨테이너 엣지 규칙의 Background 주석)
- 코드 참조:
  - `backend/src/modules/knowledge-base/graph/{graph-extraction.service,graph-query.service,kb-stats.helper}.ts`
  - `backend/src/migrations/V025__graph_rag.sql`, `V026__graph_extraction_status_nullable_index.sql`, `V027__relation_head_tail_index.sql`
  - `frontend/src/components/knowledge-base/{entity-list,relation-list,graph-visualization,graph-3d-renderer}.tsx`
  - `backend/src/modules/alerts/alerts-evaluator.service.ts` (`upsertJobScheduler`로 5분 cron 활성)
  - `backend/src/modules/workflow-assistant/tools/{explore-tools.service,tool-definitions}.ts`

## 작업 단위

### 1. Graph RAG (PRD 9) 갱신

- [ ] `prd/9-graph-rag.md` 의 "❌ 로드맵" 헤더 박스를 현재 구현 상태로 재작성. P0 (모드 선택·추출 큐·검색 분기·진행 상태 UI), P1 (Entity/Relation 목록 UI·삭제), P2 (그래프 시각화) 까지 어디까지 구현됐는지 코드 기준으로 ✅/🚧/❌ 재표기
- [ ] §2.1 표의 각 행 상태 갱신 (KB 모드 선택 / 추출 파이프라인 / 추출 LLM 설정 / Hybrid 검색 / 추출 상태 UI / Entity 목록 UI / 그래프 시각화)
- [ ] §3.1~§3.7 의 ID별 상태 표기를 추가 — 현재는 우선순위 컬럼만 있고 상태 컬럼이 없으므로 다른 PRD와 동일한 "상태" 컬럼 도입
- [ ] §6 단계별 도입 표를 "P0/P1/P2 — ✅/🚧/❌"로 갱신
- [ ] §7 의존성 표 갱신 (KB 모드 선택 UI ❌ → ✅, 등)
- [ ] `prd/0-overview.md` §6.3 로드맵 표에서 "Graph RAG" 항목 — 구현 완료된 부분과 남은 부분(P2 community detection 등 §8 미결 항목)으로 분리

### 2. Alert 평가 cron (PRD 5 NF-OB-05) 갱신

- [ ] `prd/5-non-functional.md` §5 NF-OB-05 상태를 🚧 → ✅ (또는 ✅에 가까운 표기)로 변경. 근거: `AlertsEvaluatorService.onModuleInit()` 가 BullMQ `*/5 * * * *` repeatable job (`alerts-evaluator-5min`) 을 등록 + `process()` 가 실제 평가 수행 + 노티 생성. 쿨다운(rule window 단위)도 적용
- [ ] `plan/complete/feature-roadmap/09-alerting-thresholds.md` 의 "주기 평가 cron 후속" 잔여 표기가 있으면 함께 갱신 (history 문서이므로 PR 단위 한 번만 정리)

### 3. AI Assistant 실행 read-only 도구 (PRD 7 EH-NAV-04) 검증·갱신

- [ ] `backend/src/modules/workflow-assistant/tools/tool-definitions.ts` 와 `explore-tools.service.ts` 가 PRD 2 §10.9 ED-AI-35~38 의 도구 시그니처를 모두 충족하는지 확인 (실행 목록 조회 / 개별 실행 상세 / sub-workflow 1 level / 민감 필드 마스킹 / running 상태 부분 타임라인)
- [ ] 모두 충족하면 `prd/7-execution-history.md` §3.3 EH-NAV-04 상태 ❌ → ✅ + Spec 링크 추가
- [ ] 일부만 충족하면 본 plan의 작업 항목으로 누락 항목을 도출하고, 이 plan에서 처리하지 않고 별도 follow-up plan을 새로 만든 뒤 `0-unimplemented-overview.md` 인덱스에 추가
- [ ] `frontend/src/content/docs/03-workflow-editor/` 매뉴얼에 read-only 진단 도구 사용 예시가 있는지 확인하고, 없으면 추가 항목으로 분리

### 4. Background 노드 spec 정합화 (의도된 평면 구현 반영)

PRD 3-node-system §4.11은 ND-BG-05 "대안 구현" 노트로 컨테이너 박스를 쓰지 않는다고 명시했지만, spec 쪽에는 여전히 "🚧 미구현"이 잔존한다. PRD가 신뢰원천이므로 spec을 PRD에 맞춘다.

- [ ] `spec/5-system/4-execution-engine.md` §3.3 Background 실행 — "🚧 구현 상태 — 미구현 (spec-only)" 박스를 현재 구현 (별도 BullMQ `background-execution` 큐 + `executeBackgroundSubgraph` + `containerId` 모델 미사용 + `background` 포트 엣지로 본문 식별) 으로 재작성
- [ ] `spec/1-data-model.md` 의 `Node.container_id` 설명에서 "Background[🚧 미구현]"을 제거 — Background는 컨테이너 멤버십을 사용하지 않는다는 점을 명시
- [ ] `spec/3-workflow-editor/0-canvas.md` §5.3 / §10 의 Background "🚧 미구현" 라인 — 컨테이너 렌더링 미적용 결정으로 표기를 통일
- [ ] `spec/3-workflow-editor/1-node-common.md` §노드 카탈로그 — Background 행의 "🚧 미구현" 표기 제거
- [ ] `spec/3-workflow-editor/2-edge.md` §컨테이너 내부 엣지 규칙 — Background 행 표기 정합화

### 4-1. AI Agent Tool Area 시각·인터랙션 spec (의도된 제거 표기 유지)

- [ ] `spec/3-workflow-editor/0-canvas.md` §10.x AI Agent 관련 "재작성 예정 (현재 제거됨)" 박스는 그대로 유지하되, `ai-agent-tool-connection-rewrite.md` plan과 상호 링크 추가

### 5. 작업 검증

- [ ] 변경된 PRD/Spec 문서가 다른 곳을 가리키는 링크들이 깨지지 않았는지 grep로 확인
- [ ] `frontend/src/content/docs/` 사용자 매뉴얼이 위 변경에 영향 받는지 확인 (Graph RAG 사용법 페이지 / 알림 페이지 / AI Assistant 페이지)
- [ ] CLAUDE.md PLAN 라이프사이클대로 본 plan은 모든 항목 ✅ 시점에 `git mv plan/in-progress/prd-spec-sync.md plan/complete/`

## 수용 기준 (Definition of Done)

- PRD 9 Graph RAG의 모든 표기가 코드 사실과 일치
- PRD 5 NF-OB-05가 코드 사실(5분 cron 활성)을 반영
- PRD 7 EH-NAV-04 검증·반영 완료 (또는 별도 follow-up plan으로 분리)
- Background 노드 관련 spec 4문서의 "🚧 미구현" 표기가 통일된 표기로 정리됨
- 본 plan의 모든 체크박스 ✅
- 변경 PR의 PR description에 "PRD/Spec ↔ 코드 정합성 정리" 명시 + 변경 파일 목록

## 의존성·리스크

- **의존**: 없음. 본 plan은 다른 plan들의 baseline이므로 가장 먼저 처리 권장.
- **리스크**: PRD/Spec 갱신만으로는 영향 받는 기능이 없어 보이지만, 사용자 매뉴얼이 Graph RAG/알림을 "곧 출시"로 안내하고 있다면 메시징도 함께 손봐야 한다.
