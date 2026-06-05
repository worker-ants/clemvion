### 발견사항

- **[INFO]** 변경 파일 26개 전부 Markdown spec·review 문서임 — 실행 코드 없음
  - 위치: 파일 1~26 전체
  - 상세: 변경된 파일은 `spec/**/*.md`, `review/**/*.md` 로만 구성된다. 새 DB 컬럼(`Execution.conversation_thread`, `active_running_ms`) 도입·env var(`EXECUTION_MAX_ACTIVE_RUNNING_MS`) 신설·새 BullMQ 큐(`execution-run`) 등재가 서술되지만 이는 모두 spec 기록이지 코드 변경이 아니다. 부작용 관점에서 점검해야 할 전역 변수 수정, 파일시스템 쓰기, 네트워크 호출, 런타임 상태 변경은 이 diff 에 존재하지 않는다.

- **[INFO]** spec 앵커 참조 변경 — `#2161-rerankconfig-planned` → `#2161-rerankconfig`
  - 위치: `spec/2-navigation/5-knowledge-base.md`, `spec/2-navigation/6-config.md`, `spec/5-system/7-llm-client.md`
  - 상세: `1-data-model.md §2.16.1` heading 의 `(Planned)` 를 유지한 채 참조 링크의 앵커만 단축(`-planned` 제거). diff 에서 `1-data-model.md` heading 자체는 변경되지 않았으므로 heading 이 여전히 `(Planned)` 를 포함하면 링크가 끊길 수 있다. 단 이는 문서 네비게이션 문제이며 런타임 부작용이 아니다.
  - 제안: `spec/1-data-model.md §2.16.1` heading 에 `(Planned)` 가 남아있는지 확인하고 앵커를 통일한다.

- **[INFO]** 섹션 번호 이동 — `spec/5-system/17-agent-memory.md §6(v2 로드맵)` → `§7`
  - 위치: `spec/5-system/17-agent-memory.md`
  - 상세: 신규 `## 6. 메모리 관리 API` 삽입으로 기존 `## 6. v2 로드맵` 이 `## 7` 로 이동했다. 외부 문서에서 `§6` 을 v2 로드맵으로 참조하는 경우 의미가 달라지나 runtime 부작용 없음.

- **[INFO]** `spec/conventions/conversation-thread.md §9` 헤딩 이동 (§8.4 신설로 밀림)
  - 위치: `spec/conventions/conversation-thread.md`
  - 상세: `## 9. 미리보기 UI 렌더 규칙` 앞에 `### 8.4` 가 삽입되어 헤딩 depth 가 `###` → `##` 로 역전된다. 앵커 참조 자체는 유지되나 목차 레벨 불일치가 생긴다. 런타임 부작용 없음.

---

### 요약

이번 변경은 spec 문서 정합화·갱신에 해당하며, 부작용 관점의 8개 점검 항목(상태 변경, 전역 변수, 파일시스템, 시그니처, 인터페이스, 환경 변수, 네트워크, 이벤트) 중 어느 것도 해당되지 않는다. 변경된 26개 파일은 전부 Markdown 문서로, 실행 코드를 포함하지 않는다. 식별된 사항은 모두 문서 앵커·섹션 번호 정합 관련 INFO 수준이며 런타임 동작에 영향을 주지 않는다.

---

### 위험도

NONE
