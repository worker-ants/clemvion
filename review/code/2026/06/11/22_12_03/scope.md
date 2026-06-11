# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] service.ts — `AUTH_CONFIG_RESOURCE_TYPE` 상수 추출 (부수 리팩토링)
- 위치: `auth-configs.service.ts` +3~4라인 (`const AUTH_CONFIG_RESOURCE_TYPE = 'auth_config'`)
- 상세: 기존 `reveal()` 에서 인라인 문자열 `'auth_config'` 로 쓰던 것을 상수로 추출하고, 신규 CRUD audit 호출과 기존 reveal 호출 모두 이 상수를 사용한다. 신규 기능 구현에 필요한 일관성 확보를 위한 최소 정리이며, 기존 reveal 쪽 코드도 동일 상수로 교체 (diff line: `-resourceType: 'auth_config',` → `+resourceType: AUTH_CONFIG_RESOURCE_TYPE`). 범위를 크게 벗어나지 않으나, 기존 reveal 라인 1건이 부수 변경된다.
- 제안: 수용 가능. 인라인 문자열 제거와 신규 상수 통합이 목적으로, 실질 동작 변경 없음. reveal 기존 동작에 영향 없다.

### [INFO] controller.ts — `@ApiForbiddenResponse` 설명 수정 (부수 수정)
- 위치: `auth-configs.controller.ts`, create/update/remove 핸들러의 `@ApiForbiddenResponse({ description: 'Editor 미만 권한' })` → `'Admin 미만 권한'`
- 상세: 원래 `Editor 미만 권한` 이었던 Swagger 문서 설명이 `Admin 미만 권한` 으로 수정됐다. 이 변경은 CRUD audit 로그 추가 작업(userId/ipAddress 전파)과 직접 관련 없다. 다만 해당 핸들러에 `@Roles('admin')` 데코레이터가 이미 붙어 있으므로, 이는 기존에 잘못된 문서 설명을 교정한 것으로 해석된다.
- 제안: 기능·동작 변경 없이 Swagger 문서 정확도를 개선한 수정이다. 오류 수정에 해당하므로 수용 가능하나, 순수 문서 수정이라 현재 작업 범위(audit 로그 추가)와는 직접 관련 없는 부수 변경이다.

### [INFO] service.spec.ts — 기존 테스트 케이스의 `reveal` 음성 케이스에 `audit.record.mockClear()` 추가 및 `expect(audit.record).not.toHaveBeenCalled()` 보강
- 위치: `auth-configs.service.spec.ts` `reveal` describe 블록 내 "잘못된 비밀번호 → 401" / "passwordHash 없음 → 401" 케이스
- 상세: `service.create()` 가 이제 `auth_config.create` audit를 기록하므로 기존 테스트에서 `audit.record` 가 create 단계에서 이미 호출된 상태가 된다. 이를 정리하고자 `audit.record.mockClear()` 가 추가됐으며, reveal 실패 케이스가 audit을 기록하지 않음을 명시적으로 검증하는 `expect(audit.record).not.toHaveBeenCalled()` 도 추가됐다. 이는 신규 기능(create audit) 도입에 따른 기존 테스트의 필수 보정이다.
- 제안: 수용. 새 기능 추가에 따른 테스트 적합 보정이며, 범위 이탈 아님.

### [INFO] service.spec.ts — reveal "올바른 비밀번호" 케이스에 `ipAddress: '1.2.3.4'` 검증 추가
- 위치: `auth-configs.service.spec.ts` reveal describe "올바른 비밀번호 → 평문 config 반환 + audit 기록" — `expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ ipAddress: '1.2.3.4' }))` 추가
- 상세: 기존 테스트에서 `ipAddress` 필드가 `objectContaining` 검증에 누락돼 있었다. 이번 변경에서 reveal 서비스 시그니처 자체는 변경되지 않았으나, 테스트가 ipAddress 를 검증하도록 보완됐다. 신규 CRUD 케이스 테스트와 일관성을 맞추기 위한 추가다.
- 제안: 수용. 기존 테스트의 검증 커버리지 개선. reveal 동작 변경 없음.

## 요약

이번 변경은 AuthConfig CRUD 4종(create/update/regenerate/remove)에 audit 로그 기록을 추가하는 목적에 집중돼 있다. 핵심 변경(AUDIT_ACTIONS 상수 추가, service 메서드 시그니처 userId/ipAddress 확장, controller @CurrentUser/@Req 전파, 테스트 CRUD audit 케이스 신규 추가, plan/spec 동기화)은 모두 선언된 작업 범위 내다. 부수 변경으로는 `@ApiForbiddenResponse` 설명 교정(Editor→Admin), `AUTH_CONFIG_RESOURCE_TYPE` 상수 추출로 기존 reveal 인라인 문자열 교체, reveal 음성 테스트의 mockClear 보강이 있으나 모두 소규모이고 실질 동작 변경 없이 정확도·일관성 개선에 해당한다. 불필요한 리팩토링, 무관 파일 수정, 기능 확장은 없다.

## 위험도

NONE
