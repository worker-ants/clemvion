# Consistency Check 통합 보고서

**BLOCK: YES** — `naming_collision` checker 가 CRITICAL 1건(함수명 `normalizeApiBase` 반대 계약 중복)을 보고했다.

## 전체 위험도
**HIGH** — 활성 버그는 아니지만, 향후 리팩터가 두 동명 함수를 "같은 것"으로 오인해 통합할 경우 이번 diff 가 막으려는 cross-origin 세션 토큰 유출 취약점이 재도입될 수 있는 잠재 위험. 그 외에는 plan 위생(Gate C stale, 후속 미착지) MEDIUM 및 다수 비차단 INFO.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision | `normalizeApiBase` 함수명이 같은 패키지(`channel-web-chat`) 안에서 정반대 계약으로 중복 정의됨 — 하나는 경로 보존(세션 origin 비교용, 이번 diff 도입), 하나는 경로 제거(데모 하니스, 기존) | `codebase/channel-web-chat/src/lib/session-store.ts:38` (`normalizeApiBase`, 세션 발급-origin 바인딩의 보안 핵심 로직) | `codebase/channel-web-chat/src/app/demo/demo-config.ts:51` (`normalizeApiBase`, `/api` 세그먼트까지 제거) | `session-store.ts` 의 로컬 wrapper 를 제거하고 `stripTrailingSlash` 직접 호출로 인라인화하거나, 유지 시 `normalizeSessionApiBase`/`normalizeApiBaseOrigin` 등으로 개명해 `demo-config.ts` 와 구분. 두 함수의 "경로 보존 vs 제거" 차이를 서로의 JSDoc 에 상호 참조로 명시 |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 이미 `plan/complete/`로 이동한 자매 plan 의 `spec_impact: none` 선언이 같은 changeset 의 후속 review-fix 로 인한 실제 spec 편집과 어긋남 (Gate C 는 형식만 검사해 못 잡는 drift) | `spec/7-channel-web-chat/3-auth-session.md` §3.1-1 (`{executionId, token, expiresAt, endpoints, apiBase}` 필드 열거 + 바인딩 서술 추가) | `plan/complete/webchat-session-apibase-binding.md` frontmatter (`spec_impact: none`) | 아직 push 전이므로 이번 커밋에 frontmatter 를 `spec_impact:\n  - spec/7-channel-web-chat/3-auth-session.md` 로 교정하고, 본문에 review 22_09_46 W3 반영 사후동기화 한 줄 추가 |
| 2 | plan_coherence | RESOLUTION 이 명시적으로 "이 PR 범위 밖"이라 미룬 후속 2건(4-security 위협 표 갱신, wc:boot apiBase 스킴 검증)이 어떤 plan 티켓에도 안착하지 않음 — 이 plan 계열이 이미 3회 학습한 "형제 티켓 분리" 관행 미적용 | `spec/7-channel-web-chat/4-security.md` §1 (위협 표, 재전송-origin 축 부재) / `codebase/channel-web-chat/src/widget/use-widget.ts` (`wc:boot` apiBase 스킴 검증) | `review/code/2026/07/24/22_09_46/RESOLUTION.md` "보류·후속 항목" 절 | 두 항목을 각각 planner 트랙(4-security 위협 축) / developer 트랙(wc:boot 스킴 검증) 신규 `plan/in-progress/*.md` 티켓으로 분리하거나, 기존 3형제 문서(예: `webchat-spec-rationale-followup.md`) 체크리스트에 편입 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `2-sdk.md §3` "재부팅은 execution 을 중복 시작하지 않는다"는 일반 서술이 이번 apiBase 불일치 시 세션 폐기·재시작 예외를 명시적으로 교차 참조하지 않음 (실질 모순은 아님, diff 자체 근거로 오늘은 무해) | `spec/7-channel-web-chat/2-sdk.md` §3 vs `3-auth-session.md` §3.1-1 | `2-sdk.md §3` 문장에 "재전송이 apiBase 를 바꾸면 §3.1 바인딩에 따라 세션 폐기 후 신규 시작" 각주 추가 |
| 2 | rationale_continuity + plan_coherence (중복 지적, 통합) | 신규 apiBase 발급-origin 바인딩 불변식의 설계 근거(레거시 세션 fail-safe 폐기, 정규화 범위 등)가 spec 본문·코드 주석엔 있으나 `## Rationale` 절엔 미승격 — `webchat-spec-rationale-followup.md` 가 추적 중인 패턴의 3번째 사례 | `spec/7-channel-web-chat/3-auth-session.md` (Rationale 절, R3~R6 그대로 R7 없음) | R7 항목 신설(트리거·fail-safe 근거·정규화 범위 명문화) 또는 `webchat-spec-rationale-followup.md` 체크리스트에 3번째 불변식으로 추가 |
| 3 | plan_coherence | `use-widget.ts` 라인 수가 1116줄로 추가 성장(리팩터 백로그 근거 데이터 갱신 필요, 차단 아님). `loadSession`/`sessionEstablished` 호출부는 여전히 2곳으로 그 plan 의 우려가 이번 diff 로 악화되지는 않음 | `codebase/channel-web-chat/src/widget/use-widget.ts` | `webchat-usewidget-extraction.md` 착수 시 최신 줄 수로 갱신 |
| 4 | naming_collision | `stripTrailingSlash` 동일 식별자가 `codebase/frontend`(module-private, `webhook-url.ts`/`widget-base.ts`)와 `codebase/channel-web-chat`(신규 공유 `lib/api-base.ts`)에 중복 존재하나 의미 일치·앱 경계로 격리돼 충돌 아님 | `codebase/channel-web-chat/src/lib/api-base.ts:8` vs `codebase/frontend/src/lib/utils/webhook-url.ts:19`, `widget-base.ts:19` | 조치 불요. 통합 원하면 `codebase/packages/` 공유 유틸 승격 검토 |
| 5 | convention_compliance | `pending_plans`/plan cross-link 사전 점검 — target 6개 spec 문서 모두 `status: implemented`이고 `code:` 글로브 실존 확인, 추가 조치 불요 | 없음 (기록용) | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 2-sdk.md/3-auth-session.md 간 apiBase 예외 교차참조 부재(INFO), 실질 모순 없음 |
| rationale_continuity | LOW | apiBase 바인딩 근거의 `## Rationale` 미승격(INFO), 결정 번복 아님 |
| convention_compliance | NONE | 명명·출력포맷·문서구조·frontmatter·API문서 규약 위반 없음 |
| plan_coherence | MEDIUM | Gate C `spec_impact` stale(WARNING) + RESOLUTION 후속 2건 미착지(WARNING) |
| naming_collision | MEDIUM (checker 자체 평가) — 단 CRITICAL 1건 포함 | `normalizeApiBase` 반대 계약 동명 중복(CRITICAL), `stripTrailingSlash` 무해 중복(INFO) |

## 권장 조치사항
1. **(BLOCK 해소, 최우선)** `codebase/channel-web-chat/src/lib/session-store.ts` 의 로컬 `normalizeApiBase` 를 인라인화(직접 `stripTrailingSlash` 호출)하거나, 유지 시 `demo-config.ts::normalizeApiBase`(경로 제거)와 겹치지 않는 이름으로 개명 + 양쪽 JSDoc 상호 참조 추가.
2. `plan/complete/webchat-session-apibase-binding.md` frontmatter 의 `spec_impact: none` 을 실제 diff(`3-auth-session.md §3.1` 편집)에 맞게 리스트로 교정.
3. RESOLUTION 이 명시한 후속 2건(4-security 위협 축 추가, `wc:boot` apiBase 스킴 검증)을 planner/developer 트랙 신규 티켓 또는 기존 3형제 plan 문서에 안착.
4. (비차단) `3-auth-session.md` 에 R7 Rationale 항목 신설 검토, `2-sdk.md §3` 에 apiBase 예외 각주 추가.
5. (비차단) `webchat-usewidget-extraction.md` 라인 수 데이터 최신화.