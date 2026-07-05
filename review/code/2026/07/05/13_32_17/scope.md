# 변경 범위(Scope) Review

대상 커밋: `ea09f1d7f` (`fix(http-request): SSRF 차단 에러 메시지 일반화 + redirect SSRF HTTP_BLOCKED 정합`)
비교 참고: `plan/in-progress/http-ssrf-all-auth-followups.md` (해당 항목: "SSRF 에러 메시지 클라이언트 일반화"), `review/consistency/2026/07/05/12_55_17/SUMMARY.md` (`--impl-prep` 확정 작업 스코프)

## 발견사항

- **[INFO]** `spec/5-system/2-api-convention.md` 변경분이 이번 SSRF 작업과 무관 — diff base 포함 오차로 추정
  - 위치: `spec/5-system/2-api-convention.md` line 1584 (Rationale 앵커 오타 `#비-페이징-고정-컬렉션은-datitems-유지` → `#비-페이징-고정-컬렉션은-dataitems-유지`)
  - 상세: `git log`로 확인한 결과 이 1-line 앵커 오타 수정은 이번 target 커밋(`ea09f1d7f`, 13개 파일)에 포함되어 있지 않고, 그 직전의 별도 커밋 `70f6c3b17`(`docs(spec): api-convention Rationale anchor 오타 수정 (datitems→dataitems, #809 잔재)`)로 이미 독립적으로 커밋된 변경이다. review payload(`meta.json`)의 14개 파일 목록에 이 파일이 포함된 것은 `--branch main` 대비 diff 범위 산정(스냅샷 시점) 문제로 보이며, SSRF 에러 메시지 일반화 작업 자체가 이 파일을 건드린 것은 아니다. 실질 내용도 SSRF 와 완전히 무관(오타 수정)하고 harm 은 전혀 없다.
  - 제안: 코드 조치 불필요 — 이미 별도 커밋으로 존재하는 변경이라 이번 SSRF PR 의 실질 diff 로 볼 필요 없음. 다만 향후 리뷰 payload 생성 시 diff base(`--branch origin/main` 등)를 정확히 맞춰 무관 커밋이 changeset 에 섞이지 않도록 확인 권장.

- **[INFO]** `review/consistency/2026/07/05/12_55_17/**` 산출물이 changeset 에 포함 — 정책상 정당한 포함
  - 위치: `review/consistency/2026/07/05/12_55_17/{SUMMARY.md, _retry_state.json, convention_compliance.md, cross_spec.md, meta.json, naming_collision.md, plan_coherence.md, rationale_continuity.md}` (8개 파일)
  - 상세: CLAUDE.md 규약상 `developer` 는 구현 착수 직전 `consistency-check --impl-prep` 이 의무이며 그 산출물은 `review/consistency/**` 에 커밋되는 것이 정상 워크플로우다. 코드 변경(`.ts` 2개)·spec 변경(`.md` 3개) 과 나란히 같은 커밋에 묶인 것은 "관련 없는 파일 수정"이 아니라 규약이 요구하는 절차 증적이다. scope 위반으로 볼 사유 없음.
  - 제안: 조치 불필요.

- **[INFO]** `http-request.handler.ts` 의 catch 블록 재구조화(redirect SSRF 승격 경로)가 커밋 메시지 의도에 정확히 포함되어 있음 — 확장 아님
  - 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (`hops >= 5` 분기를 `Error` throw → `IntegrationError(HTTP_BLOCKED, ...)` throw 로 변경, redirect 대상 재검증을 `try/catch` 로 감싸 SSRF 실패 시 동일하게 `IntegrationError` 승격, 바깥 `catch (err: unknown)` 에 `if (err instanceof IntegrationError)` 분기 추가)
  - 상세: 커밋 메시지·plan follow-up·consistency-check SUMMARY(`convention_compliance.md` WARNING "redirect-hop SSRF 가 별도 catch 없이 바깥 catch 로 떨어져 HTTP_BLOCKED 아닌 오분류")가 모두 이 정정을 목표 스코프로 명시한다. `Logger` import·`logger.warn` 로깅 추가도 "원본 상세는 서버 로그에" 라는 동일 목표에 종속된 변경이다. 기능 확장(over-engineering) 이 아니라 정확히 요청된 2개 목표(메시지 일반화 + redirect SSRF 라우팅 정정) 범위 내.
  - 제안: 조치 불필요.

- **[INFO]** 신규 테스트 케이스(`blocks redirect to internal host with HTTP_BLOCKED + generalized message`) 는 새로 추가된 redirect 분기 커버 목적 — 스코프 내
  - 위치: `http-request.handler.spec.ts` (신규 `it` 블록, 기존 4곳의 메시지 단언 변경과 별개로 추가)
  - 상세: 코드 쪽에서 새로 승격한 redirect SSRF → HTTP_BLOCKED 라우팅 로직에 대응하는 테스트로, 기능 확장이 아니라 변경된 동작의 정당한 회귀 테스트.
  - 제안: 조치 불필요.

발견된 4개 파일(`spec/2-navigation/4-integration.md`, `1-http-request.md`, `2-database-query.md`) spec 변경은 모두 이번 코드 변경(`HTTP_BLOCKED` 메시지 일반화, redirect SSRF 라우팅)의 문서화이며, consistency-check(`cross_spec.md`)가 "구현 후 DB 수준 문서화 필요"로 명시적으로 요구한 항목과 정확히 일치한다. 새 섹션(`1-http-request.md §8.3`)도 이번 결정의 Rationale 신설로, 스코프 밖 리팩토링이 아니다.

## 요약

이번 커밋(`ea09f1d7f`)의 13개 파일은 커밋 메시지·`plan/in-progress/http-ssrf-all-auth-followups.md` 의 follow-up 항목·`consistency-check --impl-prep` SUMMARY 가 사전 합의한 스코프(HTTP_BLOCKED 메시지 일반화 + redirect SSRF 라우팅 정정 + 3개 spec 문서 동기화 + 절차상 의무인 consistency 산출물)와 정확히 일치하며, 요청 범위를 벗어난 리팩토링·기능 확장·무관한 코드 수정·불필요한 포맷팅/주석/임포트 변경은 발견되지 않았다. 유일한 이상 신호는 review payload(`meta.json`) 의 14번째 파일 `spec/5-system/2-api-convention.md` 인데, 실제로는 이 target 커밋에 속하지 않는 별도의 선행 커밋(`70f6c3b17`, 앵커 오타 수정)이 diff 산정 과정에서 changeset 에 섞여 든 것으로 확인됐다. 내용 자체가 SSRF 와 무관한 1-line 앵커 수정이라 위험은 없으나, 이 커밋의 실질 diff 로 오인하지 않도록 INFO 로 기록한다.

## 위험도

NONE
