# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**MEDIUM** — RBAC UI 가드 누락(Warning)과 spec/plan 문서 동기화 갭(Warning x2) 존재. 설계 결정 충돌 없음.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | Edit 버튼에 Admin+ role 가드 없음 — Editor/Viewer 도 편집 다이얼로그 진입 가능, 백엔드 `@Roles('admin')` 은 정합하나 UI 단 403 혼란 발생 | `codebase/frontend/src/app/(main)/authentication/page.tsx` — `handleEditClick` 및 Edit 버튼 렌더링 | `spec/5-system/1-auth.md §3.2` RBAC 매트릭스 (Auth Config: Editor/Viewer = R) | `canEdit = useHasRole("admin")` 조건으로 Edit 버튼 감싸기 (Reveal 버튼 패턴 동일 적용) |
| W-2 | Cross-Spec / Plan Coherence | spec §A.2 구현 현황 주석 "편집 폼은 별도 — 현 UI 는 생성·토글·재생성·삭제만 제공" 이 stale — 편집 폼 구현 완료됐으나 반영 안 됨 | `spec/2-navigation/6-config.md §A.2` 구현 현황 블록쿼트 | 동일 파일 §A.2 본문, `spec/1-data-model.md §2.17` | spec §A.2 구현 현황 주석을 편집 폼 지원 내용으로 갱신 (project-planner 영역) |
| W-3 | Plan Coherence | `spec-sync-config-gaps.md` 의 편집 폼 항목 체크박스 미체크 — 구현 완료됐으나 plan 추적 미반영 | `plan/in-progress/spec-sync-config-gaps.md` — `[ ] §A.2 편집 폼 IP Whitelist / api_key Header 이름 입력` 항목 | 구현 diff (편집 폼 완료) | 해당 항목을 `[x]` 로 체크, 완료 날짜 및 구현 브랜치 메모 추가 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | PATCH shallow-merge·비밀값 보존 정책이 spec §3 에 미기술 | `spec/2-navigation/6-config.md §3` PATCH 행 | spec §3 또는 §A.2 에 "config 는 shallow-merge, 비밀값(key/token/secret/password) 불변, type 불변" 추가 |
| I-2 | Cross-Spec | `type` 불변 정책(삭제 후 재생성 강제)이 spec 에 미명시 | `spec/1-data-model.md §2.17` / `spec/2-navigation/6-config.md §A.2` | `type` 불변 제약(생성 시 결정, 이후 변경 불가) 명시 추가 |
| I-3 | Convention Compliance | `UpdateAuthConfigDto` `config` 필드 description 약 70자 — swagger.md §3 권장치(40자) 초과 | `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` | description 30자 요약으로 단축 후 상세 내용 JSDoc 이동, 또는 규약에 보안 계약 예외 주석 추가 |
| I-4 | Convention Compliance | `UpdateAuthConfigDto` `type?` 필드가 DTO에 잔존 — 서비스에서 무시되나 Swagger UI 상 "전달 가능"으로 표시 | `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` | description에 "편집 시 무시됨 — type 변경은 삭제 후 재생성으로 일원화" 추가 또는 필드 제거 (breaking change 없음) |
| I-5 | Convention Compliance | `AuthConfigUpdatePayload` 인터페이스가 파일 중간에 선언 — 상단 타입 정의 구역과 불일치 | `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` 라인 ~495 | 파일 상단 `AuthConfigPayload` 근처로 이동 (선택사항) |
| I-6 | Naming Collision | `authentication.editButton` (ko: "편집") vs `common.edit` (ko: "수정") — 영문 동일, ko 번역 상이 | `codebase/frontend/src/lib/i18n/dict/ko/authentication.ts` | 현행 유지 허용 (aria-label 전용 사용). ko 통일 원하면 양측 중 하나로 맞추기 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | Edit 버튼 RBAC 가드 누락 (W-1), spec §A.2 구현 현황 stale (W-2), shallow-merge·type 불변 spec 미기술 (I-1, I-2) |
| Rationale Continuity | NONE | 비밀값 평문 노출 3경로 원칙 완전 준수. 기각 대안 재도입 없음. Rationale 위반 없음 |
| Convention Compliance | LOW | WARNING 없음. DTO description 길이 초과(I-3), type 필드 노출 불일치(I-4) 등 INFO 4건 |
| Plan Coherence | LOW | 편집 폼 체크박스 미체크(W-3), spec §A.2 stale(W-2 중복). 미결 결정 우회 없음 |
| Naming Collision | NONE | 신규 식별자 충돌 없음. i18n ko 표현 미세 불일치 1건(I-6, INFO) |

## 권장 조치사항

1. **[W-1 — 즉시 수정]** `authentication/page.tsx` Edit 버튼에 `canEdit = useHasRole("admin")` 조건 추가. Reveal 버튼과 동일 패턴 적용. 프론트엔드 코드만 수정, 백엔드 가드는 이미 정합.
2. **[W-2 — 현 PR 또는 후속 project-planner 턴]** `spec/2-navigation/6-config.md §A.2` 구현 현황 주석을 편집 폼 완료 내용으로 갱신.
3. **[W-3 — 현 PR 커밋에 포함]** `plan/in-progress/spec-sync-config-gaps.md` 편집 폼 항목 `[x]` 체크, 완료 날짜·브랜치 기재.
4. **[I-1/I-2 — 후속 spec 갱신]** `spec/2-navigation/6-config.md §3` 또는 §A.2에 shallow-merge·비밀값 불변·type 불변 제약 명시 추가 (project-planner 위임).
5. **[I-4 — 선택적 개선]** `UpdateAuthConfigDto` `type?` 필드 description에 "편집 시 무시" 명시 또는 필드 제거 고려.