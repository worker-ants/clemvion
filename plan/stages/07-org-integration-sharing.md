# Stage 7 · 조직 레벨 Integration 공유

## 배경

`NAV-IN-07` — 팀 워크스페이스에서 Integration을 조직 레벨에서 공유. Stage 4/5 완료 후 진행.

## 설계

### 범위

- Integration은 워크스페이스에 1:1 소속. 이미 `workspace_id`가 있다면 OK.
- 팀 워크스페이스에 생성된 Integration은 해당 워크스페이스의 모든 멤버가 **역할 정책**에 따라 사용 가능.
- **작성/수정/삭제는 Admin+**, **사용(노드에서 선택)은 Editor+**, **조회만은 Viewer**.

### 영향받는 파일

- 수정: `backend/src/modules/integrations/**` — 목록 쿼리에 현재 workspace 필터, Role 가드 적용
- 수정: `frontend/src/app/(main)/integrations/**` — 현재 워크스페이스 컨텍스트로 쿼리, Role 가드로 버튼 노출 제어
- 수정: PRD `NAV-IN-07` → ✅
- 수정: `frontend/src/content/docs/05-integrations-and-config/integration-management.mdx` 팀 공유 섹션 추가

### 테스트

- Admin 초대받지 않은 사용자가 타 워크스페이스 Integration을 조회·사용할 수 없는지

### 검증

- 팀 워크스페이스 A와 B가 같은 프로바이더 Integration을 독립적으로 가짐
- 동일 워크스페이스 내 Editor/Viewer가 의도대로 UI를 본다
