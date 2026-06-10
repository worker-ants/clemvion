# 문서화(Documentation) Review

대상: perf 백로그 01 (성능 리팩터) — 23 파일. 백엔드 S3 배치삭제·dashboard 집계쿼리·execution-engine rehydration 배치·env read-once 캐시·노드 카탈로그 캐시·workflow import 배치 insert, 프론트 execution-store 정렬 accessor 전환.

### 발견사항

- **[INFO]** spec `4-file-storage.md` 의 KB 삭제 S3 정리 서술이 단건 for 루프 기준으로 stale — 단, 이미 추적됨
  - 위치: `spec/data-flow/4-file-storage.md:102-103` ("`s3Service.delete(doc.fileUrl)` 를 for 루프로 호출하여 수행한다")
  - 상세: 구현(`knowledge-base.service.ts` `remove`)이 `deleteMany` 배치 1회로 바뀌어 본문 서술과 어긋난다. 그러나 `plan/in-progress/spec-update-perf-backlog-01.md §1` 이 정확히 이 라인을 대상으로 draft 화하고 project-planner 트랙으로 위임했다. line 47(흐름표 "문서 삭제" 행)은 단건 document 삭제 경로로 PR 변경 대상이 아니므로 정확하게 유지됨 — draft 의 스코프 판단이 옳다.
  - 제안: 추가 조치 불요. project-planner 가 draft 를 반영하면 종결. (developer 는 `spec/` read-only 규약이라 본 PR 에서 직접 수정 불가.)

- **[INFO]** spec `4-execution-engine.md §1.6` 의 `MAX_NODE_ITERATIONS`/`PARALLEL_ENGINE` 에 read-once 문구 부재 — 단, 이미 추적됨
  - 위치: `spec/5-system/4-execution-engine.md:206` (`MAX_NODE_ITERATIONS` 행, read-once 문구 없음)
  - 상세: 구현이 lazy read-once 캐시(`resolveMaxNodeIterations`/`resolveParallelEngineFlag`)로 바뀌어 "모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영" 규약이 적용됐는데, §1.6 표에는 이 문구가 없다(같은 파일 :1168-1169 의 자매 env 들에는 이미 존재해 비대칭). `spec-update-perf-backlog-01.md §2` 가 이 갭을 정확히 draft 화했다. 코드 주석(`execution-engine.service.ts` perf #14 블록)도 자매 env 규약을 명시적으로 참조해 일치한다.
  - 제안: 추가 조치 불요. project-planner 트랙에서 종결.

- **[INFO]** 신규 공개 함수/메서드의 독스트링 품질 양호 — 확인 결과 누락 없음
  - 위치: `s3.service.ts` `deleteMany`, `execution-store.ts` `selectSortedNodeResults`·`findNodeResult`·`NodeResult.startedAtEpoch`·인덱스 Map 3종, `system-prompt.ts` `renderNodeCatalogCached`·`resetNodeCatalogCacheForTesting`
  - 상세: 신규 공개 표면 전부에 JSDoc 이 달려 있고, 의미론(멱등 의미론, NaN sink, WeakMap memo, 인덱스 Map 무효화 조건, best-effort/warn 동등성)·테스트 전용 진입점 경고·"display 금지(AGENTS.md 참조)" 같은 오용 방지까지 서술돼 있다. `findNodeResult` 가 use-execution-events.ts 4개 `.find()` 사이트의 술어를 SoT 로 명시한 점, truthiness vs `!== undefined` 의 의도적 선택을 주석화한 점이 특히 양호.
  - 제안: 없음.

- **[INFO]** 변경된 로직 주변 기존 주석이 코드와 함께 정확히 갱신됨 (stale 주석 없음)
  - 위치: `use-execution-events.ts:330·713`, `execution-store.test.ts:246 부근`, `use-execution-events.test.ts`
  - 상세: `sortByStartedAt` → `selectSortedNodeResults` 리네이밍이 코드뿐 아니라 이를 언급하던 한글 주석/테스트 주석까지 모두 추적 갱신됐다. `dashboard.service.ts` 의 분모 의미론 주석(spec §3·§7 참조)도 집계쿼리 전환 후 의미 보존을 명시. `assertNoContainerCycle` 의 시그니처 변경(perf #5)에 맞춰 호출부 주석과 에러 우선순위 불변 설명도 정합.
  - 제안: 없음.

- **[INFO]** 복잡 로직의 인라인 주석·근거 서술 충실
  - 위치: `workflows.service.ts:267 부근` (`manager.insert` 가 @BeforeInsert hook·cascade 건너뜀 + "향후 hook 추가 시 배열 save 로 되돌릴 것" + 2026-06-10 확인 일자), `execution-engine.service.ts:1330 부근` (V034 인덱스가 batch 정렬 의미론을 커버한다는 근거), `execution-store.ts:521 부근` (stale 인덱스 방어 fallback 설명)
  - 상세: 비자명한 트레이드오프와 향후 회귀 조건이 코드 옆에 명문화돼 유지보수 안전성이 높다.
  - 제안: 없음.

- **[INFO]** plan 추적 문서 갱신 적절
  - 위치: `plan/in-progress/refactor/01-performance.md`, `plan/in-progress/spec-update-perf-backlog-01.md`
  - 상세: #11/#12/#15 종결 근거(wontfix·비동등 판정)와 검증 기록이 남았고, spec 동반 갱신 2건을 별도 draft 로 분리해 owner(developer draft → planner 적용)·체크리스트까지 명시. MEMORY 의 "plan must include spec updates" 규약(외부 위임 한 줄 묶기 금지)을 충족한다.
  - 제안: 없음.

### 요약
순수 성능 리팩터로 사용자 가시 API/엔드포인트·환경변수 신규 추가가 없어 README·CHANGELOG·API 문서 변경 필요성은 없다. 신규 공개 표면(S3 `deleteMany`, store accessor/index Map, 카탈로그 캐시)은 모두 충실한 JSDoc 을 갖췄고, 리네이밍·시그니처 변경에 따른 기존 주석 stale 도 발견되지 않았다. 코드와 어긋나는 spec 문구 2건(file-storage S3 정리 서술, execution-engine env read-once 문구)이 존재하나 둘 다 `spec-update-perf-backlog-01.md` draft 로 정확히 스코프·추적돼 project-planner 트랙에 위임됐으며, developer 의 `spec/` read-only 규약상 본 PR 에서 직접 수정할 수 없는 항목이다. 문서화 관점의 미해결 결함은 없다.

### 위험도
LOW
