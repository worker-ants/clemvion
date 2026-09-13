# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 검토 방법

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치
매핑 본문을 적재했다. 변경 파일 목록은 `git diff origin/main...HEAD --name-only` 로
`review/`·`plan/` 산출물을 제외하고 확정했다(21개 코드/문서 파일). 저장소 파일은 뮤테이션하지
않았다 — `grep`/`Read`/`git show`만 사용.

이번 PR (`911d9d7dd` → `a68457936` → `de99def86`) 은 그 자체가 **유저 가이드 동반 갱신 결함을
고치는 PR** 이다: `Test Connection` 실패 사유가 필드명 3층 불일치로 화면에 안 뜨던 버그를
고치고, 가이드가 적던 존재하지 않는/은퇴한/지어낸 에러 코드 5종을 실측으로 교정하며, 재발
방지 가드(`guide-error-code-existence`·`guide-error-code-scan`·`guide-sanitized-message-parity`)
를 신설한다. 이미 `/ai-review` 2라운드(10_12_19, 10_40_34 — 모두 Critical 0)와
`--impl-done` 2라운드가 이 changeset 을 훑었다. 본 리뷰는 그 위에서 매트릭스 trigger 관점만
독립적으로 재검증했다.

## Trigger 매칭 결과

| Trigger (matrix id) | 매칭 파일 | 요구 동반 갱신 | 같은 changeset 내 존재? |
|---|---|---|---|
| `backend-api-change` (dto/** 변경) | `integration-response.dto.ts`, `model-config-response.dto.ts` | swagger jsdoc + 관련 user-guide 페이지 | ✓ — 두 DTO 모두 필드별 leading comment/JSDoc 갱신, `models{,.en}.mdx`·`run-results{,.en}.mdx`·`error-handling{,.en}.mdx` 동시 갱신 |
| `run-debug-flow-change` | `error-handling{,.en}.mdx`, `run-results{,.en}.mdx` | `05-run-and-debug/` 갱신 | ✓ — 이미 diff 안에 포함 (이 trigger 를 이 PR 이 직접 닫음) |
| `integration-provider-change` (성격상 유사) | `integrations{,.en}.mdx` (`02-nodes/`, MakeShop 에러 코드 서술) | provider 관련 코드/문구 정합 | ✓ — `MAKESHOP_API_ERROR`→`MAKESHOP_404` + 실재 코드 계열, ko/en 동시 |
| `userguide-gui-flow-section` (`06-integrations-and-config/**.mdx`) | `models{,.en}.mdx` | `<ImplAnchor kind="ui-entry">` 의무 (GUI-flow 절 한정) | 해당 없음으로 정확히 판정됨 — 아래 상세 |
| `new-error-code` (`error-codes.ts` 변경) | 미해당 (파일 미변경) | `backend-labels.ts` ERROR_KO | 트리거 자체가 fire 하지 않음 (아래 상세) |
| `new-ui-string` (`*.tsx`) | `model-config-manager.test.tsx` (테스트만, 프로덕션 `.tsx` 무변경) | dict ko/en parity | 트리거 미해당 |

## 상세 확인

### 1) ImplAnchor `kind="ui-entry"` 의무 — 미해당 판정이 맞다

`models.mdx`/`.en.mdx` 의 "연결 테스트와 실패 메시지" 절에 `<ImplAnchor kind="api-endpoint">` 가
추가됐다. `spec/conventions/user-guide-evidence.md` 의 `integrations-coverage.test.ts` 설명에
따르면 `ui-entry` 앵커 의무는 **GUI flow 절**(heading 에 bareword `GUI` 또는 본문에
`**…GUI…**` bold) 에만 걸린다. 해당 절 heading("연결 테스트와 실패 메시지"/"Connection test
and failure messages")과 본문 어디에도 `GUI` 토큰이 없어 이 절은 GUI-flow 판정 대상이 아니다
— `api-endpoint` 단독 사용이 규약과 일치한다. 컨트롤러 대조(`grep`)로
`@Controller('model-configs')` + `@Post(':id/test')` = `POST /model-configs/:id/test` 가
`describes="POST /api/model-configs/:id/test"` 와 일치함도 확인했다.

### 2) `guide-error-code-existence`/`guide-error-code-scan` 신설 가드 — 스캔 범위 확인

가드가 `codebase/backend/src`, `codebase/packages` 를 기준집합으로 삼아 가이드 산문·표 셀의
UPPER_SNAKE 토큰(에러 코드 문맥)이 실재하는지 대조한다. 저장소 전체 `codebase/frontend/src/content/docs/`
에 대해 은퇴/지어낸 이름(`MAKESHOP_API_ERROR`, `NODE_EXECUTION_FAILED`, `INTEGRATION_ERROR`,
`LLM_AUTH_ERROR`, `LLM_MODEL_NOT_FOUND`, `LLM_CONNECTION_ERROR`) 잔존 참조를 직접
`grep -rn` 으로 재확인 — **0건**. 06-integrations-and-config/의 `makeshop.mdx`·`cafe24.mdx`
에는 애초에 에러 코드 표가 없어(코드 서술은 `02-nodes/integrations.mdx` 한 곳에 집중) 이번
PR 이 놓친 sibling 문서는 없었다.

### 3) `guide-sanitized-message-parity.test.ts` — SoT 문장 8종 실측 대조

`sanitize-error.util.ts` 의 `return '...'` 리터럴 8개를 직접 `grep` 으로 추출해
`models.mdx`/`.en.mdx` 표의 첫 열과 문자 단위로 대조 — 8/8 일치, 양쪽 로케일 표 구성도
행 순서·내용 동일(설명 열만 로케일별로 다름). ko/en parity 결함 없음.

### 4) `ERROR_KO`/`WARNING_KO` 매핑 — 이 PR 의 스코프가 아님 (재-flag 방지 목적으로 명시)

`run-results{,.en}.mdx` 신규 표가 인용하는 `LLM_TIMEOUT`·`HTTP_*`·`DB_*`·`CODE_*`·
`SUB_WORKFLOW_*` 등은 전부 **기존에 이미 존재하던** `ErrorCode` 값이며, 이번 diff 는
`codebase/backend/src/nodes/core/error-codes.ts` 를 건드리지 않는다 — 매트릭스
`new-error-code` 행의 glob trigger(`error-codes.ts` 변경)가 fire 하지 않으므로 같은 커밋에
`ERROR_KO` 매핑을 추가할 의무가 이 PR 에 없다. 실측으로도 이 코드들은 `backend-labels.ts` 의
`ERROR_KO`/`WARNING_KO` 어디에도 없음을 확인했지만, 이는 **이미 별도로 등재된 선행 이슈**다 —
`plan/in-progress/guide-error-code-truth.md` §F("등재만 하는 것")가 `#1328` 로 명시 참조하며
"코드를 UI 에 노출할 것인가" 라는 제품 결정이 선행돼야 하는 다른 성격의 문제로 이 PR 의 §A(이미
노출하기로 한 문장이 버그로 사라진 경우)와 정확히 구분해 두었다. 재-flag 하지 않는다.

### 5) spec/ 층 갱신 갭 — developer 권한 밖, 이미 planner 위임 확인

`spec/5-system/7-llm-client.md §8.3`(testConnection 실패 shape 미문서화),
`spec/5-system/3-error-handling.md §1.4`(Cafe24/MakeShop/OAuth/LLM 코드 카탈로그 누락),
`spec/conventions/user-guide-evidence.md §2.1`(신규 가드 관계표 미등재) 는 매트릭스 밖(spec 문서
동기화는 별도 게이트) 이지만 인접 사안이라 확인했다 — `plan/in-progress/spec-draft-nullable-notation-followups.md`
에 developer 가 3건 모두 planner 앞 항목으로 정확히 등재했음을 `git diff` 로 확인. CLAUDE.md
규약(`developer` 는 `spec/` 쓰기 권한 없음)을 정확히 따른 처리라 CRITICAL/WARNING 대상이 아니다.

## 발견사항

없음 — 매트릭스 trigger 4종(`backend-api-change`·`run-debug-flow-change`·
`integration-provider-change` 유사·`userguide-gui-flow-section`)이 이 changeset 에 매칭되고
전부 같은 changeset 안에서 동반 갱신이 완료돼 있음을 실측으로 확인했다. `new-error-code`·
`new-ui-string`·`new-node`·`node-schema-change`·`new-userguide-section-dir`·
`auth-session-flow-change`·`expression-language-change` 트리거는 대상 파일이 이 diff 에
없어 미해당이다.

## 요약

매트릭스 21행 중 4행이 이번 changeset 에 매칭됐고(`backend-api-change`,
`run-debug-flow-change`, `integration-provider-change` 유사, `userguide-gui-flow-section`),
4행 모두 같은 커밋 세트 안에서 요구된 동반 갱신(swagger jsdoc, `05-run-and-debug/` MDX,
`02-nodes/integrations.mdx` 코드 정정, ImplAnchor)이 실제로 이뤄져 있음을 독립적으로
재검증했다 — 신규 가드(`guide-error-code-existence`/`-scan`/`guide-sanitized-message-parity`)
가 SoT 대비 8/8 일치까지 고정했고, 저장소 전체 grep 으로 은퇴/지어낸 코드명 잔존 0건을
재확인했다. `ERROR_KO` 매핑 부재는 실재하지만 이 PR 이 새로 발행한 코드가 아니라(트리거
미해당) 이미 별도 이슈(#1328)로 등재·구분된 선행 갭이라 재-flag 하지 않았다. spec 층 갱신은
developer 권한 밖이라 planner 앞으로 정확히 위임돼 있음을 확인했다. 누락된 동반 갱신 0건.

## 위험도

NONE
