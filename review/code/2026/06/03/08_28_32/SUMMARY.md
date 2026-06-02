# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 리팩토링(헬퍼 추출 + 방어 테스트 추가) + spec 문서화. Critical 없음. Warning 2건(plan 파일 처리 + 이벤트 레이어 테스트 갭, 기능 동작 영향 없음).

## Critical 발견사항
없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W-1 | 테스트 | 이벤트 레이어(`handleUserMessage` 경로)에서 `receivedAt=""` + optimisticPending 조합 통합 테스트 누락 (store 레벨만 존재) | `use-execution-events.test.ts` `handleUserMessage` 섹션 | `receivedAt:""` 케이스 1건 추가 — legacy backend 빈 receivedAt 시 기존 optimisticPending 버블 reconcile |
| W-2 | 문서/plan | `plan/in-progress/spec-draft-conversation-reconcile-doc.md` 가 Phase A 완료 후에도 in-progress 잔류 | 동 파일 | 완료 이동 시 함께 `plan/complete/archive/` 이동 또는 삭제 |

## 참고 (INFO) — 채택
- I-1: `plan/complete/fix-duplicate-user-bubble.md` frontmatter `status: in-progress` → `complete`
- I-6: 테스트 팩토리 `u` → 명확한 이름 (낮은 우선순위)
- I-2: `findReconcilableOptimisticIdx` `content=""` 엣지 케이스 (낮은 우선순위)
- I-4/I-5/I-9: 보안 open item (raw payload 미마스킹 / content·reason UI 노출) — 기존부터 존재, spec open item 으로 기록됨. 본 PR 신규 취약점 없음

## 에이전트별 위험도 요약
| 에이전트 | 위험도 |
|----------|--------|
| security | LOW |
| requirement | LOW |
| scope | NONE |
| side_effect | NONE |
| maintainability | LOW |
| testing | LOW |
| documentation | LOW |
| user_guide_sync | NONE |

## 라우터 결정
실행(forced): security, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync (8).
제외: performance, architecture, dependency, database, concurrency, api_contract (6) — 순수 store 리팩토링이라 무관.
