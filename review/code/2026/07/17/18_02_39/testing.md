STATUS=success testing review complete (7 files, 2 new tests independently mutation-verified)
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — `a8c9460564d` fix(ai-end-reason): 리뷰 WARNING#1,2,5,6,9,10 정리

## 검증 방법

정적 diff 리뷰에 더해, 신규 테스트 2건에 대해 커밋 메시지가 주장하는 mutation-testing 결과를 **직접 재현**했다 (worktree 를 mutate → 테스트 실행 → 원복, `git status --porcelain` 로 잔여 diff 0 확인):

1. `output-shape.ts` 의 `looksLikeConversationEnd` 에서 `CONVERSATION_END_REASONS.has(endReason)` 절 제거 → `output-shape.test.ts` 32건 중 **SUMMARY#6 신규 테스트만** 실패 (31 passed / 1 failed), 재현 성공.
2. `interaction-type-registry.ts` 의 `IS_MULTI_TURN_INTERACTION.ai_form_render` 를 `true→false` 로 뒤집기 → `interaction-type-registry.test.ts` 2건 중 **SUMMARY#5 신규 테스트만** 실패, `output-shape.test.ts`(32)·`interaction-type-exhaustiveness.test.ts`(2) 는 영향 없음. 재현 성공.

두 mutation 모두 원복 후 관련 5개 스위트(108 tests) 전원 green 재확인. 커밋 메시지의 "다른 31개 기존 테스트 영향 없음" 주장은 **실측으로 참**임을 확인했다.

## 발견사항

- **[INFO]** Dockerfile 주석의 패키지 개수("N개")는 자동 가드가 없어 재발 가능
  - 위치: `codebase/backend/Dockerfile:28` (4개→5개), `codebase/frontend/Dockerfile.playwright-e2e:36,38` (4개→5개, 6개→7개)
  - 상세: 이번 커밋(SUMMARY#10)이 고친 것은 정확히 "실제 COPY/manifest 는 맞고 사람이 쓴 개수 주석만 stale" 이었던 케이스다. `scripts/check-e2e-playwright-config.py`(config-guard)를 직접 읽어 확인한 결과 이 스크립트는 `@playwright/test` 버전 정합과 `frontend @workflow 클로저 ⊆ Dockerfile COPY ⊆ compose 마스킹`**구조적 집합 일치**만 검증하며, 주석 문자열 속 숫자("5개"/"7개")는 어떤 테스트·가드도 읽지 않는다. backend Dockerfile 은 동급 config-guard 자체가 없다(`.claude/tests/` 에 backend Dockerfile 대상 스크립트 없음 확인). 즉 이번에 고친 stale 주석이 **다음 패키지 추가 때 다시 조용히 stale 해질 수 있다** — 회귀를 잡을 자동 장치가 여전히 없다.
  - 제안: 우선순위는 낮음(주석 텍스트라 일반적으로 테스트 대상이 아님). 다만 이 계열 drift 가 이번이 처음이 아니므로(plan 문서에 유사 사례가 반복 기록됨), 개수 리터럴을 아예 없애거나("@workflow 패키지" 로 완화), 혹은 `check-e2e-playwright-config.py` 에 COPY 라인 수 ↔ 주석 숫자 정합 검사를 추가하는 저비용 개선을 백로그로 남길 만하다. 이번 diff 를 막을 사유는 아니다.

- **[INFO]** `looksLikeConversationEnd` 의 `hasResultMessages` 단독 분기는 여전히 전용 negative 테스트가 없음
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:1271-1274` (`looksLikeConversationEnd` 정의), 대응 테스트는 `__tests__/output-shape.test.ts`
  - 상세: SUMMARY#6 신규 테스트는 `hasResultMessages=true` 고정 상태에서 `CONVERSATION_END_REASONS.has(endReason)` 절(3항 중 3번째)의 negative 경로를 정확히 메운다(독립 mutation 재현으로 확인). 그러나 3항 중 1번째 절인 `hasResultMessages` 자체가 `false` 이면서 `endReason` 은 화이트리스트에 속하는 값인 조합(예: `output.result.endReason: "completed"` 만 있고 `result.messages` 는 없음)을 고립시켜 검증하는 테스트는 없다 — 기존 "rejects non-conversation shapes that happen to carry a result key" 테스트(`output.result.extracted` 만 있는 케이스)가 근접하지만 `endReason` 필드 자체가 없는 조합이라 정확히 겹치지 않는다. 코드 정독상 현재 로직은 안전(`&&` 단락평가로 false 반환)하나, 이 함수가 "건드릴 때마다 회귀가 난" 이력(PR #959 두 차례)이 있는 게이트 함수라는 점에서 세 절 전부를 독립적으로 고립시키는 완전한 분기 커버리지가 향후 리팩토링 안전망으로서 가치가 있다.
  - 제안: 이번 diff 의 범위(화이트리스트 거부 경로 보강)를 넘어서므로 블로킹 사유는 아니다. 향후 이 함수를 다시 만질 일이 있으면 `hasResultMessages=false` 고립 케이스를 추가해 3항 전부의 독립 negative 커버리지를 완성하는 걸 권장.

- **[INFO]** 신규 `interaction-type-registry.test.ts` 의 두 번째 테스트는 첫 번째 테스트에 논리적으로 포함됨
  - 위치: `codebase/frontend/src/lib/conversation/__tests__/interaction-type-registry.test.ts:19-22` (`"excludes the single-turn interactionTypes (form, buttons)"`)
  - 상세: 첫 번째 테스트가 이미 `Array.from(MULTI_TURN_INTERACTION_TYPES).sort()` 를 `["ai_conversation","ai_form_render"]` 와 **정확히** 비교(`toEqual`)하므로, `form`/`buttons` 가 섞여 들어오면 그 시점에 이미 실패한다 — 두 번째 테스트는 논리적으로 중복이다. 결함은 아니며, 실패 시 진단 메시지가 더 명확해지고("정확히 어떤 값이 잘못 포함/누락됐는지" vs "정확히 어떤 값이 있어선 안 되는지"가 분리돼 드러남) 의도를 문서화하는 효과가 있어 유지해도 무방하다.
  - 제안: 조치 불필요. 테스트 수를 줄이고 싶다면 병합 가능하다는 정도의 참고사항.

## 관점별 평가

1. **테스트 존재 여부**: 이번 diff 가 건드린 실행 코드는 `output-shape.ts` 뿐이고 그마저 JSDoc 재배치·고아 주석 삭제뿐(로직 변경 0, diff 직접 대조로 확인). 로직 변경이 없는 파일에 신규 테스트가 필요 없다는 판단은 타당하고, 대신 **기존에 커버되지 않던 두 사각지대**(SUMMARY#5: 값 정확성, SUMMARY#6: 화이트리스트 거부 경로)에 정확히 테스트를 신설했다 — 적절하다.
2. **커버리지 갭**: 이번 커밋이 스스로 지목한 두 갭(값-정확성, 화이트리스트 negative)은 확실히 메워졌다(위 mutation 재현). 잔여 갭은 위 INFO#2 하나뿐이며 사전 범위 밖이다.
3. **엣지 케이스 테스트**: 화이트리스트 밖 임의 문자열("bogus_value")을 쓰는 negative 케이스, `MULTI_TURN_INTERACTION_TYPES` 의 exact-set 비교(과다/과소 포함 모두 검출) 모두 적절한 경계 설계.
4. **Mock 적절성**: 두 신규 테스트 모두 순수 함수·상수를 대상으로 하며 mock/stub 을 전혀 쓰지 않는다 — 대상이 I/O·타이머 등 외부 의존이 없는 순수 로직이라 이 판단은 정확하다.
5. **테스트 격리**: 각 `it` 블록이 독립된 리터럴 객체를 생성하고 공유 상태·`beforeEach`/`afterEach` 가 없어 실행 순서 무관하게 독립 실행 가능. 문제 없음.
6. **테스트 가독성**: 두 파일 모두 "왜 이 테스트가 필요한가"(어떤 사각지대를 메우는가, 과거 어떤 회귀와 같은 계열인가)를 주석으로 명시 — 리포지토리의 기존 컨벤션(다른 `it()` 블록들의 주석 스타일)과 일관되고 의도가 명확하다.
7. **회귀 테스트**: `output-shape.ts` 변경이 주석 이동뿐임을 diff 라인 단위로 직접 대조해 확인했고, 로컬 실행으로 관련 5개 스위트(108 tests) 전원 green 을 재확인했다. 기존 31개 테스트(현재 32개 중 신규 1건 제외)는 이번 변경으로 깨지지 않는다.
8. **테스트 용이성**: `isConversationOutput`/`MULTI_TURN_INTERACTION_TYPES` 모두 순수 함수·상수 export 라 DI 없이도 바로 단위 테스트 가능한 구조 — 테스트 용이성 자체는 良好.

## 요약

이번 커밋은 이전 리뷰 라운드의 WARNING 을 정리하는 후속 커밋으로, 테스트 관점에서 핵심은 신규 테스트 2건(`interaction-type-registry.test.ts` 값-정확성 단언, `output-shape.test.ts` 화이트리스트 negative 경로)이다. 두 테스트 모두 격리·가독성·mock 미사용이 적절하고, 특히 커밋 메시지가 주장한 "mutation 주입 red 전환" 검증을 본 리뷰에서 **독립적으로 재현**해 실제로 회귀를 잡는 유효한 테스트임을 확인했다(둘 다 정확히 자신이 겨냥한 mutation 에서만 실패하고 나머지 스위트는 무영향). `output-shape.ts` 자체는 로직 변경이 없는 순수 JSDoc 재배치이므로 추가 테스트가 불필요하다는 판단도 타당하다. 남은 관찰 사항은 전부 INFO 레벨(Dockerfile 개수 주석의 자동 가드 부재, `looksLikeConversationEnd` 의 `hasResultMessages` 단독 분기 고립 테스트 부재, 신규 테스트 파일 내 경미한 논리적 중복)로, 이번 diff 를 막을 사유가 아니며 향후 백로그성 제안에 가깝다.

## 위험도

LOW
