# 요구사항(Requirement) 리뷰 — isConversationOutput mutation 고립 테스트 (OR-체인 3 + AND-guard 4) + 이월 리뷰 산출물 커밋

## 검토 범위

이번 diff 는 두 층위다.

1. **애플리케이션 코드/테스트** (파일 1-3): `output-shape.ts` — `isConversationOutput` 함수 **본문 무변경**, JSDoc 만 확장("no known producer" 근거 문단 추가). `output-shape.test.ts` — OR-체인 3분기(기존 #968 이월) + 나머지 AND-guard 4곳(20_06_14/10_40_03 세션 testing 리뷰어가 실측 발견) 을 각각 고립시키는 신규 테스트 총 7건. `hydration-coverage.test.ts` — `maxTurns` 병합 경로 설명 주석 정정만(매트릭스·검증 로직 무변경).
2. **리뷰 산출물 커밋** (파일 4-23): 직전 두 세션(`20_06_14`, `10_40_03`)의 SUMMARY/RESOLUTION/각 리뷰어 리포트/메타 파일.

## 검증 방법 (직접 재현)

- `isConversationOutput` 소스(`output-shape.ts:150-208`)를 라인 단위로 직접 읽고, 신규 7개 테스트 fixture 전부를 함수 로직에 손으로 트레이스:
  - **OR-체인 3건** (`output.interactionType alone` / `output.conversationConfig alone` / `output.messages + meta.interactionType`) — 각각 `hasLegacyMessages && outputInteraction`, `hasConvConfig`, `hasLegacyMessages && metaInteraction` 만 참이 되고 나머지 5개 boolean 변수는 전부 거짓임을 확인. 기대값(`true`)과 일치.
  - **AND-guard 4건** (top-level `conversationConfig` disjunct 단독 / `output.interactionType`+메시지없음 / whitelisted endReason+result.messages없음 / `waiting_for_input`+메시지없음) — 각각 대응 guard 가 없으면 잘못 `true` 가 되는 조건을 정확히 구성했고, 현재 guard 가 있으므로 기대값(4번째만 `true`, 나머지 3건은 `false`)과 일치. 특히 `isCanonicalWaiting` 케이스는 `status: "waiting_for_input"` 만 있고 `output.messages` 가 없는 form/buttons 대기 노드를 정확히 재현.
- `MULTI_TURN_INTERACTION_TYPES`(`@/lib/conversation/interaction-type-registry.ts:69-85`)에 `ai_conversation: true` 확인 — 테스트 fixture 의 전제(`"ai_conversation"` 이 멀티턴으로 판정됨)가 유효.
- `CONVERSATION_END_REASONS`(`@workflow/ai-end-reason/src/index.ts`)에 `"completed"` 포함 확인 — endReason-guard 고립 테스트(테스트 6)가 실제로 whitelist 매치 조건을 만족한 채 `result.messages` 부재만으로 거부됨을 재확인.
- JSDoc "no known producer" 주장을 백엔드 소스에서 재확인: `ai-turn-orchestrator.service.ts:458-478` 의 WS emit `nodeOutput` 객체는 `interactionType`/`conversationConfig` 를 **자기 최상위**에 두고 `output` 서브키가 없음(→ frontend 의 top-level 게이트가 잡음, `output.interactionType`/`output.conversationConfig` 중첩 분기가 아님). `ai-conversation-helpers.ts:66,88` 은 `interactionType` 을 `meta` 에 싣는다. 주장과 실제 producer 형태가 일치.
- `hydration-coverage.test.ts` 갱신 주석(`buildConvConfigFromStructured`(config ∪ output.result) 병합, legacy 는 top-level `conversationConfig` fallback)을 `result-timeline.tsx:165-183`(호출부 실제 라인 180) + `apply-execution-snapshot.ts:339-363`(`buildConvConfigFromStructured` 정의: handler config base, `output.result.*` override)과 대조 — 정확히 일치.
- spec 대조: `spec/conventions/data-hydration-surfaces.md:29,33`(maxTurns 병합 설명, `isConversationOutput` 참조), `spec/conventions/conversation-thread.md` §8.5 Inv-8(632행) / CT-S9(649)/CT-S15~17(655-657) — 모두 line-level 로 코드·테스트 주석과 일치. `status` 를 유일한 게이트로 쓰지 않는다는 Inv-8 원칙이 `isConversationOutput` 의 다중 OR-분기 설계(대부분 status 비의존)와 부합.
- 직전 세션들의 실측(`RESOLUTION.md` M1~M4 표, `10_40_03/testing.md` 의 4-분기 mutation 실측, `10_40_03/requirement.md` 의 독립 재현)과 본 리뷰의 수동 트레이스 결과가 전부 상호 일치.

## 발견사항

- **[INFO]** 테스트 4("bare top-level conversationConfig")의 주석 중 "`output` 키가 없어 unwrap 은 `output=null` → 아래 canonical 블록은 전부 도달 불가"라는 서술은 실제로는 도달하지 않는 코드 경로에 대한 가정형 설명이다 — 이 fixture 는 top-level 게이트(`raw.conversationConfig != null`)에서 이미 `return true`(158-163행)로 조기 반환되므로 `unwrapNodeOutput` 자체가 호출되지 않는다.
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` (`it("detects conversation via bare top-level conversationConfig ...")` 바로 위 주석)
  - 상세: 함수 동작(반환값 `true`)에는 영향 없음 — 조기 반환이든 하위 블록 통과든 결과는 같다. 다만 주석이 실행되지 않는 가상의 다운스트림 경로를 단정적으로 서술해 약간의 오해 소지가 있다.
  - 제안: 선택 사항. "top-level 게이트에서 조기 반환되므로 이하 canonical 블록은 애초에 평가되지 않는다"로 표현을 다듬으면 더 정확함. 차단 사유 아님.

- **[INFO]** (기존 이슈 재확인, 신규 아님) 리뷰 산출물 층위(`review/code/2026/07/17/20_06_14/maintainability.md:6,16`, `side_effect.md:6`)에 여전히 "결합 prompt 문서 오프셋을 실제 소스 라인으로 오기재"한 라인 번호(`line 986-994`, `line 40-96`/`735-791`, `L813-L838`)가 남아 있다. 이는 `10_40_03/requirement.md` 가 이미 WARNING 으로 지적했고, 동일 세션 `10_40_03/RESOLUTION.md` §WARNING 3 판단 근거에서 "애플리케이션 코드 결함 0(Critical=0, 코드 WARNING=0) 상태에서 과거 리뷰 스냅샷을 소급 수정하면 감사 무결성이 흐려지고 doc-루프가 발생한다"는 근거로 **의도적으로 미조치 결정**됨. 본 세션에서 실측으로도 동일 결론 재확인.
  - 위치: `review/code/2026/07/17/20_06_14/maintainability.md:6,16`, `review/code/2026/07/17/20_06_14/side_effect.md:6`
  - 상세: 실행 경로·회귀와 무관한 감사 기록 메타데이터 문제이며, 이미 근거를 남기고 기각된 항목이다. 재차 WARNING 으로 올리면 프로젝트 관례("Critical 0 + 코드 WARNING 0 이면 doc-루프 금지")에 반한다.
  - 제안: 조치 불필요 — 이미 기록된 caveat("review 산출물의 line 참조는 prompt 오프셋일 수 있음")로 충분. 재발 방지는 harness(서브에이전트 프롬프트 조립) 레벨 별건.

## 항목별 점검

1. **기능 완전성** — 해당 없음(비기능 변경). `isConversationOutput` 함수 본문은 1바이트도 바뀌지 않았고, 신규 7개 테스트는 선언한 목적(OR-체인 3분기 + AND-guard 4곳의 mutation 고립)을 라인 단위 수동 트레이스로 완전히 충족함을 확인.
2. **엣지 케이스** — 7개 fixture 모두 "다른 분기가 우연히 참이 되지 않도록" 정밀하게 필드를 생략/포함(빈 배열 vs 배열 부재, top-level vs nested, status 유무). 경계 조건(예: `output.result.endReason` 화이트리스트 매치 + `result.messages` 부재)까지 정확히 겨냥.
3. **TODO/FIXME/HACK/XXX** — 없음.
4. **의도-구현 괴리** — 실질적으로 없음. 유일한 미세 지점은 위 INFO(테스트 4 주석의 가상 경로 서술) — 반환값에는 영향 없음.
5. **에러 시나리오** — 함수 로직 무변경으로 변경 범위 밖. 기존 방어적 fallback 분기(2건, "no known producer")는 그대로 유지되고 그 근거가 JSDoc 에 새로 문서화됨 — 삭제 시 대응 고립 테스트가 red 로 드러나는 안전장치가 이제 마련됨.
6. **데이터 유효성** — 함수 내 모든 신규/기존 분기가 `typeof`/`Array.isArray` 방어적 검사를 유지. 신규 테스트가 검증 로직을 우회하는 경로를 추가하지 않음.
7. **비즈니스 로직** — "대화 미리보기 탭이 절대 사라지면 안 된다"(#959 계열) + "폼/버튼 대기 노드가 대화로 오분류되면 안 된다"(Inv-8 계열)는 두 방어적 규칙이 정확히 반영되고, 후자는 이번에 처음으로 회귀 테스트(`rejects waiting_for_input status alone without output.messages`)로 고정됨 — 실무 영향이 가장 큰 guard 였다는 점에서 유의미한 보강.
8. **반환값** — 로직 무변경, 모든 경로 boolean 반환 기존과 동일 유지.
9. **spec fidelity** — CRITICAL 없음. `data-hydration-surfaces.md:29,33`, `conversation-thread.md` §8.5 Inv-8·CT-S9·CT-S15~17 참조 모두 line-level 로 정확. spec 자체 결함 의심 없음. SPEC-DRIFT 해당 없음(코드·spec 모두 기존 상태 유지, 이번 diff 는 테스트/문서 정확화일 뿐).

## 요약

이번 diff 는 `isConversationOutput` 함수의 런타임 로직을 전혀 건드리지 않고, 기존에 mutation 에 무방비였던 OR-체인 3분기 + AND-guard 4곳(20_06_14/10_40_03 세션에서 testing 리뷰어가 실측으로 발견한 이월 갭) 을 각각 고립시키는 회귀 테스트 7건을 추가하는 순수 테스트 하드닝 + JSDoc 근거 문서화 PR이다. 7개 신규 테스트 전부를 함수 로직에 대해 직접 라인 단위로 수동 트레이스한 결과 fixture 가 주장하는 고립 조건과 기대값이 정확히 일치했으며, JSDoc 의 "no known producer" 주장도 백엔드 WS emit/핸들러 코드와 대조해 사실임을 확인했다. `hydration-coverage.test.ts` 의 `maxTurns` 병합 설명 주석도 `buildConvConfigFromStructured`/`result-timeline.tsx` 실제 구현과 정확히 일치한다. spec(`data-hydration-surfaces.md`, `conversation-thread.md`) 참조도 line-level 로 전부 정확하다. 유일한 발견은 (a) 테스트 하나의 주석이 실제로는 도달하지 않는 가상 경로를 서술하는 사소한 부정확(반환값 무영향, 선택적 개선), (b) 과거 리뷰 세션 산출물의 라인 번호 drift로, 이미 이전 세션에서 근거를 남기고 의도적으로 미조치 결정된 항목의 재확인(재조치 불요)이다. 둘 다 애플리케이션 동작에 영향 없는 INFO 수준이며 Critical/Warning 급 결함은 없다.

## 위험도

NONE
