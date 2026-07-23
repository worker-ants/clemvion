# 문서화(Documentation) 리뷰 — output-shape.ts / output-shape.test.ts / output-shape-comment-followups.md (2차 라운드)

이번 diff는 이전 라운드(`review/code/2026/07/23/14_19_49`)의 INFO 3(`output.endReason` fallback 미고립) 반영으로 테스트 fixture 1건이 추가된 결과물이며, 동시에 그 라운드의 SUMMARY/RESOLUTION 등 리뷰 산출물이 이력으로 커밋됐다. 실제 소스 로직(`output-shape.ts`) 은 이번 diff에서 non-comment 변경이 없다(JSDoc 재작성 + 테스트 주석/픽스처만 변경).

## 발견사항

- **[INFO]** 신규 테스트 2건 사이 "근거 위임" 패턴이 비대칭 — 한쪽만 plan 포인터 없이 수치를 재기술
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/output-shape.test.ts` — "rejects result.messages when the endReason key is absent entirely" (약 61-95행) vs "detects a terminal whose endReason sits at output.endReason, not result.endReason" (약 97-127행)
  - 상세: 이번 라운드가 고치려는 문제(RESOLUTION INFO 2)는 "mutation 실측 서술이 테스트 주석과 plan 문서 양쪽에 중복 기록됨 → JSDoc이 새로 명문화한 '근거는 한 곳에만' 원칙과 자기모순"이었고, 그 수정으로 첫 번째 신규 테스트("rejects result.messages when the endReason key is absent entirely")는 실측 수치를 일절 담지 않고 `plan/in-progress/output-shape-comment-followups.md` §mutation 실측을 SoT로 명시 위임한다("여기 옮겨 적지 않는다"). 그런데 같은 라운드에 추가된 두 번째 신규 테스트(`output.endReason` fallback 고립)의 주석은 "삭제 시 tsc clean + 40/40 green" 이라는 **구체적 측정 수치를 인라인으로 재기술**하며, plan 문서 파일명을 가리키는 명시적 포인터가 없다. `plan/.../output-shape-comment-followups.md` "측정 1b" 표의 H행("clean | 40/40 green (생존) | 1 failed / 40 passed")과 사실상 같은 결론을 다른 위치에 다시 적은 셈이라, 첫 번째 테스트가 방금 세운 "실측 표는 plan 단일 SoT" 규약을 두 번째 테스트가 다시 어기는 비대칭이 생겼다. 두 곳의 수치가 갈릴 경우(예: 향후 테스트 수 변동으로 41→42 등) 어느 쪽이 최신인지 판단할 SoT가 불명확해진다.
  - 제안: 두 번째 테스트 주석도 첫 번째와 동일하게 구체 수치(`tsc clean + 40/40 green`)를 빼고 "실측 근거는 plan 문서 `output-shape-comment-followups.md` §측정 1b 참조"로 축약하는 편이 이번 diff 자체가 세운 SoT 위임 원칙과 일관적이다. 병합 차단 사유는 아님.

- **[INFO]** `§Stage 5 이후 종결` 표기 — 번호 매김 섹션이 아니라 JSDoc 목록 항목 라벨을 가리킴
  - 위치: `output-shape.test.ts` "accepts every unified endReason as a conversation terminal" 테스트 상단 주석("근거는 `isConversationOutput` JSDoc §Stage 5 이후 종결 + spec/conventions/conversation-thread.md §9.9 Inv-8")
  - 상세: `§9.9`는 `conversation-thread.md`의 실제 번호 매김 섹션(검증 완료)이지만, `§Stage 5 이후 종결`은 `isConversationOutput` JSDoc 안의 번호 없는 글머리 항목(`- Stage 5 이후 종결 — ...`)을 가리킨다. `§` 기호를 두 서로 다른 종류의 앵커(번호 섹션 vs 글머리 라벨)에 나란히 써서 형식적 일관성이 약간 떨어진다. 실제 참조 대상은 정확히 존재하며 오독 위험은 낮다.
  - 제안: 굳이 수정 불필요(Critical/Warning 아님). 표기를 통일하려면 JSDoc 쪽 항목에 "Stage 5 이후 종결" 대신 백틱 인용만 쓰거나, `§` 를 번호 섹션에만 한정하는 스타일을 향후 정리 시 고려.

- **[INFO]** JSDoc/주석 - 코드 정합성 재검증 — 통과
  - 위치: `output-shape.ts:195-209`(`endReason`/`looksLikeConversationEnd`/`isCanonicalWaiting` 블록), `spec/conventions/conversation-thread.md:632`(Inv-8), `spec/conventions/swagger.md:346`(§1-4), `spec/5-system/2-api-convention.md:172`(§5.4), `codebase/frontend/src/lib/api/executions.ts:27`(`outputData: Record<string, unknown> | null`)
  - 상세: 이번 diff와 신규 plan 문서가 인용하는 코드 앵커·spec 섹션 번호·API 시그니처를 모두 직접 대조했다. `typeof endReason === "string"` conjunct, `ReadonlySet<string>`, Inv-8, swagger.md §1-4, api-convention.md §5.4(경로는 `spec/5-system/2-api-convention.md`로 이전 라운드 INFO 5 반영대로 정정됨) 전부 실제 위치와 일치한다. 테스트 파일에는 더 이상 소스 줄번호가 하드코딩돼 있지 않다(이전 라운드 INFO 1 반영 확인 — `grep "output-shape.ts:"` 결과 test 파일에서는 0건, plan 문서의 mutation 표에만 남아 있어 의도된 위치).
  - 제안: 없음 (기록용 확인).

- **[INFO]** CHANGELOG 미갱신 — 적절
  - 위치: 저장소 루트 `CHANGELOG.md`
  - 상세: 이번 diff는 JSDoc/테스트 주석/신규 fixture/plan 문서뿐이며 `output-shape.ts`의 실행 로직은 비교 대상 두 라운드에 걸쳐 무변경(RESOLUTION.md에 "non-comment diff 0줄" 실증 기록). 저장소 CHANGELOG 관례(사용자 가시 동작/버그 수정 위주)에 비춰 이번 변경은 대상이 아니다.
  - 제안: 없음.

- **[INFO]** plan 문서 체크리스트 상태 — 타당
  - 위치: `plan/in-progress/output-shape-comment-followups.md` 체크리스트 마지막 항목 `- [ ] /ai-review + Critical/Warning 반영`
  - 상세: 이번 라운드가 그 절차 자체이므로 diff 시점에는 미체크가 정확하다. RESOLUTION.md도 "본 라운드 종료 시점에 체크"로 명시했다.
  - 제안: 이번 라운드 결과(Critical/Warning 있을 시 반영, 없으면 그대로) 반영 후 체크박스 갱신.

## 요약

이번 라운드의 diff는 이전 라운드 INFO 3(fallback 미고립)을 닫기 위한 fixture 1건 추가와, 그 리뷰 산출물(SUMMARY/RESOLUTION 등) 커밋이 전부다. 인용된 코드 앵커·spec 섹션·API 시그니처를 전수 재검증한 결과 모두 정확했고, 이전 라운드에서 지적된 줄번호 하드코딩(INFO 1)과 spec 링크 오류(INFO 5)는 실제로 수정되어 있었다. 다만 이번에 새로 추가된 두 번째 테스트(`output.endReason` fallback 고립)의 주석이 plan 문서 "측정 1b" 표와 동일한 구체 수치("tsc clean + 40/40 green")를 인라인으로 다시 적으면서, 같은 라운드의 첫 번째 신규 테스트가 막 확립한 "실측 수치는 plan 문서 단일 SoT, 테스트 주석은 결론 요약 + 포인터"라는 패턴에서 벗어났다 — 이는 이 diff 자체가 교정하려던 문제(RESOLUTION INFO 2)의 축소판 재발이라 문서화 관점에서 가장 눈에 띄는 항목이다. 그 외에는 README/API 문서/CHANGELOG/설정 문서 갱신 필요성이 없고(런타임·공개 API·환경변수 무변경), JSDoc↔테스트 주석의 SoT 분리 원칙 자체는 대체로 일관되게 지켜지고 있다. 모두 INFO 수준이며 병합을 막을 사유는 없다.

## 위험도
LOW
