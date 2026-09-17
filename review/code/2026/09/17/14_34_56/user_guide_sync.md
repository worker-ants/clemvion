# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차

1. `.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 Read.
2. 이번 리뷰 대상 changeset(파일 1~7, `meta.json`(파일 16) 기준)을 확인:
   - `CHANGELOG.md`
   - `codebase/backend/jest.config.ts`
   - `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
   - `codebase/backend/src/modules/triggers/triggers.service.spec.ts`
   - `codebase/backend/src/modules/triggers/triggers.service.ts`
   - `codebase/backend/test/trigger-update-save-window.e2e-spec.ts`
   - `plan/in-progress/trigger-save-partial-patch.md`
   - 나머지(파일 8~46)는 이전 리뷰 라운드(`review/code/2026/09/17/13_44_39`, `14_11_48`)와 `review/consistency/2026/09/17/13_04_39`의 산출물(harness 결과물)로, 매트릭스 trigger 대상이 아님.
3. 매트릭스 21개 행 전체를 changeset 과 대조.

## 매칭 결과

핵심 코드 변경은 `TriggersService.update()` 내부 저장 방식을 "재읽은 엔티티 통째 `save`" → "요청이 바꾸는 필드 + `config` 만 담은 부분 객체 `save`" 로 좁힌 **내부 영속성(lost-update) 버그 수정**이다. 대조 결과:

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 미매칭. 이번 변경은 `src/modules/triggers/**` 이며 `src/nodes/**` 가 아니다.
- **new-ui-string / new-widget-chrome-string** (`*.tsx`) — 미매칭. frontend·channel-web-chat 파일 변경 없음(changeset 전체가 backend + plan/CHANGELOG).
- **integration-provider-change** — 미매칭. 신규/변경 provider 없음(웹훅·챗채널 등 기존 필드의 컬럼 갱신 로직만 손질, provider 종류·스키마 불변).
- **new-userguide-section-dir** (`docs/*/`) — 미매칭. docs 디렉토리 변경 없음.
- **backend-api-change** (`*.controller.ts`, `dto/**`) — 미매칭. `triggers.controller.ts`·DTO 파일은 changeset 에 없다(`triggers.service.ts` 만 변경). 요청/응답 스키마·엔드포인트·HTTP 상태 코드 불변(`api_contract.md` 리뷰가 이미 확인: DTO 필드 구성 동일).
- **new-warning-code / new-error-code** — 미매칭. `warningRules`·`error-codes.ts` 변경 없음. 이번 diff 가 만지는 에러 처리는 기존 `rethrowEndpointPathConflict` 캐치 경로 그대로이며 신규 코드 발행 없음.
- **auth-session-flow-change** (`codebase/backend/src/modules/auth/**`) — 미매칭. 변경 파일이 `modules/triggers` 이지 `modules/auth` 가 아니다. 트리거 advisory lock 은 인증·세션·권한 흐름이 아니라 DB 레코드 동시성 제어이므로 의미상으로도 세션/권한 문서(`07-workspace-and-team/`) 대상과 무관.
- **expression-language-change** (`codebase/packages/expression-engine/**`) — 미매칭. expression-engine 파일 변경 없음.
- **run-debug-flow-change** — 미매칭. "실행·디버깅 흐름"은 워크플로 실행 엔진/디버그 로깅을 가리키며, 이번 변경은 트리거 설정 PATCH 의 내부 저장 로직이라 실행·디버그 UX 와 무관(사용자가 관측 가능한 유일한 차이는 lost-update 버그가 사라진 것 — 이는 "고쳐진 버그" 이지 새 흐름/화면이 아니다).
- **spec-major-change** (`spec/2-*`, `spec/5-*`, `spec/conventions/**` 등) — 미매칭. 이번 changeset 에 `spec/**` 파일 없음. (참고: 이전 리뷰 라운드의 `documentation.md`/`RESOLUTION.md` 가 `spec/2-navigation/2-trigger-list.md §203-205` 의 ⚠️ 문구가 이번 수정으로 실측 반증됐다고 이미 지적했고, plan `이 PR 이 안 하는 것` 절에 **planner 후속**으로 명시적으로 등재돼 있다. `spec/` 은 developer 쓰기 권한 밖이라 이 changeset 이 직접 고치지 않는 것이 역할 경계상 정상이며, 이미 트래킹된 사안이라 본 리뷰에서 새로 지적할 결함은 아니다.)
- 그 외 semantic 행(new-cross-cutting-enum, new-backend-ui-zod-value, new-handler-output-field, auth-config-type-enum-change, new-bullmq-queue, env-runtime-change, userguide-gui-flow-section, spec-defect-found) — 모두 미매칭. enum 값·zod ui 라벨·handler output 필드·AuthConfig type·BullMQ 큐·환경변수·docs GUI 흐름 절 어느 것도 이번 diff 대상이 아니다.

## 종합 판단

이번 changeset 은 `codebase/backend/src/modules/triggers/**` 와 대응 테스트(`triggers.service.spec.ts`, `trigger-transaction-mock.ts`, 신규 e2e-spec)에 국한된 **순수 내부 영속성 버그 수정**이다. 노드·UI 문자열·통합 provider·docs 섹션·인증/세션 흐름·표현식 언어·실행/디버깅 흐름·warning/error 코드·zod UI 라벨·handler output 필드 중 어느 trigger 도 발동하지 않는다 — API 응답 필드 구성, HTTP 상태 코드, 에러 코드, 사용자에게 보이는 트리거 설정 화면·문서 어느 것도 이번 수정으로 바뀌지 않는다(이미 `api_contract.md`·`documentation.md`·`scope.md` 이전 라운드 리뷰가 이를 각각 별도로 확인함). 유일하게 걸리는 사안(spec 의 ⚠️ 문구 반증)은 매트릭스의 어떤 행에도 속하지 않는 spec-defect 케이스이며, 이미 이전 라운드에서 발견·plan 등재·developer 권한 경계 확인까지 끝나 이번 라운드에서 새로 지적할 것이 없다.

## 발견사항

없음 — 매칭되는 trigger 없음.

## 요약

매트릭스 21개 행 전원 대조 결과 이번 changeset(`triggers.service.ts` 등 backend 영속성 로직 수정)에 매칭되는 trigger 는 0건이다. 노드/UI/통합/docs섹션/인증세션/표현식/실행디버깅/warning·error코드 어느 축도 발동하지 않았고, 이번 diff 가 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신을 요구할 이유가 없다. spec 의 반증된 ⚠️ 문구는 매트릭스 밖 사안이며 이미 이전 라운드에서 발견·트래킹 완료됐다.

## 위험도

NONE
