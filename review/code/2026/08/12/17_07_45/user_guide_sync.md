# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows[] 21건) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑(133-155행) 을 SoT 로 사용.

## 변경 파일 컨텍스트
27개 파일 중 실질 코드/스펙/plan 변경은:
- `CHANGELOG.md`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`
- `codebase/backend/src/modules/external-interaction/idempotency.interceptor.spec.ts`
- `plan/in-progress/backend-lint-gate-broken-on-main.md`
- `spec/data-flow/15-external-interaction.md`
나머지(파일 5~26)는 직전 리뷰 세션(`16_29_45`, `16_53_26`)의 `RESOLUTION.md`/`SUMMARY.md`/`_retry_state.json`/`meta.json`/reviewer 산출물 — 리뷰 인프라 산출물이라 매트릭스 trigger 대상 아님.

## 매칭 분석

External Interaction API 의 `Idempotency-Key` 캐시 인터셉터가 `409`/`410` 을 error 채널(`catchError`)까지 확장해 캐시·재현하도록 재설계한 내부 버그 수정. 매트릭스 21행을 전수 대조:

- **새 노드 추가 / 노드 schema 변경** — `codebase/backend/src/nodes/**` 글로브 불일치 (`modules/external-interaction/` 는 노드가 아님). 매칭 안 됨.
- **신규 UI 문자열(TSX)** — 이번 changeset 에 `.tsx` 파일 없음. 매칭 안 됨.
- **통합/제공자 변경** — provider 통합 변경 아님. 매칭 안 됨.
- **유저 가이드 신규 섹션 디렉토리** — `content/docs/**` 신규 디렉토리 없음. 매칭 안 됨.
- **백엔드 API 추가·변경**(semantic, targets: swagger jsdoc + user-guide 페이지) — 이 행이 가장 근접한 후보라 직접 확인함:
  - Swagger jsdoc(`interaction.controller.ts:70`) 은 이미 "Idempotency-Key 헤더로 24h 안전 재시도" 라고 상태코드를 특정하지 않고 일반적으로 서술 — 이번 수정과 모순되지 않음, 갱신 불요.
  - 유저 가이드 `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (291행) / `.en.mdx` (280행) 의 `Idempotency-Key` Callout 도 "동일 키 + 동일 body면 24시간 캐시된 응답을 그대로 받아요" 라고 상태코드 구분 없이 일반 서술 — 이 문장은 원래도(버그가 있던 시절에도) "목표 동작" 을 서술하고 있었고, 이번 PR 은 **구현을 그 서술에 맞춘 것**이라 문서 쪽 텍스트 변경이 필요 없음. 즉 이 PR 이 만든 신규 gap 이 아니라 기존에 이미 정합했던 문서.
  - 결론: 이 행은 trigger 매칭은 되지만 **동반 갱신 누락은 없음** (docs 가 이미 target 상태를 서술).
- **신규 warningCode/errorCode 발행** — `STATE_MISMATCH`/`EXECUTION_TERMINATED`/`VALIDATION_ERROR` 모두 기존 코드, 신규 코드 발행 없음. 매칭 안 됨.
- **인증·권한·세션 흐름 변경** — `modules/auth/**` 변경 없음. 매칭 안 됨.
- **표현식 언어 변경** — `packages/expression-engine/**` 변경 없음. 매칭 안 됨.
- **실행·디버깅 흐름 변경**(05-run-and-debug) — 이 변경은 워크플로우 실행 엔진/디버그 로깅이 아니라 External Interaction API 의 HTTP 레벨 캐싱 인터셉터라 판단 대상과 무관. 매칭 안 됨.
- **spec 신규/대규모 변경**(`spec/{2,3,4,5}-*/**`, `spec/conventions/**`) — 변경된 `spec/data-flow/15-external-interaction.md` 는 이 glob 에 속하지 않음(별도 `data-flow/` 트리, 이 매트릭스 행의 대상 밖). 다만 이 spec 파일은 **이미 같은 changeset 안에서 캐치업 갱신됨** — §R8 갭 캐veat(`⚠️ 현행 구현은 statusCode >= 400 …`) 를 제거해 구현과 재정합. 동반 갱신이 필요했던 유일한 SoT 문서가 이미 같은 diff 에 포함돼 있어 누락 없음.
- **user-guide GUI 흐름 절 신규/변경**(`02-nodes/**.mdx`) — 이번 changeset 에 `.mdx` 파일 자체의 변경은 없음(문서는 이미 정합해 손댈 필요가 없었음). 매칭 대상 아님.

## 발견사항
없음 — 매칭된 유일한 후보(백엔드 API 변경 → user-guide 페이지)를 직접 대조한 결과 사용자 가이드(`02-nodes/triggers.{mdx,en.mdx}`)와 swagger jsdoc 모두 이번 수정 이전부터 "목표 동작"을 일반적으로 서술하고 있어 텍스트 갱신이 불필요했고, 유일하게 실제 동반 갱신이 필요했던 `spec/data-flow/15-external-interaction.md` 는 같은 changeset 안에서 이미 갱신돼 있다(§R8 갭 caveat 제거).

## 요약
매트릭스 21개 trigger 행을 전수 대조했으며, 이번 changeset(backend `idempotency.interceptor.ts`/`.spec.ts` + `CHANGELOG.md` + `plan/` + `spec/data-flow/15-external-interaction.md`, 나머지는 리뷰 인프라 산출물)은 노드/UI문자열/통합/섹션디렉토리/warningCode·errorCode/인증흐름/표현식언어/실행디버깅 어떤 trigger 에도 실질 매칭되지 않았고, 유일하게 근접했던 "백엔드 API 변경 → user-guide" 행도 직접 대조 결과 기존 문서(`02-nodes/triggers.mdx`+`.en.mdx`, swagger jsdoc)가 이미 목표 동작을 일반 서술로 담고 있어 텍스트 갱신 불요였으며, 필요했던 spec 갱신은 이미 같은 diff 안에 포함돼 누락 0건이다.

## 위험도
NONE
