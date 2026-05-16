# Rationale 연속성 검토

검토 모드: 구현 착수 전 (--impl-prep)
대상 문서: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`

---

## 발견사항

- **[WARNING]** `spec/4-nodes/4-integration/4-cafe24.md §9.8` — install_token mismatch 회복 분기 미반영
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 "Private 앱 App URL HMAC 검증" 식별 전략 단락
  - 과거 결정 출처: Rationale 발췌 — "Cafe24 install_token mismatch 회복 흐름 (2026-05-15 후속)" 항 (prompt_file 193~214행). `spec/2-navigation/4-integration.md ## Rationale` 동 항목.
  - 상세: Rationale 발췌에는 직접 매칭 실패 시 회복 분기(같은 mall_id 의 row 들에 대해 각 row 의 client_secret 으로 HMAC trial 검증, O(N) 이지만 404 fallback only + workspace-scoped N=1 실무값)가 정식 결정으로 기록되어 있다. 이 회복 분기는 운영 사용자 보고("여러 번 폼 제출 → 옛 URL stale → 404 UX 단절")에서 비롯된 것으로 신규 요구사항이다. 그러나 target 문서 §9.8의 식별 전략 단락은 "단일 row 조회 + 1회 HMAC 검증"만 기술하고, 이 회복 경로 및 HTML 에러 페이지 렌더 동작을 전혀 언급하지 않는다. 구현자가 §9.8만 보면 회복 분기를 빠뜨릴 수 있다.
  - 제안: §9.8에 "install_token 직접 매칭 실패 시 회복 경로" 단락을 추가한다. 정상 흐름(단일 row 조회 + 1회 HMAC) → 실패 시 회복 분기(같은 mall_id row들에 대해 HMAC trial, 정확히 1개 통과 시 fallthrough, 0개 또는 2개+ 시 404 + HTML 에러 페이지)의 두 단계 흐름과, 회복 분기의 보안 분석(HMAC 위조에는 client_secret 필요, 추가 권한 부여 없음), TOCTOU 미발생(read-only 조회) 근거를 명시한다. 이미 `spec/2-navigation/4-integration.md ## Rationale`에 상세 기술이 있으므로 cross-reference로 처리해도 무방하나, §9.8 자체에 흐름 요약이 있어야 구현자가 빠뜨리지 않는다.

- **[INFO]** `spec/4-nodes/4-integration/4-cafe24.md §9.4 step 4` — 회복 분기 미언급으로 흐름 불완전
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.4 "Private 앱 연동 흐름 요약" step 4
  - 과거 결정 출처: 동 Rationale "Cafe24 install_token mismatch 회복 흐름" 항
  - 상세: §9.4 step 4는 "path 의 install_token 으로 Integration 단일 row 조회 → HMAC 1회 검증"만 기술한다. Rationale 에 기록된 회복 분기(직접 매칭 실패 → 회복 경로)는 step 4의 정상 흐름 다음 단계로 존재하는데, §9.4에서 완전히 누락되어 있다. 결과적으로 §9.4 흐름도와 §9.8 식별 전략이 각각 "회복 없는 단순 404" 를 기술하는 형태가 된다.
  - 제안: §9.4 step 4 또는 그 바로 뒤에 "install_token 미매칭 시 회복 경로: §9.8 참조" 한 줄을 추가한다.

- **[INFO]** `spec/conventions/conversation-thread.md §8` — Rationale 위치 위임 명시만 있고 내용 없음 (설계상 의도된 형태이나 검토자 주의 필요)
  - target 위치: `spec/conventions/conversation-thread.md §8 Rationale`
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12` Rationale (도입 동기·선택지·v1/v2 경계·conversationHistory 제거 사유)
  - 상세: `conversation-thread.md §8`은 "설계 결정의 근거는 AI Agent §12 Rationale 에 단일 인라인"이라고 위임만 선언한다. 이것은 의도된 설계(단일 진실 원칙)이므로 CRITICAL/WARNING 이 아니다. 다만 구현자가 `conversation-thread.md` 만 보다가 Rationale 에 접근하지 않는 실수가 발생할 수 있다. 추가 강조가 있으면 좋다.
  - 제안: §8에 AI Agent §12 직링크를 명시하거나, `conversationHistory` 폐기 및 `contextScope` 대체 결정의 핵심 한 줄 요약만 inline 추가를 고려할 수 있다. 강제 사항은 아님.

- **[INFO]** `spec/5-system/5-expression-language.md §4.4` — `$thread.text` lazy 평가 검토 항이 명시적으로 v2 로드맵에만 있어 v1 성능 주의 사항 미기재
  - target 위치: `spec/5-system/5-expression-language.md §4.4 $thread 속성`
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §7 v2 로드맵` — "`$thread.text` lazy 평가: 현재 `buildExpressionContext` 가 호출마다 전체 thread 를 system_text 로 즉시 렌더 (성능 hot path)..."
  - 상세: `conversation-thread.md`의 v2 로드맵에 `$thread.text` 의 eager 렌더링이 성능 hot path 임이 기록되어 있다. `expression-language.md §4.4` 는 `$thread.text`의 의미(system_text 렌더 결과)만 기술하고 이 주의 사항을 언급하지 않는다. 구현자가 `$thread.text` 를 루프나 고빈도 호출 경로에서 사용할 때 성능 위험을 인지하지 못할 수 있다.
  - 제안: §4.4 `$thread.text` 항에 "주의: `$thread.text` 는 호출마다 전체 thread 를 즉시 렌더하므로 루프·고빈도 경로에서의 남용 자제. 자세한 배경은 [Spec Conversation Thread §7 v2 로드맵](../conventions/conversation-thread.md#7-v2-로드맵)" 노트를 추가한다.

---

## 요약

target 문서 4개 전체에서 기각된 대안의 재도입이나 합의된 invariant 의 직접 위반은 발견되지 않았다. `conversationHistory` / `historyCount` 필드는 target 문서에 존재하지 않으며 `contextScope` / `contextScopeN` 으로 완전 대체되어 있다. install_token 식별 전략도 "단일 row 조회 + 1회 HMAC"으로 올바르게 기술되어 있고, 폐기된 "100건 mall_id 스캔 + trial HMAC" 방식의 재도입은 없다. 다만 `spec/4-nodes/4-integration/4-cafe24.md §9.8`에 2026-05-15 후속 결정으로 도입된 "install_token mismatch 회복 분기"가 미반영되어 있어 WARNING 이다. 이 회복 분기는 `spec/2-navigation/4-integration.md ## Rationale`에는 기록되어 있으나 cafe24 노드 spec 본문에는 반영되지 않아, 구현자가 §9.8 만 보면 회복 경로를 누락할 수 있다. 나머지 2건은 문서 완성도 보완 수준의 INFO이다.

---

## 위험도

LOW
