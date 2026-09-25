# Plan 정합성 검토 — `canary-readme-recheck-test` (impl-prep)

검토 대상: `plan/in-progress/canary-readme-recheck-test.md` 가 예고하는 구현 —
(1) `codebase/backend/README.md` §«워크스페이스 reflection 캐너리» 를 `#1399`/`#1400` 이후
캐너리에 맞춰 정정, (2) `workspaces.service.spec.ts` 에 `transferOwnership` 트랜잭션 내
재검사(동시 강등 경합) 분기 unit 테스트 추가. `spec_impact: none`.

## 발견사항

이번 target 은 `plan/in-progress/**` 의 미해결 결정을 우회하거나, 선행 plan 을 무시하거나,
다른 plan 의 후속 항목을 무효화하는 지점을 만들지 않는다. CRITICAL/WARNING 없음.

- **[INFO]** 출처 트래커 항목과의 1:1 대응 확인 — 중복·누락 없음
  - target 위치: `plan/in-progress/canary-readme-recheck-test.md` §요구 1·2
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` (~line 5004,
    `- [ ] backend README 캐너리 절 · transferOwnership 트랜잭션 재검사 분기 테스트`)
  - 상세: 트래커 항목의 두 서브 요구(README 정정 / `mockResolvedValueOnce` 두 번(owner→admin)
    으로 재검사 분기 고정)가 본 plan 의 요구 1·2 와 문구까지 정확히 일치한다. 실측 대조
    결과 두 요구 모두 근거가 유효하다:
    - `codebase/backend/README.md` §2 는 현재 `#1399` **이전** 단일-카운트 서술만 갖고
      있다(`@WorkspaceId() 소비 라우트 N건 인식` 만 언급, `@WorkspaceParam()`·`workspaceParamNamesOf`
      없음) — README 가 실제로 stale.
    - `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` 는 이미
      `requestContext`/`pathParam`/`total` 3필드 dual-count 를 구현·로그로 남기고 있다
      (2026-09-25 JSDoc 「두 팩토리를 센다」 섹션 확인) — 코드가 문서보다 앞서 있다.
    - `workspaces.service.ts:723` `transferOwnership` 의 트랜잭션 내 재검사
      (`requesterMembership.role !== 'owner'` → `throwOwnerTransferRequired()` →
      `OWNER_REQUIRED`, line 760-762)는 실제로 존재하나, 기존
      `workspaces.service.spec.ts` 의 `'refuses when requester is not owner'` 케이스는
      `setupOwnerLookup('admin')` 로 사전검사(트랜잭션 **밖**, `getMemberRole`)와 재검사가
      **같은 mock 값**을 보게 해 사전검사에서 먼저 던진다 — 재검사 분기는 실제로 미포착.
  - 제안: 갱신 불필요. 실측이 두 요구를 모두 뒷받침하므로 target 그대로 진행 가능.

- **[INFO]** 관련 plan 의 열린 항목과 축이 겹치지 않음(참고용, 조치 불요)
  - target 위치: 없음(target 이 건드리지 않는 인접 영역)
  - 관련 plan: `plan/in-progress/auth-guard-reflection-hardening.md` §2 (메모이제이션,
    유일한 잔여 `- [ ]`), `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C
    (reflection 3-스위트 기준값 `142·15`, `89 통과/89`)
  - 상세: 두 plan 모두 워크스페이스 reflection 캐너리를 다루지만 축이 다르다 —
    `auth-guard-reflection-hardening.md` §2 는 **성능(메모이제이션)** 이 실측 트리거
    대기 중인 별개 항목이고, `nestjs-v12-coordinated-upgrade.md` §C 의 "reflection
    3-스위트" 기준값은 `workspace.decorator.spec`·`workspace-reflection-canary.spec`·
    `roles.guard.spec` 세 파일만 가리켜 target 이 편집하는 `workspaces.service.spec.ts`
    를 포함하지 않는다. target 이 새 unit 테스트를 추가해도 이 기준값(142·15·89)은
    영향받지 않는다.
  - 제안: 조치 불요 — 두 plan 모두 갱신 대상 아님.

- **[INFO]** spec-link 게이트 인지 여부 — 이미 plan 체크리스트에 반영됨
  - target 위치: `plan/in-progress/canary-readme-recheck-test.md` 체크리스트
    `--impl-done(spec 연결 여부 확인: workspaces.service.spec.ts 는 9-user-profile 의
    modules/workspaces/** 에 걸린다)`
  - 관련 plan: `spec/2-navigation/9-user-profile.md` frontmatter `code:` —
    `codebase/backend/src/modules/workspaces/**` 포함
  - 상세: `workspaces.service.spec.ts` 편집이 `9-user-profile.md` 의 evidence 사슬에
    걸려 `--impl-done` 재검토가 필요하다는 점을 plan 이 이미 인지하고 체크리스트에
    명시했다. `codebase/backend/README.md` 는 그 글로브 밖이라 spec-link 게이트 대상이
    아니다.
  - 제안: 조치 불요 — 이미 반영됨.

미해결 "결정 필요" 항목(예: `spec-sync-user-profile-gaps.md` 의 in_app 채널 뮤팅 결정
대기)은 이 target 의 작업 범위(README 문서 정정 + 테스트 추가, `spec_impact: none`)와
겹치지 않아 우회 위험이 없다.

## 요약

target(`canary-readme-recheck-test.md`)이 예고하는 두 작업 모두 실측(코드·README·기존
테스트 커버리지 직접 확인)으로 근거가 서고, 출처 트래커(`spec-draft-nullable-notation-followups.md`
~line 5004)와 문구 단위로 정합한다. 인접한 워크스페이스 reflection 관련 plan
(`auth-guard-reflection-hardening.md`, `nestjs-v12-coordinated-upgrade.md`)과는 축·대상
파일이 겹치지 않아 후속 항목 무효화나 미해결 결정 우회가 발생하지 않는다.
`spec_impact: none` 이 실제로 유지된다 — README·unit 테스트만 바뀌고 spec 서술이나
API 계약에는 손대지 않는다.

## 위험도

NONE
