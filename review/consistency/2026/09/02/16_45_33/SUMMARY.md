# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 5개 checker 전원 결과 확보(전문 인라인 제공, 재시도 불요).

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 4건은 모두 "이미 인지·계획된 disambiguation/스코프 명시가 아직 spec 본문에 반영 안 됨" 류의 문서 정합성 이슈이며 target 의 핵심 결정(소켓 수명을 토큰 `exp` 에 종속, 60초 lead time)에는 영향 없음.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | `2-api-convention.md §10.4` 의 "재연결" 요약이 이번 결정의 새 예외(서버발신 disconnect 는 자동 재연결 대상 아님)를 반영 못해 더 stale 해짐 | 변경안 표 #6(§6.1), #7(§9.2) | `spec/5-system/2-api-convention.md §10.4` | §10.4 caveat 에 "단, 서버발신 disconnect(`auth.token_expired` 후속)는 예외" 한 줄 추가, 또는 draft Rationale 에 "§10.4 는 기존에도 stale, 본 draft 범위 밖" 스코프아웃 명시 |
| 2 | cross_spec | "인가 갭을 닫는다"는 결론이 실은 토큰 자연만료(`exp`) 경로만 닫고, 명시적 revoke(비번 변경·탈취 의심 등 1-auth.md §1.4/§2.3 "즉시 종료") 경로는 그대로 열어 둠 — access token 은 자연 `exp`(최대 15분)까지 계속 소켓 인가 유지 | "## 배경 — 인가 갭이다" / "## 결정" | `spec/5-system/1-auth.md` §1.4, §2.3, `token_reuse_detected` | 구현 메모/Rationale 에 "명시적 revoke 는 이 타이머의 관심사가 아니다 — 그 소켓은 access token 자연 exp 까지 산다" 카브아웃 추가 |
| 3 | rationale_continuity | payload 표기 근거로 인용한 `auth.refreshed.expiresAt` 는 §1.3 에서 **비채택(won't-do)** 확정된 죽은 참고 예시(실 emit/handler 0건)인데, "이 문서의 다른 시각 필드"라며 활성 선례처럼 인용 | "payload 를 `{ message }` → `{ message, expiresAt }` 로" 문단 | `spec/5-system/6-websocket-protocol.md` §1.3(:56-66, won't-do) | 인용 대상을 §4.2 `_retryState.expiresAt`(구현됨, 실동작)로 교체하거나, 계속 인용 시 "won't-do 참고 예시일 뿐 구현 선례 아님" caveat 추가 (결정된 포맷 자체엔 영향 없음) |
| 4 | naming_collision | `expiresAt` 필드명이 같은 문서 안에서 이미 두 가지 의미(살아있는 `_retryState.expiresAt`=AI retry TTL, 죽은 `auth.refreshed.expiresAt`=새 토큰 만료시각)로 쓰이는데 target 이 세 번째 의미(소켓 disconnect 시각)를 더함. target 이 인용한 비교대상이 죽은 예시라 실제 충돌 위험(살아있는 `_retryState.expiresAt`)을 과소평가 | "payload 를 `{ message }` → `{ message, expiresAt }` 로" 문단, §4.6 표 반영 계획 | `spec/5-system/6-websocket-protocol.md:448` `_retryState.expiresAt` | §4.6 반영 시 disambiguation 문구에 `_retryState.expiresAt` 도 명시적으로 포함: "이 소켓이 강제 종료되는 시각 — `_retryState.expiresAt`(AI retry TTL)·`auth.refreshed.expiresAt`(비채택)와 별개" |

> #3·#4 는 같은 `auth.refreshed.expiresAt` 인용을 다른 각도(근거의 정확성 vs 명명 충돌 위험 과소평가)에서 지적하며 서로 보강 관계다 — 하나의 수정(위 제안대로 §4.6 disambiguation 을 `_retryState.expiresAt` 까지 포함해 작성)으로 둘 다 해소 가능.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "60초는 15분의 4%" 산술 오차(실제 60/900=6.7%) | "### 왜 lead time 인가 · 왜 60초인가" | "4%" → "약 6.7%" 로 정정 (결정 자체엔 영향 없음) |
| 2 | rationale_continuity | "구현 메모"의 R10/R15/R19 대비 자기 설계 구분 논증(프로세스 종속 자원이라 durable reconciliation 불필요)이 타당하지만, 신설 spec Rationale `R-ws-socket-lifetime-binds-token` 항목에 포함될지 불명확 | "## 구현 메모 (developer 트랙)" vs 변경안 표 #8 | spec Rationale 신설 시 이 구분 논증을 한 문단으로 옮겨 실을 것 |
| 3 | plan_coherence | target 문서에 `## 체크리스트` 섹션이 없어 `--spec` 게이트 통과 여부·spec 반영 커밋 여부를 기록할 자리가 없음 | 문서 전체 | 하단에 `## 체크리스트` 추가 (spec 반영 커밋 시점에 해도 무방, 당장 차단 사유 아님) |
| 4 | plan_coherence | 형제 draft `spec-draft-ws-wontdo-maintenance-appping.md` 의 spec 변경은 이미 landed(spec·tracker 정합 확인됨)인데 draft 파일 자체는 미체크 상태로 `in-progress/` 잔존 — target 결함 아니지만 같은 spec/tracker 공유 | 없음(인접 plan) | 이번 세션 마무리 시 해당 draft 체크리스트 채우고 `plan/complete/` 로 이동 |
| 5 | naming_collision | `auth.token_expired` 문자열이 Integration.statusReason(cafe24/makeshop) 값으로도 존재하나 코드 주석이 이미 네임스페이스 분리를 명시, target 배경조사도 정확 | 배경 표 | 조치 불요 (기록용) |
| 6 | naming_collision | 신규 Rationale ID `R-ws-socket-lifetime-binds-token` 은 저장소 전체에서 유일, 관례(`R-<slug>`) 부합 (슬러그 길이만 선례보다 김) | `## Rationale` 신설 항목 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | §10.4 재연결 요약 stale 화(WARNING), 명시적 revoke 경로는 이 타이머가 안 닫음(WARNING), 4% 산술 오차(INFO) |
| rationale_continuity | LOW | `auth.refreshed.expiresAt` 를 죽은 예시인데 활성 선례처럼 인용(WARNING), R10/R15/R19 구분 논증의 spec 반영 여부 불명확(INFO) |
| convention_compliance | NONE | 명명·frontmatter·서식·역할경계 전 축 규약 준수, 위반 없음 |
| plan_coherence | NONE | tracker 의 두 미해결 결정 항목을 정확히 겨냥해 답함, plan 충돌·선행 미해소·후속 누락 없음(INFO 2건은 문서 위생) |
| naming_collision | LOW | `expiresAt` 3중 의미 중 살아있는 `_retryState.expiresAt` 와의 충돌 위험 과소평가(WARNING), 나머지 신규 식별자는 충돌 없음(INFO) |

## 권장 조치사항

1. §4.6 표 반영 시 `expiresAt` disambiguation 문구를 `_retryState.expiresAt`(살아있는 필드) 까지 포함해 작성 — WARNING #3·#4 동시 해소.
2. `2-api-convention.md §10.4` 에 서버발신 disconnect 예외 한 줄 추가 또는 draft Rationale 에 스코프아웃 명시 — WARNING #1.
3. 구현 메모/Rationale 에 "명시적 revoke 는 이 타이머 관심사 아님, access token 자연 exp 까지 소켓 유지" 카브아웃 추가 — WARNING #2.
4. (선택, 비차단) "4%"→"약 6.7%" 정정, `## 체크리스트` 섹션 추가, 형제 draft `spec-draft-ws-wontdo-maintenance-appping.md` complete/ 이동.