# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음 (5/5 checker 성공, 전문 전량 확보)

## 전체 위험도
**LOW** — Critical 0건. WARNING 3건(규약 완결성 갭 2건 + plan 체크리스트 위생 1건) 모두 구현 착수를 막지 않음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

> 해당 없음 — Critical 자체가 없음.

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | `410 Gone`(및 `202 Accepted`) 상태 코드가 `2-api-convention.md` §6 상태 코드 표에 미등재 — 4개 문서(`1-auth.md`, `12-webhook.md`, `14-external-interaction-api.md`, `3-error-handling.md`)가 이미 반복 사용 중인 표준 코드가 SoT 표에서 빠져 §5.3 "기본값 SoT" 역할이 불완전 | `spec/5-system/1-auth.md` §1.5.1·§1.5.4·§5 | `spec/5-system/2-api-convention.md` §6 표 | `2-api-convention.md` §6 표에 `410 Gone`/`202 Accepted` 행 추가하거나 "대표 예시일 뿐" 명시. 요구사항/계약 표라 자기반증형 소정정 예외 대상 아님 — planner 턴 권장 |
| 2 | convention_compliance | `PASSWORD_INVALID`(세션 재인증) vs `INVALID_PASSWORD`(비밀번호 변경 확인) — 단어 순서만 다른 별개 에러 코드, 이름이 두 흐름의 차이를 드러내지 않음. `error-codes.md` §3 historical-artifact 레지스트리에도 미등재 | `spec/5-system/1-auth.md` §2.3(재인증 코드 콜아웃)·§5(비밀번호 재확인 코드 콜아웃) | `spec/conventions/error-codes.md` §1 "의미 기반 명명" 원칙 | rename 은 breaking change 라 강제하지 않되, `error-codes.md` §3 에 "의도적 분리·유지" 근거를 등재하거나 `1-auth.md` 내 한 곳에 두 코드 차이를 명시적으로 모아 서술 |
| 3 | plan_coherence | `spec-draft-ws-socket-lifetime-binds-token.md` 체크리스트의 "spec 반영"·"tracker plan 갱신" 두 항목이 같은 커밋(`6ffadb1f4`)에서 이미 완료됐는데도 `[ ]` 미체크로 남아 있음. "구현" 항목도 신설된 `ws-token-expired-socket-lifetime-impl.md`와 상호 링크 없이 중복 추적 중 | `plan/in-progress/spec-draft-ws-socket-lifetime-binds-token.md` (체크리스트, `:190`~`:192`) | `spec/5-system/6-websocket-protocol.md`(§1.2·§1.3·§4.6·§6.1·§9.2·Rationale — 실제로 전부 반영 확인됨), `spec-sync-websocket-protocol-gaps.md`(이미 "결정 완료" 갱신됨) | 두 체크박스를 `[x]`로 갱신. "구현" 항목은 지우지 말고 `ws-token-expired-socket-lifetime-impl.md`로 이관됐다는 포인터 추가 — 구현 착수 자체를 막는 문제는 아님(순수 plan 위생) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `1-auth.md`의 cross-spec 정합 유지 수준이 이례적으로 높음 (데이터 모델·RBAC·AuthConfig·에러 코드·감사 액션·워크스페이스 토큰 모델·계정 잠금·웹챗 IP 완화 8개 교차 지점 전부 실측 대조로 일치 확인) | `spec/5-system/1-auth.md` 전반 | 조치 불요 — 향후 편집 시에도 실측+Rationale 정정 관행 유지 권장 |
| 2 | rationale_continuity | `ws-token-expired-socket-lifetime-impl.md` 구현 계획이 `R-ws-socket-lifetime-binds-token` Rationale(기각된 대안·범위 경계 포함)을 문구 단위로 정확히 따름 — 무근거 번복·invariant 우회 없음 | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` | 조치 불요. 단 "즉시 종료" 요구가 생기면 별개 결정이므로 조용히 plan 확장 말고 새 Rationale + planner 턴 필요 |
| 3 | rationale_continuity | `1-auth.md` 자체 Rationale 이 최근 정정 이력 전부에서 실측·기각 대안·출처를 동반 — 내적 일관성 유지 | `spec/5-system/1-auth.md` §Rationale | 조치 불요 |
| 4 | convention_compliance | `## Overview` 헤딩 미사용 파일 다수(`11-mcp-client.md`, `16-system-status-api.md`, `5-expression-language.md`, `6-websocket-protocol.md`, `7-llm-client.md`, `2-api-convention.md`) — 규약상 "권장"이라 강제 아님 | `spec/5-system/*.md` (6개 파일) | 우선순위 낮음. 해당 파일을 건드릴 계기(구현 착수) 생기면 통일 고려 |
| 5 | plan_coherence | `spec/5-system/1-auth.md` 관련 tracker(`spec-sync-auth-gaps.md`, `auth-guard-reflection-hardening.md`) 미해결 항목 전부 spec 본문의 _(미구현·Planned)_ 표기와 정합, target 이 우회·번복하는 서술 없음 | `spec/5-system/1-auth.md` | 조치 불요 |
| 6 | plan_coherence | WS won't-do 결정(`system.maintenance`·서버발신 app ping 비채택)이 spec 본문·tracker 양쪽에 이미 반영됨 | `spec/5-system/6-websocket-protocol.md` §4.6·§5 | 조치 불요 |
| 7 | naming_collision | `auth.token_expired`(WS 이벤트) vs `token_expired`(Integration status_reason DB 슬러그) vs `TOKEN_EXPIRED`(REST 에러 코드) — 표기 근접하나 spec·코드 양쪽에 이미 "별개 네임스페이스" disambiguation 명시됨, 신규 충돌 아님 | `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` | 조치 불요. 구현 시 세 식별자를 로그/에러 메시지에서 혼용하지 않도록 PR 리뷰에서 재확인 권장 |
| 8 | naming_collision | `auth.token_expired` 를 담을 이벤트 enum 이 `websocket-events.types.ts` 에 아직 없음 | `codebase/backend/src/modules/websocket/websocket-events.types.ts` | 구현 시 기존 `XxxEventType` enum 패턴을 따라 `AuthEventType.AUTH_TOKEN_EXPIRED = 'auth.token_expired'` 형태로 신규 enum 추가 권장 (naming collision 아닌 일관성 권고) |
| 9 | naming_collision | `R-ws-socket-lifetime-binds-token` Rationale ID·target plan 인용 spec 절 번호(§1.2·§1.3·§4.6·§6.1·§9.2) 모두 실체와 일치, drift 없음 | `spec/5-system/6-websocket-protocol.md`, 관련 plan 4곳 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `1-auth.md` ↔ 8개 교차 spec 대조 전부 일치, CRITICAL/WARNING 없음 |
| rationale_continuity | NONE | WS 구현 계획이 `R-ws-socket-lifetime-binds-token` 준수, `1-auth.md` 내적 일관성 유지 |
| convention_compliance | LOW | WARNING 2건 — `410`/`202` 상태 코드 §6 표 미등재, `PASSWORD_INVALID`/`INVALID_PASSWORD` 명명 유사 미등록 |
| plan_coherence | LOW | WARNING 1건 — draft plan 체크리스트가 이미 완료된 항목을 미체크로 방치 + "구현" 항목 상호 링크 부재 |
| naming_collision | NONE | 유일 신규 산출물(`ws-token-expired-socket-lifetime-impl.md`)의 `auth.token_expired` 는 기존 근접 식별자와 이미 disambiguation됨 |

## 권장 조치사항
1. `spec-draft-ws-socket-lifetime-binds-token.md` 체크리스트 2개 항목(`spec 반영`, `tracker plan 갱신`)을 `[x]`로 갱신하고, "구현" 항목에 `ws-token-expired-socket-lifetime-impl.md` 로의 포인터 추가 (plan 위생, WARNING #3 해소).
2. `spec/5-system/2-api-convention.md` §6 상태 코드 표에 `410 Gone`/`202 Accepted` 추가 여부를 planner 턴에서 검토 (WARNING #1 해소, 계약 표라 developer 자기반증형 예외 대상 아님).
3. `PASSWORD_INVALID`/`INVALID_PASSWORD` 명명 유사 건은 `error-codes.md` §3 에 의도적 분리 근거를 등재 (WARNING #2 해소, rename 강제는 아님).
4. (선택) `ws-token-expired-socket-lifetime-impl.md` 구현 시 `websocket-events.types.ts` 에 `AuthEventType` enum 신설 후 `auth.token_expired` 등록 (INFO #8).