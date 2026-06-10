# Rationale 연속성 검토 결과

검토 대상: `branch claude/spec-sync-audit-998544` — spec/plan/review 변경 전체 (~60 spec 파일)
검토 기준 Rationale 원본: `spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/*`, `spec/5-system/4-execution-engine.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/17-agent-memory.md`, `spec/conventions/execution-context.md`, `spec/data-flow/1-audit.md` 등

---

## 발견사항

### INFO — agent memory 큐 토폴로지 변경: 기존 Rationale 과의 방향성 정합 확인

- **target 위치**: `spec/5-system/17-agent-memory.md` §3 "큐 분리" 단락 + Rationale 절 "전용 큐 + scope 단위 직렬화 (큐 토폴로지 확정)"
- **과거 결정 출처**: 동일 파일 구 Rationale (main 에서 "큐 토폴로지는 hot path 비차단 invariant를 지키는 한 구현 재량이다. 전용 큐 분리 시 워크스페이스별 동시성 제한 가능")
- **상세**: 구 Rationale 은 큐 토폴로지를 "구현 재량" + "전용 큐 분리 시 워크스페이스별 동시성" 을 예시했다. target 은 전용 큐(`agent-memory-extraction`) + scope 단위 직렬화(워크스페이스 단위가 아닌 scope jobId 고정)로 확정했다. 구 Rationale 의 "워크스페이스별 동시성 제한"은 기각(과잉이라는 사유 명시)됐고, scope 단위 직렬화가 채택됐다. 번복 사유가 새 Rationale 에 명확히 기술됐으므로 CRITICAL이 아니다. 단, 구 Rationale의 "예시"와 실제 채택이 다른 방향임을 새 독자가 모를 수 있어 INFO 로 남긴다.
- **제안**: 현재 수준으로 충분. 워크스페이스별 동시성 제한이 "의도적으로 기각된 대안" 임을 Rationale 내 한 줄로 명시하면 완성도가 높아진다(현재는 "과잉이다" 한 단어로만 처리).

---

### INFO — `execution_node_log` 기록 시점 변경: "진입 로그 → 처리 완료 로그" 의미론 전환

- **target 위치**: `spec/data-flow/3-execution.md` §1.2 "execution_node_log 는 진입 로그가 아니라 처리 완료 로그" 주석
- **과거 결정 출처**: `spec/1-data-model.md` Rationale "Execution.execution_path → ExecutionNodeLog (V035 → V036)" — `UNNEST WITH ORDINALITY` 이행, "노드 실행 순서를 BIGSERIAL id 정렬로 보장"
- **상세**: 구 Rationale 은 `execution_node_log` 를 "노드 진입 순서를 결정적으로 보장"하는 append-only 로그로 정의했다. target 은 이를 "처리 완료 시 기록"으로 변경했고, throw 경로에서는 미기록된다고 명시했다. 이는 "노드 진입"이 아니라 "노드 성공 완료 또는 blocking output" 시점으로 의미가 달라진 것이다. 재시작 후 rehydration 이 이 로그를 "실행된 노드 집합"으로 재생하는 의미론과 일치한다고 target 이 설명하고 있어 이유는 있으나, 구 data-model Rationale 의 "진입-append" 기술과 명시적 연결 고리가 없다.
- **제안**: `spec/1-data-model.md` Rationale "ExecutionNodeLog" 항에 "진입 로그 의미론에서 처리 완료 로그로 변경됐다" 한 문장을 추가하거나, data-flow 문서에서 "data-model Rationale 상 변경" 이라고 교차 참조를 남긴다.

---

### INFO — 리랭크 provider 확장 'Dropped' 처리: 구 'Planned' Rationale 철회

- **target 위치**: `spec/5-system/7-llm-client.md` §2.1 표 (Jina/Voyage/Local/builtin → "Dropped (2026-06-05 결정)") + Rationale 절 마지막 항 "왜 리랭크 provider 확장을 drop 했나"
- **과거 결정 출처**: `spec/5-system/7-llm-client.md` 구 Rationale "왜 LLMClientFactory에 통합하지 않았나" — "jina/voyage 후속 확장" 을 미래 계획으로 명시
- **상세**: 구 Rationale 은 jina/voyage 를 1차 이후 확장 대상으로 예정했다. target 은 이를 "2026-06-05 사용자 결정으로 drop" 했고, 새 Rationale 에 근거를 기술했다. 기각 사유와 근거가 함께 작성돼 있어 형식은 완비됐다. "후속 확장이 저렴" 서술을 남겨둔 채 "종결"로 바꾼 점이 약간의 긴장을 만들지만 모순 수준은 아니다.
- **제안**: Rationale의 "LLMClientFactory 에 통합하지 않았나" 기존 항에서 "jina/voyage 후속" 언급을 제거하거나 "drop 됨 (위 항 참조)" 으로 교체하면 구 표현과 신 결정의 잔존 긴장이 해소된다.

---

### INFO — audit_log "cross-cutting concern" 서술 폐기: Rationale 내 자기 참조 수정

- **target 위치**: `spec/data-flow/1-audit.md` Rationale 절 "모든 도메인 service 가 호출하는 cross-cutting concern 서술 폐기"
- **과거 결정 출처**: 동일 파일 구 Rationale (audit_log 의 호출자를 "각 도메인의 service (Workflows / Triggers / ... 등)" 로 서술)
- **상세**: target 이 구 서술을 명시적으로 "폐기했다"고 적시하며 실제 4개 모듈 9개 call site 전수를 새 SoT 로 제시한다. 이는 올바른 Rationale 갱신 패턴이다. 충돌 없음. 다만 인증 spec §4.1 의 "관리자(Admin+)만 조회" 가 구현에서 미강제임을 target 이 인정하면서도 이를 Rationale 에서 명시적 결정으로 다루지 않고 "구현 갭" 으로만 처리했다.
- **제안**: `spec/5-system/1-auth.md` §4.2 의 "관리자(Admin+)만 조회" 가 구현에서 미강제라는 사실이 의도된 것(v1 보류)인지, spec 버그인지 Rationale 또는 pending_plans 에 명시하면 추후 혼란이 없다.

---

### INFO — `execution_node_log` 재임베딩 이후 rehydration 의미 전제 변경 주석 부재

- **target 위치**: `spec/1-data-model.md` Rationale "Execution.execution_path → ExecutionNodeLog" — 변경 없음
- **과거 결정 출처**: 동일 항: "BIGSERIAL id 가 PostgreSQL sequence(concurrency-safe)로 부여되므로 `(execution_id, id)` 정렬이 곧 노드 실행 순서"
- **상세**: 구 Rationale 은 "id 정렬 = 실행 순서"를 전제로 설계를 정당화했다. 그런데 target(`data-flow/3-execution.md`)에서 throw 경로는 execution_node_log 를 남기지 않는다고 명시됐다. 즉 "실행 시도한 순서"가 아니라 "성공 완료 순서"로 의미가 좁혀졌다. data-model Rationale 은 이를 반영하지 않은 채 남아 있다.
- **제안**: `spec/1-data-model.md` Rationale 해당 항에 "V035 이후 구현에서 log 시점은 처리 완료(COMPLETED 또는 blocking output) 기준으로 좁혀졌다 — throw 경로는 미기록. rehydration 이 이 로그를 '성공 실행된 노드 집합'으로 재생한다(data-flow/3-execution.md §1.2 참조)" 를 한 문장 추가.

---

## 요약

본 브랜치의 변경 (~60 spec 파일)은 전반적으로 Rationale 연속성을 잘 관리하고 있다. 이전 결정을 번복하는 경우(agent memory 큐 토폴로지, 리랭크 provider drop, audit log 서술 정정, install token TTL 삭제→보존 번복 등)에는 대부분 새 Rationale 을 함께 작성했으며, 명시적으로 기각된 대안을 무근거로 재도입한 사례는 발견되지 않았다. 합의된 핵심 invariant(per-node task queue 미채택, execution-level 큐 원칙, Redis 기반 BullMQ, forward-only 마이그레이션, S3 prefix 격리, Inline Alert cross-cutting 위치 등)도 유지됐다. 다만 `execution_node_log` 의 기록 시점 의미론(진입 → 완료)이 data-model Rationale 에 반영되지 않아 잔존 긴장이 있고, audit 관리자 접근 미강제가 명확한 결정으로 기록되지 않은 점이 minor gap 이다. 전체적으로 CRITICAL 또는 WARNING 수준의 Rationale 연속성 위반은 없다.

## 위험도

LOW
