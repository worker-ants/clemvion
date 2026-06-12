### 발견사항

- **[INFO]** `spec/4-nodes/0-overview.md` §5 실행 격리 행 — `memoryLimit: 128` 하드코드 표기 잔존
  - target 위치: `spec/4-nodes/5-data/2-code.md §7.2` — 메모리 한도가 env 조정 가능(`CODE_NODE_MEMORY_LIMIT_MB`, 안전 상한 512MB)임을 명시
  - 충돌 대상: `spec/4-nodes/0-overview.md` 라인 298 — "isolated-vm(V8 Isolate, `memoryLimit: 128`)" 표기
  - 상세: overview §5 의 "실행 격리" 셀에서 `memoryLimit: 128` 이 변경 불가 상수처럼 보인다. 그 바로 아래 "메모리 제한" 행(라인 301)은 이미 env 조정 가능성을 올바르게 기술하고 있으므로 정책 기술 자체는 최신 상태다. 그러나 격리 행의 `memoryLimit: 128` 표기는 독자에게 128 이 고정값이라는 인상을 줄 수 있어 명명 비일관성이 존재한다.
  - 제안: `spec/4-nodes/0-overview.md` 라인 298 의 `memoryLimit: 128` 을 `memoryLimit: <env>` 또는 `memoryLimit: default 128` 처럼 기본값 표기로 갱신, 혹은 "기본 128MB" 주석을 추가해 라인 301 과 표현을 일치시킨다.

- **[INFO]** `spec/4-nodes/0-overview.md` §5 실행 격리 행 — dayjs 힙 스냅샷 최적화 미반영
  - target 위치: `spec/4-nodes/5-data/2-code.md §7.1` — per-exec dayjs 재컴파일 대신 `ivm.Isolate.createSnapshot()` 으로 힙 스냅샷 최적화를 명시
  - 충돌 대상: `spec/4-nodes/0-overview.md` §5 — 스냅샷 최적화에 대한 언급 없음
  - 상세: 모순이 아니라 누락이다. overview §5 는 격리 메커니즘만 요약하며 스냅샷은 구현 최적화 세부사항이므로 비필수적. 그러나 `2-code.md §7.1` Rationale 에 "격리·보안·출력 계약은 불변"임을 명시했으므로 overview 표기와 충돌은 없다.
  - 제안: 필요 시 overview §5 에 "dayjs 힙 스냅샷 최적화(`createSnapshot`) 적용 — 세부: `5-data/2-code.md §7.1`" 참조 주석을 추가해 검색 편의를 높인다. 강제 동기화 대상은 아님.

### 요약

`spec/4-nodes/5-data/` target 전체(0-common.md / 1-transform.md / 2-code.md)를 다른 spec 영역과 비교한 결과, CRITICAL 또는 WARNING 수준의 직접 모순은 발견되지 않았다. 데이터 모델(5필드 invariant, `output.error` 봉투, `config` echo 정책)은 `conventions/node-output.md` Principle 0·2·3·7·8 과 일치한다. 에러 코드(`CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` 및 legacy 정규화 매핑)는 `conventions/error-codes.md §4`, `5-system/3-error-handling.md §1.4`, `conventions/chat-channel-adapter.md §3.1` 과 모두 정합한다. 메모리 env 조정(`CODE_NODE_MEMORY_LIMIT_MB`, 기본 128, 상한 512) 변경은 `4-nodes/0-overview.md §5` 메모리 제한 행에도 이미 반영돼 있다. 유일한 잔존 비일관성은 overview §5 격리 행에서 `memoryLimit: 128` 이 고정처럼 보이는 서술 방식(INFO 등급)이며 정책 충돌은 없다.

### 위험도

LOW

STATUS: SUCCESS
