# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-done` (구현 완료 후)
대상 범위: `spec/2-navigation/6-config.md`, diff-base: `origin/main`

---

## 발견사항

### 발견사항 없음 (INFO 수준 보완 제안 1건)

- **[INFO]** `authentication.editButton` vs `common.edit` — 기능 중복 가능성
  - target 신규 식별자: `authentication.editButton` (ko: `"편집"`, en: `"Edit"`)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/frontend/src/lib/i18n/dict/en/common.ts` line 7 `edit: "Edit"`, ko dict line 5 `edit: "수정"` — 이미 `common.edit` 키가 존재하며, `/Volumes/project/private/clemvion/codebase/frontend/src/app/(main)/workflows/page.tsx` line 587, `/Volumes/project/private/clemvion/codebase/frontend/src/components/models/model-config-manager.tsx` line 241 에서 사용 중
  - 상세: `authentication.editButton`("편집"/"Edit") 은 `common.edit`("수정"/"Edit") 과 실질적으로 동일한 레이블이지만, ko 번역이 다름 (`"편집"` vs `"수정"`). 이는 충돌이 아니라 의도적 분리로 보이지만, 장기적으로 ko 표현 불일치가 발생할 수 있다. 단 `authentication.editButton` 은 `aria-label` 로만 쓰이고 버튼 텍스트가 없는 icon 버튼이므로 시각적 혼선은 없다.
  - 제안: 현행 유지 허용. 단 ko 표현 통일이 필요하다면 `common.edit`("수정") 대신 `authentication.editButton`("편집") 으로 ko 표현을 "편집" 으로 맞추거나, 둘 다 "수정" 으로 통일하는 것을 고려할 수 있다. 기능 충돌이 아니므로 차단 사항은 아님.

---

## 검토 항목별 결과

### 1. 요구사항 ID 충돌
신규 커밋이 명시적으로 새 요구사항 ID를 부여하지 않는다. `§A.2` 는 기존 스펙에 이미 정의된 섹션 참조이며 의미 변경 없이 재활용된다. **충돌 없음**.

### 2. 엔티티/타입명 충돌
- `AuthConfigUpdatePayload` (frontend, `/Volumes/project/private/clemvion/codebase/frontend/src/app/(main)/authentication/auth-config-form.ts`): 기존 코드베이스 및 스펙에 동일 이름 없음. 백엔드에는 `UpdateAuthConfigDto`가 존재하나, 이는 NestJS DTO 클래스이고 `AuthConfigUpdatePayload`는 프런트엔드 전용 순수 타입으로 네임스페이스가 분리된다. **충돌 없음**.
- `AuthConfigFormState`, `AuthConfigPayload` — 기존 export 이고 이번 diff 가 새로 도입한 식별자가 아님. **충돌 없음**.
- 내부 헬퍼 `buildTypeConfig` — unexported 함수로 모듈 외부에 노출되지 않음. **충돌 없음**.

### 3. API endpoint 충돌
`PATCH /api/auth-configs/:id` 엔드포인트는 `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` line 261 에 이미 정의된 기존 엔드포인트이며, 이번 diff 는 새 경로를 추가하지 않고 기존 경로의 동작(shallow-merge 방식)만 변경한다. **충돌 없음**.

### 4. 이벤트/메시지명 충돌
이번 diff 는 webhook, queue, SSE 이벤트 이름을 신규 도입하지 않는다. **충돌 없음**.

### 5. 환경변수·설정키 충돌
신규 ENV var 또는 config key 없음. **충돌 없음**.

### 6. 파일 경로 충돌
변경 파일 목록:
- `codebase/backend/src/modules/auth-configs/auth-configs.service.spec.ts` — 기존 파일
- `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` — 기존 파일
- `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts` — 기존 파일
- `codebase/frontend/src/app/(main)/authentication/__tests__/auth-config-form.test.ts` — 기존 파일
- `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` — 기존 파일
- `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` — 기존 파일
- `codebase/frontend/src/app/(main)/authentication/page.tsx` — 기존 파일
- `codebase/frontend/src/lib/i18n/dict/en/authentication.ts` — 기존 파일
- `codebase/frontend/src/lib/i18n/dict/ko/authentication.ts` — 기존 파일

신규 파일 생성 없음. **충돌 없음**.

### 신규 i18n 키 확인
- `authentication.editConfigDialogTitle` — 기존 dict 에 없었던 신규 키. `addConfigDialogTitle` 과 대칭 구조로 명명 일관성 유지. **충돌 없음**.
- `authentication.editButton` — 기존 dict 에 없었던 신규 키. `common.edit`("수정"/"Edit") 과 유사하나 같은 네임스페이스 내 충돌은 아님 (INFO 참조).
- `authentication.editTypeLocked` — 기존 dict 에 없었던 신규 키. **충돌 없음**.
- `authentication.configUpdated`, `authentication.configUpdateFailed` — `origin/main` 에 이미 존재하던 키. diff 가 새로 추가한 것이 아님. **충돌 없음**.

### `SECRET_CONFIG_KEYS` (backend)
`origin/main` 의 `auth-configs.service.ts` line 26 에 이미 정의된 상수. 이번 diff 는 이 상수를 새로 추가하지 않고 기존 `update()` 메서드 내에서 활용하는 로직만 추가한다. **충돌 없음**.

---

## 요약

이번 구현 diff 가 도입하는 신규 식별자(`buildAuthConfigUpdatePayload`, `formStateFromAuthConfig`, `AuthConfigUpdatePayload`, `buildTypeConfig`, `dialogMode`, `editTargetId`, `updateMutation`, `validateAndProceed`, `handleEditClick`, `handleUpdate`, i18n 키 3종)는 기존 코드베이스·스펙·플랜 어느 곳에서도 다른 의미로 사용된 동일 이름이 없다. API endpoint, DTO 클래스, 이벤트·큐·ENV var 차원의 충돌도 없다. `authentication.editButton` 이 `common.edit` 과 영문은 동일하지만 ko 번역이 다른 점은 의도적 분리로 보이며, aria-label 전용 사용이므로 사용자 혼선을 직접 유발하지 않는다.

---

## 위험도

NONE
