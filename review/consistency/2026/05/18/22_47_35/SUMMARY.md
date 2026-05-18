# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불필요.

---

## 전체 위험도
**LOW** — 5개 checker 모두 CRITICAL/BLOCK 발견 없음. WARNING 3건(설계 근거 서술 누락·plan 추적 불일치·HTTP 동사 혼용 명시 누락), INFO 11건.

---

## Critical 위배 (BLOCK 사유)

없음

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Convention Compliance | `§3` 상태 전이 다이어그램에서 `PATCH /notifications/:id/read` 와 `POST` 동사 혼용 — W-48 미결 상태임에도 본문에 명시 없어 독자 혼선 가능 | `spec/data-flow/8-notifications.md §3` mermaid 다이어그램 | `spec/conventions/swagger.md §2-4` (상태 코드·동사 정책) | `## 3` 다이어그램 직하 또는 `§4.2` 에 "단건 읽음 처리 `PATCH`는 W-48 미결 단계에서 현 코드 구현을 따른 것이며, W-48 종결 후 일괄 검토 대상" 한 줄 명시 |
| W-2 | Convention Compliance | `hasRecentByResource` 헬퍼의 `title` 파라미터가 중복 방지 key 에 포함 — title 변경 시 24h guard 우회 사이드 이펙트가 spec/Rationale 어디에도 서술되지 않음 | `spec/data-flow/8-notifications.md §4.4` + Rationale "중복 방지에 dismissed row 포함" | 없음(단독 권위 정의처) | Rationale 에 "title 을 key 에 포함한 이유" 항목 추가 또는 `(workspaceId, type, resourceId)` 3-tuple 로 재검토. 어느 방향이든 의사결정을 Rationale 에 명시해야 함 |
| W-3 | Plan Coherence | `plan/in-progress/notification-websocket-name-sync.md` 의 plan 추적이 실제 작업 상태와 불일치 — `worktree: TBD`, 체크박스 6개 전부 미체크, 선행 조건 해소 기록 없음 | `plan/in-progress/notification-websocket-name-sync.md` frontmatter + 작업 범위 체크박스 | `spec/data-flow/8-notifications.md` (워크트리 내 spec 변경 이미 완료 상태) | ① frontmatter `worktree: notification-websocket-name-sync-1a2b3c` 정정 ② "새 worktree 생성" 체크박스 `[x]` 처리 ③ spec 표기 정정 관련 체크박스 완료된 항목 체크 ④ 선행 조건(`notification-actions-8806b6` PR merge) 해소 주석 추가 |

---

## 참고 (INFO)

중복 제거 후 통합 목록 (총 11건; 동일 사안을 복수 checker 가 지적한 경우 1건으로 통합):

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec + Convention Compliance | WebSocket 표기 정정(`notification.new`, `notifications:{userId}`) — 프로토콜 권위 문서와 정합, 개정 자체는 올바름. 단 현재 파일시스템의 `8-notifications.md`(워크트리 외부)에 구 표기 잔존 | `spec/data-flow/8-notifications.md §1·§2.2` vs 파일시스템 현 상태 | draft PR 머지 시 자동 해소. 별도 조치 불필요 |
| I-2 | Cross-Spec | `integration_action_required` 타입 — data-model §2.19 에서는 이미 Enum 정식 멤버로 확정, target draft §1.1 에서는 "신설 검토" 표현 잔존 | `spec/data-flow/8-notifications.md §1.1` | "향후 신설 검토" 표현을 "이미 `spec/1-data-model.md §2.19` 에 Enum 멤버로 정식 추가됨" 으로 정정 |
| I-3 | Rationale Continuity | Rationale 에 "이전 콜론 표기는 오기로서 의도적 설계 결정이 아니었다" 는 단 한 문장 누락 — 미래 검토자가 구 표기를 "한때 채택된 결정"으로 오독할 여지 | `spec/data-flow/8-notifications.md` Rationale "WebSocket emit 표기 정정" 절 | 해당 절에 "콜론 표기는 오기" 라는 한 문장 추가 |
| I-4 | Rationale Continuity | `visible` / `dismissed` 어휘 범위 — dismiss 차원 한정임을 spec/Rationale 에 명시 요망 | `spec/data-flow/8-notifications.md §4.1` + Rationale "어휘 선택" | `spec/0-overview.md §3.4` 또는 알림 spec Rationale 에 "`visible` 어휘는 알림 dismiss 차원에 한정" 한 줄 명시 |
| I-5 | Rationale Continuity | `hasRecentByResource` 의 dismissed row 포함 정책 — 신규 타입(`integration_action_required` 등)도 동일 정책 상속됨을 Rationale 에 선제 명시 없음 | `spec/data-flow/8-notifications.md §4.4` + Rationale "중복 방지에 dismissed row 포함" | "신규 알림 타입도 같은 헬퍼·정책을 그대로 적용한다" 문장 추가 |
| I-6 | Naming Collision | `notification.read` · `notification.dismissed` — follow-up 이벤트가 프로토콜 권위 문서(`spec/5-system/6-websocket-protocol.md §4.4`)에 아직 미등록 | `spec/data-flow/8-notifications.md §4.6` | follow-up phase 착수 전 `6-websocket-protocol.md §4.4` 에 해당 이벤트 행 선행 추가. plan 에 체크박스로 추적 |
| I-7 | Naming Collision | Cafe24 카탈로그 `spec/conventions/cafe24-api-catalog/notification.md` 와 우리 서비스 알림 도메인이 동일 단어 `notification` 공유 — 혼동 방지 주석 없음 | `spec/conventions/cafe24-api-catalog/notification.md` 상단 | 해당 파일 상단에 "본 resource 는 Cafe24 쇼핑몰 알림 관리 API. 우리 서비스 in-app Notification 도메인과 무관" 안내 주석 추가 |
| I-8 | Naming Collision | `spec/2-navigation/9-user-profile.md` 알림 API 목록에 두 dismiss endpoint 미열거 | `spec/2-navigation/9-user-profile.md` 라인 282-284 | follow-up 으로 두 dismiss endpoint 행 추가해 API 목록 일관성 확보 |
| I-9 | Plan Coherence | plan 의 선행 조건(`notification-actions-8806b6` PR merge) 해소 시점이 plan 문서에 기록되지 않음 | `plan/in-progress/notification-websocket-name-sync.md §의존성` | 해당 절에 "`notification-actions-8806b6` PR merge 완료 (2026-05-18 기준 확인)" 주석 추가 |
| I-10 | Plan Coherence | `notification.read` / `notification.dismissed` 이벤트 이름 규약이 §4.6 에 선명시됨 — plan 체크박스 해당 항목 완료 여부 재검토 필요 | `spec/data-flow/8-notifications.md §4.6` vs `plan/in-progress/notification-websocket-name-sync.md` 마지막 작업 항목 | §4.6 명시를 "결정 완료"로 볼 수 있으면 해당 체크박스 `[x]` 처리; 실제 WebSocket 프로토콜 spec 신설은 별도 후속 항목으로 추적 |
| I-11 | Cross-Spec | `POST /notifications/:id/dismiss` · `POST /notifications/dismiss-all` endpoint — `spec/2-navigation/_layout.md` 는 이미 target 을 forward-reference. `9-user-profile.md` API 표에는 아직 미기재 | `spec/2-navigation/9-user-profile.md` 라인 282-284 | I-8 과 동일 조치 (중복 통합) |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | 다른 spec 과 직접 모순 없음. `integration_action_required` 문구 불일치(INFO) 1건 |
| Rationale Continuity | NONE | 기각 대안 재도입·invariant 위반 없음. Rationale 서술 완성도 보완 제안(INFO) 3건 |
| Convention Compliance | LOW | 규약 직접 위반 없음. HTTP 동사 혼용 미명시(WARNING) + `title` key 설계근거 누락(WARNING) |
| Plan Coherence | LOW | 구현 우회·충돌 없음. plan 추적 불일치(WARNING) 1건 + 선행 조건·체크박스 미갱신(INFO) 2건 |
| Naming Collision | LOW | 신규 식별자 충돌 없음. follow-up 이벤트 미등록·Cafe24 혼동·user-profile API 목록 미갱신(INFO) 3건 |

---

## 권장 조치사항 및 본 PR 의 처리

1. **(즉시·본 PR 에서 처리)** plan 갱신 — frontmatter `worktree` 정정, 체크박스 완료, 선행 조건 해소 주석 추가, complete/ 로 git mv. **W-3 / I-9 / I-10 해소**.
2. **(본 PR 에서 처리)** Rationale "WebSocket emit 표기 정정" 절에 "콜론 표기는 오기로서 의도적 설계 결정이 아니었다" 문장 추가. **I-3 해소**.
3. **(본 PR 범위 외 — 별도 follow-up plan 권장)** W-1 · W-2 · I-2 · I-4 · I-5 · I-6 · I-7 · I-8 · I-11 — 본 작업 (emit 이벤트명·채널명 spec sync) 의 범위 밖. 각 항목은 해당 spec / 영역의 별도 작업으로 추적해야 한다. 본 PR 에서 일괄 처리하면 PR 응집도 손실 + 리뷰 범위 확산.

---

> Note: SUMMARY.md 는 본 세션의 consistency-summary sub-agent 가 본문을 main 에 반환했으나 output_file Write 가 누락되어 main Claude 가 받은 본문을 본 파일로 보존했다 (2026-05-18).
