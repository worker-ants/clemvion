---
checker: cross-spec
target: spec/4-nodes/5-data/2-code.md
date: 2026-06-11
---

# Cross-Spec 일관성 검토 결과

target: `spec/4-nodes/5-data/2-code.md`

---

## 발견사항

### 1. [WARNING] `EXECUTION_TIMEOUT` 코드의 지위 충돌 — legacy 강등 vs 타 spec 에서의 정식 사용

- **target 위치**: §5.3.2 타임아웃 케이스 + §5.3 공통 필드 표 + 에러 코드 정규화 매핑 표
- **충돌 대상**:
  - `spec/5-system/3-error-handling.md` §1.4 테이블 — `EXECUTION_TIMEOUT` 을 Code 노드 스크립트 실행 타임아웃의 **정식** 엔진-레벨 코드로 기술
  - `spec/5-system/4-execution-engine.md:1018, 1398` — `EXECUTION_TIMEOUT` = Code 노드 스크립트 타임아웃 코드로 명시 (vs `EXECUTION_TIME_LIMIT_EXCEEDED` = 엔진 누적 타임아웃)
  - `spec/5-system/14-external-interaction-api.md:547` — `EXECUTION_TIMEOUT=Code 노드 스크립트 타임아웃` 주석으로 정식 사용
  - `spec/conventions/chat-channel-adapter.md:387` — `EXECUTION_TIMEOUT (Code 노드 스크립트)` 와 `CODE_TIMEOUT` 을 같은 행에 병기하여 중복 코드 공존 상태
- **상세**: target draft 는 `output.error.code` 를 `CODE_TIMEOUT` 으로 정규화하고 `EXECUTION_TIMEOUT` 을 `details.legacyCode` 로 강등한다. 그러나 `3-error-handling.md` §1.4 테이블은 여전히 `EXECUTION_TIMEOUT` 을 Code 노드 스크립트 타임아웃의 정식 코드로 나열한다. `chat-channel-adapter.md` 는 두 코드를 한 행에 함께 나열하여 어느 쪽이 정식인지 모호하다. 소비자(분류 로직, 다운스트림 표현식 `$node["X"].output.error.code`)가 `EXECUTION_TIMEOUT` 을 기대하도록 코딩된 경우 `CODE_TIMEOUT` 으로 전환 후 동작이 달라진다.
- **제안**:
  - `spec/5-system/3-error-handling.md` §1.4 — `EXECUTION_TIMEOUT` 행을 `CODE_TIMEOUT` (노드 수준 output.error.code) 과 `EXECUTION_TIMEOUT` (이전 legacyCode, deprecated) 로 분리 기재하거나, `CODE_TIMEOUT` 을 정식 코드로 갱신
  - `spec/5-system/4-execution-engine.md` — `EXECUTION_TIMEOUT` 언급을 `CODE_TIMEOUT` 으로 갱신
  - `spec/5-system/14-external-interaction-api.md` — `EXECUTION_TIMEOUT` 주석을 `CODE_TIMEOUT` 으로 교체
  - `spec/conventions/chat-channel-adapter.md:387` — `EXECUTION_TIMEOUT (Code 노드 스크립트)` 를 `CODE_TIMEOUT` 으로 단일화 (혹은 `CODE_TIMEOUT (구 EXECUTION_TIMEOUT)` 명기)

---

### 2. [WARNING] `CODE_RUNTIME_ERROR` / `EXECUTION_MEMORY_EXCEEDED` legacyCode 가 타 spec 에 미등재

- **target 위치**: §5.3 에러 코드 정규화 매핑 표 (`details.legacyCode` 값 정의)
- **충돌 대상**:
  - `spec/5-system/3-error-handling.md` §1.4 — `CODE_EXECUTION_FAILED`, `CODE_TIMEOUT`, `CODE_MEMORY_LIMIT` 만 나열. `CODE_RUNTIME_ERROR` / `EXECUTION_MEMORY_EXCEEDED` 미등재
  - `spec/conventions/chat-channel-adapter.md:387,388` — `CODE_EXECUTION_FAILED`, `CODE_MEMORY_LIMIT` 는 있으나 `CODE_RUNTIME_ERROR` / `EXECUTION_MEMORY_EXCEEDED` 는 부재
- **상세**: target 은 `output.error.details.legacyCode` 로 `CODE_RUNTIME_ERROR` (→ `CODE_EXECUTION_FAILED` 정규화) 와 `EXECUTION_MEMORY_EXCEEDED` (→ `CODE_MEMORY_LIMIT` 정규화) 를 신규 정의한다. 이 레거시 코드들이 다른 spec 에서 언급되지 않아 소비자가 `details.legacyCode` 가 어떤 값인지 알기 어렵다. 필드 자체가 `details` 안에 있어 외부 소비 위험은 낮지만, 코드 리뷰·핸들러 구현 시 혼동 가능성이 있다.
- **제안**: `spec/5-system/3-error-handling.md` §1.4 Code 노드 행의 주석에 legacyCode 매핑을 추가하거나 (`CODE_TIMEOUT` ← `EXECUTION_TIMEOUT`, `CODE_EXECUTION_FAILED` ← `CODE_RUNTIME_ERROR`, `CODE_MEMORY_LIMIT` ← `EXECUTION_MEMORY_EXCEEDED`), target §5.3 매핑 표에 "이 매핑은 Code 노드 핸들러 내부 전용" 임을 명시.

---

### 3. [INFO] `spec/4-nodes/0-overview.md` §5 샌드박싱 표의 `EXECUTION_TIMEOUT` 참조 미반영

- **target 위치**: §5.3.2 타임아웃 에러 코드 (이제 `CODE_TIMEOUT`)
- **충돌 대상**: `spec/4-nodes/0-overview.md:301` — "메모리 제한" 행이 `CODE_MEMORY_LIMIT` 로 이미 정합되어 있으나, 별도 타임아웃 관련 언급 없음 (타임아웃은 §5 타임아웃 행에서 `EXECUTION_TIMEOUT` 이 아닌 `CODE_TIMEOUT` 로 기술돼 있는지 확인 필요). 단, `4-nodes/0-overview.md` 는 `CODE_TIMEOUT` 을 직접 언급하지 않아 현재는 neutral — 향후 `EXECUTION_TIMEOUT` 을 직접 언급하는 행이 추가되면 충돌 발생.
- **상세**: 현재 충돌은 없으나 `3-error-handling.md` / `4-execution-engine.md` 갱신 시 연동하여 `0-overview.md §5` 도 확인 필요.
- **제안**: 위 WARNING 1 해소 시 `4-nodes/0-overview.md §5` 타임아웃 관련 문구도 함께 검토.

---

### 4. [INFO] `spec/4-nodes/5-data/0-common.md` §4.1 에러 컨트랙트 표와 목록 일치

- **target 위치**: §5.3 런타임 에러 구분 (throw / 타임아웃 / 메모리 초과)
- **충돌 대상**: `spec/4-nodes/5-data/0-common.md:69` — Code 노드의 pre-flight / runtime 에러 분류표
- **상세**: `0-common.md` §4.1 은 Code 노드 런타임 에러로 "런타임 throw, 타임아웃, 메모리 초과"를 열거하고 있으며, target draft 와 일치한다. 직접 충돌은 없으나 `0-common.md` 가 구체 에러 코드를 명시하지 않아 target 에서 새로 정규화된 `CODE_TIMEOUT` / `CODE_MEMORY_LIMIT` 코드명이 자동으로 동기화되지 않는다.
- **제안**: `0-common.md` §4.1 Code 행의 "runtime 에러 포트" 열에 `CODE_TIMEOUT / CODE_EXECUTION_FAILED / CODE_MEMORY_LIMIT` 코드를 brief reference 로 추가하면 일관성 향상.

---

### 5. [INFO] `spec/4-nodes/0-overview.md` §2.5 Data 노드 표에 code 노드 출력 포트 수 기재 이상 없음 (확인)

- **target 위치**: §3 포트 정의
- **충돌 대상**: `spec/4-nodes/0-overview.md:212` — `code` 행: 입력 1, 출력 **2** (`success` / `error`), 키 설정 `language, code`
- **상세**: target §3 은 입력 포트 `in` 1개, 출력 포트 `success` / `error` 2개로 정의한다. `0-overview.md` 의 "출력 2" 기재와 일치한다. 충돌 없음.

---

### 6. [INFO] RBAC 언급 ("Editor 이상") 이 기존 권한 매트릭스와 일치

- **target 위치**: §Rationale 격리 방식 전환 — "code 노드 작성 권한은 **Editor 이상**이다"
- **충돌 대상**: `spec/2-navigation/9-user-profile.md` §4.2 역할 권한 매트릭스 — "워크플로우 생성/수정/삭제 = Owner/Admin/Editor ✅, Viewer ❌"
- **상세**: target 의 "Editor 이상" 언급은 워크플로우 편집 권한(= Editor+)을 상속한 기존 매트릭스와 일치한다. Code 노드 단독 RBAC 제한이 별도로 추가된 것이 아니므로 충돌 없음.

---

### 7. [INFO] Principle 7 "항상 echo" 목록의 `code.config.code` 이미 동기화됨 (확인)

- **target 위치**: §Rationale "`config.code` raw echo" 섹션
- **충돌 대상**: `spec/conventions/node-output.md` Principle 7 "항상 echo" 목록 — `code (raw — 사용자 코드 본문, code.config.code)` 가 명시되어 있음 (line ~296)
- **상세**: target Rationale 에서 언급한 "Principle 7 금지 목록에서 삭제 + 항상 echo 로 이동"이 `node-output.md` 에 이미 반영돼 있다. 충돌 없음.

---

### 8. [INFO] Principle 8.2 "root 직접 배치 예외" 이미 동기화됨 (확인)

- **target 위치**: §Rationale "`output` root 직접 배치 — Principle 8.2 의 `output.result` 래핑 미적용"
- **충돌 대상**: `spec/conventions/node-output.md` Principle 7/8 영역
- **상세**: target Rationale 에서 언급한 `output.result` 래핑 미적용 결정이 `node-output.md` 에 정합화됐다고 기재됨. `node-output.md` 를 실제 확인하면 LLM 계열 한정 규칙이 명시되어 있고 Code/Transform 예외가 기재되어 있다. 직접 충돌 없음.

---

## 요약

target `spec/4-nodes/5-data/2-code.md` 의 가장 큰 cross-spec 이슈는 **에러 코드 정규화에 따른 이름 지위 충돌**이다. target 은 `CODE_TIMEOUT` 을 노드 수준 `output.error.code` 로 도입하고 `EXECUTION_TIMEOUT` 을 `details.legacyCode` 로 강등하지만, `spec/5-system/3-error-handling.md` §1.4, `spec/5-system/4-execution-engine.md`, `spec/5-system/14-external-interaction-api.md` 가 아직 `EXECUTION_TIMEOUT` 을 정식 코드로 취급하고 있다. `spec/conventions/chat-channel-adapter.md` 는 두 코드를 한 행에 병기해 혼용 상태다. 이 불일치는 소비자(표현식 분기·채널 어댑터 분류기)가 어느 코드를 기준으로 코딩해야 하는지 모호하게 만드는 WARNING 수준이다. `CODE_RUNTIME_ERROR` / `EXECUTION_MEMORY_EXCEEDED` legacyCode 의 타 spec 미등재는 INFO 수준이다. 나머지(샌드박싱 기술 일치, 포트 구조 일치, RBAC 일치, Principle 7/8 정합화)는 충돌 없이 일관성이 확보된 상태다.

## 위험도

MEDIUM
