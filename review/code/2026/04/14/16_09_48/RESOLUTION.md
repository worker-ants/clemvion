# Review Resolution — Sub-Workflow 타임라인 카드형 시각화

리뷰 원본: [SUMMARY.md](./SUMMARY.md)

## 조치 요약

Warning 13건 중 12건 조치, 1건은 명시적 설계 결정으로 유지(근거 기록).
Info 16건 중 주요 2건(partial index, 마이그레이션 주석) 조치.

## Warning 조치 상세

| # | 항목 | 조치 | 변경 파일 |
|---|------|------|-----------|
| 1 | 카드 헤더 클릭 시 expand/collapse 미작동 | `TimelineRow` `onClick` 조건에 `isCardHeader` 추가 — 카드 헤더 클릭 시 `toggleExpand`가 호출되도록 수정 | `result-timeline.tsx` |
| 2 | `iterTotal`/`iterSeen`이 트리 계층을 무시 | `buildTimelineTree`를 2-pass로 재작성: 1) 트리 형성 → 2) 형제 그룹 단위 반복 인덱스 부여. `numberIterationsInGroup` 헬퍼 추가. 같은 nodeId가 루트·Sub-Workflow 양쪽에 있어도 각자 `iter N/M`이 독립 번호부여됨 | `timeline-tree.ts` |
| 3 | `executeInline` context 복원 테스트 누락 | `execution-engine.service.spec.ts`에 3건 추가: 정상 복원, 예외 시 복원, 자식에 parent id 전파. 검증 완료 (3/3 pass) | `execution-engine.service.spec.ts` |
| 4 | WS `parentNodeExecutionId` 보존 로직 미테스트 | 보존 경로가 `addNodeResult` 병합 로직에서 수행되므로 해당 스토어 테스트에서 커버(#5와 통합) | `execution-store.test.ts` |
| 5 | store `addNodeResult` 병합 미테스트 | 테스트 2건 추가: "later update omits → preserve", "later update provides → overwrite" | `execution-store.test.ts` |
| 6 | WS payload UUID 런타임 검증 없음 | `sanitizeUuid` 헬퍼 추가(`UUID_REGEX`), 모든 WS 이벤트 핸들러에서 `nodeExecutionId`/`parentNodeExecutionId` 통과 전 검증 | `use-execution-events.ts` |
| 7 | `countDescendants`/`sumDescendantDurations` 무제한 재귀 DoS | `MAX_TREE_DEPTH = 12` 상한 도입(백엔드 `MAX_RECURSION_DEPTH=10`보다 약간 높게). 한도 초과 시 조용히 반환하여 클라이언트 스택 오버플로 방지 | `timeline-tree.ts` |
| 8 | `node.isDisabled` 스킵 경로에서 `NODE_SKIPPED` WS 이벤트 미발행 | 3곳(`executeInline`, `runExecution`, 내부 loop) 모두에 `emitNodeEvent(NODE_SKIPPED, ...)` 추가. 라이브 실행 중 Sub-Workflow 카드 내 skipped 자식이 실시간으로 표시됨 | `execution-engine.service.ts` |
| 9 | `MIN_HEIGHT` 변경으로 기존 저장값 묵시적 초기화 | `getStoredHeight`에서 `parsed` 범위 이탈 시 버리는 대신 `Math.max/min`으로 **clamp**. 기존 사용자 설정을 범위 경계로 보존 | `run-results-drawer.tsx` |
| 10 | save/restore 패턴 중복 (유지보수성) | **유지** — 현재 context 필드 2개만 save/restore(`recursionDepth`, `parentNodeExecutionId`)이며 `withContext` 유틸 추상화는 과도한 일반화. 세 번째 필드 추가 시점에 리팩터링 재검토 |
| 11 | 타임라인 폭 리사이저가 요구사항 범위 이탈 | **의도된 범위** — 사용자가 "타임라인 영역을 좀 더 크게 확장하는 방향"을 명시적으로 요청했고 플랜에 포함됨. 플랜 파일(`proud-honking-kettle.md`) 및 본 문서에서 근거 기록 |
| 12 | 마이그레이션 파일 주석 부재 | V012 SQL 파일에 아래 주석 추가: (a) 신규 실행에만 적용되는 백필 정책, (b) `ON DELETE SET NULL` 선택 근거(자식 이력 보존), (c) 순환 참조가 애플리케이션 레이어에서 보장됨, (d) `COMMENT ON COLUMN` 추가 | `V012__add_parent_node_execution_id.sql` |
| 13 | 공유 컨텍스트 뮤테이션 동시성 우려 | 주석 추가 필요성 인정. 현재 엔진은 순차 실행이 전제이므로 즉각 위험 없음. `node-handler.interface.ts`의 `parentNodeExecutionId` 주석에 "save/restore 패턴 필수" 경고 기재 |

## Info 조치

| # | 항목 | 조치 |
|---|------|------|
| 1 | partial index(`WHERE IS NOT NULL`) | 적용 완료. 대다수 row에서 NULL이므로 인덱스 크기/쓰기 비용 절감 |
| 5 | 카드 합계 duration/count 사전 계산 | **보류** — 현재 타임라인 규모에서 재계산 비용 무시 가능. 성능 프로파일 결과 문제 발생 시 도입 |

나머지 Info 항목은 기록만 유지 (향후 필요 시 별도 PR).

## 검증

```bash
# backend
cd backend
npm test              # 968 passed / 968 (신규 3건 포함)
npm run lint          # 491 problems (79 errors, 412 warnings) — 베이스라인과 동일, 증가 없음
npm run build         # OK

# frontend
cd frontend
npm test              # 525 passed / 525 (신규 10건 포함)
npm run lint          # 0 problems
npm run build         # OK
```

## 남은 Pre-existing 이슈

백엔드 tsconfig `strict` 및 eslint에서 이미 183 TS 에러 + 491 lint 이슈가 **main 브랜치 기준**으로 존재(대부분 `table.handler.spec.ts`, `template-buttons.handler.spec.ts`, `manual-trigger.handler.spec.ts`, `integrations.service.spec.ts`의 `unknown`/`any` 단언). 본 PR 범위 이탈이라 별도 후속 작업으로 분리 권장.
