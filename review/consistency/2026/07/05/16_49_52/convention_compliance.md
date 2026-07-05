# 정식 규약 준수 검토 — convention_compliance

검토 모드: --impl-done (구현 완료 후), scope=`spec/2-navigation/`, diff-base=`origin/main`

## 배경

본 turn 의 실제 코드 변경은 V-05(`plan/in-progress/spec-code-cross-audit-2026-06-10.md`)의 code-impl 채택안 구현이다 — 실행 상세 페이지(`codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx`)의 `NodeResultsTab` 이 자체 구현하던 서브탭(Preview/Input/Output/Error, `JsonViewer`, 수동 `detailTabs` 배열, 개별 waiting 핸들러)을 걷어내고 에디터 run-results 의 공용 `ResultDetail` 컴포넌트(`codebase/frontend/src/components/editor/run-results/result-detail.tsx`)를 재사용하도록 리팩터했다. 백엔드 변경 없음, 신규 API·DTO·에러 코드 없음. `spec/2-navigation/14-execution-history.md` 자체는 이번 diff 에 포함되지 않았다(이미 이 구현 방향을 선반영한 상태로 존재).

## 발견사항

- **[INFO]** `ResultDetail` 재사용이 기존 WS 이벤트/전송 계약을 그대로 승계 — 규약 위반 없음
  - target 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` (diff), `spec/2-navigation/14-execution-history.md` §3.3/§3.4
  - 위반 규약: 해당 없음 (준수 확인 항목)
  - 상세: 리팩터 후에도 `execution.submit_form` / `execution.click_button` / `execution.end_conversation` / `execution.submit_message` WebSocket 이벤트명·payload shape 는 그대로 유지된다(`execution-detail-waiting.test.tsx` 로 회귀 검증). 신규 명명 규약 대상(에러 코드·audit action·API endpoint)이 도입되지 않았으므로 `spec/conventions/error-codes.md`·`audit-actions.md`·`swagger.md` 어느 것도 저촉하지 않는다.
  - 제안: 없음 (정보성 확인).

- **[INFO]** `ResultDetail` props 명명이 프로젝트 컨벤션(camelCase prop, PascalCase 컴포넌트)과 일치
  - target 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:829-888` (`ResultDetailProps`, `onFormSubmit`/`onAiRenderFormSubmit`/`onSelectConversationItem` 등)
  - 위반 규약: 명명 규약 일반 원칙 (conventions 문서에 별도 성문화된 프론트엔드 prop 명명 규칙은 없으나 CLAUDE.md·기존 코드 패턴과 일관)
  - 상세: `spec/2-navigation/14-execution-history.md` §3.3/§3.4.2 가 서술하는 탭 개념(Preview/Input/Output/Config/LLM Usage/Response/Request/Error)과 컴포넌트 내부 핸들러 명명이 자연스럽게 대응되어 문서-코드 간 용어 불일치가 없다.
  - 제안: 없음.

- **[INFO]** `spec/2-navigation/14-execution-history.md` 문서 구조는 Overview/본문/Rationale 3섹션 컨벤션 준수
  - target 위치: `spec/2-navigation/14-execution-history.md` `## Overview (제품 정의)` → `## 1~7` 본문 → `## Rationale`
  - 위반 규약: 해당 없음 (CLAUDE.md "정보 저장 위치" 표 / 각 SKILL.md 의 3섹션 구성 권장)
  - 상세: frontmatter(`id`/`status`/`code`)·`## Overview (제품 정의)`(배경/목표/요구사항 ID 테이블)·본문 §1~7·`## Rationale`(R-1~R-4) 구성이 다른 `spec/2-navigation/*.md` 문서들과 일관되게 유지되고 있다. 이번 diff 로 이 구조가 변경되지 않았다.
  - 제안: 없음.

- **[INFO]** Swagger/DTO 관련 신규 표면 없음
  - target 위치: 전체 diff (`git diff origin/main --stat`)
  - 위반 규약: `spec/conventions/swagger.md`
  - 상세: 코드 diff 는 `codebase/backend/**` 를 전혀 건드리지 않아(diff --stat 확인) 신규 컨트롤러/DTO/decorator 표면이 없다. `spec/conventions/swagger.md` §2-4/§5 의 응답 래퍼·에러 응답 데코레이터 규칙과 무관한 순수 프론트엔드 리팩터다.
  - 제안: 없음.

## 요약

이번 target 범위(V-05 구현 — 실행 상세 페이지 노드 서브탭을 에디터 `ResultDetail` 컴포넌트로 통합)는 신규 API endpoint·DTO·에러 코드·audit action 등 정식 규약이 규율하는 명명·출력 포맷 표면을 전혀 새로 만들지 않는 순수 프론트엔드 컴포넌트 재사용 리팩터다. 기존 WebSocket 이벤트 계약(`execution.submit_form` 등)은 그대로 유지되며 회귀 테스트로 검증됐고, 대상 spec 문서(`spec/2-navigation/14-execution-history.md`)의 Overview/본문/Rationale 3섹션 구조도 이번 변경으로 훼손되지 않았다. `spec/conventions/**` 어느 항목(명명 규약, 출력 포맷, 문서 구조, API 문서, 금지 항목)에도 직접 저촉하는 지점을 발견하지 못했다.

## 위험도
NONE
