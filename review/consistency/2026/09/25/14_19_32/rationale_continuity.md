# Rationale 연속성 검토 — spec-draft-workspace-path-guard

## 발견사항

- **[WARNING]** `admin_required`(소문자) "의도적 분리" 레지스트리 근거를 갱신하지 않고 wire 를 사실상 합류시킴
  - target 위치: `plan/in-progress/spec-draft-workspace-path-guard.md` C-3 (`spec/5-system/1-auth.md` §1.5.4 코드 변경) + C-4 (`spec/conventions/error-codes.md` 註)
  - 과거 결정 출처: `spec/conventions/error-codes.md` §3 Historical-artifact 예외 레지스트리, `admin_required`·`workspace_not_found`·`user_not_found` 행 — "**초대 모듈 한정**... 직접 추가·관리 경로(§1.9, `workspaces.service.ts`)의 UPPER_SNAKE `WORKSPACE_NOT_FOUND`·`USER_NOT_FOUND` 와 **별개 코드**다(다른 모듈·케이스 컨벤션, **의도적 분리**)". 같은 문서 §2 "안정성/rename 정책": "이름 정확성 향상만을 위한 rename 은 하지 않는다".
  - 상세: 이 레지스트리 행은 초대 모듈의 `admin_required`(lowercase)가 `workspaces.service.ts` 직접-추가 경로의 `ADMIN_REQUIRED`(UPPER_SNAKE)와 **의미는 같지만 wire 상 의도적으로 별개**라고 명시적으로 못 박아 둔 결정이다. 이번 draft(C-3)는 초대 발송·재발송·취소(`§1.5.4`) 라우트가 `RolesGuard`(전역, `@Roles('admin')`)를 먼저 거치게 하면서, 권한 실패 시 HTTP 로 나가는 코드를 그 guard 의 통일 코드 `ADMIN_REQUIRED`(UPPER_SNAKE, C-1(e) 표)로 바꾼다 — 즉 이 특정 경로에 한해 "의도적으로 분리했던" 두 코드가 실질적으로 같은 wire 값에 수렴한다. C-4 는 이를 부분적으로만 짚는다 — "2026-09-25 이후 HTTP 로는 나가지 않는다"는 **발행 여부**만 註記할 뿐, 원 레지스트리 행이 못 박은 "**별개 코드로 의도적 분리**" 라는 근거 문장 자체는 그대로 남아 다음 독자에게 "지금도 분리가 유지된다"는 잘못된 인상을 준다. (다만 실측상 frontend `code` 분기 소비자는 없음 — `codebase/frontend/src/lib/api/invitations.ts` `INVITATION_ERROR` 에 `admin_required`/`forbidden` 항목 없음 — 이므로 breaking-change 실피해는 없음. §2·§1(근접명명 통합)의 취지("동일 의미는 코드 재사용")와도 상충하지 않아, 결정 자체는 방향이 맞다.)
  - 제안: C-4 의 註를 확장해 레지스트리 행의 "의도적 분리" 서술에도 한정어를 붙인다 — 예: "(2026-09-25 이후) 이 분리는 **HTTP 응답에는 더 이상 적용되지 않는다** — 초대 admin/owner 권한 거부는 `RolesGuard` 가 선점해 UPPER_SNAKE `ADMIN_REQUIRED`/`OWNER_REQUIRED` 로 수렴한다. `admin_required` 는 서비스 계층 HTTP-밖 방어선에서만 발행되며, 그 경로에 한해 분리가 유지된다." 없으면 §3 레지스트리가 스스로 모순된 두 문장(모듈 한정 분리 vs 註의 "HTTP 로 안 나간다")을 갖게 된다.

- **[INFO]** 부트 캐너리 Rationale 의 "집합 정의" 문장이 `@WorkspaceParam` 도입으로 stale 해질 수 있음
  - target 위치: `plan/in-progress/spec-draft-workspace-path-guard.md` D-1 (구현 요구: "부트 캐너리(`assertWorkspaceIdReflectionWorks`)가 경로 소비자도 센다")
  - 과거 결정 출처: `spec/5-system/1-auth.md` §Rationale "부트 캐너리 — `@WorkspaceId()` reflection 자가검증": "캐너리가 세는 집합은 위 data-flow §Rationale 의 '73건' 과 다르다... 캐너리는 `@Roles()` 유무와 **무관하게** `@WorkspaceId()` 를 소비하는 라우트를 전부 센다."
  - 상세: 이 draft 는 spec 변경(C 섹션)에서 캐너리 Rationale 문서 자체는 건드리지 않고, 후속 developer PR 요구사항(D-1)에서만 "경로 소비자(`@WorkspaceParam`)도 센다"고 적었다. 구현되면 캐너리가 세는 모집단이 `@WorkspaceId()` 소비자에서 `@WorkspaceId() ∪ @WorkspaceParam()` 소비자로 넓어지는데, 현재 spec 텍스트는 여전히 "`@WorkspaceId()` 를 소비하는 라우트를 전부 센다"로만 서술한다. 이 draft 의 스코프(spec 만 변경, 구현은 후속 PR)를 감안하면 지금 당장 CRITICAL 은 아니지만, 후속 developer PR 이 이 문장을 함께 갱신하지 않으면 "결정 번복 시 새 Rationale 동반" 원칙이 조용히 깨진다.
  - 제안: D 섹션(구현 요구)에 "부트 캐너리 Rationale 의 집합 정의 문장도 `@WorkspaceParam` 포함으로 갱신" 항목을 명시적으로 추가하거나, 이번 draft의 C-1/C-3 에 그 문장 갱신을 포함시킨다.

## 요약

이 draft 는 Rationale 연속성 관리가 전반적으로 모범적이다 — ① "73개 라우트에 `@Roles('viewer')` 부착" 기각 대안을 스스로 인용하며 같은 함정(라우트별 opt-in)에 빠지지 않도록 저장소 가드로 구조적 해법을 택했고, ② "가드 거부는 코드 없는 403" 원칙과 "`:id` 는 인가 입력이 아니다" 원칙을 뒤집을 때 원문을 지우지 않고 날짜가 찍힌 정정 Rationale 을 나란히 추가하는 이 저장소의 확립된 패턴을 그대로 따랐다(코드·docstring 대조로 실측 검증 완료 — `RolesGuard` docstring 인용이 실제 코드와 일치). 다만 한 곳에서 연속성 관리가 불완전하다: `spec/conventions/error-codes.md` §3 레지스트리가 "의도적 분리"로 명문화한 `admin_required`(소문자) vs `ADMIN_REQUIRED`(대문자) 구분을, 이 draft 가 초대 admin/owner 라우트에서 사실상 wire 수준으로 합류시키면서도 그 "의도적 분리" 문구 자체는 갱신하지 않았다(C-4 註는 발행 중단만 언급). 실측상 프론트가 그 코드로 분기하지 않아 실제 breaking 위험은 낮지만, 문서 정합의 관점에서는 번복이 새 Rationale 로 완전히 반영되지 않은 상태다. 부트 캐너리 집합 정의 문장의 stale 화 가능성도 경미하게 남아 있다.

## 위험도
LOW
