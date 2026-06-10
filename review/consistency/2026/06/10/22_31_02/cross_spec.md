# Cross-Spec 일관성 검토 결과

검토 모드: impl-done (scope: `spec/5-system/`, diff-base: origin/main)
검토 대상 변경: `spec/5-system/1-auth.md` (diff 2건)

---

## 발견사항

### [INFO] Rate Limit 값 확정 — data-flow §1.2 와 완전 일치
- **target 위치**: `spec/5-system/1-auth.md` §1.5.1 표 "Rate Limit" 행
- **충돌 대상**: `spec/data-flow/12-workspace.md` §1.2 멤버 초대 발급 (line 71), §1.8 초대 재발송 (line 162)
- **상세**: 기존 "워크스페이스·invited_by 단위 분당 N회 (구현 시 결정)" 에서 "분당 10건 (`INVITATION_THROTTLE`, `workspaces.controller.ts` — invite·resend 엔드포인트 공통)" 으로 갱신됐다. data-flow/12-workspace.md §1.2 와 §1.8 이 이미 동일한 값("분당 10건, `INVITATION_THROTTLE`")을 기술하고 있으므로 세 영역이 일치한다.
- **제안**: 충돌 없음. 동기화 완료 상태.

### [INFO] Rationale §1.5.D (초대 토큰 raw 저장) — 기존 data-flow 와 모순 없음
- **target 위치**: `spec/5-system/1-auth.md` §Rationale 1.5.D (신규 추가)
- **충돌 대상**: `spec/data-flow/12-workspace.md` §2.1 Schema 매핑 (line 193), §1.2~§1.4 흐름
- **상세**: 새 Rationale 은 `WorkspaceInvitation.token` 이 SHA-256 해시가 아닌 raw 값으로 저장됨을 공식화한다. data-flow/12-workspace.md 의 시퀀스 다이어그램(line 62, 64)과 Schema 매핑(line 193)이 모두 `token` 컬럼을 raw 값으로 INSERT/UPDATE/SELECT 하고 있어 모순이 없다. `spec/1-data-model.md` 에는 `workspace_invitation` 엔티티가 별도 정의되지 않으므로 데이터 모델 충돌도 없다.
- **제안**: 충돌 없음. data-flow/12-workspace.md Rationale 절("workspace_invitation.email 일치 강제", line 262 이하)에 토큰 저장 방식을 보완하는 메모를 선택적으로 추가할 수 있으나 필수는 아니다.

### [INFO] Rationale §1.5.D — spec/1-data-model.md 에 WorkspaceInvitation 엔티티 미정의
- **target 위치**: `spec/5-system/1-auth.md` §Rationale 1.5.D (`WorkspaceInvitation.token`, raw 저장 언급)
- **충돌 대상**: `spec/1-data-model.md` (WorkspaceInvitation 엔티티 항목 없음)
- **상세**: `1-auth.md` §1.5.1 의 "저장 형태" 행과 새 §1.5.D 가 `WorkspaceInvitation.token` 필드를 언급하지만, `spec/1-data-model.md` 에는 이 엔티티가 정의되지 않았다 (WorkspaceMember §2.3 만 정의됨). 실질적 SoT 는 `data-flow/12-workspace.md` §2.1 Schema 매핑이며, 현재 구조가 그렇게 운영된다. 신규 추가인 §1.5.D 가 직접 모순을 만드는 것은 아니나 엔티티 정의의 공백을 cross-reference 가 보완하는 상태다.
- **제안**: 충돌 없음. 향후 `spec/1-data-model.md` 에 `workspace_invitation` 엔티티 항목을 추가하면 일관성이 높아지나 현재 diff 범위 내 blocking 사항은 아니다.

---

## 요약

이번 diff 는 `spec/5-system/1-auth.md` 의 두 가지 변경으로만 구성된다. (1) 초대 Rate Limit 값을 "N회 (구현 시 결정)" 에서 "분당 10건 (`INVITATION_THROTTLE`)" 으로 확정한 것은 `data-flow/12-workspace.md §1.2·§1.8` 의 기존 기술과 완전히 일치하여 cross-spec 모순이 없다. (2) 신규 추가된 Rationale §1.5.D (초대 토큰 raw 저장 근거) 는 data-flow/12-workspace.md 의 시퀀스·Schema 매핑과 일관되며, `spec/1-data-model.md` 에 WorkspaceInvitation 엔티티가 별도 정의되지 않은 공백이 있지만 이는 diff 이전부터 존재하던 구조상 특성이고 신규 충돌이 아니다. 전체적으로 이번 변경은 기존 spec 과의 직접 모순 없이 기술 내용을 명확화·공식화하는 수준이다.

---

## 위험도

NONE
