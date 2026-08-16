# 변경 범위(Scope) Review

> 이번 changeset 은 126개 파일, 대부분(약 90개)이 `review/code/**`·`review/consistency/**` 산출물이다.
> 프롬프트가 다수 파일의 diff 를 "크기 제한으로 생략"했으므로, 핵심 코드 파일(7·8번:
> `executions.service.spec.ts`/`executions.service.ts`)과 plan-hygiene 커밋의 실제 내용은
> `git diff origin/main...HEAD` 로 직접 열어 확인했다. 아래 위치 표기는 게이트 숫자가 있는
> 경우 게이트를, 없는 경우(생략된 diff) 함수/타입명으로 기재한다.

## 발견사항

- **[INFO]** 핵심 과제(내부 읽기 경로 `Execution.error` 마스킹)와 무관한 **plan 위생 chore** 가 별도 커밋으로 번들되어 있다
  - 위치: `.claude/docs/plan-lifecycle.md:80-101`(§4 `pending_plans` 대조표 신설) — 커밋 `fafb57e46` "chore(plan): mark 6 EIA plans complete"
  - 상세: 이 커밋은 이미 **머지된 6개 타 PR**(#1173~#1178)의 stale `in-progress` plan 문서(`eia-terminal-emit-facade.md`·`eia-stalled-atomicity.md`·`eia-terminal-error-sanitize.md`·`spec-draft-eia-error-masking-catalog.md`·`spec-draft-ws-types-canonical-location.md`·`spec-draft-eia-r8-alignment.md`) 6건을 `complete/` 로 이동하고, 그로 인한 인입 링크 7건(`spec-sync-external-interaction-api-gaps.md`·`retry-turn-terminal-guard.md`·`spec-draft-eia-notification-payload-contract.md`·`backend-lint-gate-broken-on-main.md`)을 `../complete/` 로 정정하며, `.claude/docs/plan-lifecycle.md` 에 `pending_plans` 키의 spec-레벨/plan-레벨 이중 의미를 문서화하는 새 절을 추가한다. 이 작업은 현재 worktree(`eia-followups-1464c0`)의 연결 plan(`eia-internal-rest-error-masking.md`) 완료와 직접적 인과관계가 없다 — 6건 중 `spec-draft-ws-types-canonical-location.md` 하나만 "유일 잔여 후속(plan-lifecycle 문서화)"을 통해 간접적으로 이 세션과 이어지고, 나머지 5건은 순수 backlog 정리다.
  - 이미 라운드 2(`17_35_49`) scope reviewer 가 동일 지적을 했고, `RESOLUTION.md` 는 `.claude/docs/plan-lifecycle.md §3` "plan 이동만 담은 별 PR 분리 금지" 를 근거로 무조치 처리했다. 다만 그 조항의 문면은 "이동만 담은 PR 을 만들지 말라"는 것이지 "발견한 모든 backlog 정리를 현재 무관한 PR 에 반드시 합쳐야 한다"는 의미까지는 아니다 — 즉 별도의 (이동-only 가 아닌) PR 로 분리하는 선택지도 정책과 상충하지 않는다. 그럼에도 (a) 별도의 명시적 커밋(`fafb57e46`)으로 완전히 분리돼 있고, (b) 실행 코드에는 어떤 영향도 없으며, (c) 이미 리뷰 라운드에서 근거와 함께 공개적으로 논의됐다는 점에서 실질 리스크는 낮다.
  - 제안: 조치 불필요(이미 논의·기록됨). 다만 향후 유사 상황에서는 "발견한 무관 backlog 정리"를 정말 같은 PR 에 넣어야 하는지, 별도의 (move-only 가 아닌) 작은 PR 로 분리 가능한지 재확인할 것.

- **[INFO]** 핵심 리팩터(`stripPrivateRelations` → `toResponseExecution` 개명, `stop`/`stopInternal` 분리)는 범위를 벗어나지 않는다 — 마스킹 관문 단일화라는 명시된 설계 목표에 직접 종속된 변경
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — 함수/타입 `toResponseExecution`, `stop`/`stopInternal`, 신규 타입 `ResponseExecution`/`ResponseNodeExecution` (해당 파일 diff 는 프롬프트에서 생략되어 `git diff` 로 직접 확인, 게이트 번호 인용 불가)
  - 상세: `stripPrivateRelations`(관계 제거만) 를 `toResponseExecution`(관계 제거 + 마스킹)으로 확장한 것과, `stop()` 을 얇은 마스킹 관문 + `stopInternal()`(TOCTOU 원자 UPDATE 본체)로 나눈 것 모두 JSDoc 에서 "자매 표면 중 하나가 관문을 우회하는 것을 막기 위해"라는 이유를 명시하고, 실제로 판별력 뮤테이션 표(발견 4곳 각각 별도 실패)로 그 필요성을 입증했다. plan 문서(`eia-internal-rest-error-masking.md`)의 "설계"·"조치" 절에도 사전에 이 리팩터를 명시적으로 계획해 두었다 — 사후 발견된 "김에 정리"가 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `explore-tools.service.ts` 값-패턴 마스킹 확장 시도는 되돌려져 최종 diff 에 흔적이 없다 — 확인됨
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` 외부(해당 파일 changeset 자체에 없음)
  - 상세: `review/code/2026/08/16/17_12_34/RESOLUTION.md`(#7)가 "처방(값-패턴 마스킹 합성)을 실제로 적용했다가 기존 `****9876` 접미 힌트 테스트가 RED 라 되돌렸다"고 기록한다. `git diff origin/main...HEAD --stat -- '*explore-tools*'` 로 실측한 결과 해당 파일에 대한 diff 는 **0건**이다 — 되돌림이 깨끗하게 완료됐고 잔여 코드·주석·미사용 import 가 남아 있지 않다.
  - 제안: 조치 불필요.

- **[INFO]** JSDoc/주석 추가는 전부 이번 변경의 동작·계약 변화를 설명하는 것으로, 무관한 주석 첨삭이 아니다
  - 위치: `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:299-302`(신규 3줄 주석), `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:65-73`·`:169-175`(JSDoc 블록 확장), `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts:64-65`(`@ApiPropertyOptional` description 확장)
  - 상세: 넷 모두 "이 필드는 이제 마스킹되어 DB 원문과 다를 수 있다"는, 이번 PR 이 만든 실제 계약 변화를 API 소비자(Swagger 문서 독자)에게 알리는 내용이다. `PROJECT.md` 의 "같은 turn 문서 갱신 의무"에 부합하며 스타일적 재작성이나 군더더기 주석이 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `review/code/**`·`review/consistency/**` 산출물 약 90개 파일은 스코프 이탈이 아니라 이 저장소의 강제 워크플로 산출물이다
  - 위치: `review/code/2026/08/16/{17_12_34,17_35_49,17_56_15,18_14_50}/**`, `review/consistency/2026/08/16/{16_03_57,16_32_42,16_48_55,17_35_13,18_20_34}/**`
  - 상세: CLAUDE.md·`.claude/docs/plan-lifecycle.md` 규약상 `review/` 는 gitignore 대상이 아니고, `/ai-review`·`/consistency-check` 산출물은 커밋에 포함되는 것이 정상 워크플로다(4라운드 리뷰 + 5라운드 consistency 세션이 이 PR 자신을 검증한 이력). 코드 변경과 무관한 별도 기능·리팩터가 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `spec/**` 6개 파일 diff(합계 59줄)는 plan 문서의 "spec 초안 ①~③ / planner 턴 ⓐ~ⓕ" 절에 사전 계획된 항목과 1:1 대응한다
  - 위치: `spec/1-data-model.md`(+1) · `spec/2-navigation/14-execution-history.md`(+3) · `spec/4-nodes/1-logic/12-background.md`(+3/-1) · `spec/5-system/14-external-interaction-api.md`(+46/-8, 프롬프트 파일 124) · `spec/5-system/6-websocket-protocol.md`(+2/-1) · `spec/conventions/secret-store.md`(+12/-1)
  - 상세: 예정 외 spec 편집(예: 관련 없는 절 재작성, 스타일 변경)은 확인되지 않았다. 각 파일의 변경 크기가 작고 plan 문서에 사전 명시된 지점(§R17 불릿 교체, R-5 캐비엇, `code:` 필드 추가, secret-store 비대상 등재 등)에 국한된다.
  - 제안: 조치 불필요.

## 요약

핵심 코드 변경(`redact-stored-error.ts`(+spec) 신규, `executions.service.ts`/`background-runs.service.ts` 소비처 4곳, DTO JSDoc 4곳)은 "내부 읽기 경로에도 종결 emit 과 동일한 자격증명 마스킹을 건다"는 단일 목표에 정확히 부합하며, 함께 포함된 리팩터(`stripPrivateRelations`→`toResponseExecution`, `stop`/`stopInternal` 분리, `ResponseExecution`/`ResponseNodeExecution` 타입 신설)도 그 목표를 위한 단일 관문화에 직접 필요한 것으로 JSDoc·판별력 뮤테이션으로 입증돼 있다. 시도했다가 되돌린 `explore-tools.service.ts` 확장은 흔적 없이 정리됐다. 유일하게 코어 과제와 인과관계가 약한 부분은 이미 머지된 6개 타 PR 의 stale plan 문서를 `complete/` 로 이동하는 chore(커밋 `fafb57e46`)인데, 이는 별도 커밋으로 명확히 분리되어 있고 실행 코드에 영향이 없으며 프로젝트 규약(§3 "이동만 담은 별 PR 금지")을 근거로 이미 라운드 2 scope 리뷰에서 논의·기록됐다. 나머지 대량 파일(`review/**` 90여개, `spec/**` 6개)은 이 저장소의 정규 리뷰/워크플로 산출물이거나 plan 에 사전 명시된 범위 내 편집이다. 포맷팅-only 변경, 미사용 import, 의도치 않은 설정 변경은 발견되지 않았다.

## 위험도

LOW
