# Cross-Spec 일관성 검토 — target: `spec/5-system/` (--impl-prep)

## 검토 방법 메모

target(`spec/5-system/` 17개 문서, 총 11,189줄)과 `spec/**` 전 영역(0-overview·1-data-model·
2-navigation·3-workflow-editor·4-nodes·conventions·data-flow)을 대조했다. 전략: (1) RBAC/권한
매트릭스·데이터 모델 필드·에러 코드·타이밍 상수 등 여러 문서에 반복 등장하는 "숫자·이름"을
grep 으로 교차 대조, (2) target 이 다른 spec 을 가리키는 포인터 링크의 대상 섹션이 실제로
주장과 일치하는지 표본 검증, (3) git log 로 최근 변경분(특히 신규 도입된 하위 spec)을 우선
점검. 표본 검증한 항목(로그인 잠금 5회/10분, 비밀번호 재설정 30분, 초대 토큰 7일, EIA 토큰
갱신 30분, execution active-running 30분, RBAC 역할명 owner/admin/editor/viewer, Auth
Config/Model Config/Knowledge Base 권한 행, 감사 액션 명명, WORKSPACE_ID_REQUIRED·
VALIDATION_ERROR 의미)은 전부 정합했다 — 이 spec 트리는 다회 consistency-check 이력이 있어
전반적으로 성숙도가 높다.

---

## 발견사항

- **[WARNING] Agent Memory 리소스가 §3.2 RBAC 매트릭스에서 누락**
  - target 위치: `spec/5-system/17-agent-memory.md` §6 "메모리 관리 API" (라인 118-123) —
    `GET /agent-memories/scopes`·`GET /agent-memories` = "워크스페이스 멤버(viewer+)",
    `DELETE /agent-memories/:id`·`DELETE /agent-memories?scopeKey=` = "editor+"
  - 충돌 대상: `spec/5-system/1-auth.md` §3.2 "리소스별 권한 매트릭스" (라인 361-389) — Overview
    가 "인가(§3) — 워크스페이스 스코프 RBAC 매트릭스(역할별 권한)"를 이 문서의 단일 진실로
    선언하는 바로 그 표
  - 상세: §3.2 표는 Workspace/멤버/Workflow/Trigger/Schedule/Integration/**Knowledge Base**/
    Auth Config/**Model Config**/Statistics/System Status/Marketplace/Audit Log 를 전부
    행으로 등재해, Agent Memory 와 구조적으로 동형인 다른 admin-surface 성격 리소스
    (Knowledge Base: Owner/Admin=CRUD, Editor=CRUD, Viewer=R)도 예외 없이 포함한다.
    반면 동일하게 workspace-scope·role-gated 인 Agent Memory(viewer 조회 / editor 삭제)는
    이 표에 행이 없다 — `spec/2-navigation/16-agent-memory.md` §2·Rationale 도 같은 viewer+/
    editor+ 권한을 재확인하지만 §3.2 로의 역참조가 없다. 이 클래스의 drift(도메인 spec 의
    실제 권한이 §3.2 표와 어긋나거나 누락)는 이미 한 번 impl-prep 게이트에서 CRITICAL 로 잡혀
    수정된 전례가 있다(`71ce6c12b` — "멤버 관리" 행 Admin 열 CRU→CRUD 정정, 2026-07-28).
    이번 케이스는 값이 틀린 게 아니라 **행 자체가 없는** 변종이라 당장 코드·문서가 서로
    모순되지는 않지만, §3.2 를 유일한 참조점으로 신뢰하는 독자(신규 리소스 추가 시 권한
    설계 참고, 감사·보안 리뷰)는 Agent Memory 의 존재를 놓친다. webhook/replay-rerun/
    chat-channel 등 target 의 다른 도메인은 신규 권한을 도입할 때 기존 매트릭스 행(Trigger
    CRUD, Workflow 실행 Editor+)에 편입시키는 방식으로 §3.2 를 깨지 않았는데, Agent Memory
    만 독립된 신규 권한 축(viewer read / editor delete, create 없음)이라 편입 대상 행이
    없어 예외적으로 빠진 것으로 보인다.
  - 제안: `spec/5-system/1-auth.md` §3.2 표에 `Agent Memory | — | — | D(scope) | R` 형태의
    행(또는 create/update 가 없다는 각주)을 추가하고, `17-agent-memory.md` §6 에서 §3.2 를
    역참조. 두 문서가 이미 값 자체는 일치하므로 수정 비용은 표 1행 + 상호 링크 수준으로 작다.

- **[INFO] `spec/conventions/swagger.md` §5-4 "@Roles() 전제"는 최근 정정 완료 — 재점검 불필요**
  - target 위치: 해당 없음(정보 제공용)
  - 충돌 대상: `spec/conventions/swagger.md` §5-4 vs `RolesGuard`(`@WorkspaceId()` 소비 라우트
    전원 멤버십 강제)
  - 상세: 이전 impl-prep/impl-done 라운드(`plan/in-progress/spec-fix-swagger-forbidden-response.md`)
    에서 이미 "구현이 `@Roles()` 유무와 무관하게 403 을 낼 수 있다"는 사실에 맞춰 §5-4 규약
    문구를 확장 반영했다(2026-08-08, `--consistency-check --spec` BLOCK:NO 후 병합). target
    (`spec/5-system/1-auth.md` §3.3)과 현재 모순 없음 — 향후 라운드가 동일 항목을 다시
    Critical/Warning 으로 재기입하지 않도록 참고용으로만 남긴다.

---

## 요약

`spec/5-system/`은 이미 다회의 consistency-check·spec-sync 라운드를 거쳐 데이터 모델·RBAC
역할명·타이밍 상수·에러 코드·감사 액션 명명이 `spec/1-data-model.md`·`spec/2-navigation/**`·
`spec/data-flow/**`·`spec/conventions/**`와 표본 검증한 범위 내에서 정합했다. 유일하게 실질적인
갭은 `17-agent-memory.md`가 도입한 Agent Memory 관리 API 의 viewer+/editor+ 권한이 `1-auth.md`
§3.2 의 단일 RBAC 매트릭스에 행으로 반영되지 않은 것으로, 같은 클래스의 drift 가 과거 실제
impl-prep 게이트에서 CRITICAL 로 처리된 전례가 있어 WARNING 으로 등재한다. 그 외 광범위하게
점검한 API 계약·상태 전이·계층 책임 축에서는 모순을 발견하지 못했다.

## 위험도

LOW
