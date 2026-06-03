# Cross-Spec 일관성 검토 결과

검토 범위: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`
검토 모드: `--impl-prep` (구현 착수 전, scope=spec/)
검토 일시: 2026-06-03

---

## 발견사항

### **[WARNING]** `Execution.status` DTO 설명에서 `waiting_for_input` 누락

- **target 위치**: `spec/2-navigation/0-dashboard.md` §5 최근 실행 이력 테이블, 상태 열 설명의 괄호 주석
  - 문제 문장: `"(DTO 의 status enum 은 pending·running·completed·failed·cancelled)"`
- **충돌 대상**:
  - `spec/1-data-model.md §2.13 Execution` — `status | Enum | pending / running / completed / failed / cancelled / waiting_for_input` (6종)
  - `spec/5-system/4-execution-engine.md §1.1` — `waiting_for_input` 을 별도 상태로 명시하고 허용 전이 표에 포함
  - `spec/3-workflow-editor/4-ai-assistant.md §get_workflow_executions` — `status?: 'pending'|'running'|'completed'|'failed'|'cancelled'|'waiting_for_input'` 로 6종 명시
- **상세**: `0-dashboard.md §5` 의 아이콘 매핑 표 자체는 `✋ waiting_for_input` 을 포함해 올바르게 기술하고 있으나, 같은 셀 안의 괄호 보조 설명이 DTO enum 을 5종만 열거하여 정의 데이터 모델과 모순된다. 구현자가 이 괄호 주석을 보고 `waiting_for_input` 을 DTO 에서 제외하거나 필터 항목을 누락할 가능성이 있다.
- **제안**: `spec/2-navigation/0-dashboard.md §5` 의 해당 괄호 주석을 `(DTO 의 status enum 은 pending·running·completed·failed·cancelled·waiting_for_input)` 로 수정하거나, 괄호 주석 자체를 삭제하고 `spec/1-data-model.md §2.13` 참조 링크로 대체한다.

---

### **[INFO]** `spec/0-overview.md §8 문서 맵` — `data-flow/` 영역이 색인에서 누락

- **target 위치**: `spec/0-overview.md §8 문서 맵` 테이블
- **충돌 대상**: `spec/data-flow/` 디렉터리 (`0-overview.md` + `1-audit` ~ `12-workspace` 11개 파일) — 실제로 존재하며 execution, trigger, file-storage, notifications 등 cross-cutting 정보를 담고 있음
- **상세**: `spec/0-overview.md §8 문서 맵` 테이블 맨 아래 행에 `spec/data-flow/` 가 나열되어 있어 누락은 아니다. 다만 표 상단 "영역별 진입 문서 (§4)" 와 달리 `data-flow/` 는 §8 문서 맵에만 등장하고 §4 진입 문서 표에는 없어서 cross-cutting 독자가 data-flow 를 spec 영역과 동등한 위치로 인식하기 어렵다. 명명 비일관성.
- **제안**: `spec/0-overview.md §4 영역별 진입 문서` 표에 `data-flow/` 행을 추가하거나, §8 에서 `data-flow/` 의 역할(schema 매핑·흐름 참조용 보조 문서)을 한 줄 각주로 설명한다.

---

### **[INFO]** `spec/2-navigation/1-workflow-list.md §2.4` — 목표 기본 정렬과 API 규약 기본값 간 암묵적 불일치 표기

- **target 위치**: `spec/2-navigation/1-workflow-list.md §2.4 정렬` 표 "최근 수정순 (기본)" 행
- **충돌 대상**: `spec/5-system/2-api-convention.md §4.1` — `sort` 기본값을 `created_at` 으로 정의
- **상세**: `1-workflow-list.md` 는 "목표 기본 정렬"을 `updated_at`(최근 수정순)으로 기술하면서, 동시에 "현재 서버 기본값은 생성일순"이라고 명기한다. API 규약 spec 은 글로벌 기본값을 `created_at` 으로 고정한다. 두 spec 간 모순은 아니지만, `1-workflow-list.md` 의 "목표" 와 API 규약의 글로벌 기본값이 다르다는 사실이 명시적으로 연결되어 있지 않다. 구현 시 API 규약을 먼저 읽은 개발자가 `created_at` 을 고정하고 워크플로우 목록만 예외 처리가 필요하다는 점을 놓칠 수 있다.
- **제안**: `1-workflow-list.md §2.4` 의 "최근 수정순 (기본)" 설명에 "API 규약 글로벌 기본값(`created_at`)과 다른 리소스별 목표값 — 서버 수정 필요" 로 명시하거나, `spec/5-system/2-api-convention.md §4.1` 에 "리소스별 override 가능" 주석을 추가한다.

---

## 요약

`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md` 4개 문서의 cross-spec 충돌은 전반적으로 낮다. CRITICAL 충돌은 없다. 가장 실질적인 위험은 `0-dashboard.md §5` 의 `Execution.status` DTO 괄호 주석이 `waiting_for_input` 을 누락해 실제 데이터 모델(6종), 실행 엔진 spec, AI Assistant 도구 schema 와 불일치하는 WARNING 1건이다. 같은 셀의 아이콘 매핑은 `waiting_for_input` 을 포함하고 있어 구현 오류로 직결될 가능성은 낮지만, 괄호 주석이 DTO 계약으로 오독될 경우 프런트엔드에서 상태 필터 누락이 발생할 수 있다. 나머지 2건은 문서 명명·교차 참조 동기화 권장 수준이다.

---

## 위험도

LOW
