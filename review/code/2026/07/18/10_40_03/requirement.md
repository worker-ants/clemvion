# 요구사항(Requirement) 리뷰 — isConversationOutput mutation 고립 테스트 + 20_06_14 리뷰 산출물 커밋

## 검토 범위

이번 diff 는 두 층위로 구성된다.

1. **애플리케이션 코드/테스트** (파일 1-3): `output-shape.ts` 는 `isConversationOutput` **본문 무변경**, JSDoc 만 확장. `output-shape.test.ts` 는 OR-체인 3분기를 고립시키는 신규 테스트 3건 추가. `hydration-coverage.test.ts` 는 `maxTurns` 병합 경로 설명 주석만 정정.
2. **리뷰 산출물 커밋** (파일 4-12): 직전 `/ai-review` 세션(`review/code/2026/07/17/20_06_14/`)의 SUMMARY/RESOLUTION/각 리뷰어 리포트/메타 파일을 새로 저장소에 추가하고, 그 세션이 지적한 WARNING 1건(`hydration-coverage.test.ts` 라인 번호 drift)을 반영한 커밋.

두 층위 모두 실측으로 직접 검증했다 (아래 §검증).

## 검증 방법 (직접 재현)

- `npx vitest run` 으로 `output-shape.test.ts` + `hydration-coverage.test.ts` 실행 → **42/42 통과** 확인.
- **뮤테이션 실측 재현**: `output-shape.ts` 의 `(hasLegacyMessages && (outputInteraction || metaInteraction))` 분기를 `(hasLegacyMessages && (metaInteraction))` 로 임시 훼손 → 정확히 신규 테스트 1건(`detects conversation via output.interactionType alone`)만 `1 failed / 34 passed` 로 실패, 나머지 34건 영향 없음. 검증 후 `git status`/`git diff --stat` 로 원본 복구 확인(clean). RESOLUTION.md 의 M1 결과("outputInteraction 제거 → 1 failed / 34 passed")와 정확히 일치.
- 3개 신규 fixture 각각에 대해 `isConversationOutput` 의 실제 OR-체인 로직(`hasLegacyMessages && (outputInteraction || metaInteraction) || hasConvConfig || looksLikeConversationEnd || isCanonicalWaiting`)을 직접 라인 단위로 수동 트레이스 — 3건 모두 주석이 서술한 대로 **단 하나의 OR-분기만** 참이 됨을 확인 (다른 분기는 필드 부재로 전부 거짓).
- `MULTI_TURN_INTERACTION_TYPES`(`@/lib/conversation/interaction-type-registry.ts`)에 `"ai_conversation"` 이 실제로 포함됨을 확인.
- `hydration-coverage.test.ts` 의 갱신된 주석("`maxTurns` 는 `buildConvConfigFromStructured`(config ∪ output.result) 로 병합되고, `output.conversationConfig` 직접 read 는 `maxTurns` 를 실어나르지 않는다")을 `result-timeline.tsx:165-183` + `apply-execution-snapshot.ts:349-363` 실제 구현과 대조 — 정확히 일치.
- JSDoc "no known producer" 주장을 위해 `isConversationOutput` 의 유일한 실제 호출부(`result-detail.tsx`, `result-timeline.tsx` — `result.outputData` 에만 적용, EIA 위젯 표면과 무관)를 확인 — JSDoc 의 "핸들러/WS emit 은 `interactionType` 을 `meta` 에 싣고 `conversationConfig` 를 `nodeOutput` 최상위에 둔다"는 주장 범위와 실제 producer 도메인이 일치.
- spec 참조: `spec/conventions/data-hydration-surfaces.md:29,33` 이 `buildConvConfigFromStructured` merge, `output.conversationConfig` fallback 한계(`maxTurns` 미탑재 → 분모 0), `isConversationOutput` 언급을 정확히 서술 — 코드·테스트 주석과 line-level 로 일치.

## 발견사항

- **[WARNING]** `review/code/2026/07/17/20_06_14/SUMMARY.md` 가 스스로와 모순되는 "완료" 주장을 담은 채 커밋됨
  - 위치: `review/code/2026/07/17/20_06_14/SUMMARY.md` 배너(`> **[갱신 — main Claude, 재시도 완료]**...` 부근), `## 에이전트별 위험도 요약` 표의 `testing` 행, `## testing 재시도 결과` 절, `## 권장 조치사항` 1번
  - 상세: 배너와 권장조치사항은 testing 리뷰어 강제 화이트리스트 미이행이 "**해소됨**"/"완료" 라고 명시하며 "최종 판정은 [`## testing 재시도 결과`] 절을 SoT 로 본다" 고 forward-reference 하지만, 실제로 그 절의 본문은 `(재시도 진행 중 — 완료 시 main Claude 가 이 절을 갱신한다.)` 라는 **미갱신 placeholder** 그대로다(실측: `grep -n "testing 재시도 결과" -A4 review/code/2026/07/17/20_06_14/SUMMARY.md` 로 현재도 확인됨). 같은 세션의 `RESOLUTION.md` §보류·후속 항목 1은 오히려 정직하게 "testing 리뷰어 판정 미확보 — 6회 재시도 모두 harness 장애(safety classifier 일시 불가)로 차단, 대체 완화(requirement 리뷰어의 수동 mutation 재현)만 확보, 후속 재실행 필요" 라고 인정한다. 즉 `SUMMARY.md` 의 "해소됨/완료" 주장은 같은 커밋의 `RESOLUTION.md` 자체 서술과 모순되고, 그 주장이 가리키는 근거 절은 실제로 비어 있다. `testing.md` 산출물 파일도 그 세션 디렉터리에 존재하지 않는다(`_prompts/testing.md` 만 존재). 이 커밋을 그대로 audit trail 로 신뢰하면 "testing 리뷰어 검증 완료"로 오독될 위험이 있다.
  - 제안: `SUMMARY.md` 의 배너·표·권장조치사항 문구를 RESOLUTION.md 와 일치하도록 낮추거나(예: "미해소 — 대체 완화로 잔여 리스크 LOW"), `## testing 재시도 결과` 절에 실제 결과(=미확보 + 완화 내역 요약)를 채워 forward-reference 를 완결시킬 것.

- **[WARNING]** 동일 세션(20_06_14)의 리뷰 산출물 중 최소 3건이 "위치" 라인 번호를 **실제 소스 파일이 아니라 결합 prompt 문서(diff+전체 파일 컨텍스트를 이어붙인 자동 조립 문서, 지금 이 세션의 `_prompts/requirement.md` 와 동일 포맷)의 라인 번호**로 오기재 — 이번에 반영된 WARNING(1건)은 같은 결함의 극히 일부만 고쳤다
  - 위치·실측 대조:
    - `review/code/2026/07/17/20_06_14/maintainability.md` — "`output-shape.ts` line 986-994"("No known producer" 단락) → 실제 `output-shape.ts:140-148`. 986-994 는 그 세션의 `_prompts/maintainability.md:984-994` 와 정확히 일치(실측 `sed -n`으로 확인) — 즉 결합 prompt 문서 오프셋을 그대로 옮겨 적었다.
    - 같은 파일 — "`output-shape.test.ts` 신규 3개 테스트 (line 40-96, **파일 내 실제 위치는 735-791**)" → 두 숫자 모두 실제 파일 위치가 아니다. 실제 위치는 `output-shape.test.ts:633-689`(실측 `grep -n` 확인). "40-96"은 `_prompts/maintainability.md` 의 diff-hunk 뷰 위치, "735-791"("실제 위치"라 자칭한 값)은 같은 prompt 파일의 전체-파일-컨텍스트 뷰 위치(`_prompts/maintainability.md:733-792`, 실측 일치) — 즉 "정정"을 시도했지만 그 정정 자체도 prompt 문서 오프셋이라 여전히 틀렸다.
    - `review/code/2026/07/17/20_06_14/side_effect.md` — "`output-shape.ts` (…JSDoc, **L813-L838** 부근)" → 실제 JSDoc 위치는 `112-149`. 813-838 은 그 세션 `_prompts/side_effect.md:811-840` 의 diff 뷰 위치와 정확히 일치(실측 확인).
  - 상세: `RESOLUTION.md` 는 이 유형의 결함(하드코딩 라인 번호 참조 drift)을 `hydration-coverage.test.ts:1362` 단 한 건으로 좁혀 "지적의 실질은 타당" 하다며 반영했지만, 같은 세션에서 커밋되는 다른 리뷰 문서들에 최소 3건 더 존재하는 동일 계열 결함은 검증도, 반영도 되지 않았다. `review/` 는 프로젝트 관례상 삭제되지 않는 영구 감사 기록(CLAUDE.md 정보 저장 위치 표)이므로, 틀린 "위치" 필드가 그대로 영구 보존된다 — 이는 이 PR 자체가 근절하려는 "출처 참조가 실체보다 stale/부정확" 패턴(#959 근본 원인과 동일 계열)의 미해결 잔재다.
  - 제안: 후속 커밋에서 위 3건의 위치 필드를 함수/블록명 기반으로 정정하거나 최소한 "review 산출물의 line 참조는 결합 prompt 문서 오프셋일 수 있어 신뢰도가 낮다"는 caveat 을 SUMMARY.md/RESOLUTION.md 에 명시할 것. 근본적으로는 `code-review-agents` 서브에이전트 프롬프트 조립 방식(diff+전체 파일 컨텍스트를 하나의 문서로 이어붙임)이 이 오귀속을 구조적으로 유발하므로, 리뷰어 프롬프트/skill 문서에 "위치 기재 전 대상 파일을 Read 로 재확인" 지침을 명시적으로 강화하는 것을 고려. (본 리뷰어 자신도 이번 보고서에서 인용한 모든 라인 번호를 `grep -n`/`sed -n` 으로 실제 파일 대조 후 기재했다.)

## 항목별 점검

1. **기능 완전성** — `isConversationOutput`, `unwrapNodeOutput`, `extractIeSnapshot`, `extractAiMetadata` 등 실행 로직은 100% 보존. 신규 테스트 3건은 선언한 목적(각 OR-분기의 mutation 고립)을 실측(직접 재현)으로 완전히 충족.
2. **엣지 케이스** — 3개 fixture 모두 "다른 분기가 우연히 참이 되지 않도록" 필드를 정밀하게 생략/포함. 수동 트레이스 + 실제 뮤테이션 재현으로 격리 성립을 재확인(허위 주장 아님).
3. **TODO/FIXME/HACK/XXX** — 애플리케이션 코드(`output-shape.ts`, 두 test 파일)에는 없음. 다만 `SUMMARY.md` 의 미갱신 placeholder("완료 시 갱신한다")가 사실상 미완료 TODO 로 남아 있음에도 배너는 완료를 주장한다(위 WARNING 1).
4. **의도-구현 괴리** — 애플리케이션 코드 자체는 괴리 없음(JSDoc 이 서술하는 producer 도메인은 실제 호출부와 일치). 리뷰 산출물 층위에서는 두 건의 괴리(SUMMARY.md 배너 vs 본문, 여러 리뷰어의 "위치" vs 실제 파일)가 확인됨 — 위 WARNING 참고.
5. **에러 시나리오** — 애플리케이션 로직 변경 범위 밖.
6. **데이터 유효성** — 변경 범위 밖.
7. **비즈니스 로직** — "대화 미리보기 탭이 절대 사라지면 안 된다"(#959 계열 회귀 방지)는 방어적 설계가 정확히 유지·문서화됨. 방어 분기를 지우지 않고 근거를 남긴 접근이 합리적이며 spec(`conversation-thread.md` §9.9 Inv-8)과 일치.
8. **반환값** — 함수 로직 무변경으로 모든 경로 boolean 반환 기존과 동일. 다만 `SUMMARY.md` 의 "재시도 완료" 주장이 가리키는 절이 실제로 값을 채우지 못한 채 방치된 점은 이 관점의 "빈 반환값" 에 상응하는 결함(위 WARNING 1).
9. **spec fidelity** — CRITICAL 없음. `data-hydration-surfaces.md:29,33`, `conversation-thread.md` §9.9 Inv-8 참조 모두 실측 일치. spec 자체 결함 의심 없음.

## 요약

애플리케이션 코드/테스트 변경(파일 1-3)은 로직 변경이 전혀 없는 순수 테스트 하드닝 + JSDoc/주석 정확화이며, 신규 테스트 3건의 mutation 고립 주장과 JSDoc의 "no known producer" 근거를 모두 독립적으로 실측(직접 코드 훼손·재실행, 백엔드/spec 대조)해 정확함을 확인했다 — 이 층위는 Critical/Warning 없음. 다만 같은 diff 로 함께 커밋되는 직전 리뷰 세션(20_06_14)의 산출물(파일 4-12)에서 두 가지 실질적 결함을 새로 발견했다: (1) `SUMMARY.md` 가 "testing 리뷰어 재시도 완료/해소됨"이라 주장하면서 그 근거 절은 실제로 빈 placeholder 로 남아 있어 같은 커밋의 `RESOLUTION.md` 자체 서술과 모순되고, (2) 이번에 "반영"된 라인 번호 drift WARNING 은 실은 같은 세션의 다른 리뷰 문서(maintainability.md, side_effect.md)에 최소 3건 더 존재하는 동일 계열 결함(결합 prompt 문서의 라인 번호를 실제 파일 위치로 오기재) 중 단 1건만 고친 것이다. 둘 다 런타임 애플리케이션 리스크는 없지만(`review/` 는 영구 감사 기록이라는 프로젝트 관례상) 리뷰 audit trail 의 정확성·신뢰성 문제로서 WARNING 급이다.

## 위험도

LOW
