# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보(모두 status=success, 인라인 전문 authoritative). CRITICAL 발견 0건.

## 전체 위험도
**MEDIUM** — CRITICAL 없음. `convention_compliance` 가 신규 표면(Chat Channel Bot Token Rotation API)이 스스로 "단일 진실" 이라 선언한 두 카탈로그(에러 코드 §1, rate-limit §7)에 등재되지 않은 WARNING 2건 + 절 번호 중복 WARNING 1건을 냈고, `plan_coherence`가 이 PR 완료가 다른 트래커 항목의 재평가 조건을 충족시킨다는 사실이 plan 에 미반영된 WARNING 1건을 냈다. 모두 구현 착수를 막을 사유는 아니다.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance + Cross-Spec (중복 통합, INFO→WARNING 상향) | 신규 에러 코드 6종(`INVALID_BOT_TOKEN`·`CHAT_CHANNEL_NOT_CONFIGURED`·`CHAT_CHANNEL_PROVIDER_UNKNOWN`·`CHAT_CHANNEL_ENDPOINT_REQUIRED`·`BOT_TOKEN_INVALID`·`CHAT_CHANNEL_SETUP_FAILED`)가 중앙 에러 카탈로그에 미등재 | `spec/5-system/15-chat-channel.md` §5.4 (Bot Token Rotation API 응답 계약 표) | `spec/5-system/2-api-convention.md` §5.3 "어느 쪽을 택하든 [에러 처리 §1] 카탈로그에 등재한다 — 등재되지 않으면 소비자가 존재를 알 방법이 없다" / `3-error-handling.md §1` / `conventions/error-codes.md` (grep 0건 실측 확인) | `3-error-handling.md`에 `§1.12 Chat Channel Bot Token Rotation 에러 코드 (도메인 spec 참조)` 서브섹션 신설, 6개 코드+status+SoT 등재. 의도적 생략이라면 그 사유를 `15-chat-channel.md` Rationale 에 명시 |
| 2 | Convention Compliance | `CCH-NF-03`(per-chat rate limit, 기본 60 req/min, 1–600 override, `ChatChannelRateLimiterService`)가 §7 Rate Limiting "단일 진실" 표에 미등재 | `spec/5-system/15-chat-channel.md` §3.6 CCH-NF-03 | `spec/5-system/2-api-convention.md` §7 "throttle 수치의 단일 진실은 본 표다" — 형제 사례(EIA inbound·SSE 동시연결)는 이미 행으로 등재돼 있음 | §7 표에 "Chat Channel inbound (per-chat)" 행 추가, SoT `15-chat-channel.md#36-비기능-요구사항` 링크 |
| 3 | Convention Compliance | `15-chat-channel.md` Overview 내부 `### 3. 요구사항`(§3.1~§3.6)과 Overview 밖 `## 3. 처리 흐름`(자체 §3.1~§3.3)이 "3.x" 절 번호를 중복 사용 — "§3.3"이 문서 안에 두 곳(CCH-MP-* / SSE 어댑터 병존) 존재 | `spec/5-system/15-chat-channel.md` 목차 구조 | `.claude/skills/project-planner/SKILL.md` Overview/본문/Rationale 3섹션 구조 + 형제 문서(`12-webhook.md`·`14-external-interaction-api.md`·`1-auth.md`) 패턴 | (a) "요구사항"을 Overview 밖 최상위 `## 3. 요구사항`으로 승격하거나 (b) Overview 유지 시 처리 흐름 이하 섹션 번호를 4부터 재시작 |
| 4 | Plan Coherence + Rationale Continuity (중복 통합, INFO→WARNING 상향) | 이번 PR(작업 2~4, slack/discord/telegram adapter `code` 부착)의 완료가 `spec-draft-nullable-notation-followups.md` 의 "CCA §1.1.2 401/403 fallback 제거 판정" 항목이 스스로 지정한 착수 신호("v1 provider 3종 전부 `code` 부착 완료")를 정확히 충족시키는데, 이 사실이 `impl-setup-error-code.md` 본문·체크리스트 어디에도 cross-link 로 남지 않음 | `plan/in-progress/impl-setup-error-code.md` 체크리스트 | `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "CCA §1.1.2 fallback 제거 판정" 항목 (착수 신호 = 이 PR 의 작업 2~4) | `impl-setup-error-code.md` 체크리스트에 "완료 시 `spec-draft-nullable-notation-followups.md` fallback 제거 판정 항목 착수 신호 충족 — 완료 링크 남기기" 한 줄 추가, 또는 커밋/PR 본문에 명시. 같은 파일이 인접 항목("chatChannelLastError 원문 노출"이 22개 세션 유실)에서 "미기록의 대가"를 이미 경고해 둠 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `chat-channel-input-rules.ts` §7 파일 트리 서술("입력 검증·변환 순수 함수")이 이번 턴이 배치하는 `translateSetupChannelError`(출력측 에러 변환)의 실제 책임과 결이 다름 — developer 가 §7 서술만 보고 오배치할 여지 | `spec/5-system/15-chat-channel.md` §7 구현 파일 트리 | 이번 턴에서 `translateSetupChannelError` 를 완성한 뒤 §7 주석에 "출력측(에러 변환)" 한 줄 추가 (기존 트래커에 이미 유예됨, 선택 사항) |
| 2 | Rationale Continuity | Slack 자격 증명 거부 열거 5값(`token_expired` 포함)이 `slack.md §3.1` 의 개방형 서술("...")을 코드가 최초로 확정 — spec 이 아직 반영 안 됨 | `plan/in-progress/impl-setup-error-code.md` 설계 판단 (c) / `spec/4-nodes/7-trigger/providers/slack.md` §3.1 | 후속 작은 spec PR(planner 턴)로 `slack.md` §3.1 의 "..." 를 확정 5값으로 정정 |
| 3 | Plan Coherence | `chat_channel_last_error` 컬럼 원문 노출 미해결 항목(별도 트래커, 3개월 22세션 유실 기록)과 인접하나 이번 PR 의 대상 아님 — "원문 echo 중단"이 HTTP 응답 본문 한정이지 DB 컬럼까지 포함하는 것으로 오독될 여지 | `spec/5-system/15-chat-channel.md` §4.2 | PR 설명/커밋 메시지에서 "원문 노출 제거"가 응답 본문(HTTP envelope) 한정임을 명시, DB 컬럼은 별도 트래커 항목이 담당 |
| 4 | Naming Collision | `code` 프로퍼티 다의성 표(`chat-channel-adapter.md §1.1.2`)가 "세 뜻"만 열거하나, 같은 호출 스택에 Node/undici 표준 네트워크 시스템 에러의 `.code`(`ENOTFOUND` 등)가 이미 존재 — 문서화되지 않은 네 번째 뜻. 정확 일치 판별이라 당장 위험은 낮음 | `spec/conventions/chat-channel-adapter.md:165-173` | 다의성 표에 "네트워크/시스템 `Error.code`(Node 표준)" 행 추가 + "판별은 항상 화이트리스트 값과의 정확한 문자열 일치" 명시 |
| 5 | Naming Collision | 신규 `credentialRejected` 헬퍼(프로퍼티 부착 팩토리)가 저장소의 기존 "credential 실패" 관례(`Cafe24IncompleteCredentialsError` 등 PascalCase `Error` 서브클래스)와 다른 형태 — 이름 충돌은 없음 | `chat-channel/types.ts` (신설 예정) | 헬퍼 JSDoc 에 "cafe24/makeshop 패턴과 달리 서브클래스가 아니라 프로퍼티" 한 줄 추가 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | NONE | `#1323` 커밋 재검증 — 이전 라운드 WARNING/INFO 전부 최종본에 반영 확인, 신규 CRITICAL/WARNING 없음 |
| Rationale Continuity | LOW | 결정 번복·기각 대안 재도입 없음. INFO 2건(트래커 cross-link 누락, 개방형 열거의 spec 미확정) |
| Convention Compliance | MEDIUM | 신규 에러 코드/rate-limit 이 문서 자신의 "단일 진실" 카탈로그 2곳에 미등재(WARNING 2건) + 절 번호 중복(WARNING 1건) |
| Plan Coherence | LOW | plan 이 트래커 순서를 정확히 따름. WARNING 1건(이 PR 이 충족시키는 다른 항목 착수 신호 미반영) |
| Naming Collision | LOW | 신규 식별자 충돌 0건(전수 grep). INFO 2건(다의성 표 보완, 명명 패턴 불일치 문서화 권장) |

## 권장 조치사항
1. `3-error-handling.md`에 `§1.12` 서브섹션 신설해 신규 에러 코드 6종 등재 (WARNING #1 — BLOCK 사유는 아니나 카탈로그 완결 조건 충족)
2. `2-api-convention.md §7` 표에 Chat Channel per-chat rate limit 행 추가 (WARNING #2)
3. `15-chat-channel.md` 절 번호 중복 해소 — 요구사항 섹션 승격 또는 재번호 (WARNING #3)
4. `impl-setup-error-code.md` 체크리스트에 "CCA §1.1.2 fallback 제거 판정 착수 신호 충족" cross-link 추가 (WARNING #4)
5. (선택) `slack.md §3.1` 자격 증명 거부 5값 확정을 반영하는 후속 spec PR 등록
6. (선택) `chat-channel-adapter.md §1.1.2` 다의성 표에 Node 네트워크 시스템 에러 `.code` 행 추가 및 정확 일치 판별 원칙 명시
