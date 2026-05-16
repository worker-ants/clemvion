# Plan: `spec/data-flow/` — 시스템 전체 데이터 흐름 spec 신설

> 상태: in-progress · 시작: 2026-05-13 · 담당 role: project-planner

## 목적

`spec/1-data-model.md` 가 엔티티 정의에 집중되어 있어, "데이터가 어디서 어디로 흐르는지" 와
"각 흐름이 어느 DB·table·column·queue·bucket 을 건드리는지" 는 spec 안에 분산되어 있다.

본 작업은 `spec/data-flow/` 를 신설해 다음을 한곳에서 추적할 수 있게 한다:

- 시스템 수준 dataflow 다이어그램 (Client / Backend / Postgres / Redis / S3·MinIO / 외부 LLM)
- 도메인별 Source → Sink 매핑 (sequence / flowchart)
- 데이터 객체별 DB / table / column / index / queue / S3 key 매핑
- 외부 의존 cross-reference

## 산출물

### 새 파일

- `spec/data-flow/0-overview.md` — 폴더 진입 문서, 시스템 수준 다이어그램, 도메인 인덱스, 공통 규약
- `spec/data-flow/2-auth.md` — 사용자 인증·세션·OAuth·refresh token 흐름
- `spec/data-flow/12-workspace.md` — 워크스페이스·멤버십·초대·RBAC 흐름
- `spec/data-flow/11-workflow.md` — 워크플로우 CRUD·버전·노드·엣지·AI Assistant 흐름
- `spec/data-flow/3-execution.md` — 실행 엔진·BullMQ 큐·실행 로그·노드 실행 결과 흐름
- `spec/data-flow/6-knowledge-base.md` — KB·문서 업로드·임베딩·Graph RAG·RAG 검색 흐름
- `spec/data-flow/5-integration.md` — 외부 통합·OAuth credential 암호화·사용 로그
- `spec/data-flow/10-triggers.md` — Webhook·Schedule·Manual trigger 진입
- `spec/data-flow/7-llm-usage.md` — LLM 호출·usage_log·LLM config 흐름
- `spec/data-flow/4-file-storage.md` — S3/MinIO 사용처·파일 라이프사이클
- `spec/data-flow/8-notifications.md` — 알림·이메일·WebSocket emit
- `spec/data-flow/1-audit.md` — audit_log·login_history
- `spec/data-flow/9-observability.md` — health·dashboard·statistics·alert

### 기존 문서 수정

- `spec/0-overview.md` §8 문서 맵 — `데이터 흐름` 행 추가

## 작업 체크리스트

- [x] `spec/data-flow/0-overview.md` 작성
- [x] `spec/0-overview.md` §8 갱신
- [x] `spec/data-flow/2-auth.md` 작성
- [x] `spec/data-flow/12-workspace.md` 작성
- [x] `spec/data-flow/11-workflow.md` 작성
- [x] `spec/data-flow/3-execution.md` 작성
- [x] `spec/data-flow/6-knowledge-base.md` 작성
- [x] `spec/data-flow/5-integration.md` 작성
- [x] `spec/data-flow/10-triggers.md` 작성
- [x] `spec/data-flow/7-llm-usage.md` 작성
- [x] `spec/data-flow/4-file-storage.md` 작성
- [x] `spec/data-flow/8-notifications.md` 작성
- [x] `spec/data-flow/1-audit.md` 작성
- [x] `spec/data-flow/9-observability.md` 작성
- [x] `python3 scripts/check-doc-links.py` 통과 확인

## 결정 사항

- 다이어그램은 Mermaid (flowchart / sequenceDiagram / stateDiagram-v2) 사용. erDiagram 은
  `spec/1-data-model.md` 와 중복이라 회피.
- `spec/1-data-model.md` 의 엔티티 정의는 본 폴더의 단일 진실. data-flow 의 schema 매핑 표는
  "이 흐름에서 어느 컬럼·인덱스가 갱신/조회되는가" 를 발췌해 가독성을 높인다 — 중복이 아니라 인덱스.
- S3 key 패턴은 **`backend/` 코드 기준 진실** 로 기재한다 (`spec/0-overview.md` §2.7 의
  `{workspaceId}/knowledge-base/{kbId}/...` 는 KB 코드의 `kb/{kbId}/{docId}/{filename}` 와 다름 —
  data-flow 는 후자로 기재하고 추후 0-overview 와 정합성 정리는 별도 plan 으로 분리).

## 후속 항목

- 없음 (모든 도메인 문서 작성 완료)

## 완료 처리

모든 체크 완료 → `git mv plan/in-progress/data-flow-spec.md plan/complete/`.
