# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/4-execution-engine.md` (구현 변경 diff 기준)
**검토 모드**: 구현 완료 후 (`--impl-done`), scope=`spec/5-system/4-execution-engine.md`, diff-base=`origin/main`
**검토 일시**: 2026-06-06

---

## 발견사항

### [INFO] 테스트 헬퍼 함수명 `makeDeadlockGuard` → `makeCompletionGuard` 변경 — 의미 정확도 향상
- **target 위치**: `execution-engine.service.spec.ts` diff 부분, 함수 `makeDeadlockGuard` 제거 및 `makeCompletionGuard` 신설 (diff 라인 @@ -10621 / +10621)
- **위반 규약**: `spec/conventions/error-codes.md §1` — 의미 기반 명명 원칙 (구현 세부·역사를 이름에 박지 않는다)
- **상세**: 이전 `makeDeadlockGuard` 는 "worker deadlock 방지" 라는 *구 모델(detach 모델)* 의 관점을 이름에 박고 있었다. 신규 `makeCompletionGuard` 는 "drive 가 완결됨을 가드" 라는 *현재 모델의 의미*를 기술해 명명이 더 정확해졌다. 이 변경은 규약을 위반한 것이 아니라 **규약에 더 잘 부합하도록 개선된 사례**이다.
- **제안**: 현 상태 유지. INFO 로 기록.

---

### [INFO] 테스트 describe 블록 레이블 내 `CRITICAL #1`, `CRITICAL #2`, `WARNING #8` 태그 — ai-review 원본 식별자 그대로 노출
- **target 위치**: `execution-engine.service.spec.ts` diff 신규 추가 블록, `describe('driveCallStackResume / driveResumeFrame / injectInvokerOutput (CRITICAL #1)')`, `describe('resumeFromCheckpoint — callStack non-null 분기 (CRITICAL #2)')`, `describe('executeInline — _callStack push/pop (WARNING #8)')`
- **위반 규약**: CLAUDE.md 문서 구조 규약 (문서 내 명명 일관성); `spec/conventions/` 에 테스트 describe 명명에 관한 직접 규약은 없다
- **상세**: `CRITICAL #1`, `WARNING #8` 등 ai-review SUMMARY 의 식별자가 테스트 describe 제목 안에 인라인으로 남아있다. 이는 테스트 코드 내부 관례 문서의 성격이지 spec/conventions 위반은 아니다. 다만 ai-review 재실행 시 번호가 달라지면 추적성이 끊길 수 있다.
- **제안**: 시간이 지나면 `(CRITICAL #1)` 접미사는 구어체 주석으로 이동해 describe 제목은 기능 설명만 남기는 것이 바람직하지만, 필수 교정 사항은 아니다.

---

### [INFO] `ParkReleaseSignal` 클래스 — `Error` 를 extends 하는 sentinel 패턴
- **target 위치**: `codebase/backend/src/shared/execution-resume/park-release-signal.ts` (신규 파일, diff 에서 import 참조)
- **위반 규약**: `spec/conventions/node-output.md §3` (에러 컨트랙트 통일) 및 `spec/conventions/error-codes.md §1`
- **상세**: `ParkReleaseSignal` 은 `Error` 를 extends 하지만 실제 에러가 아닌 **park sentinel** 이다. `error.code` 를 발행하지 않으므로 `error-codes.md` 의 명명 원칙 적용 대상이 아니다. 클래스명 자체는 역할을 명확히 설명하는 `ParkReleaseSignal` 로 의미 기반 명명을 따르고 있다. 이 파일은 spec frontmatter 가드 대상(`spec-impl-evidence.md §1`)이 아닌 코드 파일이므로 직접 규약 위반은 없다.
- **제안**: 현 상태 유지. INFO 로 기록.

---

### [INFO] `CALL_STACK_SCHEMA_VERSION` 상수 참조 — 테스트 내 하드코딩 1 대신 상수 사용
- **target 위치**: `execution-engine.service.spec.ts` diff, `expect(ex.resumeCallStack?.version).toBe(CALL_STACK_SCHEMA_VERSION)` (diff 라인 ~795)
- **위반 규약**: 특정 규약 미위반
- **상세**: 이전 코드에서 하드코딩 숫자 `1` 이 있었으나 상수 `CALL_STACK_SCHEMA_VERSION` 으로 교체됐다. 주석 자체("WARNING #10 — 상수 참조로 교체")가 의도를 명확히 설명한다. 규약 준수 방향으로의 개선 사례이다.
- **제안**: 현 상태 유지.

---

### [INFO] 테스트 케이스 레이블 내 `spec §10.9 wrap`, `spec §10.9 raw forward` 등 spec 참조 — 형식 일관성
- **target 위치**: `execution-engine.service.spec.ts` diff 라인 ~101, ~119, ~149 등
- **위반 규약**: CLAUDE.md 명명 컨벤션 규약 없음 (테스트 it 제목 형식은 conventions 미규정)
- **상세**: `it` 제목에 `(spec §10.9 wrap)` 형태로 spec 절 참조가 인라인으로 포함된다. 이는 추적성에 도움이 되는 관례이며 conventions 위반이 아니다.
- **제안**: 현 상태 유지.

---

## 분석 범위별 점검 결과

### 1. 명명 규약

**파일명·식별자 점검**:
- `resume-call-stack.types.ts`, `park-release-signal.ts`: kebab-case 파일명으로 프로젝트 TypeScript 파일 명명 관례를 따른다.
- `CALL_STACK_SCHEMA_VERSION`: `UPPER_SNAKE_CASE` 상수 명명 — 규약 준수.
- `ParkReleaseSignal`: PascalCase 클래스명 — 규약 준수.
- `driveCallStackResume`, `driveResumeFrame`, `injectInvokerOutput`, `processAiResumeTurn`, `processButtonResumeTurn`: camelCase private 메서드명, 의미 기반(무엇을 하는가 기술) — 규약 준수.
- `makeCompletionGuard` (구 `makeDeadlockGuard`): 의미 기반 개선. 규약 준수.

**에러 코드 점검** (`spec/conventions/error-codes.md §1`):
- `RESUME_CHECKPOINT_MISSING`, `RESUME_INCOMPATIBLE_STATE`: 기존 코드로 `UPPER_SNAKE_CASE`, 조건의 의미를 기술 — 규약 준수.
- `HANG:` 문자열(makeCompletionGuard 에러 메시지): 에러 코드가 아닌 로그 메시지 접두사이므로 `error-codes.md` 적용 대상 외.

### 2. 출력 포맷 규약

diff 내 테스트가 검증하는 페이로드 형태:
- `{ type: 'form_submitted', formData }` sentinel wrap — `spec/conventions/interaction-type-registry.md` 및 `spec/4-nodes/6-presentation/0-common.md §10.9` 정의와 일치.
- `{ type: 'button_click', buttonId }`, `{ type: 'ai_message', message }` — `node-output.md §4.5` interaction.data payload 규격과 일치.
- `ResumeCallStack` envelope `{ version, frames }` — `resume-call-stack.types.ts` 에 정의된 스키마와 일치하며, `CALL_STACK_SCHEMA_VERSION` 상수 기반 버전 가드 패턴이 `_resumeCheckpoint` 의 `CHECKPOINT_SCHEMA_VERSION` 과 같은 패턴(독립 진화).

### 3. 문서 구조 규약

**대상 spec 문서 (`spec/5-system/4-execution-engine.md`)**:
- frontmatter 존재: `id: execution-engine`, `status: partial`, `code:`, `pending_plans:` — `spec/conventions/spec-impl-evidence.md §2` 스키마 준수.
- `pending_plans:` 에 `plan/in-progress/exec-park-durable-resume.md` 가 등재되어 있으며 해당 파일도 실존한다.
- 문서 구조에 Overview / 본문(섹션 §1~§Rationale) / Rationale 3섹션 권장 패턴이 유지된다 — CLAUDE.md 명명 컨벤션 준수.

### 4. API 문서 규약

- diff 범위(`.service.spec.ts`)에 Swagger/OpenAPI 데코레이터·DTO 패턴이 포함되지 않아 `spec/conventions/swagger.md` 적용 대상 외.

### 5. 금지 항목 점검

- `pendingContinuations` Map(in-memory resolver): diff 전체에서 **제거** 방향으로 정리됐다. 이 패턴은 spec §7.4 에서 "Phase B full B3 제거 대상"으로 명시됐으며, 잔존 관련 코드가 제거된 것은 규약 방향과 일치.
- `getPendings` 헬퍼 제거: in-memory resolver 에 의존하는 fast-path 제거와 함께 삭제됐다. conventions 금지 항목에 직접 명시된 것은 아니나 spec 의 "durable 영속 일원화" 서술과 정합.
- `pendingContinuations.clear()` 방어 코드 제거: exec-park D6 full B3 에서 fast-path 자체가 없어졌으므로 제거가 정확하다. 잔류시 오히려 불일치.

---

## 요약

이번 diff(`spec/5-system/4-execution-engine.md` 구현 완료 검토)에서 대상은 테스트 파일(`execution-engine.service.spec.ts`)과 신규 공유 타입 파일 2개(`resume-call-stack.types.ts`, `park-release-signal.ts`)이다. 명명 규약(UPPER_SNAKE_CASE 상수, camelCase 메서드, PascalCase 클래스, kebab-case 파일), 에러 코드 명명(`spec/conventions/error-codes.md §1` 의미 기반), 출력 포맷(`node-output.md §4.5` interaction payload, `interaction-type-registry.md` enum 값), 문서 구조(spec frontmatter `id`/`status`/`code`/`pending_plans` — `spec-impl-evidence.md §2`) 모든 관점에서 정식 규약을 준수한다. `makeDeadlockGuard` → `makeCompletionGuard` 리네임은 error-codes.md 의미 기반 명명 원칙과 더 잘 부합하는 방향의 개선이며, `CALL_STACK_SCHEMA_VERSION` 상수 참조 전환도 동일하다. CRITICAL 또는 WARNING 등급의 위반은 발견되지 않았다.

---

## 위험도

NONE
