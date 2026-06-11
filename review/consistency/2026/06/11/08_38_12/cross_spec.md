# Cross-Spec 일관성 검토 결과

**대상**: `plan/in-progress/auth-refresh-rotation-atomic.md`
**검토 모드**: `--spec`
**검토일**: 2026-06-11

---

## 발견사항

이 plan 은 두 가지 변경을 선언한다:
1. **코드 변경**: `auth.service.ts` `refresh()` 경로에 `dataSource.transaction` 추가 + `generateTokens()` optional `EntityManager` 파라미터
2. **Spec 변경**: `spec/data-flow/2-auth.md §1.4` 시퀀스 다이어그램에 단일 트랜잭션 박스(rect) 추가

실제 확인 결과, `spec/data-flow/2-auth.md §1.4` 는 **이미 해당 변경을 반영하고 있다** (rect 박스 + 원자성 노트 포함). 따라서 이 plan 의 spec 변경 사항은 실제로는 spec 에 이미 적용되어 있는 상태다.

### 1. 데이터 모델 충돌 — 없음

target 이 변경하는 엔티티는 `RefreshToken` (§2.18.1) 뿐이며, 스키마 불변(컬럼 추가·삭제 없음)이라 `spec/1-data-model.md §2.18.1` 과 충돌 없다. `generateTokens()` 의 optional `EntityManager` 파라미터는 DB 스키마와 무관한 서비스 레이어 변경이다.

### 2. API 계약 충돌 — 없음

`POST /api/auth/refresh` 의 request/response shape (쿠키 입력·`{ accessToken }` 응답) 은 변경 없다. `spec/data-flow/2-auth.md §1.4` 시퀀스 다이어그램과 `spec/5-system/1-auth.md` 모두 동일 계약을 유지한다.

### 3. 요구사항 ID 충돌 — 없음

target plan 은 새로운 요구사항 ID 를 부여하지 않는다. 원본 출처인 `plan/in-progress/refactor/05-database.md` C-1 ID 는 해당 plan 의 내부 태스크 ID 이며 타 spec 과 충돌하지 않는다.

### 4. 상태 전이 충돌 — 없음

`spec/data-flow/2-auth.md §3.1` 의 `refresh_token.is_revoked` 상태 머신은 변경 없다.
- `Active → Revoked: refresh 회전 (old row)` 전이는 그대로 유지된다.
- 원자화로 바뀌는 것은 revoke + INSERT 의 실행 순서 보장이지, 상태 전이 그래프 자체가 아니다.
- `spec/5-system/1-auth.md §1.4` 에도 상태 머신 정의 변경을 요구하는 내용이 없다.

### 5. 권한·RBAC 모델 충돌 — 없음

refresh token 회전은 인증된 사용자 자신의 토큰 작업이며 워크스페이스 RBAC(`owner/admin/editor/viewer`)와 무관하다.

### 6. 계층 책임 충돌 — 없음

변경은 `codebase/backend/src/modules/auth/auth.service.ts` 단일 서비스에 국한된다. `spec/0-overview.md §2.3 Core API Service` 의 인증 책임 정의와 일치한다.

### 7. [INFO] Spec 이미 반영됨 — plan 체크리스트 동기화 권장

- **target 위치**: `plan/in-progress/auth-refresh-rotation-atomic.md` `## 변경 > Spec` 항목 및 체크리스트 5번째 항목 (`/consistency-check --impl-done spec/data-flow/` BLOCK: NO)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/auth-refresh-rotation-atomic/spec/data-flow/2-auth.md §1.4`
- **상세**: plan 이 "Spec 변경 필요" 로 기술하는 내용(`§1.4` rect 박스 + 원자성 노트)이 현재 `spec/data-flow/2-auth.md §1.4` 에 이미 완전히 반영되어 있다. 즉 spec 선행 갱신이 완료된 상태이다. 모순이 아니라 plan 이 선행 완료된 spec 상태를 뒤따르는 정상 패턴이다.
- **제안**: 구현 착수 전 plan 의 spec 변경 체크 항목을 완료로 표시하거나, 이미 완료된 spec 상태임을 plan 에 명시해 두면 혼란을 방지할 수 있다. 필수 수정 아님.

---

## 요약

target plan(`auth-refresh-rotation-atomic`) 은 `refresh()` 의 revoke + INSERT 를 `dataSource.transaction` 으로 묶고 `spec/data-flow/2-auth.md §1.4` 에 트랜잭션 박스를 추가하는 좁은 범위의 변경이다. 검토 결과 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 기존 spec 과 충돌하지 않는다. `spec/data-flow/2-auth.md §1.4` 는 이미 해당 원자성 내용을 포함하고 있으므로 spec 변경은 사실상 선행 완료 상태이며, 코드 구현만 남아 있다. INFO 수준의 plan 내 동기화 권고 외에 차단 요소 없음.

---

## 위험도

NONE
