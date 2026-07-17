STATUS=success documentation review complete — 2 findings (0 CRITICAL, 0 WARNING, 2 INFO)
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰 — `fix(run-results): isConversationOutput JSDoc 정정` (3e84d210)

대상 커밋은 직전 라운드(`18_02_39`)의 WARNING W#1·W#2 를 반영하는 문서 전용 정정 커밋이다(런타임 표면 없음). 아래는 그 정정의 정확성을 소스와 대조해 독립적으로 재검증한 결과다.

## 검증한 내용

1. **W#2 (`isConversationOutput` JSDoc "all four shapes" 정정)** — 함수 본문을 직접 대조했다. 실제 인식 경로는 early-return 1개(top-level `interactionType`/`conversationConfig`) + OR-체인 4개(`hasLegacyMessages && (outputInteraction || metaInteraction)` / `hasConvConfig` / `looksLikeConversationEnd` / `isCanonicalWaiting`) = 총 6개 분기이고, 새 JSDoc 은 정확히 6개 bullet 을 나열해 1:1 대응한다. 신설된 6번째 bullet("Post-Stage-5 terminal")의 "Both AI Agent and Information Extractor emit this" 서술도 `@workflow/ai-end-reason` 패키지의 파일 JSDoc("AI 노드(AI Agent · Information Extractor)가 생산하는")과 정확히 일치한다. "Stage-5" 용어도 같은 파일(L388, 기존)·`output-shape.test.ts`(L552)·backend `ai-agent.handler.spec.ts` 전반에서 이미 쓰이던 표현이라 새로 만든 용어가 아니다. 구 표현("all four shapes"/"New wrapped …") 잔존 여부를 `codebase/`·`spec/`·`plan/` 전수 grep 했고 이 JSDoc 자체(정정 대상임을 설명하는 인용문) 외에는 남아 있지 않다.
2. **W#1 (plan 각주 커밋 SHA 오인용 정정)** — `git show f17fc18dd --stat -- codebase/frontend/src/lib/conversation/interaction-type-registry.ts` 는 빈 diff, `git show f0ef4a821` 이 해당 파일을 신설함을 직접 재현했다. 정정 후 문서 내 두 인용처(`plan/complete/is-conversation-output-restructure.md:230, 248`, 커밋 시점엔 `in-progress/`)가 모두 `f0ef4a821` 로 일치해 자기모순이 해소됐다.
3. **W#3 미채택(CHANGELOG 누락) 근거 재검증** — `git log origin/main --oneline -16` 로 직전 병합 커밋을 확인한 결과, `CHANGELOG.md` 를 건드린 것은 3건(`ab19fef67`/`693e52fe1`/`734864d4b`)뿐이고 가장 최근 9건(`e370d1d02`~`12ceee587`, #959 포함)은 전혀 건드리지 않았다 — 커밋 메시지의 "직전 12개 중 2건만" 주장과 정합한다(표본 경계 차이로 건수는 3 vs 2로 약간 다르나 결론인 "소수" 는 동일). 직전 리뷰어가 인용한 "직전 15개 100% 준수"는 `git log -- CHANGELOG.md` 로 CHANGELOG 를 건드린 커밋만 걸러 놓고 그 목록이 "100%"라고 되짚은 순환論法으로 보인다 — 이번 커밋의 반박이 타당하다.

## 발견사항

- **[INFO]** bullet 1("Legacy flat completed")의 서술이 실제 가드 조건과 완전히 1:1 은 아님 (본 diff 이전부터 존재, 범위 밖)
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:121` (`isConversationOutput` JSDoc) vs 같은 함수 L244-251 의 실제 `if` 조건
  - 상세: bullet 은 "top-level `messages` + `interactionType`" 이라 서술하지만, 대응하는 코드(`raw.interactionType` 화이트리스트 매칭 OR `raw.conversationConfig != null`)는 `messages` 존재 여부를 전혀 검사하지 않는다 — `messages` 는 그 shape 가 실제로 담고 있는 필드일 뿐 판정 조건이 아니다. 다만 이번 커밋이 추가한 "분기가 authoritative, 목록은 그것을 bound 하지 않는다"는 디스클레이머가 이 종류의 오독 위험을 이미 완화하고, bullet 자체는 이번 diff 가 아니라 원본 JSDoc 부터 있던 서술이라 이번 정정의 결함은 아니다.
  - 제안: 조치 불요(범위 밖) — 다음에 이 함수를 다시 만질 때 "top-level `interactionType`/`conversationConfig` (관례상 `messages` 동반)" 정도로 다듬으면 더 정밀해진다.

- **[INFO]** 신설 bullet 6 과 `CONVERSATION_END_REASONS` 상수 JSDoc(L201-209) 사이에 #959 배경 설명이 일부 중복
  - 위치: `codebase/frontend/src/components/editor/run-results/output-shape.ts:131-136` vs `:201-209`
  - 상세: 두 JSDoc 모두 "`error`/`condition` 누락 → 미리보기 소실 → `@workflow/ai-end-reason` 가 SoT" 서사를 담아 내용이 겹친다. 다만 각각 다른 열람 지점(상수를 볼 때 / 게이트 함수를 볼 때)에서 맥락을 완결시켜주는 지역성(locality) 이점이 있어 실질적 문제로 보지 않는다.
  - 제안: 조치 불요 — 유지해도 무방.

## 좋은 점 (참고)

- 새 JSDoc 이 "분기가 authoritative, 목록은 이를 bound 하지 않는다"고 명시한 것은 향후 분기 추가 시 같은 종류의 문서 drift(이번 W#2 의 근본 원인)를 재발 방지하는 좋은 장치다.
- 커밋 메시지가 W#3 미채택 사유를 실측 수치와 함께 상세히 남겨, plan 이 `complete/` 로 이동한 뒤에도 "왜 CHANGELOG 를 안 건드렸는가"가 고아 결정으로 남지 않는다.
- 두 파일 모두 순수 텍스트 변경이라 README/API 문서/설정 문서/예제 코드 체크리스트 항목은 해당 사항 없음(새 공개 함수·엔드포인트·env·config 없음).

## 요약

이 커밋은 이전 리뷰 라운드가 지적한 두 문서 결함(부정확한 "4개 shape" 열거, plan 각주의 오인용 커밋 SHA)을 소스 코드·git 이력과 대조해 독립적으로 재검증한 결과 모두 정확하게 고쳤다 — 새 JSDoc 은 실제 6개 인식 분기와 1:1 대응하고, 각주의 커밋 인용은 문서 내 다른 인용처와 이제 일치한다. W#3(CHANGELOG 미추가) 판단도 `origin/main` 최근 병합 이력을 직접 세어 재검증했고 "최근엔 CHANGELOG 를 거의 안 건드린다"는 주장이 사실에 부합해 미채택이 합리적이다. 남은 것은 이 diff 범위 밖의 사소한 서술 정밀도(bullet 1)와 의도적으로 보이는 경미한 서사 중복뿐이며 둘 다 INFO 수준으로, 조치를 요하지 않는다.

## 위험도
NONE
