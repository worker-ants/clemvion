# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/15-chat-channel.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-12

---

## 발견사항

### [CRITICAL] `WORKSPACE_REQUIRED` — 미정의 에러 코드 사용

- **target 위치**: §5.4 Bot Token Rotation API 응답 계약 표 (line 340)
  ```
  | 401 | `WORKSPACE_REQUIRED` | `X-Workspace-Id` 헤더 누락 ...
  ```
- **위반 규약**: `spec/conventions/error-codes.md §1` — 프로젝트 전체 에러 코드 문자열에 의미 기반 명명 적용. `spec/5-system/3-error-handling.md §1.3` — 시스템 공용 코드 카탈로그.
- **상세**: `spec/5-system/3-error-handling.md §1.3` 의 정식 등록 코드는 `WORKSPACE_ID_REQUIRED` (`X-Workspace-Id` 헤더와 JWT `workspaceId` 둘 다 없음, `common/decorators/workspace.decorator.ts` 발행). 본 spec 은 `WORKSPACE_REQUIRED` 를 사용해 카탈로그에 없는 별도 코드를 암시한다. 실제 구현(`codebase/backend/src/modules/chat-channel/chat-channel.controller.ts:58`)도 `WORKSPACE_REQUIRED` 를 직접 발행하고 있어 코드 자체가 카탈로그 밖에 정의된 상태다. 클라이언트가 `WORKSPACE_ID_REQUIRED` (workspace.decorator) 와 `WORKSPACE_REQUIRED` (chat-channel controller) 두 코드를 별개로 처리해야 하는 invariant 분기를 생성한다.
- **제안**: 
  - (A) chat-channel controller 를 `WORKSPACE_ID_REQUIRED` 로 수정하고 spec 표도 동기화. `workspace.decorator.ts` 의 공용 가드가 호출 경로상 공통으로 처리하면 controller 중복 체크 불필요.
  - (B) `WORKSPACE_REQUIRED` 를 `3-error-handling.md §1.3` 에 정식 등재 (그 경우 기존 `WORKSPACE_ID_REQUIRED` 와의 의미 중복·분기 정책도 명시 필요). 현재로서는 (A) 가 단순하고 기존 invariant 를 깨지 않는다.

---

### [WARNING] `INVALID_BOT_TOKEN` — 명명 규약 역순 (`CONDITION_DOMAIN` vs 권장 `DOMAIN_CONDITION`)

- **target 위치**: §5.4 Bot Token Rotation API 응답 계약 표 (line 339)
  ```
  | 400 | `INVALID_BOT_TOKEN` | `newBotToken` 누락/비-string ...
  ```
- **위반 규약**: `spec/conventions/error-codes.md §1` — 도메인 prefix 권장 패턴 `<DOMAIN>_<CONDITION>`.
- **상세**: 같은 표 안에 `BOT_TOKEN_INVALID`(line 344 — 외부 provider 인증 실패) 가 정규 패턴(`<DOMAIN>_<CONDITION>`)으로 존재하는데, `INVALID_BOT_TOKEN` 은 역순(`<CONDITION>_<DOMAIN>`)을 사용한다. 두 코드가 같은 표 안에 공존해 일관성이 깨진다. 실제 코드(`chat-channel.controller.ts:52`)도 `INVALID_BOT_TOKEN` 을 그대로 발행하고 있어 이미 external contract 에 포함된 상태이므로 rename 은 breaking change(`error-codes.md §2`)에 해당한다.
- **제안**: rename 이 breaking change 임을 확인하고 `error-codes.md §3 Historical-artifact 예외 레지스트리` 에 `INVALID_BOT_TOKEN` 을 등재 (`BOT_TOKEN_INVALID` 과의 명명 비대칭 이유: v1 controller 레이어 출하 당시 역순 정착, frontend/사용자 가이드에 노출됨 — rename 불가). 단 신규 코드는 같은 패턴 금지 명시. 규약 갱신이 현실적 대응이다.

---

### [WARNING] 섹션 번호 충돌 — Overview 내부 `### 3.` 과 본문 최상위 `## 3.`

- **target 위치**:
  - `## Overview (제품 정의)` > `### 3. 요구사항 (CCH-* prefix)` (line 47)
  - `## 3. 처리 흐름` (line 116, 본문 최상위)
- **위반 규약**: CLAUDE.md / `project-planner/SKILL.md §Spec 문서 구조 (3섹션 권장)` — Overview / 본문 / Rationale 3섹션 구성. 명시적 번호 충돌 금지 조항은 없으나, 같은 문서에서 `§3` anchor 가 두 곳에 존재해 내부 cross-link(`#3-처리-흐름` vs `#3-요구사항-cch--prefix`) 가 slug 충돌 없이 분기 불가능.
- **상세**: `spec/5-system/14-external-interaction-api.md` 도 동일 패턴(Overview 내 `### 3.` + 본문 `## 3.`)을 사용해 프로젝트 내 공통 관행처럼 보이나, `spec/5-system/12-webhook.md` 는 Overview 내 `### 3.` 이 없고 본문 `## 3.` 만 있어 완전히 통일된 패턴이 아니다. 현재 `spec-link-integrity.test.ts` 가 anchor slug 를 검증하는데, `## 3. 처리 흐름` 의 slug(`#3-처리-흐름`)와 `### 3. 요구사항...` 의 slug(`#3-요구사항-cch--prefix`) 는 다르므로 테스트 실패는 아니다. 그러나 "§3" 이라는 단일 단어 참조가 문서 내 두 위치를 가리킬 수 있어 가독성·유지보수 관점의 규약 정신에 어긋난다.
- **제안**: Overview 내부 섹션에 번호를 부여하지 않고 타이틀만 사용 (`### 개요`, `### 사용 시나리오`, `### 요구사항 (CCH-* prefix)`)하거나, 본문 최상위 섹션 번호를 Overview 하위 섹션 번호가 끝나는 번호 이후로 시작 (`## 4. 처리 흐름`)하는 방식 중 하나를 선택해 규약화. 이는 이 spec 뿐 아니라 EIA spec 에도 동일하게 적용되어야 한다. 규약 자체가 이 패턴을 명시하지 않으므로 `project-planner/SKILL.md §Spec 문서 구조` 에 번호 충돌 회피 가이드를 추가하는 것이 적절하다.

---

### [INFO] `id` 필드 — 파일 basename `15-chat-channel` 과 `chat-channel` 의 숫자 prefix 불일치 (의도된 패턴)

- **target 위치**: frontmatter `id: chat-channel` (line 2)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "`id:` 파일 basename(확장자 제외) 기반 권장".
- **상세**: 파일명 `15-chat-channel.md` 의 basename(확장자 제외)은 `15-chat-channel` 이지만 `id: chat-channel` 은 숫자 prefix 를 제거한 형태다. convention 은 "기반 권장"이며 같은 basename 이 영역을 달리해 중복될 때 영역 prefix 로 회피하라는 부연 설명만 있다. 숫자 prefix 제거에 대한 명시적 예외 조항은 없다. 실제 테스트(`spec-frontmatter.test.ts`)는 `id:` 가 존재하면 통과하므로 빌드 실패는 없으나 "basename 기반" 권장을 완전히 따르지 않는다.
- **제안**: `spec-impl-evidence.md §2.1` 에 "숫자 prefix(`N-`) 는 `id:` 에서 제거해도 됨" 을 명시적으로 추가하면 모호성 해소. 변경 없이 현 상태 유지도 허용 범위 내.

---

### [INFO] `UNKNOWN_PLACEHOLDER` — `details[].code` 하위 코드 위치 설명이 spec 에만 존재, 규약 파일 미등재

- **target 위치**: Rationale R-CC-15 (c) (line 667)
  ```
  미허용 placeholder ... 400 VALIDATION_ERROR (details.field='languageHints.executionFailed*', code='UNKNOWN_PLACEHOLDER')
  ```
- **위반 규약**: `spec/conventions/error-codes.md §1` — 프로젝트 전체 에러 코드 문자열에 의미 기반 명명 적용.
- **상세**: `UNKNOWN_PLACEHOLDER` 는 `VALIDATION_ERROR` 의 `details[].code` 하위 세부 코드로 정의된다고 Rationale 에 설명되어 있다. 그러나 `3-error-handling.md §1.3` 의 시스템 공용 코드 카탈로그나 `error-codes.md` 에 미등재 상태다. 클라이언트가 이 값을 분기에 활용해야 하는지, 아니면 debug 전용인지 명확하지 않다.
- **제안**: `3-error-handling.md §1.3` 또는 `2-api-convention.md §5.3` 에 `details[].code` 하위 코드 정의 섹션을 두거나, `UNKNOWN_PLACEHOLDER` 를 해당 섹션에 등재. 혹은 본 spec Rationale 에 "client-facing 분기 코드가 아닌 debug-only 코드" 임을 명시하면 최소 INFO 로 완화됨.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 전반적으로 frontmatter 스키마(`id`/`status`/`code`/`pending_plans`) 준수, 3섹션 구조(Overview / 본문 / Rationale) 채택, secret-store URI scheme 정합, API 응답 envelope 형식 준수 등 정식 규약의 핵심 항목을 잘 따르고 있다. 그러나 **`WORKSPACE_REQUIRED` 에러 코드가 정식 카탈로그 외부에서 발행되어 기존 `WORKSPACE_ID_REQUIRED` 와 의미 중복 분기를 형성하는 CRITICAL 위반**이 있다. 아울러 `INVALID_BOT_TOKEN` 의 명명 역순, Overview 내부와 본문 최상위 간 섹션 번호 충돌, `UNKNOWN_PLACEHOLDER` 의 규약 미등재가 WARNING/INFO 수준으로 발견됐다.

## 위험도

**MEDIUM** — CRITICAL 발견사항 1건(`WORKSPACE_REQUIRED` 미정의 코드 발행)이 클라이언트·가이드 문서에 이미 노출되어 breaking change 없이 수정하려면 규약 갱신이 동반되어야 한다. 나머지 항목은 정합성·가독성 개선 사안으로 채택 차단 수준은 아니다.
