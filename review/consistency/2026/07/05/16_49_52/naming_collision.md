# 신규 식별자 충돌 검토 — spec/2-navigation/ (--impl-done)

## 검토 범위 확인

payload 는 `spec/2-navigation/` 전체(대시보드·워크플로우 목록·인증·에러/빈 상태·실행 내역·시스템 상태 등) 배경 컨텍스트와 인접 문서(`0-overview.md`, `1-data-model.md`, 여러 `plan/in-progress/*.md`, `spec/conventions/*.md`)를 포함하지만, `git diff origin/main HEAD --stat` 로 실측한 이번 커밋의 실제 변경분은 다음 2개 코드 파일과 1개 plan 문서뿐이다.

- `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` — 우측 "노드 상세" 패널의 로컬 구현(4탭 `preview/input/output/error` 커스텀 상태머신, `JsonViewer`, 개별 waiting 핸들러 8종)을 에디터 공용 컴포넌트 `ResultDetail`(`@/components/editor/run-results/result-detail`) 재사용으로 **교체**.
- `.../executions/__tests__/execution-detail-waiting.test.tsx` — 완결 실행에서 Config/LLM Usage 탭 노출을 검증하는 신규 테스트 2건 추가 (`makeCompletedExecution` 헬퍼).
- `plan/in-progress/spec-code-cross-audit-2026-06-10.md` — V-05 항목에 완료 근거 갱신(체크박스).

`spec/2-navigation/14-execution-history.md` 자체는 이번 커밋에서 변경되지 않았다(§3.3~§3.4.2 는 이전 spec-only 단계에서 이미 확정, 해당 단계 naming_collision 검토 결과는 `review/consistency/2026/07/05/16_27_37/naming_collision.md` — NONE). 이번 impl-done 단계는 그 spec 을 코드로 구현/재사용 정합화하는 순수 리팩터다.

## 신규 식별자 점검

이번 변경으로 코드에 **새로 도입된** 이름은 다음 정도이며, 전부 "새 식별자"가 아니라 "기존 공용 컴포넌트로의 위임"이다.

| 항목 | 신규 여부 | 비고 |
|------|-----------|------|
| `ResultDetail` (import from `@/components/editor/run-results/result-detail`) | 기존 컴포넌트 — 에디터 Run Results 드로어에서 이미 사용 중 | 신규 도입 아님, 재사용. 충돌 없음 |
| `ResultDetail` props(`onSelectConversationItem`, `onAiRenderFormSubmit`, `onConversationEnd` 등) | 기존 컴포넌트의 기존 인터페이스 | page.tsx 는 이 계약에 맞춰 로컬 핸들러(`handleSendMessage` 등)를 제거하고 store selector(`resumeFromForm` 등)를 직결 — 신규 명명 없음 |
| `makeCompletedExecution` (테스트 헬퍼 함수) | 신규, 테스트 파일 로컬 스코프 | export 되지 않고 파일 내부에서만 사용 — 외부 노출·충돌 여지 없음. 기존 `makeWaitingExecution` 과 자연스러운 명명 대구(완결 vs waiting) |
| 제거된 식별자: `DetailTab`, `JsonViewer`, `useExecutionInteractionCommands`(page.tsx 로컬 호출), `handleFormSubmit` 등 | 삭제만 발생, 신규 아님 | 다른 파일에서 같은 이름을 다른 의미로 쓰는지 확인했으나 `JsonViewer` 는 `page.tsx` 로컬 정의였고 전역 사용처 없음(grep 결과 없음) — 삭제로 인한 명칭 해제이지 충돌 유발 아님 |

요구사항 ID(`EH-DETAIL-*`), API endpoint, 이벤트명, ENV var, config key, spec 파일 경로 — 이번 diff 범위 내에서 신규로 도입된 것은 없다. V-05 는 `plan/in-progress/spec-code-cross-audit-2026-06-10.md` 의 기존 추적 ID(스펙 요구사항 ID 아님)이고 이미 그 문서에 §54 부근 정의돼 있어 신규 충돌 대상이 아니다.

## 발견사항

발견 없음 — 이번 impl-done 변경은 신규 식별자를 도입하지 않는 순수 코드 재사용/삭제 리팩터다.

## 요약

이번 커밋(`page.tsx` 리팩터 + 테스트 추가)은 `spec/2-navigation/14-execution-history.md` §3.3/§3.4.2 가 요구하는 서브탭 구성을 로컬 재구현 대신 에디터의 기존 `ResultDetail` 컴포넌트로 위임하도록 바꾼 것으로, 신규 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·spec 파일 경로 중 어느 것도 새로 도입하지 않는다. 유일한 신규 이름인 테스트 헬퍼 `makeCompletedExecution` 은 파일 로컬 스코프라 외부 충돌 가능성이 없다. spec 문서 자체는 이번 diff 에 포함되지 않았고, 그 문서 수준 신규 식별자 충돌은 이전 --impl-prep 단계(`review/consistency/2026/07/05/16_27_37/naming_collision.md`)에서 이미 NONE 으로 검증됐다.

## 위험도

NONE
