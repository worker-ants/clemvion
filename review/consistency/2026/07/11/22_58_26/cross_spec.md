### 발견사항

- **[INFO]** §2 변경 문구가 "presentation(carousel/table/chart/template) inline" 행 전체에 적용되어 table-only 구현과 문구 범위가 다시 어긋날 여지
  - target 위치: `plan/in-progress/spec-draft-webchat-truncation-total-count.md` §결정 "§2(화면 구조, L48 presentation inline 행)" 및 §스코프 경계
  - 충돌 대상: `spec/7-channel-web-chat/1-widget-app.md` §2 L48 (수정 대상 그 행 자체) — 해당 행은 carousel/table/chart/template 4종을 한 행으로 묶어 서술
  - 상세: target 이 제안하는 새 문구("잘림 표시를 총 개수와 함께 노출")는 L48 행 전체(4개 presentation 타입 공통 서술)에 적용되는데, 실제 이번 PR 구현은 table 한정(`TableData.totalCount`)이고 carousel 은 총 개수는커녕 잘림 배너 자체가 없다. target 은 이를 "스코프 경계 (명시)" 절에서 별도 서술로 명확히 인지·문서화했고, "기존 §2 '잘림 표시 노출'도 carousel 엔 이미 미충족"이라고 기존 gap 을 정확히 지적했다 — 즉 새로 만드는 모순이 아니라 기존에 있던 spec-vs-impl gap 의 연장이다. 다만 §2 본문 자체의 실제 편집 문구에 "(table 한정)" 같은 명시적 스코프 한정어가 들어가지 않으면, 이 draft 의 "스코프 경계" 설명이 없는 상태로 §2 를 단독으로 읽는 향후 독자는 carousel 도 총 개수를 보여준다고 오해할 수 있다.
  - 제안: §2 L48 행의 실제 편집 문구에 "(table 한정. carousel 은 [followups §carousel 잘림 배너] 별도 추적)" 정도의 인라인 스코프 한정을 추가해, `webchat-widget-presentation-followups.md` 의 "카루셀 잘림 배너 미구현" 항목과 spec 본문이 자체적으로도 정합되게 한다 (draft 밖 별도 문서 참조 없이도 §2 만 읽고 오해가 없도록).

- **[INFO]** `PresentationPayload.truncation` 4키 흡수 계약과의 정합 확인 (충돌 없음, 참고용 기록)
  - target 위치: `plan/in-progress/spec-draft-webchat-truncation-total-count.md` §실측, §결정
  - 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md` §7.10 `PresentationPayload` type 정의, `spec/4-nodes/6-presentation/0-common.md` §4(L100)·§10.4(L312), `spec/4-nodes/6-presentation/2-table.md` §5.1/§5.2, `spec/7-channel-web-chat/1-widget-app.md` §2(L48)·§R8
  - 상세: 대조 결과 target 의 모든 실측 주장이 현재 spec 원문과 정확히 일치한다 — `truncation.{rowsTotalCount|itemsTotalCount}` 는 이미 §7.10 type 정의·§4/§10.4 서술·widget-app §2/§R8 서술에 규범으로 존재하며, `codebase/channel-web-chat/.../presentation.ts` 의 `truncationMeta` 가 4키 전부를 이미 `output` 으로 흡수하는 것도(`presentation.ts:113-114`) 코드로 확인된다. target 이 "wire·§10.4 무변경, 소비 확장만" 이라고 선언한 전제가 실측과 부합하므로 데이터 모델/API 계약 충돌은 없다.
  - 제안: 없음 (정보성 확인).

### 요약

target 은 `spec/7-channel-web-chat/1-widget-app.md` §2·§R8 두 곳만 최소 수정하는 draft 로, 수정 대상 라인(L48, R8 절)의 현재 원문을 정확히 인용했고 참조하는 다른 영역 spec(`spec/4-nodes/6-presentation/0-common.md` §4·§10.4, `spec/4-nodes/6-presentation/2-table.md`, `spec/4-nodes/3-ai/1-ai-agent.md` §7.10 `PresentationPayload` type)과 데이터 모델·wire 계약이 완전히 일치한다. `truncation.{rowsTotalCount|itemsTotalCount}` 는 이미 여러 SoT 문서에 규범으로 존재하는 필드이고 draft 는 이를 새로 만들지 않고 위젯 소비 범위만 확장하므로 API 계약·데이터 모델·상태 전이·RBAC·계층 책임 어느 관점에서도 실질 충돌이 없다. `§R8` 이라는 절 번호가 다른 두 영역 문서(`chat-channel.md`, `external-interaction-api.md`)에서도 각각 다른 의미로 재사용되지만 이는 문서 로컬 스코프 번호 관행이라 요구사항 ID 충돌이 아니다. 유일한 잔여 포인트는 §2 편집 문구가 4개 presentation 타입을 묶은 행 전체에 적용되어 table-only 구현과 문면 범위가 살짝 어긋날 수 있다는 점인데, target 이 이를 "스코프 경계" 절로 이미 명시적으로 인지·문서화했으므로 새로운 모순이 아니라 기존 gap 의 연장이며 INFO 수준이다.

### 위험도
LOW
