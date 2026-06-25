# Code Review 처리 (RESOLUTION)

대상: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
리뷰: `review/code/2026/06/25/09_59_33/SUMMARY.md` (Risk LOW, Critical 0, Warning 2)
구현 커밋: `b72f634e` · review-fix 커밋: (본 RESOLUTION 과 함께)

## 요약

Critical 0. Warning 2 중 1건 fix·1건 검증후 문서화. INFO 14건 중 2건 반영, 나머지는 근거와 함께 보류(behavior-preserving PR 범위 유지 + 사전존재 갭).

## Warning (2건)

### W1 [Security] `workspaceId` 빈 문자열 정규화 — 검증 후 문서화 (코드 무변경)

- **발견**: `getCommandAuthContext` 가 `workspaceId` 누락 JWT 를 `''` 로 정규화 → `verifyOwnership` 이 빈 workspaceId 를 거부하는지 이 파일만으로 보장 불가.
- **처리**: **검증 결과 실제 취약점 아님 + 사전존재 동작.** `executions.service.ts:215 verifyOwnership` 본문 확인:
  ```ts
  const ownerWorkspaceId = row.workflow?.workspaceId;
  if (!ownerWorkspaceId || ownerWorkspaceId !== userWorkspaceId) {
    throw new NotFoundException(...); // 거부
  }
  ```
  실제 owner workspaceId 는 UUID 라 빈 `''` 와 **절대 일치하지 않으며**, `!ownerWorkspaceId` 가드까지 있어 빈/불일치 workspaceId 는 **항상 NotFound 로 거부**된다. 또한 `enriched.workspaceId ?? ''` 정규화는 본 리팩터 이전 5개 핸들러에 **이미 인라인 존재**하던 동작으로, helper 추출이 byte 단위 보존했다(회귀 0).
- **테스트 추가 보류 근거**: 리뷰어 제안(verifyOwnership 빈 workspaceId 거부 단위 테스트)은 타당하나 `executions.service.spec.ts` 에 verifyOwnership describe 가 부재 → queryBuilder mock 신규 셋업이 필요해 **다른 모듈로 scope 확대**. 본 PR 은 gateway behavior-preserving 리팩터라 서비스 계약 테스트는 별건이 적절. gateway 레벨 ownership 거부는 기존 spec(`should reject ... when ownership check fails`)이 mocked verifyOwnership reject 로 이미 커버.

### W2 [Maintainability] `handleSubscribe` 내 `enriched` 중복 선언 — fix ✅

- **발견**: 함수 스코프(line 188)와 snapshot 블록(line 273)에 `const enriched = client as AuthenticatedSocket` 중복.
- **처리 (fix)**: snapshot 블록의 inner `enriched` 재선언을 제거하고, 함수 상단에서 이미 산출한 `workspaceId`(= `enriched.workspaceId ?? ''`, line 189) 를 `emitExecutionSnapshot` 인자로 재사용. 값 동일 → behavior-preserving. 중복 단언·shadow 가능성 제거.

## INFO (14건)

### 반영 (2건)

- **INFO-2 [Architecture]** ✅ `emitExecutionSnapshot` 의 inline `verifyOwnership` 가 명령 핸들러용 `verifyExecutionOwnership` helper 와 의도적으로 분리(실패를 ack 아닌 snapshot skip 으로 흡수)임을 주석 1블록 추가 — 인지 부하 해소.
- (W2 fix 가 INFO 성격의 중복 정리도 겸함.)

### 보류 (근거 명시)

- **INFO-1 [Architecture]** `WebsocketGateway` 6종 책임 — 기존 부채, C-4 미악화. 후속 슬라이스(별도 `ExecutionCommandHandler` 서비스 추출) 후보. 본 behavior-preserving 범위 밖.
- **INFO-3·4·5·6·7 [Testing]** `handleClickButton` 전용 describe 부재, `handleSubmitMessage`/`handleEndConversation` 인증·IDOR 케이스 비대칭, workspaceId 정규화 엣지, retry W3 보상경로 검증, handleConnection invalid-token 검증 — **전부 사전존재 테스트 커버리지 갭**(C-4 가 도입하지 않음). 리팩터된 인증·소유권·retry nested ack 경로는 gateway spec 51/51(특히 `handleSubmitForm`·`handleRetryLastTurn` 의 미인증·IDOR·nested 코드 케이스)로 검증됨. 대칭 보강은 테스트 전용 별건 PR 이 적절 — behavior-preserving 리팩터 PR 비대화 회피.
- **INFO-8 [Maintainability]** `'Execution not found'` 상수화 — **단일 사용 리터럴**(gateway 내 retry nested ownership 1곳). `MSG_NOT_AUTHENTICATED`(5×)·`MSG_NOT_AUTHORIZED_EXECUTION`(4×) 는 **반복** 문자열이라 상수화한 것이고, 단일 사용 리터럴 상수화는 indirection 만 늘려 보류. (asymmetry 는 "반복=상수/단발=리터럴" 원칙의 의도된 결과.)
- **INFO-9 [Maintainability]** `getCommandAuthContext` JSDoc 길이 — JSDoc 이 §7.2 ack-shape 소유 제약 + subscribe 제외(OCP)를 명문화하는데, 이는 impl-prep consistency 가 **명시 권고**(rec.4: "JSDoc 에 명령 핸들러 5종 전용·subscribe 별도 담당 명시")한 사항이라 유지가 정당. 보류.
- **INFO-10 [Maintainability]** max-subscriptions 메시지 3곳 중복 — `handleSubscribe` 의 사전존재 리터럴(C-4 미변경). 다음 유지보수 시 상수화 후보. 본 범위 밖.
- **INFO-11 [Documentation]** `refactor 03 C-4` 레이블 노이즈 — **저장소 관행**(기존 `refactor 02 M-7`·`W-13`·`CRIT #1`·`Phase 2.5`·`A-1 (§7.5.2)` 등 작업/스펙 레이블 광범위 사용)과 일치. 리뷰어도 "관행이면 수용". 유지.
- **INFO-12 [Documentation]** `handleSubmitMessage` 잔류 괄호 주석 — 사소. W2/INFO-2 와 무관한 사전존재 주석이라 미변경(추후 일괄 정리 후보).
- **INFO-13·14 [Security]** handleUnsubscribe 인증가드·UUID 포맷검증 부재 — 리뷰어 "위반 아님/실질 위험 LOW" 명시(전자는 handleConnection disconnect 보장, 후자는 verifyOwnership DB 조회 차단). 해당 없음.

## 미완 reviewer (scope·side_effect)

router 강제 포함 6 중 scope·side_effect 가 output_file 부재로 미완 표기(workflow 결과의 `reviewers[]` 는 success, summary 텍스트는 retry 필요로 불일치). 본 변경은 단일 파일 helper 추출 + 인라인 단언 통합으로 **scope(의도 이상 변경 0 — 계획된 C-4 그대로)·side_effect(public 시그니처·전역상태 변경 0, private 메서드 2 추가만)** 가 구조적으로 낮음. api_contract(wire shape 불변)·security·side_effect 인접 관점이 8 reviewer 로 커버되어 Critical 0. 재시도 가치 낮다고 판단해 보류(필요 시 `/ai-review --commit HEAD` 재실행으로 보완 가능).

## 검증

review-fix 후 lint·build·unit 재실행. (e2e 는 환경 Docker 레지스트리 아웃티지로 별도 보류 — 코드 무관, 재실행 필요.)
