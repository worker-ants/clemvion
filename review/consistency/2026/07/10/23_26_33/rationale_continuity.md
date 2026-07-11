## 발견사항

- **[INFO]** 결정 근거가 spec 자체 `## Rationale` 이 아니라 plan 문서에만 상세 기록됨
  - target 위치: `spec/7-channel-web-chat/1-widget-app.md` §2 presentation 행, §3.1 새로고침 행 (본문만 수정, 문서 하단 `## Rationale`(R4~R6)은 무변경) / `spec/7-channel-web-chat/_product-overview.md` §2 비목표 신설 항목
  - 과거 결정 출처: 없음 — 이번 변경은 과거 Rationale 을 뒤집는 게 아니라, `1-widget-app.md` §2 에 있던 "알려진 제약(Planned): 위젯 렌더러가 graceful 하게 무시(빈 렌더) — 후속(shape 매핑) 과제" 서술을 실제로 완결한 것(진짜 원인 재기술 포함). `plan/in-progress/widget-presentation-restore.md` §1에 `git log -S` 로 실측 확인한 근거와 자체 `## Rationale`(R1~R3)이 상세히 기록돼 있어 결정 과정 자체는 투명하다.
  - 상세: "위젯 렌더러가 두 shape(standalone envelope / AI `PresentationPayload`)을 모두 수용하고, `truncation` 메타를 흡수하며, standalone 노드 표시물은 의도적으로 복원 범위에서 제외한다"는 것은 실질적인 설계 결정(§4 R2: "표시-전용 노드 복원은 5-source enum 확장이 필요해 v1 범위 밖")인데, 이 근거가 `plan/in-progress/**`(추후 `plan/complete/`로 이동 예정)에만 있고 `1-widget-app.md`의 `## Rationale`(R4~R6) 목록에는 신규 항목으로 반영되지 않았다. CLAUDE.md 의 "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" 원칙과, 본 PR이 같은 커밋에서 `EIA §R17`·`conversation-thread §2.1` 처럼 인접 spec 의 `## Rationale`/본문에는 직접 반영한 패턴과 비교하면, 유독 `1-widget-app.md` 자신의 `## Rationale`만 갱신에서 빠졌다.
  - 제안: 차단 사유는 아님(본문 자체에 "범위 제약: durable thread 의 `turn.presentations[]` 는 `source: 'ai_assistant'` 한정" 설명이 이미 인라인으로 충분히 서술돼 있어 독자가 스펙만 읽어도 이해 가능). 다만 재발견 방지 차원에서 `1-widget-app.md` `## Rationale`에 짧은 항목(예: "R7. presentation 렌더러 두 shape 통일 수용 — standalone 노드 복원은 범위 밖")을 추가해 plan 문서가 `complete/`나 `archive/`로 이동한 뒤에도 spec 단독으로 결정 이력이 추적되게 하는 것을 권장.

## 검증한 연속성 항목 (문제 없음)

- **기각된 대안 재도입 여부**: 없음. 옛 서술("위젯 렌더러가 graceful 하게 무시")은 명시적으로 *채택된 설계*가 아니라 `plan` 이 실측으로 확인한 바 "실측 없이 기록된 부정확한 서술"이자 이미 "후속(shape 매핑) 과제"로 예고돼 있던 항목이라, 이번 구현은 과거 기각안의 재도입이 아니라 예고된 후속 작업의 완결이다.
- **합의된 원칙 위반 여부**: 없음. `spec/conventions/conversation-thread.md §2.1`("표시물 envelope 은 thread 에 영속되지 않는다 … `presentations[]` 는 `source: 'ai_assistant'` 한정")이 이번 PR에서 함께 갱신됐고, target 의 새 문구("범위 제약: … AI `render_*` 표시물만 영속된다")는 그 원칙과 문자 그대로 일치한다. `spec/4-nodes/6-presentation/0-common.md §10.4`(truncation 메타 동등 취급)·`§10.6`/`§10.7`(display-only vs AI render_* 의 저장 위치 분리)·`spec/4-nodes/3-ai/1-ai-agent.md §12.4/§7.10`(presentation payload가 `turn.presentations[]` 단일 진실)과도 정합. `spec/5-system/14-external-interaction-api.md R17`(2026-07-09 `conversationThread` 노출 재조정)이 이미 durable thread 노출을 결정해 둔 상태라, 본 변경은 그 위에서 위젯 소비 로직만 완성한 것.
- **결정의 무근거 번복 여부**: 없음. "standalone presentation 노드는 새로고침 복원 대상이 아니다"는 새 제약이 아니라 conversation-thread 5-source 모델의 기존 불변식을 정확히 재서술한 것이며, `_product-overview.md` 비목표 항목도 기존 유사 사례("위젯 외형 per-workspace 테마 … 구분 근거는 [5-admin-console R2]")와 동일한 인용 패턴으로 등재됐다.
- **암묵적 가정 충돌 여부**: 없음. `presentation.ts` 의 `asEnvelope`/`truncationMeta` 구현이 `payload` 바깥 top-level `truncation` 필드를 `output` 에만 흡수하고 `config` 는 순수 사본으로 유지하는 방식은 §10.4·§10.7 이 규정한 "top-level truncation = 단일 진실", "`data?` 와 별개 필드" 불변식을 그대로 지킨다.

## 요약

widget-presentation-restore PR은 `spec/7-channel-web-chat/1-widget-app.md`·`_product-overview.md`의 문구를 "AI `render_*` 표시물은 새로고침 복원되지만 표시-전용 presentation *노드* 표시물은 복원되지 않는다"로 정정하고, 위젯 코드가 두 presentation shape(standalone envelope / AI `PresentationPayload`)을 통일 수용하며 truncation 메타를 흡수하도록 구현했다. 이는 과거 Rationale의 기각·번복이 아니라 `conversation-thread.md §2.1`(같은 커밋에서 동반 갱신)·`0-common.md §10.4/§10.6/§10.7`·`ai-agent.md §12.4/§7.10`·`EIA R17`에 이미 확립된 5-source 모델·durable thread 저장 규칙을 정확히 따르는 완결 작업이며, plan 문서 자체에 R1~R3 Rationale이 상세히 기록돼 결정 과정도 투명하다. 유일한 개선 여지는 이 결정 근거가 spec 자신의 `## Rationale`이 아니라 plan에만 있다는 점(INFO)뿐이다.

## 위험도
LOW