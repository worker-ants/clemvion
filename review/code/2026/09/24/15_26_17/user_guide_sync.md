# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 20개 change_type)과 `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 함께 Read 했다.

## 변경 파일 식별

`git diff --name-only HEAD~6..HEAD` 로 이 changeset 의 전체 파일을 확인했다 (36개):

- `PROJECT.md` (governance 문서, 버전·도구 정책 문장 각주 추가)
- `codebase/backend/jest.config.ts` — jest transform 설정 (test tooling)
- `codebase/backend/package.json` — `scripts.test*` 5개 (test tooling)
- `codebase/backend/test/jest-e2e.json` — e2e jest 설정 (test tooling)
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` — 신규 가드 스펙 (repo-guards, 노드 아님)
- `plan/in-progress/jest-esm-native-load.md`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — plan 문서
- `review/code/2026/09/24/14_24_10/**`, `review/consistency/2026/09/24/{12_57_36,13_55_20}/**` — 이전 라운드 리뷰/컨시스턴시 산출물

## trigger 매칭

매트릭스 20개 행을 전수 대조했다.

- `new-node` / `node-schema-change` (trigger: `codebase/backend/src/nodes/**`) — **미매칭**. 변경된 backend 파일은 `src/repo-guards/__tests__/`, `jest.config.ts`, `package.json`, `test/jest-e2e.json` 뿐이며 `src/nodes/**` 는 이번 changeset 에 전혀 없다.
- `new-ui-string` / `new-widget-chrome-string` (trigger: `*.tsx`) — **미매칭**. `codebase/frontend/**`, `codebase/channel-web-chat/**` 어느 파일도 변경 목록에 없다.
- `integration-provider-change`, `new-userguide-section-dir`, `backend-api-change`(`*.controller.ts`/`dto/**`), `new-bullmq-queue`, `new-warning-code`, `new-error-code`(`error-codes.ts`), `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field` — **전부 미매칭**. 해당 glob/semantic 영역에 속하는 파일이 changeset 에 없다.
- `auth-session-flow-change` (trigger: `codebase/backend/src/modules/auth/**`, semantic) — **미매칭**. `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C 가 "reflection 보안 회귀" 를 착수 **시** 검증 항목으로 명시하지만, 이는 아직 시작 전인 후속 plan 스텁(`worktree: (unstarted)`류, status: in-progress 이나 실제 코드 미착수)의 서술일 뿐 — 이번 changeset 에 `src/modules/auth/**` 실제 코드 변경은 0건이다. 트리거는 코드 변경 시점에 발화하는 것이지 plan 서술만으로 발화하지 않는다.
- `auth-config-type-enum-change`, `expression-language-change`(`codebase/packages/expression-engine/**`), `run-debug-flow-change` — **미매칭**. 해당 경로/영역 변경 없음.
- `env-runtime-change` (targets: README.md, "환경 변수·기동 방법·런타임 변경 (제품 최종 상태)") — **미매칭**. `package.json` 의 `scripts.test*` 변경은 테스트 실행기 호출 방식일 뿐, `start`/`start:prod` 등 배포 런타임 경로는 diff 밖이다(동일 changeset 의 다른 reviewer, 예: security.md, dependency.md 가 이미 실측 확인 — "production 실행 경로에는 플래그가 붙지 않았다"). 제품의 "최종 상태"(배포·기동)에 영향이 없어 README 갱신 대상이 아니다.
- `spec-major-change` (trigger: `spec/2-*/**` 등) — **미매칭**. `spec/**` 변경 0건.
- `userguide-gui-flow-section`, `spec-defect-found` — **미매칭**.

`PROJECT.md` 자체 변경은 "버전·도구 정책" 문장에 각주를 추가한 것으로, 매트릭스의 `trigger` 어느 것도 `PROJECT.md` 를 trigger 파일로 지정하지 않는다(PROJECT.md 는 매트릭스의 human-readable 대상 문서이지 trigger 소스가 아님).

## 판정

이번 changeset 은 backend Jest 테스트 러너의 모듈 로딩 방식(`transformIgnorePatterns` 손-유지 허용목록 → `--experimental-vm-modules` 네이티브 ESM 로드) 전환에 국한된 **테스트 tooling/CI 인프라 변경**이다. 노드 추가, 노드 schema 변경, TSX UI 문자열, provider/통합 변경, 신규 docs 섹션, 인증·권한·세션 흐름의 실제 코드 변경, 표현식 언어, 실행·디버깅 흐름, 신규 warning/error code, 배포 런타임 변경, spec 변경 중 어느 것도 발생하지 않았다. `codebase/frontend/**`, `codebase/channel-web-chat/**`, `codebase/packages/expression-engine/**`, `spec/**` 는 변경 목록에 전혀 나타나지 않는다.

## 해당 없음

유저 가이드 동반 갱신(User Guide Sync) 매트릭스의 20개 trigger 중 매칭된 것이 없다. 동반 갱신 누락 발견사항 없음.

## 요약

매트릭스 20개 change_type 을 전수 대조한 결과 매칭 0건 — 이 changeset(36개 파일)은 backend jest 테스트 러너 설정·plan 문서·이전 라운드 리뷰 산출물로만 구성되며 frontend docs/i18n/provider/노드/인증코드/표현식엔진/spec 어느 영역도 건드리지 않는다. `nestjs-v12-coordinated-upgrade.md` 가 언급하는 인증 reflection 회귀 검증은 아직 착수 전인 후속 plan 서술일 뿐 실제 코드 변경이 아니므로 이번 라운드에서는 트리거되지 않는다. 유저 가이드 동반 갱신 관점에서 조치할 사항 없음.

## 위험도

NONE
