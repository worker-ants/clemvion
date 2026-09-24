# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 요약

1. SSOT 적재 — `.claude/config/doc-sync-matrix.json` (`rows[]` 21행) Read 완료 + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(155~234행) 본문 보조 Read 완료.
2. 변경 파일 식별 — `review/code/2026/09/25/00_39_02/meta.json` 이 이 세션의 정확한 변경 set(26개 파일)을 명시한다. `git status --short` 로 미커밋 잔여 없음 확인(이 리뷰 세션의 출력 디렉터리 자신만 untracked).

## 변경 파일 전수 (meta.json 기준)

- `.claude/tests/README.md` — 하네스 테스트 카탈로그(신규 행 1개 추가)
- `.claude/tests/test_minio_image_parity.py` — 신규 하네스 pytest (MinIO 계열 이미지 6곳 일치 가드)
- `.github/workflows/harness-checks.yml` — pathspec 3줄 추가 (위 신규 테스트 트리거용)
- `CHANGELOG.md` — 가드 신설 항목
- `plan/in-progress/minio-image-parity-guard.md` — 신규 plan
- `plan/in-progress/self-hosting-deployment.md` — 백로그 체크박스 2줄 추가 (아바타 공개 정책 참조, 신규 매니페스트 시 가드 자리 목록 갱신 안내)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — 백로그 항목 1개 추가 (`spec/0-overview.md` §8 numbering drift, planner 소관)
- `review/code/2026/09/25/00_25_55/**` — 직전 라운드 리뷰 산출물(RESOLUTION.md 포함, 이미 커밋됨)
- `review/consistency/2026/09/25/00_08_35/**` — `--impl-prep` consistency-check 산출물

## 매트릭스 매칭 분석

`.claude/config/doc-sync-matrix.json` 의 21개 행 trigger(`new-node`, `node-schema-change`, `new-ui-string`, `new-widget-chrome-string`, `integration-provider-change`, `new-userguide-section-dir`, `backend-api-change`, `new-bullmq-queue`, `new-warning-code`, `new-error-code`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-session-flow-change`, `auth-config-type-enum-change`, `expression-language-change`, `run-debug-flow-change`, `env-runtime-change`, `spec-major-change`, `userguide-gui-flow-section`, `spec-defect-found`) 를 변경 파일 26개 각각에 대조:

- `codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`, `codebase/channel-web-chat/src/**/*.tsx`, `codebase/frontend/src/content/docs/**`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, `spec/{2,3,4,5}-*/**`, `spec/conventions/**`, `codebase/backend/src/nodes/core/error-codes.ts`, `codebase/backend/src/modules/system-status/system-status.constants.ts` — 이 세션의 변경 set 어디에도 이 경로들에 해당하는 파일이 없다.
- 변경된 대상은 전부 `.claude/tests/**`(하네스 pytest), `.github/workflows/**`(CI 워크플로), `CHANGELOG.md`, `plan/**`(백로그·plan 문서), `review/**`(리뷰 산출물)이며, 이들은 matrix 21행 어느 trigger glob/semantic 판단 기준에도 속하지 않는다.
- `plan/in-progress/self-hosting-deployment.md` 에 추가된 체크박스("아바타 공개 정책 적용", "가드 자리 목록·pathspec 에 추가")는 **미래 작업 예고**(백로그 항목)이지 실제 `codebase/` 변경이 아니다 — 아직 코드가 없으므로 매트릭스 trigger 가 요구하는 "동반 갱신 대상 코드"가 존재하지 않는다.
- `CHANGELOG.md` 항목은 매트릭스의 target 이 아니라 (harness guard 신설 = CHANGELOG 항목이라는 별도 관례, MEMORY 의 "CHANGELOG 항목은 수정의 일부다" 규칙 대상) — user-guide-sync 매트릭스와 무관.

이 PR 은 순수하게 **하네스/CI 인프라 계층**의 작업이다 — object storage(MinIO) 이미지 참조가 `docker-compose.yml` / `docker-compose.e2e.yml` / `k8s/overlays/local/infra-minio.yaml` 세 파일 여섯 자리에 손으로 적혀 있어 부분 반영(`#1325`)이 났던 것을, YAML 파서 기반 pytest 가드로 고정하는 작업이다. 사용자 가시 제품 동작·UI 문자열·노드 스키마·인증 흐름·표현식 언어·docs MDX 콘텐츠 중 어느 것도 바뀌지 않았다.

## 발견사항

없음.

## 요약

매트릭스 21개 trigger 행 중 이번 변경 파일 26개(하네스 pytest 신설·CI workflow pathspec·CHANGELOG·plan 백로그 3건·직전 리뷰 산출물)에 매칭되는 행은 0건이다. 변경은 `codebase/backend/src/nodes/**`, frontend TSX/docs/i18n, auth 모듈, expression-engine 등 매트릭스가 감시하는 어떤 경로도 건드리지 않고, MinIO 이미지 참조 일치를 검증하는 순수 하네스 테스트 신설에 그친다. 유저 가이드 동반 갱신 관점에서는 해당 없음.

## 위험도

NONE
