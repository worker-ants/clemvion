# 문서화(Documentation) 리뷰 — request-body-guard

## 발견사항

- **[INFO]** `swagger-probe.ts` 의 신규 export `bodyArgIndexes` 에 전용 단위 테스트가 없다
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.ts:170` (JSDoc) / 함수 `bodyArgIndexes`
  - 상세: `bodyArgIndexes` 는 `bodyParamDesignType` 내부 구현에서 추출되어 새로 export 됐고, JSDoc 은 "키 지정 본문(`@Body('a')` · `@Body('b')`)이면 여럿이다" 라고 다중 인덱스 동작을 명시한다. 그러나 `swagger-probe.spec.ts` 는 이 함수를 직접 이름으로 참조하지 않고(`bodyParamDesignType` 만 테스트), 신규 `request-body-advertised.spec.ts` 의 대조군도 키 지정 본문을 단일 키(`keyedBody`)로만 다뤄 "여럿" 케이스는 어느 테스트도 직접 확인하지 않는다. 문서(JSDoc)가 서술하는 동작 중 일부가 캐너리로 뒷받침되지 않는 상태다.
  - 제안: 문서화 자체의 결함은 아니므로 차단 사유는 아니다 — 다만 `swagger-probe.spec.ts` 또는 가드 대조군에 다중 `@Body('a')`/`@Body('b')` 라우트 케이스를 추가하면 JSDoc 서술과 테스트 커버리지가 정확히 맞아떨어진다.

- **[INFO]** CHANGELOG 신규 항목과 기존 §5-4 관련 항목의 순서/중복 확인 — 문제 없음(참고용 기록)
  - 위치: `CHANGELOG.md` (게이트 26~35, `## Unreleased — 저장소 가드 신설: ...`)
  - 상세: 신규 가드 항목이 기존 "OpenAPI 가 3개 엔드포인트의 요청 본문 스키마를 광고한다" 항목보다 **먼저**(파일 상단에 더 가깝게) 삽입됐다. 두 항목은 같은 작업 계열(#1408 후속)이지만 서로 다른 커밋 계열의 산출물이라 별도 항목으로 분리한 것은 `CHANGELOG.md` 상단 기준(§3 "개발 흐름이 바뀐다" — 가드 신설)에 부합한다. 실제 검증 결과 이상 없음.

## 문서화 강점 (참고)

- `codebase/backend/src/common/pipes/validation.pipe.ts`: 새 export `UNVALIDATED_METATYPES` 에 이 상수를 가드가 "그대로" 소비한다는 계약을 명시하는 JSDoc이 붙어 있어, 향후 상수를 옮겨 적을 위험을 방지한다.
- `codebase/backend/src/repo-guards/__tests__/request-body-advertised-guard.ts`, `.spec.ts`: 모듈/함수 단위로 "왜 AST 가 아닌 reflection 인가", "왜 클래스로 강제하지 않는가", "무엇을 못 보는가" 를 각각 명시한 JSDoc이 있고, 실측 수치(78개 `@Body()`, 74/4 분포)까지 주석에 박아 vacuity floor 근거를 문서화했다. 대조군(fixture controller)마다 위반/정상 사유를 인라인 주석으로 설명해 인라인 주석 기준을 충족한다.
- `spec/conventions/swagger.md`: §5-4 체크리스트 갱신과 짝을 이루는 Rationale 절("왜 클래스로 받게 강제하지 않고, 왜 reflection 으로 세는가")이 신설되어 정식 규약 문서 3섹션 관례(본문 + Rationale)를 따른다.
- `CHANGELOG.md`: 신규 항목이 `CHANGELOG.md` 상단에 성문화된 "무엇이 항목을 만드는가" 기준(§3 가드 신설)에 정확히 부합하고, 형식(`## Unreleased — <무엇이 바뀌었나>`)도 규약대로다.
- `plan/in-progress/request-body-guard.md`: 뮤테이션 테스트 표(8개 뮤턴트, 예측/실측/죽인 케이스)까지 포함해 검증 이력을 추적 가능하게 기록했다.
- 코드 전수 대조 결과, 새 JSDoc/주석이 인용하는 형제 파일·상수·캐너리 스펙(`forbidden-response-codes-guard.ts`, `workflows-execute-body.spec.ts`, `triggers-rotate-bot-token-body.spec.ts`, `executions-continue-body.spec.ts`, `hooks-webhook-body.spec.ts` 등)이 모두 실재하며 서술과 일치함을 확인했다 — 오래된 주석/거짓 인용 없음.
- `swagger-probe.ts` 의 기존 JSDoc 문구("Nest 메이저 업그레이드" → "`^` 범위 안의 마이너·패치 업그레이드로도")를 이번 PR에서 정정했고, 이는 plan 체크리스트에 "곁가지" 항목으로 명시적으로 추적된 의도적 수정이다(오래된 주석이 아니라 실측 기반 정정).
- README 업데이트: `codebase/backend/README.md` 에는 저장소 가드 목록/설명이 없고 형제 가드(`forbidden-response-codes`)도 README에 등재되지 않은 선례라, 이번 가드도 README 갱신 불필요로 판단(패턴 일관).
- API 문서: 이번 변경 자체는 새 엔드포인트/API 계약 변경이 아니라 "API 문서(OpenAPI)가 스키마 없이 나가는 것을 막는 가드" 신설이므로, API 문서 갱신 대상은 spec(`swagger.md`) 자신이며 이미 갱신됐다.
- 설정 문서: 새 환경변수·설정 옵션 없음 — 해당 없음.
- 예제 코드: 가드/규칙의 사용례는 `request-body-advertised.spec.ts` 의 대조군 fixture 컨트롤러(`inlineBare`/`inlineDocumented`/`classBody`/`interfaceBody`/`unknownBody`/`unknownDocumented`/`keyedBody`)가 8가지 케이스별 판정 사유를 인라인 주석과 함께 예시하고 있어 사실상 사용 예제 역할을 겸한다 — 별도 예제 문서 불필요.

## 요약

이번 변경은 코드(JSDoc)·spec(Rationale)·CHANGELOG·plan(뮤테이션 표) 네 층 모두에서 서로 인용이 정확하고 실측 수치를 동반한, 문서화 관점에서 모범적인 PR이다. 전수 대조로 확인한 결과 오래된 주석, 인용 오류, README/API 문서 누락, CHANGELOG 기준 위반은 없었다. 유일하게 짚을 점은 `bodyArgIndexes` 의 JSDoc이 서술하는 "다중 `@Body()` 키" 동작이 전용 테스트로 직접 검증되지는 않는다는 것인데, 이는 문서 자체의 결함이라기보다 테스트 커버리지 성격의 지적이라 INFO로 남긴다.

## 위험도

NONE
