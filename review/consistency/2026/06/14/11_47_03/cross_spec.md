# Cross-Spec 일관성 검토 결과

검토 범위: `spec/2-navigation/6-config.md` §A.2 (편집 폼 구현 diff, `origin/main...HEAD`)
검토 모드: `--impl-done`

---

## 발견사항

### [WARNING] 편집 버튼 권한 미가드 — RBAC 매트릭스 충돌 가능성

- **target 위치**: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `handleEditClick` 및 Edit 버튼 렌더링 블록
- **충돌 대상**: `spec/5-system/1-auth.md §3.2` RBAC 매트릭스 — `Auth Config | CRUD | CRUD | R | R` (Editor/Viewer = 읽기 전용). 백엔드 `auth-configs.controller.ts:109` — `@Roles('admin')` (PATCH 는 Admin+ 강제)
- **상세**: Reveal 버튼은 `const canReveal = useHasRole("admin")` 로 노출 제어되어 RBAC 매트릭스와 일치한다. 그러나 새로 추가된 Edit 버튼(`<Button aria-label={t("authentication.editButton")} onClick={() => handleEditClick(config)}>`)에는 role 체크가 없다. Editor/Viewer 역할 사용자도 편집 다이얼로그를 열 수 있고, Submit 시 PATCH 요청이 발생하지만 백엔드 `@Roles('admin')` 이 403으로 차단한다. UI 단에서 버튼이 보이면 권한 없는 사용자가 편집 시도 후 403을 받아 혼란이 생긴다. spec §3.2 의 "Auth Config: Owner/Admin = CRUD, Editor/Viewer = R" 와 UI 노출 정책이 어긋난다.
- **제안**: Edit 버튼 렌더링을 `canReveal`(또는 별도 `canEdit = useHasRole("admin")`) 조건으로 감싸거나, spec §3.2 주석("Editor=R 로 좁힌다")에 맞게 Admin+ 만 버튼을 노출한다. 백엔드 가드는 이미 정합하므로 프론트엔드만 수정 필요.

---

### [WARNING] spec §A.2 구현 현황 서술이 편집 폼 추가를 반영하지 않음

- **target 위치**: `spec/2-navigation/6-config.md §A.2` 구현 현황 주석 — `"(생성 후 편집 폼은 별도 — 현 UI 는 생성·토글·재생성·삭제만 제공.)"`
- **충돌 대상**: 동일 파일 §A.2, `spec/1-data-model.md §2.17` (AuthConfig update 계약)
- **상세**: 이번 diff 가 편집 폼(Edit 버튼, PATCH 흐름, shallow-merge, type lock)을 구현 완료했음에도 spec §A.2 의 구현 현황 서술은 "편집 폼은 별도 — 현 UI 는 생성·토글·재생성·삭제만 제공" 로 남아 있다. spec 과 구현 상태가 괴리된 SPEC-DRIFT 가 발생했다.
- **제안**: spec §A.2 구현 현황 주석을 갱신해 편집 폼(PATCH, shallow-merge, type 잠금, 비밀값 보존)이 구현 완료됨을 반영한다. 아울러 `6-config.md` 의 `code:` frontmatter 경로가 `authentication/page.tsx`를 이미 포함하므로 커버리지 자체는 문제없다.

---

### [INFO] UpdateAuthConfigDto API 문서 설명 — "전달된 값으로 기존 설정을 대체"에서 shallow-merge로 변경

- **target 위치**: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` `config` 필드 `@ApiPropertyOptional` description
- **충돌 대상**: `spec/2-navigation/6-config.md §3 Authentication API` PATCH 엔드포인트 설명, `spec/1-data-model.md §2.17` update 계약
- **상세**: 변경 전 DTO 설명은 "전달된 값으로 기존 설정을 대체"였고, spec §3 의 PATCH 행 설명("수정")은 동작 방식을 명시하지 않는다. 이번 diff 로 DTO 가 shallow-merge + 비밀값 보존 정책을 명시하게 됐다. spec §3 는 여전히 단순 "수정"만 기술해 계약 세부사항(shallow-merge, 비밀값 보존)이 spec 에 없다. 하위 호환 변경이라 CRITICAL 은 아니나 spec 동기화가 권장된다.
- **제안**: spec §3 PATCH 행 또는 §A.2 내 별도 항목에 "config 는 shallow-merge (비밀값(key/token/secret/password)은 변경 불가, type 불변)" 를 추가한다.

---

### [INFO] type 불변 정책 — spec 에 명시 없음

- **target 위치**: `auth-configs.service.ts` update 메서드 주석 + `auth-config-form.ts buildAuthConfigUpdatePayload` — `type` 제외 + UI `disabled={dialogMode === "edit"}`
- **충돌 대상**: `spec/1-data-model.md §2.17` AuthConfig 필드 정의, `spec/2-navigation/6-config.md §A.2`
- **상세**: 구현은 `type` 변경을 서비스 레이어에서 강제 차단(구조분해 제외)하고 UI 에서 select disabled + 안내 문구("삭제 후 재생성" 유도)를 노출한다. 그러나 spec §2.17 이나 §A.2 어디에도 "AuthConfig.type 은 사후 변경 불가 — 삭제 후 재생성" 규칙이 명시되어 있지 않다.
- **제안**: `spec/1-data-model.md §2.17` 또는 `spec/2-navigation/6-config.md §A.2` 에 `type` 불변 제약(생성 시 결정, 이후 변경 불가 — 변경 필요 시 삭제 후 재생성)을 추가한다.

---

## 요약

구현 diff 는 `spec/2-navigation/6-config.md §A.2`, `spec/1-data-model.md §2.17`, `spec/5-system/1-auth.md §3.2` 와 전반적으로 정합한다. API endpoint(PATCH `/api/auth-configs/:id`), 엔티티 필드(ip_whitelist, config JSONB shallow-merge), 마스킹 정책(비밀값 보존)은 기존 spec 과 모순이 없다. 단, 가장 실질적인 갭은 편집 버튼에 Admin+ 역할 가드가 없어 RBAC 매트릭스(Editor=R)와 UI 노출이 어긋나는 점이다(백엔드는 이미 @Roles('admin') 로 정합). 그 외 spec §A.2 구현 현황 서술이 편집 폼 완료를 반영하지 않는 SPEC-DRIFT, PATCH shallow-merge·type 불변 정책이 spec 에 미기술된 정보 공백이 있다.

## 위험도

MEDIUM
