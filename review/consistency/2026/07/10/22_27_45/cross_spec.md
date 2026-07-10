# Cross-Spec 일관성 검토 — widget-presentation-restore

대상: `plan/in-progress/widget-presentation-restore.md` (--spec draft)

검토 방법: prompt payload 에 포함된 `spec/0-overview.md` · `spec/1-data-model.md` 외에, target 이 직접 인용하는
관련 spec 을 리포지토리에서 직접 열어(§ 단위) 교차 검증했다 — `spec/7-channel-web-chat/1-widget-app.md`,
`spec/7-channel-web-chat/3-auth-session.md`, `spec/7-channel-web-chat/_product-overview.md`,
`spec/conventions/conversation-thread.md` (§1.1~§1.2, §2.1~§2.3, §7), `spec/4-nodes/3-ai/1-ai-agent.md` §7.10,
`spec/4-nodes/6-presentation/0-common.md` §10.4/§10.6/§10.7, `spec/5-system/14-external-interaction-api.md`
§5.2/§5.3, `spec/5-system/6-websocket-protocol.md`, `spec/conventions/data-hydration-surfaces.md`.

## 발견사항

- **[WARNING]** 신규 확정 제약("standalone presentation 노드 표시물은 새로고침 복원 대상이 아님")이 SoT 컨벤션 문서에 등록되지 않음
  - target 위치: §4-1 (`1-widget-app.md` §2 정정 계획), §2, Rationale R2
  - 충돌 대상: `spec/conventions/conversation-thread.md` §2.1 (Presentation 노드 자동 누적 컨트랙트), §7 (v2 로드맵)
  - 상세: target 은 이번 조사로 "durable thread 에는 AI `render_*` presentation 만 영속되고, standalone
    carousel/table/chart/template 노드의 표시 내용은(§2.1 이 정의하는 자동 누적은 `interaction` 클릭/제출 이벤트만이며
    표시 페이로드 자체가 아님) 영속되지 않는다"는 사실을 확정했고, 이를 오직 `1-widget-app.md` §2 한 곳에만 반영할
    계획이다(§4-1). 그러나 이 영속 계약의 SoT 는 위젯 문서가 아니라 `conversation-thread.md` 이며, 정작 그 문서의
    §2.1 "Presentation 노드"·§7 "v2 로드맵" 어디에도 이 경계가 명시돼 있지 않다. 이번 과제 자체가 "다른 문서(§2)에서
    실측 없이 부정확하게 기록된 제약을 뒤늦게 발견"한 사례였는데(target §1 "문구 출처" 참조), 동일한 사실을 SoT 컨벤션
    문서에는 등록하지 않고 소비 문서(위젯 spec)에만 기술하면, 향후 다른 채널(chat-channel 어댑터, 실행 이력 cross-node
    view 등)이 같은 질문("presentation 이 왜 복원 안 되나")을 다시 밟을 때 `conversation-thread.md` 를 먼저 열어봐도
    답을 찾지 못하는 동일 패턴이 재발할 수 있다.
  - 제안: `1-widget-app.md` §2 정정과 같은 커밋에서 `conversation-thread.md` §2.1 (또는 §7 v2 로드맵)에 1~2문장
    cross-ref 를 추가 — "표시-전용 presentation 노드({config,output})는 turn 의 top-level `presentations[]` 로
    영속되지 않는다(그 필드는 `source='ai_assistant'` 전용, §1.2). 확장은 5-source enum 영향이 커 v2 검토 사안 —
    [Spec Widget §2](../7-channel-web-chat/1-widget-app.md) 참조." 정도로 target R2 의 결정 근거를 SoT 쪽에도 남긴다.

- **[INFO]** `_product-overview.md` 비목표 목록에 동일 제약 미반영
  - target 위치: §4-1
  - 충돌 대상: `spec/7-channel-web-chat/_product-overview.md` §2 "비목표 (v1 → 백로그)"
  - 상세: 해당 절은 "유저당 다중 세션 목록 노출", "호스트 제공 사용자 식별키" 등 v1 범위 밖 항목을 명시적으로
    나열한다. "standalone presentation 노드 표시물의 새로고침 복원"도 성격상 동일한 v1 non-goal 이지만 목록에
    없다. 직접 충돌은 아니며(목표 절의 "presentations … inline" 문구는 라이브 렌더링 범위이고 이미 충족됨), 다만
    완결성 관점에서 짧게 추가하면 §2 진입 문서만 보고도 이 경계를 알 수 있어 탐색성이 좋아진다.
  - 제안: 선택 사항. planner 판단에 맡기되, `1-widget-app.md` §2 갱신과 함께 한 줄 추가를 고려.

- **[INFO]** 동일 shape 비대칭 서술이 이미 3곳에 흩어져 있어 위젯 spec 갱신 시 용어 정합 유지 필요
  - target 위치: §4-1
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §7.10 (`PresentationPayload` type block), `spec/5-system/14-external-interaction-api.md` §5.2 (`execution.message` 의 `{config,output}` envelope 설명), `spec/conventions/conversation-thread.md` §1.2 (`presentations?` 필드 설명)
  - 상세: 세 문서 모두 "standalone 노드는 `{config,output}` flat envelope, AI `render_*` 는 `PresentationPayload{type,toolCallId,renderedAt,payload,truncation?}`" 라는 동일 사실을 각자의 관점에서 이미 정확히 기술하고 있다(교차 확인 결과 상호 모순 없음 — target 의 기술적 주장과도 완전히 정합). `1-widget-app.md` §2 가 네 번째 서술 지점이 되므로, 실제 spec 편집 시 필드명·용어(`PresentationPayload` / `{config,output}` / "top-level `presentations[]`")를 그대로 재사용해 drift 를 만들지 않도록 주의.
  - 제안: 편집 시 위 세 문서 링크를 cross-ref 로 유지(현재 §2 원문도 이미 `AI Agent §7.10` 을 참조 중이므로 패턴 유지).

## 검증되어 충돌 없음으로 확인된 주요 주장 (참고)

- `conversation-thread.md` §1.1 "backend 5-source enum" — target R2 의 "5-source enum 확장 영향" 서술과 정합 (실제 5값: `presentation_user`/`ai_user`/`ai_assistant`/`ai_tool`/`system`).
- `conversation-thread.md` §1.2 `presentations?` 필드가 "`source='ai_assistant'` 한정" — standalone 노드 미영속 주장과 정합.
- `ai-agent.md` §7.10 의 `PresentationPayload` type block (`truncation?` 최상위 필드) — target §3 진짜 결함 서술과 100% 일치.
- `presentation/0-common.md` §10.4 — "`presentations[i].truncation` 에 surface" 규정 존재, target R3(코드만 수정) 주장과 정합.
- `presentation/0-common.md` §4 / `2-table.md` — standalone 노드는 `output.rowsTruncated` 를 output 내부에 직접 둠 — target §3 "정상 동작" 주장과 정합.
- `EIA` §5.3/§R17, `conversation-thread.md` §8.4 — `getStatus` 의 durable `context.conversationThread` 동봉 계약이 target §1 "구현됨(#874)" 표와 정합.
- `EIA` §5.2 `execution.message` — standalone 노드 라이브 표시가 `{config,output}` envelope 로만 발행되고 durable thread 에 쓰이지 않는다는 target §2 서술과 정합.
- `data-hydration-surfaces.md` §1.2 — 메인 프런트엔드에서도 standalone 노드 output 은 `PresentationContent`(Preview 탭, waiting/resumed 한정)로만 hydrate 되고 thread 영속 경로가 없음 — target §2 "원인은 위젯이 아니라 thread 영속 모델" 주장을 독립적으로 뒷받침.
- 신규 요구사항 ID 도입 없음 — ID 충돌 위험 없음.
- 상태 머신 변경 없음(`3.` 상태기계 다이어그램 무변경) — 상태 전이 충돌 없음.
- 권한/RBAC 변경 없음 — 해당 관점 영향 없음.
- 계층 책임(위젯 SPA vs backend thread 영속 vs 메인 프런트엔드) 재배분 없음 — R2 는 오히려 기존 경계(conversation-thread 5-source 확장은 별도 결정)를 명시적으로 존중.

## 요약

target 문서의 사실 주장(§1~§3)은 `conversation-thread.md`, `ai-agent.md §7.10`, `presentation/0-common.md §10.4/§10.6/§10.7`,
`EIA §5.2/§5.3`, `data-hydration-surfaces.md`, `websocket-protocol.md` 등 관련 spec 전 영역과 라인 단위로 교차
확인한 결과 모순 없이 정합했다 — 오히려 여러 문서가 독립적으로 동일한 shape 비대칭·영속 경계를 뒷받침해 target 의
진단(§1 실증 결과, §2 원인 재귀속, §3 truncation 유실)을 강하게 보강한다. 새 요구사항 ID·상태 전이·RBAC·계층 책임
재배분도 없다. 유일한 개선 여지는 이번에 확정된 "standalone 노드 미영속" 경계를 소비 문서(`1-widget-app.md`)에만
기술하고 SoT 컨벤션 문서(`conversation-thread.md`)에는 등록하지 않는 계획(WARNING 1건)인데, 이는 이번 과제의
발단이 된 "잘못된 위치에 기록된 제약"과 같은 종류의 위험(탐색 실패로 인한 재발견)을 완화하기 위한 권고이지,
target 자체의 모순은 아니다.

## 위험도

LOW
