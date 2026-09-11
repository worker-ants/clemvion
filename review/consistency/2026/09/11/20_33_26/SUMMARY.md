# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 결과 확보(전문 authoritative), CRITICAL 발견 0건. 최고 등급은 cross_spec 의 WARNING(MEDIUM 위험도)이며 차단 사유 없음.

## 전체 위험도
**MEDIUM** — CRITICAL 없음. cross_spec 이 draft 의 "드리프트 범위는 3곳" 완결성 주장 자체를 재현 검증으로 반증(같은 T1/T2 이동이 만든 동일 클래스 드리프트가 draft 의 grep 축 밖에 최소 2곳 더 있음)해 WARNING 2건을 냈고, convention_compliance 가 편집 지시문 표기 관례 WARNING 1건을 추가.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | T1(#1319)이 옮긴 `assertInboundSigningPlaintextByProvider` 의 `TriggersService.` 접두가 draft 의 "3곳" 스코프 밖에 남음 — draft 는 `setupChatChannel` 문자열 기준으로만 전수 분류해 다른 함수명 축의 동일 드리프트를 놓침 | `plan/in-progress/spec-draft-chat-channel-binder-drift.md` §③ "귀속 표기 3곳" 및 완결성 서술 | `spec/4-nodes/7-trigger/providers/slack.md:275`, `spec/4-nodes/7-trigger/providers/discord.md:297` (해당 함수는 커밋 `ba634a4b0` 로 이미 `TriggersService` 밖으로 이동, 현재 `chat-channel-input-rules.ts` 의 독립 함수) | draft §③에 네 번째 항목으로 두 파일 추가, 또는 "이 턴은 `setupChatChannel` 심볼만 다루고 이 귀속은 별도 트래커 항목" 으로 스코프를 명시적으로 좁혀 완결성 주장과 실제 범위를 일치시킴 |
| 2 | cross_spec | 편집 대상 파일 내부(§0 대 §1.3)가 draft 적용 후 서로 다른 파일을 지목하게 됨 — draft 의 리터럴 문자열 매칭이 함수명 없는 표 헤더를 못 봄 | `spec/data-flow/14-chat-channel.md` §0 (draft ⓒ 편집 대상) | 같은 파일 §1.3 (`:148-150`) 표 헤더 `흐름 (\`triggers.service.ts\`)` 및 "최초 setup" 행 — ⓒ 적용 후 §0(binder 로 정정)과 §1.3(구식, triggers.service.ts 로 남음)이 상충 | §1.3 표 헤더를 열 분리하거나 "최초 setup 은 `chat-channel-binder.service.ts` 귀속" 각주 추가 — draft ⓒ 편집과 같은 턴에 반영 권장 |
| 3 | convention_compliance | §③(c) 편집 지시의 "변경" 인용이 `…/` 경로 축약을 쓰는데, 대상 문서(`data-flow/14-chat-channel.md` §0) 의 다른 모든 불릿과 draft 자신의 "현행" 인용은 전체 경로를 씀 — 문자 그대로 spec 본문에 들어갈 텍스트인지 접두 생략 표기인지 draft 내부에서 모호 | `plan/in-progress/spec-draft-chat-channel-binder-drift.md` §③(c) "변경" 두 줄 | `spec/data-flow/14-chat-channel.md` §0 의 확립된 "전체 경로 나열" 관례 (선례 0건 축약) | 실제 spec 편집 시 `…/` 를 `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts` 등 전체 경로로 펼쳐 쓸 것. draft 자체는 보존 대상이므로 "실제 spec 에는 전체 경로 사용" 주석 한 줄 추가 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `providers/telegram.md:58` 의 "caller (TriggersService)" 서술이 draft ⓑ 와 동일 패턴(binder 가 실제 caller)인데 draft 범위 밖 | `spec/4-nodes/7-trigger/providers/telegram.md:58` | 여유 있으면 같은 턴에 정정하거나 트래커에 후속 항목으로 명시 |
| 2 | rationale_continuity | 신규 R-CC-* glob 결정 Rationale 이 상위 `spec-impl-evidence.md` R-1(glob 허용 일반 원칙)을 cross-ref 하지 않아, "이 spec 만 예외적으로 glob" 으로 오독될 위험 | `spec/5-system/15-chat-channel.md` `## Rationale` (신규 항목) | `[spec-impl-evidence.md §R-1]` cross-ref 추가 |
| 3 | rationale_continuity | 신규 Rationale ID 번호가 draft 에 확정돼 있지 않음(병렬 세션과 번호 충돌 가능) | 동일 | spec 반영 직전 `grep '^### R-CC-' spec/5-system/15-chat-channel.md` 로 재확인 후 확정 |
| 4 | convention_compliance | §② §7 편집안 코드펜스 안 `**호출만**` 이 GFM 상 리터럴 별표로 렌더링, 같은 블록의 다른 주석과 스타일 이질 | `spec/5-system/15-chat-channel.md` §7 (신규 편집) | 순수 텍스트로 변경 또는 의도적 리터럴이면 유지(비차단) |
| 5 | plan_coherence | 트래커의 co-located 세 번째 하위 항목(§5.4.1/2-trigger-list.md 검증 분기 미등재 지적)이 커밋 `f947b49f4` 로 이미 해소됐는데 완료 주석 누락 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2233-2235` | draft 가 같은 트래커 파일의 다른 두 항목을 종결 처리하는 김에 `✅ 해소` 주석(커밋 인용) 추가 |
| 6 | naming_collision | `dto/chat-channel-*.dto.ts` (신규 glob) 와 `2-trigger-list.md` 의 `dto/**` 가 동일 파일에 중복 매칭 — target 이전부터 있던 상태의 연장 | `spec/5-system/15-chat-channel.md`, `spec/2-navigation/2-trigger-list.md:13` | 조치 불요, 기록 목적 |
| 7 | naming_collision | 신규 `## Rationale` 항목 번호 미지정, 결번 `R-CC-14` 재사용 시 혼란 가능 | `spec/5-system/15-chat-channel.md` | `R-CC-22`(다음 순번) 사용 권장, `R-CC-14` 재사용 회피 |
| 8 | naming_collision | plan 파일명 계열(`chat-channel`·`drift`·`binder` 토큰 공유)이 육안 구분 어려움 | `plan/in-progress/spec-draft-chat-channel-binder-drift.md` vs `plan/complete/spec-draft-chat-channel-drift-3.md` 등 | 향후 계열 증가 시 구분어(`-sot-catchup` 등) 추가 고려 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | draft 의 "3곳" 완결성 주장을 재현 검증으로 반증 — 동일 클래스 드리프트가 slack.md/discord.md 및 편집 대상 파일 내부(§0 vs §1.3)에도 존재 |
| rationale_continuity | NONE | 번복·무근거 대상 없음. glob 결정이 상위 R-1 과 정합. cross-ref·ID 확정은 INFO |
| convention_compliance | LOW | glob 허용·상한 규정 전부 준수(수치 재현 일치). 편집 지시문 표기(경로 축약·코드펜스 볼드) 경미한 흠 |
| plan_coherence | LOW | 트래커가 열어 둔 두 결정을 정확히 집행, 선행 조건·다른 in-progress plan 과 충돌 없음. co-located 항목 완료 주석 누락만 INFO |
| naming_collision | NONE | 신규 식별자는 이미 존재하는 심볼의 SoT 반영뿐, 매칭 집합 재현 검증상 의도치 않은 충돌 없음 |

## 권장 조치사항
1. (WARNING 우선) draft §③에 `slack.md:275`/`discord.md:297` 를 네 번째 항목으로 추가하거나, "이 턴은 `setupChatChannel` 심볼만" 으로 스코프를 명시적으로 좁힌다.
2. (WARNING) `data-flow/14-chat-channel.md` §1.3 표 헤더를 §0 정정과 같은 턴에 함께 갱신해 내부 불일치를 없앤다.
3. (WARNING) §③(c) 실제 spec 반영 시 `…/` 를 전체 경로로 펼쳐 쓴다 (또는 draft 에 "전체 경로 사용" 주석 추가).
4. (INFO, 선택) R-1 cross-ref 추가, `R-CC-22` 번호 확정, `telegram.md:58` 후속 정정 또는 트래커 등재, `spec-draft-nullable-notation-followups.md` co-located 항목에 해소 주석 추가.
