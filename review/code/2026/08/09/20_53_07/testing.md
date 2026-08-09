STATUS=success

===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — 반증된 앵커 정정 (nil-UUID 회귀 캐너리)

## 변경 성격 요약

4개 파일 모두 **JSDoc/plan 주석 텍스트 정정**이며, 실행 코드·테스트 단언(assertion)은 한 글자도
바뀌지 않았다.

- `codebase/backend/src/common/utils/uuid.ts` — `isUuidShaped` 함수 위 JSDoc 문단만 교체 (함수 바디 `UUID_SHAPE_PATTERN`/`isUuidShaped` 로직 불변)
- `codebase/backend/src/common/utils/uuid.spec.ts` — `it('accepts UUID-shaped values...')` 위 JSDoc 주석만 교체, `it()` 블록 내부(65~74행)는 unified diff 밖 — 실측 확인 결과 원문 그대로
- `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts` — `NIL_WS` 상수 위 JSDoc 주석만 교체, 값(`'00000000-0000-0000-0000-000000000000'`)은 불변
- `plan/in-progress/auth-guard-reflection-hardening.md` — 취소선 처리 + 정정 각주 추가(문서 위생)

## 사실관계 검증 (테스트 신뢰성 관점에서 직접 확인)

이 주석 정정이 지목하는 새 "회귀 캐너리" 주장이 실제로 유효한지 소스를 직접 열어 대조했다.

1. `system-status.controller.ts` 에 `@Roles()`/`@WorkspaceId()` 데코레이터가 없음 — 확인됨 (`@Controller('system-status')` + `@Get('overview')` 뿐).
2. `roles.guard.spec.ts:333` 에 "단축이 헤더 파싱보다 먼저다" 테스트 존재 — 확인됨.
3. `workspace-context.util.spec.ts:131` 에 nil UUID 통과 테스트(`'Postgres 가 파싱할 수 있는 값은 통과시킨다 (nil UUID — 403 이 400 으로 뒤바뀌지 않도록)'`) 존재, `ctx.workspaceId === NIL_WS` 및 `membershipUnverified === true` 단언 확인됨.
4. `isUuidShaped` 프로덕션 호출부가 `workspace-context.util.ts:74` 단 한 곳이라는 주장 — `grep` 결과 확인됨(다른 소스에서 호출 없음).

네 주장 모두 실측으로 뒷받침되며, 주석 정정 내용 자체는 정확하다. (이는 코드 실행 로직이 아니라 문서 신뢰도에 대한 검증이지만, 이 커밋의 유일한 목적이 "반증된 문서 주장 정정"이므로 테스트 리뷰 범위에 포함해 확인했다.)

## 발견사항

- **[INFO]** "진짜 회귀 캐너리"라는 서술이 산문(comment)에만 존재하고 이를 자동으로 강제하는 장치가 없다
  - 위치: `codebase/backend/src/common/utils/uuid.ts` JSDoc 앵커 정정 문단(27~32행) / `codebase/backend/src/common/utils/uuid.spec.ts` JSDoc(54~63행) / `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts` JSDoc(53~59행)
  - 상세: 이번 커밋 메시지 자체가 밝히듯, 동일한 "system-status e2e 가 캐너리다"라는 **반증된 주장이 4곳(plan 2곳 + `codebase/` 3곳)에 반복 복제**되어 있다가 이번에 정정됐다. 이 클래스의 결함(한 곳만 고치고 나머지 복제본이 stale 상태로 남는 것)이 이 저장소에서 이미 여러 차례(§4차 ai-review, `#1112`, 본 커밋) 반복 관측된 패턴이다. 원인은 "테스트가 존재한다"는 사실을 산문 주석으로만 서술하고, 그 서술이 맞는지 자동 검증하는 장치가 없다는 점 — `system-status.controller.ts` 에 향후 `@WorkspaceId()`/`@Roles()` 가 추가되면(예: 이 API 를 워크스페이스 스코핑하기로 결정 변경) 세 파일의 주석이 다시 조용히 stale 해지고, 이를 잡을 자동 가드는 없다.
  - 제안: 강제할 필요까지는 없으나(코멘트 정정 PR 범위를 넘어서는 구조 변경), plan `## 후속` 항목처럼 "이 컨트롤러가 워크스페이스 스코핑을 갖게 되면 이 주석들을 재검증" 같은 트리거 조건을 명시적으로 남겨 두면 다음 재발을 줄일 수 있다. 지금 당장 이 PR 범위에서 조치할 필요는 없음(등급 INFO).

- **[INFO]** `uuid.spec.ts` 의 경계 테스트가 "진짜 캐너리"로 격상됐지만, 그 사실을 코드 레벨에서 실증하는 회귀 테스트(예: `isUuidShaped` 를 `isValidUuid` 로 바꿔치기했을 때 이 테스트가 RED 가 되는지)는 이미 커밋 메시지가 아니라 테스트 파일 자체에 존재해야 정본이다
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts` 65~74행(`it('accepts UUID-shaped values that isValidUuid rejects...')`)
  - 상세: 확인 결과 이 테스트는 이미 `isUuidShaped(value)` 와 `isValidUuid(value)` 를 둘 다 같은 값(nil/v7/oddVariant)에 대해 단언하고 있어(70~73행), `isUuidShaped` 구현이 `isValidUuid` 로 회귀하면 즉시 실패하는 구조다. 즉 주석이 주장하는 "캐너리" 역할은 테스트 코드 자체가 이미 충족하고 있다 — 이번 변경은 그 사실을 정확히 반영하는 문서 정정일 뿐 실질 갭은 아니다. 참고용으로만 기록.

## 회귀 테스트 유효성

- `uuid.spec.ts`, `workspace-context.util.spec.ts`, `roles.guard.spec.ts` 의 기존 테스트 바디는 이번 diff 로 전혀 손대지 않았으므로 회귀 위험 없음.
- `workspace-id-fixtures.ts` 의 `NIL_WS` 등 export 상수값도 불변이라 이를 소비하는 3개 스위트(`workspace.decorator.spec.ts`·`roles.guard.spec.ts`·`workspace-context.util.spec.ts`)에 영향 없음.

## 테스트 존재 여부 / 커버리지 갭 / Mock / 격리 / 가독성 / 테스트 용이성

해당 관점들은 실행 코드나 테스트 로직 변경이 없으므로 이번 diff 자체에는 적용 대상이 없음(N/A). 기존 커버리지(경계 테스트·nil UUID 통과 테스트·전역 라우트 단축 테스트)는 실측으로 확인했고 변경 전후 동일하게 유효하다.

## 요약

이번 변경은 4개 파일에 걸쳐 이전에 반증된 "system-status e2e 가 nil-UUID 회귀 캐너리다"라는 주석 주장을 정정하는 **순수 문서/주석 diff**로, 실행 코드·테스트 단언은 전혀 수정되지 않았다. 정정 내용이 지목하는 새로운 근거(컨트롤러에 `@Roles()`/`@WorkspaceId()` 부재, `RolesGuard` 단축 순서, `isUuidShaped` 단일 호출부, 두 단위 테스트가 실제 캐너리 역할을 한다는 점)를 소스를 직접 열어 전부 실측 대조했고 모두 정확했다. 테스트 관점에서 새로 발생한 리스크나 커버리지 갭은 없으며, 유일하게 남는 것은 "같은 주장이 여러 곳에 산문으로 복제되어 한쪽만 고쳐지는" 이 저장소의 반복 결함 클래스에 대한 구조적 개선 여지(INFO)뿐이다.

## 위험도

NONE
