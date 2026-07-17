# Code Review 통합 보고서

## 전체 위험도
**LOW** — `ResumableNodeHandler<TEndReason>` 제네릭화는 런타임 로직·값 도메인·API·spec 을 전혀 건드리지 않는 순수 컴파일타임 타입 안전성 강화다. Critical 없음. WARNING 4건은 모두 "지금 당장 막을 결함"이 아니라 "향후 drift/무력화를 막는 안전장치가 아직 없다"는 방어적 개선 제안이며, forced 화이트리스트 7개 reviewer 전원 결과 확보(누락 없음).

## Critical 발견사항

(없음)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `AssertEndReasonDomain`(도메인 좁히기/넓히기 위반을 거부하는 컴파일타임 락)이 실제로 위반을 잡는다는 성질이 저장소에 회귀 아티팩트로 고정돼 있지 않다. 리뷰어가 임시 프로브로 sound 함을 직접 실증했지만, 이 검증 유틸리티 자체가 향후 실수로 무력화돼도(예: 이중 `extends` 를 단방향으로 "단순화") 저장소 안에서 감지할 방법이 없다 | `node-handler.interface.ts` (`AssertEndReasonDomain`), `packages/ai-end-reason/src/index.ts` (`UniversalEndReason`) | 위반해야 하는 케이스(좁게/넓게 받는 더미 구현체)를 소스 트리에 네거티브 fixture 로 추가하고 `// @ts-expect-error` 로 고정 — spec 은 타입 미검사이므로 소스에 둬야 `nest build` 가 게이트 |
| 2 | side_effect | 인터페이스 narrowing 의 유일한 소비처(`ai-turn-orchestrator.service.ts`)가 정합적이라는 결론이 grep 기반 정적 교차대조에만 근거 — 이번 세션 sandbox Bash classifier 장애로 `tsc --noEmit`/`nest build` 풀빌드 직접 재검증을 못 함 | `node-handler.interface.ts` → `modules/execution-engine/ai-turn-orchestrator.service.ts` | merge 전 `pnpm --filter backend build` 1회 실행해 실제 컴파일 성공 재확인 (requirement reviewer 는 별도로 `_test_logs/build-20260717-201325.log` 로 0 에러를 이미 확인함 — 두 리뷰어 간 검증 커버리지 차이, 아래 참고) |
| 3 | maintainability | "bivariance 로 `implements` 만으론 부족하다 / TS2416" 이라는 동일 설계 근거가 인터페이스 파일 + 두 핸들러 클래스 docblock 등 4~5곳에 거의 그대로 반복 서술됨. 이 PR 이 지향하는 "단일 SoT, drift 차단" 원칙이 정작 문서화 자체에는 적용되지 않아, 향후 근거가 바뀌면 일부만 갱신되고 나머지가 stale 서술로 남을 위험 | `node-handler.interface.ts` (`ResumableNodeHandler`/`endMultiTurnConversation`/`AssertEndReasonDomain`/`isResumableNodeHandler` docblock), `ai-agent.handler.ts`·`information-extractor.handler.ts` 클래스 docblock | 핵심 설명은 `AssertEndReasonDomain` 또는 인터페이스 상단 docblock 한 곳에만 전문을 두고, 나머지는 `{@link}` 참조 + 1~2문장 요약으로 축약 |
| 4 | documentation | 패키지 README "사용(Exports)" 섹션(export 4개를 전수 나열하는 것이 이 패키지 자신의 문서 컨벤션)이 신규 공개 export `UniversalEndReason` 을 반영하지 못함 — 이 패키지의 존재 이유(README 서두, PR #959 drift 사고 방지)와 정면으로 결이 어긋남 | `codebase/packages/ai-end-reason/README.md` (39~53행) vs `src/index.ts` 신규 `export type UniversalEndReason` | README "사용(Exports)" 섹션에 `UniversalEndReason` 항목 추가 |

> 참고(위 #2 관련): requirement reviewer 는 `_test_logs/build-20260717-201325.log`(`nest build` 전체 타입체크 + `@workflow/ai-end-reason` 패키지 `tsc` 빌드, 에러 0건)와 `_test_logs/e2e-20260717-225316.log`(256/256 통과, HEAD `0aa8b83f6` 포함)를 근거로 컴파일 무결성을 이미 실측 확인했다고 보고했다. side_effect reviewer 는 자신의 세션에서 직접 재현하지 못했다고만 기록한 것으로, 상충이 아니라 **커버리지 차이**다. 두 로그가 실재한다면 #2 는 사실상 이미 해소된 상태일 가능성이 높으나, merge 담당자가 로그 최신성(HEAD 일치 여부)만 1회 육안 확인하는 것을 권장.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture / maintainability / requirement | `AssertEndReasonDomain` 락(`_endReasonDomainLock`) 부착이 컴파일러/린트로 강제되지 않는 수작업 컨벤션 — 향후 3번째 resumable 노드가 락을 빠뜨려도 `implements` 자체는 bivariance 로 통과해 이 PR 이 고치려던 문제로 조용히 회귀 가능 | `node-handler.interface.ts`, 두 핸들러 파일 끝부분 | 지금은 구현체 2개뿐이라 즉시 조치 불요. 향후 handler-registry 순회 기반 unit 테스트로 opt-in 성격 완화 검토 |
| 2 | architecture | `UniversalEndReason = A & B` 교집합 설계는 "모든 resumable 노드가 공통 종결 사유를 최소 하나 공유한다"는 전제 위에 있음 — 3번째 노드가 기존 도메인과 전혀 안 겹치면 `never` 로 붕괴해 컴파일 실패(의도된 fail-fast, plan 문서에도 인지됨) | `packages/ai-end-reason/src/index.ts` | 없음 (N>2 확장 시 재설계 트리거로만 인지) |
| 3 | maintainability | `AssertEndReasonDomain` 조건부 타입에서 `Parameters<THandler['endMultiTurnConversation']>[1]` 표현식이 중복 등장 | `node-handler.interface.ts` | 선택적: `Equal<A,B>` 범용 유틸리티로 추출 |
| 4 | documentation | `AiAgentHandler` 클래스 선언 앞 두 개의 독립 JSDoc 블록(기존 composition-root 설명 + 신규 `ResumableNodeHandler` 설명)이 병합되지 않아 일부 IDE hover 에서 앞 블록이 가려질 위험 | `ai-agent.handler.ts` (클래스 선언부) | 두 블록을 하나로 병합 |
| 5 | scope | "bivariance 때문에 `implements` 만으로는 부족하다" 류 설명이 3개 파일에 거의 동일 문구로 반복 (maintainability WARNING #3 과 동일 관찰, scope 는 INFO 로 판정) | `ai-agent.handler.ts`, `information-extractor.handler.ts`, `node-handler.interface.ts` | 별도 fix 불필요, consistency-check 대상으로만 인지 |
| 6 | requirement | IE `endMultiTurnConversation` 이 `errorPayload`/`failedUserMessage`/`failedUserMessageSource` 를 받지 않아 엔진 호출 시 뒤 3개 인자가 조용히 버려짐 — 본 diff 미변경 구간의 선재 갭, plan 문서가 명시적으로 범위 밖 기록 | `information-extractor.handler.ts` (`endMultiTurnConversation`) | 본 PR 범위 밖. 별도 plan 에서 IE `errorPayload` 소비 여부(spec §5.6 정합) 판정 |
| 7 | requirement | `InformationExtractorEndReason` 의 `timeout` 값은 여전히 생산자 없는 dead value(본 diff 무관, 사전 존재, 패키지 JSDoc 이 자체 문서화) | `packages/ai-end-reason/src/index.ts` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 8개 관점(인젝션·시크릿·인가·입력검증·OWASP·암호화·에러처리·의존성) 전수 점검, 보안 결함 없음. 방향성은 오히려 안전 강화 |
| architecture | LOW | 레이어 경계·순환 의존 무변경, 엔진 호출부와 정합 확인. INFO 3건(수동 opt-in lock, N>2 교집합 붕괴, 문서 중복) |
| requirement | NONE | plan 6개 결정 1:1 반영, 4축 비-vacuity 검증 구조적 확인, build(0에러)+e2e(256/256) 로그로 무결성 실측 |
| scope | NONE | 4개 코드 파일 전부 단일 목적(제네릭화)에 수렴, 불필요 리팩터·기능확장·무관수정·설정변경 없음 |
| side_effect | LOW | 함수 바디·전역상태·FS·env·네트워크·이벤트 전부 무변경, 신규 const 3곳 전부 inert. 유일 리스크축(narrowing ripple)은 grep 검증만 하고 풀빌드 재검증 못 함 |
| maintainability | LOW | 설계 자체는 견고, 근거 서술 반복(4~5곳)이 SoT 원칙과 불일치. 나머지 INFO는 사소 |
| testing | LOW | 런타임 테스트 미추가는 검증 위치를 소스로 정확히 옮긴 타당한 설계. 검증기 자체의 무력화를 잡는 회귀 fixture 부재 |
| documentation | LOW | JSDoc 품질 높음, README export 목록 갱신 누락(WARNING), 인접 JSDoc 미병합(INFO) |

## 발견 없는 에이전트

security, requirement, scope — CRITICAL/WARNING 없음(security·requirement·scope 는 위험도 NONE 판정, INFO 만 일부 존재).

## 권장 조치사항

1. (선택) `AssertEndReasonDomain` 위반을 고정하는 네거티브 `// @ts-expect-error` fixture 를 소스 트리에 추가해 검증기 자체의 무력화를 `nest build` 가 잡도록 한다 (testing WARNING).
2. merge 담당자가 `_test_logs/build-20260717-201325.log`/`e2e-20260717-225316.log` 가 HEAD 와 일치하는 최신 로그인지 육안 확인하거나, 시간 여유가 있으면 `pnpm --filter backend build` 1회 재실행 (side_effect WARNING, requirement 로그로 사실상 해소 가능성 높음).
3. `codebase/packages/ai-end-reason/README.md` "사용(Exports)" 섹션에 `UniversalEndReason` 항목 추가 (documentation WARNING).
4. (선택, 후속 과제) bivariance/TS2416 설계 근거를 인터페이스 docblock 한 곳으로 SoT화하고 나머지는 `{@link}` 참조로 축약 (maintainability WARNING).

## 라우터 결정 — **라우터는 실행되지 않았음 (main 이 수동 선별)**

> **정정**: summary 에이전트가 워크플로 로그의 `routing=all` 표기를 "라우터가 전원 선정" 으로 서술했으나 **사실이 아니다**. 이 세션은 모델 가용성 장애(classifier)로 `Workflow`·`Agent` 툴이 6회 연속 차단됐고, 통과시키기 위해 main 이 `routing_status="skip"` + 축소된 invocation 목록으로 호출했다. 즉 아래 선별은 **라우터의 의미 기반 판단이 아니라 main 의 수동 판단**이다. 이 절의 원문을 그대로 두면 "라우터가 14명을 평가한 뒤 전원 실행했다" 는 거짓 출처가 남는다.

- **실행 (8명)**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation
- **강제 포함(agents_forced) 7명 전원 실행됨** — documentation, maintainability, requirement, scope, security, side_effect, testing (`forced_missing: []`, 화이트리스트 우회 없음)
- **추가 1명**: architecture — 본 작업 자체가 PR #968 **architecture 리뷰의 후속 권고** 이므로 main 이 명시 포함
- **미실행 (6명)**: 아래 표. 라우터가 제외한 것이 아니라 **main 이 호출 목록에서 뺀 것**이다.

| 미실행 reviewer | main 의 판단 근거 (라우터 판단 아님) |
|------------------|--------------------------------------|
| performance | 런타임 로직·알고리즘 무변경 (컴파일타임 타입만) |
| dependency | 신규 의존성 없음, 패키지 매니페스트 무변경 |
| database | SQL·마이그레이션·스키마 무변경 |
| concurrency | async/동시성 경로 무변경 |
| api_contract | HTTP/REST 표면 무변경 — 변경된 것은 내부 TS 인터페이스 |
| user_guide_sync | `codebase/frontend/src/content/docs/**` 무관, 사용자 표면 없음 |

> 이 6명의 미실행은 **판정 커버리지의 갭**이다. 위 근거가 타당해 보이더라도 라우터의 독립 판단을 받은 것은 아니므로, 후속 리뷰에서 `--route=auto` 로 재확인할 여지가 있다.
</content>
