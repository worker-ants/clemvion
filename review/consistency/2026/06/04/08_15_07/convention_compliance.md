# 정식 규약 준수 검토 결과

**Target**: `plan/in-progress/spec-draft-exec-intake-queue.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-06-04

---

## 발견사항

### 1. 명명 규약

- **[INFO]** 신규 에러 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` — 규약 준수 확인
  - target 위치: §5 (line 115)
  - 위반 규약: `spec/conventions/error-codes.md §1`
  - 상세: `EXECUTION_TIME_LIMIT_EXCEEDED` 는 "무엇이 잘못되었는가(active-running 시간 초과)" 를 기술하는 의미 기반 이름이다. `UPPER_SNAKE_CASE` 표기, 도메인 prefix 없는 시스템 레벨 코드로 분류 가능. 기존 `EXECUTION_TIMEOUT` (Code 노드 스크립트 타임아웃) 과 의미를 분리해 신설한다고 명시되어 있으므로 명명 규약(§1·§2)에 정합.
  - 제안: 준수. 추가 조치 불필요.

- **[INFO]** `EXECUTION_RUN_WORKER_CONCURRENCY` ENV 변수명
  - target 위치: §4 (4.3 수평 확장 표)
  - 위반 규약: 해당 ENV 명명 전용 규약은 별도 없음 — `spec/5-system/4-execution-engine.md §11` ENV 표 패턴 준용
  - 상세: 기존 `CONTINUATION_WORKER_CONCURRENCY` 패턴과 대칭적 명명(도메인_역할_CONCURRENCY). 규약에 명시적 위반 없음.
  - 제안: 준수. spec 반영 시 §11 ENV 표에 행 추가가 후속 항목에 명시되어 있음 — 정상.

- **[INFO]** `execution-run` 큐 이름 (kebab-case)
  - target 위치: §0 변경 요지, §4.1
  - 위반 규약: 큐 명명 전용 규약은 별도 없음 (BullMQ 큐는 `execution-continuation`·`background-execution` 패턴 사용)
  - 상세: 기존 `execution-continuation`, `background-execution` 과 동일한 kebab-case + domain 접두 패턴. 일관성 있음.
  - 제안: 준수.

---

### 2. 출력 포맷 규약

- **[INFO]** `execution-run` job 메시지 페이로드 스키마 (`jobId`, `executionId`, `input`, `triggerType`)
  - target 위치: §4.2 (line 47–54)
  - 위반 규약: 해당 BullMQ job payload 전용 정식 규약 없음 (spec/conventions/ 에 job payload 스키마 convention 미존재)
  - 상세: payload 설계가 내부 BullMQ job 메시지로서 API 응답 포맷 규약 적용 대상이 아님. `triggerType` 은 `Trigger.type` enum 재사용으로 신규 어휘를 도입하지 않는다고 명시하여 naming collision 회피 원칙 준수.
  - 제안: 준수.

---

### 3. 문서 구조 규약

- **[INFO]** plan 문서로서의 3섹션 구조 (Overview / 본문 / Rationale)
  - target 위치: 전체 문서
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
  - 상세: 본 문서는 `plan/in-progress/` 에 위치한 **plan** 문서이지 spec 본문이 아니다. CLAUDE.md 의 3섹션 권장은 spec 파일을 대상으로 한다 ("각 SKILL.md 참고"). plan 문서에는 그 규약이 직접 적용되지 않는다. 단, `## Rationale` 절이 본문 끝에 존재하고 있어 spec 수준의 근거 기록 관행을 자발적으로 따르고 있음. Overview 에 해당하는 섹션은 "## 0. 변경 요지" 로 대체.
  - 제안: plan 문서 유형이므로 3섹션 미적용이 맞음. 위반 없음.

- **[WARNING]** plan frontmatter — `plan-lifecycle.md §4` 스키마와의 정합
  - target 위치: 문서 상단 frontmatter (lines 1–5)
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` Frontmatter 스키마
  - 상세: `plan-lifecycle.md §4` 의 필수 스키마는 `worktree` / `started` / `owner` 세 필드. 문서는 세 필드를 모두 포함하고 있어 스키마 준수. 단, 문서 내 trailing note (line 173) 에 "consistency checker 의 '스키마 외' WARNING 은 오탐" 이라고 기술되어 있는데, 실제로 `owner: project-planner` 는 규약 스키마 예시 값 `planner / developer / 사용자 본인 등` 범위 안이므로 정상이다.
  - 제안: 준수. trailing note 는 방어적 주석으로 허용.

- **[INFO]** 파일명 패턴
  - target 위치: 파일 경로 `plan/in-progress/spec-draft-exec-intake-queue.md`
  - 위반 규약: CLAUDE.md "정보 저장 위치" — `plan/in-progress/<name>.md`
  - 상세: `plan/in-progress/` 하위에 `.md` 파일로 올바르게 위치. `spec-draft-exec-intake-queue` 는 작업 슬러그로 식별 가능하고 중복 없음. CLAUDE.md 의 `_product-overview.md`·`0-` prefix 규칙은 `spec/` 파일 전용이고 plan 파일에는 적용 안 됨.
  - 제안: 준수.

---

### 4. API 문서 규약

- **[INFO]** API 문서 관련 규약 적용 범위 외
  - target 위치: 전체 문서
  - 위반 규약: `spec/conventions/swagger.md` (OpenAPI/Swagger 데코레이터·DTO)
  - 상세: 본 문서는 내부 BullMQ job 메시지와 실행 엔진 아키텍처를 기술하며, REST API endpoint 나 DTO 정의를 직접 명세하지 않는다. Swagger/OpenAPI 규약 적용 대상이 아님.
  - 제안: 해당 없음.

---

### 5. 금지 항목

- **[INFO]** `spec/conventions/` 의 명시적 금지 패턴 준수 여부
  - target 위치: 전체 문서
  - 위반 규약: `spec/conventions/error-codes.md §2` (rename 금지), `spec/conventions/spec-impl-evidence.md §3` (status 전이 규칙)
  - 상세:
    1. 기존 `EXECUTION_TIMEOUT` 코드를 rename 하지 않고 **의미가 다른 신규 코드** `EXECUTION_TIME_LIMIT_EXCEEDED` 를 신설한다고 명시(line 115) — error-codes §2 rename 정책 준수.
    2. `triggerType` 신규 어휘 도입을 명시적으로 금지하고 기존 `Trigger.type` enum 재사용 — naming collision 회피 원칙 준수.
    3. 본 plan 문서 자체가 spec 파일이 아니므로 `spec-impl-evidence.md` 의 frontmatter `id`/`status` 의무가 적용되지 않음(plan 파일은 제외 대상).
  - 제안: 금지 항목 해당 없음. 준수.

---

### 6. 후속 체크리스트의 spec 경로 참조 검증

- **[WARNING]** 후속 항목이 참조하는 `plan/in-progress/spec-sync-execution-engine-gaps.md` 존재 여부
  - target 위치: `## 후속` 섹션 (line 169)
  - 위반 규약: `.claude/docs/plan-lifecycle.md §4` — pending_plans 실존 의무 (spec frontmatter 에서의 규약이나, plan 내 cross-link 의 건전성도 동일 원칙 적용)
  - 상세: 후속 항목에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 를 참조한다. 실제로 해당 파일은 `plan/in-progress/` 에 존재함(`spec-sync-execution-engine-gaps.md` 확인됨). 참조 경로 유효.
  - 제안: 준수.

- **[INFO]** `execution-engine-residual-gaps.md` 참조
  - target 위치: `## 후속` 섹션 (line 169)
  - 상세: `plan/in-progress/execution-engine-residual-gaps.md` 도 존재 확인됨. 참조 경로 유효.
  - 제안: 준수.

- **[INFO]** `node-cancellation-infrastructure.md` 참조
  - target 위치: `## 후속` 섹션 (line 171)
  - 상세: `plan/in-progress/node-cancellation-infrastructure.md` 존재 확인됨. 참조 경로 유효.
  - 제안: 준수.

---

## 요약

`plan/in-progress/spec-draft-exec-intake-queue.md` 는 정식 규약 준수 관점에서 양호하다. 본 문서는 spec 본문이 아닌 **plan** 문서이므로 `spec-impl-evidence.md` 의 frontmatter lifecycle 의무(id/status/code)나 spec 3섹션 규약이 직접 적용되지 않으며, 적용 대상인 `plan-lifecycle.md §4` frontmatter 스키마(worktree/started/owner)는 완전히 준수된다. 신규 에러 코드 `EXECUTION_TIME_LIMIT_EXCEEDED` 는 `error-codes.md §1·§2` 의 의미 기반 명명·rename 금지 원칙에 정합하고, 기존 `EXECUTION_TIMEOUT` 을 rename 하지 않고 의미 분리된 신규 코드로 신설하는 방식이 명시되어 있다. 큐 명명(`execution-run`)·ENV 명명(`EXECUTION_RUN_WORKER_CONCURRENCY`)·`triggerType` 재사용 정책 모두 기존 패턴과 일관성이 있다. 후속 체크리스트에서 참조하는 plan 파일 경로들도 실존이 확인되었다. CRITICAL·WARNING 등급의 위반은 없다.

---

## 위험도

**NONE**
