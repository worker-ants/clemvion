# Cross-Spec 일관성 검토 — `spec/conventions/`

## 검토 범위 및 방법

target 은 `spec/conventions/` 전체(--impl-prep, 컨텍스트 예산으로 프롬프트 번들에는 `audit-actions.md`·
`cafe24-api-catalog/{_overview,category,store,translation}.md`·`cafe24-api-metadata.md`·
`chat-channel-adapter.md` 만 전문 포함, 나머지 263개 conventions 파일 + 111개 기타 spec 파일은 생략).
번들 밖 파일은 "없다"를 근거로 삼지 말라는 지시에 따라 리포지토리 파일시스템에서 직접 `Read`/`grep` 으로
관련 영역을 교차 확인했다. 확인한 대상:

- `audit-actions.md` ↔ `5-system/1-auth.md §4.1`(+ Rationale 4.1.A/4.1.B) ↔ `data-flow/1-audit.md §1.1` ↔ `1-data-model.md §2.18 AuditLog` ↔ `data-flow/12-workspace.md`(workspace.deleted 구조적 제외)
- `cafe24-api-catalog/_overview.md`·`cafe24-api-metadata.md` ↔ `4-nodes/4-integration/4-cafe24.md` ↔ `cafe24-restricted-scopes.md` ↔ `5-system/11-mcp-client.md §2.3`
- `chat-channel-adapter.md` ↔ `5-system/15-chat-channel.md`(R8·CCH-AD-07·CCH-MP-01/04/06·R-CC-15·R-CC-17) ↔ `5-system/14-external-interaction-api.md`(§6 5종 payload·EIA-RL-03/04·R10) ↔ `5-system/6-websocket-protocol.md §4.4` ↔ `conventions/interaction-type-registry.md §1`(4↔3 값 매핑) ↔ `4-nodes/7-trigger/providers/discord.md`(R-D-7/R-D-9) ↔ `conventions/error-codes.md §4` ↔ `conventions/secret-store.md`(SS-SE-01)

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** Coverage Matrix 수치 재검증 완료 — 참고용 기록
  - target 위치: `spec/conventions/cafe24-api-catalog/_overview.md §5 Coverage Matrix`
  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md`("endpoint 규모 실측 — ~180 화석 정정" 절, 485 3중 교차검증)
  - 상세: Coverage Matrix 18 resource 행의 `Supported` 열을 직접 합산(105+62+104+22+21+9+33+17+17+15+20+15+5+5+6+8+12+9=485)해 `4-cafe24.md` 가 주장하는 485 실측치·resource 별 분포(store 105/order 104/product 62/…)와 정확히 일치함을 확인했다. 모순 없음 — 오히려 두 문서가 서로 독립적으로 같은 숫자에 수렴하는 좋은 사례. 별도 조치 불요, 기록 목적의 INFO.
  - 제안: 없음 (참고 확인 완료)

## 요약

`spec/conventions/` 번들에 포함된 4개 컨벤션 문서(`audit-actions.md`, `cafe24-api-catalog/*`, `cafe24-api-metadata.md`, `chat-channel-adapter.md`)를 각각의 소비측 spec 본문(`5-system/1-auth.md`, `data-flow/1-audit.md`, `1-data-model.md`, `4-nodes/4-integration/4-cafe24.md`, `cafe24-restricted-scopes.md`, `5-system/15-chat-channel.md`, `5-system/14-external-interaction-api.md`, `5-system/6-websocket-protocol.md`, `conventions/interaction-type-registry.md`, `4-nodes/7-trigger/providers/discord.md` 등)와 대조한 결과, 요구사항 ID(R-CCA-*, CCH-*, EIA-RL-*, R-D-*)·엔티티 필드(AuditLog, ChatChannelConfig)·상태 값(WaitingInteractionType 4↔3 매핑, formMode/visualNode enum)·수치(485 endpoint 합계)·구조적 제약(workspace.deleted ON DELETE CASCADE) 모두 SoT 위임과 상호 참조가 정확히 대칭이며 모순을 찾지 못했다. 이 스펙 세트는 각 결정마다 Rationale 절에 배경·기각 대안·cross-file 앵커를 명시하는 방식으로 매우 촘촘히 그루밍되어 있어, 이번 검토에서 새로운 cross-spec 충돌은 발견되지 않았다. 다만 컨텍스트 예산으로 원본 프롬프트에서 생략된 263개 conventions 파일(특히 cafe24/makeshop 나머지 14개 리소스 카탈로그, `error-codes.md`, `execution-context.md`, `node-output.md`, `migrations.md`, `secret-store.md` 등)과 111개 기타 spec 파일은 표본 grep 확인에 그쳤으므로 전수 검증은 아니다.

## 위험도

NONE
