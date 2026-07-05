# 정식 규약 준수 검토 — `spec/4-nodes/4-integration`

검토 모드: `--impl-done` (구현 완료 후)
Diff base: `main`
대조 규약: `spec/conventions/node-output.md`, `spec/conventions/error-codes.md`, `spec/conventions/chat-channel-adapter.md`, `spec/conventions/cafe24-api-catalog/**`
참고 코드(HEAD 워킹트리 절대경로): `/Volumes/project/private/clemvion/.claude/worktrees/fervent-albattani-8dc848/codebase/backend/src/nodes/integration/http-request/{http-request.handler.ts,http-request.handler.spec.ts,http-request.schema.ts}`, `codebase/backend/src/nodes/core/error-codes.ts`

## 검토 대상 커밋

이번 라운드가 검토하는 실질 변경은 `5b2b8eeea fix(http-request): SSRF 차단 에러 메시지 일반화 (정찰 면 축소) + redirect HTTP_BLOCKED 정합 (#814)` 이다 — `1-http-request.md` §6/§8.3(신설), `2-database-query.md` Rationale 각주 갱신, `2-navigation/4-integration.md`·`5-system/2-api-convention.md` anchor 오타 수정. 동일 diff 에 대해 이미 두 차례(`--impl-prep` 12_55_17, `--impl-done` 13_55_19) convention_compliance 검토가 수행됐으며, 본 라운드는 그 결과를 코드/테스트 직접 재검증으로 확인한다.

## 발견사항

### [INFO] `EMAIL_HOST_BLOCKED` 행에 "메시지 일반화" 각주 누락 — 3-노드 표기 비일관

- target 위치: `spec/2-navigation/4-integration.md` 에러 코드 표, `EMAIL_HOST_BLOCKED` 행 (라인 1087)
- 위반 규약: 엄밀한 위반은 아님 — `spec/conventions/node-output.md` §3.2 (`output.error` 표준 envelope, message 서술 정합성) 관점의 표기 일관성 이슈
- 상세: 같은 표에서 `DB_HOST_BLOCKED`(라인 1091)·`HTTP_BLOCKED`(라인 1094) 행은 모두 "(메시지는 host/IP 미포함 일반화)" 각주를 갖는데, `EMAIL_HOST_BLOCKED` 행만 이 각주가 없다. Send Email 은 이미 오래전부터 host/IP 미노출 일반화 메시지를 채택해온 노드(§8.0 Rationale, `EMAIL_HOST_BLOCKED` 코드 자체가 그 정책의 최초 도입 지점)라 실제 동작은 3-노드 모두 동일하게 일반화되어 있음을 코드로 확인했다(`send-email.handler.ts` 의 `EMAIL_HOST_BLOCKED` 처리는 4-integration/3-send-email.md §Rationale 8.0 이 명시). 즉 **동작 불일치는 아니고 순수 문서 각주 누락**이다.
- 제안: `EMAIL_HOST_BLOCKED` 행에도 동일 각주("메시지는 host/IP 미포함 일반화")를 추가해 3-노드 표기를 정렬. 강제 아님(INFO), 다음 편집 시 반영 권장.

## 검토 관점별 확인 (문제 없음)

- **명명 규약**: `HTTP_BLOCKED`/`DB_HOST_BLOCKED`/`EMAIL_HOST_BLOCKED` 모두 `error-codes.md` §1 의 의미 기반 명명(무엇이 잘못됐는지 이름으로 드러남) + `UPPER_SNAKE_CASE` 를 따른다. 신설된 client-facing 상수 `SSRF_BLOCKED_CLIENT_MESSAGE`(`http-request.handler.ts:36`)는 `error.code` enum 이 아니라 message 리터럴이므로 `error-codes.md` 의 코드 명명 규율 대상이 아니며 별도 위반도 없다. `error-codes.ts` 의 `HTTP_BLOCKED` 자체는 **rename 되지 않고 유지**됐다(§2 안정성 정책 — "종전 아카이브 개선안의 `HTTP_SSRF_BLOCKED` 후보는 기존 `HTTP_BLOCKED` 유지" 로 spec 자체가 명시, 코드에서도 동일 코드 문자열 유지 확인).
- **출력 포맷 규약(`output.error` envelope)**: `node-output.md` Principle 3.2 의 `{code, message, details?}` 형태를 코드가 그대로 따른다. `details` 는 `{ url, method }` 만 실어 host/IP 를 별도 경로로 노출하지 않으며, spec §Rationale 8.3 이 기각한 대안 (B)("details 로 이전")를 코드도 취하지 않아 spec-코드 일치.
- **문서 구조 규약**: `1-http-request.md` 는 기존 `## 8. Rationale` 섹션 내부에 `### 8.3` 하위 절을 추가하는 형태로 확장 — Overview/본문/Rationale 3섹션 구조를 그대로 유지한다. 폴더 명명(`0-common.md` cross-cutting 진입, `_product-overview.md`, 노드별 `N-slug.md`)도 CLAUDE.md 컨벤션과 일치.
- **API 문서 규약**: 이번 diff 는 노드 핸들러 계약(spec/코드)만 다루며 REST controller·DTO·swagger 데코레이터 변경이 없어 스코프 밖(N/A).
- **금지 항목**: SSRF 차단 메시지에 원본 hostname/IP 를 노출하는 패턴(CWE-209 정찰 면)을 오히려 제거하는 방향의 변경 — 금지 패턴 재도입 없음. `error-codes.md` §2 의 "이름 정확성 향상만을 위한 rename 금지" 원칙도 준수(코드 유지, message 만 변경).
- **spec-link-integrity**: `2-database-query.md` → `1-http-request.md#83-...` cross-reference anchor 를 포함한 전체 spec 문서 내부 링크 검증 테스트(`codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`, `vitest run`)가 11/11 통과 — 신설 앵커·anchor 오타 수정(`datitems`→`dataitems`) 모두 정합.
- **테스트 정합**: `http-request.handler.spec.ts` 가 `output.error.message === 'Request blocked by SSRF policy.'` + `not.toContain('169.254')` + redirect-hop `HTTP_BLOCKED` 라우팅을 구체적으로 단언하며, spec 서술(§4.2 Usage 로깅 매트릭스, §6 에러 코드 표, §Rationale 8.3)과 정확히 대응된다.
- **chat-channel-adapter.md 매핑**: `HTTP_BLOCKED` 는 이미 §3.1 표에 `executionFailedInternal` 로 분류돼 있으며, 이번 변경(message 내용·redirect 라우팅 정정)은 `error.code` 값 자체를 바꾸지 않으므로 분류표에 영향 없음.

## 요약

이번 구현(`HTTP Request` SSRF 차단 메시지 일반화 + redirect-hop `HTTP_BLOCKED` 라우팅 정합)은 `node-output.md`(Principle 3.2 에러 envelope) · `error-codes.md`(§1 의미 기반 명명, §2 rename 안정성) · `chat-channel-adapter.md`(코드-분류 매핑) 등 검토 대상 정식 규약을 모두 준수한다. 코드(`http-request.handler.ts`, `error-codes.ts`)와 테스트(`http-request.handler.spec.ts`)를 직접 확인한 결과 spec 서술과 정확히 일치하며, `spec-link-integrity` 테스트도 전수 통과한다. 유일한 발견은 `2-navigation/4-integration.md` 표의 `EMAIL_HOST_BLOCKED` 행에 `DB_HOST_BLOCKED`/`HTTP_BLOCKED` 행과 동일한 "메시지 일반화" 각주가 누락된 INFO 수준의 표기 비일관(실제 동작 차이는 없음)뿐이다. 이는 동일 diff 에 대한 직전 두 라운드(`--impl-prep`, `--impl-done`)의 결론과도 일치한다.

## 위험도

NONE
