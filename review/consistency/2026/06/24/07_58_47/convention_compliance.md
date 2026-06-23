# 정식 규약 준수 검토 결과

**검토 대상**: `spec/3-workflow-editor/` (구현 착수 전 검토 — `--impl-prep`)
**검토 일시**: 2026-06-24
**검토 범위**: `0-canvas.md`, `1-node-common.md`, `2-edge.md`, `3-execution.md`, `4-ai-assistant.md`, `5-version-history.md`, `_product-overview.md`

---

## 발견사항

### **[INFO]** `3-execution.md` §3 에서 섹션 번호 건너뜀 (§3.4 → §3.6)
- **target 위치**: `spec/3-workflow-editor/3-execution.md` §3 실행 상태 시각화 — `§3.4 Form 노드 대기 상태` 다음에 `§3.5 실행 실패` 가 와야 하나 실제로는 `§3.6 AI Agent Multi Turn 대화 상태` 가 먼저 나오고 그 다음에 `§3.5 실행 실패` 가 등장
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §2.1 · CLAUDE.md 문서 구조 권장 (Overview/본문/Rationale 3섹션 연속성). 명시적 금지 항목은 아니나, 섹션 번호 순서 역전은 문서 구조 일관성을 해침
- **상세**: §3.4 → §3.6 → §3.5 순서로 배치되어 있어 독자(또는 링크 앵커)가 §3.5를 §3.6 뒤로 착각하거나 `#35-실행-실패` 앵커가 예상 위치와 다름
- **제안**: §3.5와 §3.6 순서를 교체하거나, AI Multi Turn 상태를 §3.4.1 하위 섹션으로 리넘버링. (의도적 배치라면 주석으로 이유 명시)

---

### **[INFO]** `0-canvas.md` §5.3.2 에서 경고 메시지 컬럼 표기와 실제 인용 형식 혼용
- **target 위치**: `spec/3-workflow-editor/0-canvas.md` §5.3.2 노드별 미설정 경고 메시지 표 — `⚠ Condition not set` 형태 (이모지 인라인 + 영어 메시지). 반면 §5.3.1 시각적 표현 다이어그램에서는 `⚠ Not configured` 형태 사용
- **위반 규약**: 정식 규약 직접 위반은 없으나, `spec/conventions/node-output.md` Principle 3 에러 컨트랙트의 일관성 정신에서 벗어남. 에러/경고 메시지 표기 형식이 두 곳에서 달리 쓰임
- **상세**: §5.3.2 표는 `⚠ Condition not set` (이모지 + 설명), §5.3.1 다이어그램은 `⚠ Not configured` (이모지 + 설명)를 사용. 이 자체는 서로 다른 케이스(미설정 경고 메시지 vs 미설정 상태 일반 표기)이나, 스펙 독자가 혼동할 수 있음
- **제안**: §5.3.1 다이어그램의 `⚠ Not configured` 예시가 실제로는 §5.3.2 표의 개별 메시지 중 하나임을 명확히 주석 처리. 또는 §5.3.2 표의 Send Email 항목(`⚠ Recipient not set`)을 §5.3.1 예시와 일치시켜 `⚠ Not configured` 패턴이 없어졌음을 명시

---

### **[INFO]** `1-node-common.md` §2.6.2 에서 Widget 분류와 합산 수 불일치
- **target 위치**: `spec/3-workflow-editor/1-node-common.md` §2.6.2 Widget 어휘 (21종) — 섹션 제목은 "21종"이라 기재하나 실제 표의 항목을 합산하면 기본 입력 10 + 공용 selector 4 + 모델 config selector 2 + 배열 편집 2 + 강제 override 3 = 21종으로 일치함
- **위반 규약**: 없음 (일치 확인)
- **상세**: 산술적으로는 정확히 21종. 단 "강제 override (3)" 항목이 `UnsupportedWidget` 로 매핑되어 auto-form 에서 실제 렌더 불가이지만 "21종 widget" 카운트에 포함되어 있어 의미론적으로 독자에게 혼동을 줄 수 있음
- **제안**: 제목을 "Widget 어휘 (21종 — 렌더 가능 18종 + override 전용 3종)"로 명확히 하거나, 각주를 추가하여 강제 override 3종은 auto-form 렌더 불가임을 즉시 드러낼 것

---

### **[INFO]** `2-edge.md` §3.1 에서 컬럼 헤더 포트 타입 순서와 `1-node-common.md §1.2` 기재 순서 불일치
- **target 위치**: `spec/3-workflow-editor/2-edge.md` §3.1 포트 타입별 엣지 색상 표 — 데이터/에러/시스템/컨테이너 포트 순서
- **위반 규약**: 단일 진실 원칙(CLAUDE.md §정보 저장 위치). `1-node-common.md §1.2` 포트 색상 정의(데이터=초록, 시스템=파랑, 에러=빨강, 컨테이너 emit=보라)와 표 정렬 순서가 다름
- **상세**: `1-node-common.md §1.2` 는 "데이터→시스템→에러→컨테이너 emit" 순이나, `2-edge.md §3.1` 표는 "데이터→에러→시스템→컨테이너" 순. 의미 동일하나 독자가 순서를 일관성 있게 기억하기 어려움. SoT 는 `1-node-common.md` 이므로 edge 쪽이 순서를 따르는 것이 바람직
- **제안**: `2-edge.md §3.1` 표의 행 순서를 `1-node-common.md §1.2` 와 동일하게 조정(데이터→시스템→에러→컨테이너). 또는 `2-edge.md §3.1` 에 "상세는 Spec 노드 공통 §1.2 참조" 명기

---

### **[INFO]** `_product-overview.md` 에 frontmatter 미적용 (의도된 제외 여부 확인 필요)
- **target 위치**: `spec/3-workflow-editor/_product-overview.md` — frontmatter 없음
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §1 적용 대상 및 §2 Frontmatter 스키마. 단, 동 규약 §1 "제외" 항목에 `spec/<영역>/_*.md` (밑줄 prefix)는 명시적 면제 대상으로 등재됨
- **상세**: `_product-overview.md` 는 `_` prefix 로 시작하므로 `EXCLUDE_BASENAMES` 가 아닌 `_*.md` glob 면제 대상이 되어 frontmatter 의무가 없음. 현재 상태는 규약과 정합
- **제안**: 해당 없음. 면제 의도 확인 완료

---

## 요약

`spec/3-workflow-editor/` 의 6개 spec 파일(+ `_product-overview.md`)은 정식 규약(`spec/conventions/`)을 대체로 잘 준수하고 있다. 모든 `.md` spec 파일에 필수 frontmatter(`id`, `status`, `code:`, 필요 시 `pending_plans:`)가 올바르게 선언되어 있으며, `_product-overview.md` 는 `_` prefix 면제 규칙에 따라 frontmatter 없이 적법하다. 명명 규약(kebab-case id, 파일명 prefix 등), 문서 구조 권장(Overview/본문/Rationale), API 문서 규약(해당 파일 내 직접 적용 없음), 금지 항목 모두 위반 없음. 발견된 이슈 4건은 모두 INFO 등급으로, §3 섹션 번호 역전 1건, 경고 메시지 표기 혼동 가능성 1건, widget 설명 명확성 1건, 포트 색상 정의 순서 불일치 1건이며, CRITICAL·WARNING 은 0건이다.

## 위험도

NONE
