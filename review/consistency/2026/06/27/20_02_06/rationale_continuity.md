# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/graph-rag-doc-fix.md` → `spec/5-system/10-graph-rag.md` (2건 수정)
검토 모드: `--spec`

---

## 발견사항

### [INFO] `## 1. 개요` → `## 1. 아키텍처 흐름` 리네임이 사이드바 파일의 암묵적 패턴과 다름

- **target 위치**: `spec/5-system/10-graph-rag.md` line 206 (`## 1. 아키텍처 흐름`)
- **과거 결정 출처**: 명시적 Rationale 항목 없음. 그러나 동일 영역 사이드바 파일들 — `spec/5-system/9-rag-search.md` (line 26), `spec/5-system/8-embedding-pipeline.md` (line 25) — 이 `## Overview (제품 정의)` (PRD 절) + `## 1. 개요` (기술 본문 첫 절) 의 이중 구조를 그대로 유지하고 있다.
- **상세**: 해당 파일들은 동일하게 PRD 절(`## Overview (제품 정의)`)과 기술 본문 첫 절(`## 1. 개요`)을 공존시킨다. Rationale 에 "모든 spec 파일의 기술 본문 첫 절은 반드시 `## 1. 개요`" 라고 명시된 결정은 없지만, 사이드바 파일 전체에 걸쳐 형성된 암묵적 컨벤션이다. target 의 리네임은 이 컨벤션을 깨는 첫 사례가 된다.
- **제안**: (a) `10-graph-rag.md` 의 리네임을 그대로 수용하되 — 해당 절의 지배적 내용이 flow diagram 임을 감안하면 `## 1. 아키텍처 흐름` 이 더 정확하므로 합당하다 — 동일 영역의 `8`, `9` 번 파일도 추후 개선 항목으로 별도 트래킹하거나, (b) 리네임을 유지하되 `10-graph-rag.md` 의 `## Rationale` 에 "기술 본문 첫 절을 내용 성격에 맞게 명명한다" 취지의 한 문장을 추가해 향후 유사 파일 개선의 근거를 남긴다.

---

### Self-referential 링크 삭제 — Rationale 충돌 없음

- **target 위치**: `spec/5-system/10-graph-rag.md` line 25 (구 `[PRD Graph RAG](./10-graph-rag.md)` 삭제)
- **상세**: `spec/5-system/_product-overview.md` 는 Graph RAG 전용 PRD 가 아니라 시스템 영역 전체 spec 맵(`비기능 요구사항 + 맵`)이다. Graph RAG 의 PRD 내용은 동 파일 내 `## Overview (제품 정의)` 절에 있으므로 self-link 는 실질적 가치가 없는 잘못된 참조다. 삭제가 어떤 Rationale 결정을 번복하거나 기각된 대안을 재도입하지 않는다.

---

## 요약

target 문서(`plan/in-progress/graph-rag-doc-fix.md`) 가 기술하는 두 수정 사항 모두 기존 spec Rationale 에 명시된 결정을 번복하거나 기각된 대안을 재도입하지 않는다. Self-referential 링크 삭제는 구조 사실에 기반한 명백한 수정이다. `## 1. 개요` → `## 1. 아키텍처 흐름` 리네임은 합당한 내용 기반 근거가 있으나, 동일 영역 사이드바 파일(`8-embedding-pipeline.md`, `9-rag-search.md`)이 동일 이중-overview 패턴을 유지하고 있어 암묵적 컨벤션과의 경미한 불일치가 생긴다. Rationale 기록상 이 패턴을 강제한 명시 결정은 없으므로 차단 수준은 아니며 INFO 보완 제안으로 기록한다.

## 위험도

LOW
