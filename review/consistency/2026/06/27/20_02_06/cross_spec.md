# Cross-Spec 일관성 검토 결과

**검토 대상**: `plan/in-progress/graph-rag-doc-fix.md`
**변경 파일**: `spec/5-system/10-graph-rag.md`
**검토 모드**: `--spec`

---

## 발견사항

발견된 충돌 없음.

두 변경 사항 각각에 대한 6개 관점 점검 결과:

### 변경 1: self-referential 링크 삭제 (line 25 "관련 문서" 블록)

- **데이터 모델 충돌**: 없음. 링크 삭제는 문서 내비게이션에만 영향.
- **API 계약 충돌**: 없음.
- **요구사항 ID 충돌**: 없음.
- **상태 전이 충돌**: 없음.
- **권한·RBAC 모델 충돌**: 없음.
- **계층 책임 충돌**: 없음.

외부 spec 에서 `10-graph-rag.md` 를 가리키는 링크(grep 확인 — 아래 참조)는 모두 파일 레벨 참조이거나 `#8-미결--후속-검토` / `#43-출력-메타데이터` / `#4-검색-흐름-hybrid` / `#3-그래프-추출-파이프라인` 앵커만 사용한다. 삭제 대상인 `[PRD Graph RAG](./10-graph-rag.md)` self-link 는 동일 파일 내 내비게이션 블록에만 존재했고, 다른 어떤 spec 의 cross-reference 경로에도 영향을 미치지 않는다.

### 변경 2: `## 1. 개요` → `## 1. 아키텍처 흐름` 헤딩 rename

- **데이터 모델 충돌**: 없음.
- **API 계약 충돌**: 없음.
- **요구사항 ID 충돌**: 없음.
- **상태 전이 충돌**: 없음.
- **권한·RBAC 모델 충돌**: 없음.
- **계층 책임 충돌**: 없음.

`#1-개요` 앵커를 참조하는 외부/내부 spec 파일 0건. 아래 16개 외부 참조 파일 전수 확인 결과:

| 참조 파일 | 사용한 앵커 |
|-----------|------------|
| `spec/0-overview.md` (3곳) | 앵커 없음 / `#8-미결--후속-검토` |
| `spec/1-data-model.md` (2곳) | 앵커 없음 |
| `spec/2-navigation/5-knowledge-base.md` | 앵커 없음 |
| `spec/4-nodes/4-integration/_product-overview.md` | 앵커 없음 |
| `spec/4-nodes/3-ai/0-common.md` | 앵커 없음 / `#43-출력-메타데이터` |
| `spec/4-nodes/3-ai/1-ai-agent.md` | 앵커 없음 / `#43-출력-메타데이터` |
| `spec/4-nodes/3-ai/_product-overview.md` | 앵커 없음 |
| `spec/5-system/9-rag-search.md` | 앵커 없음 / `#4-검색-흐름-hybrid` / `#43-출력-메타데이터` |
| `spec/5-system/_product-overview.md` | 앵커 없음 |
| `spec/5-system/13-replay-rerun.md` | 앵커 없음 |
| `spec/5-system/8-embedding-pipeline.md` | `#3-그래프-추출-파이프라인` / 앵커 없음 |
| `spec/5-system/6-websocket-protocol.md` | 앵커 없음 |
| `spec/data-flow/6-knowledge-base.md` | 앵커 없음 |

`#1-개요` → `#1-아키텍처-흐름` 앵커 변경은 기존 어떤 cross-reference 도 깨뜨리지 않는다.

---

## 요약

`spec/5-system/10-graph-rag.md` 의 두 수정(self-referential 링크 삭제 + `## 1. 개요` 섹션 헤딩 rename)은 다른 영역 spec 의 어떤 정의(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임)와도 충돌하지 않는다. 외부 참조 전수 조사(16개 파일) 결과 `#1-개요` 앵커를 사용한 cross-reference 는 0건이며, 변경 대상 파일을 가리키는 모든 외부 링크는 파일 레벨이거나 다른 섹션 앵커(`#3-`, `#4-`, `#8-`, `#43-`)를 사용한다. 이번 변경은 문서 내비게이션 품질 개선에만 한정되어 있어 cross-spec 위험이 없다.

---

## 위험도

NONE
