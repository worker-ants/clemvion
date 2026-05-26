# Rationale 연속성 검토 결과

검토 범위: `spec/2-navigation/` (구현 착수 전 --impl-prep)
검토 일시: 2026-05-26

---

## 발견사항

### [INFO] 1-workflow-list.md §2.3 소유 필터 — Rationale 에 기록된 정의와 본문이 정합

- target 위치: `spec/2-navigation/1-workflow-list.md` §2.3 필터, §2.1 공유 표시
- 과거 결정 출처: `spec/2-navigation/1-workflow-list.md ## Rationale §1 "공유 워크플로우"의 정의 — 팀 워크스페이스 전체"`
- 상세: Rationale §1 에서 "(b) `createdBy ≠ 현재 사용자` 또는 명시적 sharedWith 컬럼 = 공유" 옵션을 **기각** 했고, "(a) 팀 워크스페이스에 속한 모든 워크플로우"를 채택했다. 본문 §2.1 뱃지 정의 및 §2.3 소유 필터 설명은 이 결정을 준수하며 drift 없음. 정합 확인만으로도 기록이 필요하다고 판단.
- 제안: 현상 유지. 이 항목은 구현자가 §2.3 의 `ownership` 파라미터를 구현할 때 뱃지와 필터의 역할 분리를 오해하지 않도록 Rationale §1 을 반드시 숙지해야 함.

---

### [INFO] 2-trigger-list.md §2.1 ⋮ 메뉴 ③ — R-6/R-7 기각 대안이 본문에 잔류 흔적 없음

- target 위치: `spec/2-navigation/2-trigger-list.md` §2.1 더보기(⋮) 항목 ①②③
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-6 "호출 이력 진입을 별도 Dialog 로 분리"`, `R-7 "detail drawer 에서 Recent Calls 카드 제거"`
- 상세: R-6 에서 기각된 "drawer anchor scroll" 및 "focus 모드" 대안이 §2.1 본문에 재도입되지 않았음. R-7 에서 기각된 "drawer 에 Recent Calls 카드 유지" 패턴도 §2.3 상세 drawer 정의에 없음. 정합 확인. 구현 시 drawer 와 Dialog 를 혼동하여 drawer 에 `GET /api/triggers/:id/history` 호출을 추가하지 않도록 주의 필요.
- 제안: 현상 유지.

---

### [INFO] 2-trigger-list.md R-13 — drill-down Link 추가는 R-6 의 "표시 전용" 정의를 번복하지만 Rationale 신규 작성됨

- target 위치: `spec/2-navigation/2-trigger-list.md` §2.1 ③ "호출 이력" Dialog 항목 설명
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-6 (2026-05-22)` — 호출 이력 Dialog 항목을 "시작 시각 + 상태 Badge **표시 전용**"으로 최초 정의
- 상세: R-13 (2026-05-26) 이 R-6 의 "표시 전용" 정의를 번복해 각 항목을 `<Link href="/workflows/:workflowId/executions/:executionId">` 로 감쌌다. 그러나 R-13 자체에서 번복 이유(drill-down 진입 경로 부재 → 사용자 불편)와 채택 방식을 명시적으로 기술했으므로 "무근거 번복"에 해당하지 않음. Rationale 연속성 관점에서 정합.
- 제안: 현상 유지. R-13 은 충분한 근거를 담고 있음.

---

### [INFO] 10-auth-flow.md — R-1/R-2 의 롤백 결정이 §1 본문에 올바르게 반영됨

- target 위치: `spec/2-navigation/10-auth-flow.md` §1 배경 설명, `[Logo]` 변종 문구
- 과거 결정 출처: `spec/2-navigation/10-auth-flow.md ## Rationale R-1 (2026-05-15 롤백)`, `R-2 (2026-05-15 정정)`
- 상세: R-1 이 롤백한 "soil-50 단색, 그라데이션 금지" 정의가 §1 본문에 재등장하지 않음. R-2 가 정정한 "Full logo (light) 한정" 대신 "Full logo 변종" (라이트/다크 선택은 brand spec 위임) 으로 올바르게 기술됨. 정합 확인.
- 제안: 현상 유지.

---

### [INFO] 10-auth-flow.md §3.2/§3.4.2 — auth spec R에서 기각된 "WebAuthn → TOTP 자동 전환" 미재도입

- target 위치: `spec/2-navigation/10-auth-flow.md` §3.2 처리 플로우, §3.4.2 WebAuthn 화면
- 과거 결정 출처: `spec/2-navigation/10-auth-flow.md §3.4.2` 내 "TOTP 화면으로 자동 전환되지 않는다" 명시 + `(auth spec §1.4.D Rationale)` 참조
- 상세: "WebAuthn 우선 + TOTP fallback 자동 전환"은 auth spec §1.4.D 에서 기각된 대안이다. §3.4.2 는 이를 재도입하지 않고 "WebAuthn 미지원 시 복구 코드 링크만 노출"로 일관되게 기술. 정합 확인.
- 제안: 현상 유지.

---

### [WARNING] 2-trigger-list.md R-12 — PR #300 catch-up 이지만 `providers/_overview.md §1` 의 SoT 참조가 §2.3.1 의 일부 언급과 충돌 가능

- target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 필드 권한 매트릭스 `Chat Channel | provider` 행
- 과거 결정 출처: `spec/2-navigation/2-trigger-list.md ## Rationale R-12 (2026-05-24)`
- 상세: R-12 는 `provider` 행 비고를 "v1 은 `telegram` / `slack` / `discord` (`_overview.md §1` 단일 진실)" 으로 갱신하고 SoT 를 `providers/_overview.md §1` 로 명시했다. 그런데 §2.3.1 내 `Chat Channel | botToken` 행의 형식 검증 정규식 `^\d{6,}:[A-Za-z0-9_-]{30,}$` 는 텔레그램 Bot Token 형식에 특화된 것으로, slack / discord 는 이 형식을 따르지 않는다. 이 정규식이 v1 전체 provider 에 일률 적용되는 것인지 아니면 telegram 한정인지 §2.3.1 에서 명시되지 않아 구현자가 혼동할 수 있다. R-12 신규 provider 추가가 `botToken` 행의 정규식에 대한 Rationale 갱신 없이 이루어진 점이 위험.
- 제안: §2.3.1 `Chat Channel | botToken` 행에 "형식 검증은 telegram 전용. slack/discord 는 별도 형식 규칙" 임을 명시하거나, Rationale R-12 에 이 점을 보완 기술할 것. 또는 bot token 형식 정책을 `providers/_overview.md §1` 의 SoT 에 위임하고 본 §2.3.1 에는 참조 링크만 유지.

---

### [INFO] 14-execution-history.md EH-DETAIL-03/§3.3 — "이전 LLM Information 단일 탭 + 하위 탭" 패턴이 기각됨을 Rationale 에서 명시

- target 위치: `spec/2-navigation/14-execution-history.md` §3.4.2 설명문 첫 단락
- 과거 결정 출처: `spec/2-navigation/14-execution-history.md §3.4.2` 본문 — "이전에는 단일 `LLM Information` 탭 아래 `Response / Request / Usage` 하위 탭 구조였으나, 메시지를 선택할 때의 두 번 클릭 불편을 없애기 위해 평탄화되었다"
- 상세: 이전에 정의됐던 "LLM Information 탭 + 하위 탭" 구조를 기각하고 "LLM Usage / Response / Request" 를 최상위 탭으로 평탄화한 결정이 본문 서술로만 기록돼 있고 Rationale 섹션이 별도로 없다. 기각 이유("두 번 클릭 불편")는 본문에 인라인으로 언급되어 있어 완전히 누락은 아니지만, 공식 Rationale 로 추출되지 않아 향후 "왜 평탄화됐는가"를 추적하기 어렵다.
- 제안: `14-execution-history.md` 에 `## Rationale` 섹션을 추가하거나, 기존 본문 설명을 이름 있는 Rationale 항목(`R-X. LLM 탭 구조 평탄화`)으로 승격하여 공식 기록화 권장. 필수 차단 사항은 아님.

---

### [INFO] 13-user-guide.md — spec 과 외부 참조 간 invariant 충돌 없음

- target 위치: `spec/2-navigation/13-user-guide.md` 전체
- 과거 결정 출처: 해당 없음 (이 파일에는 Rationale 섹션 없음)
- 상세: 이 spec 파일에는 Rationale 섹션이 없으며, 다른 spec 의 Rationale 에서 기각된 대안을 재도입하는 내용도 발견되지 않음. cross-cutting invariant(SDD 원칙, 단일 진실 경로 등)에 대한 위반도 없음.
- 제안: 현상 유지. spec 파일이 성숙해지면 "왜 내부 `/docs` 경로인가 (외부 사이트 대신)" 등의 선택 근거를 Rationale 로 기록하면 향후 유지보수에 도움이 됨.

---

### [INFO] 0-dashboard.md / 11-error-empty-states.md / 12-workflow-version-history.md — Rationale 섹션 부재

- target 위치: 세 파일 전체
- 과거 결정 출처: 해당 없음
- 상세: 세 파일 모두 Rationale 섹션이 없다. 기각된 대안을 재도입하거나 합의된 원칙을 위반하는 내용은 발견되지 않음. 그러나 `12-workflow-version-history.md §9` 의 "버전 생성 실패 시 다음 저장에서 자동으로 따라잡힌다"는 비원자성 용인 설계는 Rationale 없이 기술되어 있어, 구현자가 이것이 의식적 결정임을 알기 어렵다.
- 제안: `12-workflow-version-history.md §9` 의 "버전 생성 실패 시 캔버스 저장은 성공 유지" 동작에 대한 Rationale 추가 권장 (INFO). 필수 차단 아님.

---

## 요약

`spec/2-navigation/` 의 전체 파일을 검토한 결과, 기존 Rationale 에서 명시적으로 기각된 대안이 무근거로 재도입된 사례는 발견되지 않았다. 대부분의 설계 결정(공유 워크플로우 정의, drawer/Dialog 분리, WebAuthn 자동 전환 금지, 인증 배경 롤백 등)은 Rationale 와 본문이 정합하며 구현 착수에 지장이 없다. 주의가 필요한 유일한 항목은 `2-trigger-list.md §2.3.1` 의 `botToken` 형식 검증 정규식으로, R-12 에서 slack/discord provider 를 추가하면서 해당 정규식이 telegram 전용인지 전체 provider 적용인지 명확하지 않다. 이는 구현자가 잘못된 형식 검증 로직을 작성할 수 있는 위험이며 Rationale 보완이 권장된다. 나머지 INFO 항목들은 Rationale 누락 또는 보강 권장 사항으로 구현 차단 요소가 아니다.

---

## 위험도

LOW
