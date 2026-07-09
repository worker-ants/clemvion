### 발견사항

- **[WARNING]** `conventions/conversation-thread.md` 의 EH-DETAIL-12 위임 참조가 이동 후 위치를 가리키지 않음
  - target 위치: `spec/2-navigation/14-execution-history.md` — Overview(제품 정의) 섹션(EH-LIST/EH-DETAIL/EH-NAV 매트릭스, EH-DETAIL-12 포함)을 `spec/2-navigation/_product-overview.md §3.15` 로 이관
  - 충돌 대상: `spec/conventions/conversation-thread.md` §9.3 (라인 417) — "상세 복원 규약은 [Spec Execution History §EH-DETAIL-12](../2-navigation/14-execution-history.md) 의 ConversationThread 재구성 정책에 위임" (앵커 없이 파일 전체를 가리킴)
  - 상세: 이 인용이 원래 가리키던 "EH-DETAIL-12 요구사항 행/정책 서술"은 이번 변경으로 `14-execution-history.md` 밖(= `_product-overview.md §3.15`)으로 이동했다. target 의 "파급 정리" 목록은 `0-overview.md §4`/`§6.3`의 두 참조는 갱신했지만, 같은 성격의 참조가 `conventions/conversation-thread.md`(다른 영역)에도 있다는 점은 놓쳤다. 링크 자체는 파일 레벨이라 404 는 아니지만("깨진 링크"는 아님), "위임 대상 정책이 이 문서에 있다"는 취지의 서술은 더 이상 정확하지 않다 — 실제로는 `14-execution-history.md` Rationale R-6 가 다시 `_product-overview.md §3.15`(요구사항 정의)와 `conversation-thread.md §7`(정책 모델)로 재위임하는 구조라 왕복 참조가 한 단계 더 길어졌다. `spec/4-nodes/3-ai/1-ai-agent.md:1156`·`spec/conventions/data-hydration-surfaces.md:72` 의 EH-DETAIL-12 언급은 bare ID 라 이 문제가 없음(target 의 claim 대로) — 이 한 곳만 예외.
  - 제안: `conventions/conversation-thread.md` §9.3 표의 링크를 `[Spec Execution History §EH-DETAIL-12](../2-navigation/_product-overview.md#315-execution-history-실행-내역)` 로 갱신(또는 `14-execution-history.md#r-6-...` Rationale 로 앵커 지정). target 의 "파급 정리" 항목에 (d)로 추가해 같은 커밋에서 처리 권장.

- **[INFO]** target 의 "cross-ref 무손상 확인" 서술이 위 케이스를 명시적으로 다루지 않음
  - target 위치: `plan/in-progress/spec-draft-nav-spec-cleanup.md` §2 "cross-ref 무손상 확인" 문단
  - 충돌 대상: 위 WARNING 항목과 동일 (`conventions/conversation-thread.md:417`)
  - 상세: target 은 "14-execution-history 로 오는 링크는 전부 본문 anchor 이며 Overview/EH-* 매트릭스 anchor 참조는 없음" 이라고 검증했는데, 이는 앵커 유무 기준으로는 사실이나(위 링크는 앵커가 없는 파일-레벨 링크라 "anchor 참조"엔 안 잡힘) 의미론적 정확성까지 보장하지는 못했다. 검증 기준을 "anchor 참조 여부"에서 "Overview 매트릭스 내용을 가리키는 서술(예: '위임')이 있는가"로 넓혔다면 위 건이 사전에 잡혔을 것.
  - 제안: 향후 유사한 섹션 이관 시 앵커뿐 아니라 "위임"/"정책은 여기 정의됨" 류의 서술형 참조도 함께 grep 하는 절차를 `plan-lifecycle` 관행에 반영 고려 (참고용, target 수정 필수는 아님).

### 요약
이번 draft 는 순수 spec-doc 재배치(14-execution-history.md 의 Overview 매트릭스를 형제 패턴에 맞춰 _product-overview.md §3.15 로 이관 + evidence code: 정밀화)로, 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 어느 관점에서도 실질적 모순은 발견되지 않았다. EH-* 요구사항 ID 는 값 변경 없이 verbatim 이동했고, WorkspaceSlugGate/resolve-fallback.ts 코드 evidence 는 실제 두 layout((main)·(editor)) 이 공유하는 파일로 확인되며 9-user-profile.md §3·data-flow/12-workspace.md 의 "URL slug=FE SoT, header-first 인가 무변경" 서술과도 정합한다. 유일한 실질 이슈는 `conventions/conversation-thread.md` 가 EH-DETAIL-12 재구성 정책의 소재로 여전히 `14-execution-history.md` 를 지목하는 서술인데, target 의 파급 정리가 `0-overview.md` 의 유사 참조 2건은 갱신했으나 이 건은 놓쳤다 — WARNING 으로 분류했으며 파일이 깨지지는 않으므로 병합 자체를 막을 정도는 아니다.

### 위험도
LOW
