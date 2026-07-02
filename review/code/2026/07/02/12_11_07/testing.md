# 테스트(Testing) 리뷰

대상: M-7 RESUME-STATE 클러스터 후속 커밋 — 직전 리뷰 세션(`review/code/2026/07/02/11_59_12`)에서 testing reviewer 가 제기한 WARNING(W-1: builder↔schema drift 가드가 non-strict `safeParse` 사용으로 무의미)에 대한 fix 적용 + 해당 리뷰 세션 산출물(RESOLUTION.md/SUMMARY.md/reviewer 출력/meta.json 등) 커밋.

## 발견사항

- **[INFO]** 직전 WARNING(W-1)이 정확히 지적한 대로 fix 됨 — 회귀 없음 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5434-5439`, `:5555-5558`
  - 상세: 두 drift-guard 사이트 모두 `resumeCheckpointSchema.safeParse(checkpoint)` → `resumeCheckpointSchema.strict().safeParse(checkpoint)` 로 변경됨. `.strict()` 적용으로 스키마가 실제로 알 수 없는 키(credential 유입 포함)를 거부하게 되어, 테스트 이름/주석("builder↔schema drift 가드")이 표방하는 목적과 실제 검증 강도가 일치하게 됐다. 주석도 "non-strict 는 unknown 키를 조용히 strip 해 항상-참이 되므로 사용하지 않는다"는 근거를 명시해 향후 회귀(누군가 실수로 `.strict()` 를 제거) 방지에도 도움이 된다. 직접 실행 확인: `execution-engine.service.spec.ts` + `resume-state.schema.spec.ts` 335 tests 전부 PASS (신규/기존 테스트 모두 그린).
  - 제안: 없음. 조치 완료.

- **[INFO]** fix 자체는 test-only 변경 — 프로덕션 코드 무변화
  - 위치: 변경 파일 1(`ai-turn-orchestrator.service.ts`)~7(`resume-state.schema.ts`)은 diff 내용상 이전 리뷰(11_59_12)에서 이미 검토된 M-7 본 변경분과 동일(재수록)이며, 실질적으로 이번 세션에서 추가된 변경은 `execution-engine.service.spec.ts` 의 `.strict()` 전환 2곳뿐이다. 프로덕션 코드(`resume-state.schema.ts`, `handler-output.adapter.ts` 등)에는 diff 상 변경이 없어 fix 로 인한 신규 런타임 회귀 위험이 없다.
  - 상세: 정보성 — 액션 불필요.

- **[INFO]** 회귀 테스트 범위는 적절 — 두 사이트(ai_agent turn / IE 후속 turn) 모두 대칭적으로 fix
  - 위치: `execution-engine.service.spec.ts:5434`(ai_agent 최초 turn 경로), `:5555`(handleAiMessageTurn 후속 turn 경로)
  - 상세: 두 checkpoint 생성 경로 모두에 동일한 `.strict()` 가드 + `CREDENTIAL_CONTEXT_FIELDS` 순회 부재 단언이 대칭적으로 적용돼, 어느 한쪽 경로만 강화되고 다른 경로가 무방비로 남는 커버리지 갭이 없다. 격리 측면에서도 기존 테스트 블록 내부에 인라인 삽입돼 있어 다른 테스트에 영향 없음(순수 assertion 추가, side effect 없음).

- **[INFO]** review 세션 산출물 커밋(파일 8~17)은 테스트 관점에서 검토 대상 아님
  - 위치: `review/code/2026/07/02/11_59_12/*`
  - 상세: RESOLUTION.md/SUMMARY.md/meta.json/각 reviewer .md/`_retry_state.json` 은 워크플로 산출물(문서)이며 실행 가능한 코드/테스트가 아니다. CLAUDE.md 정책상 `review/` 산출물은 커밋 대상(gitignore 되지 않음)이므로 이 자체는 정상 흐름.

## 커버리지/엣지 케이스 세부 확인

- fix 전후 테스트 카운트 동일(335) — 신규 테스트 케이스가 추가된 것이 아니라 기존 2개 assertion 의 엄격도만 강화됐다. 이는 의도된 최소 침습 fix로 적절.
- `.strict()` 로 전환됨에 따라, 만약 향후 `buildResumeCheckpoint` 가 `resumeCheckpointSchema` 의 allow-list 밖 키(예: credential 필드)를 실수로 포함하게 되면 이 두 assertion 이 실패해 즉시 검출된다 — 실질적인 drift 감지력이 이제 확보됨. 실행 확인 결과 현재 실 산출물은 이 강화된 검증을 통과한다.
- 이미 존재하는 `for (const cred of CREDENTIAL_CONTEXT_FIELDS) expect(checkpoint).not.toHaveProperty(cred)` 단언과 `.strict()` safeParse 단언은 이제 상호 보완적(스키마 shape 자체에 없는 키 + 산출물에 credential 키 없음 이중 검증)이며 중복이 아니다 — `.strict()` 는 "허용되지 않은 키가 하나라도 있으면 실패"를 스키마 레벨에서 검증하고, `not.toHaveProperty` 는 특정 credential 키 목록에 대한 명시적 화이트박스 검증으로 실패 시 어떤 필드가 문제인지 더 명확한 에러 메시지를 준다.

## Mock / 격리 / 가독성

- Mock 사용 변경 없음(fix 는 순수 assertion 강도 조정).
- 가독성: 새 주석("non-strict 는 unknown 키를 조용히 strip 해 항상-참이 되므로 사용하지 않는다")이 "왜 `.strict()` 를 쓰는가"를 명확히 설명해, 직전 리뷰가 지적했던 "주석과 실효성 사이 괴리" 문제가 코드와 주석 양쪽에서 해소됨.

## 회귀 테스트

- 직접 실행 확인: `npx jest execution-engine.service.spec.ts resume-state.schema.spec.ts` → 2 suites, 335 tests 전부 PASS. 로그에 보이는 ERROR 레벨 출력(`Background execution failed`, `Rehydration unexpected error` 등)은 기존 에러 경로 테스트가 의도적으로 발생시키는 로그이며 실패가 아님(테스트 통과와 무관, pre-existing 패턴).

## 요약

직전 리뷰 세션에서 testing reviewer 가 제기한 유일한 WARNING(non-strict `safeParse` 로 인해 builder↔schema drift 가드가 항상-참이 되는 문제)을 정확히 지적된 위치 2곳 모두에서 `.strict()` 적용으로 fix 했다. fix 는 test-only, 최소 침습적이며, 335개 테스트 전체가 그린 상태로 검증됐다. 두 checkpoint 생성 경로(ai_agent 최초 turn / IE 후속 turn)에 대칭적으로 적용돼 커버리지 갭이 없고, 강화된 주석이 의도를 명확히 문서화한다. 테스트 관점에서 추가로 지적할 심각한 문제는 없다.

## 위험도

NONE
