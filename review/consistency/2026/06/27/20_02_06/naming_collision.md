# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/graph-rag-doc-fix.md`  
검토 모드: spec draft (--spec)  
검토 시각: 2026-06-27

---

## 발견사항

충돌 발견 없음.

### 검토 항목별 결과

**1. 요구사항 ID 충돌**  
본 변경은 새 요구사항 ID를 도입하지 않는다. 기존 `KB-GR-MD-*` / `KB-GR-EX-*` / `KB-GR-SR-*` / `KB-GR-UI-*` 등의 ID는 모두 유지된다. 충돌 없음.

**2. 엔티티/타입명 충돌**  
새 엔티티·DTO·인터페이스 명을 도입하지 않는다. 충돌 없음.

**3. API endpoint 충돌**  
코드 변경 없음 — 새 endpoint 없음. 충돌 없음.

**4. 이벤트/메시지명 충돌**  
새 WebSocket 이벤트·큐 이름 없음. 충돌 없음.

**5. 환경변수·설정키 충돌**  
새 ENV var·config key 없음. 충돌 없음.

**6. 파일 경로 충돌**  
새 파일 생성 없음. 기존 `spec/5-system/10-graph-rag.md` 인-플레이스 수정만. 충돌 없음.

---

### 헤딩 앵커 rename 세부 검증

변경 핵심은 `spec/5-system/10-graph-rag.md` 의 `## 1. 개요` → `## 1. 아키텍처 흐름` 이다. 이는 Markdown 앵커를 `#1-개요` → `#1-아키텍처-흐름` 으로 변경한다.

**외부 파일에서 `10-graph-rag.md#1-개요` 를 참조하는 곳: 0건**

`spec/` 전체에서 `#1-개요` 를 포함하는 링크 2건은 모두 다른 파일을 향한다:
- `/spec/2-navigation/5-knowledge-base.md:219` — `9-rag-search.md#1-개요` (9-rag-search.md 대상, 무관)
- `/spec/2-navigation/14-execution-history.md:20` — `#1-개요` 자체 파일 내 내부 참조 (14-execution-history.md 대상, 무관)

`10-graph-rag.md` 를 가리키는 외부 링크의 앵커 사용 현황:

| 참조처 | 앵커 |
|--------|------|
| `spec/0-overview.md` | `#8-미결--후속-검토` |
| `spec/4-nodes/3-ai/0-common.md` | `#43-출력-메타데이터` |
| `spec/4-nodes/3-ai/1-ai-agent.md` | `#43-출력-메타데이터` |
| `spec/5-system/8-embedding-pipeline.md` | `#3-그래프-추출-파이프라인` |
| `spec/5-system/9-rag-search.md` | `#4-검색-흐름-hybrid`, `#43-출력-메타데이터` |

`#1-개요` 앵커를 참조하는 외부 파일 없음. rename 으로 인한 단절(broken link) 없음.

새 앵커 `#1-아키텍처-흐름` 은 기존 spec 어디에도 존재하지 않아 충돌 없음. 해당 헤딩 텍스트 `아키텍처 흐름` 도 `10-graph-rag.md:206` 외의 파일에서는 사용되지 않는다.

**self-link 제거 검증**  
`[PRD Graph RAG](./10-graph-rag.md)` 의 자기 참조 제거는 식별자를 제거하는 것이므로 신규 충돌 대상이 아니다. `PRD Graph RAG` 레이블은 외부 파일들(`5-knowledge-base.md`, `4-nodes/3-ai/0-common.md` 등)에서 `10-graph-rag.md` 를 가리키는 링크에 사용 중이나, 이들은 자기 파일 내의 self-link 와는 독립이며 영향 없음.

---

## 요약

`graph-rag-doc-fix` 가 도입하는 변경은 (1) self-referential 링크 1건 제거, (2) `## 1. 개요` → `## 1. 아키텍처 흐름` 헤딩 rename 두 가지로, 신규 식별자(요구사항 ID·엔티티명·endpoint·이벤트·ENV·파일 경로)를 일체 도입하지 않는다. 헤딩 rename 으로 생성되는 앵커 `#1-아키텍처-흐름` 은 기존 코퍼스에 존재하지 않으며, 제거되는 앵커 `#1-개요`(10-graph-rag.md 한정)를 외부에서 참조하는 파일도 0건이다. 식별자 충돌 관점에서 차단 사유 없음.

## 위험도

NONE
