# 변경 범위(Scope) 리뷰 결과

## 발견사항

### 발견사항 없음 — 모든 변경이 의도 범위 내

각 파일별 확인 내역:

**파일 1: auth-configs.service.spec.ts**
- **[INFO]** 4개 신규 테스트 케이스 추가 (비-비밀 shallow-merge·마스킹값 역류 무시·config 미전달 시 불변·ipWhitelist 빈 배열 비움)
  - 위치: `describe('CRUD audit 기록')` 블록 내 4개 `it` 추가 (diff 35~111)
  - 상세: 서비스 `update` 메서드의 새 shallow-merge 동작을 직접 검증. 기존 테스트 수정 없이 순수 추가.
  - 범위 판정: 적합. 구현된 서비스 로직 변경(파일2)에 대응하는 테스트 보강이며 관련 없는 기존 케이스 변경 없음.

**파일 2: auth-configs.service.ts**
- **[INFO]** `update` 메서드 1개 변경 — `Object.assign(config, data)` 단일 줄 → config shallow-merge + SECRET_CONFIG_KEYS 필터링 블록으로 교체
  - 위치: diff 183~904 (실제 변경은 `Object.assign(config, data)` 한 줄 → 16줄 블록)
  - 상세: 편집 폼이 마스킹된 비밀값을 역류시켜도 실 비밀이 파손되지 않도록 하는 안전성 수정. 다른 메서드·클래스 구조·임포트 무변경.
  - 범위 판정: 적합. 편집 폼 신설에 필수 수반되는 백엔드 fix.

**파일 3: update-auth-config.dto.ts**
- **[INFO]** `config` 필드의 `@ApiPropertyOptional` 설명 문자열 갱신 — "대체" → "shallow-merge + 비밀값 불변" 명시
  - 위치: diff 34~89 (description 3줄 교체)
  - 상세: Swagger 문서 설명이 실제 동작(shallow-merge)과 일치하도록 갱신. 유효성 검증 데코레이터·타입 무변경.
  - 범위 판정: 적합. 구현 변경에 동반되는 API 문서 동기화.

**파일 4: auth-config-form.test.ts**
- **[INFO]** `buildAuthConfigUpdatePayload`·`formStateFromAuthConfig` 두 함수의 테스트 2개 블록(8개 케이스) 추가 및 임포트 2개 추가
  - 위치: diff 4~8 (임포트), diff 117~668 (테스트 블록 추가)
  - 상세: 신규 순수 함수(파일6 추가분)에 대응하는 단위 테스트. 기존 `buildAuthConfigPayload`·`validateAuthConfigForm` 테스트 무변경.
  - 범위 판정: 적합. 신규 함수에 1:1 대응.

**파일 5: authentication-form.test.tsx**
- **[INFO]** `patchMock` 변수 추가 및 기존 `vi.fn()` 인라인을 추적 가능 mock 으로 교체, 편집 폼 E2E 시나리오 3개 블록 추가
  - 위치: diff 16~83 (mock 추가), diff 127~2031 (edit describe 블록 추가)
  - 상세: 기존 create describe 는 건드리지 않음. `patchMock` 을 `vi.fn()` 인라인에서 모듈 수준 변수로 올린 것은 새 edit 테스트가 `.mock.calls` 를 참조하는 데 필요 — 필수 변경.
  - 범위 판정: 적합. 편집 폼 통합 테스트 추가이며 기존 create 경로에 영향 없음.

**파일 6: auth-config-form.ts**
- **[INFO]** `AuthConfigUpdatePayload` 인터페이스·`buildAuthConfigUpdatePayload` 함수·`formStateFromAuthConfig` 함수 3개 추가
  - 위치: diff 103~325 (pure 함수 3개 추가)
  - 상세: 기존 `buildAuthConfigPayload`·`validateAuthConfigForm` 무변경. 신규 함수만 추가. 임포트 변경 없음.
  - 범위 판정: 적합. 편집 폼 페이로드 조립 로직 분리 — 테스트 가능성 확보 목적.

**파일 7: page.tsx**
- **[INFO]** 편집 모드 관련 state 2개(`dialogMode`·`editTargetId`) 추가, `updateMutation` 추가, `handleEditClick`·`handleUpdate` 함수 추가, JSX 분기 추가(다이얼로그 title·type 잠금·password 조건부 렌더·Save/Create 버튼 분기·Edit 버튼), `Pencil` 아이콘 임포트 추가, `ipWhitelist` 필드를 `AuthConfig` 인터페이스에 추가
  - 위치: diff 전체 (~150줄 추가)
  - 상세: 기존 create 흐름 손상 없이 edit 분기를 오버레이. `resetForm` 에 `dialogMode`/`editTargetId` 초기화 추가 — 누락 시 상태 오염이 발생하므로 필수. `Pencil` 임포트는 실제 사용.
  - 범위 판정: 적합. 편집 폼 신설을 위한 최소 UI 변경.

**파일 8: en/authentication.ts**
- **[INFO]** 편집 폼 관련 i18n 키 3개 추가 (`editConfigDialogTitle`·`editButton`·`editTypeLocked`)
  - 위치: diff 24~26
  - 상세: page.tsx 에서 참조하는 `t(...)` 키와 1:1 대응. 기존 키 변경 없음.
  - 범위 판정: 적합.

**파일 9: ko/authentication.ts**
- **[INFO]** 동일 3개 키의 한국어 번역 추가
  - 위치: diff 22~24
  - 범위 판정: 적합. en 딕셔너리와 대칭 유지.

**파일 10: plan/in-progress/spec-sync-config-gaps.md**
- **[INFO]** `§A.2 편집 폼` 항목을 `[ ]` → `[x]` 로 완료 표시 + 구현 요약 + 하위 체크리스트(TEST·ai-review·consistency-check) 추가
  - 위치: diff 22~24
  - 상세: plan 파일은 구현 완료 후 체크 및 후속 절차 기록이 프로젝트 규약(`plan 체크박스 = 실제 상태`).
  - 범위 판정: 적합.

---

## 요약

10개 변경 파일 전체가 "인증 설정 편집 폼 신설 (§A.2)" 단일 목적에 정확히 집중되어 있다. 백엔드는 `update` 메서드의 config wholesale-replace 버그를 편집 폼 신설에 필수 연동하여 shallow-merge + 비밀값 보호로 수정하였고, 프론트엔드는 순수 함수(`buildAuthConfigUpdatePayload`, `formStateFromAuthConfig`)·페이지 분기·i18n 키를 최소 범위로 추가하였다. 기존 생성(create)/재발급(regenerate)/삭제(remove) 경로에 대한 수정은 없으며, 범위를 벗어난 리팩토링·불필요한 포맷팅·무관한 파일 변경도 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
