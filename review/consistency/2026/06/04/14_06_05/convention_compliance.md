## 발견사항

### [WARNING] 문서에 `## Overview` 섹션이 없음
- **target 위치**: `spec/5-system/4-execution-engine.md` — 파일 전체 구조
- **위반 규약**: `CLAUDE.md` "정보 저장 위치" 항목 및 skill 문서 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: spec 문서는 Overview / 본문 / Rationale 3섹션 구성을 권장한다. 본 문서는 `## Rationale` 은 갖추고 있으나 `## Overview` 섹션이 없다. 제목 바로 아래의 관련 문서 링크 목록이 Overview 역할을 대신하고 있으나, 이는 편의적 cross-link 열거일 뿐 "제품 정의·요구사항" 을 담은 Overview 섹션과 동일하지 않다.
- **제안**: `# Spec: 실행 엔진 상세` 제목 하단에 `## Overview` 섹션을 추가하고 실행 엔진의 역할·범위·핵심 불변조건을 한 문단으로 정리한다. 규약 갱신 선택지 — 이미 광범위하게 존재하는 기술 명세 문서에서 Overview 생략이 관행이면 CLAUDE.md 에 "기술 명세 doc 의 Overview 는 선택" 으로 명시할 수 있다.

---

### [WARNING] 엔진 전용 에러 코드 다수가 `ErrorCode` enum 에 미등재
- **target 위치**: §7.4, §7.5, §7.5.1, §8, §11 — `error.code` 값 사용
- **위반 규약**: `spec/conventions/error-codes.md` §2 안정성/rename 정책, §1 의미 기반 명명 원칙
- **상세**: `spec/conventions/error-codes.md` 는 에러 코드 명명 규율의 "적용 범위"를 `ErrorCode` enum 뿐 아니라 "프로젝트 전체의 에러 코드 문자열"로 확장한다. 그러나 중앙 enum(`codebase/backend/src/nodes/core/error-codes.ts`)에는 다음 코드들이 등재되어 있지 않다:
  - `WORKER_HEARTBEAT_TIMEOUT` (§7.1)
  - `RESUME_CHECKPOINT_MISSING` (§7.5)
  - `RESUME_FAILED` (§7.5, §7.4)
  - `RESUME_INCOMPATIBLE_STATE` (§7.5)
  - `SERVER_INTERRUPTED` (§11)
  - `SERVER_SHUTTING_DOWN` (§11)
  - `INVALID_EXECUTION_STATE` (§7.5.1)
  - `CONTAINER_MISSING_EMIT`, `CONTAINER_MULTIPLE_EMIT` (§3.0)
  - `INVALID_NODE_CONFIG` (§5.6)
  - `UNKNOWN_NODE_TYPE` (§5.4)
  - `MAX_ITERATIONS_EXCEEDED` (§3.1)
  - `MAX_NODE_ITERATIONS` (§2.1 — 환경변수로만 언급)

  이 코드들은 spec 본문에서 사용되나, 단일 중앙 enum 등재 없이 인라인 문자열 리터럴로만 남아 있다. `conventions/error-codes.md §2` 는 "클라이언트(프론트엔드)가 코드의 의미로 분기"한다고 정의하므로, enum 비중앙화는 클라이언트-계약 불안정을 유발한다.
- **제안**: 위 목록을 `error-codes.ts` 의 별도 섹션(예: `// Execution Engine / Infrastructure`)으로 추가 등재하거나, 엔진 인프라 전용 enum 파일을 신설하고 conventions 의 "canonical surface" 목록에 추가한다. spec 문서에서 인라인 문자열로 언급된 코드들을 enum ref 로 교차 연결한다.

---

### [INFO] §9.1 Redis 키 패턴 예외 문서화 — 규약 자체가 이미 인식하나 형식이 산문
- **target 위치**: `spec/5-system/4-execution-engine.md` §9.1~9.2
- **위반 규약**: 직접 위반은 없음. `spec/conventions/` 의 네이밍 규약(Redis 키 표준 패턴)에 대한 예외가 있음.
- **상세**: §9.1 은 `{service}:{workspaceId}:{resource}:{id}:{sub}` 표준 패턴을 정의하면서, §9.2 테이블 주석에서 `exec:recover:lock`과 `exec:cont:seq:<executionId>` 두 키가 "워크스페이스에 종속되지 않는 전역 키" 라 패턴 예외임을 기술한다. 예외 기술은 충분하며 규약 위반은 아니다.
- **제안**: `spec/conventions/` 에 Redis 키 명명 규약 독립 문서가 없고 `4-execution-engine.md` 가 이를 SoT 로 겸하는 형태다. 향후 다른 서비스에서 Redis 키를 도입할 때 단일 진실을 찾기 어려울 수 있으므로, `spec/conventions/redis-key-naming.md` 로 분리를 고려할 수 있다 (INFO 수준).

---

### [INFO] 섹션 번호 순서 비연속 — §3.3이 §3.2 뒤가 아닌 §3.4 뒤에 배치
- **target 위치**: `spec/5-system/4-execution-engine.md` 라인 289~343 — §3.3 Background 실행이 §3.4 뒤에 위치
- **위반 규약**: 명시적 컨벤션 위반은 아님. 독해 일관성 이슈.
- **상세**: 목차상 §3.2 → §3.4 → §3.3 순서로 섹션이 배치되어 있다. §3.3이 §3.4 뒤에 위치한 것은 의도적이거나 편집 중 발생한 순서 오류일 수 있으나, 독자가 §3.4를 먼저 읽고 §3.3으로 되돌아가야 한다.
- **제안**: §3.3과 §3.4의 순서를 바로잡거나, 현 배치가 의도적(중첩 스코프 설명이 ForEach 뒤에 나와야 함)이라면 주석으로 이유를 명시한다.

---

### [INFO] `pending_plans` 실존 확인 — 정합함
- **target 위치**: frontmatter `pending_plans:` 필드
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` 가드 — `spec-pending-plan-existence.test.ts`
- **상세**: `plan/in-progress/execution-engine-residual-gaps.md` 와 `plan/in-progress/spec-sync-execution-engine-gaps.md` 두 파일 모두 실존 확인됨. 정합.
- **제안**: 없음.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 frontmatter(`id`/`status`/`code`/`pending_plans`) 스키마 (`spec/conventions/spec-impl-evidence.md §2`)를 올바르게 준수하고 있으며, `## Rationale` 섹션도 갖추고 있다. 주요 위반은 두 가지다: (1) 3섹션 권장 구성 중 `## Overview` 가 부재(WARNING)하며, (2) 본문에서 사용하는 엔진 인프라 에러 코드 다수(`RESUME_CHECKPOINT_MISSING`, `SERVER_INTERRUPTED`, `INVALID_EXECUTION_STATE` 등)가 `spec/conventions/error-codes.md` 가 정의하는 "프로젝트 전체 에러 코드 문자열" 규율에 따라 중앙 enum에 등재돼야 하나 현재 미등재 상태이다(WARNING). 섹션 번호 비연속 배치는 사소한 형식 문제이다(INFO).

## 위험도

MEDIUM

STATUS: OK
