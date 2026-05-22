# 문서화(Documentation) 리뷰 결과

## 발견사항

### 1. 독스트링/JSDoc

- **[INFO]** `OverviewCard`, `ScheduleConfigurationCard`, `WebhookConfigCard` 함수에 JSDoc 없음
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` — 새로 추출된 3개 컴포넌트 함수
  - 상세: 기존 `ExternalInteractionCard`(`line 2521`)에는 JSDoc이 있으나 이번에 추가된 함수들은 props 설명 없이 TypeScript 타입만 선언. 파일 내 일관성이 깨짐.
  - 제안: 최소한 `OverviewCard`와 `WebhookConfigCard`에 `@param onSaved`의 역할(invalidate 콜백)을 한 줄이라도 문서화하거나, 기존 `ExternalInteractionCard`와 동일한 형식의 주석 블록 추가.

- **[INFO]** `TriggersService.update` 신규 guard 블록에 JSDoc 메서드 수준 문서 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 메서드 상단(라인 889)
  - 상세: `rotateNotificationSecret`(`line 1070`)·`revokePerTriggerToken`(`line 1098`) 등 다른 공개 메서드에는 JSDoc이 있으나 `update()` 자체에는 없음. schedule 타입 제한이라는 중요한 제약사항이 메서드 문서에 기록되지 않음.
  - 제안: `update()` 메서드 위에 JSDoc 추가, `@throws {BadRequestException}` — schedule 타입 트리거에 금지 키 입력 시 `VALIDATION_ERROR`, 참조 spec 명시.

---

### 2. 인라인 주석 정확성

- **[WARNING]** `getCurlExample()` 함수가 `authType`(저장된 값)을 사용하는데 편집 중 상태(`authTypeValue`)를 반영하지 않음 — 기존 주석 없이 동작의 의미가 불명확
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` `WebhookConfigCard` — `getCurlExample()` 함수
  - 상세: edit 모드에서 `authTypeValue`를 바꿔도 curl 예제는 저장된 `authType`을 기준으로 렌더됨. 이 의도적 설계인지 아닌지 코드상 언급이 없어 다음 개발자가 오해할 수 있음.
  - 제안: `// curl 예제는 편집 중 상태가 아닌 저장된 authType 을 기준으로 표시한다 (저장 후 갱신)` 한 줄 주석 추가.

- **[INFO]** `ExternalInteractionCard.handleSave()` 내부 `window.location.reload()` 주석이 현재 변경과 일관성 불일치
  - 위치: `codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx` 라인 2590–2591
  - 상세: `// 페이지 reload 대신 query invalidate 가 이상적이지만 본 PR 은 단순 reload` 라는 주석이 여전히 존재. 이번 PR에서 `OverviewCard`·`WebhookConfigCard`는 `queryClient.invalidateQueries`로 전환했으나 `ExternalInteractionCard`는 `window.location.reload()`를 그대로 유지. 주석이 "본 PR"을 지칭해 시간이 지날수록 오해를 유발할 수 있음.
  - 제안: "본 PR" 표현 제거, `// TODO: ExternalInteractionCard 도 invalidateQueries 로 전환 필요` 형태로 개선하거나 후속 plan 번호 참조 추가.

---

### 3. plan 문서 내 i18n 키 목록 불일치

- **[WARNING]** `plan/in-progress/trigger-detail-edit-meta.md` §3 i18n 키 목록이 실제 구현과 불일치
  - 위치: `plan/in-progress/trigger-detail-edit-meta.md` — "### 3. i18n" 섹션
  - 상세: plan에 기재된 키 이름(`triggers.detail.editName`, `triggers.webhook.editAuth.*`, `triggers.webhook.hmacSecretHelp`, `triggers.schedule.editInSchedule` 등)과 실제 구현된 i18n 키(`triggers.detail.edit`, `triggers.detail.hmacSecretLabel`, `triggers.detail.editInSchedule` 등)가 다름. plan 문서의 i18n 섹션 체크박스가 unchecked 상태로 남아있어 작업이 완료되지 않은 것처럼 보임.
  - 제안: 구현된 실제 키 이름으로 plan §3를 업데이트하고 항목에 `[x]` 체크 표시.

---

### 4. 설정 문서 / write-only 동작 안내

- **[INFO]** `hmacSecret` / `bearerToken` 의 write-only 동작(빈 값이면 기존 유지)이 API 수준에서 문서화되지 않음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 메서드 / `UpdateTriggerDto`
  - 상세: write-only 필드의 "빈 값이면 유지" 동작은 실제로 `service.update()` 내부에서 `config` JSONB 전체를 프론트에서 받아 그대로 저장하는 방식으로 구현됨. DTO나 서비스 레벨에 설명이 없어 API 소비자가 의도를 파악하기 어려움. 이번 commit message에는 기술되어 있으나 코드 내 문서에는 없음.
  - 제안: `UpdateTriggerDto` 내 `config` 필드 또는 `update()` 메서드 주석에 "hmacSecret·bearerToken 은 config 내 필드. 빈 값을 보내면 클라이언트가 기존 값을 그대로 포함해 전달해야 한다 (서버는 config 를 통째로 교체함)" 기술.

---

### 5. README / API 문서

- **[INFO]** `PATCH /api/triggers/:id` 의 schedule 타입 제한 사항이 API 문서에 반영 필요
  - 위치: 별도 API 문서 파일 (OpenAPI spec 등)이 있다면 해당 파일
  - 상세: schedule 타입 트리거에 대해 `name`·`isActive` 외 필드 변경이 400으로 거부되는 제약은 주요 breaking constraint임. 이 제약이 API 문서(Swagger/OpenAPI) 또는 spec 문서에 반영되었는지 확인 필요. `spec/2-navigation/2-trigger-list.md §3` 참조가 commit에 언급되어 있으나 spec 파일 자체의 변경은 이번 diff에 포함되지 않음.
  - 제안: spec 문서에 schedule 타입 PATCH 제한 및 400 에러 코드 테이블 존재 여부 확인 후 필요시 추가.

---

### 6. CHANGELOG

- **[INFO]** CHANGELOG 업데이트 없음
  - 상세: 사용자에게 노출되는 동작 변경(트리거 상세 드로어에서 name/endpoint 편집 가능, schedule deep link 추가, RBAC 가드) 및 API 동작 변경(schedule 타입 PATCH 제한)이 포함된 주요 기능 추가이나 CHANGELOG 파일 변경이 diff에 없음. 이 프로젝트가 CHANGELOG를 관리하지 않는 정책이라면 무시 가능.
  - 제안: 프로젝트 정책에 따라 CHANGELOG에 `feat(triggers)` 항목 추가 고려.

---

## 요약

이번 변경은 커밋 메시지와 plan 문서에 변경 의도가 상세히 기술되어 있고, 백엔드 guard 블록에 spec 섹션 참조 주석이 포함되어 있어 전반적인 문서화 수준은 양호하다. 다만 새로 추출된 `OverviewCard`·`WebhookConfigCard`·`ScheduleConfigurationCard` 함수에 JSDoc이 없어 기존 `ExternalInteractionCard`와 일관성이 깨지고, `update()` 메서드에 schedule 타입 제한이라는 중요한 제약사항이 메서드 수준 문서에 기록되지 않은 점이 아쉽다. `ExternalInteractionCard` 내 "본 PR" 지칭 주석이 시간이 지날수록 오해를 유발할 수 있고, plan §3 i18n 키 목록이 실제 구현 키와 달라 plan 문서의 완료 상태가 불명확한 점도 개선이 필요하다. write-only 필드(hmacSecret·bearerToken)의 서버 측 동작 방식이 코드 레벨 문서에 기술되지 않아 API 소비자에게 혼란을 줄 수 있는 부분도 경미한 위험 요소이다.

## 위험도

LOW
