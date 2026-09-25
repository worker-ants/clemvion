# Rationale 연속성 검토 — Personal 통합 소유자 강제 (--impl-done)

## 검토 방법

프롬프트 번들의 target(4-integration.md 본문·diff)은 예산 절단으로 대부분 생략됐다. 대신 (1) 번들에 실린
`spec/2-navigation/4-integration.md` 의 전체 Rationale 발췌, (2) 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/integration-personal-owner`,
diff-base `origin/main`)의 실제 코드를 절대경로로 직접 읽어 대조했다. 확인한 파일: `integration-visibility.ts`,
`integrations.service.ts`(`findAll`/`rotate`/`updateScope`/`requireVisible`), `integration-oauth.service.ts`
(`assertRequesterStillAllowed`/`pickPrecheckConflict`/`precheckCafe24Mall`), `integrations.controller.ts`,
`integrations.controller.owner.spec.ts`, workflow-assistant 쪽 `candidate-lookup.service.ts`/`explore-tools.service.ts`/
`assistant-tool-router.service.ts`, `spec/2-navigation/4-integration.md` 의 실제 diff, 그리고 선행 3회 `--spec`/`--impl-prep`
라운드의 `review/consistency/2026/09/25/{21_33_10,21_49_24,22_00_14}/rationale_continuity.md`.

## 발견사항

이번 라운드에서 새로 발견한 CRITICAL·WARNING 은 없다. 선행 라운드가 지적한 항목은 모두 코드/spec 에 반영되어
있음을 실측했다 — 재확인 결과만 기록한다(재열거이지 새 발견 아님):

- **[검증됨 — 문제 없음] Admin 거부 코드 `FORBIDDEN` → `ADMIN_REQUIRED` 통일**: `21_33_10` WARNING 1 이 지적한
  구식 generic `FORBIDDEN` 잔존은 `integration-visibility.ts`의 `adminRequiredError()`가 `ROLE_REQUIRED.admin`
  (`{code:'ADMIN_REQUIRED', message:'Admin 이상의 권한이 필요합니다.'}`)을 그대로 스프레드해 해소됐고,
  spec Rationale에도 "거부 코드는 `ADMIN_REQUIRED` 로 올렸다"고 명시돼 있다. `ADMIN_ROLES` 집합도
  `common/constants/workspace-roles.ts` 단일 출처를 `integrations.service.ts`·`integration-visibility.ts`
  양쪽이 그대로 참조해 `#1399` "서열은 한 곳에서" 원칙과 정합한다.
- **[검증됨 — 문제 없음] precheck 소유자 은닉과 "별도 RBAC 불필요" 구 Rationale의 충돌**: `21_33_10` WARNING 2 가
  요구한 대로 구 문장이 `~~(별도 RBAC 처리 불필요)~~ (2026-09-25 정정: …)` 취소선 + 정정 각주로 처리됐고
  (원문 보존 관례 준수), 코드의 `pickPrecheckConflict()`가 `isIntegrationVisibleTo`로 실제 id·이름 은닉을
  구현한다.
- **[검증됨 — 문제 없음] "opt-in 라우트별 수동 배치" 구조적 완결성 위험 (`21_49_24` WARNING 1)**: `integrations.controller.owner.spec.ts`가
  `PATH_METADATA` 리플렉션으로 `:id` 라우트 전수를 세고, 판정표(`BY_ID`)와의 exact-match를 요구하는 캐너리를
  추가해 "새 `:id` 라우트 추가 시 판정 누락"을 구조적으로 차단한다. `oauth/begin`의 mode 축도 `never` 타입
  exhaustiveness(`modifyActionOfBeginMode`)로 같은 위험을 컴파일 타임에 닫는다 — 두 안전망 모두 이전 라운드가
  요구한 "완결성 안전망"의 구체화다.
- **[검증됨 — 문제 없음] `ai-assistant.md` candidate-lookup 계약 갱신 (`21_49_24` WARNING 2 → `22_00_14` INFO)**:
  코드(`candidate-lookup.service.ts`/`explore-tools.service.ts`)가 `IntegrationsService.findAll`/`integrationVisibilityClause`를
  통해 §8 판정을 그대로 상속하고, 이는 워크플로우 노드 *편집기 후보 조회* 층일 뿐 §8의 "아직 강제되지 않는 것"
  (워크플로우 노드 **실행** 시점 검사)과는 다른 표면이라 defer 결정과 충돌하지 않는다.
- **[검증됨 — 문제 없음] rotate/reauthorize의 "락 안 재판정" 이 기각된 advisory lock 재도입이 아님**: `rotate()`
  코드 주석이 스스로 `4-integration.md` Rationale이 기각한 PostgreSQL advisory lock 대안과의 차이(트랜잭션 밖에서
  외부 호출 완료 후 짧은 재읽기+커밋만 트랜잭션 안)를 명시하고, `assertRequesterStillAllowed`의 역할 재조회도
  같은 트랜잭션 커넥션(`manager`)을 재사용해 커넥션 풀 이중 대여를 피한다 — 커밋 `a8b5c8b13`이 실제로 이 형태로
  고쳤음을 diff로 확인.
- **[검증됨 — 문제 없음] 노드 실행 시점 검사 defer 유지**: `codebase/backend/src/nodes/**` 에는 이번 diff가 손대지
  않았고, defer 항목은 `plan/in-progress/integration-personal-owner-followup.md`에 착수 전 실측 계획(기존
  워크플로우 중 남의 personal 참조 건수)과 보안 캐비엇(§8 불변식이 실행 표면에서는 아직 성립하지 않음 — UUID를
  아는 Editor가 자기 노드에 넣어 우회 가능)까지 함께 명시돼 있어 "결정의 무근거 번복"이 아니라 명시적·추적되는
  잔여로 남아 있다.

## 요약

이 PR은 4라운드의 `/ai-review`와 3라운드의 `--spec`/`--impl-prep` 단계 Rationale 연속성 지적을 모두 코드·spec에
반영해 수렴한 상태다. 신설 Rationale "Personal 통합 소유자 강제"는 사용자가 제시한 선택지·기각한 대안(쓰기만
먼저 / §8 전부 한 번에 / 403+새 코드 / Organization Editor 유지)을 명시적으로 기록하며, 실제 코드(`integration-visibility.ts`,
`findAll`/`rotate`/`updateScope`/`assertRequesterStillAllowed`, precheck) 어디에도 이 기각된 네 대안이 재도입된
흔적이 없다. "본인=created_by, 역할 우위 없음" 원칙은 Admin의 `updateScope`에서도 `requireVisible`을 먼저 거쳐
일관되게 지켜지고, 구 Rationale과 충돌하는 새 결정(precheck 은닉·Admin 코드 전환)은 원문 취소선 보존 + 정정
각주라는 프로젝트 관례를 따라 처리됐다. 유일하게 아직 열린 표면(노드 실행 시점 강제)은 "받아들인 잔여"로
명시적으로 defer됐고 후속 plan에 착수 전 실측·보안 캐비엇까지 남아 있어 무근거 번복이 아니다. 종합적으로
Rationale 연속성 관점의 위반·재도입은 발견되지 않았다.

## 위험도

NONE
