# Plan 정합성 Check 결과

> 대상: `spec-draft-d2-adr.md` (D1 = cafe24-token-refresh 에러 격리 정책 명문화, D2 = Merge P2→P3 ADR 마감)
> 확인 방법: draft 는 이미 실 spec(`spec/2-navigation/4-integration.md`, `spec/4-nodes/1-logic/11-merge.md`)·
> plan(`plan/complete/merge-p2-async-fanin.md`, `plan/complete/eia-distributed-seq-counter.md`)에 반영된
> 상태였으므로, 그 적용 결과와 저장소 전체 `plan/in-progress/**`(18개 파일 + `node-output-redesign/` 27개
> 서브 파일)를 대조.

## 발견사항

- **[WARNING]** `node-output-redesign/merge.md` 가 D2 의 P2→P3 격하를 반영하지 않아 stale
  - target 위치: D2 — `spec/4-nodes/1-logic/11-merge.md` §1 note, §6 note (P2→P3 격하 완료)
  - 관련 plan: `plan/in-progress/node-output-redesign/merge.md` L88, L108
  - 상세: 이 서브 plan 문서는 여전히 "P1 → P2 활성화 시점에 `MERGE_TIMEOUT` 코드와 함께 `error` 포트가
    추가될 가능성 (spec §6 footnote)"(L88), "P2 에서 `MERGE_TIMEOUT` 도입 가능성 footnote"(L108) 로
    구 표기를 인용한다. D2 가 `11-merge.md` §6 을 "Phase P2 예정" → "P3 로 격하 (2026-07-17 ADR)" 로 정정했으므로
    이 두 인용은 이제 outdated. 이 plan 은 Merge 노드의 잔여 impl 항목(예: `timeout` zod `.nonnegative()`,
    dormant warningRule blocking validate 테스트 부재 — `node-output-redesign/README.md` L14, L374)을
    계속 추적 중인 **살아있는** 문서라 향후 진입자가 "P2 가 곧 온다"는 오인을 할 위험이 있다. draft 자신의
    검토 요청 관점 #4 가 정확히 이 파일과의 충돌을 질의했으나 draft 본문은 이를 반영하지 않았다.
  - 제안: `node-output-redesign/merge.md` L88/L108 의 "P1 → P2" 서술을 "P1 → P3(무기한 dormant, ADR
    `R-adr-async-fanin`)" 로 갱신 — D2 커밋에 동반 포함 또는 별도 후속 커밋으로.

- **[WARNING]** ADR 이 새로 남긴 "남은 UX 이슈"를 추적할 in-progress 소유 문서가 없음
  - target 위치: D2 — `spec/4-nodes/1-logic/11-merge.md` §Rationale `R-adr-async-fanin` 말미 "남은 UX 이슈"
  - 관련 plan: `plan/complete/merge-p2-async-fanin.md` (이미 complete 로 이동) / `node-output-redesign/merge.md` (인접하지만 다른 항목)
  - 상세: ADR 은 "영구 dormant 필드(`timeout`/`partialOnTimeout`)가 schema/UI 에 노출된 채 설정 시
    `handler.validate` 가 차단 에러를 내는 것이 적절한지(필드 제거 vs severity 완화 vs 현행 유지)는
    **제품 결정**이라 범위 밖으로 남긴다"고 명시한다. 그러나 이 결정은 (a) 방금 `complete/` 로 이동한
    `merge-p2-async-fanin.md` 배너에만 부가로 적혀 있고, (b) `node-output-redesign/merge.md` 가 추적 중인
    "blocking validate 테스트 부재" 항목은 테스트 커버리지 갭이지 이 UX 정책 결정 자체가 아니다.
    `plan/in-progress/` 어디에도 "필드 제거 vs severity 완화 vs 유지" 를 결정 필요 항목으로 명시 추적하는
    파일이 없어, 결정이 완료된 plan 의 각주 속에 묻혀 유실될 위험이 있다.
  - 제안: `node-output-redesign/merge.md` (이미 Merge 노드 impl 갭을 추적 중) 에 이 UX 결정 항목을
    `(spec)` 또는 `(product-decision)` 체크박스로 명시 추가하거나, 별도 짧은 in-progress 항목으로 신설.

- **[INFO]** `merge-p2-async-fanin.md` 의 원출처 링크가 사전부터 dead — draft 가 이 파일을 다루면서도 미정정
  - target 위치: D2 — `plan 처분` 절 (merge-p2-async-fanin.md complete 이동)
  - 관련 plan: `plan/complete/merge-p2-async-fanin.md` L12 "분리 출처: `../complete/logic-node-followups.md` §5"
  - 상세: `logic-node-followups.md` 는 2026-05-30 커밋 `f7c56bf0a` (plan/review 일괄 정리)로 이미 삭제됐다
    (draft 와 무관한 사전 이력). draft 의 검토 요청 관점 #2 는 "D2 가 logic-node-followups D3 '본 plan 에
    흡수 활성화' 결정을 번복하는가" 를 명시적으로 검증하라고 요청하는데, 원본 파일이 없어 2차 출처
    (`merge-p2-async-fanin.md` 자체 L138 "결정 히스토리" 요약)로만 검증 가능했다. 요약 자체는 자기
    일관적이라 CRITICAL 은 아니나, 이번에 이 파일(banner 신설)을 직접 편집하는 김에 dead link 도 함께
    정리하는 편이 향후 동일 혼란을 막는다.
  - 제안: L12 참조를 "(2026-05-30 삭제됨 — 요약은 본 문서 §결정 히스토리 참조)" 로 각주 처리하거나 링크 제거.

## cross-spec / rationale-continuity 검증 결과 (draft 자체 질의 응답)

- D1 의 `attempts: 1` (cafe24-token-refresh) vs §11.1 4개 만료 스캐너 job 의 `attempts: 3` — 서로 다른 큐로
  명확히 분리 서술돼 있고 실제 코드(`cafe24-api.client.ts:662`)·`data-flow/5-integration.md` L349 와도
  일치. 혼동·충돌 없음.
- D1 이 2026-06-02 defer 결정(cafe24-backlog-residual.md D-2)을 번복하는가 — 아니다. defer 의 전제
  ("관측 인프라 일괄 도입")가 OTel 파이프라인(#594, 2026-06-14)으로 실제 충족됐음을
  `spec/5-system/_product-overview.md` NF-OB-02/03/07 ✅ 표기로 직접 확인. 재개이지 번복 아님.
- D2 가 P2→P3 격하한 것이 엔진 spec(`5-system/4-execution-engine.md` §4 "per-node task queue 채택하지
  않음")과 정합함을 확인 — 새 Rationale 이 인용한 문장 그대로 실재.
- `merge-p2-async-fanin.md` complete 이동은 `execution-engine-residual-gaps.md`(Merge/barrier 언급 없음,
  G1/G2/G3 은 WS shutdown gate·SIGTERM·Redis TTL 로 무관)와 충돌하지 않음.
- `cafe24-backlog-residual.md` 잔여 A-3(Layer 1 Redis throttle)·G-4(응답 래퍼 generator 재생성)는 D-2(에러
  격리 정책)와 무관한 별개 트랙 — D-2 완료가 이 항목들에 영향을 주지 않는다는 draft 의 판단은 타당.
- `## Rationale` 신설 위치(§7 캔버스 요약 다음, 최종 섹션)는 CLAUDE.md 3섹션 구성에 부합.
- `R-adr-*` 접두는 기존 `R-wontdo-*`(`R-wontdo-rawws-rest`, `R-wontdo-cached-capabilities`) 선례와 같은
  `R-<prefix>-<slug>` 패턴을 따르는 자연스러운 확장 — "won't-do"(영구 기각)와 의미가 다른 "ADR/재검토
  트리거 있음"을 구분하려는 의도로 읽혀 정합. `R-adr-async-fanin` 은 저장소 전체에서 유일한 식별자 —
  충돌 없음.

## 요약

D1(cafe24 에러 격리 정책 명문화)은 defer 전제 해소를 정확히 근거로 들었고 cross-spec 참조(§11.1
`attempts:3` 스캐너와의 구분, `data-flow §1.4`)와도 충돌이 없어 문제 없음. D2(Merge P2→P3 ADR)도 엔진
spec 의 확정된 반대 방향 결정을 정확히 인용하며 원 plan 의 수용 기준 분기를 정당하게 충족시켰고,
`eia-distributed-seq-counter.md` 의 dead-link 도 이미 해소 note 로 갱신됐다. 다만 draft 가 스스로 제기한
"node-output-redesign/** 충돌 여부" 질의에 대한 실제 답은 "있음"이다 — 같은 Merge 노드를 다루는 인접
in-progress 문서(`node-output-redesign/merge.md`)가 여전히 P2 활성화 임박 서술을 유지하고 있어 갱신이
필요하고, ADR 이 새로 남긴 "영구 dormant 필드의 UX 처리" 결정도 이를 추적할 살아있는 plan 항목이 없다.
두 건 모두 결정 번복이나 선행조건 미해소가 아닌 **후속 갱신 누락** 성격이라 CRITICAL 은 아니지만, 이번
PR 범위에 함께 반영하거나 별도 후속 커밋으로 명시 추적해야 한다.

## 위험도
MEDIUM
