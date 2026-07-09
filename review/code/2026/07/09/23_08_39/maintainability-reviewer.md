# 유지보수성 리뷰 — conversation_thread 공개 표면 secret 마스킹 (HEAD 748d3813d)

리뷰 대상: `git show HEAD` (commit `748d3813d86e9b731b343a3952f7f2adf8172229`)

## 발견사항

- **[WARNING]** `cloneThread` JSDoc 의 "WS emit" 예시가 이번 커밋으로 stale 해졌다 — 향후 신규 public emit 이 잘못된 helper 를 재사용할 드리프트 유인
  - 위치: `codebase/backend/src/shared/conversation-thread/thread-renderer.ts:7-14` (`cloneThread` JSDoc)
  - 상세: `cloneThread` 의 JSDoc 은 여전히 "so the caller can pass the result outside the mutation boundary (Background dispatch, **WS emit**)" 라고 적혀 있다. 하지만 이번 커밋으로 conversationThread 를 실어보내는 WS/SSE emit 4곳(`ai-turn-orchestrator.service.ts` 2곳, `button-interaction.service.ts`, `form-interaction.service.ts`) 전부가 `cloneThread` → `redactThreadForPublic` 로 교체됐다. `grep`으로 확인한 결과 현재 `cloneThread` 의 남은 호출처는 `execution-engine.service.ts` 의 Background job 스냅샷(6514행)과 durable park DB commit(7574행) 두 곳뿐이며 **둘 다 WS emit 이 아니다**. 즉 JSDoc 의 "WS emit" 예시는 지금 시점에 실제로 매칭되는 호출처가 하나도 없는 죽은 예시이면서, 동시에 "이 함수를 WS emit 에 써도 된다"는 잘못된 신호를 준다. `redactThreadForPublic` 쪽 JSDoc 은 `cloneThread` 를 언급(copy-on-change 전략 비교)하지만 반대 방향 교차 참조가 없어 비대칭이다. 이 파일을 처음 보는 개발자가 새 conversationThread 공개 emit 을 추가할 때 IDE 자동완성으로 먼저 눈에 띄는 `cloneThread` 를 예시 그대로 따라 쓰면, 이번 PR 이 막으려던 secret leak 이 조용히 재발한다 — 이번 PR 이 정확히 방지하려는 실패 모드가 문서 레벨에서 재도입될 수 있는 경로다.
  - 제안: `cloneThread` JSDoc 에서 "WS emit" 예시를 제거하거나, "public 표면(EIA REST/SSE)으로 나가는 경우 `redactThreadForPublic` 을 대신 사용" 한 줄만 추가해 대칭 교차 참조를 만든다. 스코프가 작아 이번 커밋에 바로 반영 가능한 수준.

- **[WARNING]** `redactThreadForPublic` 이 "every text-bearing field" 를 마스킹한다고 문서화하지만, 실제로는 `ConversationTurn.data` / `presentations[].payload` 를 빠뜨린다
  - 위치: `codebase/backend/src/shared/conversation-thread/thread-renderer.ts:20-66` (`redactThreadForPublic`/`redactTurnForPublic` JSDoc·구현) — 참조: `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts:138`(`data?: Record<string, unknown>`), `:154`(`presentations?: PresentationPayload[]`), `:91`(`payload: Record<string, unknown>`)
  - 상세: 함수 JSDoc 은 "masks secret-shaped tokens ... in every text-bearing field" 라고 명시하지만, 구현은 `text` / `toolCalls[].arguments` / `runningSummary` 세 필드만 처리한다. `ConversationTurn.data`(`output.interaction.data` snapshot 원본)와 `presentations[].payload`(`render_*` tool 결과, 임의 `Record<string, unknown>`) 는 `redactTurnForPublic` 이 `{ ...turn, text, ... }` 로 spread 하며 원본 그대로 통과시키는데, 이 두 필드 역시 REST/SSE 공개 wire 로 그대로 나간다 — `toolCalls[].arguments` 를 굳이 redact 대상에 포함시킨 근거("Raw JSON-string tool arguments ride the same public wire; mask them too")가 구조적으로 동일하게 적용되는 후보인데도 스코프에서 빠졌다. 커밋 메시지 자체는 스코프를 정확히 "turns[].text · toolCalls[].arguments · runningSummary" 로 명시해 구현과 일치하지만, 소스 내 함수 JSDoc 의 "every text-bearing field" 문구는 이보다 넓게 과장돼 있다. 향후 유지보수자가 이 JSDoc 만 보고 "이미 다 마스킹된다"고 오판해 `data`/`presentations.payload` 경로의 secret 유출 가능성을 재검토 없이 지나칠 위험이 있다 — 문서와 구현의 스코프 불일치가 곧 드리프트 지점이다.
  - 제안: 최소 스코프 — (a) JSDoc 문구를 실제 처리 필드 3개로 정확히 좁히거나, (b) spec §R17 의 "outputData/nodeOutput 키-allowlist 는 별개 잔여 항목" 서술 옆에 `data`/`presentations.payload` 도 잔여 커버리지 항목으로 명시해 추적되게 한다. 지금 이 PR 안에서 두 필드까지 redact 확장하라는 요구는 아님(스코프 비례) — 문서 정합화 또는 잔여 항목 명시 정도로 충분.

- **[INFO]** `redactTurnForPublic` 의 `toolCalls` 변경 감지가 배열을 두 번 순회 (`map` 후 `some`)
  - 위치: `codebase/backend/src/shared/conversation-thread/thread-renderer.ts:54-66`
  - 상세: `toolCalls` 새 배열을 `.map()` 으로 만든 뒤, 그 결과가 원본과 참조 다른지 확인하려 다시 `.some((tc, i) => tc !== turn.toolCalls?.[i])` 로 순회한다. turn 당 toolCalls 개수가 적어 실질 비용은 무시할 만하고 로직 자체는 정확하며 테스트로 고정돼 있다(변경 없을 때 원본 turn 참조 반환 검증). 다만 "새 배열 생성"과 "변경 여부 판정"을 단일 loop(예: for 문 + boolean 누적)로 합치면 의도가 좀 더 직접적으로 드러난다.
  - 제안: 필수 아님 — 현재도 가독성·정확성 문제 없어 참고용으로만 기록.

## 정합성 확인 (문제 없음 — 참고)

- `redactSecrets` 는 기존 `SECRET_LEAK_PATTERNS` SoT(`shared/utils/sanitize-error-message.ts`)를 그대로 재사용하고 새 패턴을 만들지 않는다 — 프로젝트 관례(신규 마스킹 구현 금지, SoT 재사용)에 정확히 부합.
- `redactTurnForPublic` 의 copy-on-change 전략(변경 없는 turn 은 원본 참조 반환)은 `applyCap` 의 truncation 전략과 동일 패턴이며, `ConversationTurn` "immutable post-push" 불변식(§3.2)과도 부합 — 새 관례를 만들지 않고 기존 스타일을 그대로 따른다. 테스트(`thread-renderer.spec.ts`)가 "unchanged turns returned by reference"를 명시적으로 검증해 향후 회귀를 잠근다.
- `redactThreadForPublic`/`redactSecrets` 네이밍은 목적이 명확하고 기존 `cloneThread`/`applyCap` 과 동일한 verb-noun 컨벤션을 따른다. `thread-renderer.ts` 배치도 ConversationThread 변환 유틸(`cloneThread`, `applyCap`)과 동일 파일이라 응집도가 높다.
- egress-only 설계(내부 LLM 주입/durable park/Background 는 faithful 유지) 판단 근거가 JSDoc 에 "왜"까지 설명돼 있어(보수적 `Bearer\s+\S+` 패턴의 prose false-positive 가 LLM 컨텍스트를 조용히 손상시킬 수 있다는 근거) 가독성이 좋다.
- 4개 emit 콜사이트(`ai-turn-orchestrator.service.ts` ×2, `button-interaction.service.ts`, `form-interaction.service.ts`) + `interaction.service.ts` REST 경로 모두 동일한 한 줄 인라인 주석 스타일(EIA §R17 / conversation-thread §8.4 교차 참조)로 일관되게 갱신됐다 — 콜사이트 그렙만으로도 "이 필드는 redact 되어 나간다"는 사실을 바로 확인 가능해, 향후 grep 기반 발견성은 준수한 편이다(다만 위 WARNING 1번의 문서 비대칭은 그 발견성을 부분적으로 상쇄).

## 요약

핵심 신규 코드(`redactThreadForPublic`/`redactSecrets`)는 짧고 단일 책임이며, 기존 `cloneThread`/`applyCap` 의 스타일·copy-on-change 관례·주석 톤을 그대로 계승해 코드베이스 정합성이 높다. 다만 두 가지 문서-구현 정합성 갭이 실질적인 유지보수 리스크다: (1) `cloneThread` JSDoc 이 이번 리팩터로 죽은 "WS emit" 예시를 그대로 남겨 향후 신규 public emit 추가 시 잘못된 helper 를 고를 유인을 제공하고, (2) `redactThreadForPublic` 의 "every text-bearing field" 문구가 실제로 처리하지 않는 `data`/`presentations.payload` 필드까지 커버한다고 과장해, "이미 다 마스킹됐다"는 잘못된 안도감을 줄 수 있다. 두 건 모두 코드 자체의 결함이 아니라 주석/문서가 실제 스코프를 정확히 반영하지 못해 생기는 드리프트 지점이며, 수정 범위는 한두 줄 문서 교정으로 충분하다.

## 위험도

MEDIUM
