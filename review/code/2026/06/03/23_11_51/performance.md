# 성능(Performance) Review

## 발견사항

리뷰 대상 변경은 `spec/conventions/conversation-thread.md` 의 YAML frontmatter 한 줄 수정이다:

```diff
-  - plan/in-progress/ai-context-memory-auto.md
+  - plan/in-progress/ai-context-memory-followup-v2.md
```

`pending_plans` 필드의 참조 경로만 교체한 것으로, 실행 가능한 코드가 포함되어 있지 않다. 성능 관점에서 분석할 알고리즘·쿼리·메모리·I/O·자료구조가 존재하지 않는다.

다만 spec 본문에 이미 명시된 성능 관련 설계 결정을 참고로 기록한다 (본 PR 변경과 직접적 관련은 없음):

- **[INFO]** `$thread.text` 즉시 렌더 (§7 v2 로드맵)
  - 위치: `spec/conventions/conversation-thread.md §7` — `$thread.text lazy 평가` 항목
  - 상세: 현재 `buildExpressionContext` 가 호출마다 전체 thread 를 system_text 로 즉시 렌더하는 것이 성능 hot path 로 spec 자체가 인지하고 있으며, lazy getter / 별도 key 로의 분리를 v2 로드맵으로 잡아두고 있다. 본 PR 변경과 무관하나, 구현 단계에서 해당 경로를 건드리는 변경이 있다면 eager render 제거 여부를 확인해야 한다.
  - 제안: 로드맵 항목 유지 확인 정도로 충분. 본 PR 에서 추가 조치 불필요.

- **[INFO]** Background snapshot 복사 전략 (§3.2)
  - 위치: `spec/conventions/conversation-thread.md §3.2`
  - 상세: `scheduleBackgroundBody` 가 `{ ...thread, turns: [...thread.turns] }` shallow copy 를 사용한다. `turns` 배열 크기가 `MAX_STORAGE_TURNS=500` 에 근접하면 매 enqueue 마다 500-element 배열 복사가 발생한다. `ConversationTurn` 자체는 immutable 이므로 deep copy 불필요함은 spec 이 정확히 기술하고 있다. 현재 설계에서 허용 가능한 비용이지만, thread 가 대형화되는 워크플로우에서는 hot path 로 관측될 수 있다.
  - 제안: 본 PR 범위 외. 향후 background enqueue 빈도가 높은 워크플로우 패턴이 추가될 때 profiling 후 판단.

## 요약

이번 변경은 spec 문서의 YAML frontmatter 에서 `pending_plans` 참조 경로를 한 줄 수정한 것으로, 실행 코드 변경이 전혀 없다. 성능 관점에서 평가할 알고리즘 복잡도, 쿼리, 메모리 할당, I/O, 자료구조 선택 등 어떤 문제도 개입되지 않는다. spec 본문에는 `$thread.text` eager render 및 background snapshot shallow copy 에 대한 기존 설계 주석이 있으나, 이들은 본 PR 이 직접 변경하는 내용이 아니므로 참고 수준으로만 기록한다.

## 위험도

NONE
