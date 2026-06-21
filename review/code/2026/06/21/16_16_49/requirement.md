# 요구사항(Requirement) Review — M-7 채널 authorizer 도메인 역전

## 발견사항

### 발견사항 1
- **[INFO]** 기능 완전성: 5개 채널 authorizer 전부 구현됨
  - 위치: `execution-channel-authorizer.ts`, `background-run-channel-authorizer.ts`, `workflow-channel-authorizer.ts`, `kb-channel-authorizer.ts`, `notifications-channel-authorizer.ts`
  - 상세: spec §3.3 의 권한 검증 표에 열거된 5개 채널(`execution:`, `workflow:`, `kb:`, `background:run:`, `notifications:`) 각각에 대응하는 authorizer 가 구현됐다. `matches` + `authorize` 인터페이스를 일관되게 따른다.

### 발견사항 2
- **[INFO]** spec §3.3 ack 계약 보존 확인
  - 위치: `websocket.gateway.ts` `handleSubscribe`
  - 상세: spec §3.3 은 "권한 없으면 동일한 `subscribed` ack 에 `success: false` 와 평문 `error` 문자열로 응답"을 명시한다. 코드는 모든 거부 경로(채널 무효, 미인증, 한도 초과, authorizer 없음, workspaceId 없음, authorizer 거부)에서 `{ event: 'subscribed', data: { success: false, error: '...' } }` 를 반환한다. 계약 일치.

### 발견사항 3
- **[INFO]** [SPEC-DRIFT] spec §3.3 권한 검증 표에 `kb:{documentId}` 비-UUID 선차단 누락
  - 위치: spec `/Volumes/project/private/clemvion/.claude/worktrees/m7-channel-authorizer-inversion/spec/5-system/6-websocket-protocol.md` §3.3 권한 검증 표 line 149
  - 상세: 코드(`kb-channel-authorizer.ts`)는 `isValidUuid(documentId)` 가드를 추가해 비-UUID 를 DB 조회 전에 선차단한다. 이는 W-6 정책 일관화 목적의 의도적 개선이다(RESOLUTION.md #1 FIXED). spec 표의 `kb:{documentId}` 행은 "workspace 문서 소유 검증" 만 기재하고 "(비-UUID 선차단)" 주석이 없다. `execution:`/`workflow:`/`background:run:` 행은 모두 "(비-UUID 선차단)"이 명시된 반면 `kb:` 만 누락된 상태 — 코드 변경이 합리적·의도적이므로 **코드 유지 + spec 반영** 대상.
  - 제안: 코드 유지. spec §3.3 권한 검증 표의 `kb:{documentId}` 행을 "workspace 문서 소유 검증 (비-UUID 선차단)"으로 갱신 필요 (project-planner 위임). 대상 spec 위치: `spec/5-system/6-websocket-protocol.md` §3.3 table line 149.

### 발견사항 4
- **[INFO]** [SPEC-DRIFT] spec §3.3 권한 검증 표에 fail-closed(매칭 authorizer 없음 → 기본 거부) 정책 미기재
  - 위치: spec `6-websocket-protocol.md` §3.3 / `websocket.gateway.ts` lines 175-184
  - 상세: 코드는 `isValidChannel` 통과 채널이 매칭 authorizer 가 없을 때 `{ success: false, error: 'Not authorized for this channel' }` 를 반환하는 방어 분기를 추가했다(RESOLUTION.md W-5 FIXED). 이 fail-closed 정책은 spec 에 명시가 없다. 현재 모든 valid prefix 에 authorizer 가 존재하므로 정상 경로 무영향의 방어 로직이다 — 코드가 합리적이고 스펙보다 안전한 방향.
  - 제안: 코드 유지. spec §3.3 에 "매칭 authorizer 없는 valid 채널 = 기본 거부" 정책을 명시하는 갱신 검토 (project-planner 판단).

### 발견사항 5
- **[INFO]** isValidUuid 정규식 경계값 커버리지 충분
  - 위치: `codebase/backend/src/common/utils/uuid.spec.ts`
  - 상세: 버전 nibble 1-5 수락·0·6 거부, variant nibble 8/9/a/b 수락·7 거부, 길이(짧음·김), 구분자 없음, 비-hex, 선행 공백 등 주요 엣지 케이스를 커버한다. 대문자 수용(i flag) 도 테스트한다. `isValidUuid` 함수 자체는 `UUID_PATTERN.test(value)` 단순 위임으로 모든 경로에서 boolean 반환 — null/undefined 입력은 TypeScript 시그니처가 `string` 으로 제한하므로 런타임 경계는 유효하다.

### 발견사항 6
- **[INFO]** `BackgroundRunsService` export 유지 — 잔여 의존 가능성 있음
  - 위치: `codebase/backend/src/modules/executions/executions.module.ts` exports 배열
  - 상세: M-7 로 gateway 의 직접 참조가 제거됐으나 `BackgroundRunsService` 가 계속 export 됐다. RESOLUTION.md 에 "타 소비처 가능성 있어 export 유지 — 별도 audit 후 후속 PR 에서 제거 검토"로 기록돼 있다. 현재로선 불필요한 export 가 모듈 캡슐화를 약화시킬 수 있으나, 즉각 제거 시 숨은 소비처가 있을 경우 런타임 DI 오류를 유발할 위험이 있다.
  - 제안: 후속 audit PR 에서 `BackgroundRunsService` 외부 소비처를 확인 후 export 축소 검토. M-7 범위에서는 현행 유지 타당.

### 발견사항 7
- **[INFO]** `WorkflowChannelAuthorizer` 의 `authorize`에서 `userId`를 사용하지 않음
  - 위치: `codebase/backend/src/modules/workflows/workflow-channel-authorizer.ts`
  - 상세: `authorize` 시그니처에서 `{ workspaceId }` 만 구조분해하고 `userId` 는 무시한다. spec §3.3 의 `workflow:` 채널 검증은 "workspace 소유 검증" 이고 user 단위 검증이 아니므로 정합. `notifications:` 만 `userId` 를 사용하는 것이 의도적이다.

### 발견사항 8
- **[INFO]** `useFactory` 집계 방식 — spec 에 주입 메커니즘 명세 없음
  - 위치: `codebase/backend/src/modules/websocket/websocket.module.ts` providers 배열
  - 상세: NestJS 11 `multi: true` 미지원으로 `useFactory` 명시 집계를 채택했다. spec §3.3 은 `channelAuthorizers`(OCP 구조) 만 언급하고 주입 메커니즘은 spec 무언급(D 판정). 채널 authorizer 배열이 5개 모두 정확히 주입됨을 gateway.spec 의 "authorizer 5개" assertion 이 가드한다. 신규 채널 추가 시 `inject:` 목록에 추가를 누락하면 조용히 실패할 수 있으나, 개수 assertion + e2e 부팅 스모크로 봉인됐다.

### 발견사항 9
- **[INFO]** `notifications:` 채널 빈 userId 처리
  - 위치: `codebase/backend/src/modules/websocket/notifications-channel-authorizer.ts` line 115
  - 상세: `const allowed = !!userId && targetUserId === userId;` — `userId` 가 빈 문자열이면 `!!userId === false` 로 거부. 테스트("rejects when JWT userId is empty (fail-closed)")로 커버됨. spec §3.3 의 `notifications:` "JWT sub 와 채널의 userId 일치 검증" 과 정합. 빈 userId 거부는 방어적으로 올바르다.

### 발견사항 10
- **[INFO]** `ExecutionChannelAuthorizer.authorize` 에러 처리 일관성
  - 위치: `codebase/backend/src/modules/executions/execution-channel-authorizer.ts` lines 537-541
  - 상세: `verifyOwnership` 이 정상 resolve 되면 `.then(() => true)`, throw 하면 `.catch(() => false)` 로 boolean 평탄화한다. 이 패턴은 IDOR/enumeration 차단을 위해 404와 403을 구분하지 않고 모두 거부로 처리 — 코드 주석에 의도가 명시돼 있다. `BackgroundRunChannelAuthorizer` 의 `verifyBackgroundRunOwnership` 은 boolean 반환 + catch false 패턴으로 약간 다르나 외부 결과는 동일. 두 패턴 모두 spec 계약(거부 시 error 반환)을 충족한다.

---

## 요약

M-7 변경은 spec §3.3 에서 요구하는 5개 채널 인가(execution/workflow/kb/background:run/notifications)를 모두 구현했다. 구독 실패 ack 계약(`subscribed` ack + `success: false` + 평문 error)은 무변 보존됐고, 각 authorizer 의 비즈니스 로직(소유 검증·UUID 선차단·userId 비교)이 spec 명세와 line-level 로 일치한다. SPEC-DRIFT 발견사항 2건(kb 비-UUID 선차단 및 fail-closed 정책)은 코드가 spec 을 앞선 의도적 개선으로, 코드 수정 대상이 아니라 spec 갱신 대상이다. TODO/FIXME 미완성 주석 없음. 모든 authorizer 는 정상·거부·예외(throw) 경로에서 적절한 반환값(`null` 또는 `{ error }`)을 보장한다.

## 위험도

NONE
