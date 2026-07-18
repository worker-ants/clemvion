# 유지보수성(Maintainability) 리뷰

## 리뷰 대상 요약

- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts` — 회귀 핀 테스트 2건 추가 (신규 `describe` 블록)
- `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts` — `endMultiTurnConversation` 시그니처에 3개 optional 파라미터 추가(`_`-prefix, 미사용 의도 명시) + 대형 docblock 추가
- `codebase/backend/src/nodes/core/node-handler.interface.ts` — `ResumableNodeHandler.endMultiTurnConversation` docblock 을 "범용 계약"에서 "구현체별 분기(AiAgent verbatim relay vs IE self-fill)" 서술로 정정
- `plan/in-progress/ie-endmultiturn-errorpayload-contract.md`, `review/consistency/2026/07/18/11_19_02/*` — plan/consistency-check 산출물(process 아티팩트, 애플리케이션 코드 아님) — 함수/변수/복잡도 관점의 유지보수성 평가 대상이 아니라 스코프에서 제외

실질적인 프로덕션 로직 변경은 없다 — `endMultiTurnConversation` 의 본문(`hydrateState` → `buildMultiTurnFinalOutput` 위임)은 그대로이며, 새 파라미터 3개는 모두 optional 이고 `_`-prefix 로 "의도적 미사용"을 표시한다. 변경은 사실상 문서화(docblock) + 계약 명시화 + 회귀 핀 테스트로 구성된다.

### 발견사항

- **[INFO]** `endMultiTurnConversation` (handler.ts) 의 docblock 대 함수 본문 비율이 극단적으로 큼
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:1182`-`1232` (docblock ~40줄 vs 함수 본문 8줄)
  - 상세: 3가지 이유(self-fill 근거·code-기반 retryable invariant·retry_last_turn 미지원)를 상세히 서술한 JSDoc 이 실제 로직(2줄 위임 호출)에 비해 매우 길어 스캔성이 떨어진다. 다만 이 저장소는 `node-handler.interface.ts` 등에서 이미 "긴 docblock 을 설계 결정의 SoT"로 삼는 컨벤션이 확립돼 있어(예: `AssertEndReasonDomain`, `ResumableNodeHandler` 자체의 문서), 이 변경은 그 기존 스타일과 **일관**되며 새로운 패턴을 도입한 것은 아니다.
  - 제안: 당장 조치 불필요. 다만 향후 이런 "왜"류 서술이 더 늘어나면 상세 rationale 은 spec 문서의 `## Rationale` 섹션으로 옮기고, 코드에는 5~8줄 요약 + 링크만 남기는 편이 스캔성에 유리하다.

- **[INFO]** 동일 설계 결정(IE 의 errorPayload self-fill 이유)이 두 파일에 유사한 텍스트로 중복 서술됨
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts:458`-`470`(간략 버전) ↔ `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.ts:1182`-`1221`(상세 버전)
  - 상세: 인터페이스 쪽은 "핸들러의 docblock 이 SoT" 라고 명시하고, 핸들러 쪽은 "이 메서드가 SoT" 라고 명시해 상호 참조로 drift 위험을 줄이고는 있으나, 이유 목록(1~3번)이 두 곳에 별도 텍스트로 존재하므로 향후 설계가 바뀌면 두 곳 모두 手動 갱신이 필요하다. 명시적 SoT 포인터가 있어 리스크는 낮음(정보성).
  - 제안: 조치 불필요. 인터페이스 쪽 요약이 핸들러 쪽 상세와 불일치하게 되면(즉 향후 PR에서) 그때 한쪽을 축약하는 정리를 고려.

- **[INFO]** 새 테스트 파일의 `errorState()` 헬퍼는 같은 파일의 기존 `buildState()` 패턴과 유사하지만 재사용 불가(스코프 상이) — 다만 이는 기존 컨벤션을 그대로 따른 것이며 개선 여지가 있는 부분은 이 diff가 아니라 그 직전 sibling 블록(`describe('buildMultiTurnFinalOutput', …)`, `information-extractor.handler.spec.ts:1157`-`1293`)임
  - 위치: `codebase/backend/src/nodes/ai/information-extractor/information-extractor.handler.spec.ts:1302`(신규 `errorState()`) vs `:773`(기존 `buildState()`, 다른 `describe` 스코프) vs `:1159`/`:1198`/`:1256`(헬퍼 없이 유사 리터럴 3회 인라인 반복 — pre-existing, 이번 diff 범위 밖)
  - 상세: 신규 블록은 2개 테스트가 공유하는 state 객체를 `errorState()` 로 팩터링해 자체 스코프 내 중복을 피했고, 이는 sibling `describe('processMultiTurnMessage', …)` 의 `buildState(overrides)` 패턴과 동일 철학(describe-local factory)이라 파일 컨벤션과 일관된다. 오히려 바로 위 `describe('buildMultiTurnFinalOutput', …)` 블록이 거의 동일한 대형 리터럴을 헬퍼 없이 3회 인라인 반복하고 있어(이번 diff 미포함, pre-existing) 상대적으로 이번 추가분이 더 깔끔하다.
  - 제안: 이번 diff 는 조치 불필요. 후속 리팩터링 시 `buildMultiTurnFinalOutput` describe 블록의 인라인 반복을 헬퍼로 묶는 것을 고려(별건).

- **[INFO]** `plan/in-progress/*.md`, `review/consistency/**/*.md|json` 은 프로세스 산출물(코드 아님)
  - 위치: `plan/in-progress/ie-endmultiturn-errorpayload-contract.md`, `review/consistency/2026/07/18/11_19_02/*`
  - 상세: 함수 길이·중첩·매직넘버·중복 코드 등 본 관점의 체크리스트는 애플리케이션 로직에 적용되는 기준이라 이 문서들에는 해당 사항이 없다. 저장소 규약(`정보 저장 위치` 표)에 따라 `plan/in-progress/`, `review/consistency/**` 경로도 올바르다.
  - 제안: 조치 불필요.

### 긍정적 관찰

- `_errorPayload` / `_failedUserMessage` / `_failedUserMessageSource` 네이밍은 `ResumableMessageOptions` docblock 에 이미 문서화된 "미사용 파라미터는 `_` prefix" 컨벤션을 정확히 따른다(`node-handler.interface.ts:1208`-`1210` 참고) — 인터페이스·AiAgentHandler·InformationExtractorHandler 세 곳 모두 일관.
- 새 테스트 2건은 기존 공용 헬�터(`asNodeHandlerOutput`/`getResult`/`getError`)를 그대로 재사용하고, 테스트명이 검증 대상(§5.3 계약 무시 + self-fill)을 명확히 서술해 가독성이 좋다.
- `@link` 참조(`retryabilityDetails`, `runTurnWithCollectionRetries`, `buildErrorOutput`, `processMultiTurnMessage`, `executeMultiTurn`, `hydrateState`, `buildMultiTurnFinalOutput`)를 모두 실제 소스에서 확인 — dangling 참조 없음.
- 인터페이스 docblock 정정은 이전에 "핸들러는 반드시 errorPayload 를 output.error 에 그대로 set 해야" 라고 범용 계약처럼 서술되어 있던 부정확한 문서를 실제 구현체별 분기(verbatim relay vs self-fill)로 바로잡아 **문서 정확성**을 개선했다 — 향후 유지보수자의 오해(및 반복 재조사 비용)를 줄이는 방향.

## 요약

이번 변경은 프로덕션 로직을 건드리지 않고 (1) `endMultiTurnConversation` 시그니처를 인터페이스 계약과 일치시키는 3개 optional 파라미터 추가, (2) 그 의도적 무시를 설명하는 docblock, (3) 회귀 방지 테스트 2건으로 구성된 문서화·계약 명확화 중심 diff다. 네이밍·헬퍼 재사용·`@link` 정확성 모두 기존 코드베이스 컨벤션과 일관되며 새로운 중복·매직넘버·깊은 중첩·복잡도 증가는 없다. 유일한 관찰 포인트는 docblock 이 실제 코드량 대비 매우 길다는 점과 동일 설계 결정이 인터페이스·구현체 두 곳에 나뉘어 서술된다는 점인데, 둘 다 이 저장소의 기존 "긴 docblock = SoT" 관행과 일치하고 상호 참조로 drift 리스크가 낮아 INFO 수준에 그친다.

## 위험도

NONE
