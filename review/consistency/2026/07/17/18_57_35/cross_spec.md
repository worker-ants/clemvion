# Cross-Spec 일관성 검토 결과

대상 target: `spec/4-nodes/3-ai/` (--impl-done, diff-base=origin/main)

## 실제 변경 범위 확인

프롬프트에 첨부된 target 문서 덤프는 (파일 용량 제한으로) `spec/4-nodes/3-ai/0-common.md` 전문과 `1-ai-agent.md` 일부만 담고 있어, `git diff origin/main..HEAD -- spec/` 를 직접 실행해 실제 변경분을 재확인했다. 실질 변경은 다음 3개 파일, `endReason` 값 도메인의 code-level SoT 를 `@workflow/ai-end-reason` 패키지로 지정하는 매우 작은 diff다:

- `spec/4-nodes/3-ai/1-ai-agent.md` (+2, §7 상단 backlink)
- `spec/4-nodes/3-ai/3-information-extractor.md` (+2, §5.6 상단 backlink)
- `spec/conventions/interaction-type-registry.md` (+47/-2, 신규 §4 "AI 노드 `endReason` — 패키지가 SoT" + 옛 §4 Rationale → §5 재번호 + "영구히 차단한다" 과장 표현 정정)

이 작업은 `plan/complete/is-conversation-output-restructure.md` (spec_impact 프런트매터가 위 3 파일과 정확히 일치) 로 추적되며, 착수 전 수행된 `--spec` 단계 cross-spec 리뷰(`review/consistency/2026/07/17/15_06_14/cross_spec.md`)가 WARNING 2건을 남겼다. 실장 결과를 아래에서 재검증한다.

## 사전 리뷰 WARNING 2건 — 해소 확인

- **WARNING 1 (governance 미등록)**: `interaction-type-registry.md` 에 `endReason` 이 매트릭스 방식이 아닌 패키지 방식으로 거버닝됨을 §4 로 신설 등록 — 해소됨. `satisfies`/`Exclude` 양방향 강제, 왜 매트릭스가 불필요한지, 두 노드 유니온을 합치지 않는 이유가 모두 명문화됐다.
- **WARNING 2 (spec 산문 backlink 부재)**: `1-ai-agent.md` §7 · `3-information-extractor.md` §5.6 상단에 패키지를 code-level SoT 로 지목하는 backlink 추가 — 해소됨.

두 해소 모두 실제 코드(`codebase/packages/ai-end-reason/src/index.ts`, `nodes/core/node-handler.interface.ts:441`, `ai-turn-executor.ts:1884/3148/3199/3421`, `output-shape.ts:12`)와 대조해 서술이 정확함을 확인했다 — `AiAgentEndReason = 'user_ended'|'max_turns'|'condition'|'error'`, `InformationExtractorEndReason` 6값, frontend 가 더 이상 손 사본을 갖지 않고 패키지를 import.

## 발견사항

- **[WARNING] `endReason` 패키지-SoT 백링크의 적용 범위가 AI Agent 문서에서 불명확 — 단일턴 `'out'` 제외 사실 미기재**
  - target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` L463. `## 7. 출력 구조` 헤딩 직후, §7.1(단일턴 `out`)~§7.10 을 모두 나열하는 서브섹션 표 바로 위에 위치.
  - 충돌 대상: `codebase/packages/ai-end-reason/src/index.ts` (L30-34, L63-65 JSDoc) · `spec/4-nodes/3-ai/3-information-extractor.md` §5.6 (L456-458, 동일 패턴이지만 배치가 더 정밀함)
  - 상세: 신규 노트는 "`endReason` 값 도메인의 SoT 는 `@workflow/ai-end-reason`"이라 선언한 직후 §7.1(single_turn `'out'`)을 포함한 전체 10개 서브섹션 표를 제시한다. 그러나 실제 `AiAgentEndReason` 타입은 `'out'` 을 **의도적으로 제외**한다(패키지 JSDoc: "단일턴 종결('out')은 포함하지 않는다 — 두 노드 유니온 어디에도 없고, 단일턴 출력에는 result.messages 가 없어 대화 판정 대상이 아니다"). 코드에서도 §7.1 의 `endReason: 'out'` 은 `ai-turn-executor.ts:1884` 에 `'out' as const` 리터럴로만 존재해 패키지 타입과 무관하다. 즉 현재 배치는 "값 목록 자체는 패키지가 소유한다"는 문장이 바로 다음 줄의 §7.1 `'out'` 까지 포괄하는 것처럼 읽히지만 실제로는 아니다. 대조적으로 `3-information-extractor.md` 의 동일 노트는 "### 5.6 Case: Multi Turn 종결 (4 종)" 헤딩 **바로 아래**에 위치해 멀티턴 4값 한정임이 헤딩만으로 자명하다. `interaction-type-registry.md §5` (구 §4) Rationale 이 이번 작업에서 스스로 "가드는 '있다'가 아니라 '깨뜨려 봤다'로만 신뢰할 수 있다"는 교훈을 명문화한 만큼, 이 배치는 정확히 그 교훈이 경계하는 "있는 줄 알았던 보장" 오해를 유발할 소지가 있다. **기능적 결함은 아님** — `'out'` 이 대화 판정에서 무해함(`hasResultMessages` 게이트가 먼저 거름)은 `plan/complete/is-conversation-output-restructure.md` §감사결과 및 §결정기록에서 이미 실측 확인됐고, 코드-타입 레벨의 실제 커플링도 없다(컴파일 영향 없음).
  - 제안: `1-ai-agent.md` L463 노트에 "(멀티턴 4값 한정 — 단일턴 `out` 은 `result.messages` 부재로 대화 판정 대상이 아니라 패키지 밖)" 같은 범위 한정 문구를 추가하거나, 노트를 멀티턴 전용 서브섹션 묶음(§7.6~§7.9) 바로 위로 옮겨 IE 문서와 같은 수준의 정밀도를 맞춘다.

- **[WARNING] (target 외 — diff-base 비교 중 발견, orchestrator 참고용) `spec/7-channel-web-chat/*` 가 origin/main 에 이미 병합된 PR #964 콘텐츠를 결여 — EIA 스펙과 상충하는 상태로 diff 에 노출**
  - target 위치: 없음 — declared target `spec/4-nodes/3-ai/` 와 무관. `git diff origin/main..HEAD -- spec/` 에 함께 잡힌 `spec/7-channel-web-chat/1-widget-app.md`(L104-105) · `spec/7-channel-web-chat/3-auth-session.md`(L62).
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` EIA-IN-07(L77) · EIA-NF-03(L153) · §5.2(L423, "구현됨")
  - 상세: 이 워크트리(`is-conversation-output-restructure-08f20e`)는 origin/main 에 이미 머지된 커밋 `5de44d4d6`(#964, "fix(web-chat): replay_unavailable 소비 배선")을 포함하지 않는다(`git merge-base --is-ancestor 5de44d4d6 origin/main` → YES, `... HEAD` → NO). 그 결과 현재 워크트리의 `1-widget-app.md` 는 "`execution.replay_unavailable` 소비 분기는 아직 미배선(no-op)"이라 서술하는 반면, 손대지 않은 `spec/5-system/14-external-interaction-api.md` 의 EIA-NF-03/EIA-IN-07 행은 "버퍼 만료 시 `execution.replay_unavailable` 을 emit 하고 **클라이언트는 REST 재조회로 폴백** (구현됨)"을 **필수** 요구사항으로 명시한다 — 같은 워크트리 안에서 "클라이언트 소비가 구현됨"과 "미배선"이 동시에 참으로 서술되는 상태다. `plan/complete/is-conversation-output-restructure.md` 의 `spec_impact` 프런트매터에 이 두 채널 웹챗 파일이 없어, 이번 작업이 의도적으로 되돌린 것이 아니라 이 워크트리가 #964 이후로 origin/main 과 리베이스되지 않은 부작용으로 판단된다.
  - 제안: merge/PR 전 이 워크트리·브랜치를 최신 origin/main 에 리베이스해 두 파일이 #964 상태를 반영하는지 확인하거나, `spec/7-channel-web-chat/**` 범위로 별도 consistency-check 를 재실행한다. **target 문서(`spec/4-nodes/3-ai/`) 자체의 결함이 아니므로 본 리뷰의 위험도 산정에는 반영하지 않았다** — orchestrator 가 별도 트래킹을 권장.

- **[INFO] `PROJECT.md` doc-sync 매트릭스가 `endReason` 의 신규 "패키지가 SoT (매트릭스 불필요)" 예외를 반영하지 않음**
  - target 위치: `spec/conventions/interaction-type-registry.md §4` (L119-124, "매트릭스: 불필요")
  - 충돌 대상: `PROJECT.md` L134 "신규 cross-cutting enum 값 추가" 행 — `WaitingInteractionType`/`ConversationTurnSource`/`PresentationType` 만 열거하고 (a)"매트릭스에 행 추가" (c)"AST 가드 통과" 를 일괄 지시, `endReason` 언급 없음
  - 상세: `interaction-type-registry.md §4` 는 `endReason` 이 "같은 문제 계열"(cross-cutting enum 누락)이라 스스로 규정하면서도 해법은 매트릭스가 아닌 패키지 컴파일 강제라 명시한다. 그러나 `PROJECT.md` 의 해당 행은 이 예외를 언급하지 않아, 그 행만 참조하는 기여자가 향후 `endReason` 류 값을 추가할 때 불필요한 매트릭스 행 추가를 시도할 여지가 있다. `plan/complete/is-conversation-output-restructure.md` Phase 2 E-6 항목 3 이 "PROJECT.md 표에 endReason 행 신설 여부 판단... 그 판단 자체를 명시"를 스스로 과제로 남겼으나 `PROJECT.md` 본문에는 반영되지 않은 채 plan 이 종결됐다(실측: `grep -n "endReason" PROJECT.md .claude/config/doc-sync-matrix.json` 0건).
  - 제안: `PROJECT.md` L134 행에 각주 또는 별도 행으로 "단, AI 노드 `endReason` 은 예외 — 공유 패키지 `@workflow/ai-end-reason` 이 컴파일타임 강제, 매트릭스 등록 불필요 ([interaction-type-registry §4](spec/conventions/interaction-type-registry.md#4-ai-노드-endreason--패키지가-sot-가드-비대상))" 1줄 추가.

- **[INFO] (기존 이월 — 이번 diff 로 신규 도입 아님) `3-information-extractor.md` 내부 timeout 서술 자기모순 미해소**
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md` L49("외부 cancel 외에는 타임아웃이 발생하지 않음") vs L174("engine 이... 또는 timeout 등을 만났을 때 호출")
  - 충돌 대상: 동일 파일 내부(엄밀히는 cross-spec 보다 문서 내부 불일치) — 이번 `endReason` SoT 정리가 §5.6 바로 위에 새 노트를 추가하면서도 인접한 L174 는 손대지 않아 기존 모순이 그대로 남음
  - 상세: 이 불일치는 이번 작업 **이전** `--spec` 단계 cross-spec 리뷰(`review/consistency/2026/07/17/15_06_14/cross_spec.md` INFO 항목 3)에서 이미 지적됐다. `'timeout'` 은 `InformationExtractorEndReason` 에 선언만 있고 `portForEndReason` 에 생산 경로가 없는 죽은 값이며(패키지 주석: "timeout 은 현재 생산자가 없다"), §5.6 의 실제 "4 가지 종결 사유" 목록에도 등장하지 않는다.
  - 제안: 필수는 아니나, L174 를 "engine 이 사용자 명시 종료를 만났을 때 호출 (`endReason` 유니온은 향후 timeout 도입을 대비해 값을 예약하나 현재 프로덕션 경로에서는 미발생)" 식으로 L49 와 정합시키면 패키지가 무엇의 SoT 인지 더 명확해진다.

## 검증 완료 (충돌 없음)

- **요구사항 ID**: `ND-AG-06`/`10`/`21`(제거·재작성 예정) 등 `spec/4-nodes/_product-overview.md` 표기가 `1-ai-agent.md` §1/§4 의 동일 문구·영향범위 각주와 정확히 일치.
- **계층 책임 경계**: `interaction-type-registry.md §4` 의 "경계" 콜아웃 — 값 도메인(패키지) / 의미·port 매핑(노드 spec) / 출력 봉투 구조(`node-output.md`) 3분할이 실제 두 노드 spec·`node-output.md` §3.2.1/§3.3 내용과 모순 없이 정합.
- **anchor 무결성**: 신규 backlink 2건이 가리키는 `interaction-type-registry.md#4-ai-노드-endreason--패키지가-sot-가드-비대상` 앵커를 GFM slug 규칙으로 직접 계산해 실제 헤딩과 일치 확인(옛 `#4-rationale` 를 참조하는 잔존 링크 0건, 신·구 앵커 모두 spec/** 전수 grep 으로 재확인).
- **Tool Area 제거 상태 정합**: `1-ai-agent.md` §1 의 "재작성 예정(현재 제거됨)" 경고가 `spec/3-workflow-editor/0-canvas.md §12` 상단의 동일 경고와 완전히 대칭.
- **node-output.md Principle 참조**: 0/1/1.1/2/3(3.2.1/3.2.2/3.3)/4(4.1-4.5)/5-11 전 번호가 실제 문서에 존재하며, §7.3·§7.9 의 `details.retryable`/`retryAfterSec` 예시가 Principle 3.2.1 서술과 정확히 일치.
- **다른 소비처 파급 없음**: `endReason` 문자열이 `codebase/channel-web-chat/**`·`codebase/backend/src/modules/external-interaction/**` 에 0건 — 이번 변경은 위젯/EIA 표면과 무관(위 두 번째 발견은 별도 원인의 우연한 동일-diff 노출).

## 요약

실질 변경은 `spec/4-nodes/3-ai/1-ai-agent.md`·`3-information-extractor.md` 에 `endReason` 값 도메인의 code-level SoT 가 `@workflow/ai-end-reason` 패키지임을 알리는 backlink 2건과, `spec/conventions/interaction-type-registry.md` 신규 §4 등록으로 구성된 소규모 diff다. 착수 전 `--spec` 단계 cross-spec 리뷰가 남긴 WARNING 2건(governance 미등록·spec 산문 backlink 부재)은 실제로 해소됐고, 요구사항 ID·계층 책임 경계·anchor 링크·Tool Area 제거 상태·`node-output.md` Principle 참조 등 target 과 다른 spec 영역 사이의 정합성도 모두 확인됐다. 남은 in-scope 리스크는 AI Agent 문서의 백링크가 IE 문서보다 배치 정밀도가 낮아 단일턴 `'out'` 이 패키지 밖이라는 사실을 명시하지 않는 점(WARNING, 기능 결함 아님) 과 `PROJECT.md` doc-sync 매트릭스·IE 내부 timeout 자기모순 두 건의 경미한 문서 정합 개선 여지(INFO)뿐이다. 별도로, 이 워크트리가 origin/main 에 이미 머지된 #964(`replay_unavailable` 소비 배선)를 결여해 `spec/7-channel-web-chat/*` 가 `spec/5-system/14-external-interaction-api.md` 의 "구현됨" 요구사항과 상충하는 상태로 diff 에 함께 노출됐으나, target 문서와 무관한 워크트리 staleness 이므로 위험도 산정에서는 제외하고 orchestrator 참고용으로만 표기했다.

## 위험도

LOW
