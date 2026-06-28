# 유지보수성(Maintainability) 리뷰

## 발견사항

### [INFO] `UNKNOWN_ERROR_MESSAGE` / `UNHANDLED_ERROR_MESSAGE` 상수명 유사성
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/common/filters/http-exception.filter.ts` (신규 상수 L98–L105 diff 기준)
- **상세**: 두 상수 모두 `"An unexpected error occurred"`로 시작하며, 이름의 `UNKNOWN` vs `UNHANDLED` 구분이 직관적이지 않다. JSDoc 으로 "비-Error throw fallback vs unhandled Error 인스턴스"를 구분 명시했으나, 빠르게 읽을 때 이름만으로 차이를 식별하기 어렵다. 이 문제는 이전 리뷰(19_00_30)에서도 INFO 로 기록됐고 JSDoc 보완을 현행 허용 근거로 삼았으므로, 현재 상태는 수용 가능하다.
- **제안**: 장기적으로 `NON_ERROR_THROW_MESSAGE` / `UNHANDLED_EXCEPTION_MESSAGE` 처럼 throw 값의 종류를 이름에 반영하면 구분력이 높아진다. 현행 JSDoc 보완으로 차단급 문제는 아님.

### [INFO] `extractClientIpFromHeaders(...) ?? undefined` 패턴 반복
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.ts` (L202, L214 diff 기준 — `handleWebhook` 및 `handleChatChannelWebhook` 호출부)
- **상세**: 로컬 래퍼 `extractClientIp` 제거(A-1) 이후 `extractClientIpFromHeaders(...) ?? undefined` 패턴이 최소 2곳(이번 diff의 두 호출부)에 직접 노출된다. 이전 리뷰(19_00_30 I8)에서 hooks.service 전체에 걸쳐 4회 반복으로 기록된 항목이다. 반환형 `string|null`을 `string|undefined`로 통일하면 변환 보일러플레이트가 사라진다. 그러나 공유 유틸(`extractClientIpFromHeaders`) 시그니처 변경은 소비자 전수 확인이 필요한 별도 작업이라 이번 PR 범위 외임이 명확하다.
- **제안**: 별도 후속 태스크로 `extractClientIpFromHeaders` 반환형을 `string | undefined`로 통일하는 변경을 추적할 것. 현재 `?? undefined` 패턴은 의도가 명확하므로 즉각 차단 사유는 아님.

### [INFO] `PublicWebhookReqShape extends PublicWebhookReqExtension` — 역할 경계 혼재
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` (L422–L427 diff 기준, 신규 interface)
- **상세**: `PublicWebhookReqShape`(Guard가 읽는 요청의 입력 형태)가 `PublicWebhookReqExtension`(Guard가 주입하는 확장 필드 `__publicWebhookTrigger`)을 상속한다. 요청의 "입력 필드"와 "Guard 주입 출력 필드"가 한 타입에 합쳐지면, 타입 소비자 입장에서 어느 필드가 요청 시 이미 있어야 하는지, 어느 필드가 Guard 통과 후에야 채워지는지가 불명확하다. JSDoc에 소비자(`public-webhook-throttle.guard.spec.ts`)를 명시해 혼동을 완화했고, 실용상 문제는 없다.
- **제안**: 현행 허용 가능. 향후 가독성 개선이 필요하면 `canActivate` 내부 지역 변수에 `as PublicWebhookReqShape & PublicWebhookReqExtension` 교차 타입을 사용하고 `PublicWebhookReqShape`는 순수 입력 형태만 표현하는 방향을 검토.

### [INFO] `client-ip.spec.ts` 내 두 describe 블록 env 스냅샷 선언 중복
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/auth/utils/client-ip.spec.ts` (L149–L157, L167–L175 diff 기준 — 두 describe 블록 각각의 `envSnapshot` + `beforeEach`/`afterEach`)
- **상세**: `envSnapshot` 선언 + `beforeEach` 스냅샷 + `afterEach` 복원 패턴이 동일 파일 내 두 describe 블록에 중복 선언된다. 기존 try/finally 패턴보다 명확하게 개선됐고 현재 두 블록은 격리가 올바르게 작동한다. 다만 파일에 세 번째 describe 블록이 추가될 경우 또다시 중복이 생길 수 있다.
- **제안**: 파일 레벨 `beforeEach`/`afterEach`로 이동하거나 `withEnvSnapshot()` 헬퍼 함수로 추출하는 것을 nice-to-have로 백로그에 추가. 현행도 허용 범위.

### [INFO] `getActiveExecutionStatus` 내 private 필드 브래킷 접근 (기존 코드, 참고)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.ts` (이번 diff 범위 외 기존 코드)
- **상세**: `this.executionsService['executionRepository']` 패턴은 TypeScript 접근 제어를 브래킷 표기로 우회한다. 리팩터링 시 필드명 변경을 컴파일 타임에 잡지 못한다. 이번 변경(A-1) 범위 밖의 기존 코드이며, `.catch(() => null)` 방어로 런타임 안전은 확보돼 있다. 이전 리뷰(19_00_30 I7)에서도 동일하게 기록됐다.
- **제안**: `ExecutionsService`에 `getStatusById(id)` 등 좁은 공개 메서드 추가가 근본 해결책. 별도 리팩터링 태스크로 관리.

### [INFO] `handleChatChannelWebhook` 메서드 순환 복잡도 (기존 코드, 참고)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.ts` (이번 diff 범위 외 기존 코드)
- **상세**: 약 410라인, command kind 분기 7개 이상, `form_submission` 블록의 try/finally + 중첩 조건 — 순환 복잡도 20+ 추정. 이번 diff(L214)에서 `clientIp` 추출 패턴 변경이 이 메서드 초반부에 적용됐으나 메서드 전체 복잡도는 이번 PR 범위 밖이다. 이전 리뷰(19_00_30)에서도 동일하게 기록됐다.
- **제안**: command kind별 private 핸들러 메서드 분리(`handleCancelCommand`, `handleFormSubmission` 등)를 리팩터링 백로그로 관리. 이번 PR에서 신규 진입 없음.

## 요약

이번 변경셋은 유지보수성 관점에서 전반적으로 긍정적이다. 로컬 래퍼 함수 제거(A-1)로 인다이렉션 제거, 매직 문자열 named 상수화(A-2)로 의미 명확화, 인라인 익명 타입의 named interface 추출(A-3)으로 타입 단일 선언 달성, 테스트 spy/env 복원 패턴의 afterEach 통일(B-4~B-7)로 테스트 견고성 향상 — 모두 유지보수성을 높이는 올바른 방향이다. 잔여 우려 사항은 `UNKNOWN/UNHANDLED` 상수명 유사성(JSDoc 보완으로 수용), `?? undefined` 패턴 반복(공유 유틸 시그니처 변경이라 별도 후속), env 스냅샷 중복(nice-to-have), `getActiveExecutionStatus` private 브래킷 접근 및 `handleChatChannelWebhook` 높은 복잡도(모두 기존 코드·이번 PR 범위 외)이며, 신규 유지보수성 문제는 도입되지 않았다.

## 위험도

LOW
