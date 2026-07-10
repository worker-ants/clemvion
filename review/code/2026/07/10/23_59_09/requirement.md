# Requirement Review — `efc9e791e` (fix-verification pass)

대상: `refactor(external-interaction): ai-review Warning 5건 반영` — 선행 리뷰(`review/code/2026/07/10/23_20_33/`)의 Warning 5건(W1~W5) fix 만을 검증한다. 기능 전체 재리뷰 아님.

검증 방법: 코드 리딩 + (a) `npx tsc --noEmit` / `nest build` 클린 확인, (b) `jest src/modules/external-interaction` 전량(220건) 통과 확인, (c) `eslint` 대상 5파일 클린, (d) 임시 `tmp-phantom-check.spec.ts`(리뷰 종료 후 삭제·미커밋)로 실제 OpenAPI 문서를 빌드해 `components.schemas` 키를 직접 덤프해 `WaitingContextBaseDto` phantom 스키마 부재를 실측, (e) spec 상대링크 4곳을 `os.path.exists` 상당으로 셸에서 직접 존재 검증, (f) `jest --config test/jest-e2e.json -t "I-2"` 로 신규 e2e 가 컴파일·수집(collect)되는지 확인(DB 미기동 환경이라 실행 자체는 `ENOTFOUND postgres` — 스코프 밖, TS 컴파일/구조는 검증됨).

## 발견사항

- **[INFO]** `RESOLUTION.md`(`review/code/2026/07/10/23_20_33/RESOLUTION.md`) 의 "조치" 표 `commit` 열이 `efc9e791e` 자신을 `d47e0d4d5` 라는 존재하지 않는 해시로 self-reference 하고 있었다(RESOLUTION 작성 시점엔 아직 커밋 전이라 해시를 알 수 없는 chicken-egg).
  - 위치: `review/code/2026/07/10/23_20_33/RESOLUTION.md` 표 6행
  - 상세: `efc9e791e` 자체 diff 에는 이 오기가 남아 있으나, 바로 다음 커밋 `b1d69ed8c`(`docs(review): RESOLUTION 조치 commit hash 정정`)가 6곳 전부 `efc9e791e` 로 정정했다. `efc9e791e` 단독으로는 사소한 문서 자기참조 오류지만 즉시 self-heal 됐다.
  - 제안: 조치 불필요(이미 해소). 리뷰 스코프 상 참고 기록만.

- **[INFO]** 신규 e2e `I-2` 는 `node.type` 컬럼에 `'carousel'`(소문자)을 넣는다. 같은 파일의 `interaction.service.spec.ts` 유닛 mock 은 `node: { type: 'Carousel' }`(대문자)를 쓰지만, 이는 `getStatus` 가 `currentNode.type` 을 그대로 pass-through 만 하고 어떤 registry lookup·검증도 하지 않기 때문에 어느 케이싱이든 동작에 영향이 없다. 파일 내 기존 e2e(`'form'`, `'ai_agent'`)도 소문자 관례라 `I-2` 가 그 관례를 따른 것도 확인.
  - 위치: `codebase/backend/test/external-interaction.e2e-spec.ts:420-421`
  - 상세: 실질 결함 아님, 케이싱 불일치가 테스트 유효성에 영향 없음을 코드 경로로 확인.
  - 제안: 조치 불필요.

## 점검 관점별 결론

**(1) `WaitingContextBaseDto` export 후 §1-4 준수 여부** — **PASS**. 실제 OpenAPI 문서를 빌드해 `Object.keys(doc.components.schemas)` 를 직접 덤프한 결과 `['ButtonsContextDto', 'NodeOutputContextDto', 'CurrentNodeDto', 'ExecutionStatusDto']` 4개뿐이었다 — `WaitingContextBaseDto` 는 스키마에 전혀 등재되지 않는다(`@ApiExtraModels` 미등록 + 어디서도 `type: () => WaitingContextBaseDto` 로 참조되지 않음). `discriminator` 데코레이터 옵션도 전 파일에 0건(JSDoc 설명 문구 1곳뿐). `context` 필드는 여전히 `oneOf: [{$ref: Buttons}, {$ref: NodeOutput}]` 만으로 봉투 스키마화되고 내부 `nodeOutput`/`buttonConfig` 만 `additionalProperties: true` 열린 map 이다. `ConversationThreadDto` 도 스키마 키에 없음(테스트 및 실측 모두 확인). swagger.md §1-4(닫힌 union=oneOf+getSchemaPath+ApiExtraModels, discriminator는 sound할 때만, 열린 map은 실제 열린 키에만)와 line-level 로 일치.

**(2) e2e `I-2` 가 §5.4 계약을 실제 wire 로 단언하는지** — **PASS**. `expect(Object.keys(context)).not.toContain('conversationThread')` 로 **키 자체 부재**(§5.4 "present-when-available" 정의 그대로)를 확인하고, 동시에 `res.body.data.result` / `res.body.data.error` 를 `toBeNull()` 로 단언해 형제 필드의 `null` 관례와의 **공존**을 같은 응답 안에서 검증한다. `conversation_thread` 컬럼을 INSERT 에서 아예 채우지 않아 durable park 이력 없음 상태를 실제로 재현했다. 추가로 (a) `buttonConfig.buttons` 실값 확인, (b) `Object.keys(context)).not.toContain('nodeOutput')` 로 variant 상호배타(같은 응답에 두 variant 키가 동시에 실리지 않음)까지 실 HTTP+DB round-trip 으로 검증 — RESOLUTION.md 가 약속한 범위(variant 선택·nodeOutput 키 부재·conversationThread 키 생략·형제 null 공존)를 전부 커버한다. `EIA §5.3` 예시(`context.buttonConfig{buttons,nodeOutput}`, 최상위 `conversationThread`)와도 필드 배치가 일치.

**(3) `responses.dto.spec.ts` 가 §1-4 전체를 계속 가드하는지** — **PASS**. 15건(테스트 파일 직접 실행 결과 15 passed) 이 다음을 모두 커버: variant 등재(dangling `$ref` 방지) · `context` oneOf exact-match · discriminator 부재 · nullable · `additionalProperties`/`type` 모두 `undefined`(W3 강화분, 열린 map 이 아님을 정밀 확인) · `currentNode` 의 `allOf` exact-match(W4 강화분, `??` 죽은 분기 제거) · variant 별 `conversationThread` optional-not-nullable(키 생략 계약) · `result`/`error` nullable(형제 `null` 관례) · `nodeOutput`/`buttonConfig` 내부 열린 map · `ConversationThreadDto` 미생성 · variant 별 `required` 필드. W3/W4 fix 이후에도 커버리지가 줄지 않았고 오히려 정밀해졌다(약한 assertion → exact-match).

**(4) 선행 SUMMARY 가 요구한 것 중 본 커밋에 없는 것** — **없음**. W1~W5(a)(b) 전부 diff 에 반영 확인:
- W1: 링크 4곳 전부 `../`×6 로 정정 — 셸에서 직접 `os.path.exists` 상당 검증, 4/4 EXISTS.
- W2: `WaitingContextBaseDto` export + `WaitingContextBase` alias 완전 삭제(`grep -rn "WaitingContextBase\b"` 코드베이스 전체 0건, 서비스 파일도 새 이름으로 정합 import).
- W3: `toBeUndefined()` 로 강화 확인.
- W4: `allOf` 직접 단언(죽은 분기 제거) 확인.
- W5(a): buttons variant + thread 부재 조합으로 교체, `'buttonConfig' in ctx` 신규 단언 추가 확인.
- W5(b): `I-2` e2e 신규 추가 확인(§2 참조).
INFO 미조치 2건(api_contract `additionalProperties:false` 부재, maintainability `getStatus` 길이)은 RESOLUTION.md 에 근거와 함께 명시적으로 defer 처리되어 있고 실제로 본 커밋에서 미적용 — 이는 SUMMARY 의 "미조치 근거 기록" 요구와 일치하는 정상 상태(임의 누락 아님).

## 회귀 검증 (side-effect)

- `npx tsc --noEmit -p tsconfig.json` — 이 커밋이 건드린 파일 범위에서는 신규 에러 없음(사전 존재하던 무관 파일 에러들은 `efc9e791e^^` 부모 커밋에서도 동일하게 존재함을 `git show 60c4c8900:...` 로 대조 확인. `interaction.service.spec.ts` 의 `as Record<string, unknown>` 캐스트발 TS2352 도 부모 커밋에 이미 있던 패턴).
- `nest build` — 클린(스테일 `.tsbuildinfo` 삭제 후 재확인. 최초 1회는 캐시 잔재로 `WaitingContextBaseDto` 가 export 안 된 것처럼 오탐했으나 `dist/.tsbuildinfo` 삭제 후 통과 — 이 저장소 상태 자체의 문제이지 커밋의 결함 아님).
- `jest src/modules/external-interaction` — 16 suites / 220 tests 전부 PASS.
- `eslint` (5개 변경 파일) — 클린.

## 요약

선행 `/ai-review` 세션(23_20_33)이 지적한 Warning 5건(W1 spec 링크 off-by-one, W2 근접 동명 타입 혼동, W3/W4 약한 테스트 assertion, W5 테스트 커버리지 갭)이 본 커밋 `efc9e791e` 에서 **전부, 그리고 정확하게** 반영됐다. 특히 (1) `WaitingContextBaseDto` export 가 `@ApiExtraModels` 미등록 덕에 phantom 스키마를 만들지 않음을 실제 OpenAPI 문서 빌드로 실측 확인했고, (2) 신규 e2e `I-2` 는 mock 이 아닌 실 HTTP+DB round-trip 으로 §5.4 의 핵심 계약(`conversationThread` 키 부재 vs 형제 필드 `null` 공존)을 검증하며, (3) `responses.dto.spec.ts` 는 W3/W4 강화 이후에도 swagger.md §1-4 가 약속하는 모든 항목(닫힌 union·discriminator 부재·열린 map 경계·phantom 방지)을 계속 가드한다. (4) 선행 SUMMARY/RESOLUTION 이 요구한 항목 중 본 커밋에서 누락된 것은 없다 — 유일한 자잘한 흠(RESOLUTION.md 의 self-reference 커밋해시 placeholder)은 바로 다음 커밋에서 이미 정정되어 리뷰 스코프상 실질 영향이 없다. spec 본문(swagger.md §1-4, 2-api-convention.md §5.4, 14-external-interaction-api.md §5.3)과 구현이 line-level 로 일치하며, spec 이 낡아 코드가 앞서간 SPEC-DRIFT 사례도 발견되지 않았다.

## 위험도

NONE
STATUS: SUCCESS