# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/17-agent-memory.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-06-06

---

## 발견사항

### [INFO] 비대칭 inputType 배선 — 재임베딩 경로 부재의 Rationale 신규 작성 (정합 확인)
- **target 위치**: `spec/5-system/17-agent-memory.md §4 회수` 내 "비대칭 입력(inputType)" 블록, §Rationale "일괄 재임베딩 경로 부재 — TTL/dedup UPDATE 로 자연 대체"
- **과거 결정 출처**: `spec/5-system/8-embedding-pipeline.md §Rationale "결정: 비대칭 입력(inputType / prefix) 배선"` — "재임베딩 정합성: 도입 이전 색인 데이터는 비대칭이 깨질 수 있어 e5/Gemini KB 는 재임베딩(§7.3)이 필요하다. 자동 트리거 대신 ... 수동 재임베딩 플로우로 안내한다(비용 통제)."
- **상세**: KB 의 비대칭 inputType 도입 Rationale 에서 재임베딩의 필요성과 수동 플로우 채택이 결정되었다. target 은 agent_memory 에 이 재임베딩 경로가 존재하지 않음을 설명하고, "TTL/dedup UPDATE 자연 대체" 라는 별도 근거를 Rationale 에 명시 작성했다. KB 결정을 번복하는 것이 아니라, KB 와 agent_memory 의 성질 차이(휘발성 evict 대상 vs 영속 문서)를 근거로 한 영역-국소적 결정이며 Rationale 이 함께 제공되어 있다. 연속성 측면에서 번복보다는 "영역 분화 결정" 에 가까워 충돌은 없다.
- **제안**: 현재 상태 이상 조치 불필요. 단, target Rationale 에 "KB §Rationale 의 재임베딩 필요 판단은 영속 문서에 적용되는 원칙이며, agent_memory 는 성질 상이로 명시 분리 결정" 이라는 한 줄 cross-reference 를 추가하면 미래 독자의 충돌 오해를 더 줄일 수 있다.

---

### [INFO] pgvector 재사용 — KB 와 분리된 별도 테이블 Rationale 정합 확인
- **target 위치**: `spec/5-system/17-agent-memory.md §Rationale "pgvector 재사용 vs 별도 벡터DB 기각"`
- **과거 결정 출처**: `spec/0-overview.md §Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` 에서 "운영 표면·장애 지점·일관성 경계가 2배가 된다" 는 의존성 추가 비용 원칙 및 `spec/5-system/8-embedding-pipeline.md §Rationale` 의 pgvector partial HNSW 인덱스 운용 결정.
- **상세**: target 이 pgvector 재사용 + 별도 테이블 분리를 택하는 이유는 기존 Rationale 의 "인프라 재사용, 운영 복잡도 최소화" 원칙과 완전히 정합한다. 특히 KB 와 동일 테이블에 두지 않는 이유("회수 대상·생명주기·forgetting 정책이 다름")도 명시되어 있어 기존 Rationale 에 반하지 않는다.
- **제안**: 추가 조치 불필요.

---

### [INFO] 스코프 키 `memoryKey ?? execution_id` — 안전 디폴트 원칙 정합 확인
- **target 위치**: `spec/5-system/17-agent-memory.md §2 스코프 키`, §Rationale "스코프 키 설계"
- **과거 결정 출처**: 기존 Rationale 에서 명시적으로 기각된 "caller-supplied user_id 직접 강제" 대신 표현식 필드로 유연하게 노출하는 결정.
- **상세**: target Rationale 에서 Mem0/Zep 패턴(caller-supplied user_id)을 그대로 채택하지 않고 표현식 필드(`memoryKey`)로 빌더가 주입하거나, 미설정 시 `execution_id` 로 세션 격리 안전 디폴트를 채택했음을 명확히 설명한다. 과거 결정과 연속성 있고 대안 기각 근거도 명시되어 있다.
- **제안**: 추가 조치 불필요.

---

### [INFO] 메모리 삭제 — hard delete + forgetting과의 동형 정합 확인
- **target 위치**: `spec/5-system/17-agent-memory.md §6 메모리 관리 API — "hard delete"`
- **과거 결정 출처**: `spec/2-navigation/16-agent-memory.md §Rationale` — "삭제는 비가역(hard delete, §6)이므로 통합/지식저장소 삭제와 동일하게 editor 이상으로 제한한다"
- **상세**: target 본문과 UI 스펙 Rationale 이 hard delete 결정을 공유하고 있으며, "KB 문서와 달리 복구를 보장하지 않는다" 이유도 대응된다. 일관 확인.
- **제안**: 추가 조치 불필요.

---

## 요약

`spec/5-system/17-agent-memory.md` 는 기존 spec Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 설계를 포함하지 않는다. 가장 유의할 지점은 KB 의 "비대칭 inputType 도입 후 재임베딩 필요" 결정과의 표면적 충돌이나, target 은 agent_memory 의 휘발성·자가갱신 특성을 근거로 재임베딩 경로 부재를 영역-국소적으로 결정하고 Rationale 에 명시했다. 이는 KB 결정의 번복이 아니라 적용 영역 분화이며, 새 Rationale 이 동반되어 있어 연속성 원칙을 충족한다. pgvector 재사용, 스코프 키 안전 디폴트, hard delete 정책은 모두 기존 Rationale 원칙과 정합한다.

## 위험도

NONE
