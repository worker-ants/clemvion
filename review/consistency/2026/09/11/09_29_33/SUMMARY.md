# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원 CRITICAL 0건, 최고 등급은 WARNING 3건. 전 checker 전문을 인라인으로 확보했고 재시도 필요 항목 없음.

## 전체 위험도
**LOW** — target(`plan/in-progress/spec-draft-chat-channel-conventions.md`)은 직전 `--spec` 라운드(`09_03_56`)가 지적한 CRITICAL 전건(라벨 재사용 `D-1`/`D-2`, 에러 응답/감사 로그 범주 오류, `§5.4.1.2` 정면 충돌)을 개정했고 5개 checker 모두 실측 재검증으로 해소를 확인했다. 남은 것은 인용 SoT 정정 1건·후속 유실 방지 1건·명명 명확화 1건(전부 WARNING, 비차단) 및 다수 INFO.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | convention_compliance | 감사 로그 `details` 자유형의 SoT 로 `conventions/audit-actions.md` 를 인용 — 그 문서 자신이 명시한 "책임 경계"(적재 파이프라인은 `data-flow/1-audit.md §1.1` 소관, `1-auth.md §4.1` 이 실사용 예시)를 벗어남. 이 인용이 `2-api-convention.md §5.3` 본문에 그대로 삽입될 예정이라 향후 편집자를 잘못된 문서로 안내 | `## 결정` CV-1 세 번째 불릿, `## 변경안` #1 | `spec/conventions/audit-actions.md` `## Overview` 책임 경계 절 | 인용을 `1-auth.md §4.1` + `data-flow/1-audit.md §1.1` 로 정정하고 `audit-actions.md` 는 이 맥락에서 제외 |
| 2 | plan_coherence | CV-2 의 `swagger.md` 신규 `§1-7` 삽입(198줄 부근, 315줄보다 앞)이 `codebase/backend/.../chat-channel-config.dto.ts:365` 의 `swagger.md:315` 줄-번호 인용을 실제로 stale 하게 만드는데, 이 후속(§3 참조로 수정, developer 권한)이 target 의 변경안·"이 턴에 하지 않는 것"·체크리스트 어디에도 등재되지 않음. 이 drift 를 잡는 CI 가드도 없음(`dto-jsdoc-citation-guard.ts` 는 날짜만 검사) | `## 결정` CV-2, `## 변경안` #2 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2135-2145` "부수" 절 (동일 tracker 항목의 딸린 후속) | target 의 "이 턴에 하지 않는 것"/신규 등재 목록에 `chat-channel-config.dto.ts:365` 인용 정정(developer, §3 참조로 변경) 항목을 명시 추가하거나, tracker 항목을 닫을 때 이 "부수"만 별도 미해결 항목으로 재등재 |
| 3 | naming_collision | 신규 결정 라벨 `CV-1`~`CV-4` 가 이 저장소가 이미 확립한 "도메인prefix-CV-2자리번호" 요구사항 ID 계열(`CCH-CV-0N`, `ED-CV-0N`)과 토큰(`CV`)을 공유. 특히 CV-4 가 직접 편집하는 `15-chat-channel.md` 자신이 인접 자리에 기존 `CCH-CV-04`(§3.2, Redis `ChannelConversation` 저장 규약)를 보유해 구두·리뷰 중 혼동 여지 | target 문서 22행("결정 라벨은 CV-* 네임스페이스") 및 111~165행 | `spec/5-system/15-chat-channel.md:65-69`(`CCH-CV-01~05`), `spec/3-workflow-editor/_product-overview.md:30-35`(`ED-CV-01~06`) | (1) 이 라벨이 `spec/` 본문에 삽입되지 않고 계획 문서 내부 트래킹 전용임을 한 줄로 명시하거나, (2) `-CV-` 대신 `PC-*`/`DEC-*` 등 다른 토큰 채택 |

문자열 자체의 정확 충돌은 없음(naming_collision 확인 — bare `CV-N` 은 target 문서 밖에 존재하지 않고, `CV-*` 라벨이 `spec/` 본문에 영구 삽입될 계획도 없음)이라 WARNING #3 은 CRITICAL 로 격상하지 않음.

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "3축 표"라는 축약 지시어가 문서 안에 정의돼 있지 않음(실측: §5.4.1 "토큰 변경 (rotation)" 행, `details.field` 3축 셀을 가리킴) | `## 변경안` `5a` 행 → `15-chat-channel.md §5.4.1` | 실행 시 앵커 텍스트("토큰 변경 (rotation)" 행)를 병기 |
| 2 | rationale_continuity | CV-2 신규 명명 규칙에 실제 반례(`ChatChannelUpdateConfigDto`, nested 계열이라 접두 미적용)가 `swagger.md §1-7` 본문에 명시돼 있지 않음 | `## 결정 > CV-2`, `변경안` 표 2행 | `swagger.md §1-7`(또는 Rationale)에 `ChatChannelUpdateConfigDto` 를 반례로 직접 인용 |
| 3 | rationale_continuity | CV-3 각주와 `15-chat-channel.md R-CC-21` telegram caveat 가 같은 사실을 두 문서에 독립 서술 — 한쪽만 갱신되면 drift 재발 소지(이 spec 세트가 최근 §5.4.1 필드명/값 층 drift 를 이미 한 번 겪음) | `## 결정 > CV-3`, `변경안` 표 4행 | `chat-channel-adapter.md §1.1` 각주에서 `15-chat-channel.md R-CC-21`(또는 §5.4.1.1 telegram 행) cross-link 추가 |
| 4 | convention_compliance | CV-1 신설 "field 있으면 code 필수" 규칙에 검증 층(강제 메커니즘) 서술 없음 — `§5.4` "검증 층" 소절 관례·`swagger.md §3 Rationale` "강제 없는 규칙은 규칙이 아니다" 선례와 완결성 격차 | `## 결정` CV-1 전체 / `## 변경안` #1 | `§5.3` 본문에 "현 시점 강제 메커니즘 없음 — 신규 발행 지점부터 적용, 기존 15곳은 트래커 항목으로 배선 예정" 상태 명시 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 직전 라운드 CRITICAL 2건·WARNING/INFO 3건 전부 해소 실측 확인. 잔여 INFO 1건(지시어 축약) |
| rationale_continuity | LOW | CV-1~CV-4 어느 것도 기각된 대안 재도입·합의 원칙 위반 없음. INFO 2건(반례 미기재, cross-link 부재) |
| convention_compliance | LOW | WARNING 1건(`audit-actions.md` SoT 오인용이 §5.3 본문에 박제 예정), INFO 1건(강제 메커니즘 미서술). 그 외 명명·배치·인용 다수 정합 확인 |
| plan_coherence | LOW | tracker 3개 결정 항목 정합(우회 아님, 의도된 절차). WARNING 1건(swagger §1-7 삽입이 코드 줄-번호 인용을 stale화, 후속 미등재) |
| naming_collision | LOW | 신규 엔드포인트/DTO/이벤트/ENV/경로 충돌 없음. WARNING 1건(`CV-*` 라벨과 기존 `CCH-CV-0N`/`ED-CV-0N` 계열 토큰 공유, 문자열 완전 충돌은 아님) |

## 권장 조치사항
1. (BLOCK 해소 불필요 — 이미 NO) CV-1 §5.3 개정 문구의 감사 로그 `details` 인용을 `1-auth.md §4.1` + `data-flow/1-audit.md §1.1` 로 정정하고 `audit-actions.md` 인용 제거 (WARNING #1).
2. `swagger.md §1-7` 삽입이 stale 하게 만드는 `chat-channel-config.dto.ts:365` 의 `swagger.md:315` 줄-번호 인용 정정 후속을 target 의 변경안 또는 신규 등재 목록에 명시 추가 (WARNING #2).
3. `CV-1`~`CV-4` 라벨이 `spec/` 본문에 삽입되지 않는 계획 내부 트래킹 전용임을 명시하거나 `-CV-` 토큰을 회피 (WARNING #3).
4. 저비용 INFO 4건(지시어 앵커링, 반례 명시, cross-link, 강제 메커니즘 상태 서술)은 실행자 재량으로 반영 권장.
