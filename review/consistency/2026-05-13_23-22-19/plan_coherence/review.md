## 발견사항

### [WARNING] AI Agent spec 파일 미래 편집 순서 충돌 가능성

- **target 위치**: §8 (`spec/4-nodes/3-ai/1-ai-agent.md` §1 mcpServers / §2 UI) · §9 (`spec/4-nodes/3-ai/0-common.md` §3 McpServerRef / §8 캔버스 카운트)
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 "Spec 작성" — 동일 파일 2종을 편집 예정 (`toolNodeIds`/`toolOverrides` 절·Tool Area 복원)
- **상세**: target draft 는 두 파일의 MCP 관련 절을 수정하고, `ai-agent-tool-connection-rewrite` plan 은 같은 파일의 tool connection 절을 수정 예정. 수정 섹션은 직교하나, spec write 이후 `ai-agent-tool-connection-rewrite` 착수 시 동일 파일에서 merge conflict 발생 가능.
- **완화 요인**: `cafe24-integration.md` §"동시 작업 중인 plan과의 충돌" 에서 이미 "무관" 판정 + "AI Agent §1의 '재작성 예정' 박스 그대로 보존" 명시. `ai-agent-tool-connection-rewrite` 는 Phase 1 디자인 결정 전체 미결(TBD) — spec 변경 착수 전.
- **제안**: 현재 차단 사유 없음. `ai-agent-tool-connection-rewrite` spec 착수 시 MCP 섹션과 Tool Area 섹션이 이미 분리 편집된 상태임을 인지하고 진행.

---

### [WARNING] `node-output-redesign` plan 과 `spec/4-nodes/4-integration/0-common.md` 교차

- **target 위치**: §4 (`0-common.md` — 도입부 scope note · §5 캔버스 요약 표 · §7 출력 구조 색인)
- **관련 plan**: `plan/in-progress/node-output-redesign/README.md` — Integration 노드 27종 output 재설계. §7 출력 색인이 재설계 영향권에 포함될 수 있음
- **상세**: target draft 는 `0-common.md` §5·§7 에 `cafe24` 행을 추가. `node-output-redesign` plan 은 진단·초안 단계로 worktree 미지정. 향후 plan 이 spec write 단계 진입 시 §7을 갱신할 수 있음.
- **완화 요인**: README "conventions 자체는 변경하지 않는다" 명시. 변경 성격이 다름(cafe24 행 추가 vs 기존 행 output 구조 개선). 현재 worktree 미지정 → 즉각 충돌 없음.
- **제안**: 현재 차단 사유 없음. `node-output-redesign` spec write 착수 시 §7 색인의 `cafe24` 행이 이미 존재함을 인지하고 진행.

---

### [INFO] `0-unimplemented-overview.md` Cafe24 구현 항목 미반영 (향후)

- **target 위치**: (draft 직접 관련 없음)
- **관련 plan**: `plan/in-progress/0-unimplemented-overview.md` §A 미구현 항목 표 · plan 문서 목록
- **상세**: spec write 완료 후 생성될 `cafe24-implementation.md` plan 은 `0-unimplemented-overview.md` §A 표와 plan 목록에 추가되어야 한다. 현재 draft 범위 밖.
- **제안**: Phase 3 spec write 완료 + plan complete 이동 후 후속 implementation plan 생성 시 함께 갱신.

### [INFO] `Node.type` PostgreSQL enum 여부 — implementation plan 에서 검증 필요

- **target 위치**: draft §영향분석 "데이터 마이그레이션" 절
- **상세**: draft 가 "backend schema 확인 필요, PostgreSQL enum 이면 ALTER TYPE 마이그레이션 필요" 라고 직접 명시하고 implementation plan 으로 연기함. spec draft 에서 처리하지 않는 접근은 적절함.
- **제안**: implementation plan 착수 시 `backend/src/` 의 Node 엔티티·마이그레이션 파일을 먼저 확인.

---

## 요약

`spec-draft-cafe24-integration.md` v2는 진행 중인 plan 들과의 정합성 검토에서 **CRITICAL 위배 없음**. `ai-agent-tool-connection-rewrite`·`node-output-redesign` 두 plan 이 같은 spec 파일을 미래에 편집할 예정이나, 양쪽 모두 현재 worktree 미지정·착수 전 상태이고 수정 섹션이 직교함. `cafe24-integration.md` plan 이 관련 충돌 가능성을 이미 인지·기록한 상태. v2 보강으로 v1의 BLOCK 해소 내역도 plan Phase 3 체크리스트와 1:1 대응하며 누락 항목 없음.

## 위험도

**LOW** — Phase 2 재호출에서 CRITICAL 위배 없음. spec write (Phase 3) 진입 가능.