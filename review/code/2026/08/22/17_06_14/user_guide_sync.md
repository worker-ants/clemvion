# 유저 가이드 동반 갱신(User Guide Sync) 검토 — `eia-error-code-unify`

## 방법론

`.claude/config/doc-sync-matrix.json` (rows[]) 을 SSOT 로 Read, `PROJECT.md` §변경 유형 → 갱신 위치
매핑(127~197행) 을 보조로 Read. 변경 파일은 prompt 에 포함된 21건(코드 3 · docs mdx 2 · plan 2 ·
review 산출물 8 · spec 6) — `git show --stat c9a78d04f` 로 실제 커밋 diff 도 교차 확인(13파일,
prompt 의 review/ 8건은 선행 커밋 `b54657007` 소속이라 이번 코드 커밋 범위 밖).

핵심 변경: `POST /executions/:id/re-run` 의 최상위 `error.code` 를 `INVALID_INPUT` →
`INVALID_TRIGGER_PARAMETERS` 로 리네임해 주 실행(`/execute`)·저장(`/save`) 경로와 통일.

## 매트릭스 매칭

| trigger | 매칭 여부 | 근거 |
|---|---|---|
| `backend-api-change` (glob `**/*.controller.ts`) | **매칭** | `codebase/backend/src/modules/executions/executions.controller.ts` 변경 |
| `new-node` / `node-schema-change` (glob `codebase/backend/src/nodes/**`) | 불일치 | 변경 파일은 `modules/executions/**` — `nodes/**` 아님 |
| `new-error-code` (glob `codebase/backend/src/nodes/core/error-codes.ts`) | 불일치 | `ErrorCode` enum 파일 미변경. `INVALID_TRIGGER_PARAMETERS`/`INVALID_INPUT` 은 그 enum 에 없는 HTTP 봉투 최상위 코드(cross_spec 리뷰가 동일 결론: enum 히트 0건) |
| `new-warning-code` | 불일치 | warningRules 미변경 |
| `new-ui-string` (glob `*.tsx`) | 불일치 | `.tsx` 파일 변경 없음 |
| `new-userguide-section-dir` | 불일치 | 신규 섹션 디렉토리 없음, 기존 `02-nodes/` 파일 편집 |
| `spec-major-change` (glob `spec/{2,3,4,5}-*/**`, `spec/conventions/**`) | 매칭(참고) | spec 6파일 편집됨 — 이미 5-agent consistency-check(`16_34_50`, BLOCK:NO) 가 별도로 커버, 본 리뷰 스코프(docs mdx/i18n dict/backend-labels) 밖이라 중복 판정 생략 |
| 그 외 (auth, expression, run-debug, integration 등) | 불일치 | 해당 경로 미변경 |

## 누락 검출 결과

`backend-api-change` target (a) swagger jsdoc, (b) 사용자 안내 페이지 둘 다 **같은 커밋**
(`c9a78d04f`) 안에서 충족을 직접 확인했다.

- **(a) swagger jsdoc** — `executions.controller.ts:274` `@ApiBadRequestResponse({ description:
  'INVALID_INPUT / RERUN_DRY_RUN_NOT_APPLICABLE' })` → `'INVALID_TRIGGER_PARAMETERS / …'` 로 동반 수정.
- **(b) user-guide 페이지** — `codebase/frontend/src/content/docs/02-nodes/triggers.mdx:33` (KO) +
  `triggers.en.mdx:22` (EN) **양쪽** FieldTable `required` 행 description 이 `INVALID_INPUT` →
  `INVALID_TRIGGER_PARAMETERS` 로 동시 수정됨 — KO/EN parity 유지, 한쪽만 갱신된 CRITICAL 케이스
  아님.

### i18n dict / backend-labels 직접 재검증

```
grep -n "INVALID_INPUT\|INVALID_TRIGGER_PARAMETERS" codebase/frontend/src/lib/i18n/backend-labels.ts
→ 0건
grep -rn "INVALID_INPUT\|INVALID_TRIGGER_PARAMETERS" codebase/frontend/src codebase/channel-web-chat/src
→ triggers.mdx:33 · triggers.en.mdx:22 (문서 2곳)뿐, 코드 0건
```

두 코드 모두 `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 매핑 대상이 아니다(애초에 `ErrorCode`
enum 도 warningRules 도 아닌 HTTP 최상위 envelope 코드). 프런트 `rerun-modal.tsx` 의
`ERROR_CODE_TO_KEY` 는 `RERUN_*` 4종만 매핑하고 이 코드는 이전(`INVALID_INPUT`)에도 이후
(`INVALID_TRIGGER_PARAMETERS`)에도 동일하게 generic fallback 으로 떨어진다 — 리네임이 매핑 테이블의
동작을 바꾸지 않으므로 `backend-labels.ts` 동반 갱신 대상이 아니다(누락이 아니라 애초 무관).

### 잔여 docs 참조 확인

`05-run-and-debug/`·`07-workspace-and-team/` 전체를 grep 했으나 `INVALID_INPUT` 히트 0건,
`재실행`/`re-run` 언급은 에디터 내 노드 단독 재실행(별개 기능)뿐 — 이번 API 에러 코드 변경과
무관해 갱신 대상 아님.

### spec 동반 갱신 (참고, 본 리뷰 스코프 확장 검증)

6개 spec 파일(`1-manual-trigger.md`, `12-webhook.md`, `13-replay-rerun.md`,
`14-external-interaction-api.md`, `3-error-handling.md`, `conventions/error-codes.md`)이 같은
커밋에서 동반 개정됐고, 5-agent `/consistency-check --plan`(`16_34_50`, BLOCK:NO)이 인용 정확성·
Rationale 연속성·규약 준수를 이미 전수 검증했다. `spec/` 전체 grep 상 `INVALID_INPUT` 잔존 5건은
전부 "여기가 예전에 이 코드였다"는 이력 문구이고 발행 지점은 0건(plan 문서 자체 검증 기준과 일치).

## 발견사항

없음 — 매칭된 trigger(`backend-api-change`)의 동반 갱신 target 2개(swagger jsdoc, user-guide
페이지)가 모두 같은 커밋 안에서 KO/EN parity 를 유지하며 완결됐다. i18n dict·backend-labels·신규
섹션 locale 등은 애초에 트리거되지 않는 변경(신규 노드/신규 UI 문자열/신규 warning·error enum/신규
섹션 디렉토리 전부 불일치).

## 요약

매트릭스 21행 중 이번 변경 파일 세트에 매칭된 것은 `backend-api-change`(swagger+user-guide 동반
갱신, 직접 확인상 완결) 1건과 참고용 `spec-major-change`(별도 consistency-checker 커버) 1건이다.
`INVALID_INPUT`→`INVALID_TRIGGER_PARAMETERS` 리네임은 `ErrorCode` enum 도 warningRules 도 아닌
HTTP 최상위 코드라 `new-error-code`/`new-warning-code` 트리거는 애초 대상이 아니며, `backend-labels.ts`
는 두 코드 모두 매핑 대상이 아니었음을 grep 으로 직접 재확인했다. `02-nodes/triggers.mdx` +
`.en.mdx` KO/EN 페어가 같은 커밋에서 함께 수정돼 i18n parity CRITICAL 위험도 없다. 누락된 동반
갱신 없음.

## 위험도

NONE
