# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 (155~304행) 을 Read 함. 이번 변경 set 은 이 매트릭스가 원래 막으려던 결함(가이드가 실재하지 않는/은퇴한/지어낸 에러 코드를 이름으로 적음)을 **직접 고치는 PR** 이며, 정황상 다음 trigger 들과 매칭된다.

## 변경 set 요약 (`git diff origin/main...HEAD --name-only` 기준)

- 백엔드: `llm.service.ts`(`testConnection` 반환 필드 `error`→`message`), `model-config-response.dto.ts`/`integration-response.dto.ts`(`latencyMs` 제거), 관련 `*.spec.ts` 3종, 신규 계약 테스트
- 프런트: `lib/api/model-configs.ts` + 테스트(타입 동기화)
- 문서(ko+en 쌍 전부 동반):
  - `02-nodes/integrations.{mdx,en.mdx}` — `MAKESHOP_API_ERROR` → `MAKESHOP_404` + 코드 계열 설명
  - `05-run-and-debug/error-handling.{mdx,en.mdx}` — `NODE_EXECUTION_FAILED` 예시 → `LLM_TIMEOUT`
  - `05-run-and-debug/run-results.{mdx,en.mdx}` — 은퇴 코드(`NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`) 제거, 노드 종류별 코드표 신설
  - `06-integrations-and-config/models.{mdx,en.mdx}` — 지어낸/로드맵 코드 5행 표 → 실제 8갈래 고정 문장 표 + `<ImplAnchor kind="api-endpoint">`
- 신규 가드: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-{scan.ts,existence.test.ts}` — 가이드가 에러 코드 문맥에서 적는 모든 이름이 backend/packages 소스에 실재하는지 검증(베이스라인 0)

## 발견사항

- **[INFO]** 신규 가드가 `spec/conventions/user-guide-evidence.md §2.1` 관계표에 아직 등재되지 않음
  - 변경 파일: `codebase/frontend/src/lib/docs/__tests__/guide-error-code-existence.test.ts` (신규)
  - 매트릭스 항목: 직접 대응 행은 없음(매트릭스는 frontend docs/dict/backend-labels 축이고, 이 항목은 spec/conventions 등재 축) — 인접 근거는 `PROJECT.md` 241행 "`spec/conventions/user-guide-evidence.md` — `<ImplAnchor>` + 3개 reverse-coverage 가드 SoT"
  - 상세: 이 가드는 기존 3개 가드(`impl-anchor-existence`·`integrations-coverage`·`triggers-coverage`)와 같은 "가이드→코드 실재성" 가족인데, `spec/conventions/user-guide-evidence.md` 는 `spec/**` 라 developer 쓰기 범위 밖. `plan/in-progress/guide-error-code-truth.md` §D 가 이를 정확히 인지하고 planner 위임 항목으로 등재해 두었음(§E 표 "3. testConnection 실패 응답 필드가 어느 spec 표에도 없다" 등 3건과 함께). 즉 **누락이 아니라 올바르게 스코프를 지켜 다음 턴(planner)으로 넘긴 상태**.
  - 제안: 조치 불요 — 이미 plan 에 등재됨. 후속 planner 턴에서 §2.1 표에 이 가드 행 추가만 확인.

- **[INFO]** 신규로 정확해진 노드 실행 에러 코드(`HTTP_TRANSPORT_FAILED`·`DB_QUERY_FAILED`·`LLM_TIMEOUT`·`SUB_WORKFLOW_*`·`MAKESHOP_404` 등)가 `backend-labels.ts` 의 `ERROR_KO` 에 매핑돼 있지 않아, 실행 결과 화면에서 이 코드들이 실제로 발생하면 한국어가 아니라 영문 코드/메시지가 그대로 노출됨
  - 변경 파일: (매핑 누락 파일) `codebase/frontend/src/lib/i18n/backend-labels.ts` — 이번 diff 에 포함되지 않음
  - 매트릭스 항목: `new-error-code` — "backend-labels.ts 에 ERROR_KO 매핑 테이블이 없어 영문 message 노출됨. errorCode 추가 시 사용자 가시 ko 노출을 PR 본문에 명시(후속 plan 에서 ERROR_KO 신설 검토)" (`doc-sync-matrix.json`) / `PROJECT.md` 172행 동일 문구
  - 상세: **단, 이 trigger 는 `codebase/backend/src/nodes/core/error-codes.ts` 의 `ErrorCode` enum 신규 추가에 걸린다.** 실측 결과 이 파일은 이번 diff 에 없고(`git diff origin/main...HEAD --stat` 무매치), `HTTP_TRANSPORT_FAILED`/`DB_QUERY_FAILED`/`LLM_TIMEOUT`/`SUB_WORKFLOW_*`/`MAKESHOP_*` 코드들은 모두 이 세션 이전부터 backend 소스에 실재하던 코드다(`error-codes.ts` 최근 변경 이력은 `#1262`/`#1251`, 이 세션과 무관). 이번 PR 은 **가이드가 이 기존 코드를 정확히 인용하도록 고쳤을 뿐**이라 "신규 errorCode 발행" trigger 자체가 발동하지 않는다. `ERROR_KO` 매핑 공백은 사전부터 있던 상태이며, `plan/in-progress/guide-error-code-truth.md` §F 가 "이 배치와 같은 병이지만 제품 결정(코드를 UI 에 노출할지)이 선행이라 성격이 다르다" 며 트래커 `#1328` 등재분으로 명시적으로 분리해 둠.
  - 제안: 이번 PR 범위의 조치는 불요(정확한 스코프 판단). 다만 사용자 영향은 실재하므로(가이드가 이제 "노드가 실패하면 이런 코드가 뜬다" 고 정확히 서술하는데, 정작 그 코드가 뜨는 순간 한국어 라벨이 없다) `#1328` 트래커의 우선순위 판단 시 참고할 것.

## 트리거별 정합성 확인 (누락 없음 확인한 항목)

- `run-debug-flow-change` / `integration-provider-change` / `userguide-gui-flow-section`: `05-run-and-debug/*.mdx`·`06-integrations-and-config/models.mdx`·`02-nodes/integrations.mdx` 모두 **ko/en 쌍 동시 갱신** 확인. `models.mdx`/`.en.mdx` 는 `<ImplAnchor kind="api-endpoint" file="codebase/backend/src/modules/llm/llm-model-config.controller.ts" symbol="testConnection">` 를 신설해 `impl-anchor-existence.test.ts` 요건 충족.
- `MAKESHOP_404`·`MAKESHOP_422`·`MAKESHOP_4XX`·`MAKESHOP_5XX`·`MAKESHOP_AUTH_FAILED`·`MAKESHOP_RATE_LIMITED`·`MAKESHOP_TRANSPORT_FAILED` 전량이 `codebase/backend/src/nodes/integration/makeshop/{makeshop.handler.ts,makeshop-api.client.ts}` 에 리터럴로 실재함을 grep 으로 직접 재확인(가이드 신규 서술과 일치).
- `06-integrations-and-config/makeshop.{mdx,en.mdx}` 자체는 이번 diff 에 없음 — 확인해보니 애초에 코드 카탈로그를 싣고 있지 않았고(0건), 새로 고친 `02-nodes/integrations.mdx` 문단이 MakeShop 코드 전량을 인라인으로 직접 나열해 자기완결적이다("Cafe24 노드도 같은 방식" 문구는 Cafe24 자신의 목록 링크만 가리킴 — Cafe24 쪽은 `06-integrations-and-config/cafe24.mdx` 93~96행에 실제로 존재 확인). 즉 존재하지 않는 카탈로그로의 참조 누락(broken pointer)은 없음.
- `new-ui-string`(TSX i18n parity): 이번 diff 에 신규 TSX 컴포넌트/한국어 리터럴 추가 없음 — 해당 없음.
- `new-userguide-section-dir`: 신규 `docs/<NN>-<name>/` 디렉토리 없음 — 해당 없음.
- CHANGELOG.md 도 이 변경의 사용자 가시 영향(필드명 변경·제거 필드·가이드 정정)을 상세히 서술 — "사후 보정 PR" 이 아니라 같은 turn 안에서 문서·번역·가드가 동반됨.

## 요약

매트릭스 21행 중 문서 MDX 계열 5~6행(run-debug-flow-change, integration-provider-change, userguide-gui-flow-section 등)이 이번 diff 와 매칭되며, 실측 결과 **동반 갱신 누락 0건** — 오히려 이 PR 자체가 과거 누적된 doc-sync 결함(지어낸/은퇴한/로드맵 전용 에러 코드 5종이 가이드에 남아있던 것)을 ko/en 쌍 동시 수정 + 재발 방지 가드 신설로 닫는 교정 PR 이다. INFO 2건은 모두 "누락"이 아니라 "의도적으로 스코프 밖으로 분리해 이미 plan/tracker(#1328, 본 plan §D)에 등재된 상태"임을 확인한 것이다.

## 위험도

NONE
