# Rationale 연속성 검토 — spec/data-flow/ (impl-done)

## 검토 범위 확인

`git diff origin/main...HEAD -- code_areas` 는 전량 `codebase/backend/**` 의 ESLint warning 처분(타입 애너테이션·타입 단언·주석 보강·캐너리 테스트 추가·`lint` 스크립트에 `--max-warnings 0` 추가)이며, **`spec/**` 파일은 diff 에 전혀 포함되지 않았다.** 즉 target 은 spec 본문·Rationale 을 직접 수정하지 않고, 기존 spec 이 서술한 동작을 코드 타입 레벨에서만 손댄 변경이다. 아래는 그럼에도 diff 가 언급·전제하는 Rationale(특히 `spec/5-system/14-external-interaction-api.md` §R8, `spec/conventions/frontend-layering.md` 의 lint 강도 서술)과의 정합을 점검한 결과다.

## 발견사항

- **[INFO]** `idempotency.interceptor.ts` 의 §R8 선재 결함 문서화가 spec Rationale 에는 아직 반영되지 않음
  - target 위치: `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts` (`cacheTapped()` docstring, diff @@ -100,7 +118,16 @@ 부근) 및 `idempotency.interceptor.spec.ts` (`409 도 캐시되지 않는다 — R8 위반 상태를 고정하는 캐너리` 테스트)
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` `## Rationale` → `### R8. Idempotency-Key 와 submit_form 검증 실패의 관계` — "4xx 응답 중 `400 VALIDATION_ERROR` 만 idempotency cache 에서 제외하고, 그 외(성공 2xx / `409 Conflict` / `410 Gone`)는 캐시한다"
  - 상세: 실제 구현은 `statusCode >= 400` 전체를 캐시 제외 조건으로 삼아 409·410 까지 함께 떨군다 — R8 이 채택한 범위보다 넓다. 이번 diff 는 이 gap 을 **고치지 않고** docstring·`IdempotencyEntry.responseJson` 주석·신규 캐너리 테스트로 명시적으로 문서화했고, 원인(2026-05-21 원본 구현부터 존재하는 선재 결함), 영향(`EIA-RL-02` 동일 키 24h 동일 응답 재현이 409/410 범위에서 미충족), 백로그(`plan/in-progress/backend-lint-gate-broken-on-main.md`)까지 명시했다. **이것은 결정의 무근거 번복이 아니라 기존 결함의 가시화이며, 동작 변경이 없다는 점(emit 불변 실측)도 커밋 이력(`cec79b004`)에서 확인된다** — 따라서 CRITICAL/WARNING 대상은 아니다.
  - 다만 `spec/data-flow/15-external-interaction.md` §2.1 스키마 매핑 표는 여전히 "2xx 응답 캐시 … 4xx(`VALIDATION_ERROR` 등) 캐시 제외 ([Spec EIA §R8])" 로만 서술해, spec 만 읽는 사람은 R8 이 완전히 지켜지는 것으로 오인할 수 있다. 같은 문서의 `## Rationale`에는 이미 "§1.5 구현 갭 — 해소 이력(C3 fix)" 라는, 의도와 코드가 갈라졌을 때 본문에 callout 을 남기는 선례가 있다 — 이번 R8 gap 은 그 선례를 아직 따르지 않았다(코드 주석·backlog plan 에만 존재).
  - 제안: `spec/data-flow/15-external-interaction.md` `## Rationale` 에 "§1.5 구현 갭" 과 병렬로 짧은 callout(예: "§2.1 Redis 캐시 제외 조건 — 구현 갭(진행 중)")을 추가해 코드 docstring·`plan/in-progress/backend-lint-gate-broken-on-main.md` 를 가리키게 하거나, `spec/5-system/14-external-interaction-api.md` R8 항목 말미에 "현재 구현은 `>=400` 전체를 제외해 409·410 범위에서 `EIA-RL-02` 미충족 — 백로그 참조" 한 줄을 추가한다. 이번 PR 스코프(타입 전용) 밖이므로 즉시 조치가 아니라 후속 spec 갱신 제안이다.

## 그 외 점검 — 이상 없음

- `codebase/backend/package.json`/`README.md` 의 `lint` 스크립트 `--max-warnings 0` 추가는 기각된 대안의 재도입이 아니다. 오히려 `spec/conventions/frontend-layering.md` 가 이미 "`warn` 으로 강등되면 `lint` 스크립트에 `--max-warnings` 제한이 없어 CLI 는 exit 0 으로 통과한다" 고 지적해 온 취약점을 정확히 메우는 방향이라 기존 convention Rationale 과 정합한다.
- `execution-engine.service.ts`(`m.query<{id:string}[]>`), `executions.service.ts`(LRU evict 키 단언), `triggers.service.ts`(`SetupResult` 타입·`Object.getPrototypeOf(...) as object`), `chat-channel.dispatcher.ts`(`logFn` 단언), `ai-agent.schema.ts`/`render-tool-provider.ts`/`migrate-node-output-refs.ts`(원소 타입 명시) 는 모두 **타입 레벨 애너테이션/단언**이며 로직 변경이 없다 — 원자적 claim(§Rationale, execution-engine), 단일 sink(R10), 멤버십 검증 단일화(2026-08-08) 등 관련 invariant 를 우회하거나 재작성하지 않는다.
- `workspace-reflection-canary.ts` 의 `handlerConsumesWorkspaceId(cls, handler)` 인자 단순화도 타입 단언 제거일 뿐 workspaceId 소비 판정 로직 자체는 그대로다.
- `migrate-node-output-refs.spec.ts` 에 추가된 Pass 2 테스트는 기존에 커버되지 않던 갈래를 캐너리로 고정한 것으로, 기존 rewrite 규약(§ Pass 1~5 legacy 경로 처리)을 뒤집지 않는다.

## 요약

target 은 spec/data-flow 본문·Rationale 을 직접 수정하지 않는 순수 lint-warning(타입 안전성) 정리 PR 이며, 검토한 범위에서 과거 Rationale 이 명시적으로 기각한 대안을 재도입하거나 합의된 설계 원칙(단일 sink R10, 원자적 claim, 멤버십 검증 단일화, R8 등)을 우회하는 지점은 발견되지 않았다. 유일한 주목 지점은 idempotency 캐시의 §R8 선재 결함을 이번 diff 가 코드·테스트 레벨에서 투명하게 문서화했지만 그 사실이 아직 spec 쪽 Rationale(§1.5 구현 갭 선례를 따르는 callout)에는 미러링되지 않았다는 점으로, 동작 변경이 없어 CRITICAL/WARNING 이 아닌 INFO 로 분류했다.

## 위험도

LOW
