# Cross-Spec 일관성 검토 — KB WebSocket 이벤트 count drift 정정

- worktree: `/Volumes/project/private/clemvion/.claude/worktrees/kb-ws-event-drift-3f4536`
- base: `2aa4c8093` / HEAD: `31bbd1d3a`
- 대상 커밋: `8c3e95319` (KB 이벤트 count drift 정정), `31bbd1d3a` (ai-review 반영 잔여 spec drift + CHANGELOG + 미러 한계 주석)

## 검증 방법

1. `git diff origin/main..HEAD` 로 실제 변경분(코드 3파일 + spec 4파일 + CHANGELOG) 확인.
2. backend `codebase/backend/src/modules/websocket/websocket.service.ts` 의 `KbEventType` union 리터럴을 직접 열람 — 11종(embedding 6 + graph 5, `graph_error` 없음) 확인.
3. backend 실제 emit 호출부(`grep emitEvent`)를 `graph-extraction.service.ts` / `embedding.service.ts` 에서 열람 — 실제 emit 은 embedding 5종 + graph 5종(둘 다 `_error` 미emit) = union 대비 `embedding_error` 만 dead-declared. spec 서술과 일치.
4. `spec/data-flow/6-knowledge-base.md §2.5` (target 외, 미변경 파일) 을 권위 기록으로 대조 — "총 11개(embedding 6 + graph 5), `document:graph_error` 는 union 에서 제거됨(#443)" 과 target 4개 spec 파일의 수정 내용이 정합.
5. `spec/**` 전수 grep: `graph_error`, `12개`, `12종`, `union (12`, `1:1 대응` — target 이 다루지 않은 다른 spec 파일에 잔존 drift가 있는지 확인. False positive(무관한 "Logic 노드 12종", cafe24 카탈로그 "12개월" 등) 를 제외하면 잔존 drift **없음**.
6. frontend `KB_EVENT_NAMES` / 신규 parity 테스트, `spec/5-system/2-api-convention.md §10.3` (count 비명시라 무관), 다른 소비처(`use-kb-events.ts` 를 import 하는 KB 상세 페이지) 확인 — 전부 11종 기준으로 정합.

## 발견사항

이번 diff 범위(`spec/2-navigation/5-knowledge-base.md`, `spec/5-system/6-websocket-protocol.md §4.3`, `spec/5-system/8-embedding-pipeline.md §8.1/§8.2/Rationale`, `spec/5-system/10-graph-rag.md §6/KB-GR-OB-02`) 와 그 인접 spec(`spec/data-flow/6-knowledge-base.md §2.5`, `spec/5-system/2-api-convention.md §10.3`) 사이에서 CRITICAL/WARNING 급 모순을 발견하지 못했다. 전수 grep 결과 다른 spec 영역에 "12개/12종" 또는 `graph_error` 존재를 주장하는 잔존 서술도 없다.

- **[INFO]** `#443` 참조가 여러 spec 파일에 동일 의미로 산재
  - target 위치: `spec/5-system/8-embedding-pipeline.md` (§8.2, Rationale), `spec/5-system/10-graph-rag.md` (KB-GR-OB-02, §6 각주), `spec/5-system/6-websocket-protocol.md` (§4.3 그래프 이벤트 표 아래), `spec/2-navigation/5-knowledge-base.md` (§2.7.1)
  - 충돌 대상: `spec/data-flow/6-knowledge-base.md §2.5`/Rationale §"폐기·정정된 과거 서술" (이번 diff 범위 밖, 기존 권위 기록)
  - 상세: 모순은 아니며 오히려 5개 파일이 `#443`을 동일한 사실(graph `_error` union 제거 근거)로 일관되게 인용해 정합성이 개선됐다. 다만 `#443` 이 PR 번호인지 이슈 번호인지, 그리고 이 저장소의 다른 spec 관례(`spec/data-flow/**` Rationale 절의 `PR#nnn` 표기 등)와 형식이 통일돼 있는지는 이번 검토 범위 밖 — 향후 PR 번호 링크화 등 문서 편의 개선을 고려할 수 있다는 수준의 참고사항.
  - 제안: 조치 불필요. 원한다면 `#443` 을 GitHub PR 링크로 통일하는 것은 선택적 후속 polish.

- **[INFO]** `document:embedding_error` 의 "declared-but-dead" 서술이 4개 spec + backend JSDoc + frontend 주석 + 테스트에 반복
  - target 위치: `spec/5-system/6-websocket-protocol.md §4.3`, `spec/5-system/8-embedding-pipeline.md §8.1`, `spec/5-system/10-graph-rag.md §6 각주`, `codebase/backend/src/modules/websocket/websocket.service.ts` JSDoc, `codebase/frontend/src/lib/websocket/use-kb-events.ts` 및 테스트
  - 충돌 대상: 없음 (서로 강화)
  - 상세: `embedding_error` 는 union 에 남아있고 frontend 도 구독 유지(11종 count 유지 목적) — 이는 "필드/이벤트가 선언됐지만 미사용" 패턴으로, 다른 spec 영역(RBAC·상태 전이 등)과 직접적 연관은 없다. 다만 이 패턴 자체가 반복 강조되고 있어 향후 실수로 `embedding_error` 를 완전히 제거하는 변경이 있을 경우 5곳 이상을 함께 갱신해야 하는 유지보수 부담이 있다 — spec 품질 이슈이지 cross-spec 모순은 아니다.
  - 제안: 없음. 정보성 기록.

## 요약

target 이 수정한 4개 spec 파일(`2-navigation/5-knowledge-base.md`, `5-system/6-websocket-protocol.md`, `5-system/8-embedding-pipeline.md`, `5-system/10-graph-rag.md`)의 새 서술은 (a) 실제 backend union 정의(11종) 및 실제 emit 호출부(embedding 5 + graph 5, 둘 다 `_error` 미emit)와 정확히 일치하고, (b) 기존 권위 기록인 `spec/data-flow/6-knowledge-base.md §2.5`(이번 diff 로 건드리지 않았지만 이미 11종/#443 제거로 정확히 기술돼 있던 문서)와도 완전히 정합하며, (c) `spec/**` 전수 grep 으로 확인한 결과 다른 영역에 "12개/12종" 또는 `document:graph_error` 존재를 주장하는 잔존 drift 가 없다. `spec/5-system/2-api-convention.md §10.3` 처럼 이벤트 개수를 명시하지 않는 인접 spec 도 이번 정정과 상충하지 않는다. 데이터 모델(`graph_error_message` 컬럼)은 이벤트명과 별개 개념으로 혼동 없이 유지된다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 CRITICAL/WARNING 급 cross-spec 충돌은 발견되지 않았다.

## 위험도

NONE
