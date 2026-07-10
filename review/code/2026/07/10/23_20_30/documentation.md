# 문서화(Documentation) 리뷰

대상: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (변경 (e): `llmContext` 명시 타입 주석),
`codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` (변경 (g): collection-retry 2차 chat attribution 회귀 테스트) — #501 후속 attribution 하드닝.
부수 파일 3~8(`review/consistency/2026/07/10/22_52_18/*.md`)은 이번 세션의 `--impl-prep` consistency-check 산출물(신규 생성)로, 코드가 아니므로 문서화 관점에서는 정보 근거로만 참고.

## 발견사항

- **[WARNING]** plan 추적 문서 미갱신 — 이번 변경이 정확히 충족하는 두 follow-up 체크박스가 그대로 `[ ]` 로 남음
  - 위치: `plan/in-progress/resume-llm-usage-attribution.md` "최종 /ai-review(02_09_15) INFO" 섹션의 INFO#1(`ai-turn-executor.ts:2599` `LlmCallContext` 타입 주석)·INFO#4(IE collection-retry 2번째 chat attribution 테스트)
  - 상세: 실제로 파일을 읽어 확인한 결과 두 항목 모두 아직 `[ ]` 미체크 상태이며, 이번 diff(변경 (e)/(g))는 이 두 항목을 글자 그대로 구현한 것인데도 plan 파일 자체는 이 PR 의 변경 대상에 포함돼 있지 않다. `plan-coherence.md`(파일 7)가 이미 같은 사실을 WARNING·MEDIUM 위험도로 포착했고, `SUMMARY.md`(파일 3)의 "대응" 절에 "본 코드 PR 은 plan 파일을 건드리지 않는다 — 동시 진행 중인 문서 PR #898 이 같은 리스트 블록의 인접 항목(INFO#3)을 편집 중이라 merge 충돌을 피하기 위해, #898 머지 후 별도 pass 에서 (e)(g) 체크 + `plan/complete/` 이동을 수행한다" 는 의도된 결정으로 기록돼 있다. 근거는 합리적이지만, 이 결정이 이번 세션의 review 산출물에만 남아 있고 durable 한 후속 항목(예: 새 plan 파일 또는 `plan/in-progress/resume-llm-usage-attribution.md` 자체의 메모)으로 등록돼 있지는 않다 — 다음 세션/다른 작업자가 이 SUMMARY 를 다시 읽지 않으면 "코드는 이미 머지됐는데 plan 체크박스는 미체크" 상태로 SoT 가 stale 해진 채 방치될 위험이 있다.
  - 제안: #898 머지 확인 직후 별도의 작은 follow-up 커밋(또는 #898 자체의 rebase)에서 INFO#1/INFO#4 를 `[x]` 로 갱신할 것. 가능하면 이 의도를 PR 설명/커밋 메시지에도 명시해 "plan 체크 후속 예정" 임을 남겨, 이번 SUMMARY.md 산출물 하나에만 의존하지 않도록 한다.

- **[INFO]** import 스타일 결 — 자매 파일과 로컬 관례가 서로 다른 방향을 가리킴(기능상 문제 아님, 확인 완료)
  - 위치: `ai-turn-executor.ts` 상단 `import { LlmService, type LlmCallContext } from '../../../modules/llm/llm.service';`
  - 상세: 같은 심볼을 이미 쓰는 자매 핸들러 `information-extractor.handler.ts:10` 은 `import { LlmService, LlmCallContext }` (plain, `type` 수식어 없음)를 쓰는 반면, 이번 diff 는 대상 파일(`ai-turn-executor.ts`) 자체가 이미 채택 중인 "값+타입 혼합 시 inline `type` 수식어" 로컬 관례(`{ AiConditionEvaluator, type ConditionDef }` 등)를 따라 `type LlmCallContext` 로 작성했다. `convention-compliance.md`(파일 4)가 이미 이 결을 INFO 로 확인했고 `@typescript-eslint/consistent-type-imports` 가 backend eslint 설정에 없어 lint 상 문제도 없다. 두 파일이 같은 타입을 서로 다른 import 스타일로 소비하는 상태 자체는 남지만, repo-wide 강제 규칙이 없어 실질적 위험은 없다.
  - 제안: 조치 불요(이미 검증 완료). 추후 두 파일을 함께 정리할 기회가 있으면 통일 고려.

- **[INFO]** CHANGELOG 신규 항목 불요 — 기존 항목이 이미 이번 하드닝의 상위 PR(#877/#879)을 커버함(확인 완료)
  - 위치: `CHANGELOG.md` "Unreleased — 멀티턴 resume 턴 llm_usage_log attribution ... (data-flow/7-llm-usage §1.3)" 섹션
  - 상세: 이번 변경은 런타임 동작 무변경(순수 컴파일 타임 타입 가드 + 회귀 테스트 추가)이라 신규 CHANGELOG 항목이 정식 규약상 요구되지 않는다(`convention-compliance.md` 파일 4 확인 — `PROJECT.md`/`spec/conventions/**`/skill 문서 어디에도 CHANGELOG 갱신을 강제하는 표 항목 없음). 기존 항목이 이 attribution 하드닝의 배경(#877/#879)을 이미 서술하고 있어 그대로도 충분.
  - 제안: 조치 불요. 원한다면 기존 항목 말미에 "(컴파일 타임 하드닝 + 회귀 테스트 추가, #501 후속)" 한 문장만 덧붙이는 것도 가능하나 의무는 아님.

- **[INFO]** 인라인 주석 품질 — 모범적(긍정 관찰, 조치 불요)
  - 위치: `ai-turn-executor.ts:2596~2609`(신규 주석 4줄) / `information-extractor.handler.spec.ts:646~651`(신규 테스트 상단 주석)
  - 상세: `ai-turn-executor.ts` 의 신규 주석은 "왜 명시 타입 주석이 필요한가"를 TypeScript 의 구체적 동작(excess-property check 은 fresh object literal 을 인자에 직접 넘길 때만 적용되고, 무주석 `const` 를 거치면 우회된다)까지 근거로 들어 설명하고, 단발 경로(`executeSingleTurn`)와의 비대칭을 명시하며, `#501` 회귀와의 연결까지 짚는다 — 복잡한 로직에 대한 인라인 주석의 모범 사례. `information-extractor.handler.spec.ts` 의 신규 테스트 주석도 spec §1.3 참조, 대칭 선례(`ai-turn-executor.spec.ts`) 교차 참조, `retryState()` 기본값의 함정(`executionId` 부재 시 `llmContext` 가 `undefined` 로 평가됨)을 명시해 "왜 세 필드를 override 로 명시 주입해야 유의미한 단언이 되는지"를 독자가 바로 이해하도록 돕는다. 두 곳 모두 별도 수정 불요.

## 검토 항목별 결론 (해당 없음 확인)

- **독스트링/JSDoc**: `LlmCallContext` 인터페이스(`llm.service.ts:35-38`) 는 이번 diff 이전부터 이미 문서화돼 있고 정의 자체는 변경되지 않음 — 이번 변경은 기존 문서화된 타입의 소비 지점을 하나 늘린 것뿐이라 갭 없음.
- **README/API 문서/설정 문서/예제 코드**: 신규 기능·엔드포인트·환경변수·공개 API 표면 추가 없음(순수 내부 타입 안전성 강화 + 테스트 1건) — 해당 없음. `convention-compliance.md`/`cross-spec.md` 가 동일 결론을 코드 근거로 이미 확인.
- **주석 정확성**: 변경 지점 주변의 기존 주석(라인 2596~2601, 미변경)과 신규 주석이 서로 모순되지 않고 자연스럽게 이어짐. 오래된/부정확해진 주석 없음.

## 요약

이번 변경 세트는 문서화 관점에서 전반적으로 우수하다 — 핵심 코드 diff 두 건(타입 주석 1줄 + import, 회귀 테스트 1건) 모두 "왜"를 설명하는 인라인 주석을 spec 절 번호·이전 이슈(#501)·대칭 선례까지 교차 참조하며 남겼고, README/API 문서/설정 문서/CHANGELOG 등 외부 문서 갱신은 정식 규약상 요구되지 않음이 동봉된 consistency-check 산출물로 이미 검증되어 있다. 유일한 실질적 문서화 리스크는 이번 PR 이 정확히 충족하는 plan follow-up 두 항목(`plan/in-progress/resume-llm-usage-attribution.md` INFO#1/INFO#4)이 병합 순서 문제로 의도적으로 미체크 상태로 남는다는 점 — 이 결정 자체는 합리적이나(다른 문서 PR #898 과의 merge 충돌 회피), 이 세션의 review 산출물 밖에 durable 한 후속 추적이 없어 잊혀질 위험이 있으므로 #898 머지 후 반드시 별도 pass 로 체크할 것을 권고한다.

## 위험도

LOW

STATUS: DONE
