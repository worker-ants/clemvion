## 발견사항

### [WARNING] `workspaceRole` prop 정의되었으나 미사용
- **위치**: `settings/page.tsx` — `DangerZoneTabProps` 인터페이스 및 컴포넌트 구현부
- **상세**: 인터페이스에 `workspaceRole: WorkspaceRole`이 선언되어 있지만, 함수 구현 destructuring에서 제외됨. 사용되지 않는 dead prop.
- **제안**: 인터페이스에서 제거하거나, `canLeave` 계산에 활용하도록 수정

---

### [WARNING] `addMember` → `invite` 행동 변경 (미언급 scope 변경)
- **위치**: `settings/page.tsx` — `MembersTab` 컴포넌트
- **상세**: 기존 `addMemberMutation`(즉시 멤버 추가)이 `inviteMutation`(이메일 초대 발송)으로 교체됨. API 동작이 달라지는 행동 변경인데 변경 범위 설명 없이 함께 포함됨. 기존 `addMember` API 엔드포인트는 backend에 그대로 존재하지만 frontend에서 더 이상 노출되지 않음.
- **제안**: 이 변경이 의도된 것이라면 별도 커밋으로 분리하거나 PR 설명에 명시 필요

---

### [WARNING] `roleLabelKey` 함수 중복 정의
- **위치**: `settings/page.tsx:53`, `sidebar.tsx:42`
- **상세**: 동일한 `roleLabelKey` 함수가 두 파일에 각각 정의됨. 이번 변경에서 두 파일 모두 수정했으므로 공통 유틸로 추출할 기회가 있었음.
- **제안**: `frontend/src/lib/utils/workspace.ts` 또는 `workspace-store` 근방에 공유 유틸로 추출. 단, 현재 scope를 벗어나므로 follow-up 이슈로 등록 권장

---

### [INFO] `providers.tsx` 워크스페이스 전환 toast — scope 외 기능 추가
- **위치**: `providers.tsx:50-54`
- **상세**: 워크스페이스 전환 시 toast 알림 추가. rename/delete/leave 핵심 기능과 직접 관련 없는 UX 개선이 함께 포함됨. 기능 자체는 무해하나 본 변경 목적과 다른 관심사.
- **제안**: 작은 변경이므로 수용 가능하나, 커밋 메시지에 명시하거나 별도 커밋으로 분리 고려

---

### [INFO] `cn()` 불필요한 사용
- **위치**: `settings/page.tsx` — `DangerZoneTab` 내 delete card
- **상세**: `cn("border-[hsl(var(--destructive))]/40")` — 조건 없이 단일 문자열만 전달. `cn` 유틸 없이 직접 `className` 문자열로 써도 동일.
- **제안**: `className="border-[hsl(var(--destructive))]/40"` 로 직접 전달

---

### [INFO] 사이드바 워크스페이스 버튼 시각 디자인 전면 개편
- **위치**: `sidebar.tsx:444-494`
- **상세**: 기존의 단순 `Building2` 아이콘 + 이름 버튼이 type·role 서브라벨 + `ChevronsUpDown` 아이콘 포함 카드형 버튼으로 전면 교체됨. 핵심 기능 추가(워크스페이스 그룹핑, create dialog)와 시각 디자인 변경이 함께 묶임.
- **제안**: 기능상 문제는 없으나 시각 변경은 디자인 리뷰 대상

---

## 요약

변경 범위의 핵심(워크스페이스 이름 변경·삭제·나가기의 backend 구현 및 frontend 노출)은 명확히 구현되어 있으며 관련 테스트와 i18n도 함께 포함되어 있어 완결성이 높다. 다만 `addMember → invite` 행동 변경, providers.tsx의 toast 추가, sidebar 버튼의 시각 디자인 전면 개편 등 핵심 목적과 직접 관련 없는 변경들이 섞여 있어 단일 PR의 응집도를 낮춘다. `workspaceRole` unused prop은 소규모 버그이므로 수정이 필요하다.

## 위험도

**LOW**