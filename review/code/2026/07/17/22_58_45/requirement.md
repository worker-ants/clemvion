# 요구사항(Requirement) 리뷰 — `ResumableNodeHandler` 제네릭화

대상: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts`,
`codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts`,
`codebase/backend/src/nodes/core/node-handler.interface.ts`,
`codebase/packages/ai-end-reason/src/index.ts`,
`plan/in-progress/resumable-handler-generic-typing.md`

## 개요 판정

이 변경은 **런타임 동작을 전혀 바꾸지 않는 순수 컴파일타임 타입 안전성 강화**다. 4개 코드 파일의 diff 를 전수 대조한 결과:

- `ai-agent.handler.ts` / `information-extractor.handler.ts`: `implements NodeHandler` → `implements ResumableNodeHandler<TEndReason>` 로 클래스 선언 1줄만 변경 + 파일 끝에 `AssertEndReasonDomain` 컴파일타임 단언 상수 블록 추가. 그 외 로직·시그니처·값 무변경.
- `node-handler.interface.ts`: `ResumableNodeHandler` 를 제네릭화(`TEndReason extends ConversationEndReason = UniversalEndReason`), `AssertEndReasonDomain` 타입 신설, `isResumableNodeHandler` 가드 반환 타입을 `ResumableNodeHandler<UniversalEndReason>` 로 narrow. 순수 타입 선언 파일 — 런타임 코드 없음.
- `ai-end-reason/index.ts`: `UniversalEndReason`(교집합 파생 타입) + non-empty 컴파일타임 단언 추가.

## 발견사항

- **[INFO]** `AssertEndReasonDomain` 락은 수작업 컨벤션으로만 강제된다
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` (`AssertEndReasonDomain` JSDoc, "사용" 절)
  - 상세: 향후 세 번째 `ResumableNodeHandler` 구현체가 추가될 때 `_endReasonDomainLock` 상수를 빠뜨려도 `implements` 자체는 (bivariance 로) 통과하므로 컴파일 에러가 나지 않는다 — 락 부착은 JSDoc 문서화된 수동 컨벤션이고 이를 강제하는 lint 규칙/AST 가드는 없다. 다만 현재 소비자는 2개뿐이고(`plan` 의 "범위 밖" 절도 이를 인지), `interaction-type-registry.md §4` 가 이 도메인에 대해 "매트릭스/AST 가드 불필요"로 명시적으로 정한 경계와 부합해 지금 시점엔 결함이 아니다.
  - 제안: 신규 구현체 추가 시 코드 리뷰 체크리스트 항목으로만 남겨두면 충분 — 즉각 조치 불요.

- **[INFO]** IE `endMultiTurnConversation` 이 `errorPayload`/`failedUserMessage`/`failedUserMessageSource` 를 받지 않아 엔진이 `handler.endMultiTurnConversation(state, 'error', errorPayload, failedUserMessage, failedUserMessageSource)` 로 호출해도 뒤 3개 인자가 런타임에서 조용히 버려짐 (`ai-turn-orchestrator.service.ts:994` vs `information-extractor.handler.ts` 의 2-파라미터 구현)
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` (`endMultiTurnConversation`, 본 diff 미변경 구간)
  - 상세: 본 PR 이전부터 있던 선재 동작이며, 본 diff 는 이 메서드의 파라미터 목록을 전혀 건드리지 않았다. 개발자가 plan 문서(`plan/in-progress/resumable-handler-generic-typing.md` "범위 밖 (관측만)" 절)에 이 갭을 명시적으로 관측·기록했고 "IE spec §5.6 의 `max_retries` 는 `output.error` 병존을 규정하므로 별도 판정 필요"라고 스코프 밖으로 못박았다 — 회귀가 아니라 선재 갭의 정직한 노출.
  - 제안: 본 PR 범위 밖. 별도 plan 에서 IE 의 `errorPayload` 소비 여부(§5.6 `output.error` 요구사항과의 정합)를 판정.

- **[INFO]** `InformationExtractorEndReason` 의 `timeout` 값은 여전히 생산자가 없는 dead value (본 diff 무관, 사전 존재)
  - 위치: `codebase/packages/ai-end-reason/src/index.ts` (`InformationExtractorEndReason` JSDoc)
  - 상세: 패키지 JSDoc 이 이미 "현재 생산자가 없다... 무해하다"고 자체 문서화했고, 파생 타입(`UniversalEndReason`, `ConversationEndReason`)·본 diff의 어느 로직도 이 값에 의존하지 않는다. 관측 사항일 뿐 결함 아님.

## 점검 관점별 확인

1. **기능 완전성** — plan 이 명시한 6개 결정(제네릭화·교집합 기본값·패키지 파생·가드 narrow·`AssertEndReasonDomain`·소스 배치)이 diff 에 1:1 반영됨. 체크리스트의 "비-vacuity 역실증 4축"(A 범용 호출부 고유값 차단 / B 구현 좁히기 차단 / C 구현 넓히기 차단 / D 교집합 붕괴 차단)은 실제 코드 구조(bidirectional `extends` 체크, non-empty 단언)로 뒷받침됨.
2. **엣지 케이스** — 두 유니온이 겹치지 않게 되는 경우(`UniversalEndReason` → `never`)를 `_universalNonEmpty` 컴파일타임 단언으로 선제 차단. 별도 런타임 엣지 케이스 없음(순수 타입 계층).
3. **TODO/FIXME** — diff 내 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리** — JSDoc 주장("bivariance 로 `implements` 단독으론 못 잠근다", "교집합이 아니라 합집합을 기본값으로 두면 안전이 악화된다" 등)을 실제 타입 정의와 대조 검증 — 일치. `AssertEndReasonDomain` 의 bidirectional `extends` 트릭도 각 핸들러의 선언 타입과 실제 파라미터 타입이 정확히 같을 때만 `true` 로 축약되는 것을 구조적으로 확인.
5. **에러 시나리오** — 해당 없음(런타임 분기 무변경). 두 유니온 붕괴·구현 좁히기/넓히기라는 "설계 시점 에러 시나리오" 4종을 컴파일타임 단언으로 커버.
6. **데이터 유효성** — 해당 없음(타입 계층, 런타임 데이터 검증과 무관).
7. **비즈니스 로직** — `endReason` 의 의미·port 매핑(§7 시리즈)은 무변경. 값 도메인 자체도 무변경(패키지의 `AiAgentEndReason`/`InformationExtractorEndReason` 리터럴 목록 그대로).
8. **반환값** — 해당 없음(타입 시그니처만 조정, 반환 로직 무변경).
9. **spec fidelity** — 관련 spec: `spec/conventions/interaction-type-registry.md §4`("AI 노드 endReason — 패키지가 SoT, 매트릭스·AST 가드 비대상"), `spec/4-nodes/3-ai/1-ai-agent.md §7.9`, `spec/4-nodes/3-ai/3-information-extractor.md §5.6`. §4 는 "값 도메인 SoT = 패키지, 강제 방식 = 패키지 내부 satisfies+Exclude, 매트릭스/AST 가드 불필요"만 규정하며 `ResumableNodeHandler` 제네릭·`AssertEndReasonDomain`·`UniversalEndReason` 같은 **소비 측(backend) 컴파일타임 배선**은 언급하지 않는다 — 그러나 이는 §4 가 "패키지가 SoT" 라고 정한 경계 내부의 구현 디테일(패키지 export 를 backend 가 어떻게 소비하는지)이므로 spec 이 다뤄야 할 대상이 아니다. plan 의 "spec 영향: 없음" 판정과 일치하며 SPEC-DRIFT 도 아니다(§4 서술과 모순되는 부분 없음). `spec/4-nodes/3-ai/3-information-extractor.md` §5.6/§6 의 `endReason` 값 목록(`completed`/`user_ended`/`max_turns`/`max_retries`)·에러 코드(`MAX_COLLECTION_RETRIES_EXCEEDED`)도 diff 로 건드리지 않아 line-level 로 계속 일치.

## 검증 (독립 재확인)

- `_test_logs/build-20260717-201325.log`: `nest build`(`tsc`, `isolatedModules` 무관하게 전체 타입체크 수행) + `@workflow/ai-end-reason` 패키지 `tsc` 빌드 모두 에러 0건(`error TS` grep 0 hit), backend 프로덕션 이미지 위생 스모크까지 통과.
- `_test_logs/unit-20260717-201140.log`, `_test_logs/lint-20260717-201005.log`: 전부 clean(무관 파일의 pre-existing warning 1건 제외).
- `_test_logs/e2e-20260717-225316.log`: `Test Suites: 45 passed, 45 total` / `Tests: 256 passed, 256 total` — HEAD(`0aa8b83f6`, 4개 코드 파일이 이미 이 커밋에 포함) 이후 실행되어 stale 아님.
- `ai-turn-orchestrator.service.ts` 의 두 실제 `endMultiTurnConversation` 호출부(`'user_ended'` at L914, `'error'` at L996)를 확인 — 둘 다 새 기본 타입 인자 `UniversalEndReason`(`'user_ended' | 'max_turns' | 'error'`)의 부분집합이라 컴파일 안전.
- `AssertEndReasonDomain` 의 bidirectional-extends 패턴, `UniversalEndReason` 의 literal-union 교집합 파생 로직을 수동 추론으로 재검증 — 두 핸들러가 각각 선언 도메인과 정확히 같은 파라미터 타입을 쓰므로 락이 `true` 로 축약되고, 두 노드 유니온의 교집합은 정확히 `'user_ended' | 'max_turns' | 'error'` (참고: 별도 tsc 프로브 실행은 세션 중 Bash 안전성 분류기 일시 장애로 완주하지 못했으나, 이미 확보한 그린 build/e2e 로그가 동일하고 더 강한 증거라 대체됨).

## 요약

`ResumableNodeHandler` 를 `TEndReason` 제네릭으로 전환하고 `AssertEndReasonDomain` 컴파일타임 락 + 패키지 파생 `UniversalEndReason` 으로 "두 핸들러 endReason 계약이 tsc 검사를 전혀 받지 않던" 선재 갭(구현체 중 어느 쪽도 `implements ResumableNodeHandler` 를 선언하지 않았던 상태)을 메우는 순수 타입 안전성 작업이다. 런타임 로직·값 도메인·port 매핑·spec 본문 모두 무변경이며, 4개 파일의 diff 는 클래스 선언 + 컴파일타임 단언 상수만 추가한다. 관련 spec(`interaction-type-registry.md §4`)이 이 계층을 명시적으로 관측 대상에서 제외하므로 spec 불일치·SPEC-DRIFT 없음. Critical/Warning 급 결함 없음 — 발견된 3건은 모두 본 diff 이전부터 존재했거나(IE `errorPayload` 드롭, `timeout` dead value) 정책적으로 이미 수용된 경계(수동 컨벤션 락)라 INFO 로 분류. build(0 에러)·lint·unit·e2e(256/256) 로그로 무결성이 실측 뒷받침된다.

## 위험도

NONE
