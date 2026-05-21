# Cross-Spec 일관성 검토 결과

- **검토 대상**: `spec/0-overview.md`
- **검토 모드**: spec draft 검토 (--spec)
- **검토자**: Cross-Spec 일관성 checker
- **검토 일시**: 2026-05-22

---

## 발견사항

### 1. [WARNING] §6.3 내부 섹션 참조 오류 — "Cafe24 (구현 완료, §6.2)" → §6.1 이 정확

- **target 위치**: `spec/0-overview.md` §6.3 "Internal MCP Bridge 패턴 확장" 행 (line 101)
- **충돌 대상**: 동일 문서 §6.1 / Rationale "Cafe24 통합을 §6.1 (완료) 분류로" (line 398~403)
- **상세**: §6.3 의 "Internal MCP Bridge 패턴 확장" 셀에 "Cafe24 (구현 완료, **§6.2**) 이후 ..." 라고 적혀 있다. 그러나 Rationale (lines 398~403) 에 명시된 대로 Cafe24 통합은 §6.1 (구현 완료 ✅) 로 이동하였다. §6.2 는 현재 "Parallel 노드 (P1)" 와 "조직 레벨 Integration 공유" 만 담고 있다. 따라서 §6.3 본문이 §6.2 를 가리키는 것은 stale reference 이며, Cafe24 항목이 §6.1 로 이동했다는 Rationale 과 직접 모순된다.
- **제안**: `spec/0-overview.md` §6.3 해당 행을 "Cafe24 (구현 완료, **§6.1**) 이후 ..." 로 수정.

---

### 2. [WARNING] §6.1 "노드 시스템" 행이 Parallel 을 완료 목록에 포함 — §6.2 의 "부분 구현 🚧" 분류와 모순

- **target 위치**: `spec/0-overview.md` §6.1 "노드 시스템" 행 (line 78) 및 §6.2 "Parallel 노드 (P1)" 행 (line 89)
- **충돌 대상**: `spec/4-nodes/_product-overview.md` §4.10 Parallel ("🚧 P1 구현 완료" 주석), `spec/4-nodes/1-logic/10-parallel.md` ("🚧 P1 구현 상태" 주석)
- **상세**: §6.1 "노드 시스템" 행은 "Logic(If/Else·Switch·Loop·ForEach·Map·Filter·Split·Merge·**Parallel**·Background·Variable Decl/Mod)" 전체를 구현 완료(✅) 로 나열한다. 그런데 바로 다음 §6.2 에서 "Parallel 노드 (P1)" 를 🚧 부분 구현으로 별도 분류한다. 독자 입장에서는 §6.1 에서 Parallel 이 완료됐다고 읽고 §6.2 에서 다시 미완료 항목으로 보게 되어 혼란을 준다. 외부 spec (`4-nodes/_product-overview.md`) 이 "🚧 P1 구현 완료" 로 표현하는 것도 약간 혼란스럽지만, 그 의도는 "P1 단계는 백엔드 완료, 프런트 미완 / 기본값 off" 임을 시사한다. `spec/0-overview.md` 에서 §6.1 행이 Parallel 을 완료로 포함시키는 반면 §6.2 가 별도로 🚧 를 붙이는 구조는 두 관점이 충돌하는 것처럼 읽힌다.
- **제안**: §6.1 "노드 시스템" 행에서 Parallel 을 제거하거나, 괄호로 "(P1, 기능 플래그 off 기본)" 와 같은 단서를 추가해 §6.2 와 중복 표현임을 명시적으로 연결한다. 또는 §6.2 본문에 "§6.1 노드 시스템 행 포함 항목 — 활성화 방법 상세" 로 관계를 정리한다.

---

### 3. [INFO] §6.1 "노드 시스템" 행 — Cafe24 노드 누락

- **target 위치**: `spec/0-overview.md` §6.1 "노드 시스템" 행 (line 78), §6.1 "Cafe24 통합" 행 (line 82)
- **충돌 대상**: `spec/1-data-model.md` §2.6 Node.type 전체 목록 (`integration | cafe24` 행), `spec/4-nodes/4-integration/4-cafe24.md`
- **상세**: §6.1 "노드 시스템" 행은 Integration 카테고리를 "(HTTP·Database·Send Email)" 세 개로 나열하나, `cafe24` 노드 타입은 포함하지 않는다. Cafe24 는 Integration 카테고리의 `Node.type = cafe24` 로 데이터 모델에 정식 등록돼 있고 §6.1 "Cafe24 통합" 별도 행이 있다. 두 개의 §6.1 행이 같은 `cafe24` 노드를 중복 없이 표현하려는 의도로 보이지만, "노드 시스템" 행에서 Integration 노드 목록을 "(HTTP·Database·Send Email·Cafe24)" 로 완전하게 나열하는 것이 데이터 모델 (Node.type 목록) 과 일치한다.
- **제안**: 표현을 통일하기 위해 "노드 시스템" 행의 Integration 목록에 "·Cafe24" 를 추가하거나, "(HTTP·Database·Send Email, Cafe24는 §6.1 Cafe24 통합 참조)" 주석을 붙인다. 별도 §6.1 행이 존재하므로 현행 분리 구조 유지도 가능하나, 독자에게 노드 타입 목록이 불완전하게 보일 수 있음.

---

### 4. [INFO] §8 문서 맵 "데이터 흐름" 설명 — 숫자 prefix 범위 정확

- **target 위치**: `spec/0-overview.md` §8 문서 맵 (line 142)
- **충돌 대상**: `spec/data-flow/` 실제 파일 목록
- **상세**: 문서 맵에서 data-flow 를 "1-audit ~ 12-workspace, 알파벳 순 숫자 prefix" 로 기술한다. 실제 `spec/data-flow/` 에는 `0-overview.md`, `1-audit.md` ~ `12-workspace.md` 총 13개 파일이 존재한다. `0-overview.md` 가 범위에서 누락되어 있으나 0 번은 관례상 개요 진입점이므로 독자 혼란은 크지 않다. 다만 "1-audit ~ 12-workspace" 표현은 0번 진입 문서가 별도로 있음을 드러내지 않아 미세한 부정확성이 있다.
- **제안**: "0-overview.md + 도메인별 흐름·schema 매핑 (1-audit ~ 12-workspace)" 로 표현 통일. 이는 §8 의 다른 영역(예: "5-system") 설명 방식과 일치한다.

---

### 5. [INFO] §6.1 "Cafe24 통합" — §6.3 self-reference "§6.2" 이외에 PR 번호 범위 일관성

- **target 위치**: `spec/0-overview.md` §6.1 "Cafe24 통합" 행 (line 82): "PR #20-#67, #212"
- **충돌 대상**: 직접 충돌 spec 없음. 정보성 확인.
- **상세**: 제목 행 PR 범위가 "#20-#67" 로 서술되어 있다. 이는 내부 참조로만 사용되고, 다른 spec 문서와 모순은 없으나 git 이력에서 실제 PR 범위가 달라졌을 경우 stale 정보가 될 수 있다. 현재 최신 커밋 메시지(#247 ~ #251) 와 비교하면 본 PR 번호 범위는 구현 완료 시점의 스냅샷으로 유효하다.
- **제안**: 필요 시 "#212" 이후 추가 PR 이 생겼을 경우 해당 항목 PR 번호를 갱신한다. 현 시점에서 즉각적 수정 필요 없음.

---

## 요약

`spec/0-overview.md` 는 전반적으로 `spec/1-data-model.md`, `spec/4-nodes/_product-overview.md`, `spec/5-system/11-mcp-client.md` 등 다른 영역 spec 과 구조·정의 면에서 충돌이 거의 없다. 데이터 모델 엔티티·필드 정의, API 계약, RBAC 모델, 상태 전이, 계층 책임 분할 모두 일관된다. 다만 두 가지 WARNING 이 내부 일관성 측면에서 독자 혼란을 유발할 수 있다: (1) §6.3 에서 Cafe24 가 §6.2 완료라고 적혀 있으나 Rationale 에서 §6.1 로 이동이 명시됐으므로 stale reference 이며, (2) §6.1 "노드 시스템" 행이 Parallel 을 완료 목록에 넣고 §6.2 가 동일 항목을 부분 구현으로 중복 분류하는 구조가 모순처럼 읽힌다. 두 WARNING 모두 `spec/0-overview.md` 자체 수정으로 해결 가능하며 다른 spec 변경은 필요 없다.

---

## 위험도

LOW
