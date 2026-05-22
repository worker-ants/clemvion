# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 분석 개요

PROJECT.md §변경 시 동반 갱신 매트릭스를 SoT로 적재했습니다. 리뷰 대상 커밋의 변경 파일:

1. `codebase/backend/src/modules/triggers/triggers.service.ts`
2. `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
3. `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx`
4. `codebase/frontend/src/lib/i18n/dict/en/triggers.ts`
5. `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`
6. `plan/in-progress/trigger-detail-edit-meta.md`

---

## 발견사항

### [INFO] 백엔드 API 변경 시 swagger description 에 schedule 제한 미기술

- 변경 파일: `codebase/backend/src/modules/triggers/triggers.service.ts`
- 매트릭스 항목: "백엔드 API 추가·변경 — (a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
- 누락된 동반 갱신: `codebase/backend/src/modules/triggers/triggers.controller.ts` 의 `update` 엔드포인트 `@ApiOperation.description` 또는 `@ApiBadRequestResponse.description`
- 상세: `TriggersService.update` 에 schedule 타입 트리거는 `name`·`isActive` 외 키를 거부한다는 400 guard가 신설됐습니다. 컨트롤러의 `@ApiOperation.description`(현재: "트리거의 이름·활성 상태·설정·엔드포인트 경로·인증 설정을 수정합니다.") 과 `@ApiBadRequestResponse.description`(현재: "입력값 검증 실패")은 이 제한을 반영하지 않습니다. API 소비자(외부 개발자·문서)에게는 schedule 타입에 어떤 PATCH 필드가 허용되는지 swagger 문서에서 알 수 없습니다.
- 제안: `@ApiOperation.description` 을 "트리거의 이름·활성 상태·설정·엔드포인트 경로·인증 설정을 수정합니다. schedule 타입은 name·isActive 만 수정할 수 있으며, 그 외 필드는 400 VALIDATION_ERROR 를 반환합니다." 등으로 보강. `@ApiBadRequestResponse` 에 schedule 타입 제한 예시 추가 권장.

---

## i18n Parity 검증 결과

`triggers.detail.*` namespace KO/EN 양쪽 동일 커밋 내 추가 확인:

| 키 | KO | EN |
|---|---|---|
| edit | 수정 | Edit |
| save | 저장 | Save |
| saving | 저장 중... | Saving... |
| cancel | 취소 | Cancel |
| saved | 저장했어요 | Saved |
| saveFailed | 저장에 실패했어요 | Save failed |
| nameLabel | 이름 | Name |
| namePlaceholder | 트리거 이름 | Trigger name |
| endpointPathLabel | 엔드포인트 경로 | Endpoint path |
| endpointPathHelp | (KO) | (EN) |
| endpointPathChangeWarning | (KO) | (EN) |
| authTypeLabel | 인증 | Authentication |
| hmacHeaderLabel | 서명 헤더 | Signature header |
| hmacSecretLabel | 새 HMAC secret | New HMAC secret |
| hmacSecretHelp | (KO) | (EN) |
| bearerTokenLabel | 새 Bearer 토큰 | New Bearer token |
| bearerTokenHelp | (KO) | (EN) |
| editInSchedule | 스케줄 관리에서 편집 | Edit in Schedules |
| editInScheduleHelp | (KO) | (EN) |

KO 19개 = EN 19개. 누락 키 없음. **parity PASS.**

---

## 비매칭 trigger 확인

아래 trigger 는 이번 변경 set 과 무관합니다:

- 새 노드 추가 / 노드 schema 변경 — 해당 없음
- 통합 신규/제공자 변경 — 해당 없음
- 유저 가이드 신규 섹션 디렉토리 — 해당 없음
- 인증·권한·세션 흐름 변경 — `useHasRole("editor")` 사용은 기존 RBAC 훅 재사용이며 `codebase/backend/src/auth/**` 는 변경되지 않음
- 표현식 언어 변경 — 해당 없음
- 실행·디버깅 흐름 변경 — 해당 없음
- 신규 warningCode/errorCode — `VALIDATION_ERROR` 는 `error-codes.ts` 의 `ErrorCode` enum 신규 추가가 아닌 기존 공통 코드 재사용. backend-labels.ts 의 `ERROR_KO` 매핑 trigger 해당 없음

---

## 요약

PROJECT.md 매트릭스에서 확인한 11개 trigger 중 이번 변경 set 에 직접 매칭되는 trigger 는 2개(신규 UI 문자열, 백엔드 API 변경)입니다. 신규 UI 문자열 trigger 에 대해서는 `dict/ko/triggers.ts` + `dict/en/triggers.ts` 양쪽에 `triggers.detail.*` 19개 키가 동일 커밋 안에 정상 추가되어 i18n parity PASS입니다. 백엔드 API 변경 trigger 에서 컨트롤러 swagger `@ApiOperation.description` 이 schedule 타입 PATCH 제한을 기술하지 않아 INFO 1건을 발행합니다. 사용자 가이드 docs MDX 관련 누락은 없습니다. 발견 누락 1건 (INFO), 위험도 LOW.

## 위험도

LOW

---

STATUS=success ISSUES=1
