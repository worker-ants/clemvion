# Rationale 연속성 검토 결과

**검토 대상**: `plan/in-progress/spec-draft-nav-spec-cleanup.md` (반영 대상: `spec/0-overview.md`, `spec/2-navigation/11-error-empty-states.md`, `spec/2-navigation/14-execution-history.md`, `spec/2-navigation/_product-overview.md`)
**검토 모드**: spec draft 검토 (--spec)

---

## 발견사항

- **[WARNING]** `conversation-thread.md` 의 EH-DETAIL-12 델리게이션 링크가 이관 후에도 구 위치(`14-execution-history.md`)를 계속 가리킴 — target 의 "bare ID 라 불변" 검증이 이 한 건을 놓침
  - target 위치: `spec-draft-nav-spec-cleanup.md` §2 두 번째 불릿 "cross-ref 무손상 확인" 문장 — "(1-ai-agent·conversation-thread·data-hydration-surfaces 의 EH-DETAIL-12 언급은 링크가 아닌 bare ID 라 불변.)"
  - 과거 결정 출처: `spec/2-navigation/14-execution-history.md` `## Rationale` R-6 — "`conversation-thread.md` 는 '§EH-DETAIL-06 의 재구성 정책에 위임' 한다고 했으나 그 정책이 어디에도 정의돼 있지 않아 **dangling 위임**이었다" (EH-DETAIL-12 신설로 이 문제를 해소했다는 것이 R-6 의 존재 이유)
  - 상세: `spec/conventions/conversation-thread.md` §9.3 표(현재 파일 기준 417번째 줄)에 `[Spec Execution History §EH-DETAIL-12](../2-navigation/14-execution-history.md)` 라는 **실제 markdown 링크**(앵커 없이 파일 전체를 가리킴)가 존재한다. 같은 문서의 다른 4곳(§4 영속화 표 근방·기각 대안·v2 로드맵 서술)은 target 의 주장대로 링크 없는 bare ID 텍스트이지만, 이 한 곳만 링크다. EH-DETAIL-12 의 실제 정의(요구사항 매트릭스 행)는 이번 변경으로 `14-execution-history.md` 에서 `_product-overview.md#315-execution-history-실행-내역` 로 이동했으므로, 이 링크는 이제 "정의가 없는 파일"을 가리키는 셈이다 — R-6 이 명명한 것과 정확히 같은 종류의 dangling 위임 패턴이 재도입된다. `14-execution-history.md` 자체는 삭제되지 않았고 그 문서의 R-6 이 `_product-overview.md §3.15` 로 우회 안내하므로 완전한 단절은 아니지만("파일은 살아있고 R-6 까지 읽으면 도달 가능"), 링크 레이블("§EH-DETAIL-12")이 가리키는 앵커가 대상 파일에 더는 존재하지 않는다는 점에서 R-6 이 막고자 했던 정밀성 원칙에는 못 미친다.
  - 제안: `spec/conventions/conversation-thread.md` §9.3 표의 해당 링크를 `[Spec Execution History §EH-DETAIL-12](../2-navigation/_product-overview.md#315-execution-history-실행-내역)` 로 갱신하거나(정의가 실제로 있는 곳), 최소한 target 문서의 "bare ID 라 불변" 서술에서 이 예외를 인정하고 별도 후속 처리로 명시.

## 요약

target 의 핵심 변경(11-error-empty-states 의 evidence/인용 정밀화, 14-execution-history 의 Overview→`_product-overview.md §3.15` 이관)은 기존 Rationale 을 뒤집거나 기각된 대안을 재도입하지 않는다. 오히려 project-planner SKILL 의 "다중 spec 파일을 가진 영역은 `_product-overview.md` 로 Overview 를 둔다" 는 합의된 컨벤션에 그동안 유일하게 어긋나 있던 `14-execution-history.md` 를 형제 문서(0-dashboard·1-workflow-list·10-auth-flow·11-error·15-system-status 등, 실제로 전수 확인 결과 전부 자체 Overview 없음)와 정합시키는 정정이며, 2026-06-11(#540) 당시 이 문서의 Overview 유지는 "번호 체계 중복 해소"라는 별개 목적의 결정이었을 뿐 `_product-overview.md` 이관을 검토 후 기각한 기록은 없다 — 따라서 이번 이관은 과거 명시적 결정의 번복이 아니다. R-6 rationale 의 자기참조 갱신·`0-overview.md` §4/§6.3 정리도 파급 정합성 확보 조치로서 타당하다. 다만 target 이 스스로 검증했다고 선언한 "EH-DETAIL-12 참조는 전부 bare ID" 주장이 `conversation-thread.md` §9.3 표의 실제 markdown 링크 1건과 어긋나며, 이는 정확히 R-6 이 과거에 고치려 했던 "정의 없는 곳을 가리키는 위임" 패턴을 소규모로 재현한다. 이 한 건을 제외하면 Rationale 연속성 관점에서 위험 요소는 없다.

## 위험도
LOW
