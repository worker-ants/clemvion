# Rationale 연속성 검토 — avatar-upload-public-url

## 발견사항

- **[CRITICAL] 아바타 S3 키의 `workspaceId` prefix 생략이 `0-overview.md` Rationale 의 명시적 원칙(§2.7)과 직접 충돌**
  - target 위치: `codebase/backend/src/modules/users/users.service.ts` (`avatarKeyPrefix` / `updateAvatar` — 실제 키를 `avatars/${userId}/${uuid}.${ext}` 로 생성, `workspaceId` 없음) · `codebase/backend/.env.example` (`S3_PUBLIC_BASE_URL` 주석: *"실제 키 형태: `avatars/{userId}/{uuid}.{ext}` (workspaceId 없음 — User 는 워크스페이스 종속 리소스가 아니다)"*)
  - 과거 결정 출처: `spec/0-overview.md` `## Rationale` → `### S3 객체 키 prefix 설계 — KB 원본 키에서 workspaceId 제외 (§2.7)` (:369-373) — *"멀티 테넌트 환경에서 S3 키를 `{workspaceId}/...` 로 prefix 하는 것이 일반적 패턴이다 … **Form/Avatar 영역은 §2.7 의 키 구조와 같이 이 패턴을 따른다**"*, *"**Knowledge Base 원본 문서 키만** `kb/{kbId}/{documentId}/...` 로 두고 workspaceId 를 prefix 에서 제외한다"*. 같은 원칙이 §2.7 본문(:257-278, 버킷 구조 트리 + 표 `Form 노드 업로드 / Avatar | {workspaceId}/forms/..., {workspaceId}/avatars/...`)과 `spec/data-flow/4-file-storage.md` §1.2(:55-59)·§2.1(:67-71, `<workspaceId>/avatars/<userId>.<ext>`)에도 중복 서술돼 있다.
  - 상세: 현재 spec 은 "workspaceId prefix = 일반 원칙, KB 만이 유일한 예외" 라고 **명시적으로** 규정한다. 이번 구현은 그 "유일한 예외" 목록에 없던 Avatar 를 또 하나의 예외로 만들면서, 그 근거("User 는 워크스페이스 종속 리소스가 아니다" — 한 사용자가 여러 워크스페이스에 속할 수 있으므로 워크스페이스별로 아바타를 나눌 수 없다)를 코드 주석에만 남기고 spec 의 Rationale 텍스트는 그대로 두었다. 그 결과 HEAD 시점에 `0-overview.md` 를 읽는 사람은 "Avatar 는 `{workspaceId}/avatars/...` 를 쓴다" 는, 이제는 사실이 아닌 문장을 근거로 버킷 정책·마이그레이션을 설계하게 된다. `plan/in-progress/spec-update-avatar-upload-implemented.md` 자신이 바로 이 실패 시나리오를 "왜 이게 Critical 인가" 로 이미 지목했다 — *"`{workspaceId}/avatars/` 접두로 [버킷 정책을] 설계하면 … 업로드는 성공하고 이미지만 403 이 된다."* 즉 발견 주체(구현팀)도 이것을 스펙-코드 불일치로서 이미 Critical 로 분류했다.
  - 제안: 이 PR 은 `developer` 권한(코드 전용)이라 spec 을 직접 고칠 수 없으므로 현재로선 정당하다. 다만 이미 추적 중인 `plan/in-progress/spec-update-avatar-upload-implemented.md` 의 planner 턴이 §2.7 **본문 표**뿐 아니라 `## Rationale → S3 객체 키 prefix 설계` **항목 자체**도 반드시 함께 정정해야 한다 — 특히 "Knowledge Base 원본 문서 키**만**" 이라는 배타적 서술이 Avatar 추가 후 거짓이 되므로, "KB·Avatar 두 영역이 workspaceId prefix 예외" 로 재서술하고 Avatar 의 배제 근거(User 는 워크스페이스 비종속 엔티티)를 새 bullet 로 추가해야 한다. 아래 두 번째 항목 참고.

- **[WARNING] spec 동기화 추적 plan 의 체크리스트가 본문/표만 지목하고 `## Rationale` 절 정정을 명시하지 않음**
  - target 위치: `plan/in-progress/spec-update-avatar-upload-implemented.md` §"같은 사실을 말하는 다른 SoT 문서" 체크리스트 (`spec/0-overview.md §2.7` 행, `spec/data-flow/4-file-storage.md` §1.1/§1.2/§2.1/§2.2/§2.3 행)
  - 과거 결정 출처: 동일 — `spec/0-overview.md` `## Rationale` "S3 객체 키 prefix 설계" 항목 (:369-373)
  - 상세: 체크리스트는 §2.7 "스토리지 레이아웃 트리의 `avatars/` 항목과 아래 표" 만 명시한다. `## Rationale` 섹션은 §2.7 본문과 별개 위치(문서 하단, :365~)에 있고 앵커도 다르다. 이 항목대로만 집행하면 본문 표는 새 키 패턴으로 갱신되지만 Rationale 텍스트는 "Form/Avatar 는 workspaceId prefix 를 따른다" 는 옛 서술을 그대로 남겨, 같은 문서 안에서 표와 Rationale 이 서로 모순되는 상태가 새로 생긴다 — 지금의 "코드 vs 표" 불일치가 "표 vs Rationale" 불일치로 자리만 옮기는 셈이다.
  - 제안: 체크리스트에 `spec/0-overview.md` **`## Rationale`** 의 "S3 객체 키 prefix 설계" 항목 정정을 별도 항목으로 추가할 것을 권한다 (예: "Knowledge Base 원본 문서 키**만**" → "Knowledge Base·Avatar" 로, 그리고 Avatar 배제 근거 bullet 신설).

## 요약
이번 PR(백엔드 전용, `spec/` 미변경)이 구현한 아바타 S3 키 레이아웃(`avatars/{userId}/{uuid}.{ext}`, workspaceId 없음)은 `spec/0-overview.md` `## Rationale`("S3 객체 키 prefix 설계 — KB 원본 키에서 workspaceId 제외")이 지금 이 순간에도 명시적으로 규정하는 "Form/Avatar 는 workspaceId prefix 패턴을 따르고, KB 만이 유일한 예외" 라는 문장과 정면으로 배치된다. 코드 주석과 별도 근거 plan(`spec-sync-user-profile-gaps.md`)에는 이 이탈을 정당화하는 합리적 이유(User 는 워크스페이스 비종속 엔티티)가 이미 적혀 있고, spec 반영은 `spec-update-avatar-upload-implemented.md` 로 명시적으로 추적되고 있어 "무근거 번복" 은 아니다 — 다만 그 추적 문서의 체크리스트가 §2.7 **본문 표**만 겨냥하고 **Rationale 절 자체**의 정정을 빠뜨리고 있어, 이번 발견을 반영하지 않으면 표를 고친 뒤에도 문서 내부 모순이 새로 생긴다. developer 의 spec 쓰기 금지 원칙은 지켜졌으므로 이 PR 자체를 막을 사유는 아니지만, 다음 planner 턴이 반드시 Rationale 텍스트까지 함께 정정해야 한다.

## 위험도
MEDIUM
