# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** `node-output-allowlist.ts` 의 JSDoc 이 다른 파일에 있는 심볼을 "위" 라며 `{@link}` 로 가리킨다 — 파일 분리(W2 fix) 이후 정리되지 않은 잔재
  - 위치: `codebase/backend/src/shared/utils/node-output-allowlist.ts:16`
  - 상세: `## 왜 deny-list 로는 부족한가` 절이 `* 위 {@link EXTERNAL_STRIPPED_FIELDS} 는 **한 칸짜리 deny-list** 라...` 로 시작한다. 그러나 `EXTERNAL_STRIPPED_FIELDS` 는 이 파일에 **선언도 import 도 되어 있지 않다** — `codebase/backend/src/shared/utils/strip-external-only-fields.ts:91` 에 정의돼 있고, `node-output-allowlist.ts` 는 그 상수를 참조조차 하지 않는다(전수 grep 확인, import 없음). 이 문구는 직전 리뷰 라운드(`19_00_23` architecture WARNING #2)가 지적한 "`shared/utils` 가 도메인 타입을 참조하게 됐다" 문제를 고치기 위해 `strip-external-only-fields.ts` 에서 이 코드를 **분리**하며 새로 만든 파일(`RESOLUTION.md` W2 참조)의 것인데, 분리 전 원래 있던 자리(그때는 `EXTERNAL_STRIPPED_FIELDS` 선언과 실제로 같은 파일 안에 있어 "위" 가 참이었을 것)의 JSDoc 문구를 그대로 옮기면서 "위"(above) 라는 위치 참조와 `{@link}` 타깃을 갱신하지 않은 것으로 보인다. TypeDoc/편집기의 JSDoc `{@link}` 리졸버는 해당 심볼이 스코프(같은 파일 선언 또는 import)에 있어야 링크를 해석하므로, 지금 상태로는 깨진/미해석 링크가 되고 "위" 라는 서술도 사실이 아니다(같은 파일 어디에도 `EXTERNAL_STRIPPED_FIELDS` 가 없다). 직전 라운드의 documentation 리뷰(`19_00_23`)가 잡았던 두 WARNING(`getStatus` JSDoc stale 서술, CHANGELOG 누락)은 이번 라운드에서 정확히 반영됐으나(파일 3 JSDoc 정정 확인, 파일 1 CHANGELOG 신규 항목 확인), 그 사이 수행된 아키텍처 fix(W2 파일 분리)가 새로 남긴 이 stale 참조는 아직 어느 리뷰도 짚지 않았다.
  - 제안: `{@link EXTERNAL_STRIPPED_FIELDS}` 를 `strip-external-only-fields.ts` 를 명시 import 하거나(예: `import type { EXTERNAL_STRIPPED_FIELDS } from './strip-external-only-fields'` 는 값이라 type-only 로는 어렵다면 산문 참조로 대체), 최소한 "위" 를 "자매 파일 `strip-external-only-fields.ts` 의 `EXTERNAL_STRIPPED_FIELDS`" 처럼 파일명을 명시하는 산문으로 바꿔 링크가 아닌 정확한 상호 참조로 정정할 것.

## 참고 (발견사항 아님 — 확인 결과 문제 없음)

- CHANGELOG.md 신규 항목(`Unreleased`)은 같은 표면의 선행 보안 수정(`llmCalls`)과 동일한 형식(발견 배경 · 운영 영향 · 수정 범위)을 따르고, "메시지 일부" 라는 서술도 `NodeHandlerOutput._retryState` 가 실제로 `failedUserMessage` 를 나른다는 사실과 일치한다(`node-handler.interface.ts:335,472` 확인) — 직전 라운드 WARNING #4(CHANGELOG 누락)가 정확히 해소됨.
- `interaction.service.ts` 의 `getStatus` JSDoc(`:313-315`)은 "별개 잔여 항목" 이라는 stale 서술을 "이 함수의 waiting 출구 1곳에 fail-closed 로 적용된다 ... 범위 표는 EIA §R17" 로 정정했다 — 직전 라운드 WARNING(문서화·아키텍처 양쪽에서 중복 지적됨)이 정확히 해소됨.
- `spec/5-system/14-external-interaction-api.md` §R17 은 취소선으로 이전 서술("미구현·잔여")을 명시 갱신하고, REST 1곳 적용 · terminal 2곳 의도적 제외 · SSE 잔여를 표로 열거해 이 저장소가 반복 겪은 "부분 해소를 전체로 flip" 패턴을 피했다.
- `spec/conventions/egress-masking.md` 는 자신의 SoT 경계 표에서 "마스킹 정책·적용 범위·잔여 갭" 을 명시적으로 EIA §R17 소관으로 위임하고 있어(`:28`), 이번 PR 이 그 문서를 건드리지 않은 것은 정합적이다. 새 allowlist 는 값 마스킹이 아니라 키 필터링이라는 구분도 JSDoc 이 스스로 명시한다("값 축은 자매 `deepRedactSecrets` 가 맡는다").
- `plan/complete/nodeoutput-allowlist.md` 는 착수 전 프로브 · 뮤테이션 예측/실측 표 · 게이트 수치까지 투명하게 기록했고, frontmatter `spec_impact` 도 리스트 형식으로 정확하다.

## 요약

전반적으로 문서화 품질은 이 저장소 평균 대비 높다. 직전 리뷰 라운드(`19_00_23`)의 documentation WARNING 2건(`getStatus` stale JSDoc, CHANGELOG 누락)은 이번 diff 에서 모두 정확히 반영됐고, `NODE_OUTPUT_ALLOWED_KEYS`/`allowlistNodeOutputKeys` 의 JSDoc 은 "왜 deny-list 로 부족한가 → 타입 결속 근거 → 최상위만 거르는 이유 → 다른 두 출구/SSE 에는 왜 안 걸었는가" 를 빠짐없이 설명한다. 다만 그 사이 수행된 아키텍처 fix(계층 역전 해소를 위한 파일 분리, `strip-external-only-fields.ts` → `node-output-allowlist.ts`)가 JSDoc 문구를 그대로 옮기면서 "위 {@link EXTERNAL_STRIPPED_FIELDS}" 라는, 더 이상 같은 파일에 없는 심볼을 가리키는 깨진 상호 참조를 새로 남겼다 — 이 세션이 이미 두 차례 겪은 "구조는 갱신됐는데 그 옆 문서 한 줄은 stale 화" 패턴의 3번째 사례다.

## 위험도
LOW
