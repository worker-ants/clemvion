# 정식 규약 준수 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-conversation-ui-contract.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-19

---

## 발견사항

### [INFO] plan 문서 파일명이 `0-` prefix 패턴 미사용
- **target 위치**: 파일명 `spec-draft-conversation-ui-contract.md`
- **위반 규약**: `CLAUDE.md` §정보 저장 위치 — "제품 정의·요구사항" 은 `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`, 정식 규약은 `spec/conventions/<name>.md`
- **상세**: 본 문서는 spec draft 이며 최종적으로 `spec/conventions/conversation-thread.md` 에 §9.6~§9.A 로 합쳐질 내용을 담고 있다. plan 문서 자체의 파일명은 CLAUDE.md 의 `0-` prefix 규칙 대상이 아니다 (해당 prefix 는 `spec/` 하위 문서에 해당). `plan/in-progress/` 문서는 별도 명명 규칙이 존재하지 않으므로 현재 파일명은 규약 위반이 아니다.
- **제안**: 발견사항 아님 — INFO 해소. 파일명은 적합하다.

### [INFO] Frontmatter 스키마 완전 준수
- **target 위치**: 문서 상단 frontmatter (lines 1-5)
- **위반 규약**: `.claude/docs/plan-lifecycle.md` §4 Frontmatter 스키마
- **상세**: `worktree: spec-conversation-ui-contract`, `started: 2026-05-19`, `owner: project-planner` 세 필드가 모두 존재한다. 스키마와 완전히 일치한다.
- **제안**: 준수 확인.

### [WARNING] 문서 구조 — §6 일관성 검토 결과 미기재
- **target 위치**: `## 6. 일관성 검토 결과` 섹션 (문서 끝에서 두 번째 절)
- **위반 규약**: plan 문서 자체 기술 — "(consistency-check --spec 결과를 여기에 추가)" 라는 플레이스홀더가 그대로 남아있음
- **상세**: 본 문서는 `consistency-check --spec` 의 입력으로 현재 분석 대상이 되고 있으므로, 검토 결과란이 빈 플레이스홀더 상태인 것은 워크플로우상 자연스럽다. 그러나 spec draft 를 확정(commit)하기 전에 본 섹션에 실제 결과를 채워야 한다. 현재 시점에서는 프로세스 미완성이지 규약 위반이 아니다.
- **제안**: 본 검토 결과를 §6 에 기입 후 spec write 진행.

### [INFO] spec/conventions/conversation-thread.md §9 에 대한 cross-reference 스타일
- **target 위치**: 문서 전반 — `§9.6`, `§9.7` 등 절 번호 참조
- **위반 규약**: `spec/conventions/conversation-thread.md` 본문의 기존 절 참조 패턴
- **상세**: 기존 `conversation-thread.md` 는 `§9.1`, `§9.2` 등을 `### 9.1` 스타일 마크다운 heading 으로 표기하고 있다. draft 문서가 `§9.6`, `§9.A` 같이 hexadecimal 스타일 (`A`) 을 사용하는 것은 기존 파일의 헤딩 체계(`### 9.6`)와 일관성 문제를 일으킬 수 있다. 특히 `§9.A` 표기는 기존 파일의 숫자 기반 절 번호 체계와 이질적이다.
- **제안**: `§9.A` → `§9.10` 대신 `§9.11` 또는 알파벳 절 표기를 `spec/conventions/conversation-thread.md` 실제 heading 과 통일. 또는 CHANGELOG 에서 기존 §10 이 이미 사용 중임을 확인하고 알파벳 suffix 를 convention 으로 명시. 어느 쪽이든 `conversation-thread.md` 의 실제 heading 형식과 일치시켜야 한다.

### [CRITICAL] §9.A 절 식별자가 기존 conv-thread.md 절 체계와 충돌 위험
- **target 위치**: `### §9.A — 변환 함수 contract (신설)` 절 제목 및 §2 변경 범위 표
- **위반 규약**: `spec/conventions/conversation-thread.md` §10 CHANGELOG 가 이미 `## 10. CHANGELOG` 로 존재하며 §10 절이 확정된 상태. draft 는 §9.6~§9.10 + §9.A 를 신설한다고 기술하는데, §9.10 이 신설이면서 동시에 §10 CHANGELOG 가 이미 있는 구조는 혼동을 야기한다.
- **상세**: 기존 `conversation-thread.md` 의 최상위 절은 `## 10. CHANGELOG` (숫자 레벨 10). 신설하는 `§9.10` 은 9의 sub-절이므로 충돌은 아니지만, draft §2 표에 "§10 CHANGELOG | 개정" 항목이 있어 최상위 §10 을 가리키는지 신설 §9.10 인지 표기가 불명확하다. 또한 `§9.A` 표기는 기존 파일에서 사용한 적 없는 알파벳 suffix 방식이며, 이를 실제 파일에 적용할 때 heading 레벨과 앵커가 어떻게 생성될지에 대한 명세가 없다.
- **제안**: (1) §2 표의 "§10 CHANGELOG | 개정" 을 "최상위 §10 CHANGELOG" 와 "신설 §9.10 (회귀 차단 시나리오)" 를 명확히 분리 표기. (2) `§9.A` 를 `§9.11` 로 변경하거나, 알파벳 절 표기 방식이 의도적이라면 `conversation-thread.md` 의 절 번호 체계에 해당 방식을 허용한다는 규약을 CHANGELOG 또는 Rationale 에 명시.

### [INFO] §9.7 WS 이벤트 참조 경로 표기
- **target 위치**: `### §9.7 — WS 이벤트 → store 변환 계약` 본문 중 "spec/5-system/6-websocket-protocol.md §4.4"
- **위반 규약**: `spec/conventions/conversation-thread.md` 의 cross-link 스타일 — 기존 본문은 `[WebSocket §4.4.5](../5-system/6-websocket-protocol.md#445-...)` 형식의 마크다운 앵커 링크를 사용
- **상세**: draft 의 §9.7 본문은 "spec/5-system/6-websocket-protocol.md §4.4" 를 평문으로 표기하고 있다. 기존 `conversation-thread.md` 는 모든 외부 spec 참조에 클릭 가능한 마크다운 링크를 사용한다. 실제 spec 파일에 합쳐질 때 동일 스타일로 교체 필요.
- **제안**: 실제 spec write 시 `[WebSocket §4.4](../5-system/6-websocket-protocol.md#44-...)` 형식으로 변환. draft 단계에서는 INFO 수준.

### [INFO] §9.8 타입스크립트 함수 시그니처 표기 스타일
- **target 위치**: `### §9.8 — content blank 동치성` 코드 블록
- **위반 규약**: `spec/conventions/conversation-thread.md` 의 코드 예시 표기 방식 — 기존 본문은 코드 블록을 거의 사용하지 않고 인라인 또는 표로 기술
- **상세**: draft 는 `isAssistantContentBlank` 함수를 `ts` 코드 블록으로 명세한다. 이 방식 자체가 규약 위반은 아니나, 기존 `conversation-thread.md` 문서의 스타일 패턴(인라인 또는 표 중심)과 다소 다르다. 단, 함수 contract 를 코드로 표현하는 것은 명확성 측면에서 정당하며 다른 컨벤션 문서에서도 허용된다(`node-output.md` 등).
- **제안**: 유지. 스타일 선택은 적절하다.

### [INFO] §9.A 표기 내 수학 집합 기호 사용
- **target 위치**: `### §9.A — 변환 함수 contract` 본문의 `threadTurnsToConversationItems(turns) ⊆ messagesToConversationItems(messages)` 표기
- **위반 규약**: `spec/conventions/conversation-thread.md` 의 기존 본문 표기 — 수학 기호를 사용한 표기 방식은 기존 spec 에 선례가 없음
- **상세**: 집합 포함 기호(⊆)는 엄밀한 정의에는 유용하나, 마크다운 렌더러에 따라 표시가 깨질 수 있고 기존 conv-thread.md 의 표 기반 표기와 이질적이다. 의미는 명확하고 정당하므로 CRITICAL/WARNING 은 아니다.
- **제안**: 선택적으로 표 또는 불릿 리스트 형식으로 대체 표기 검토. 예: "threadTurns... 의 결과는 messages... 의 결과의 부분집합이다 (lean thread 케이스 제외 시 동치)."

### [WARNING] §9.10 테스트 경로가 spec 내에 codebase 절대 경로를 직접 명시
- **target 위치**: `### §9.10 — 회귀 차단 시나리오` 표의 "테스트 경로" 컬럼
- **위반 규약**: `CLAUDE.md` §정보 저장 위치 — "기술 명세" 는 `spec/<영역>/*.md` 에, codebase 경로는 구현 영역; `spec/` 은 read-only 이며 codebase 경로는 implementation drift 발생 시 spec 이 틀려질 수 있다
- **상세**: `codebase/frontend/src/lib/conversation/__tests__/conversation-utils.test.ts` 같은 codebase 절대 경로를 spec 내에 직접 박는 것은 리팩터링 시 spec 이 staleness 해지는 패턴이다. 기존 `conversation-thread.md` 의 다른 절들은 codebase 파일 경로를 직접 명시하지 않거나, 상대적으로 안정적인 모듈 이름만 언급한다.
- **제안**: 테스트 경로를 파일 절대경로 대신 모듈/파일명 수준(`conversation-utils.test.ts`) 으로 기술하거나, "별도 테스트 문서" 링크로 위임. 또는 §9.10 자체에 "경로는 구현 단계에서 확정" 이라는 노트를 추가해 spec staleness 위험을 명시.

### [INFO] `## Rationale` 섹션 위치
- **target 위치**: 문서 마지막 절 `## Rationale`
- **위반 규약**: `CLAUDE.md` §정보 저장 위치 — "결정의 배경·근거" 는 "해당 spec 문서 끝의 `## Rationale`"
- **상세**: plan 문서 (spec draft) 에 `## Rationale` 섹션이 문서 마지막에 위치해 있다. CLAUDE.md 권장 구조(Overview / 본문 / Rationale) 와 정합. 내용도 충실하다.
- **제안**: 준수 확인.

---

## 요약

target 문서 `plan/in-progress/spec-draft-conversation-ui-contract.md` 는 대체로 정식 규약을 준수하고 있다. Frontmatter 스키마, 3섹션 구조(배경/본문/Rationale), plan 라이프사이클 규칙은 모두 적합하다. 다만 두 가지 주의 사항이 있다: (1) `§9.A` 알파벳 절 식별자가 기존 `conversation-thread.md` 의 숫자 기반 절 체계와 이질적이며, §2 표에서 "§10 CHANGELOG 개정" 표기가 최상위 `## 10. CHANGELOG` 와 신설 `§9.10` 사이의 혼동을 일으킬 수 있다 — 이는 실제 spec 파일 write 시 invariant 깨짐으로 이어질 수 있어 CRITICAL 로 분류. (2) §9.10 의 codebase 절대 경로 직접 명시는 spec staleness 위험이 있다 — WARNING 수준. 나머지는 INFO 수준의 스타일 일관성 제안이다.

---

## 위험도

**MEDIUM** — CRITICAL 1건(§9.A 절 식별자 체계 혼동)이 존재하나, 이는 실제 spec write 전 해소 가능한 draft 단계 이슈이며 현 시점의 plan 문서 자체가 codebase 에 직접 영향을 주지는 않는다. spec write 착수 전 §9.A → 적합한 번호 변경 + §2 표 명확화가 필요하다.
