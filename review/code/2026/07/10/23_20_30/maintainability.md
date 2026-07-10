# 유지보수성(Maintainability) Review

## 리뷰 범위

- `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` — resume 경로 `llmContext` 변수에 명시 타입 주석(`LlmCallContext`) 부여 + import 수정 (2~3줄 diff)
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` — `collection retry loop` describe 블록에 회귀 테스트 1건 추가
- `review/consistency/2026/07/10/22_52_18/{SUMMARY,convention-compliance,cross-spec,naming-collision,plan-coherence,rationale-continuity}.md` — 신규 생성된 `--impl-prep` 감사 산출물(프로세스 아티팩트, `CLAUDE.md` 규약상 `review/consistency/**` 저장 위치). 소스 코드가 아니므로 가독성·네이밍·복잡도 등 일반적 코드 유지보수성 관점 대상이 아니며, 특기할 이슈 없음(각 문서 자체가 근거 라인번호를 명시해 추적 가능하도록 작성됨).

두 소스 파일 변경 모두 극히 작고 국소적인 diff이며, 새 로직/제어 흐름을 도입하지 않는다(타입 주석 1개 + 테스트 1개). 아래는 이 범위 내에서 발견한 사항이다.

## 발견사항

- **[INFO]** 신규 테스트가 인접 테스트와 mock 셋업 로직을 거의 그대로 복제
  - 위치: `information-extractor.handler.spec.ts` 신규 테스트 `passes the same llmContext attribution to the retried (2nd) chat call`(diff 상 새 `it` 블록) vs 바로 위 기존 테스트 `feeds tool_result back and loops when finalize is called with missing required`
  - 상세: 두 테스트 모두 `mockLlmService.chat.mockResolvedValueOnce(finalizeCall({senderName:'John', orderNumber: null}, {callId:'c1'})).mockResolvedValueOnce(finalizeCall({senderName:'John', orderNumber: 'O-xx'}, {callId:'c2'}))` 형태의 동일한 2단계 mock 체인을 거의 문자 그대로 반복한다. 테스트 파일 관례상 각 `it`이 독립적으로 셋업을 명시하는 것은 가독성/디버깅 용이성 트레이드오프로 흔히 허용되지만, 이 특정 패턴(collection-retry 2회 chat)은 이미 파일 내 3곳(`feeds tool_result back...`, 신규 테스트, `appends a tool-role feedback message...`)에서 반복되고 있어 `mockTwoTurnFinalize(first, second)` 같은 소형 헬퍼로 추출할 여지가 있다.
  - 제안: 당장 블로킹 사유는 아님. 향후 이 describe 블록에 유사 테스트가 추가될 때 헬퍼 추출을 고려. 현재 diff 단독으로는 기존 관례(파일 내 이미 존재하던 중복 패턴을 한 곳 더 따름)를 따른 것이라 새로 도입한 문제는 아니다.

- **[INFO]** import 스타일이 파일 내부 로컬 관례(`type` 인라인 수식어)와 자매 파일 관례 중 하나를 선택해야 하는 상황이었음 — 선택은 적절
  - 위치: `ai-turn-executor.ts` 상단 `import { LlmService, type LlmCallContext } from '../../../modules/llm/llm.service';`
  - 상세: 같은 타입을 이미 쓰고 있는 자매 파일 `information-extractor.handler.ts`는 `import { LlmService, LlmCallContext }`(plain, `type` 수식어 없음)를 쓰는 반면, 수정 대상 파일 자체는 이미 `type ConditionDef`, `type MemoryStrategy` 등 인라인 `type` 수식어 관례를 2곳에서 채택하고 있다. 이번 diff는 "동일 파일 내부 일관성"을 택해 `type LlmCallContext`로 갔는데, 이는 첨부된 `convention-compliance.md`/consistency-check 산출물이 INFO로 이미 검토·승인한 선택이며 lint로 강제되는 항목도 아니다. 유지보수성 관점에서 파일-로컬 일관성을 우선한 것은 합리적 판단이다.
  - 제안: 조치 불요. 저장소 전체적으로 두 스타일(자매 파일 plain / 이 파일 `type` 인라인)이 공존하는 것 자체는 별건 사항이나 이번 diff 범위 밖.

- **[INFO]** 추가된 설명 주석이 코드 1줄 변경 대비 다소 길지만 근거 있는 "why" 주석
  - 위치: `ai-turn-executor.ts:2599` 직전 4줄 주석 (`// 명시 타입 주석 필수: TS 의 excess-property check 는...`)
  - 상세: TypeScript의 excess-property check가 "fresh object literal을 함수 인자로 직접 넘길 때만" 적용되고 `const` 변수를 경유하면 우회된다는, 직관적이지 않은 언어 동작을 설명한다. 코드 자체는 1줄(`: LlmCallContext` 추가)뿐이지만 그 이유(#501 회귀의 실패 모드와 동일한 클래스의 버그를 컴파일 타임에 차단)를 명시한 주석은 향후 이 라인을 건드릴 사람(예: 인접 plan에 언급된 `task_6da430a3`의 `pickResumeIdentificationFields` 헬퍼 리팩터 담당자)이 왜 이 타입 주석이 필요한지 재추론하지 않도록 돕는다. 코드 대비 주석 비율이 높아 보일 수 있으나 "무엇을"이 아니라 "왜"를 설명하는 좋은 사례로, 이 저장소의 기존 주석 관례(파일 전반에 걸쳐 SoT 근거·spec 링크를 인라인 주석으로 남기는 패턴)와도 일치한다.
  - 제안: 조치 불요.

## 요약

이번 변경은 두 파일에 걸친 매우 작고 국소적인 diff — (1) 기존에 이미 안전했던 단발 호출 경로와 대칭을 이루도록 resume 경로의 `llmContext` 변수에 명시 타입 주석을 부여해 컴파일 타임에 오탈자 필드 유입을 차단하고, (2) `collection retry` 루프의 2번째 chat 호출에도 동일한 attribution 값이 전달되는지 검증하는 회귀 테스트 1건을 기존 헬퍼(`retryState()`, `finalizeCall()`)를 그대로 재사용해 추가한 것 — 으로, 새 함수·조건 분기·매직 넘버·깊은 중첩을 전혀 도입하지 않는다. 네이밍(`llmContext`, `expectedContext`, `retriedContext`)과 파일 내부 import 관례(인라인 `type` 수식어)도 기존 스타일을 그대로 따른다. 유일하게 짚을 만한 점은 신규 테스트가 인접 테스트와 mock 셋업 코드를 거의 그대로 복제한다는 것인데, 이는 이번 diff가 새로 만든 패턴이 아니라 파일에 이미 존재하던 반복 패턴을 한 번 더 따른 것이며 테스트 독립성 관점에서 통상 허용되는 트레이드오프라 차단 사유는 아니다. 전반적으로 가독성·복잡도·일관성 모두 양호하다.

## 위험도

LOW
