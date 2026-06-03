# Cross-Spec 일관성 검토 결과

> target: `plan/in-progress/spec-draft-workspace-settings-api.md`
> 검토 기준: spec draft 검토 (--spec)
> 생성: 2026-06-03

---

## 발견사항

### [CRITICAL] 기존 `PATCH /api/workspaces/:id` 계약과 신규 엔드포인트 간 의미 충돌

- **target 위치**: "결정" 섹션 — "기존 `PATCH /:id`(name 필수)와 분리"
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §6.1`, `codebase/backend/src/modules/workspaces/dto/update-workspace.dto.ts`
- **상세**: target 은 기존 `PATCH /api/workspaces/:id` 가 `name` 필수이므로 설정 갱신과 의미가 달라 전용 `PATCH /:id/settings` 를 신설한다고 기술한다. 이 전제 자체(name 필수)는 현재 코드에서 사실이다(`UpdateWorkspaceDto`에 `@IsNotEmpty() name: string`). 그러나 `spec/2-navigation/9-user-profile.md §6.1` 의 API 목록은 `PATCH /api/workspaces/:id` 를 "워크스페이스 이름 변경 (Admin+)" 단 하나의 용도로 등록하고 있으며, 해당 엔드포인트의 request body 스키마·반환 shape 을 spec 상 명시하지 않는다. target 이 `PATCH /:id/settings` 를 신설하면서 기존 `PATCH /:id` 의 스키마(`name` 필수)를 spec 에 공식 기록하지 않은 채 "분리 근거"로만 언급하면, `9-user-profile.md §6.1` 과의 공식 계약이 여전히 빈 상태로 남는다. 이 상태에서 두 엔드포인트가 공존하면 `PATCH /:id` 의 정의가 code 만에 있고 spec 에는 없는 갭이 확대된다.
- **제안**: target spec(`data-flow/12-workspace.md §1.x` 또는 `9-user-profile.md §6.1`)에 `PATCH /api/workspaces/:id` 의 body 스키마(`{ name: string, min 2, max 100 }`)와 필수 여부를 명시하여 두 엔드포인트의 경계를 공식화한다.

---

### [WARNING] RBAC 매트릭스 표현 불일치 — "Admin=RU" vs "Admin=✓"

- **target 위치**: "영향 spec" 섹션 — "RBAC 매트릭스(1-auth §3.2 "Workspace 설정 RU")"
- **충돌 대상**: `spec/5-system/1-auth.md §3.2`, `spec/data-flow/12-workspace.md §3.2`, `spec/2-navigation/9-user-profile.md §4.2`
- **상세**: target 은 1-auth §3.2 의 표현을 "Admin=RU"라고 인용한다. 실제 `spec/5-system/1-auth.md §3.2` 는 `Workspace 설정 | CRUD | RU | R | R` (Owner=CRUD, Admin=RU, Editor=R, Viewer=R) 로 적혀 있으므로 target 의 인용은 정확하다. 그러나 `spec/data-flow/12-workspace.md §3.2` 의 요약 매트릭스는 Admin 을 `✓` 로만 표기하고, `spec/2-navigation/9-user-profile.md §4.2` 는 "워크스페이스 설정 | Owner=✅ | Admin=✅ | Editor=❌ | Viewer=❌"로 표기하여 세 문서 간 기호 체계가 달리 쓰인다. 의미 상의 모순(Admin이 편집 가능하다는 점)은 일치하지만, target 이 "이미 충족"이라고 단언하고 변경 없음으로 처리하면서 세 문서의 표기 방식 불일치가 그대로 방치된다.
- **제안**: `data-flow/12-workspace.md §3.2` 와 `9-user-profile.md §4.2` 에서 Workspace 설정 행에 대해 Admin 의 구체 권한(R + U, 생성/삭제 불가)이 명확히 드러나도록 표기를 정비한다. target 이 신설하는 `PATCH /:id/settings` 는 U 권한의 구현이므로 해당 행에 cross-ref 를 달아 두는 것이 향후 일관성 유지에 유리하다.

---

### [WARNING] `embed-config 캐시 max-age=300` 근거 spec 의 미스레퍼런스

- **target 위치**: "변경 내용 — data-flow/12-workspace.md §1.x" 섹션 — "embed-config 캐시(`Cache-Control: max-age=300`)로 최대 5분([7-channel-web-chat/4-security §3])"
- **충돌 대상**: `spec/7-channel-web-chat/4-security.md §2`, `spec/5-system/14-external-interaction-api.md §8.5`
- **상세**: target 은 반영 지연의 근거를 `7-channel-web-chat/4-security §3` (임베드 allowlist) 에서 인용한다. 그러나 `4-security.md §2` 에 명시된 캐시는 **60s TTL** (`WebChatCorsOriginResolver` 의 "60s TTL 캐시")이며, `Cache-Control: max-age=300` 이라는 표현 자체는 `spec/2-navigation/10-auth-flow.md §(auth/me endpoint)` 에서 다른 맥락으로 쓰인다. `4-security.md §3` 에는 임베드 soft 검증 흐름이 있지만 `max-age=300` 캐시를 명시한 항목은 없다. 따라서 target 의 "최대 5분" 은 `4-security §3` 과 직접 연결되지 않으며, CORS 레이어의 60s TTL 캐시와도 수치가 다르다.
- **제안**: target 에서 반영 지연을 서술할 때 실제 근거가 되는 캐시 위치(CORS resolver 의 60s TTL 캐시 또는 별도 embed-config 캐시)와 그 spec 경로를 정확히 명시한다. `7-channel-web-chat/4-security §3` 은 인용 대상이 아닌 영향 대상으로 재표기하거나, 실제 캐시 TTL 을 정의하는 §2 를 참조한다.

---

### [WARNING] `(main)/workspace/settings` 에 신규 섹션 추가 — 기존 탭 구조와 구조적 충돌 가능성

- **target 위치**: "UI — 워크스페이스 설정 페이지 '임베드 허용 도메인' 섹션"
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §4` (워크스페이스 관리 화면)
- **상세**: `spec/2-navigation/9-user-profile.md §4` 는 `/workspace/settings` 를 개요 / 멤버 / 위험 영역 3개 탭으로 정의한다. target 은 "섹션/탭 신설"이라고만 기술하고 어떤 탭에 들어가는지 명시하지 않는다. "임베드 허용 도메인"이 새 탭("보안" 등)으로 추가되는지, 아니면 기존 "개요" 탭 안에 섹션으로 들어가는지에 따라 `9-user-profile.md §4` 의 탭 구조가 변경되어야 한다. 현재 target 은 이 결정을 생략한 채 "섹션/탭 신설"이라는 모호한 표현을 쓰고 있다.
- **제안**: target 에서 UI 배치를 확정(기존 탭 내 섹션 vs 신규 탭)하고, 해당 결정을 `spec/2-navigation/9-user-profile.md §4` 의 탭 구조에 동기화한다.

---

### [WARNING] `useHasRole("admin")` 가드 표현이 기존 RBAC 패턴과 불일치

- **target 위치**: "UI — 워크스페이스 설정 페이지" — `useHasRole("admin")`
- **충돌 대상**: `spec/5-system/1-auth.md §3.2`, `spec/2-navigation/9-user-profile.md §4.2`
- **상세**: target 은 `useHasRole("admin")` 으로 편집 접근을 제어하겠다고 기술한다. 그러나 RBAC 매트릭스에서 "Workspace 설정 U" 권한은 **owner + admin** 둘 다이다. `useHasRole("admin")` 이 "admin 이상(admin + owner)" 을 의미하는 helper 라면 문제 없지만, 명칭 자체는 role 단일 값 `admin` 을 검사하는 것처럼 읽혀 owner 가 제외될 수 있다. 기존 spec 어디에도 `useHasRole` hook 의 비교 의미(단일 role vs "role 이상" 포함 범위)가 명세되어 있지 않다.
- **제안**: target 에서 `useHasRole("admin")` 이 "admin 이상" 포함인지 명확히 표기하거나, 기존 codebase 의 RBAC hook 이름과 의미를 먼저 spec/conventions 에 정의한 뒤 참조하도록 한다. 혹은 `useHasRole(["owner", "admin"])` 처럼 명시적으로 기술한다.

---

### [INFO] `spec/1-data-model.md §2.2 Workspace.settings` cross-ref 표현 보완 필요

- **target 위치**: "영향 spec — spec/1-data-model.md §2.2"
- **충돌 대상**: `spec/1-data-model.md §2.2 Workspace.settings` (현행 키 정의)
- **상세**: 현재 `1-data-model.md §2.2` 의 `interactionAllowedOrigins` 키 설명은 "편집 경로: [설정 API/UI]" cross-ref 가 없고, 단순히 "사용자가 명시 설정 필요"라는 암묵적 수준에서 기술된다. target 은 이 cross-ref 를 추가할 예정이라고 언급하지만, 추가할 텍스트 내용을 구체화하지 않았다. 이 자체는 작은 누락이지만, `4-security.md §2` 와 `14 §8.5` 에서 이미 해당 키의 "설정 경로"를 참조하고 있으므로 cross-ref 보완이 필요하다.
- **제안**: target 에서 `1-data-model.md §2.2` 에 추가할 cross-ref 문구를 명시(예: "편집 경로: `PATCH /api/workspaces/:id/settings` — [Spec data-flow/12-workspace §1.x]")한다.

---

### [INFO] `spec/data-flow/12-workspace.md` 에 settings-update 시퀀스 추가 후 §1 번호 체계 정비 필요

- **target 위치**: "변경 내용 — data-flow/12-workspace.md §1.x"
- **충돌 대상**: `spec/data-flow/12-workspace.md §1` (§1.1 ~ §1.6 이미 사용 중)
- **상세**: `data-flow/12-workspace.md` 는 현재 §1.1~§1.6 까지 시퀀스를 가진다(워크스페이스 생성, 초대 발급, 수락, 미가입자 수락, 전환, 역할 변경/이전). target 은 "§1.x" 라는 플레이스홀더를 사용하며 실제 번호를 결정하지 않았다.
- **제안**: target 을 최종 spec 으로 확정할 때 §1.7 또는 §2 신설 등 실제 번호를 부여하여 기존 §1 시리즈와 충돌 없이 배치한다.

---

## 요약

target 은 기존 RBAC 매트릭스와 호환 가능한 범위에서 `interactionAllowedOrigins` 설정 표면을 채우는 작업으로, 데이터 모델 정의(`Workspace.settings`)나 권한 구조에 정면으로 모순되는 항목은 없다. 다만 두 가지 실질적 위험이 있다: 첫째, 신규 `PATCH /:id/settings` 를 정당화하기 위해 "기존 `PATCH /:id`는 name 필수"를 전제로 사용하는데, 이 계약이 어떤 spec 에도 공식 기록되어 있지 않아 두 엔드포인트의 경계가 code 레벨에만 남는다. 둘째, embed-config 반영 지연의 근거로 인용한 `7-channel-web-chat/4-security §3` 과 수치(`max-age=300`)가 실제 해당 섹션의 내용(60s TTL CORS 캐시)과 맞지 않아 오해를 유발할 수 있다. 추가로 `/workspace/settings` 탭 구조 확정, `useHasRole("admin")` 의 포함 범위 명확화, 섹션 번호 확정이 필요하다.

---

## 위험도

MEDIUM
