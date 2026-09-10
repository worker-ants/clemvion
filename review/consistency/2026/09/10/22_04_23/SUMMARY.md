# Consistency Check 통합 보고서

**BLOCK: YES** — cross_spec checker 가 CRITICAL 1건을 확인함 (5개 checker 전원 success, 전문 확보 완료 — 재시도 필요 항목 없음)

## 전체 위험도
**HIGH** — target 변경안(A~G)이 원인 커밋(`df1962e25`)의 hunk 6개 중 1개(R-CC-10 문단의 blanket 요약문)를 여전히 놓쳐, telegram carve-out 적용 후에도 `spec/5-system/15-chat-channel.md` 안에 자기모순 문장이 남는다. 이 CRITICAL 은 이번 검토자(target 편집 권한 보유)가 직접 수정 가능한 범위이며 planner 인계 대상이 아니다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 변경안 A~G 가 `df1962e25` 자체 변경 로그의 6개 항목(A/B/C/E/F/H) 중 "F"(R-CC-10 문단 전방 포인터 괄호문)를 편집 대상으로 잡지 않음 — 이 문단이 "chatChannel 이 실린 PATCH 는 저장된 비밀을 아예 쓰지 않는다" 는 결론을 한 번 더 요약 진술하고 있어, 2R 반영 후에도 같은 파일 안에서 telegram 의 §5.4.1.1 신설 행("`setupChannel()` 재호출마다 재발급·재저장")과 정면 모순 | `## 변경안` 표 A~G 전체, `## 1R 에서 잡힌 것` 절 | `spec/5-system/15-chat-channel.md:614` `### R-CC-10` rationale 문단의 `*(2026-09-10 확장 — …)*` 괄호문 | 변경안에 항목 **H'** (또는 B 스코프 명시 확장) 추가 — R-CC-10 문단의 괄호 요약문을 "chatChannel 이 실린 PATCH 는 **bot token 값**을 쓰지 않는다(telegram inboundSigning 축은 예외 — §5.4.1.1/R-CC-21 참조)" 형태로 좁힌다 |

## planner 인계 (권한 밖 Critical)

(없음) — 위 CRITICAL 은 `plan/in-progress/` draft 자체의 변경안 커버리지 누락이며, 이 검토를 수행 중인 turn(향후 `spec/` 반영 전 `--spec` 사전 검토)이 직접 항목을 추가해 해소할 수 있는 권한 범위 내 사안이다. spec 본문은 아직 편집되지 않았으므로 이미 반영된 spec drift 도 아니다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity | 변경안 B(R-CC-21 갱신)의 새 판별 기준(D-B: "PATCH body 로 온 사용자 입력 비밀인가")이 §5.4.1 이 이미 명시한 기존 기준("토큰 **값이 바뀌는가**")과 정면으로 다른 잣대이면서, 그 문장 자체를 인용·반박하지 않고 우회함. §5.4.1 이 명시한 "직교 축(외부 provider 등록 여부)" 을 그대로 적용하면 telegram 의 `issuedInboundSigning` 도 bot-token 과 같은 "PATCH 로 안 바뀌는" 편에 속해야 한다는 반론이 성립하는데 target 이 정면으로 다루지 않음 | `## 결정` D-A/D-B, `### 기각한 대안` 표, 변경안 B | `spec/5-system/15-chat-channel.md:380` "값이 바뀌는가" 문장 + 같은 문단의 "직교 축" 서술 | 변경안 B 본문에서 (1) §5.4.1 줄 380 문장을 직접 인용해 telegram 이 왜 예외인지(또는 그 기준이 애초 "PATCH body 유입 값" 한정이었음을) 명시, (2) "직교 축" 서술을 인용해 회전 주체가 Telegram 자신의 `setWebhook` 등록 행위임을 명시, (3) R-CC-21 "재검토 신호" 문단을 2분법→3분법(bot token / slack·discord signing / telegram signing)으로 갱신 |
| 2 | convention_compliance | §5.4.1.1 절 제목이 "(slack / discord 한정 — v1 차단)"인데 변경안 A 가 바로 그 표에 정반대 동작(telegram: 계속 재발급)을 하는 telegram 행을 추가 — 제목-본문 스코프 불일치 | 변경안 표 A행 (`15-chat-channel.md` §5.4.1.1) | `spec/5-system/15-chat-channel.md:384` 절 제목 "(slack / discord 한정 — v1 차단)" | 절 제목을 갱신(예: "slack/discord PATCH 차단 · telegram server-issued carve-out")하거나, telegram 행을 표 안에 섞지 않고 표 아래 별도 소단락으로 분리 |
| 3 | convention_compliance + naming_collision (통합, 강한 등급 채택) | 변경안 B 가 "「기각한 대안」 신설"이라고 하지만 같은 `R-CC-21` 항목 안에 이미 동명 `#### 기각한 대안` H4 헤딩(bot-token PATCH 우회 관련, line 767)이 존재 — 같은 rationale 블록 안에 인접 중복되어 GitHub 앵커가 `#기각한-대안-1` 로 분기하고, 향후 인용 시 두 목록(botToken 축 vs telegram carve-out 축) 이 헷갈릴 위험 (naming_collision 은 "당장 깨지는 링크는 없음(grep 0건)"으로 확인, INFO 로 평가했으나 convention_compliance 가 문서 구조 규약 위반으로 WARNING 판정 — 하향 금지 원칙에 따라 WARNING 채택) | 변경안 표 B행 (`15-chat-channel.md` `### R-CC-21`) | `spec/5-system/15-chat-channel.md:767` 기존 `#### 기각한 대안` H4 | 신설 소절 제목을 `#### 기각한 대안 (telegram carve-out)` 처럼 구분되게 붙이거나, 두 목록을 기존 표에 행으로 합쳐 헤딩 중복 자체를 피할 것 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `conventions/chat-channel-adapter.md §1.1` `setupChannel` "멱등 = yes" 표기가 telegram 매 호출 신규 시크릿 발급과 병존할 때 오독 여지 | `spec/conventions/chat-channel-adapter.md:127` | 이번 턴 범위 아님. §5.4.1.1 편집(A) 완료 후 표 셀에 "멱등성은 레지스트리 등록 안전성을 의미, 시크릿 값 불변 아님(telegram 은 매 호출 새 값)" 각주를 후속 트래커에 등재 권장 |
| 2 | cross_spec | `plan/complete/spec-draft-chat-channel-patch-token.md:102-105` 에 동일 blanket 문구("PATCH 전후 두 비밀은 동일하다")가 원문 그대로 남음 — archive 라 수정 대상 아님 | plan/complete 봉인 문서 | 조치 불요. 향후 이 archive 를 "D-2 는 무조건 참"으로 재인용하는 사례가 없는지만 주의 |
| 3 | rationale_continuity | 「기각한 대안」 2행("adapter 가 기존 서명을 재사용하면 §5.4.1.1 이 유예한 v2 결정을 telegram 축에서 미리 집행")이 §5.4.1.1 의 실제 문면 스코프(slack/discord 한정)를 telegram 에 유추 확장한 새 정책 판단임을 더 명시할 필요 | `### 기각한 대안` 표 2행 | 문구를 "§5.4.1.1 의 slack/discord 전용 v2 유예 패턴을 telegram 에 **유추 적용하면** 사전 집행이 되므로 기각"으로 보강 |
| 4 | plan_coherence | 변경안 **G**(`spec-draft-nullable-notation-followups.md` D-1/D-2/D-3 요약문 telegram 예외 반영)의 실행 문구가 방향만 정하고 1R 리포트가 제시한 구체 각주 텍스트·삽입 위치(`:1957-1959` 직후)를 담지 않음 — "체크박스만 닫는" 이전 실패 모드로 재수렴할 여지 | `plan/in-progress/spec-draft-nullable-notation-followups.md:1894-1978` | G 적용 시 1R 리포트 제시 각주 예시 문구를 그대로 삽입. 실행 완료 판정은 "체크박스 종결"이 아니라 "본문에 telegram 예외 각주가 실재하는가"로 |
| 5 | plan_coherence | 변경안 **E**(§5.4.1 표 2행 캐비아트)의 실제 문구가 아직 미확정 — 적용 시 자매 plan(`spec-draft-nullable-notation-followups.md:2031-2038`)의 미해소 질문(구현과 어긋날 수 있는지)을 D-B 판별 기준으로 선점하지 않도록 주의 | `## 변경안` 표 E행 | E 적용 시 "재호출 여부가 확정되지 않았다 — 별도 후속(`spec-draft-nullable-notation-followups.md`)에서 확인 중" 형태의 중립 forward-link 캐비아트로 한정 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | R-CC-10 문단 blanket 요약문(라인 614)이 변경안 A~G 어디에도 편집 대상으로 안 잡혀, telegram 예외 반영 후에도 같은 파일 안에서 자기모순 문장이 남음 (CRITICAL) |
| rationale_continuity | MEDIUM | D-B 판별 기준이 §5.4.1 기존 "값이 바뀌는가" 기준·직교 축 서술과 정면 대조 없이 채택됨 (WARNING) |
| convention_compliance | LOW | §5.4.1.1 절 제목 스코프 불일치(A), "기각한 대안" 헤딩 중복(B) — 두 건 모두 WARNING, spec 명명·frontmatter·Rationale ID 정책은 전반적으로 정확히 준수 |
| plan_coherence | LOW | 1R WARNING(자매 plan D-2 telegram 예외 미반영)이 변경안 G 로 인지·반영됨, 미러 커버리지 갭(2-trigger-list.md)도 F 로 해소 — 남은 것은 실행 단계 구체성(INFO 2건)뿐 |
| naming_collision | NONE | 신규 식별자 도입 없음(기존 확정 식별자 스코프만 좁힘). "기각한 대안" 헤딩 중복만 INFO — 단 convention_compliance 가 WARNING 판정해 통합 결과는 WARNING 채택 |

## 권장 조치사항
1. **(BLOCK 해소)** 변경안에 항목 H' 를 추가해 `15-chat-channel.md:614` R-CC-10 문단의 괄호 요약문을 telegram 예외로 좁힌다.
2. 변경안 B 본문에 §5.4.1 "값이 바뀌는가" 문장 + "직교 축" 서술을 직접 인용해 telegram 예외 근거를 명시하고, R-CC-21 "재검토 신호" 문단을 3분법으로 갱신한다.
3. 변경안 A 적용 시 §5.4.1.1 절 제목을 갱신하거나 telegram 행을 표 밖 별도 소단락으로 분리한다.
4. 변경안 B 의 신설 "기각한 대안" 소절 제목을 `기각한 대안 (telegram carve-out)` 등으로 구분하거나 기존 표에 행을 추가해 헤딩 중복을 피한다.
5. 변경안 G 적용 시 1R 리포트의 구체 각주 문구를 그대로 삽입하고, 변경안 E 는 followups 미해소 질문을 선점하지 않는 중립 캐비아트로 한정한다.
6. (참고) `chat-channel-adapter.md §1.1` 멱등성 표기 각주는 §5.4.1.1 편집 완료 후 후속 트래커에 등재.
