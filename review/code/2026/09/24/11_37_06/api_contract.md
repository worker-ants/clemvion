# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 이전 라운드(`review/code/2026/09/24/11_10_45`)에서 지적된 breaking wire 코드 변경(`CANNOT_REMOVE_OWNER` → `ADMIN_REQUIRED`, 비-admin 멤버가 owner 를 지목하는 경우)이 이번 라운드에서 `CHANGELOG.md` 에 명시 고지됐다 — 조치 완료 확인
  - 위치: `CHANGELOG.md:28-30`("계약 변경 고지" 문단)
  - 상세: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 의 `removeMember()` 에서 admin 판정을 owner 판정보다 앞으로 옮기면서(게이트 843~850행) 이 wire 코드가 바뀐다. HTTP 상태는 403 으로 동일해 클라이언트의 상태코드 분기는 깨지지 않지만, 에러 `code` 값으로 분기하는 호출자가 있다면 영향을 받는다. 사내 프런트(`RoleGate minRole="admin"` 로 버튼 자체가 가려지고 `message` 텍스트만 소비)는 영향이 없음이 실측 확인됐고, 이번 CHANGELOG 항목이 계약 변경 사실 자체를 이력에 남겨 향후 회귀 추적이 가능해졌다. 추가 조치 불필요.
  - 제안: 없음(완결).

- **[INFO]** `spec/5-system/1-auth.md:551`·`spec/5-system/3-error-handling.md:46`(`ADMIN_REQUIRED` 카탈로그 발행처 단수 서술)·`3-error-handling.md:49`(`NOT_A_MEMBER` 카탈로그 경로 열거 누락)가 이번 리팩터로 stale 해졌으나, `developer` 쓰기 권한 밖(`spec/`)이라 이번 라운드에서 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 항목으로 정확히 이관됐다 — 처리 적절
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4954-4969`(새 체크리스트 항목, 표로 세 자리를 열거) — 실제 stale 서술은 `spec/5-system/1-auth.md:551`(`Read` 로 직접 확인), `spec/5-system/3-error-handling.md:46`·`:49`(`Read` 로 직접 확인)
  - 상세: `removeMember()` 는 더 이상 `assertAdmin()` 을 호출하지 않고(`workspaces.service.ts` 게이트 831~832행 `getMemberRole` 직접 호출 + `throwAdminRequired()`), 위 세 줄은 그 옛 호출 경로를 근거로 서술돼 있다. 결론(Admin 이 멤버 삭제 가능·`ADMIN_REQUIRED`=403 의미)은 여전히 참이라 기능적 위험은 없고, `CLAUDE.md` 의 자기-반증형 소정정 예외 대상도 아니라고 plan 이 스스로 정확히 판단했다(그 문장을 developer 가 쓴 것도 아니고 API 계약 서술이라 조건 2 배제). 처리 방식 자체가 규약에 맞다.
  - 제안: 없음(이관 완료, planner 턴 대기).

- **[INFO]** 신규 e2e 테스트가 검증하는 에러 응답 포맷·HTTP 상태가 기존 컨벤션과 일관됨을 확인
  - 위치: `codebase/backend/test/workspace-rbac.e2e-spec.ts:669-732`(신규 `it` 블록), `codebase/backend/src/modules/workspaces/workspaces.service.ts:913-926`(`throwNotAMember`/`throwAdminRequired`)
  - 상세: `ForbiddenException({code, message})` 페이로드는 `GlobalExceptionFilter` 가 `{error: {code, message}}` 봉투로 감싸는 기존 §5.3 응답 스키마를 그대로 따른다(`codebase/backend/src/common/filters/http-exception.filter.ts` 확인). `NOT_A_MEMBER` 의 HTTP 상태(403)도 `3-error-handling.md` 카탈로그와 일치한다. 컨트롤러 라우트(`workspaces.controller.ts:355-374`) 는 URL 경로·`ParseUUIDPipe` 요청 검증·Swagger 응답 문서화 스타일(다른 Admin+ 라우트와 동일하게 코드값 대신 산문 설명)을 그대로 유지해 이번 diff 로 인한 URL/검증/문서화 계약 이탈은 없다.
  - 제안: 없음.

- **[INFO]** 이 diff 는 버전 관리·페이지네이션 대상 API 를 건드리지 않는다
  - 위치: 해당 없음
  - 상세: `DELETE /api/workspaces/:id/members/:memberId` 단일 라우트의 서비스-계층 인가 순서 재배치이며, API 버전 스킴 변경이나 목록/페이지네이션 엔드포인트 변경이 없다.
  - 제안: 없음.

## 요약

이번 라운드는 직전 라운드(`11_10_45`)의 API-Contract 관련 지적(비-admin 멤버가 owner 를 지목할 때 wire 코드 `CANNOT_REMOVE_OWNER`→`ADMIN_REQUIRED` 변경을 CHANGELOG 에 고지, `1-auth.md:551`·`3-error-handling.md:46`·`:49` 의 stale 서술을 developer 권한 밖이므로 planner 백로그로 이관)를 정확히 마무리했다. `removeMember()` 인가 순서 재배치 자체는 비-멤버가 대상의 존재·owner 여부를 응답 차이로 알아내던 정보 노출(오라클)을 닫는 하위 호환 유지 수정이며, 에러 응답 포맷(`{error:{code,message}}`)·HTTP 상태(403)·URL/경로·요청 검증(`ParseUUIDPipe`)은 기존 컨벤션과 일관된다. 유일한 실질 계약 변경(비-admin↔owner 조합의 wire 에러 코드)은 사내 클라이언트에 영향이 없음이 실측됐고 이번에 CHANGELOG 로 고지가 완결됐으며, 남은 stale spec 서술 세 곳은 developer 쓰기 권한 밖이라 planner 항목으로 올바르게 이관돼 있어 이번 라운드에서 새로 차단할 API 계약 이슈는 없다.

## 위험도

LOW
