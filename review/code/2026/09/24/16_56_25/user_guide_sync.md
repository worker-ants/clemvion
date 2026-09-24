# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21개 trigger) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SSOT 로 적재했다.

## 변경 파일 식별

이번 changeset(실제 코드/설정/plan 변경, review 산출물 제외)은:

- `PROJECT.md` — §버전·도구 정책 문단에 각주 추가 (ESM 트리거 발화·해소 기록)
- `codebase/backend/jest.config.ts` — `transformIgnorePatterns` 를 수작업 ESM 허용목록에서 기본값(`['/node_modules/']`)으로 원복 + 배경 주석 재작성
- `codebase/backend/package.json` — `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` **테스트 스크립트**에 `node --experimental-vm-modules` 플래그 추가 (`start`/`start:prod` 등 런타임 기동 스크립트는 미변경)
- `codebase/backend/test/jest-e2e.json` — `transformIgnorePatterns` 동일 원복
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` — 신규 가드 테스트 (`src/nodes/**` 가 아닌 `src/repo-guards/__tests__/` 트리)
- `plan/in-progress/jest-esm-native-load.md`, `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (신규), `plan/in-progress/spec-draft-nullable-notation-followups.md` (후속 항목 추가) — plan 문서
- 나머지(`review/code/2026/09/24/{14_24_10,15_26_17,16_02_28,16_29_15}/**`, `review/consistency/2026/09/24/{12_57_36,13_55_20}/**`)는 선행 리뷰/consistency-check 세션의 기 커밋된 산출물로, 이번 diff 의 "코드 변경"이 아니다.

## trigger 매칭

21개 행 전수 대조:

- `new-node` / `node-schema-change` (`codebase/backend/src/nodes/**`) — **미매칭**. 변경된 backend 파일은 `jest.config.ts`·`package.json`·`test/jest-e2e.json`·`src/repo-guards/__tests__/esm-native-load.spec.ts` 뿐이며 `src/nodes/**` 트리는 이 changeset 에 전혀 없다.
- `new-ui-string` / `new-widget-chrome-string` (`*.tsx`) — **미매칭**. `codebase/frontend/**`, `codebase/channel-web-chat/**` 는 변경 목록에 없다.
- `integration-provider-change`, `new-userguide-section-dir`, `backend-api-change`, `new-bullmq-queue`, `new-warning-code`, `new-error-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field` — **전부 미매칭**. 해당 glob/semantic 영역 파일이 changeset 에 없다.
- `auth-session-flow-change` (`codebase/backend/src/modules/auth/**`) — **미매칭**. `plan/in-progress/nestjs-v12-coordinated-upgrade.md` §C 가 "reflection 보안 회귀 검증"을 **착수 시** 항목으로 명시하지만, 이는 아직 시작 전(`worktree: (unstarted)`) 후속 plan 스텁의 서술일 뿐 — 실제 `src/modules/auth/**` 코드 변경은 0건이다.
- `auth-config-type-enum-change`, `expression-language-change` (`codebase/packages/expression-engine/**`), `run-debug-flow-change` — **미매칭**.
- `env-runtime-change` (환경 변수·기동 방법·런타임 변경 → README.md) — **미매칭 판단**. `package.json` 변경은 `test`/`test:watch`/`test:cov`/`test:debug`/`test:e2e` 스크립트에 한정되며 제품의 실제 기동 스크립트(`start`/`start:prod` 등)는 손대지 않았다. 이 trigger 는 "제품 최종 상태"(런타임)를 가리키므로 테스트 하니스 실행 방식 변경은 해당하지 않는다 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목이 짚은 "도구·테스트 하니스 = CHANGELOG 해당 없음" 분류와 같은 결의 판단이다.
- `spec-major-change`, `userguide-gui-flow-section`, `spec-defect-found` — **미매칭**. `spec/**`, `codebase/frontend/src/content/docs/**` 변경 없음.

## 동반 갱신 누락 검출

매칭된 trigger 가 0건이므로 검출할 누락 자체가 없다. 참고로 이 changeset 은 동일 PR 의 선행 3개 세션(`15_26_17`, `16_02_28`, `16_29_15`)에서도 매번 독립적으로 같은 결론("해당 없음"/NONE)에 도달했음을 확인했다(해당 세션들의 `user_guide_sync.md` 가 이번 changeset 에 리뷰 대상으로 포함되어 있어 직접 대조 가능) — 세 번의 반복 검토와 이번 검토가 수렴한다.

## i18n / 신규 경고·에러 코드 / 신규 섹션 디렉토리 특칙 점검

- **i18n parity**: TSX 신규 리터럴 없음 → 해당 없음.
- **backend warning/error code → ko 매핑**: `warningRules`, `error-codes.ts` 변경 없음 → 해당 없음.
- **신규 섹션 디렉토리 locale 등록**: `codebase/frontend/src/content/docs/<NN>-<name>/` 신규 없음 → 해당 없음.

## 결론

이번 changeset 은 backend Jest 테스트 러너의 모듈 로딩 방식(수작업 `transformIgnorePatterns` ESM 허용목록 → `--experimental-vm-modules` 네이티브 ESM 로드) 전환에 국한된 **테스트 tooling/CI 인프라 변경**이다. 노드 추가·스키마 변경·TSX UI 문자열·통합/제공자 변경·신규 docs 섹션·인증/권한/세션 흐름·표현식 언어·실행/디버깅 흐름·신규 warning/error 코드 중 어느 trigger 도 발화하지 않았고, `codebase/frontend/**`·`codebase/channel-web-chat/**`·`codebase/packages/expression-engine/**`·`spec/**` 는 변경 목록에 나타나지 않는다. 유저 가이드(docs MDX)·i18n dict·`backend-labels.ts` 동반 갱신 의무 자체가 이번 PR 에는 발생하지 않는다.

## 요약

매트릭스 trigger 21개 전수 대조, 매칭 0건, 누락 0건. 변경은 backend Jest ESM 네이티브 로딩 전환(테스트 하니스/CI 인프라)에 한정되어 유저 가이드 동반 갱신 영역과 무관하다. "해당 없음."

## 위험도

NONE
