# 아키텍처 리뷰 — `ResumableNodeHandler` 제네릭화 (WARNING fix 반영본, 재검토)

> 본 diff 는 (1) 원 설계 변경(`ResumableNodeHandler<TEndReason>` 제네릭화 + `AssertEndReasonDomain`,
> 커밋 `0aa8b83f6`) 과 (2) 그에 대한 이전 코드 리뷰(`review/code/2026/07/17/22_58_45`)의
> WARNING 4건 fix 커밋(`b612cae74`/`580a615dd`/`b742f341d`/`a8bb062f6`), (3) 그 리뷰 자체의
> 산출물(SUMMARY/RESOLUTION/개별 리포트) 커밋을 모두 포함한다. 원 설계는 직전 architecture
> 리뷰(`review/code/2026/07/17/22_58_45/architecture.md`)에서 이미 INFO 3건 · 위험도 LOW 로
> 평가됐으며, 그 판단(핵심 설계는 견고, 레이어 경계·순환 의존 무변화)은 재검토 결과 그대로
> 유효하다 — 아래는 그 판단을 재확인한 근거와, **이번 fix 커밋이 새로 도입한 파일**
> (`assert-end-reason-domain.type-fixture.ts`)에 대한 신규 관찰이다.

## 발견사항

- **[WARNING]** 신규 컴파일타임 회귀 fixture 가 production 빌드 산출물(`dist/`)에 실제 런타임 코드로 포함되며, 그 사실이 파일 자체 docblock 의 "zero runtime footprint" 서술과 어긋난다
  - 위치: `codebase/backend/src/nodes/core/assert-end-reason-domain.type-fixture.ts` (전체), docblock 중 "Purely type-level — erased by tsc, zero runtime footprint" 문구
  - 상세: 이 파일은 `tsconfig.build.json` 의 `include: ["src/**/*"]` 에 포섭되어 `nest build` 가 매번 타입 체크하도록 의도적으로 소스 트리에 배치됐다(설계 근거는 타당 — ts-jest `isolatedModules` 는 타입 미검사, `nest build` 는 `*.spec.ts` 를 exclude 하므로 실제로 다른 대안이 마땅치 않다). 다만 `tsconfig.build.json` 은 `noEmit` 이 아니라 `dist/` 로 실제 emit 하는 설정이라, 이 파일의 `@ts-expect-error` 주변 타입 표현만 erase 되는 게 아니라 `NarrowingViolationHandler`/`WideningViolationHandler`/`ExactMatchHandler` 세 더미 클래스와 `const _narrowingViolationIsRejected = true` 등 3개 상수 선언이 **그대로 JS 로 컴파일되어** `codebase/backend/dist/nodes/core/assert-end-reason-domain.type-fixture.js` 에 물리적으로 존재한다(직접 확인: 클래스 3개 + `void` 처리된 상수 3개가 그대로 emit됨). 아무 production 모듈도 이 파일을 import 하지 않으므로 `require()` 경로로 로드되지는 않지만(런타임 실행 영향 없음), **배포 산출물에 test-only 스캐폴딩이 물리적으로 포함**되는 것은 사실이며, 파일 docblock 의 "zero runtime footprint" 는 "타입 인자·조건부 타입 표현은 erase 된다"는 뜻이지 "이 파일이 아무 JS 도 생성하지 않는다"는 뜻이 아니어서 문구가 오해를 유발한다. 또한 이 저장소에는 이런 "type-fixture" 카테고리 파일에 대한 명시적 컨벤션 문서(spec/conventions)가 없어(`grep` 결과 전무), 향후 유사 패턴이 다른 노드 계약에도 필요해질 때 재사용 규칙이 없다.
  - 제안: (1) docblock 문구를 "타입 표현(조건부 타입·타입 인자)만 erase 되며, 클래스·const 선언 자체는 여느 `.ts` 파일처럼 `dist/` 로 컴파일된다 — 다만 어떤 모듈도 import 하지 않으므로 런타임에 로드/실행되지 않는다"로 정정. (2) 이 패턴(소스 트리 내 `*.type-fixture.ts` + `@ts-expect-error` 회귀 고정)을 `spec/conventions/` 또는 CONVENTIONS 문서에 1회 등록해, 향후 유사 컴파일타임 계약(예: 3번째 resumable 노드 추가 시)에서 재사용 규칙으로 삼을 수 있게 한다. Blocking 은 아님 — 런타임 영향 없음.

- **[INFO]** (직전 리뷰에서 이미 식별, 재확인) `AssertEndReasonDomain` 락 부착이 구조적으로 강제되지 않는 수동 opt-in
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` (`AssertEndReasonDomain` 정의), `ai-agent.handler.ts`/`information-extractor.handler.ts` 파일 하단 `_endReasonDomainLock`
  - 상세: `implements ResumableNodeHandler<X>` 만으로는 `endReason` 파라미터가 잠기지 않는다는 진단은 정확하고, 이번 세션에 신설된 `assert-end-reason-domain.type-fixture.ts`(WARNING #1 fix)가 이 단언 자체의 sound 함(좁히기/넓히기 모두 거부, exact-match 는 통과)을 회귀 고정한 것도 확인했다 — 검증기의 무력화는 이제 `nest build` 가 잡는다. 다만 검증기가 sound 하다는 것과, **각 핸들러가 그 검증기를 실제로 호출하고 있는가**는 별개 축이다. 3번째 multi-turn 노드가 추가되며 `_endReasonDomainLock` 5줄 블록 부착을 빠뜨려도 `implements` 표면(메서드 존재·state 파라미터·반환 타입)은 여전히 통과하므로, 그 새 핸들러에 한해 이 PR 이 고치려던 문제가 조용히 재발할 수 있다. plan 문서(`plan/in-progress/resumable-handler-generic-typing.md` "잔여 후속" 절)가 이 갭을 이미 인지·기록했다.
  - 제안: 지금 당장 구조적 강제가 필요한 정도는 아니다(구현체 2개, 문서화 충분, plan 에 후속 인지 기록됨). 향후 handler-registry 순회 기반 unit 테스트(각 resumable 핸들러 클래스가 `AssertEndReasonDomain` 락 상수를 갖는지 명시적 리스트 대조)로 opt-in 성격을 완화하는 안을 이미 plan 이 제안했으므로 별도 조치 불요.

- **[INFO]** (직전 리뷰에서 이미 식별, 재확인) `UniversalEndReason` 교집합 설계는 "모든 resumable 노드가 최소 하나의 공통 종결 사유를 공유한다"는 전제 위에 있음
  - 위치: `codebase/packages/ai-end-reason/src/index.ts` — `UniversalEndReason = AiAgentEndReason & InformationExtractorEndReason` + `_universalNonEmpty` 단언
  - 상세: 독립 프로브로 재확인 — `('user_ended'|'max_turns'|'condition'|'error') & ('completed'|'max_turns'|'user_ended'|'timeout'|'max_retries'|'error')` 는 TS 에서 리터럴 유니온 분배 법칙에 따라 정확히 `'user_ended'|'max_turns'|'error'` 로 축약되고 `'condition'` 은 거부됨을 `tsc --noEmit` 로 직접 검증했다(설계 주석의 주장과 일치). 3번째 resumable 노드가 기존 두 도메인과 전혀 겹치지 않으면 `UniversalEndReason` 이 `never` 로 붕괴해 엔진 범용 호출부(`handleAiEndConversation`/`handleAiTurnError`)가 컴파일 실패한다 — 의도된 fail-fast 이며 plan 문서 "범위 밖" 절에도 명시돼 있어 은닉 결함이 아니다.
  - 제안: 없음 (관측 사항, N>2 확장 시 재설계 트리거로만 인지하면 충분).

- **[INFO]** WARNING #3(maintainability, 문서 중복) fix 검증 — SoT 통합이 실제로 이뤄짐
  - 위치: `node-handler.interface.ts` (`AssertEndReasonDomain` docblock 상단에 "본 프로젝트 bivariance/TS2416 락 설계의 SoT" 명시), `ResumableNodeHandler`/`endMultiTurnConversation`/`isResumableNodeHandler` docblock 은 `{@link AssertEndReasonDomain}` 참조로 축약, 두 핸들러 클래스 docblock 도 1~2문장 요약 + `{@link}` 로 축약됨. `ai-agent.handler.ts` 의 인접 JSDoc 2블록도 병합됨(직전 리뷰 documentation INFO #2 동시 해소).
  - 상세: 직접 소스를 읽어 확인한 결과 bivariance/TS2416 근거의 전문은 `AssertEndReasonDomain` 한 곳에만 남아 있고 나머지 4개 지점은 요약 + 링크로 정리돼 있다. "설계 rationale 도 canonical 위치를 지정하라"는 이전 WARNING 제안이 정확히 반영됨.
  - 제안: 없음. fix 완료 확인.

## 요약

`NodeHandler` → `ResumableNodeHandler<TEndReason>` 제네릭화 자체는 범위가 좁고(인터페이스 1개 + 구현체 2개 + 공유 패키지 1개) 목적이 분명한 타입 안전성 개선이며, 레이어 경계(`nodes/core` 계약 ↔ `nodes/ai/*` 구현 ↔ `@workflow/ai-end-reason` 값 도메인 SoT)·순환 의존성·엔진 호출부 정합성 모두 직전 리뷰의 LOW 판정을 재확인했다(교집합 축약·bivariance 우회 필요성을 독립 `tsc` 프로브로도 재검증). 이번 라운드에 추가된 변경은 전부 이전 리뷰의 WARNING 4건에 대한 fix(회귀 fixture 신설·문서 SoT 통합·README 갱신)이며, 문서 SoT 통합은 검증 결과 실제로 잘 이뤄졌다. 유일한 신규 아키텍처 관찰은 이번에 신설된 `assert-end-reason-domain.type-fixture.ts` 가 "erased by tsc" 라는 자체 주장과 달리 실제로는 클래스·상수 선언이 `dist/` 산출물에 컴파일되어 남는다는 점(런타임 실행에는 영향 없음, 배포 아티팩트에 test-only 코드가 물리적으로 섞이는 경계 흐림 + 문서 부정확)으로, 실질 영향은 미미하나 문서 정정과 컨벤션 등록을 권고한다. 나머지는 모두 이미 인지되고 plan/RESOLUTION 에 기록된 INFO 수준 관찰이다.

## 위험도

LOW
