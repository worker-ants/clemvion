# Requirement Review — authentication God Component 분리

리뷰 대상: `config-c1-auth-god-split` 브랜치 (9개 파일)
기준 spec: `spec/2-navigation/6-config.md` §A.1–A.4, §3 API 표

---

## 발견사항

### [INFO] spec frontmatter `code:` 목록에 신규 파일 미등록
- 위치: `spec/2-navigation/6-config.md` (frontmatter `code:` 키)
- 상세: spec frontmatter 가 `codebase/frontend/src/app/(main)/authentication/page.tsx` 하나만 열거한다. 이번 리팩토링으로 생성된 5개 신규 파일(`use-auth-config-form.ts`, `auth-config-create-form.tsx`, `auth-config-edit-dialog.tsx`, `auth-config-form-fields.tsx`, `auth-config-types.ts`)이 목록에 없다.
- 제안: spec-impl 연계 추적 목적이므로 기능 오류는 아니나, spec-coverage 도구가 신규 파일을 추적하지 못할 수 있다. `project-planner` 가 frontmatter `code:` 갱신 여부를 판단한다.

### [INFO] `openCreate` 가 폼 필드를 초기화하지 않음 — 설계 의도이나 경계 문서화 필요
- 위치: `use-auth-config-form.ts` L3006–3008
- 상세: `openCreate()` 는 `setMode("create")` 만 수행하고 기존 필드값을 그대로 둔다. 주석("close 가 초기화 담당")과 단위 테스트(`use-auth-config-form.test.tsx` L473–480)가 이 동작을 명시적으로 기록·검증한다. page.tsx 에서 `<Button onClick={form.openCreate}>` 는 다이얼로그 밖에서만 렌더되므로 현재 흐름에서는 edit → openCreate 직접 전환이 발생하지 않는다.
- 제안: 현행 구조상 안전하다. 추가 조치 불필요.

### [INFO] regenerate 후 `form.setGeneratedKey(secret)` — 폼 mode null 상태에서 표시 불가
- 위치: `page.tsx` L2342 (`if (secret) form.setGeneratedKey(secret)`)
- 상세: regenerate 는 Regenerate Confirmation 모달(생성/편집 다이얼로그 외부)에서 수행되므로 `form.mode === null` 인 상태에서 `setGeneratedKey` 가 호출된다. `AuthConfigCreateForm` 은 `form.mode === "create"` 일 때만 렌더되므로, regenerate 후 `generatedKey` 가 세팅되어도 화면에 표시되지 않는다. 이는 기존 page.tsx 의 `showDialog = false` 후 `setGeneratedKey(secret)` 호출과 동일한 기존 버그를 그대로 이전한 것이다.
- 제안: 순수 리팩토링 범위 내에서 기존 동작을 충실히 이전했다. regenerate 평문 표시 불가는 기존 버그이며 별도 이슈로 추적이 권장된다. 이번 PR 의 수정 대상은 아니다.

### [INFO] `pickPlaintextSecret` — `bearer_token` 응답 필드 체인 spec 일치 확인
- 위치: `auth-config-types.ts` L1551–1557, spec `spec/2-navigation/6-config.md` §A.4
- 상세: spec §A.4 는 마스킹 대상으로 `config.key / token / secret / password` 를 열거한다. `pickPlaintextSecret` 는 동일 순서(`key ?? token ?? secret ?? password`)로 평문을 추출한다. bearer_token 의 config JSONB 스키마(`{ token }`)와 정확히 일치한다. 단위 테스트 5개가 우선순위 체인 전체를 커버한다.
- 제안: 추가 조치 불필요.

---

## spec fidelity 점검

### spec §A.2 — 인증 방식별 설정 폼 필드

| spec 항목 | 코드 구현 | 일치 여부 |
|---|---|---|
| API Key 헤더명 default `X-API-Key` | `AUTH_CONFIG_DEFAULTS.apiKeyHeader = "X-API-Key"` | ✅ |
| api_key type 선택 시 Header 이름 입력 | `auth-config-form-fields.tsx` (`form.type === "api_key"` 조건 블록) | ✅ |
| HMAC header default `X-Hub-Signature-256` | `AUTH_CONFIG_DEFAULTS.hmacHeader` | ✅ |
| HMAC algorithm select: sha256/sha512 | `auth-config-form-fields.tsx` HMAC select | ✅ |
| Basic Auth username 평문, password masked input | `type="password"` 입력 + `showPassword` 조건 | ✅ |
| IP Whitelist 모든 type 공통(선택) | `form.type !== ""` 조건으로 textarea 노출 | ✅ |
| 편집 폼 type 변경 불가 | `AuthConfigEditDialog` → `typeDisabled={true}` | ✅ |
| 편집 폼 password 입력 없음 | `AuthConfigEditDialog` → `showPassword={false}` | ✅ |
| 편집 PATCH: name·IP·비-비밀 config 만 전송 | `buildAuthConfigUpdatePayload` (기존 파일 — 변경 없음) | ✅ |

### spec §A.4 — 평문 1회 표시 + Done 닫기

| spec 항목 | 코드 구현 | 일치 여부 |
|---|---|---|
| 발급 직후 평문 1회 표시 | `AuthConfigCreateForm` `generatedKey ?` 분기 | ✅ |
| "저장하라" 안내 문구 | `t("authentication.saveKeyNotice")` | ✅ |
| Copy 버튼 | `onCopy(generatedKey)` | ✅ |
| Done 클릭 → 다이얼로그 닫힘(평문 사라짐) | `form.close()` | ✅ |
| Reveal 30초 자동 hide | `window.setTimeout(() => setRevealedSecret(null), 30_000)` (page.tsx — 변경 없음) | ✅ |
| Reveal Admin+ 전용 | `{isAdmin && <Button ...>Reveal</Button>}` (page.tsx — 변경 없음) | ✅ |

### spec §3 API — Authentication API 표

| spec 항목 | 코드 구현 | 일치 여부 |
|---|---|---|
| POST `/auth-configs` | `apiClient.post("/auth-configs", payload)` | ✅ |
| PATCH `/auth-configs/:id` | `apiClient.patch(\`/auth-configs/${form.editTargetId}\`, payload)` | ✅ |
| POST `/auth-configs/:id/regenerate` | `apiClient.post(\`/auth-configs/${id}/regenerate\`)` (변경 없음) | ✅ |
| GET `/auth-configs` | `apiClient.get("/auth-configs")` (변경 없음) | ✅ |

---

## 기능 완전성 평가

이번 변경은 **순수 구조 리팩토링**이다. page.tsx 의 God Component(1,066줄 → 621줄)에서 다음 5개 파일로 폼 관련 로직을 분리했으며 새로운 기능은 추가되지 않았다:

1. `use-auth-config-form.ts` — 폼 상태(11개 `useState`) + dialogMode + 검증/수집 로직
2. `auth-config-create-form.tsx` — 생성 다이얼로그 (type 자유, password, 1회 평문 표시)
3. `auth-config-edit-dialog.tsx` — 편집 다이얼로그 (type 잠금, password 없음, Save)
4. `auth-config-form-fields.tsx` — 두 다이얼로그 공유 입력 필드 (`dialogMode` 분기 → capability prop 대체)
5. `auth-config-types.ts` — 공유 타입·상수·`pickPlaintextSecret`

spec §A.2–A.4 의 모든 비즈니스 규칙이 분리 후에도 동일하게 유지됨이 확인된다. 단위 테스트가 회귀를 가드한다:
- `auth-config-types.test.ts` — `pickPlaintextSecret` 우선순위 체인 5개 케이스 전수
- `authentication-form.test.tsx` — create 후 1회 평문 표시 + Done 닫기 시나리오
- `use-auth-config-form.test.tsx` — dialogMode 전환·필드 초기화·검증 분기 8개 케이스

엣지 케이스 처리:
- `openCreate` 미초기화 설계(`close` 위임) — 테스트에 기록 ✅
- `pickPlaintextSecret(undefined)` null 반환 ✅
- non-string 필드값 null 반환 ✅
- 빈 객체(`{}`) null 반환 ✅
- 빈 ipWhitelist 줄 필터링 ✅

TODO/FIXME/HACK/XXX 주석: 없음 ✅

---

## 요약

이번 변경은 기능을 추가·변경하지 않고 page.tsx 의 God Component 를 단일-목적 컴포넌트와 커스텀 훅으로 분리하는 순수 구조 리팩토링이다. spec §A.2–A.4 의 모든 비즈니스 규칙(type별 폼 필드·편집 제약·평문 1회 표시·IP Whitelist·RBAC 가드)이 분리 후에도 동일하게 구현되어 있다. `pickPlaintextSecret` 를 포함한 모든 코드 경로에서 적절한 반환값이 보장되며, 검증·에러 처리 로직이 `useAuthConfigForm` 훅으로 집중돼 테스트 가능성이 향상됐다. spec 미등록 신규 파일(frontmatter `code:` 목록 누락) 및 기존부터 존재한 "regenerate 평문 표시 불가" 버그가 INFO 로 발견됐으나 기능 요구사항 위반은 없다.

---

## 위험도

LOW
