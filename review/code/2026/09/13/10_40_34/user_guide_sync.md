# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json`(`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑을 Read 함. 본 changeset 은 이전 리뷰 라운드(`review/code/2026/09/13/10_12_19`)의 `architecture.md` WARNING#1·`api_contract.md` WARNING#3 지적에 대한 **후속 수정 라운드**다(`plan/in-progress/guide-error-code-truth.md` §G 확인). 즉 대부분의 doc-sync 실체(ko/en MDX 쌍, `<ImplAnchor>`, 신규 가드)는 이미 이전 라운드에서 검증됐고, 이번 라운드는 그 라운드가 남긴 gap 을 메우는 diff 다.

## 변경 set 매칭 (검증 완료 항목)

- `userguide-gui-flow-section` / `integration-provider-change` / `run-debug-flow-change`: `02-nodes/integrations.{mdx,en.mdx}`, `06-integrations-and-config/models.{mdx,en.mdx}`, `05-run-and-debug/{error-handling,run-results}.{mdx,en.mdx}` 전부 **ko/en 쌍 동시 갱신** 확인. 실측:
  - `MAKESHOP_API_ERROR` → `MAKESHOP_404` 치환 후 저장소 전수 grep 결과 `MAKESHOP_API_ERROR`·`NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`·`LLM_AUTH_ERROR`·`LLM_MODEL_NOT_FOUND` 잔존 0건 (`grep -rn ... codebase/frontend/src/content/docs/`).
  - `models.mdx`/`.en.mdx` 의 8갈래 문장표가 `sanitize-error.util.ts` 의 8개 `return '...'` 리터럴과 **글자까지 정확히 일치**함을 직접 대조(양쪽 다 확인).
  - `run-results.mdx`/`.en.mdx` 에서 `nodeName` → `nodeLabel` 정정 후 저장소 전체에 `nodeName` 잔존 0건.
  - `run-results.mdx`/`.en.mdx` 엔진 표에서 `LLM_RATE_LIMIT`(노드 표와 중복)이 제거돼 중복 없음.
  - `pnpm vitest run src/lib/docs`(23 파일, 3308 테스트) + `i18n`/`backend-labels` 스코프(291 파일) 전부 GREEN — 신규 가드(`guide-error-code-existence`·`guide-sanitized-message-parity`) 포함.
- `new-ui-string`(i18n parity): 이번 diff 에 실제 컴포넌트(`.tsx`, 테스트 제외) 신규 한국어 리터럴 없음 — 해당 없음.
- `new-userguide-section-dir`: 신규 `docs/<NN>-<name>/` 디렉토리 없음 — 해당 없음.
- `backend-api-change`: `integration-response.dto.ts`(`code` 추가)는 `spec/2-navigation/4-integration.md §9.1`(`798행` `{success:false, code:'INTEGRATION_INCOMPLETE'}`, `835행` `error: {code, message}`)이 **이미 문서화한 실제 동작**을 뒤늦게 DTO 에 반영한 것이라(행동 변화 아님) 유저 가이드 갱신 불요 — 실측으로 확인.

## 발견사항

- **[WARNING]** 이번 라운드가 신설한 두 번째 가드(`guide-sanitized-message-parity.test.ts`)가, 첫 번째 가드의 spec 등재를 요청하는 기존 planner 백로그 항목에 반영되지 않았다 — planner 가 그 항목을 그대로 처리하면 관계표에 가드 하나가 빠진 채 등재된다
  - 변경 파일: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts` (신규, 73줄)
  - 매트릭스 항목: 직접 대응 glob 행은 없음(semantic) — `userguide-gui-flow-section` 의 `convention_ref: spec/conventions/user-guide-evidence.md`. 해당 spec 문서 §2 는 현재 "Build-time 가드 (3건)"으로 못박혀 있고(`impl-anchor-existence`·`integrations-coverage`·`triggers-coverage`), §2.1 관계표에도 3건만 있다(직접 확인: `grep -n "2.1\|가드" spec/conventions/user-guide-evidence.md`).
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md` (~3234행)의 `[ ] user-guide-evidence.md §2.1 관계표에 새 가드가 빠져 있다` 항목은 라운드 1 에서 작성됐고 **`guide-error-code-existence.test.ts` 하나만** 등재 대상으로 지목한다("`#1330` 이 `guide-error-code-existence.test.ts` 를 그 컨벤션의 가드 가족에 넣었는데 §2 는 '가드 3건' 이라고 세고 §2.1 관계표에도 행이 없다"). 그런데 이번 라운드(같은 PR, 커밋 `a68457936`)가 신설한 `guide-sanitized-message-parity.test.ts` 는 자기 docstring 에서 스스로 "자매 `guide-error-code-existence.test.ts` 는 코드 **토큰**의 실재를 본다. 이 가드는 **문장의 일치**를 본다 — 표면이 다르다" 라고 명시해, 같은 `codebase/frontend/src/lib/docs/__tests__/` 가드 가족·같은 방향(가이드 진실성)임을 스스로 선언한다. `developer` 는 `spec/**` 쓰기 권한이 없어 이 등재는 planner 턴으로 넘겨야 하는데, 그 전달 매개체인 plan 백로그 노트가 두 번째 가드 존재를 언급하지 않아 **planner 가 이 노트만 보고 작업하면 가드 하나를 빠뜨린다**(§2 는 "3건→4건" 이 아니라 "3건→5건" 이 돼야 함).
  - 제안: 같은 PR 안에서(developer 쓰기 권한 범위인 `plan/**`) 그 백로그 항목 본문에 `guide-sanitized-message-parity.test.ts` 를 병기하고 "가드 2건 등재 대상"으로 갱신할 것. 별도 planner 턴을 기다릴 필요 없이 지금 고칠 수 있는 문서 정합성 문제다.

- **[INFO]** `TestConnectionResultDto.code` 신규 선언은 spec 이 이미 문서화한 기존 동작을 뒤늦게 반영한 것이라 유저 가이드 갱신은 불요 — 확인 완료, 조치 불필요
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` (게이트 464~479행)
  - 상세: `spec/2-navigation/4-integration.md` 798행 `POST /api/integrations/:id/test` 행이 `200 + { success:false, code:'INTEGRATION_INCOMPLETE' }` 를, 835행이 `error: { code, message }` 형식을 이미 명문화하고 있어 이 DTO 선언 추가는 **관측 가능한 사용자 동작 변화가 아니라 선언 vs 값 불일치의 사후 교정**이다. 매트릭스 `backend-api-change` 행의 "API 노출 변경이 사용자 안내에 영향" 조건이 성립하지 않는다.
  - 제안: 없음.

## 요약

매트릭스 21행 중 문서 MDX 계열(`userguide-gui-flow-section`·`integration-provider-change`·`run-debug-flow-change`) 및 신규 가드 관련 항목이 매칭됐다. 실측 결과 **ko/en MDX 쌍·`<ImplAnchor>`·에러 코드 표·가드 baseline 은 전부 정합**(guard 전수 GREEN, 잔존 은퇴/지어낸 코드 0건)이며, 이는 이전 라운드가 지적한 architecture/api_contract WARNING 을 정확히 닫은 결과다. 다만 그 수정 과정에서 신설한 **두 번째 가드가 이미 존재하던 planner 등재-대기 백로그 노트에서 누락**돼, 다음 planner 턴이 그 노트만 보고 작업하면 `spec/conventions/user-guide-evidence.md §2.1` 관계표에 가드 하나가 다시 빠지는 재귀적 gap 이 남는다 — WARNING 1건. CRITICAL 급 i18n parity·ERROR_KO/WARNING_KO 매핑·섹션 locale 등록 누락은 없음(해당 trigger 자체가 이번 diff 범위 밖).

## 위험도

LOW
