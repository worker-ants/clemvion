# 신규 식별자 충돌 검토 결과

검토 대상: `spec/conventions/error-codes.md`

---

## 발견사항

### 발견사항 1

- **[WARNING]** §3 historical-artifact 레지스트리 — `already_a_member` / `workspace_type_mismatch` 의 케이스 분리가 코드베이스와 불완전하게 정합

  - **target 신규 식별자**: `already_a_member` · `workspace_type_mismatch` · `invitation_already_pending` · `invitation_already_accepted` (lowercase, §3 historical-artifact 등재)
  - **기존 사용처**:
    - `codebase/backend/src/modules/workspaces/workspace-invitations.service.ts` — `workspace_type_mismatch`(lowercase, line 91), `already_a_member`(lowercase, line 105), `invitation_already_pending`(lowercase, line 146), `invitation_already_accepted`(lowercase, lines 189·354) — **초대 발급·재발송 모듈**이 발행
    - `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `WORKSPACE_TYPE_MISMATCH`(UPPER, line 673), `ALREADY_A_MEMBER`(UPPER, line 246) — **직접 추가 경로(`WorkspacesService`)** 가 발행
    - `spec/data-flow/12-workspace.md` — §1.2(초대 발급) 다이어그램에서 `already_a_member`(lowercase, line 58)·`invitation_already_pending`(lowercase, line 70), §1.8(재발송·취소)에서 `invitation_already_accepted`(lowercase, lines 162·163), **그러나 §1.9(직접 추가 경로)에서는 `ALREADY_A_MEMBER`(UPPER, line 170)**
  - **상세**: target §3 은 `already_a_member`·`workspace_type_mismatch` 를 "초대 발급·재발송 API 한정" lowercase historical artifact 로 등재하고, "직접 추가 경로(`workspaces.service.ts`)가 발행하는 UPPER_SNAKE `ALREADY_A_MEMBER`·`WORKSPACE_TYPE_MISMATCH` 와 별개 코드"라고 명시한다. 이 구분은 코드베이스의 실제 서비스 분리(모듈 2개, 케이스 분리)와 일치한다. 그러나 `spec/data-flow/12-workspace.md §1.9` 는 직접 추가 경로의 `ALREADY_A_MEMBER`(UPPER)를 표기하나, §1.2(초대 발급) 다이어그램에서 `already_a_member`(lowercase)를 동일 조건명처럼 사용해 두 케이스 표기가 혼재한다. target §3 의 설명이 이 분리를 처음 명문화하기 때문에 기존 독자가 spec/data-flow/12-workspace.md 만 보면 두 케이스 코드가 동일 조건을 가리키는 것으로 착각할 수 있다.
  - **제안**: `spec/data-flow/12-workspace.md §1.2` 의 `already_a_member` 표기 옆에 "(초대 발급 경로 한정 lowercase — §1.9 직접 추가 경로의 `ALREADY_A_MEMBER`(UPPER)와 별개, `error-codes.md §3` 등재)" 정도의 인라인 주석을 추가해 두 경로의 코드 분리를 현장에서 명시할 것을 권장한다. target 자체의 식별자 충돌이 아니라 cross-spec 독해 혼란 위험이다.

---

### 발견사항 2

- **[INFO]** §4 내부 분류 코드 `EXECUTION_TIMEOUT` — 엔진 레벨 동명 코드와의 레이어 혼용 위험이 본문에 이미 경고되어 있음, 충돌 없음

  - **target 신규 식별자**: §4 표에서 내부 분류 코드 `EXECUTION_TIMEOUT` (Code 노드 핸들러 내부 한정) 을 명시적으로 언급
  - **기존 사용처**: `spec/5-system/3-error-handling.md §1.4` · `spec/5-system/14-external-interaction-api.md §6.4` — 엔진 레벨 `EXECUTION_TIMEOUT` (Code 노드 실행 타임아웃 시 엔진이 발행하는 `execution.failed.error.code`)
  - **상세**: 두 `EXECUTION_TIMEOUT` 은 동일 문자열이지만 레이어가 다르다(내부 분류 문자열 vs. 엔진 레벨 외부 발행 코드). target §4 의 블록 인용문("레이어 주의") 에서 이 분리를 명시하고 있으며, `spec/5-system/3-error-handling.md §1.4`·`chat-channel-adapter.md` 등 기존 spec 도 이 구분을 명시한다. 충돌이 아니라 의도된 동명 이구(異口)다. 추가 조치 불필요.
  - **제안**: 현행 유지.

---

### 발견사항 3

- **[INFO]** §5 Rename 이력 — 은퇴 코드 `LLM_CONFIG_NOT_FOUND` / `LLM_CONFIG_INVALID` / `WORKSPACE_REQUIRED` 가 기존 spec 에 잔존하는지 확인 완료

  - **target 신규 식별자**: §5 는 위 3종을 "완전 제거된(retired) 구 코드"로 표기
  - **기존 사용처**: `spec/` 전체 grep 결과, `LLM_CONFIG_NOT_FOUND`·`LLM_CONFIG_INVALID`·`WORKSPACE_REQUIRED`(퇴역 형태) 는 `spec/conventions/error-codes.md §5` 외 다른 spec 파일에 잔존하지 않음. `spec/3-workflow-editor/4-ai-assistant.md` 에는 `ASSISTANT_LLM_CONFIG_INVALID` 가 등장하지만 이는 별개 식별자(접두어가 `ASSISTANT_`). `WORKSPACE_ID_REQUIRED`(신 코드)는 `spec/5-system/3-error-handling.md` · `spec/5-system/15-chat-channel.md` 에서 정상 사용 중.
  - **상세**: 충돌 없음.
  - **제안**: 현행 유지.

---

### 발견사항 4

- **[INFO]** frontmatter `id: error-codes` — 프로젝트 내 유일

  - **target 신규 식별자**: 파일 frontmatter `id: error-codes`
  - **기존 사용처**: `spec/` 전체에서 동일 `id:` 값을 가진 파일은 `spec/conventions/error-codes.md` 단독
  - **상세**: 파일 경로(`spec/conventions/error-codes.md`)도 기존 컨벤션 파일과 충돌 없음. `spec/0-overview.md §8` 의 문서 맵에 이미 등재되어 있으며, cross-reference 링크가 기존 파일을 올바르게 가리킨다.
  - **제안**: 현행 유지.

---

## 요약

target `spec/conventions/error-codes.md` 가 도입하는 식별자(§3 historical-artifact 코드 레지스트리, §4 내부 분류 코드, §5 은퇴 코드 이력)는 기존 spec 및 코드베이스에서 이미 사용 중인 의미와 **충돌하지 않는다**. 단 §3 에 등재된 `already_a_member`(lowercase, 초대 경로)와 `ALREADY_A_MEMBER`(UPPER, 직접 추가 경로)의 의도적 케이스 분리가 target 에서 처음 명문화되었는데, `spec/data-flow/12-workspace.md` 가 이 구분을 인라인으로 표시하지 않아 cross-spec 독해 시 혼동 가능성이 있다(WARNING). target 자체의 식별자 소유권 충돌이나 API endpoint·ENV 변수 충돌은 발견되지 않았다.

## 위험도

LOW
