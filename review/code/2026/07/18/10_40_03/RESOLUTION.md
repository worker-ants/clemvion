# RESOLUTION — review/code/2026/07/18/10_40_03

대상: branch `claude/isconversationoutput-branch-tests-97f9a8` (base `origin/main`),
코드 커밋 `5600ca245` + 리뷰 산출물 커밋 `4ee965978`.

SUMMARY 판정: **RISK=LOW / CRITICAL=0 / WARNING=3 / INFO=9**. 리뷰어 7/7 전원 결과 확보
(지난 20_06_14 세션에서 harness 장애로 누락됐던 `testing` 포함 — classifier 복구 후 정상 실행).

## 조치 항목

| SUMMARY # | 분류 | 내용 | 조치 | commit |
|---|---|---|---|---|
| WARNING 1 | testing | `isConversationOutput` 의 나머지 AND-guard 4곳(첫 게이트 `conversationConfig` disjunct / 첫 OR-항 `hasLegacyMessages` / `looksLikeConversationEnd` 의 `hasResultMessages` / `isCanonicalWaiting` 의 `hasLegacyMessages`)이 mutation 무방비 | **반영** — mutation-격리 테스트 4건 추가(`output-shape.test.ts`). 3건은 음성(reject) 케이스로 AND-guard 를 지킨다. 각 guard 를 소스에서 제거하면 **대응 테스트 하나만 red** 로 전환됨을 직접 실측(아래 §mutation 실측), 원복 후 잔여 diff 0 확인 | 본 커밋 |
| WARNING 2 | requirement | 20_06_14 SUMMARY.md 배너가 "testing 해소됨"이라 하면서 SoT 로 지목한 `## testing 재시도 결과` 절이 빈 placeholder → 같은 커밋 RESOLUTION.md("미확보")와 모순 | **반영** — 그 절을 실제 결과로 채움. testing 은 이 세션(10_40_03)에서 정상 실행돼 clean(LOW) 판정을 냈고, 1차 no_status 원인이 harness 장애였음을 명시. 배너 "해소됨"이 이제 절을 SoT 로 정확히 성립 | 본 커밋 |
| WARNING 3 | requirement | 20_06_14 세션 `maintainability.md`/`side_effect.md` 리뷰어 리포트 내부의 라인 번호 오귀속 3건(1건만 RESOLUTION 반영, 나머지 잔존) | **미조치 (근거 있는 거절)** — 아래 §WARNING 3 판단 근거 | — |
| INFO 1~9 | 다수 | 애플리케이션 코드 결함 0 확인 / JSDoc·라인 drift 해소 실측 확인 / 이월 defer 항목(언어 혼용·이중 SoT·변수명 결합) | **미조치 (의도)** — 대부분 "조치 불필요" 확인성. 이월 defer 는 20_06_14 RESOLUTION 결정 유지. 단, 신규 4개 테스트의 주석은 INFO-5 재발 방지를 위해 **내부 변수명이 아니라 필드 존재/부재로 서술** | 본 커밋 |

### WARNING 3 판단 근거 (거절)

`maintainability.md`/`side_effect.md` 는 **과거 리뷰어 sub-agent 가 특정 시점에 낸 감사
스냅샷**이다. 그 내부 라인 번호가 어긋난 것은 리뷰 프롬프트 조립 방식(diff + 전체 파일
컨텍스트 이어붙임)이 만드는 **구조적 오프셋 artifact** 이지, 리뷰 대상 코드의 결함이 아니다.
소급 재작성을 하지 않는 이유:

1. **가치 ≈ 0.** 리뷰 대상 코드(3파일)는 모든 리뷰어가 clean(CRITICAL=0, 코드 WARNING=0)으로
   판정했다. 리포트 내부 라인 번호는 어떤 실행 경로·회귀와도 무관하다.
2. **감사 무결성.** 과거 감사 기록을 사후에 손보는 것은 그 자체로 기록을 흐린다. 스냅샷은
   "그 리뷰어가 그때 무엇을 말했는가"의 증거이므로 보존이 원칙이다.
3. **무한 루프 위험.** 리뷰 산출물이 커밋되는 컨벤션 하에서 "리뷰-문서의 라인 번호를 고치는
   커밋"을 다시 리뷰하면, 그 커밋의 리뷰 문서에서 또 라인 오프셋이 나온다 — 수렴하지 않는
   doc-루프다. Critical 0 · 코드 WARNING 0 상태에서는 여기서 수렴한다.

리뷰어가 대안으로 제시한 "caveat 명시"를 이 절이 대신한다: **review 산출물의 line 참조는
프롬프트 오프셋일 수 있어 신뢰도가 낮으며, 위치는 함수/블록명으로 재확인할 것.** (근본 개선은
리뷰 서브에이전트 프롬프트 조립을 손대는 harness 레벨 별건 — 이 PR 범위 밖.)

## mutation 실측 (WARNING 1 — 핵심 주장)

통과 자체는 검증이 아니므로, 추가한 4개 guard 를 각각 소스에서 제거 → red 전환을 직접 실측했다.
원복 후 `git diff --stat` 잔여 0 확인. (백업 cp + 절대경로 복원, cwd-상대 `git checkout` 미사용.)

| mutation (guard 제거) | 결과 |
|---|---|
| A: 첫 게이트 `conversationConfig` disjunct 제거 | 1 failed / 38 passed |
| B: 첫 OR-항 `hasLegacyMessages` guard 제거 | 1 failed / 38 passed |
| C: `looksLikeConversationEnd` 의 `hasResultMessages` guard 제거 | 1 failed / 38 passed |
| D: `isCanonicalWaiting` 의 `hasLegacyMessages` guard 제거 | 1 failed / 38 passed |

각 mutant 가 **오직 대응 테스트 하나에만** 잡히므로 격리가 성립한다.

## TEST 결과

- `npx vitest run src/components/editor/run-results/ src/lib/conversation/` → **346 passed** (기존 342 + 신규 4).
- `npx vitest run output-shape.test.ts` → **39 passed** (기존 35 + 신규 4).
- `npx eslint` (3파일) → clean.

이번 후속은 순수 테스트 추가 4건 + 리뷰 산출물(SUMMARY.md) 문서 정정 1건뿐이라 런타임 로직
diff 가 0 이다. 앞선 20_06_14 RESOLUTION 이 4단계 TEST WORKFLOW(lint/unit/build/e2e) 전부
PASS 를 이미 실측했고, 본 후속은 그 위에 격리 테스트만 추가하므로 재-e2e 불요(테스트-only 추가).

## 보류·후속 항목

1. **별건 (기존 추적 중)** — `isConversationOutput` 의 heuristic OR-체인을 discriminated union
   으로 재설계하는 안. 입력이 `unknown` 이라 타입만으로 근본 차단 불가. 본 작업은 그 재설계가
   아니라 현 구조의 mutation 커버리지 보강이며, 이번으로 OR-체인 6분기 + AND-guard 4곳이
   전부 격리 테스트로 고정됐다.
2. **이월 defer (INFO)** — JSDoc 언어 혼용 / JSDoc↔테스트 이중 SoT / 기존 3개 테스트 주석의
   변수명 결합. 차단 사유 아님. 다음에 `isConversationOutput` 분기를 손대는 작업에서 함께 정리.
3. **harness 레벨 (별건)** — 리뷰 서브에이전트 프롬프트 조립이 만드는 라인번호 오프셋 artifact
   (WARNING 3 의 근본 원인). 이 PR 범위 밖.
