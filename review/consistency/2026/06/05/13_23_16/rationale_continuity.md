# Rationale 연속성 검토 — memory-backlog-a2-fe9c8f

검토 범위: `git diff 7afa9ae0..HEAD` (worktree memory-backlog-a2-fe9c8f)
검토 일자: 2026-06-05
검토자: rationale-continuity sub-agent

---

## 발견사항

### [INFO] embeddingModel widget 'text'→'expression' 변경 — §12.12 와 무관한 단순 일관화

- **target 위치**: `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts` L596, commit `06335914`
- **과거 결정 출처**: 없음 (widget 타입 선택에 대한 명시적 Rationale 기록 없음)
- **상세**:
  - #467 (`4c59fe5b`) 이 `embeddingModel` 을 `widget: 'text'` 로 최초 도입했다. 당시 스키마 기록에 'text' 를 선택한 근거가 Rationale 에 기술되지 않았다.
  - 후속 A3 커밋 (`244adcc3`) 이 `summaryModel`/`extractionModel` 을 `widget: 'expression'` 으로 추가했고, 커밋 메시지에 W4 보류 항목으로 "embeddingModel widget text vs expression, #467 선존" 불일치를 이미 명시했다.
  - 본 diff (`06335914`) 는 그 W4 를 해소한다 — `embeddingModel` 을 같은 Memory 그룹의 `summaryModel`/`extractionModel` 과 동일한 `expression` widget 으로 일관화. 커밋 메시지는 "선존 불일치 해소" 와 이유("expression 변수 사용 가능")를 명시한다.
  - `spec/4-nodes/3-ai/1-ai-agent.md §12` Rationale 어느 항목도 `embeddingModel` 의 widget 타입을 'text' 로 **명시적으로 결정하거나 기각한 기록이 없다**. #467 의 'text' 선택은 그룹 내 다른 모델 필드가 아직 존재하지 않던 시점의 미확정 디폴트였다.
  - §12.12 는 `summaryModel`/`extractionModel` **필드 자체**를 v1 scope-freeze 기각 대안으로 기록했으나, A3 에서 그 결정을 명시 번복(근거 포함)했다. widget 타입은 §12.12 의 기각 범위가 아니다.
- **제안**: 현 변경은 spec Rationale 에 기록된 어떤 결정도 위반하지 않는다. 단, spec에 widget 타입 정책("모델 식별자 입력 필드는 expression widget 사용")을 명시하면 향후 일관성 검사가 쉬워진다. 필수 조치는 아님.

---

### [INFO] listScopes 단일 쿼리화 — 2쿼리 의도의 과거 결정 없음, spec 동반 갱신 정상

- **target 위치**: `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` `listScopes` 함수, commit `f211cf80` + `93d1749d`
- **과거 결정 출처**: `spec/5-system/17-agent-memory.md §6 + Rationale` (단, 쿼리 구현 전략에 대한 명시적 결정 기록 없음)
- **상세**:
  - `spec/5-system/17-agent-memory.md` 의 기존 Rationale 은 스코프 키 설계·pgvector 재사용·watermark·dedup 임계·TTL 만료·추출 분류를 다루며, `listScopes` 의 COUNT 쿼리 구현 방식(별도 서브쿼리 vs. 윈도우 함수 단일 쿼리)에 대한 결정을 기록하지 않았다.
  - 2쿼리 구현이 "의도된 설계 결정"으로 Rationale 에 명문화된 적이 없다 — 최초 구현의 단순 코드 선택일 뿐이다.
  - 변경은 `COUNT(*) OVER()` 윈도우 함수로 집계 패스를 1회로 통합한다. 기능적 동치성(동일 total 의미, workspace_id 격리 유지, ILIKE 필터 유지, embedding 제외 유지)이 코드·테스트·커밋 메시지에서 확인된다.
  - spec `17-agent-memory.md §6` 에 `total` 의 edge-case 동작(offset 초과 시 total=0 보고)이 신규 bullet 로 명시(`93d1749d`)되었으며, 이는 **동작 변경**을 Rationale 본문에 명시한 정상적인 spec 동반 갱신 패턴이다.
  - 합의된 invariant(격리, embedding 제외, pagination 의미) 위반 없음.
- **제안**: 현 변경은 Rationale 연속성 위반이 없다. offset 초과 시 total=0 보고 동작이 UI 정합 가정("UI 는 첫 페이지의 total 범위 안에서만 페이지" — spec §6 신규 bullet 주석)과 일치하는지 UI 쪽에서 별도 확인 권장. 검토 범위가 backend 이므로 이 검토 내에서는 INFO 수준.

---

## 요약

검토 대상 diff 의 두 주요 변경(①`embeddingModel` widget 'text'→'expression', ② `listScopes` 단일 쿼리화 + spec §6 total 동작 명시)은 어느 spec Rationale 의 명시적 결정도 번복하지 않는다. ①은 spec Rationale 에 widget 타입 결정이 기록된 바 없으며 A3 커밋(W4)에서 이미 예고된 일관화이고, ②는 Rationale 에 2쿼리 구현이 결정으로 명문화된 적 없는 구현 선택의 최적화다. spec 동반 갱신도 정상적으로 수행됐다. 기각된 대안 재도입·합의 invariant 위반·무근거 번복은 없다.

## 위험도

NONE

---

BLOCK: NO
