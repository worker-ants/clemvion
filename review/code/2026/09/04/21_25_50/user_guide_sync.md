# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 해당 없음

이번 changeset 은 `.claude/config/doc-sync-matrix.json` (`rows[]` 20개) 의 어떤 trigger 도 동반 갱신 누락 없이 충족한다.

### 매트릭스 적재

- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]`, id 기준 20행) Read 완료.
- 보조: `PROJECT.md` §"변경 유형 → 갱신 위치 매핑" (L128~198, 표 + "자주 누락되는 항목" + DOCUMENTATION 체크리스트) Read 완료.

### 변경 파일 전수 (prompt 상 실 코드 diff)

payload 의 파일 1~6 만 실질 diff 이고, 파일 7~52 는 이전 리뷰 라운드(`19_43_18`/`20_16_17`/`20_39_25`/consistency `20_05_42`)가 남긴 `review/**` 산출물이며 매트릭스 trigger 대상이 아니다 (docs/i18n/frontend 코드 아님).

- `CHANGELOG.md` — 문서(비-MDX), 매트릭스 대상 아님
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `threshold: number → string` 타입/애노테이션 정정
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — repo-guard 내부 정적 가드(신규 축 + AST 교체), 사용자 가시 표면 아님
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 가드의 단위 테스트
- `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — 신규 e2e (wire 타입 회귀 고정), 테스트 파일
- `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 문서

`git status --short` (본 세션 시작 시점) 로 확인한 워킹트리 변경분은 `review/code/2026/09/04/21_25_50/` (본 리뷰 산출물) 뿐이었고, 위 6개 파일은 이미 커밋된 changeset(직전 라운드들이 검토한 동일 변경 — `a65a4f85e` 계열)이다. `codebase/frontend/**` 파일은 이 changeset 어디에도 없음(prompt 파일 목록 grep 확인).

### 매트릭스 매칭 판정

- **새 노드 추가 / 노드 schema 변경** — 미매칭. `codebase/backend/src/nodes/**` 글롭에 걸리는 파일 없음. `alerts` 는 워크플로우 노드가 아니라 별도 `modules/alerts` 기능(알림 규칙)이다.
- **신규 UI 문자열(TSX)** — 미매칭. 변경 set 에 `.tsx` 파일 없음.
- **신규 위젯 chrome 문자열 / 통합·제공자 변경** — 미매칭.
- **유저 가이드 신규 섹션 디렉토리** — 미매칭. `codebase/frontend/src/content/docs/*/` 신규 디렉토리 없음.
- **인증·권한·세션 흐름 / AuthConfig enum / 표현식 언어 / 실행·디버깅 흐름 / 신규 BullMQ 큐 / cross-cutting enum / backend zod ui.label / handler output field** — 전부 미매칭. 해당 경로·패턴 어디에도 이번 diff 가 닿지 않는다.
- **신규 warningCode/errorCode** — 미매칭. `warningRules`·`codebase/backend/src/nodes/core/error-codes.ts` 변경 없음.
- **spec 신규/대규모 변경 / user-guide GUI 흐름 절** — 미매칭. `spec/**`, `02-nodes/**.mdx`, `06-integrations-and-config/**.mdx` 변경 없음.
- **백엔드 API 추가·변경** (`codebase/backend/src/**/dto/**`, PROJECT.md L142) — **매칭됨.** `alert-rule-response.dto.ts` 가 이 패턴에 해당. targets:
  - (a) "controller·DTO 의 swagger jsdoc" — **같은 changeset 안에서 충족.** diff 자체가 `@ApiProperty({ type: String, example: '10.0000' })` + 정정된 JSDoc(왜 문자열인지, wire 사실)을 포함한다.
  - (b) "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" — **적용 대상 없음.** `codebase/frontend/src/content/docs/` 전역에서 "threshold" 를 grep 하면 RAG/similarity threshold(`02-nodes/ai.mdx`, `06-integrations-and-config/knowledge-base.mdx`) 및 system-status 지연 임계값(`07-workspace-and-team/system-status.en.mdx`)만 나오고, 알림 규칙(Alert Rule) 기능·`threshold` 필드를 설명하는 user-guide 페이지는 존재하지 않는다. 갱신할 기존 페이지 자체가 없고, 이번 변경은 wire 바이트 불변(엔티티·프런트엔드 유일 소비자 `lib/api/alerts.ts` 는 이미 `threshold: string` 으로 다뤄 왔음, CHANGELOG 에 명시)인 순수 OpenAPI 문서 정정이라 사용자 가시 동작 변화도 없다. 따라서 "누락"이 아니라 "target 부재".

### 부수 확인 — spec 오기 후속은 이미 별도 트랙

`plan/in-progress/spec-draft-nullable-notation-followups.md` 는 `spec/1-data-model.md:873` 이 `threshold` 를 `Float` 로 오기하고 있음을 INFO 항목으로 이미 등재했고, developer 가 직접 spec 을 고치지 않고 `project-planner` 트랙(spec-defect-found 행의 절차)으로 넘겨둔 상태다 — 매트릭스 절차를 정확히 따르고 있다. `spec/conventions/swagger.md` numeric 불변식 성문화 항목도 마찬가지로 planner TODO 로 등재돼 있다. 둘 다 이 리뷰(frontend docs/i18n/backend-labels 동반 갱신)의 지적 대상이 아니다.

## 요약

매트릭스 20개 trigger 행 중 glob 매칭 1건("백엔드 API 추가·변경" — DTO 파일)만 성립했고, target (a) swagger jsdoc 은 같은 changeset 안에서 충족, target (b) user-guide 페이지는 갱신 대상 문서 자체가 사전에 존재하지 않고(grep 확인) wire 도 불변이라 "해당 없음"으로 판정된다(누락 아님). 나머지 19개 trigger 는 전부 미매칭 — `codebase/frontend/**`(docs MDX·i18n dict·backend-labels·locale.ts) 변경이 이 changeset 에 전혀 없어 parity 가드가 물 자리도 없다. i18n key parity 위반, warning/error code ko 매핑 누락, 신규 섹션 디렉토리 locale 미등록 등 CRITICAL 급 결함도 관측되지 않았다. 발견된 동반 갱신 누락 없음.

## 위험도

NONE
