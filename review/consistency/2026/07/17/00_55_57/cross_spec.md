# Cross-Spec 일관성 검토 — D1(⑦ Cafe24 D-2 에러 격리 명문화) + D2(⑧ merge-p2-async-fanin ADR 마감)

## 검토 방법
target draft 는 이미 워크트리 인덱스에 staged 상태(`spec/2-navigation/4-integration.md`, `spec/4-nodes/1-logic/11-merge.md`, `plan/complete/merge-p2-async-fanin.md`(rename), `plan/complete/eia-distributed-seq-counter.md`, `plan/in-progress/cafe24-backlog-residual.md`)로 존재해, 실제 diff 를 `git diff --cached` 로 확인하고 이를 나머지 `spec/**` 실체(§10.5/§11.1/§11.2 of `4-integration.md`, `data-flow/5-integration.md §1.4/§2.2`, `5-system/4-execution-engine.md §4/§Rationale`, `4-nodes/1-logic/{9-foreach,10-parallel,12-background}.md`, `4-nodes/_product-overview.md` ND-MG-*, `0-overview.md`)와 실제 코드(`cafe24-token-refresh.processor.ts` 본문 + `.spec.ts` TEST-C2, `integration-expiry-scanner.service.ts` attempts 값)에 대조했다.

## 발견사항

- **[INFO]** `attempts:1`(D1, `cafe24-token-refresh` worker) vs `attempts:3`(§11.1, 4개 독립 스캐너 job) 병존 서술의 중복 소스화
  - target 위치: `spec/2-navigation/4-integration.md` §10.5 신설 문단 (L943)
  - 충돌 대상: 같은 문서 §11.1 note(L951) 및 `spec/data-flow/5-integration.md` §2.2(L349), §1.4(L327)
  - 상세: 실제 모순은 없음 — 두 값(`attempts:1` vs `attempts:3`)은 서로 다른 큐(`cafe24-token-refresh` worker vs `connected-expiry`/`pending-install-ttl`/`usage-log-prune`/`cafe24-background-refresh` 4개 스캐너)에 대응하며, §11.1 note 가 이미 "실제 갱신은 `cafe24-token-refresh` 큐의 worker — §10.5 참조" 로 명시적으로 분리해 두어 혼동 소지가 낮다. 다만 "re-throw / `.catch(logger.error)` 미사용 / 삭제된 통합 silent no-op" 상세는 이번에 `4-integration.md` §10.5 에 처음 기술되는데, 같은 worker 의 `attempts:1` 값·source 별 dedup 전략은 이미 `data-flow/5-integration.md §2.2` 스키마 매핑 행에 기술돼 있어 같은 worker 의 동작 상세가 두 문서(navigation spec / data-flow)에 나뉘어 존재하게 된다. 코드가 SoT 이고 두 문서 모두 코드와 일치(실측 확인)하므로 당장 모순은 아니지만, 향후 한쪽만 갱신되면 drift 위험이 있다.
  - 제안: 별도 fix 불요. 후속 편집 시 `data-flow/5-integration.md §2.2` 에도 re-throw invariant 한 줄을 상호 참조로 추가하거나, 두 문서 중 한쪽이 canonical 임을 명시하는 것을 권장(비차단).

- **[INFO]** `R-adr-*` Rationale 앵커 접두사는 신규 패턴이나 기존 선례(`R-wontdo-*`, `R-CCA-*`)와 계열이 같음
  - target 위치: `spec/4-nodes/1-logic/11-merge.md` §Rationale `### R-adr-async-fanin`
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md`(`R-wontdo-rawws-rest`), `spec/5-system/11-mcp-client.md`(`R-wontdo-cached-capabilities`), `spec/conventions/chat-channel-adapter.md`(`R-CCA-N`), `spec/conventions/spec-impl-evidence.md`/`user-guide-evidence.md`(순수 `R-N`)
  - 상세: repo 전체에 Rationale 앵커 명명을 강제하는 단일 규약 문서는 없다 — 순수 순번(`R-N`), 도메인 접두 순번(`R-CCA-N`), 의미 slug(`R-wontdo-<slug>`) 세 계열이 공존한다. `R-adr-async-fanin` 은 의미 slug 계열이라 `R-wontdo-*` 와 같은 스타일이며 실제 충돌(동일 ID 재사용 등)은 없음(grep 확인 — 다른 문서에서 미사용). 다만 "won't-do"(비채택 확정)와 "P3 로 격하 + 재검토 트리거 有"(조건부 defer) 는 의미가 달라 `R-wontdo-*` 를 그대로 쓰지 않고 `R-adr-*` 를 새로 만든 판단 자체는 합리적.
  - 제안: 차단 아님. 향후 3번째 이상 유사 케이스가 나오면 `spec/conventions/` 에 "Rationale 앵커 명명 규칙"을 성문화하는 것을 고려.

## 검토 요청 관점별 결론

1. **cross-spec (attempts 혼동/data-flow 충돌 여부)**: 충돌 없음. `attempts:1`(cafe24-token-refresh worker)과 `attempts:3`(4개 스캐너 job)은 서로 다른 큐/책임이며 §11.1 이 이미 "worker 는 §10.5 참조"로 분리 서술. `data-flow/5-integration.md §1.4` "격리 정책"은 4개 스캐너 job 전용 서술이라 D1 의 worker 서술과 도메인이 겹치지 않는다(위 INFO 항목 참고).
2. **rationale continuity**: 번복 아님. `merge-p2-async-fanin.md` 자체의 "결정 히스토리" 절이 "logic-node-followups D3(흡수) → 조사 결과 분리"를 이미 기록하고 있고, 본 ADR 은 그 분리 plan 의 수용 기준 두 번째 분기("PoC 결과 비현실적 → ADR 로 마감 + P3 격하")를 그대로 실행한 것. `spec/5-system/4-execution-engine.md §4/§Rationale "per-node → execution-level intake 큐"`(2026-06-04 결정, 실측 확인)가 draft 의 핵심 근거이며 실제로 "per-node task queue 채택하지 않는다"고 명문화돼 있어 draft 의 인용이 정확하다. D1 의 defer 재개도 번복이 아니라 defer 전제(OTel NF-OB-02/03/07)가 실제로 충족됐음을 코드(`instrumentation.ts`, `business-metrics.service.ts`)로 확인.
3. **convention compliance**: `11-merge.md` 의 `## Rationale` 신설은 형제 문서(`9-foreach.md`, `10-parallel.md`, `12-background.md`)가 이미 가진 패턴과 동형이라 정합. `R-adr-*` 명명은 위 INFO 참고 — 규약 위반 아님.
4. **plan coherence**: `execution-engine-residual-gaps.md`, `node-output-redesign/**` grep 결과 `merge-p2-async-fanin` 참조 없음 — 다른 in-progress plan 과의 충돌 없음. `eia-distributed-seq-counter.md` 의 의존성 절 갱신은 dead link 를 만들지 않음(`plan/complete/merge-p2-async-fanin.md` 경로 실존). `cafe24-backlog-residual.md` 잔여 항목(A-3 follow-up, G-4)은 D-2 와 무관한 독립 항목으로 실측 확인 — 영향 없음.
5. **naming collision**: `R-adr-async-fanin` 앵커는 repo 전체에서 유일 (grep 확인) — 충돌 없음.

## 요약
target draft(D1 + D2)는 이미 워크트리에 staged 되어 있으며, 인용한 모든 사실(코드의 `attempts:1`/re-throw/TEST-C2, 스캐너 job 의 `attempts:3`, 실행 엔진의 per-node task-queue 미채택 결정, defer 전제였던 OTel 관측 파이프라인 도입)을 실제 코드·spec·plan 대조로 검증한 결과 모두 정확했다. 다른 영역과의 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 충돌은 발견되지 않았다. 유일한 관찰 사항은 `cafe24-token-refresh` worker 의 상세 동작이 `navigation/4-integration.md`(신규)와 `data-flow/5-integration.md`(기존)에 부분 중복 기술되는 점과, 신규 `R-adr-*` Rationale 앵커 접두사가 repo 에 3번째 명명 계열을 추가하는 점인데 둘 다 즉각적 모순은 아니고 향후 drift 방지 차원의 INFO 수준 권고에 그친다.

## 위험도
LOW
