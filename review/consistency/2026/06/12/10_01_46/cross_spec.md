# Cross-Spec 일관성 검토 결과

target: `spec/5-system/1-auth.md`

---

### 발견사항

- **[WARNING]** Planned 감사 액션 `password_change`, `2fa_enable/disable` 이 dot-prefix 명명 규약을 위반
  - target 위치: `spec/5-system/1-auth.md §4.1` Planned 표 — `인증 (워크스페이스 컨텍스트)` 행
  - 충돌 대상: 동일 §4.1 첫 단락의 `<resource>.<verb>` 필수 규약 선언, `spec/data-flow/1-audit.md §1.1` 표기 규약("resource dot-prefix 가 필수다") 및 Rationale
  - 상세: target §4.1 은 명명 규약으로 `<resource>.<verb>` (resource dot-prefix 필수)를 명문화하고, `data-flow/1-audit.md` 는 이 규약을 인증 spec §4.1 이 SoT 라고 역참조한다. 그런데 Planned 목표 액션 중 `password_change`, `2fa_enable/disable` 은 dot-prefix 없이 동사·명사만 나열되어 있어 동일 규약을 이탈한다. 구현 시 이 형태가 `AUDIT_ACTIONS` union 에 그대로 추가되면 `data-flow §1.1` 의 일관성 검증 기준도 틀어진다.
  - 제안: `user.password_change`, `user.2fa_enable` / `user.2fa_disable` (또는 `auth.password_change`, `auth.2fa_enable/disable`) 로 도메인 prefix 를 붙여 규약과 일치시킨다. 구체 prefix 는 워크스페이스 컨텍스트 감사이므로 행위 주체(`user`) 또는 도메인(`auth`) 중 하나를 선택해 고정하면 된다.

- **[WARNING]** RBAC 매트릭스 — `Integration (Org)` Editor/Viewer 권한이 `spec/2-navigation/9-user-profile.md §4.2` 와 범위 차이
  - target 위치: `spec/5-system/1-auth.md §3.2` 권한 매트릭스 `Integration (Org)` 행 — `CRUD | CRUD | R | R`
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §4.2` — `Integration 생성 (Org)` 행만 존재하며 `Owner=✅, Admin=✅, Editor=❌, Viewer=❌`
  - 상세: target 은 `Integration (Org)` 에 대해 Editor=R(읽기 허용), Viewer=R(읽기 허용)이라고 명시한다. user-profile §4.2 의 매트릭스는 "생성" 에 한정하여 Editor=❌ 를 표기하고 있고, 읽기 권한 행이 없다. 조회(READ) 가 허용되는지 여부는 누락이지만, "생성(Org)" 에 Editor=❌ 임이 명시된 데 비해 target 은 CRUD 전체를 Admin+ 로만 제한한 것이 아니라 읽기는 Editor/Viewer 에게도 허용하는 분리 정책을 따르고 있다. user-profile 는 쓰기만 다루고 읽기는 언급하지 않아 명시적 모순은 아니지만, target 의 `R` 허용 선언과 user-profile 의 창(CREATE) 제한 표시가 독자에게 혼선을 유발할 수 있다.
  - 제안: `spec/2-navigation/9-user-profile.md §4.2` 매트릭스에 `Integration (Org) 조회` 행(Editor=✅, Viewer=✅)을 추가하거나, 기존 행의 제목을 `Integration (Org) 생성/수정/삭제` 로 한정해 읽기 허용임을 보완 설명한다. 두 매트릭스가 같은 리소스를 다른 입도로 표현하므로 중심 SoT 가 target §3.2 임을 user-profile 이 명시적으로 참조하면 충분하다.

- **[INFO]** `spec/2-navigation/9-user-profile.md §4.2` RBAC 매트릭스가 target §3.2 의 여러 리소스 행을 미커버
  - target 위치: `spec/5-system/1-auth.md §3.2` — Auth Config, Model Config, Knowledge Base, Audit Log, Statistics, System Status, Marketplace 설치, Trigger, Schedule 등 다수 행
  - 충돌 대상: `spec/2-navigation/9-user-profile.md §4.2` — 워크플로우·Integration(Org)·멤버·워크스페이스 설정·관리 등 8행만 포함
  - 상세: user-profile §4.2 는 워크스페이스 관리 화면에 특화된 요약 매트릭스이고 target §3.2 는 전체 시스템 RBAC 의 SoT 다. 범위 차이는 의도적일 수 있으나 현재 어떤 문서도 "user-profile §4.2 는 요약이며 SoT 는 auth §3.2 이다"라고 명시하지 않는다. 독자가 user-profile §4.2 만 보고 RBAC 전체를 오해할 여지가 있다.
  - 제안: `spec/2-navigation/9-user-profile.md §4.2` 표 아래에 "전체 리소스 권한 매트릭스는 [Spec 인증/인가 §3.2](../5-system/1-auth.md#32-리소스별-권한-매트릭스) 참조" 한 줄을 추가한다.

- **[INFO]** target §4.1 의 action naming 규약 서술이 `data-flow/1-audit.md` 의 Rationale 에도 분산 기술되어 있음
  - target 위치: `spec/5-system/1-auth.md §4.1` — "Action naming 규약" 단락
  - 충돌 대상: `spec/data-flow/1-audit.md §1.1` — "표기 규약은 dot-prefix 기준으로 통일됐다" 단락, Rationale 섹션
  - 상세: 두 문서가 같은 naming 규약을 일부 중복 서술한다. `data-flow/1-audit.md` 는 target 을 SoT 로 역참조하고 있어 논리적 주종 관계가 있지만, 두 문서가 각각 규약을 독립적으로 서술하면 향후 한쪽만 업데이트될 경우 drift 가 생긴다.
  - 제안: `data-flow/1-audit.md §1.1` 의 naming 규약 서술을 "규약 상세는 [인증 spec §4.1](../5-system/1-auth.md#41-기록-대상-액션) 참조" 로 대체해 단일 진실을 target 에 집중시킨다.

---

### 요약

`spec/5-system/1-auth.md` 는 RBAC·감사 로그·세션 정책 면에서 `spec/1-data-model.md`, `spec/data-flow/1-audit.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/6-config.md` 와 전반적으로 일관성을 유지한다. 데이터 모델의 User·WebAuthnCredential·LoginHistory·RefreshToken 필드 정의, 감사 로그 구현 액션 목록, Auth Config 마스킹 정책, Audit Log RBAC(`Admin+` 조회)는 각 참조 spec 과 모순이 없다. 단, Planned 감사 액션 `password_change`/`2fa_enable/disable` 이 target 자신이 선언한 dot-prefix 명명 규약을 따르지 않아 구현 시 일관성 이탈이 예상되며(WARNING), Integration(Org) 읽기 권한 명시가 user-profile §4.2 에서 누락되어 혼선 여지가 있다(WARNING). RBAC SoT 의 cross-reference 누락과 naming 규약 중복 서술은 정보성(INFO) 수준의 동기화 권장 사항이다.

### 위험도

LOW
