# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows: 19) + `PROJECT.md §변경 유형 → 갱신 위치 매핑`(§111-180) 을 SSOT/보조로 적재.

## 변경 파일 매칭 요약

이번 변경 set(18개 codebase/plan 파일, `review/**` 산출물 20개 제외)은 backend 실행 엔진 재진입 input 버그 3지점 수정 + Manual Trigger 파라미터 이름 인라인 검증(hardening) 이다. 매트릭스 항목별 매칭:

- **new-node / node-schema-change** (`codebase/backend/src/nodes/**`) — 무매칭. 변경 파일 중 `codebase/backend/src/nodes/**` 경로 없음(참조만, `NODE_TYPES.MANUAL_TRIGGER` import). 신규 필드/라벨/타입 변경 없음(버그 수정으로 기존 문서화된 `defaultValue` 동작을 복원).
- **new-ui-string** (`codebase/frontend/src/**/*.tsx`, semantic) — **매칭, 이미 처리됨**. `trigger-configs.tsx` 가 `nodeConfigs.trigger.errorNameRequired/errorNameInvalid/errorNameDuplicate` 3개 신규 키를 `t()` 로 참조하고, `codebase/frontend/src/lib/i18n/dict/ko/nodeConfigs.ts` + `dict/en/nodeConfigs.ts` 양쪽에 동일 커밋으로 등록됨. TSX 내 하드코딩 한국어 리터럴 없음.
- **new-warning-code / new-error-code** — 무매칭. `INVALID_TRIGGER_PARAMETERS` 는 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum이 아니라 `workflows.controller.ts`(webhook/execute 경로)에서 이미 쓰이던 기존 HTTP-레벨 `BadRequestException` 코드를 저장 시점(`saveCanvas`)에도 재사용한 것 — `error-codes.ts` 미변경. `backend-labels.ts` 의 `ERROR_KO`/`WARNING_KO` 는 노드 실행결과·그래프 경고용이며, 이런 API-레벨 400 코드는 프론트가 애초에 개별 ko 매핑 없이 제네릭 `editor.saveFailed`("저장에 실패했어요") 토스트로 처리하는 기존 패턴과 동일 — 신규 매핑 의무 없음.
- **auth-session-flow / expression-language / run-debug-flow** (semantic) — 무매칭. 변경은 `execution-engine.service.ts`/`retry-turn.service.ts`의 재진입 dispatch loop 내부 `input` 전달 버그 수정으로, 이미 `02-nodes/triggers.mdx` FieldTable(defaultValue 필드, 34행)에 문서화된 "약속된 동작"을 정상화하는 것이지 새 흐름/새 사용자 가시 동작이 아님. `05-run-and-debug/` 어떤 페이지도 park/redrive/재진입 내부 메커니즘을 문서화하지 않아 갱신 대상 없음.
- **backend-api-change**(controller/DTO, semantic) — 무매칭. `workflows.controller.ts` 자체는 이번 diff에 없음(기존 코드 재사용). swagger jsdoc 영향 없음.

## 발견사항

- **[INFO]** 저장 시점 `INVALID_TRIGGER_PARAMETERS` 400 이 `02-nodes/triggers.mdx`/`.en.mdx` Callout 에는 반영됐으나(같은 turn, 확인됨) `05-run-and-debug/validation-errors.mdx`(캔버스 저장 차단/배지 안내 전용 페이지, 현재는 Parallel 중첩 규칙만 다룸)에는 언급되지 않음.
  - 변경 파일: `codebase/backend/src/modules/workflows/workflows.service.ts` (신규 저장 시점 게이트)
  - 매트릭스 항목: 없음 — trigger 어느 행에도 명확히 매칭되지 않는 회색 지대(`validation-errors.mdx` 의 frontmatter `spec:`/`code:` 는 Parallel-nesting 전용으로 스코프됨).
  - 상세: 매뉴얼 트리거 이름 규칙은 `triggers.mdx` 자체 Callout 으로 충분히 안내되고 있어 사용자 영향은 낮음. 참고용 INFO.
  - 제안: 필요 시 `validation-errors.mdx` 를 "노드별 저장 차단 규칙" 목록으로 일반화할 때 함께 편입 검토(비긴급).

- **[INFO]** `plan/in-progress/spec-update-manual-trigger-save-time-error-code.md` 가 `spec/4-nodes/7-trigger/1-manual-trigger.md §6`·`spec/data-flow/11-workflow.md`·`spec/data-flow/10-triggers.md`·`spec/5-system/3-error-handling.md` 갱신을 미완료 항목(`- [ ]`)으로 남겨둠.
  - 매트릭스 항목: 해당 없음(`spec/` 은 본 리뷰어의 영역 밖 — user-guide-sync 는 `codebase/frontend/src/content/docs/**` 만 대상). project-planner 후속 위임이 이미 plan 에 명시돼 있어 정상 처리 흐름.
  - 상세: 참고 목적으로만 기록, 조치 불요.

## 검증

matrix 가 지정한 guard test 전수 실행 — 전부 PASS: `i18n.test.ts`(14), `backend-labels.test.ts`+`hardcoded-korean-ratchet.test.ts`(24 passed/1 skipped), `triggers-coverage.test.ts`+`nodes-coverage.test.ts`+`no-internal-refs.test.ts`+`registry.test.ts`(593). i18n parity·backend-labels 매핑·docs registry 모두 이상 없음.

## 요약

매트릭스 19개 행 중 `new-ui-string`(TSX 신규 리터럴) 1개만 실질 매칭됐고, 해당 갱신(dict ko/en parity)은 같은 커밋에 이미 완료되어 CRITICAL/WARNING 없음. `new-node`/`node-schema-change`/`new-error-code`/`auth-session-flow`/`expression-language`/`run-debug-flow` 등 나머지 행은 이번 변경(실행 엔진 재진입 input 버그 수정 + 트리거 이름 인라인 검증)의 성격상 무매칭으로 판단(신규 필드·신규 error-codes.ts enum·신규 사용자 가시 흐름이 아니라 이미 문서화된 약속 동작을 복원하는 버그 수정). `02-nodes/triggers.mdx`+`.en.mdx` Callout 도 저장 시점 거부 동작을 반영해 이미 갱신됨. INFO 2건은 참고용(강제 조치 아님). 관련 guard test 전수 PASS 로 실측 확인.

## 위험도
NONE
