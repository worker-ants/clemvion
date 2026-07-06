### 발견사항

- **[WARNING] "type 별 템플릿" → "단일 범용 템플릿" 다운스코프가 spec Rationale 없이 plan 에만 존재**
  - target 위치: `plan/in-progress/spec-sync-data-flow-8-notifications-gaps.md` §PR2 (line 18) — 구현 착수 직전 설계로 `MailService.sendNotificationEmail(to, {title, message, type})` **단일 범용 템플릿**을 채택하고 "per-type 시각 템플릿은 downscope" 라고 명시
  - 과거 결정 출처: `spec/data-flow/8-notifications.md` 본문 3곳이 이미 "type 별 템플릿" 을 to-be 설계로 명문화함 — Overview 구현 현황 주의(line 17: "알림 type 별 템플릿 발송도 ... 코드에 없다"), §1 sequence diagram(line 51: `send (template by type)`), §5 외부 의존 표(line 100: "type 별 이메일 템플릿 (실패 알림, 만료 알림 등)")
  - 상세: target spec 문서는 지금까지 "type 별 템플릿" 을 미구현이지만 확정된 to-be 설계로 세 곳에서 반복 명시해 왔다. 그런데 이번 PR2 착수 plan 은 이 설계를 조용히 "단일 범용 템플릿 + downscope" 로 바꾸면서, 그 근거("대부분 title/message 로 type별 내용 이미 인코딩")를 plan 문서에만 적었다. `developer` 는 `spec/` 를 write 할 권한이 없으므로(CLAUDE.md Skill 체계), 이 구현이 완료돼도 spec 본문의 세 곳("template by type" 등)은 그대로 남아 코드와 어긋나는 stale 상태가 될 위험이 크다. 이는 "결정의 무근거 번복" — 과거 결정을 뒤집으면서 새 Rationale 를 spec 문서 쪽에 함께 작성하지 않은 패턴에 해당한다.
  - 제안: 구현 착수 전(또는 구현과 동시에) `project-planner` 에게 위임해 (a) spec §Overview/§1/§5 의 "type 별 템플릿" 표현을 "단일 범용 템플릿(+ CTA)" 로 정정하고, (b) `## Rationale` 에 다운스코프 근거(예: 워크플로우 목록 태그 필터 다운스코프 Rationale 항목 §4번과 유사한 패턴 — "재확장 여지" 명시)를 새 항목으로 추가할 것. PR2 구현 완료 커밋에 spec 정정을 동봉하거나, 별도 spec-only 후속 커밋으로 즉시 따라붙게 한다.

- **[INFO] `email_sent_at` UPDATE 조건 — "성공 시" 단서가 상태 전이 spec §3 과 완전히 대칭적이진 않음**
  - target 위치: plan §PR2 — "성공 시 `email_sent_at=now` UPDATE" / "best-effort(warn only, 재시도 없음 — spec Rationale)"
  - 과거 결정 출처: `spec/data-flow/8-notifications.md` §3 (line 115-117) "이메일 발송 라이프사이클은 별도 컬럼 `email_sent_at` 으로 추적 ... 설계상 발송 실패는 재시도 없이 warn log 만 둔다" + Rationale "Email 실패는 warn 만, 재시도 없음" (line 217-223)
  - 상세: 이 부분은 plan 과 spec 이 이미 정합적이다(재시도 없음·warn만·성공시만 UPDATE는 spec 설계와 일치). 다만 spec 라인 115-117 이 "실패는 재시도 없이 warn log 만" 이라고만 말하고 "실패 시 email_sent_at 을 채우지 않는다" 를 명시적으로 적진 않아 암묵적 추론에 의존한다 — 구현 완료 후 spec 문구를 "실패 시 `email_sent_at` 은 NULL 로 남는다" 로 한 문장 보강하면 향후 재해석 여지가 줄어든다.
  - 제안: 필수 아님. 구현 완료 시 spec 정정(위 WARNING 항목)과 함께 한 줄 보강 권장.

### 요약
Target(`spec/data-flow/8-notifications.md`)에 정의된 warn-only/no-retry, soft-delete(`dismissed_at`), 중복 방지 dismissed 포함, WebSocket 표기 등 기존 Rationale 원칙들은 PR2 구현 계획과 대체로 정합적이며 명시적으로 기각된 대안을 재도입하는 패턴은 없다. 다만 spec 본문이 세 곳에서 반복 명시해 온 "type 별 이메일 템플릿" to-be 설계를, 구현 착수 plan 이 spec 을 갱신하지 않은 채 "단일 범용 템플릿" 으로 조용히 다운스코프하고 있다 — 이는 CLAUDE.md 의 "구현 중 spec 변경 필요 시 developer 는 멈추고 project-planner 위임" 원칙 및 Rationale 연속성 원칙(결정 번복 시 새 Rationale 필수) 모두에 걸리는 갭이다. Critical 급 invariant 위반은 아니지만, 구현이 spec 을 stale 하게 만들 것이 사실상 확정적이므로 착수 전 조치가 필요하다.

### 위험도
MEDIUM
