# Rationale 연속성 검토 — spec-draft-eia-62-waiting-payload.md

## 발견사항

- **[CRITICAL]** §6.2 "예시를 실측 shape 으로 재작성" 이 WS 스펙이 명시적으로 기각한 대안("직접 재작성")을 정확히 그 이름으로 재도입한다
  - target 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` §"변경 제안 (1)" (L52-56) + (3) (L67-73)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` → "§4.4 wire 필드 caveat — 직접 재작성 대신 caveat 채택 (2026-07-14, PR #945 consistency 후속)", 그리고 그 안의 2026-08-13 갱신 blockquote
  - 상세:
    - WS §Rationale 은 §4.4 JSON 예시(논리 구조)와 실제 wire 사이의 drift 를 해소할 때 두 대안을 놓고 **명시적으로** 후자를 기각했다: "논리 nested 구조가 가독성상 유리하므로 **JSON 전체를 실 wire 로 교체(가독성 저하 + 두 문서 불일치)하지 않고** caveat 로 통일했다." 그리고 바로 그 문단에서 "**EIA §6.2 도 동일하게** notification 추상 JSON + SSE wire caveat blockquote 로 처리했다" 고 §6.2 를 이 패턴의 실례로 명시한다.
    - 이 결정은 하루 전(2026-08-13, target 착수 하루 전) 다음 문구로 **재확인**됐다: "위 두 결정은 **`waiting_for_input` 에 한정**해 그대로 유효하다 … `종결 3종`에서는 오너십 분리가 아니라 단일 SoT 로 수렴했는데 … 같은 규칙이 입력 사정에 따라 다른 결론을 낸 것이지 번복이 아니다." — 즉 waiting_for_input(§6.2) 만은 caveat 패턴을 유지하기로 방금 재확인한 상태다.
    - 현재 `spec/5-system/14-external-interaction-api.md` §6.2(L645-690) 는 실제로 이 패턴 그대로다 — 추상 `node`/`interaction`/`context` 예시 + 그 아래 "`waiting_for_input` 의 SSE 필드명 매핑" blockquote(L680-690)가 "본 blockquote 는 외부 클라이언트 소비 매핑의 SoT" 라고 자기 자신을 규정한다.
    - target 의 변경 제안 (1)은 "안쪽을 위 실측 키로 교체"(=JSON 전체를 실 wire 로 교체) 를 채택하고, (3)은 그 결과로 "매핑 화살표를 걷어내고" blockquote 의 존재 이유(필드명 매핑)를 제거한다. 이는 WS Rationale 이 기각한 대안을 문자 그대로 재도입하는 것이며, target 의 `## Rationale`(L86-95)은 "왜 삭제가 아니라 Planned 인가" / "왜 예시를 실측으로 맞추나(문서에 코드를 맞추지 않고)" 두 항목만 다뤄 **"왜 caveat 패턴을 버리고 직접 재작성으로 되돌아가는가"** 라는, 정확히 이 결정과 충돌하는 질문에는 답하지 않는다.
  - 제안: 다음 중 하나를 명시적으로 선택하고 문서화한다.
    1. **caveat 패턴 유지**: §6.2 예시는 현행처럼 논리 구조(`node`/`interaction`/`context`) + `payload` 봉투 caveat 를 유지하고, "SSE 필드명 매핑" blockquote 만 실측 키로 갱신한다(target 의 (3)만 채택, (1)은 철회). WS Rationale·2026-08-13 갱신과 정합.
    2. **caveat → 직접 재작성으로 전환(의도적 번복)**: 채택한다면 `spec/5-system/6-websocket-protocol.md` §Rationale 의 "§4.4 wire 필드 caveat" 항목에 새 날짜 갱신 blockquote를 추가해 — "왜 §6.2 만은 이제 직접 재작성이 caveat 보다 나은가"(예: node/interaction/context 전체가 재구성돼 매핑만으로 감당 안 되는 규모의 drift라는 논거)를 명시하고, 동시에 §6.2 blockquote 를 SoT 로 규정한 문구("본 blockquote 는 외부 클라이언트 소비 매핑의 SoT")도 갱신한다. target 자신의 `## Rationale` 에도 이 caveat-vs-rewrite 결정을 정면으로 다루는 항목을 추가한다.

- **[WARNING]** target 의 §6.2 재작성이 `6-websocket-protocol.md` Rationale 내 §6.2 관련 서술을 stale 하게 만들 위험 (target 자신이 발생시키는 신규 drift)
  - target 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` §"변경 제안 (3)" (L67-73), `## 체크리스트` (L79-84)
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` → "§4.4 wire 필드 caveat" 항목의 "오너십 분리로 3중 복제·재-drift 회피" 문단 및 2026-08-13 갱신 blockquote ("`§6.2 blockquote 에는 waiting_for_input 고유의 필드명 매핑만 남았다`")
  - 상세: WS Rationale 은 "외부 클라이언트 소비 매핑의 SoT = EIA §6.2 blockquote" 라고 명시적으로 소유권을 §6.2 의 "SSE 필드명 매핑" blockquote 에 부여하고, 2026-08-13 갱신은 그 blockquote 의 현재 내용을 "필드명 매핑만 남았다" 로 정확히 서술한다. target 이 이 blockquote 를 필드명 매핑에서 "봉투만 다르다" 는 다른 내용으로 바꾸면, WS 스펙의 이 Rationale 서술 자체가 실제와 어긋나는 상태가 된다 — 이 draft 가 고치려는 것과 같은 종류의 drift 를 다른 문서에 새로 만드는 셈이다. target 의 `spec_impact`(frontmatter)와 체크리스트 어디에도 `spec/5-system/6-websocket-protocol.md` 의 Rationale 갱신이 포함돼 있지 않다.
  - 제안: 위 CRITICAL 항목의 결정과 무관하게, §6.2 blockquote 의 역할/내용이 바뀐다면 `6-websocket-protocol.md` 의 대응 Rationale 문단도 같은 PR 에서 함께 갱신한다(선례: 문서 자신의 2026-08-13 "갱신" 관용구 형식). `spec_impact` 리스트에 해당 파일을 추가한다.

- **[INFO]** 그 외 변경 제안은 기존 Rationale/선례와 정합한다
  - 상세: (2) `interaction` 블록을 삭제 대신 Planned 로 표기하는 안은 `#1166`(`9a4d3e32b`)이 실제로 `finalNodeId`/`finalPort`(엔진에 개념 없음 → 완전 삭제) 와 `result.outputs`/`durationMs`(값은 존재하나 미배선 → Planned) 를 구분한 선례와 정확히 같은 기준을 적용한다 — target 의 인용은 지어낸 것이 아니라 실제 커밋 이력과 일치함을 확인했다. (4) `error.code` optional 화는 기존 필드 집합 표(§6 도입부, `error` 행의 "형태 불일치" 캐비엇)를 더 세분화하는 방향이라 상충하지 않는다. (5) `1-data-model.md` §2.14 nullable `nodeId` 반영은 이미 EIA §6.4 본문에 있는 선언을 데이터 모델에 동기화하는 것으로, 기존 "WorkflowVersion.snapshot 정정" 류 drift 해소 패턴과 일치한다. (6) 인용 오귀속 정정(`§4.4.6`)은 WS 문서 자체의 Rationale 이 같은 앵커(`§4.4.6`)를 자기 문서 안에서 참조하는 것과 정합해, WS 문서로 재지정하는 target 의 판단이 맞다. URL 을 상대경로로 바꾸는 제안도 `2-api-convention.md §1`("버전은 URL 경로에 미포함")의 기존 원칙을 따르는 정합 조치다.

## 요약

target 문서의 실측·6항목 수정 제안 대부분은 기존 Rationale·컨벤션과 정합하거나(②④⑤⑥) 기존 원칙 위반을 오히려 바로잡는다. 다만 핵심 제안 (1)("§6.2 예시를 실측 shape 으로 재작성")은 `spec/5-system/6-websocket-protocol.md` Rationale 이 2026-07-14 에 이름까지 명시해 기각하고 2026-08-13 에 `waiting_for_input` 범위로 재확인한 "직접 재작성" 대안을 그대로 되살리는 것이며, target 은 이 충돌을 인지하거나 다루지 않는다. 이 방향을 유지하려면 WS 문서 쪽 Rationale 에 명시적 번복 근거를 추가해야 하고, 유지하지 않으려면 (3)의 blockquote 정정 범위를 필드명 매핑 갱신으로 좁혀야 한다. 두 경우 모두 `spec_impact`/체크리스트에 `6-websocket-protocol.md` 를 포함시켜야 한다.

## 위험도
HIGH
