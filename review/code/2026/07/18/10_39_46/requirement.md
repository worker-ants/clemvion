# 요구사항(Requirement) 리뷰 — `ResumableNodeHandler` 제네릭화 + WARNING 4건 후속 조치

대상 diff (origin/main...HEAD, 20 files): 핵심 코드 4개
(`ai-agent.handler.ts`, `information-extractor.handler.ts`,
`node-handler.interface.ts`, `packages/ai-end-reason/src/index.ts`) + 신규
`assert-end-reason-domain.type-fixture.ts` + `packages/ai-end-reason/README.md`
+ `plan/in-progress/resumable-handler-generic-typing.md` + 이전
`review/code/2026/07/17/22_58_45/**` 전량 (SUMMARY/RESOLUTION/상태파일/개별
리뷰어 출력, 신규 파일로 커밋됨).

이번 diff 는 2026-07-17 22:58:45 세션(NONE 위험도, `review/code/2026/07/17/22_58_45/requirement.md`)이 이미 상세 검토한 `ResumableNodeHandler<TEndReason>` 제네릭화 원본에 더해, 그 리뷰의 WARNING 4건(testing/side_effect/maintainability/documentation)에 대한 `resolution-applier` 조치 커밋(`b612cae74`·`580a615dd`·`b742f341d`) 및 관련 산출물 커밋(`a8bb062f6`·`ce4cb37fe`)을 포함한다. 이하는 그 조치가 실제로 유효한지에 초점을 맞춰 재검증한 결과다.

## 검증 방법

diff 서술을 신뢰하지 않고 다음을 직접 확인:
- `codebase/backend/tsconfig.build.json` — `include: ["src/**/*"]`, `exclude: [..., "**/*spec.ts"]` 실재 확인 → 신규 fixture(`*.type-fixture.ts`, non-spec)가 `nest build` 컴파일 루트에 포함되고, ts-jest(`isolatedModules: true` in `tsconfig.json`)는 타입 미검사라는 fixture 파일 docblock 의 기술적 주장과 일치.
- `_test_logs/build-20260718-000600.log` — `error TS` grep 0건.
- `_test_logs/unit-20260718-000422.log` — 412 suites 전부 pass, fixture 파일명 미등장(spec 로 pick 안 됨 — 예상대로).
- 현재 파일 상태(`ai-agent.handler.ts`, `information-extractor.handler.ts`, `node-handler.interface.ts`) 를 직접 Read 하여 diff 서술과 실제 코드 일치 확인.
- `ai-turn-orchestrator.service.ts` 의 실제 두 호출부(`handleAiEndConversation` L914 `'user_ended'`, `handleAiTurnError` L996 `'error'`) 를 재확인 — 둘 다 `UniversalEndReason`(`'user_ended'|'max_turns'|'error'`) 의 부분집합.
- `information-extractor.handler.ts` L1185-1191 `endMultiTurnConversation(stateRaw, endReason: EndReason)` — `EndReason = InformationExtractorEndReason`(L63) 과 `implements ResumableNodeHandler<EndReason>` 의 타입 인자가 정확히 일치 (AssertEndReasonDomain 이 `true` 로 축약되는 것과 정합).
- `AiTurnExecutor` 클래스(`ai-turn-executor.ts:595`) — `implements` 없음, plan 의 "범위 밖" 서술과 일치.
- 마지막 코드 커밋(`b742f341d`, 2026-07-18 00:09:30) 대비 e2e 로그(`e2e-20260718-000944.log`, 00:09:44) 는 postdate — stale 아님.

## 발견사항

(신규 CRITICAL/WARNING 없음)

- **[INFO]** lint/unit/build 재검증 로그(`lint-20260718-000325.log` 00:03:25, `unit-20260718-000422.log` 00:04:22, `build-20260718-000600.log` 00:06:00) 는 세 WARNING 수정 커밋(`b612cae74`/`580a615dd`/`b742f341d`, 00:09:14~00:09:30) 보다 git 커밋 타임스탬프상 **앞선다**.
  - 위치: `_test_logs/*-20260718-*.log` vs 커밋 로그
  - 상세: 통상적 워크플로(작업트리에서 세 수정을 모두 반영 → 통합 테스트 1회 실행 → 이후 논리 단위로 분할 커밋)라면 문제 없다 — 테스트가 검증한 파일 내용과 이후 커밋된 내용이 동일하다면 커밋 타임스탬프 선후관계는 무관하다. 다만 이 세션은 세 커밋을 개별적으로 나눠 만들었으므로, 이론적으로 "테스트 실행 이후 커밋 전에 추가 편집이 있었는가"는 로그만으로는 배제할 수 없다. e2e 로그(00:09:44)는 전체 커밋 이후라 최종 상태를 커버하며, RESOLUTION.md 도 build 재검증을 별도 기록(`pnpm --filter backend build` EXIT=0)해 사실상 이중 확인됨.
  - 제안: 없음(blocking 아님) — 실제 파일 상태(위 "검증 방법"에서 직접 Read 확인)와 build 로그의 0-에러가 최종적으로 일치함을 이미 독립 재확인했으므로 결과에 영향 없음. 참고용 기록.

- **[INFO]** 기존 2026-07-17 리뷰가 남긴 INFO 3건(IE `endMultiTurnConversation` 의 `errorPayload`/`failedUserMessage`/`failedUserMessageSource` 미수용 — 선재 갭, `AssertEndReasonDomain` lock 의 수동 opt-in 성격, `InformationExtractorEndReason.timeout` dead value) 은 본 후속 diff 로 전혀 건드리지 않아 그대로 유효. plan 문서의 "잔여 후속 (범위 밖, INFO)" 절과 일치하며 본 PR 범위 밖.

## 점검 관점별 확인

1. **기능 완전성** — RESOLUTION.md 의 조치 4건(#1 fixture 신설·#2 재검증·#3 docblock SoT 통합·#4 README) 이 diff 에 1:1 반영됨. 특히 #1 은 "spec 대신 소스에 회귀 아티팩트를 둔다"는 원 WARNING 의 요구를 정확히 충족 — 실측(tsconfig.build.json include/exclude, jest isolatedModules)으로 fixture 가 실제로 `nest build` 게이트를 받는 파일 위치에 있음을 확인.
2. **엣지 케이스** — fixture 의 NEGATIVE #1(좁히기)·#2(넓히기)·SANITY(정확 일치) 3케이스가 `AssertEndReasonDomain` 의 양방향 `extends` 체크를 좁히기/넓히기/일치 세 축 모두에서 실측 커버. `@ts-expect-error` 제거 시 실제 TS2322 재현을 리뷰어가 이미 역실증(plan 문서·RESOLUTION.md 기록) — 스스로도 build 로그의 0-에러로 재확인.
3. **TODO/FIXME** — 전체 diff(`git diff origin/main...HEAD -- codebase/`) grep 결과 TODO/FIXME/HACK/XXX 없음.
4. **의도와 구현 간 괴리** — 컨솔리데이션(commit `580a615dd`) 이후에도 "`implements` 만으로는 `endReason` 파라미터가 안 잠긴다"는 핵심 주장이 인터페이스 docblock·`AssertEndReasonDomain` docblock·두 핸들러 클래스 docblock 전 지점에서 보존됨을 직접 Read 로 확인 — 축약되었을 뿐 사실 누락 없음.
5. **에러 시나리오** — 해당 없음(런타임 분기 무변경, 원 리뷰와 동일 판정 유지).
6. **데이터 유효성** — 해당 없음(순수 타입 계층).
7. **비즈니스 로직** — `endReason` 값 도메인·의미·port 매핑 무변경. `ai-turn-orchestrator.service.ts` 두 실제 호출부를 재확인해 `UniversalEndReason` 교집합과 정확히 일치함을 재검증(회귀 없음).
8. **반환값** — 해당 없음(타입 시그니처만 조정).
9. **spec fidelity** — `spec/conventions/interaction-type-registry.md §4`("AI 노드 endReason — 패키지가 SoT, 매트릭스·AST 가드 비대상")를 재확인. 이번 diff(fixture 신설·docblock 통합·README 갱신)는 §4 가 위임한 "패키지가 SoT" 경계 내부의 backend 소비 측 컴파일타임 배선/문서 정합화일 뿐, §4 본문이 규정하는 값 도메인·강제 방식·매트릭스 유무 자체를 변경하지 않는다 — spec 불일치·SPEC-DRIFT 없음. `codebase/packages/ai-end-reason/README.md` (39~53행)는 `src/index.ts` 신규 export `UniversalEndReason` 을 반영해 패키지 자신의 "사용(Exports)" 문서 컨벤션과 이제 일치.

## 요약

원 리뷰(2026-07-17 22:58:45, 위험도 NONE)가 검증한 순수 컴파일타임 타입 안전성 리팩터에 더해, 그 리뷰의 WARNING 4건에 대한 후속 조치가 실제로 유효한지를 build 로그·tsconfig·jest 설정·현재 파일 상태·엔진 호출부를 직접 재확인해 검증했다. `AssertEndReasonDomain` 회귀 fixture(narrowing/widening/exact-match 3케이스)는 tsconfig.build.json include 규칙과 jest isolatedModules 설정 실측으로 "spec 은 미검사, 소스는 게이트"라는 claim 이 사실임을 확인했고, docblock 통합은 핵심 사실(bivariance/TS2416/커버 못하는 축)을 누락 없이 보존했으며, README 는 신규 export 를 정확히 반영했다. 런타임 로직·값 도메인·port 매핑·spec 본문 모두 무변경이고 새로운 CRITICAL/WARNING 급 결함은 발견되지 않았다. 유일한 관찰 사항(로그 타임스탬프가 개별 커밋 타임스탬프보다 앞서는 순서)은 통상적 "편집→테스트→분할 커밋" 워크플로로 설명되며, 최종 상태를 직접 Read/grep 으로 재확인해 실질적 영향이 없음을 확인했다.

## 위험도

NONE
