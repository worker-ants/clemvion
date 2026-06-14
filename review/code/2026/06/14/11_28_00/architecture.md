# Architecture Review — config-auth-edit-form

## 발견사항

### [INFO] 레이어 책임 분리 — 순수 함수 모듈 분리 적절
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts`
- 상세: `buildAuthConfigPayload`, `buildAuthConfigUpdatePayload`, `formStateFromAuthConfig`, `validateAuthConfigForm` 모두 순수 함수로 분리되어 프레젠테이션 레이어(`page.tsx`)와 비즈니스 로직이 명확히 분리된다. 단위 테스트(`auth-config-form.test.ts`)가 독립적으로 가능한 구조다.
- 제안: 현행 유지.

### [INFO] SECRET_CONFIG_KEYS 상수 — 단일 진실 적용
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L938
- 상세: `SECRET_CONFIG_KEYS = new Set(['key', 'token', 'secret', 'password'])` 가 마스킹(`maskConfig`)과 update 시 비밀값 필터(`update` 메서드) 두 곳에서 공유된다. 비밀 키 목록의 단일 진실이 잘 지켜지고 있다.
- 제안: 현행 유지.

### [WARNING] page.tsx — 다중 책임(Fat Component) 심화
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx`
- 상세: 이번 변경으로 `dialogMode`, `editTargetId`, `handleEditClick`, `handleUpdate`, `updateMutation`이 동일 컴포넌트에 추가됐다. 이미 create·toggle·regenerate·delete·reveal·usage 6개의 Mutation과 상태 관리가 집중된 파일에 edit 흐름이 더해지면서 단일 책임 원칙(SRP)이 추가로 희석된다. 파일 전체 상태 변수(`useState`) 수가 이번 추가분(2개)을 포함해 10개 이상이다.
- 제안: 단기적으로는 현행 구조가 수용 가능하나, 중기적으로 `useAuthConfigEditDialog` 커스텀 훅 또는 별도 `AuthConfigEditDialog` 컴포넌트로 edit 흐름을 추출하면 응집도를 개선할 수 있다.

### [WARNING] create/edit 폼 공유 — 암묵적 dialogMode 분기 확산
- 위치: `codebase/frontend/src/app/(main)/authentication/page.tsx` — `showDialog` 블록 전체
- 상세: 동일 JSX 폼을 `dialogMode === "edit"` 분기로 재사용하는 패턴은 초기 코드량을 줄이지만, 두 모드의 차이(type 비활성화, password 필드 숨김, 버튼 레이블/핸들러 분기)가 JSX 곳곳에 흩어진다. 이는 개방-폐쇄 원칙(OCP) 관점에서 새 모드 추가 시 기존 코드를 지속적으로 수정해야 하는 구조다. 현재 분기점이 3곳(type 비활성, password 숨김, 버튼)이지만 향후 편집 전용 필드가 생기면 분기가 더 증가한다.
- 제안: 분기가 5곳을 초과하거나 편집 전용 UI 요소가 추가될 시점에 `CreateAuthConfigDialog` / `EditAuthConfigDialog` 를 별도 컴포넌트로 분리하는 것을 고려. 현재 규모에서는 허용 범위.

### [INFO] 백엔드 update — shallow-merge 보안 패치 설계
- 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L1095–L1111
- 상세: `Object.assign(config, data)` → `const { config: configPatch, ...rest } = data; Object.assign(config, rest)` 로 변경 후, `configPatch` 의 비밀 키를 건너뛰는 루프를 추가한 패치는 책임 분리가 서비스 계층 내에서 명확하다. 비밀 보호 정책이 서비스 레이어에 집중돼 컨트롤러나 DTO가 실수로 우회해도 방어가 유지된다(Defense in Depth).
- 제안: 현행 유지. 다만 `SECRET_CONFIG_KEYS` 가 서비스 파일 모듈 레벨 상수로만 존재하므로, 향후 다른 서비스에서 같은 마스킹 로직이 필요해질 경우 공유 상수/유틸로 추출을 검토.

### [INFO] DTO 문서화 — API 계약 명시
- 위치: `codebase/backend/src/modules/auth-configs/dto/update-auth-config.dto.ts`
- 상세: `@ApiPropertyOptional` 설명에 shallow-merge 정책과 비밀값 불변 규칙을 명시한 것은 API 계약의 레이어 경계를 DTO 수준에서 선언적으로 표현한 좋은 패턴이다.
- 제안: 현행 유지.

### [INFO] formStateFromAuthConfig — hmacAlgorithm 화이트리스트 하드코딩
- 위치: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` L2482
- 상세: `cfg.algorithm === "sha512" ? "sha512" : AUTH_CONFIG_DEFAULTS.hmacAlgorithm` 로 sha512만 명시 분기하고, 나머지는 모두 default(sha256)로 fallback한다. 백엔드의 `HMAC_ALLOWED_ALGORITHMS = new Set(['sha256', 'sha512'])` 와 대칭이나, sha512 외 다른 값이 서버 응답에 포함되면 sha256으로 사일런트 강등된다.
- 제안: 프론트엔드 허용 알고리즘 목록을 `const HMAC_ALGORITHMS = ['sha256', 'sha512'] as const` 형태로 선언해 타입 안전성을 높이고, 허용 목록 기반 분기로 교체.

### [INFO] 모듈 경계 — 프론트/백 비밀 필터링 이중 방어
- 위치: `auth-config-form.ts` `buildAuthConfigUpdatePayload` + `auth-configs.service.ts` `update`
- 상세: 프론트엔드는 페이로드에서 비밀값을 처음부터 포함하지 않고(password 미전송), 백엔드는 전달된 config에서 SECRET_CONFIG_KEYS를 무시한다. 양 레이어에서 이중으로 비밀 보호가 시행되는 Defense in Depth 구조다. 모듈 경계가 명확하다.
- 제안: 현행 유지.

### [INFO] 순환 의존성 — 없음
- 위치: 전체 변경 파일
- 상세: `auth-config-form.ts`(순수 유틸) ← `page.tsx`(컴포넌트) 단방향. 백엔드 `auth-configs.service.ts` 가 `audit-logs`, `executions`, `triggers`, `users` 를 참조하나 역방향 의존 없음. 순환 의존 없음.
- 제안: 현행 유지.

---

## 요약

이번 변경의 아키텍처 핵심은 두 가지다. (1) 백엔드: `update` 메서드의 `Object.assign` 통째 대체를 shallow-merge + SECRET_CONFIG_KEYS 필터로 교체해 암호화 비밀값 파손 잠재 버그를 서비스 레이어에서 방어한 보안 패치로, 책임 분리와 Defense in Depth 관점에서 적절하다. (2) 프론트엔드: 순수 함수(`buildAuthConfigUpdatePayload`, `formStateFromAuthConfig`)를 `auth-config-form.ts`에 추가해 레이어 분리를 유지한 점은 긍정적이나, `page.tsx`의 Fat Component 경향은 이번 추가로 더 심화됐다. 현재 규모에서는 허용 가능하지만 편집 흐름을 커스텀 훅 또는 별도 Dialog 컴포넌트로 분리하는 중기 리팩터링이 권장된다. 전체적으로 모듈 경계, 단일 진실 원칙, 양 레이어의 이중 비밀 보호 설계는 견고하다.

## 위험도

LOW

STATUS: SUCCESS
