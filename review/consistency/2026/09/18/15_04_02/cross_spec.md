# Cross-Spec 일관성 검토 — 그래프 RAG 삭제 연쇄 FK 인덱스 넷 (V117~V120, impl-prep)

## 검토 방법에 대한 메모

호출 payload(`_prompts/cross_spec.md`)는 `--impl-prep` 모드로 `spec/conventions/` 전체를 번들했으나,
컨텍스트 예산 초과로 `audit-actions.md` · `cafe24-api-catalog/*` 일부를 제외한 **거의 전 파일이
"본문 생략됨" 플레이스홀더로 절단**됐다 — 이번 작업과 가장 직접 관련된 `spec/conventions/migrations.md`
포함. 이는 알려진 harness 한계(과거 세션 메모: "consistency `--spec` 기본 예산이 conventions 를
통째로 떨군다")가 `--impl-prep` 경로에서도 재발한 것이다. 번들 누락을 그대로 두면 이 체크가 정작
가장 중요한 문서를 못 본 채 통과 판정을 내릴 위험이 있어, **worktree 의 실제 파일을 직접 읽어** 아래
분석을 수행했다 (`spec/conventions/migrations.md` 전문, `codebase/backend/migrations/README.md`,
기존 V025/V027/V111~V116 마이그레이션 원문, `spec/1-data-model.md` §2.12.2~§2.12.3·§3·Rationale,
`spec/5-system/10-graph-rag.md` §2.3~§2.4, `spec/data-flow/6-knowledge-base.md` sink 표).

## 검토 대상 실체

`plan/in-progress/spec-draft-graph-fk-indexes.md` — Entity.last_seen_chunk_id · Relation.evidence_chunk_id ·
Relation.head_entity_id · Relation.tail_entity_id 에 대한 인덱스 4개(V117~V120)를 추가하는 계획.
spec 쪽 3개 문서(`spec/1-data-model.md`, `spec/5-system/10-graph-rag.md`, `spec/data-flow/6-knowledge-base.md`)는
이미 커밋(`dfd4fd783`)됐고, 지금은 구현(마이그레이션 파일 + e2e) 착수 직전 `--impl-prep` 시점이다.

## 발견사항

### 데이터 모델 충돌 — 없음 (교차 검증 결과)

- `spec/1-data-model.md` §2.12.2(Entity)·§2.12.3(Relation)·§3(인덱스 전략 표)·Rationale, `spec/5-system/10-graph-rag.md`
  §2.3·§2.4, `spec/data-flow/6-knowledge-base.md` sink 표 — 세 영역 모두 V117~V120 번호·대상 컬럼·FK 방향(`SET NULL`/`CASCADE`)이
  **동일**하게 기술되어 있다. 세 문서 간 모순 없음.
- 실제 DB 스키마(`codebase/backend/migrations/V025__graph_rag.sql`)와도 일치한다 — `last_seen_chunk_id UUID
  REFERENCES document_chunk(id) ON DELETE SET NULL`, `head_entity_id/tail_entity_id UUID NOT NULL REFERENCES
  entity(id) ON DELETE CASCADE`, `evidence_chunk_id UUID REFERENCES document_chunk(id) ON DELETE SET NULL` —
  plan/spec 이 서술하는 FK 방향과 정확히 일치한다.
- `grep -rn "last_seen_chunk_id\|evidence_chunk_id\|head_entity_id\|tail_entity_id" spec/` 결과 이 세 문서
  외에는 해당 필드를 언급하는 spec 이 없어, 다른 영역과의 정의 중복·충돌 소지가 없다.

### 마이그레이션 컨벤션 (`spec/conventions/migrations.md`) 준수 — 위반 없음

- **V번호**: 현재 main/worktree 의 max 는 V116(`ls codebase/backend/migrations`) 이므로 V117~V120 은 §2
  "단조 증가 · gap 금지" 를 만족한다 (4개 연속 추가).
- **CONCURRENTLY 패턴**: 계획한 "`DROP INDEX CONCURRENTLY IF EXISTS` → `CREATE INDEX CONCURRENTLY IF NOT
  EXISTS` + `.conf executeInTransaction=false`" 는 migrations.md §5 및 `codebase/backend/migrations/README.md`
  §5 "**신규 추가에도 0) 을 둡니다**"(2026-09-18, V111 선례) 문구와 정확히 일치한다.
- **네이밍**: 제안 인덱스명(`idx_entity_last_seen_chunk_id` 등)은 기존 V025/V111~V116 의 `idx_<table>_<column>`
  패턴과 일관되고, `grep -rn` 결과 `codebase/`·`spec/`·`plan/` 어디에도 선점된 이름이 없다(plan 자체 서술과 실측 결과 일치).
- 애플리케이션 코드 변경 없음(순수 인덱스 추가)이라는 계획의 전제는 layer 책임 분할과 충돌하지 않는다 — 마이그레이션
  파일은 DB 계층 SoT, `README.md` 는 작성 가이드, `spec/conventions/migrations.md` 는 정책 SoT 로 기존 3-way 책임
  분리가 그대로 유지된다.

### API 계약 / 요구사항 ID / 상태 전이 / RBAC — 해당 없음

이번 변경은 인덱스 4개 추가(순수 DB 최적화)이며 신규 endpoint·요구사항 ID·상태 머신·권한 구조를 도입하지 않는다.
해당 관점에서 충돌 후보 없음.

- **[INFO]** `--impl-prep` 번들의 컨텍스트 예산 절단
  - target 위치: 호출 payload 전체(`spec/conventions/` 45개 이상 파일 중 6개만 본문 로드, `migrations.md` 포함
    대부분 "본문 생략됨" 플레이스홀더)
  - 충돌 대상: 없음(harness 동작 이슈, spec 내용 충돌 아님)
  - 상세: 이번 구현이 마이그레이션 작업이라 `spec/conventions/migrations.md` 가 가장 관련도가 높은데, 그 파일이
    번들에서 절단되어 자동 검토가 이 컨벤션을 못 보고 판정할 뻔했다. 이번 리뷰는 worktree 파일을 직접 읽어 우회했지만,
    이 우회는 checker 개별 판단에 의존하므로 재발 방지책이 없다.
  - 제안: `--impl-prep`/`--spec` 번들러의 예산 배분을 (a) target 과 직접 관련된 conventions 파일을 우선 포함하거나
    (b) 절단된 파일 목록을 checker 프롬프트 상단에 별도로 강조해 "직접 읽어 보완" 을 명시적으로 지시하도록 개선 검토.
    (기존 메모 `feedback_consistency_spec_mode_budget.md` 가 `--spec` 경로에서 이미 지적한 것과 동일 클래스 — `--impl-prep`
    경로에도 동일 갭이 있음을 추가로 기록해 둔다.)

## 요약

계획된 V117~V120 인덱스 4개는 `spec/1-data-model.md`·`spec/5-system/10-graph-rag.md`·`spec/data-flow/6-knowledge-base.md`
세 영역에 이미 동일하게 반영되어 있고, 실제 DB 스키마(V025)의 FK `ON DELETE` 방향과도 일치한다. `spec/conventions/migrations.md`
의 V번호 단조성·CONCURRENTLY DROP-먼저 패턴·네이밍 규약도 모두 준수한다. 자동 번들이 컨텍스트 예산 초과로
`migrations.md` 를 포함한 `spec/conventions/` 대부분을 절단했으나, 실제 파일을 직접 대조한 결과 데이터 모델·API 계약·
요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 기존 spec 과의 모순을 발견하지 못했다. 유일한 기록 사항은
harness 번들 예산 갭(INFO)이며 이는 이번 구현 내용 자체의 결함이 아니다.

## 위험도

NONE
