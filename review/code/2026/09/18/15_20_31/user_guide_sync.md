# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 절차 메모

- `.claude/config/doc-sync-matrix.json` (`rows[]`, 총 20행) Read 완료 + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (표는 JSON 과 1:1) 보조 확인.
- 변경 file 목록은 `git diff --name-only origin/main...HEAD` 로 보강 확인. `codebase/**` 범위는 아래 9개 파일뿐:
  - `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.conf`
  - `codebase/backend/migrations/V117__entity_last_seen_chunk_id_index.sql`
  - `codebase/backend/migrations/V118__relation_evidence_chunk_id_index.conf`
  - `codebase/backend/migrations/V118__relation_evidence_chunk_id_index.sql`
  - `codebase/backend/migrations/V119__relation_head_entity_id_index.conf`
  - `codebase/backend/migrations/V119__relation_head_entity_id_index.sql`
  - `codebase/backend/migrations/V120__relation_tail_entity_id_index.conf`
  - `codebase/backend/migrations/V120__relation_tail_entity_id_index.sql`
  - `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` (기존 e2e 스펙에 V117~V120 케이스 확장 + 헤더 주석 갱신)
- 그 외 변경은 `spec/1-data-model.md`, `spec/5-system/10-graph-rag.md`, `spec/data-flow/6-knowledge-base.md`, `plan/**`, `review/consistency/**` — 전부 `codebase/frontend/**` · `codebase/channel-web-chat/**` 밖.

## 매트릭스 매칭 결과

변경 파일을 매트릭스 20행 trigger 각각에 대조:

| trigger id | glob/semantic | 매칭 여부 | 사유 |
|---|---|---|---|
| new-node / node-schema-change | `codebase/backend/src/nodes/**` | 불일치 | 변경 파일이 `codebase/backend/migrations/**`, `codebase/backend/test/**` 뿐 — `src/nodes/**` 무관 |
| new-ui-string | `codebase/frontend/src/**/*.tsx` | 불일치 | frontend TSX 변경 없음 |
| new-widget-chrome-string | `codebase/channel-web-chat/src/**/*.tsx` | 불일치 | 해당 없음 |
| integration-provider-change | semantic (provider) | 불일치 | provider 연동 코드 아님 |
| new-userguide-section-dir | `codebase/frontend/src/content/docs/*/` | 불일치 | docs 디렉토리 변경 없음 |
| backend-api-change | `*.controller.ts`, `dto/**` | 불일치 | controller/DTO 변경 없음 |
| new-bullmq-queue | `system-status.constants.ts` | 불일치 | 무관 |
| new-warning-code / new-error-code | semantic / `error-codes.ts` | 불일치 | `warningRules`·`error-codes.ts` 변경 없음. FK 인덱스는 새 에러코드를 발행하지 않음(제약 위반이면 기존 DB 에러 그대로) |
| new-cross-cutting-enum | semantic | 불일치 | 해당 없음 |
| new-backend-ui-zod-value | semantic | 불일치 | zod ui 스키마 변경 없음 |
| new-handler-output-field | semantic | 불일치 | 노드 핸들러 output 변경 없음 |
| auth-session-flow-change | `codebase/backend/src/modules/auth/**` | 불일치 | auth 모듈 무관 |
| auth-config-type-enum-change | semantic | 불일치 | 해당 없음 |
| expression-language-change | `codebase/packages/expression-engine/**` | 불일치 | 해당 없음 |
| run-debug-flow-change | semantic (실행·디버깅 흐름) | **경계 판단 필요 → 불일치로 판정** | FK 인덱스 추가는 **DELETE 트리거 성능**(그래프 RAG 삭제 연쇄)만 바꾼다. 워크플로 실행·디버그 로깅·`05-run-and-debug/` 문서가 서술하는 사용자 대면 실행/디버그 흐름과 무관 — 순수 DB 계층 최적화로 동작·화면·로그에 가시적 변화 없음 |
| env-runtime-change | semantic | 불일치 | 신규 마이그레이션은 기존 Flyway 파이프라인으로 자동 적용, 기동 절차·env var 변경 없음 |
| spec-major-change | `spec/2-*,3-*,4-*,5-*/**`, `spec/conventions/**` | **매칭** (`spec/5-system/10-graph-rag.md`) | 아래 참고 — 갭 없음으로 확인 |
| userguide-gui-flow-section | `docs/02-nodes/**.mdx`, `docs/06-integrations-and-config/**.mdx` | 불일치 | 해당 MDX 미변경 |
| spec-defect-found | semantic | 불일치 | 해당 없음 |

### spec-major-change 매칭 상세 (갭 없음)

`spec/5-system/10-graph-rag.md` 가 `spec/5-*/**` glob 에 매칭됩니다. 확인한 target — frontmatter `code:`/`status:`/`pending_plans:` 정합, `status: implemented` 시 `code:` 글로브 매치 보장 — 은 이번 diff 가 **기존 구현 섹션(§2.3 Entity, §2.4 Relation)의 인덱스 목록에 항목을 추가**한 것뿐이라 frontmatter 자체를 건드리지 않았고, `spec/1-data-model.md` §3·Rationale, `spec/data-flow/6-knowledge-base.md` 인덱스 표까지 같은 커밋에서 3개 spec 파일이 함께 갱신되어 내용 정합이 유지됩니다. 이 항목은 성격상 consistency-checker 영역(별도로 `review/consistency/2026/09/18/14_54_15`, `15_04_02` 산출물이 이미 diff 에 포함)이 이미 다뤘고, 본 리뷰(User Guide Sync = 프론트엔드 docs MDX·i18n dict·backend-labels)의 관점에서는 실질 갭이 없습니다.

## 발견사항

없음.

이번 변경은 `codebase/backend/migrations/V117~V120` (그래프 RAG 삭제 연쇄 FK 파샬/일반 인덱스 4종)과 대응 `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts` 확장으로 구성된 **순수 DB 성능(인덱스) 개선**입니다. 노드 신규/스키마 변경, 프론트엔드 TSX/신규 UI 문자열, 통합·제공자 변경, 신규 유저 가이드 섹션, 인증·세션 흐름, 표현식 언어, 실행·디버깅 흐름, 신규 warning/error code — 매트릭스 20행 어디에도 실질적으로 걸리지 않습니다. 유일하게 glob 매칭된 `spec-major-change`(`spec/5-system/10-graph-rag.md`)도 같은 커밋 안에서 `spec/1-data-model.md`·`spec/data-flow/6-knowledge-base.md`와 함께 내용이 정합적으로 갱신되어 있어 갭이 없습니다. 사용자가 보는 `codebase/frontend/src/content/docs/**`, `dict/{ko,en}/**`, `backend-labels.ts` 는 이번 변경으로 stale 해질 이유가 없습니다.

## 요약

매트릭스 20개 trigger 전부 대조한 결과 매칭된 것은 `spec-major-change`(spec glob) 1건뿐이며 그마저 동일 커밋 내 3개 spec 파일 동반 갱신으로 갭이 없습니다. 나머지 19개 trigger 는 변경 파일(`codebase/backend/migrations/**` 신규 4쌍, `codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`)과 무관해 유저 가이드(docs MDX)·i18n dict·backend-labels 동반 갱신 누락 없음 — 본 리뷰 영역과 무관("해당 없음").

## 위험도

NONE
