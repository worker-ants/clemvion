# 변경 범위(Scope) 리뷰 — entity-schema-declaration-drift

## 발견사항

- **[WARNING]** 서로 다른 두 단위 작업(backend 엔티티 DB drift 정정 vs frontend i18n spec 표 정정)이 한 브랜치에 번들
  - 위치: `spec/3-workflow-editor/4-ai-assistant.md` (커밋 `ff530fc8a`) + `plan/complete/spec-draft-assistant-i18n-table-sync.md` (신규 파일 전체)
  - 상세: 이 plan(`plan/in-progress/entity-schema-declaration-drift.md`)의 선언 의도는 "엔티티의 인덱스·제약 선언이 실제 DB 와 다른 여덟 곳 정정"(`spec_impact: none`)이다. 그런데 브랜치 diff(`git log origin/main..HEAD`)의 첫 커밋은 그것과 무관한 §13 i18n 키 표(AI 어시스턴트 divider 문구·보간 문법·"엣지"→"연결선"·`autoResumedHintShort` 신규 키 추가)를 고친다. 원인은 추적 가능하다 — `--impl-prep spec/3-workflow-editor/` 게이트가 (건드리는 엔티티가 그 spec 의 `code:` glob 에 걸려) 이 작업과 무관한 기존 Critical(글로서리 금지어)을 만나 BLOCK:YES 를 냈고, CLAUDE.md 의 "developer 는 멈추고 planner 위임" 규약대로 같은 worktree 안에서 planner 턴이 그 표 전체(13행 + divider 서술 4곳 + 키 1개 신설)를 고쳐 게이트를 풀었다. 이 절차 자체는 프로젝트 규약이 명시적으로 요구하는 정상 경로이고 Rationale·근거가 plan 문서에 충실히 남아 있어 은폐된 변경은 아니다. 다만 결과적으로 "엔티티 인덱스/제약 정정" 이라는 표제 아래 완전히 다른 도메인(UI 문자열·i18n 사전 동기화)의 spec 변경 36줄 + 관련 plan/consistency 산출물 약 1,700줄이 같은 diff 에 실려, 이 리뷰 세션이 두 개의 무관한 스토리를 동시에 판정해야 했다.
  - 제안: 절차상 필요했던 정정이므로 되돌릴 필요는 없으나, 향후에는 impl-prep 게이트가 "이 작업과 무관한" Critical 을 만났을 때 그 spec 정정을 별도 브랜치/PR 로 먼저 병합해 entity 작업 브랜치를 그 위에 rebase 하는 방식을 고려할 것 — 리뷰·머지 단위가 더 명확해진다.

- **[INFO]** naming_collision 체커 스스로 이 게이트 스코프가 실제 작업 도메인과 무관하다고 지적함(자기 확인)
  - 위치: `review/consistency/2026/09/19/08_07_50/naming_collision.md` "impl-prep 스코프와 실제 작업 도메인 불일치" 항목, `plan/in-progress/entity-schema-declaration-drift.md` 체크리스트 `--impl-prep spec/3-workflow-editor/`
  - 상세: 체커가 "다른 plan 템플릿에서 복사된 체크리스트 항목으로 보인다"고 INFO 로 남겼다. 위 WARNING 의 근본 원인과 같은 관찰이라 별도 조치는 불필요하지만, scope 리뷰 관점에서 "왜 무관한 spec 영역이 게이트에 걸렸는가"의 근거로 인용해 둔다.
  - 제안: 조치 불요(이미 plan 에 기록됨).

## 범위 안 확인 — 문제 없음

- `codebase/backend/src/modules/{edges,integrations,node-executions,nodes,workflow-assistant,workspaces}/entities/*.entity.ts` 6개 파일의 diff는 plan 표의 발견 #1~#8 과 1:1 대응하며, 각 파일에 그 항목 외 추가 수정(포맷팅·무관한 리팩토링·주석 잡음)이 없다. `node.entity.ts` 에서 `@Index` 제거에 맞춰 미사용 `Index` import 도 함께 제거됐다 — 정확히 필요한 정리만.
- 신규 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts`(441줄)는 plan 의 "회귀 방지 — e2e 가드" 절이 명시한 목적(엔티티 메타데이터 ↔ DB 카탈로그 대조, 트랜잭션 내 임시 테이블로 부분조건/CHECK 정규화 비교)만 구현하며 그 밖의 기능은 없다. 후속 리팩토링 커밋(`6e18aa4d8`)도 이 파일 하나만 건드리며 판정 로직·문구는 그대로 두고 헬퍼 추출만 했다(이전 ai-review W1·W2 대응, 범위 안).
- config 파일 변경 없음. `spec/3-workflow-editor/4-ai-assistant.md` diff는 plan/complete 문서가 표로 미리 선언한 13행 + 신규 키 1개 + divider 서술 4곳과 정확히 일치하며 그 이상의 임의 수정은 없다.
- `review/consistency/2026/09/19/{08_07_50,08_23_02,08_33_13}/**` 와 `plan/**` 파일들은 코드가 아니라 CLAUDE.md 가 규정한 게이트 실행 증적(트리거된 순서: impl-prep→BLOCK:YES→planner 턴→--spec 검증→2차 impl-prep→BLOCK:NO)이며, 이 프로젝트 관례상 커밋되는 산출물이다.

## 요약
핵심 코드 변경(entity 6개 파일 + 신규 e2e 가드 + 그 리팩토링)은 plan 이 선언한 "여덟 곳 정정 + 회귀 가드"에 정확히 부합하며 포맷팅·불필요한 리팩토링·기능 확장·주석/임포트 잡음이 없다. 다만 브랜치 전체 diff 에는 절차상(impl-prep 게이트 BLOCK 해소) 필요했던 완전히 다른 도메인의 spec i18n 표 정정(`4-ai-assistant.md`, 커밋 `ff530fc8a`)이 함께 실려 있다 — 근거는 충실히 문서화돼 있고 프로젝트 규약이 요구하는 정상 경로이지만, "엔티티 인덱스 drift 정정"이라는 하나의 표제 아래 두 개의 독립적인 작업 단위가 섞여 있다는 점은 스코프 관점에서 명시적으로 짚어 둘 필요가 있다.

## 위험도
LOW
