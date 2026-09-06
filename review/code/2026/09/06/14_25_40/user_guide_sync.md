# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 사전 점검

- 매트릭스 SSOT `.claude/config/doc-sync-matrix.json` Read 완료 (`rows[]` 21건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(128~197행) 보조 Read 완료.
- 변경 파일 목록: prompt 에 포함된 198개 파일(=`git diff --stat origin/main...HEAD` 전량, `origin/main` 대비 현재 브랜치 누적 diff) 을 그대로 사용. 대다수(약 170개)는 `review/**`(코드/일관성 리뷰 산출물), `plan/in-progress/**`, `spec/conventions/**` 이며 매트릭스 trigger 대상(코드베이스 사용자 가시 표면)이 아니다.
- 실제 코드/테스트 변경분(28개)을 매트릭스 21행 각각의 `trigger.globs`/semantic 기준으로 개별 대조:
  - `codebase/backend/src/nodes/**` — 매치 0건 (신규 노드·필드 변경 없음)
  - `codebase/frontend/src/**/*.tsx` — 매치 0건 (frontend 변경 없음, 이번 diff 는 전량 backend + `.claude/` + `review/`+`plan/`+`spec/conventions`)
  - `codebase/channel-web-chat/src/**/*.tsx` — 매치 0건
  - `codebase/frontend/src/content/docs/*/` (신규 섹션) — 매치 0건
  - `codebase/backend/src/modules/auth/**` — 매치 0건 (workspace-rbac e2e 강화·DTO 필드 추가는 있으나 `modules/auth/` 자체는 미변경)
  - `codebase/packages/expression-engine/**` — 매치 0건
  - `codebase/backend/src/nodes/core/error-codes.ts` / warningRules — 매치 0건
  - `codebase/backend/src/modules/system-status/system-status.constants.ts` — 매치 0건
  - `codebase/backend/src/**/*.controller.ts`, `codebase/backend/src/**/dto/**` (backend-api-change, semantic+glob) — **매치 1건**: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`

## 매치된 유일한 trigger 상세 검토

- trigger: `backend-api-change` (`백엔드 API 추가·변경`) — glob `codebase/backend/src/**/dto/**` 매치.
  - 변경 파일: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts` (`WorkspaceMemberDto.joinedAt` 필드 추가)
  - targets: "(a) controller·DTO 의 swagger jsdoc" / "(b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - (a) 확인: 같은 diff 안에 `@ApiProperty({ format: 'date-time', nullable: true, type: String })` + 공개 JSDoc(`/** 멤버가 워크스페이스에 합류한 시각... */`)이 함께 추가돼 있어 **swagger jsdoc 요건은 이미 충족**.
  - (b) 확인: `joinedAt` 은 이번 PR 이전부터 `WorkspacesService.listMembers` 가 이미 실어 보내던 값(선언 누락 상태)을 이번에 타입으로만 정합화한 것 — 새 기능/새 노출이 아니다. `codebase/frontend/src/`에서 `joinedAt` 참조를 grep 한 결과 `codebase/frontend/src/lib/api/workspaces.ts` 타입 선언 1건뿐이며, 실제 UI 컴포넌트(`07-workspace-and-team/workspaces-and-members.mdx`가 다루는 멤버 목록 화면)에서 이 값을 렌더링하는 소비 지점은 없다. 유저 가이드(`workspaces-and-members.mdx`/`.en.mdx`)에도 멤버별 "가입일" 항목은 없어 대조할 필드 자체가 없다.
  - 판정: **동반 갱신 누락 아님** — 사용자가 관찰 가능한 동작 변화가 없는 계약 정합화이므로 (b) 는 해당 없음. 향후 이 필드가 실제 UI 컬럼으로 노출되면 그 시점에 문서 갱신이 필요하다(선제적 INFO 로만 기록).

## 발견사항

- **[INFO]** `WorkspaceMemberDto.joinedAt` 신규 필드는 미노출 상태이므로 문서 갱신 대상 아님(그레이존이었으나 회색지대 원칙에 따라 확인 후 배제)
  - 변경 파일: `codebase/backend/src/modules/workspaces/dto/responses/workspace-response.dto.ts`
  - 매트릭스 항목: `backend-api-change` — "(a) controller·DTO 의 swagger jsdoc (b) API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 상세: (a) 는 diff 내에서 이미 충족. (b) 는 `joinedAt` 이 UI 미소비(참조 1건, 타입 선언뿐)·가이드 문서에 대응 항목 부재로 실질 노출 변화가 없어 대상 아님. `WorkspacesService.listMembers` 가 이미 이 값을 실어 왔으므로(런타임 동작 불변) swagger 선언만 실체에 맞춘 정합화다.
  - 제안: 조치 불요. 다만 추후 프런트엔드가 이 필드를 화면에 노출하는 시점에는 `07-workspace-and-team/workspaces-and-members.{mdx,en.mdx}` 갱신을 같은 PR 에 포함할 것.

이 외에 매트릭스의 나머지 20개 trigger(노드 추가/schema, 신규 UI 문자열, 위젯 chrome, 통합/제공자, 신규 섹션 디렉토리, BullMQ 큐, warningCode/errorCode, cross-cutting enum, backend zod ui.label, handler output field, 인증·권한·세션 흐름, AuthConfig enum, 표현식 언어, 실행·디버깅 흐름, 환경/런타임, spec 대규모 변경, user-guide GUI 흐름 절)은 이번 변경 set 의 실제 코드 파일(`.claude/hooks/_lib/review_guard.py`, repo-guards 가드/fixture 2종, `shared/testing/user-secret-absence.*`, `workflow-versions.service.ts` 의 타입 투영 강화, e2e 스펙 3건, `CHANGELOG.md`, `plan/in-progress/*.md`)과 매칭되는 지점이 전혀 없다. 이번 PR 은 `User` 엔티티 민감 컬럼 노출을 잡는 내부 검출 가드(구조 축·이름 축)와 그 e2e 배선 + 리뷰 하네스(`review_guard.py` YAML 파싱 버그 수정)로 구성된 순수 방어/테스트 인프라 작업이며, 사용자 가시 기능·노드·UI 문자열·통합·인증 흐름·표현식 언어·실행 흐름 어느 것도 바뀌지 않았다.

## 요약

매트릭스 21개 trigger 중 1개(`backend-api-change`, DTO glob)만 매칭됐고, 그 1건은 조사 결과 swagger jsdoc 요건은 diff 내에서 이미 충족되고 사용자 가이드 페이지 갱신 요건은 실제 UI 미노출로 해당하지 않아 실질 누락 0건이다. 나머지 20개 trigger 는 이번 diff(주로 `User` 엔티티 민감 컬럼 노출 방어 가드 신설 + review harness YAML 파싱 버그 수정)의 어떤 파일과도 매칭되지 않는다. 유저 가이드 동반 갱신 관점에서 이번 변경은 **해당 없음**에 가깝다.

## 위험도

NONE
