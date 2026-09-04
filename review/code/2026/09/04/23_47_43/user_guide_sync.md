# 유저 가이드 동반 갱신(User Guide Sync) 코드 리뷰

## 검토 절차

1. `.claude/config/doc-sync-matrix.json` (SSOT, `rows[]` 24행)을 Read.
2. `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문(표 + "자주 누락되는 항목")을 보조로 Read.
3. 이번 changeset 의 변경 파일 51개(prompt 상 `### 파일 1`~`51`) 전수를 위 매트릭스의 `trigger.globs`(glob 행) 및 `change_type`/`targets` 의미(semantic 행) 에 대조.

## 변경 파일 개요

이번 changeset 은 단일 목표(`schedule` 테이블 목록 조회 인덱스를 `(next_run_at, is_active)` 부분 인덱스에서 `(workspace_id, next_run_at)` 로 교체)로 수렴하는 DB 마이그레이션 PR 이다.

- DB 마이그레이션: `codebase/backend/migrations/V110__schedule_workspace_next_run_index.{conf,sql}` (신규)
- 테스트: `codebase/backend/src/modules/schedules/schedules.service.spec.ts` (unit 1건 추가), `codebase/backend/test/schedule-trigger.e2e-spec.ts` (e2e 스키마 검증 1건 추가)
- spec: `spec/1-data-model.md` (Schedule 인덱스 표 행 정정 + `## Rationale` 추가), `spec/data-flow/10-triggers.md` §2.1 (동일 정정 미러)
- plan: `plan/complete/spec-draft-schedule-index.md` (실측 draft, complete 로 이동), `plan/in-progress/spec-draft-nullable-notation-followups.md` (체크박스/종결조건 표 갱신)
- 나머지 34개 파일은 전부 `review/code/2026/09/04/{23_02_51,23_26_09}/**` (선행 코드 리뷰 RESOLUTION/SUMMARY/각 관점 리포트/meta.json) 및 `review/consistency/2026/09/04/{22_34_55,22_43_40}/**` (선행 consistency-check 산출물) — 이 리뷰 세션 자체가 만든 산출물이 아니라, **이전 라운드의 리뷰/일관성 검토 산출물**이다.

## 매트릭스 대조 결과

24개 trigger 행(new-node, node-schema-change, new-ui-string, new-widget-chrome-string, integration-provider-change, new-userguide-section-dir, backend-api-change, new-bullmq-queue, new-warning-code, new-error-code, new-cross-cutting-enum, new-backend-ui-zod-value, new-handler-output-field, auth-session-flow-change, auth-config-type-enum-change, expression-language-change, run-debug-flow-change, env-runtime-change, spec-major-change, userguide-gui-flow-section, spec-defect-found 등) 을 하나씩 51개 변경 파일에 대조했다.

- **glob 매칭**: `codebase/backend/src/nodes/**`, `codebase/frontend/src/**/*.tsx`, `codebase/channel-web-chat/src/**/*.tsx`, `codebase/frontend/src/content/docs/*/`, `codebase/backend/src/**/*.controller.ts`, `dto/**`, `codebase/backend/src/modules/system-status/system-status.constants.ts`, `codebase/backend/src/nodes/core/error-codes.ts`, `codebase/backend/src/modules/auth/**`, `codebase/packages/expression-engine/**`, `codebase/frontend/src/content/docs/02-nodes/**.mdx`/`06-integrations-and-config/**.mdx`, `spec/{2,3,4,5}-*/**`, `spec/conventions/**` — 이번 변경 파일 51개 중 **어느 하나도 매칭되지 않는다.** 변경은 `codebase/backend/migrations/**`, `codebase/backend/src/modules/schedules/**`(spec 파일, controller/dto 아님), `codebase/backend/test/**`, `plan/**`, `review/**`, `spec/1-data-model.md`, `spec/data-flow/**` 에 국한된다. `spec/1-data-model.md`/`spec/data-flow/10-triggers.md` 는 `spec-major-change` 행의 glob(`spec/{2,3,4,5}-*/**`, `spec/conventions/**`)에 해당하지 않는다(`spec/1-*` 와 `spec/data-flow/*` 는 그 glob 밖).
- **semantic 매칭 (판단)**:
  - `run-debug-flow-change` ("실행·디버깅 흐름 변경") — 검토했으나 불일치로 판단. 이번 변경은 `schedule` 목록 조회 쿼리의 **DB 인덱스 성능 최적화**이며, 워크플로 실행 엔진·디버그 로깅·실행 상세 페이지 어느 것도 건드리지 않는다. `schedule-trigger.e2e-spec.ts` 신규 케이스도 "인덱스가 존재하는가"를 검증하는 스키마 drift 방지 테스트이지 실행/디버깅 흐름의 변경이 아니다.
  - `auth-session-flow-change` — `codebase/backend/src/modules/auth/**` 무변경, 불일치.
  - `new-warning-code` / `new-error-code` — `warningRules`, `codebase/backend/src/nodes/core/error-codes.ts` 무변경, 불일치.
  - `integration-provider-change`, `new-backend-ui-zod-value`, `new-handler-output-field`, `new-cross-cutting-enum` — 해당 코드 표면(zod ui.\*, output.result.\*, cross-cutting enum, provider) 무변경, 불일치.
  - `backend-api-change` — controller/DTO 변경 없음(스키마 인덱스만), 불일치.
  - `spec-defect-found` — 이 changeset 자체가 이미 자기 자신을 통해 처리했다(§자기-반증형 소정정 예외, `RESOLUTION.md` W3 에 근거 명시: `--spec` 선행 + `--impl-done` 사후 그물 예정). 신규로 미결 spec 결함이 남아있지 않다.

## 발견사항

없음 — 매칭되는 trigger 가 없어 동반 갱신 누락을 판정할 대상 자체가 없다.

## 요약

매트릭스 24개 trigger 행 전체를 이번 changeset 51개 파일에 대조한 결과 **매칭 0건**이었다. 변경 범위는 `schedule` 테이블 목록 조회용 DB 인덱스 교체(V110 마이그레이션) + 그 검증 e2e/unit 테스트 + spec 표 정정(`1-data-model.md`, `data-flow/10-triggers.md`) + plan 갱신 + 선행 리뷰/일관성 검토 산출물뿐이며, 노드 추가·스키마 변경·TSX 신규 문자열·통합/제공자 변경·신규 섹션 디렉토리·auth 흐름 변경·표현식 언어 변경·실행/디버깅 흐름 변경·신규 warningCode/errorCode 발행 중 어느 것도 해당하지 않는다. 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신 의무가 발생하지 않는 순수 백엔드 DB 성능 마이그레이션 PR 이다.

## 위험도

NONE
