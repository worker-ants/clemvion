# Cross-Spec 일관성 검토 결과

대상: `spec/7-channel-web-chat/` (0-architecture / 1-widget-app / 2-sdk / 3-auth-session / 4-security / 5-admin-console), 모드 = `--impl-prep`

교차 검증 대상(파일 시스템에서 직접 확인): `spec/conventions/conversation-thread.md`, `spec/5-system/14-external-interaction-api.md`,
`spec/4-nodes/6-presentation/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/5-system/6-websocket-protocol.md`,
`spec/5-system/12-webhook.md`, `spec/2-navigation/9-user-profile.md`, `spec/2-navigation/2-trigger-list.md`,
`spec/5-system/1-auth.md`, `spec/5-system/4-execution-engine.md`, `spec/1-data-model.md`, `spec/2-navigation/_product-overview.md`,
`spec/0-overview.md`. (payload 에는 이 중 `0-overview.md`/`1-data-model.md` 만 포함돼 나머지는 리포지토리에서 직접 열람해 대조함.)

## 발견사항

### [WARNING] EIA §8.4 `/interact` rate-limit 구현 상태 — 4-security.md 가 stale 서술로 SoT 와 모순

- **target 위치**: `spec/7-channel-web-chat/4-security.md` §4 "공개(인증 없음) webhook 남용 방어" 블록쿼트:
  > "기존 EIA §8.4 유지 — **SSE 동시 3/execution 은 구현됨**(초과 시 `429 TOO_MANY_CONNECTIONS`), **interact 분당
  > 60/execution 은 Planned(미구현)**. 두 제한의 구현 상태가 다르므로 분리 기재한다([EIA §8.4](...))."
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md` §8.4 (Rate Limit 표)
  > `| Inbound 명령 (\`/interact\`) | execution 당 분당 60 | **구현됨** — \`InteractionRateLimiterService\`(Redis
  > fixed-window, fail-open) + \`InteractionRateLimitGuard\`. 초과 시 \`429 RATE_LIMITED\` + \`Retry-After\` |`
- **상세**: target 은 자신이 인용하는 바로 그 SoT(EIA §8.4)를 근거로 "interact 분당 60 은 Planned"라고 명시적으로
  주장하지만, 현재 EIA §8.4 본문은 정반대로 "구현됨"이라고 적혀 있다. 코드도 이를 뒷받침한다
  (`codebase/backend/src/modules/external-interaction/interaction-rate-limiter.service.ts`,
  `interaction-rate-limit.guard.ts` 존재). git 이력상 EIA §8.4 는 한때 "미구현 (Planned)" 상태였다가 이후 커밋에서
  "구현됨"으로 갱신됐는데, `4-security.md` 의 해당 문장은 그 갱신을 반영하지 못하고 옛 상태를 그대로 인용한 채
  "두 제한의 구현 상태가 다르므로 분리 기재한다"는 (현재는 틀린) 대비 서술까지 남아 있다. 실제로는 SSE 3/execution
  과 interact 60/execution 둘 다 구현 완료 상태이므로 "분리 기재" 근거 자체가 사라졌다.
- **제안**: `4-security.md` §4 를 "SSE 동시 3/execution, interact 분당 60/execution 모두 구현됨"으로 정정하거나,
  해당 문장을 삭제하고 단순히 EIA §8.4 를 참조만 하도록 축약한다(중복 서술이 drift 재발의 원인이므로 규범 문구를
  한쪽에만 두는 편이 더 안전). `--impl-prep` 단계 코드 작업 착수 전 정정 권장(실제 rate-limit 은 이미 존재하므로
  구현 재작업을 유발하지는 않으나, 리뷰어/구현자가 "아직 없다"고 오인해 중복 구현·잘못된 QA 범위를 잡을 위험).

### [WARNING] NAV-WC-06 "라이브 미리보기" 요구사항 상태가 stale — 이미 완료된 작업을 🚧 로 표시

- **target 위치**: `spec/7-channel-web-chat/5-admin-console.md` §6 "라이브 미리보기 (same-origin 동봉 iframe)" —
  프론트매터 `status: implemented`, 본문은 iframe 부팅 프로토콜(§6.1)·CORS·race 보정·2-column 레이아웃까지 이미
  구현된 것으로 상세 서술. `spec/0-overview.md` §6.2 도 "영역 spec 6문서 전부 `implemented`(영역 종결)"이라 명시.
- **충돌 대상**: `spec/2-navigation/_product-overview.md` (NAV-WC 요구사항 카탈로그, line 222)
  > `| NAV-WC-06 | 라이브 미리보기 (M1 hosted iframe, 위젯 동봉 선행). 조회·복사·미리보기 viewer+ | 권장 |
  > 🚧 (증분 2 — 위젯 co-deploy 후) |`
- **상세**: NAV-WC-06 은 "위젯 co-deploy 이후(증분 2)"에나 완료된다는 전제로 🚧(미완료) 표시돼 있으나, 실제로는
  `plan/complete/web-chat-console.md`(status: complete)에 "Phase 1 — 위젯 동봉(co-deploy)… ✅ 완료" · "Phase 3 —
  라이브 미리보기… ✅ 완료"로 기록돼 있고, 후속 `plan/complete/web-chat-console-management.md`(2026-06-24 시작)도
  "현재 생성·외형편집·저장·스니펫복사·**미리보기**만 제공한다"고 전제해 라이브 미리보기가 이미 동작 중임을 확인해준다.
  `5-admin-console.md` 자체도 구현 완료 서술이라 NAV-WC-06 행만 stale 하게 남은 것으로 보인다.
- **제안**: `spec/2-navigation/_product-overview.md` NAV-WC-06 상태를 ✅ 로 갱신(같은 표의 NAV-WC-01~05 와 정합).
  `project-planner` 소관 — `spec/7-channel-web-chat/**` 변경이 아니라 `spec/2-navigation/_product-overview.md` 요구사항
  카탈로그만의 정정이라 이번 target PR 범위 밖일 수 있으나, 남겨두면 "아직 증분 2 대기 중"이라는 잘못된 인상을 주므로
  같은 커밋 또는 팔로우업으로 정리 권장.

## 검증 완료 — 충돌 없음 (참고)

아래 항목들은 target 이 다른 영역 spec 을 구체적으로 인용하는 대목이라 원본과 직접 대조했으며, 모두 정합했다:

- `1-widget-app.md` §2 메시지 리스트 행의 presentation 복원 제약(두 shape 수용·`turn.presentations[]` 는
  `source:'ai_assistant'` 한정) — `conversation-thread.md` §1.2/§2.1, `0-common.md`(presentation) §10.4/§10.6/§10.7,
  AI Agent §7.10 과 문구까지 정확히 일치. `conversation-thread.md` §2.1 은 이 위젯 문서를 소비 측으로 역참조하고
  있어 상호 정합이 이미 맞물려 있다.
- `3-auth-session.md` §3.1 의 EIA `getStatus`(§5.3)·`conversationThread` 동봉·`replay_unavailable` 서술은
  EIA §5.3·§R17·§R-replay-unavailable 과 정합(오히려 EIA §R17 이 본 위젯 문서를 "이미 계약으로 둔" 근거로 인용).
- `0-architecture.md` §3 의 SSE wire 필드명 drift 메모(`waitingNodeId`/`node.id`/`nodeId`)는 EIA §6.2, WS §4.4 의
  실제 payload 예시와 정확히 일치.
- `4-security.md` R6(IP 미식별 공유 버킷) ↔ `1-auth.md` §2.3.B(m-3), `12-webhook.md` WH-SC-05/WH-SC-09 상호 참조 정합.
- `5-admin-console.md` §2/§7 의 트리거 재사용·RBAC(editor+/viewer+) ↔ `2-trigger-list.md` §2.5, endpointPath UUID
  클라이언트 생성 규약과 정합.
- `4-security.md` §2.1 의 `interactionAllowedOrigins`/`PATCH /api/workspaces/:id/settings`(Admin+) ↔
  `1-data-model.md` §2.2, `9-user-profile.md` §4.3/§6.1 과 정합.
- `1-widget-app.md` §3.1 "새 대화" 행의 "이전 execution 은 `waiting_for_input` 로 무기한 보존" ↔
  `4-execution-engine.md` §7.4/§7.5 "무기한 보존" 서술과 정합.
- 신규 요구사항 ID(NAV-WC-01~06)는 `2-navigation/_product-overview.md` 카탈로그에서 다른 의미로 재사용되지 않음.

## 요약

`spec/7-channel-web-chat/` 자체의 6개 문서 간, 그리고 EIA·conversation-thread·presentation·AI Agent·WS 프로토콜·
webhook·데이터 모델·RBAC 등 인접 영역과의 교차 참조는 대체로 최근에 잘 동기화돼 있다(특히 이번 검토 대상인 presentation
복원 관련 서술은 `conversation-thread.md` 쪽과 상호 역참조까지 갖춰 정합성이 높다). 다만 두 건의 **상태(status) drift**
를 발견했다 — (1) `4-security.md` 가 EIA §8.4 `/interact` rate-limit 을 "Planned"로 잘못 인용해 자신이 근거로 든
SoT 와 직접 모순되는 문장이 남아 있고, (2) `2-navigation/_product-overview.md` 의 NAV-WC-06 이 이미 완료된 라이브
미리보기를 🚧 로 표시해 `5-admin-console.md`/`0-overview.md`/완료된 plan 들과 어긋난다. 둘 다 기능을 깨뜨리는
데이터 모델·API 계약 충돌은 아니며 "사실관계 서술의 최신성" 문제이므로 WARNING 등급이 적절하다.

## 위험도

MEDIUM
