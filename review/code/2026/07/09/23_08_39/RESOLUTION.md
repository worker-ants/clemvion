# RESOLUTION — conversation_thread egress secret 마스킹 (EIA §R17)

리뷰 대상 커밋: `748d3813d`. 리뷰어 5종(security / requirement / testing / side-effect / maintainability) 병렬 수행.
fix 커밋은 본 RESOLUTION 뒤에 codebase 에 반영.

## 처분 요약

| # | 출처 | Severity | 판정 | 조치 |
|---|---|---|---|---|
| 1 | testing | CRITICAL | Fixed | `toolCalls[].arguments`(raw JSON) 마스킹이 `{"api_key":"x"}`→`{***}` 로 **JSON 파괴**. → 마스킹 대상에서 **제거**(구조화 필드는 범위 밖). `text`+`runningSummary` 자유 텍스트만 마스킹. JSON-intact 회귀 테스트 추가. |
| 2 | testing | CRITICAL | Fixed | 공유 SoT `Authorization:\s*\S+` 가 공백에서 멈춰 `Basic dXNl…` 자격증명 노출. → 패턴을 `Authorization:[^\r\n]*`(줄 끝까지)로 확장. Basic/Digest 회귀 테스트 추가. 기존 `sanitizeLastErrorMessage` 소비처(integration-oauth 등 363 test) 회귀 없음. |
| 3 | security | HIGH | Documented + follow-up | `execution.ai_message` 라이브 이벤트가 같은 AI 텍스트를 SSE·webhook·Chat Channel(텔레그램 능동 발송)로 **미마스킹 노출**. conversationThread(durable 재노출)와 **신뢰 경계가 다른 별개 표면**(라이브 사용자 응답 전달)이라 source 마스킹은 사용자向 응답을 변형함 → 본 PR 범위 밖. spec §R17 에 **명시적 잔여 항목**으로 문서화 + 후속 task 스폰. |
| 4 | requirement, maintainability | MED×2 | Fixed | `redactThreadForPublic` JSDoc "every text-bearing field" 과장 → 실제 마스킹 필드(`text`·`runningSummary`)와 미스캔 구조화 필드(`data`·`toolCalls.arguments`·`presentations`)를 정확히 명시. |
| 5 | requirement | MED | Fixed | spec §R17 의 `[SECRET_LEAK_PATTERNS](../conventions/conversation-thread.md)` 오링크 → 정의 위치 `shared/utils/sanitize-error-message.ts` 인라인 참조로 교정(깨진 md 링크 제거). |
| 6 | maintainability | MED | Fixed | `cloneThread` JSDoc 의 stale "WS emit" 예시(공개 emit 은 이제 redactThreadForPublic) → "Not for public EIA emit" 명시. |
| 7 | testing | WARNING | Fixed | REST 는 마스킹 테스트 있고 SSE emit 4곳은 없던 비대칭 → button-interaction emit 경로에 마스킹 회귀 테스트 1건 추가(egress 마스킹 + 원본 thread faithful 동시 검증). |
| — | side-effect | NONE | — | 부작용 Critical/Warning 없음. `sanitizeLastErrorMessage` 순수 리팩터·`cloneThread` 내부 사용 유지·미변형 확인. |

testing INFO 4건(frozen-turn 안전성·Authorization 단독 분기·느슨한 assertion·빈 turns 엣지)은 일부를 위 회귀 테스트로 흡수, 나머지는 저위험으로 미조치.

## 범위 결정(정직성)

- **닫음**: conversationThread 의 **자유 텍스트**(`text`·`runningSummary`) turn-text 불변식 — 공개 egress(REST getStatus + SSE waiting)에서 런타임 강제.
- **명시적 잔여**(spec §R17 문서화): (a) 구조화 필드(`data`·`toolCalls.arguments`·`presentations`)의 JSON-safe deep redaction, (b) `execution.ai_message` 라이브 표면, (c) `outputData`/`nodeOutput` 키-allowlist, (d) DB-at-rest append-time redaction. 미구현을 구현처럼 과대 서술하지 않음(requirement 리뷰가 overclaim 없음 확인).

## 검증

- unit: 대상 10 suite / 363 test 통과(sanitize-error-message·thread-renderer·interaction.service·button/form/ai-turn interaction·conversation-thread·integration-oauth). 
- lint: 0 error. build(tsc `tsconfig.build.json`): clean.
