# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/spec-draft-workspace-settings-api.md`
검토일: 2026-06-03

---

## 발견사항

### 발견사항 1
- **[WARNING]** `ADMIN_REQUIRED` 에러 코드 — 카탈로그 미등재 상태에서 API 응답에 사용 중
  - target 위치: "Phase: Spec 갱신" 항목 `spec/5-system/3-error-handling.md §1.2` 등재 계획 포함
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md §1.2` 인증/인가 에러 카탈로그
  - 상세: `spec/5-system/3-error-handling.md §1.2` 는 403 에러 코드로 `FORBIDDEN` 만 정의하며 `ADMIN_REQUIRED` 는 없다. 그러나 `codebase/backend/src/modules/workspaces/workspaces.service.ts:525` 의 `assertAdmin()` 은 이미 `code: 'ADMIN_REQUIRED'` 를 발행하고 있고, target 의 시퀀스 다이어그램도 `403 ADMIN_REQUIRED` 를 명시한다. `spec/5-system/2-api-convention.md §4` 는 403 의 기본 코드를 `FORBIDDEN` 으로 정의한다. 두 코드가 같은 403 을 다른 코드 값으로 노출하므로, API 소비자 입장에서는 `ADMIN_REQUIRED` 와 `FORBIDDEN` 중 어느 것을 expect 해야 하는지 불명확하다.
  - 제안: target 의 §8.5 등재 계획대로 `3-error-handling.md §1.2` 에 `ADMIN_REQUIRED` 를 신규 행으로 추가하고, `2-api-convention.md §4` 의 "403 기본 코드=FORBIDDEN" 주석에 도메인별 override 코드(`ADMIN_REQUIRED` 등) 가 존재할 수 있음을 명시하는 것이 권장된다. 단순 추가로 해결 가능하며 기존 `FORBIDDEN` 항목과 직접 모순되지는 않는다.

---

### 발견사항 2
- **[WARNING]** `PATCH /api/workspaces/:id` 엔드포인트 — 설명 문구와 기존 spec 간 명시적 범위 불일치
  - target 위치: "결정" 절 — "기존 `PATCH /api/workspaces/:id` 는 rename 전용(`{ name }`, `@IsNotEmpty` min2/max100)이며 settings 부분 갱신과 의미가 달라 분리한다"
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/2-navigation/9-user-profile.md §6.1` API 표
  - 상세: `spec/2-navigation/9-user-profile.md §6.1` 의 `PATCH /api/workspaces/:id` 행 설명은 "워크스페이스 이름 변경 (Admin+)" 이다. target 은 이를 rename 전용으로 재확인하고 body 스키마(`{ name }`)를 명시하는 spec 갱신을 계획하고 있다. 이는 모순이 아니라 기존 행의 body 정보 보강이다. 그러나 `spec/data-flow/12-workspace.md §2.1 Schema 매핑` 에는 `workspace.settings` 갱신 관련 항목이 없고 `PATCH /:id/settings` 흐름도 없으므로, target 의 §1.7 신설이 반드시 `data-flow/12-workspace.md` 에 함께 반영되어야 한다. target 은 이를 Phase 목록에 포함하고 있어 원칙상 일치한다.
  - 제안: 충돌이 아닌 gap. target 의 Phase 계획대로 진행하면 해소된다.

---

### 발견사항 3
- **[INFO]** `빈 배열 = 추가 origin 없음` 의미와 `임베드 soft 검증 enforce=false` 의 레이어 혼용 가능성
  - target 위치: "★ 빈 배열 의미 (Critical 정정)" 절
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/7-channel-web-chat/4-security.md §3` (임베드 allowlist)
  - 상세: target 은 "빈 배열 = 추가 origin 없음이며 CORS 는 built-in CDN 만 허용" 과 "임베드 soft 검증은 목록이 비면 `enforce=false`(allow-all)" 이 **다른 레이어** 임을 설명한다. `4-security.md §3` 은 임베드 soft 검증에 대해 "allowlist 와 대조해 불일치 시 위젯 `blocked`" 로만 기술되어 있으며, 빈 배열일 때 `enforce=false(allow-all)` 동작을 명시하지 않는다. target 의 설명과 `4-security.md §3` 의 기술 사이에 빈 배열 케이스의 임베드 soft 검증 동작이 동기화되어 있지 않다.
  - 제안: target Phase 에 `spec/7-channel-web-chat/4-security.md §3` 의 빈 배열 케이스 동작(enforce=false → allow-all soft) 명시를 추가하거나, target 의 "Phase: Spec 갱신" 항목에 해당 파일을 포함시키는 것을 권장한다.

---

### 발견사항 4
- **[INFO]** `응답 래핑 { data: workspace }` — workspace 전체 vs 변경된 settings 만 반환 여부 미명시
  - target 위치: "data-flow/12-workspace.md §1.7" 다이어그램, "응답 래핑" 항목
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/2-api-convention.md §5`(TransformInterceptor), `spec/2-navigation/9-user-profile.md §6.1`
  - 상세: target 은 `200 { data: workspace }` 로 workspace 전체 엔티티를 반환하는 것으로 기술한다. 기존 `PATCH /api/workspaces/:id`(rename) 의 응답 shape 이 `9-user-profile.md §6.1` 에 명시되어 있지 않아 직접 비교는 불가능하지만, rename 은 단일 필드 변경이고 settings 갱신은 JSONB 필드 변경이라 동일 shape 반환이 자연스럽다. 충돌은 아니고 명명 수준의 동기화 권장.
  - 제안: `9-user-profile.md §6.1` 의 신규 `PATCH /api/workspaces/:id/settings` 행에 응답 shape(`200 { data: workspace }`) 를 명시하면 된다. target Phase 에 이미 포함되어 있다.

---

### 발견사항 5
- **[INFO]** `data-flow/12-workspace.md` — §1.7 신설 시 §2.1 Schema 매핑 테이블과의 정합
  - target 위치: "Phase: Spec 갱신" 항목 — `spec/data-flow/12-workspace.md §1.7 신설`
  - 충돌 대상: `/Volumes/project/private/clemvion/spec/data-flow/12-workspace.md §2.1`
  - 상세: `data-flow/12-workspace.md §2.1 Postgres` 매핑 테이블에는 `workspace.settings` PATCH write 항목이 없다. §1.7 시퀀스를 신설할 때 §2.1 의 `workspace` 행에 `UPDATE settings` write 컬럼을 추가하지 않으면 schema 매핑 표가 부분 완성 상태가 된다.
  - 제안: §1.7 신설 시 §2.1 에 `workspace | settings 변경 | UPDATE settings = merge({...settings, interactionAllowedOrigins}) | —` 행을 함께 추가할 것을 권장한다. target Phase 목록에 §2.1 갱신이 명시되어 있지 않으므로 추가 필요.

---

## 요약

Cross-Spec 일관성 관점에서 target 의 핵심 설계(전용 `PATCH /api/workspaces/:id/settings` 분리, 권한 owner+admin, 빈 배열 의미, 응답 래핑)는 `spec/1-data-model.md`, `spec/5-system/1-auth.md`, `spec/7-channel-web-chat/4-security.md`, `spec/5-system/2-api-convention.md` 와 직접 모순되지 않는다. 주요 위험은 두 가지다. 첫째, `ADMIN_REQUIRED` 에러 코드가 코드베이스에서 이미 사용되고 있으나 `spec/5-system/3-error-handling.md §1.2` 카탈로그에 미등재되어 있어 spec 소비자가 403 응답 코드를 `FORBIDDEN` 으로 예상할 가능성이 있다(Warning). 둘째, 빈 배열일 때 임베드 soft 검증이 `enforce=false(allow-all)` 로 동작한다는 사실이 `spec/7-channel-web-chat/4-security.md §3` 에 아직 반영되어 있지 않아 레이어 설명이 불완전하다(Info). `data-flow/12-workspace.md §2.1` schema 매핑 테이블 갱신은 Phase 계획에 누락되어 있으므로 보완이 필요하다.

## 위험도

LOW
