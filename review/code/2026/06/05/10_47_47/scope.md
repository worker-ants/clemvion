# 변경 범위(Scope) Review — PR-A2a

## 발견사항

### 파일 1: execution-engine.service.spec.ts

- **[INFO]** 테스트 블록 위치가 기존 `Phase 2.3a — §7.5 rehydration` describe 밖의 독립 describe 로 삽입됨
  - 위치: 8903라인 (기존 테스트 블록 사이 삽입)
  - 상세: `_resumeCheckpoint schemaVersion + 견고화 (PR-A2a)` describe 가 Phase 2.3a 블록 직전에 추가됐다. 단위 테스트 4개(`buildResumeCheckpoint` stamp, undefined 입력, `buildRetryReentryState` strip, 방어적 기본값)는 PR-A2a 목적에 직결된다.
  - 제안: 문제없음. 범위 내 추가.

- **[INFO]** Phase 2.3a rehydration 통합 테스트 블록 내 버전 가드 케이스 추가 (9342라인)
  - 위치: 기존 rehydration 통합 describe 내 삽입
  - 상세: `schemaVersion: 999` 미래 버전 → `RESUME_INCOMPATIBLE_STATE` graceful reset 검증 테스트 1개. PR-A2a 의 핵심 기능(버전 가드)에 대한 통합 커버리지로 범위 내.
  - 제안: 문제없음.

- **[INFO]** `CheckpointSubject` 로컬 타입 정의 — 테스트 격리용 duck-type assertion
  - 위치: 새 describe 블록 내 (66-85라인)
  - 상세: service 의 private 메서드를 타입 안전하게 캐스팅하기 위한 로컬 타입. 기존 패턴(`(service as unknown as {...})`)과 일관되며 테스트 전용 신규 타입.
  - 제안: 문제없음. 기존 파일 패턴과 일치.

### 파일 2: execution-engine.service.ts

- **[INFO]** `CHECKPOINT_SCHEMA_VERSION` 상수 추가 + JSDoc
  - 위치: 255라인 (NODE_ERROR_MESSAGE_MAX_LEN 이후)
  - 상세: 새 상수와 10줄짜리 JSDoc. PR-A2a 핵심 목적의 구현체. 범위 내.
  - 제안: 문제없음.

- **[INFO]** `buildRetryReentryState` 내 `schemaVersion` strip 추가
  - 위치: 4141-4193라인 (구조분해 패턴에 `schemaVersion: _schemaVersion` 추가)
  - 상세: 기존 `expiresAt` strip 패턴과 동일한 방식으로 `schemaVersion` 을 resumeState 에서 제거. `void _schemaVersion;` lint 억제 패턴도 기존 `void _expiresAt;` 와 동일. 범위 내.
  - 제안: 문제없음.

- **[INFO]** `buildRetryReentryState` 내 핵심 필드 방어적 기본값 블록 추가
  - 위치: 4193라인 (`resumeState` spread 이후)
  - 상세: `messages`, `turnCount`, `totalInputTokens`, `totalOutputTokens`, `totalThinkingTokens`, `toolCalls` 6개 필드에 타입 가드 + 기본값. PR-A2a 범위("핵심 필드 누락 시 기본값 보강") 내.
  - 제안: 문제없음.

- **[INFO]** `buildResumeCheckpoint` return 에 `schemaVersion: CHECKPOINT_SCHEMA_VERSION` stamp 추가
  - 위치: 4296라인
  - 상세: 기존 return 객체에 `schemaVersion` 필드 1개 추가. 범위 내.
  - 제안: 문제없음.

- **[INFO]** `rehydrateAndResume` 내 버전 가드 블록 추가
  - 위치: 1630-1712라인
  - 상세: `isAiConversation && resumeCheckpoint` 조건 하에 schemaVersion > CHECKPOINT_SCHEMA_VERSION 이면 `RehydrationError('RESUME_INCOMPATIBLE_STATE')` throw. 기존 checkpoint 부재 가드 직후 삽입. 범위 내.
  - 제안: 문제없음.

### 파일 3: plan/in-progress/exec-park-durable-resume.md

- **[INFO]** A1 완료 표시 + A2 범위 분리 결정 반영
  - 위치: 48-2993라인
  - 상세: A1 체크박스 완료 표시, A2 → A2a/A2b 분리(사용자 결정 2026-06-05 명시), A2a 현재 PR 표시, A2b 후속 분리 기술. 계획 문서 갱신은 CLAUDE.md 의 plan/in-progress 갱신 정책 내. 범위 내.
  - 제안: 문제없음.

---

## 요약

PR-A2a 의 변경은 commit message 에 명시된 세 목적(1. `CHECKPOINT_SCHEMA_VERSION` stamp, 2. 재개 시 버전 가드, 3. `buildRetryReentryState` schemaVersion strip + 방어적 기본값)에 정확히 수렴한다. 테스트 파일은 이 세 기능에 대한 단위/통합 커버리지만 추가했으며, 기존 테스트 수정·삭제·무관한 리팩토링은 없다. 서비스 파일은 범위 외 코드 영역(다른 메서드, 임포트, 포맷)에 아무런 변경이 없다. 계획 파일은 A1 완료·A2 분리 결정이라는 실제 진행 사항을 반영하는 정당한 갱신이다. 불필요한 리팩토링·기능 확장·무관한 수정·포맷팅 잡음은 발견되지 않는다.

## 위험도

NONE
