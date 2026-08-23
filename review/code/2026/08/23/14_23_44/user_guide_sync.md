STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 Read 로 적재했다.

## 변경 파일 요약 (14개, 전부 review payload 기준)

| # | 파일 | 성격 |
|---|---|---|
| 1 | `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` | 마스킹 호출부 → 신규 헬퍼 교체 (동작 무변경) |
| 2 | `codebase/backend/src/modules/executions/executions.service.ts` | 〃 (3곳) + 로컬 `maskIfPresent` 제거 |
| 3 | `codebase/backend/src/shared/utils/redact-stored-error.ts` | 신규 오케스트레이션 헬퍼 2개(`redactStoredFieldsForResponse`/`redactNodeExecutionRow`) 추가. 기존 `deepRedactSecrets`/`redactStoredDataForResponse`/`redactStoredErrorForResponse` 마스커 자체는 무변경 |
| 4~5 | `plan/in-progress/*.md` | plan 문서 (트래커) |
| 6~13 | `review/consistency/2026/08/23/13_55_36/**` | 이전 라운드 consistency-check 산출물 (본 리뷰 대상 밖) |
| 14 | `spec/conventions/egress-masking.md` | §3 "알려진 stale 트리거" 취소선 처리 + 반증 blockquote 추가 (표 자체는 무변경) |

## 매트릭스 매칭

- **`run-debug-flow-change`** (semantic, "실행·디버깅 흐름 변경" → `05-run-and-debug/`) — `executions.service.ts`/`background-runs.service.ts` 가 실행 상세·본문 실행 응답 조립부라는 점에서 **의미상 근접 매칭**.
- **`spec-major-change`** (glob `spec/conventions/**`) — 파일 14(`egress-masking.md`)가 **직접 매칭**.
- 나머지 19개 행(신규 노드, 노드 schema, 신규 UI 문자열, 통합/제공자, 신규 섹션 디렉토리, auth 흐름, 표현식 언어, warning/error code, 신규 enum 등)은 이번 changeset 에 매칭 대상 파일이 없다 — frontend/i18n/노드/expression-engine/auth 모듈 파일이 changeset 에 전혀 없음.

## 발견사항

- **[INFO] `run-debug-flow-change` 매칭이나 실질 갭 없음 — 동작 무변경 리팩터**
  - 변경 파일: `codebase/backend/src/modules/executions/executions.service.ts`, `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts`
  - 매트릭스 항목: `run-debug-flow-change` — "실행·디버깅 흐름 변경" → targets: `codebase/frontend/src/content/docs/05-run-and-debug/`
  - 상세: `plan/in-progress/masking-gate-consolidation.md` 가 명시하듯 이 PR 은 4곳에 흩어진 마스킹 호출을 헬퍼 2개로 통합하는 **순수 리팩터**(마스킹 대상 필드·마스킹 시점·마스킹 표시 방식 전부 무변경)이며, M1/M2 뮤테이션 테스트로 회귀가 없음을 직접 검증했다. 실제로 `05-run-and-debug/run-results.mdx`(71·72·75·134행)와 `.en.mdx`(60·61·64·124행)는 이미 "Input/Output/Error 가 자격증명이면 `***` 로 가려진다", "Re-run 프리필 차단" 을 정확히 서술하고 있고 — 이 서술은 이번 리팩터가 보존하는 그 동작과 정확히 일치한다. 새로 노출되는 필드나 새로 바뀌는 사용자 가시 동작이 없으므로 문서 갱신 대상이 없다.
  - 결론: 갱신 불요 — 매칭은 되나 실제 누락 없음.

- **[INFO] `spec-major-change` 매칭 — `spec/conventions/egress-masking.md` 편집, frontmatter 정합 이슈 없음**
  - 변경 파일: `spec/conventions/egress-masking.md`
  - 매트릭스 항목: `spec-major-change` — targets: "(a) frontmatter `code:`/`status:`/`pending_plans:` 정합 갱신 (b) `status: partial` 이면 `pending_plans:` 신설 (c) `status: implemented` 이면 `code:` 글로브 ≥1 매치 보장"
  - 상세: `status: implemented` 유지, `code:` 프런트매터 6개 경로(모두 이번 diff 와 무관하게 실존)는 그대로다. 이번 diff 는 §3 "알려진 stale 트리거" 문장을 취소선 처리하고 실측 반증 blockquote 를 추가하는 **본문 정정**뿐이며 `code:`/`status:`/`pending_plans:` 어느 것도 손대지 않았다. 새로 언급된 심볼 `redactStoredFieldsForResponse`/`redactStoredDataForResponse`(신규 blockquote 87행)가 사는 파일 `codebase/backend/src/shared/utils/redact-stored-error.ts` 는 `code:` 목록에 없으나, 문서 §1 자신이 정의한 좌표계 범위는 "마스커(깊이 상한·비교 연산자를 소유하는 함수)" 이지 그 위에 얹힌 오케스트레이션 wrapper 가 아니다 — 신규 헬퍼는 독립 상한/연산자를 갖지 않고 기존 `deepRedactSecrets` 위에 얇게 얹힌 호출부일 뿐이라는 점이 diff 본문에 스스로 근거로 적혀 있다(87~90행). 같은 세션의 `review/consistency/2026/08/23/13_55_36/cross_spec.md` INFO#2 가 §R17 좌표계(표면 6·컬럼 2)와 코드가 정확히 일치함을 별도로 확인했고, `plan_coherence`/`convention_compliance` 도 LOW 로 판정해 CRITICAL 없음을 재확인했다.
  - 결론: `code:` 프런트매터 확장이 필요하다고 볼 근거가 약하다(문서 자신의 좌표계 정의상 범위 밖) — 갱신 누락으로 단정하지 않는다.

- **[해당 없음]** i18n dict(`ko/en`)·`backend-labels.ts`·`locale.ts`·docs MDX(02-nodes/06-integrations/04-expression-language) 트리거는 전부 매칭 파일 없음 — changeset 에 frontend TSX, 백엔드 노드, expression-engine, auth 모듈, warningRules, `error-codes.ts` 파일이 전혀 포함되지 않았다.

## 요약

매트릭스 21행 중 2행(`run-debug-flow-change` semantic 근접매칭, `spec-major-change` glob 직접매칭)이 이번 changeset 과 접점이 있었으나, 둘 다 조사 결과 실질적인 동반 갱신 누락이 아니었다 — 전자는 동작 무변경 리팩터라 기존 `05-run-and-debug` 문서 서술이 그대로 유효하고, 후자는 frontmatter(`code:`/`status:`/`pending_plans:`)가 이번 diff 로 손상되지 않았으며 문서 자신의 좌표계 정의상 신규 헬퍼 파일을 `code:` 에 추가할 근거가 약하다(같은 세션 5개 consistency checker 가 이미 LOW/NONE 으로 재확인). CRITICAL/WARNING 은 0건이다.

## 위험도

NONE
