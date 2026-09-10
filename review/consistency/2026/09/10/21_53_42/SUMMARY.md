# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견 1건(중복 지적 2 checker)이 있어 이 draft 를 그대로 spec 에 반영하면 안 됨

## 전체 위험도
**CRITICAL** — 핵심 결정(telegram `issuedInboundSigning` carve-out)은 코드·spec·conventions 3층 실측으로 타당하지만, 어제 커밋이 3파일에 동시 이식한 동일 blanket 문장 중 `spec/2-navigation/2-trigger-list.md:176` 하나가 변경안에서 빠져 있어 그대로 적용하면 이 draft 가 고치려던 것과 같은 종류의 3파일 모순이 재발한다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | 변경안(A~E)이 `spec/2-navigation/2-trigger-list.md` §3 의 동일 blanket 문장("`chatChannel` 이 실린 PATCH 는 저장된 비밀을 바꾸지 않는다 — bot token·inbound signing 값은 요청 전후로 동일")을 누락. 어제 커밋(`df1962e25`/#1311)이 이 문장을 `15-chat-channel.md`·`data-flow/14-chat-channel.md`·`2-trigger-list.md` 3파일에 의도적으로 동시 이식했는데, 변경안 A/B/C 는 앞 두 파일만 좁히고 `spec_impact` 도 두 파일만 등재해 세 번째 미러가 telegram 예외 없이 그대로 남는다 | `## 변경안` 표(A~E), frontmatter `spec_impact` | `spec/2-navigation/2-trigger-list.md:176` (R-CC-21 anchor 직접 인용) | 변경안에 **F** 항목 신설: `2-trigger-list.md:176` 문구에도 A/B/C 와 동일한 telegram carve-out 캐비아트 반영, `spec_impact` 에 해당 파일 추가. 차단 서술(필드 차단)은 그대로 두고 "값 불변" 서술만 좁히면 됨 |

## planner 인계 (권한 밖 Critical)

> (없음) — 위 Critical 은 target 문서 자체가 아직 `project-planner` 소유의 `plan/in-progress/*.md` draft(--spec 모드, 아직 spec/ 미반영)이며, 결함의 근본 원인(변경안 목록에 파일 하나 누락)도 이 draft 자신의 스코프 안에서 즉시 수정 가능하다. `developer` 권한 밖 spec drift 유형이 아니므로 인계 대상 없음 — 같은 planner 턴에서 변경안 F 추가로 해소.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | 이 draft 가 막으려는 실제 사고(문면대로 구현 시 telegram 401 파손)의 직접 원인이 되는 자매 plan `spec-draft-nullable-notation-followups.md` 의 CRITICAL 처방문(D-1/D-2/D-3, "PATCH 는 비밀을 쓰지 않는다 — provider 구분 없음")에 telegram 예외가 아직 반영 안 됨. 같은 파일 두 번째 CRITICAL 항목엔 이미 인라인 정정 각주 관례가 있는데 이 항목엔 없음(전수 grep 0건). target 의 "트래커 갱신" 체크리스트가 아직 미실행이고 "종결" 문구라 체크박스만 닫는 최소 실행으로 격차가 남을 수 있음 | `## 체크리스트` 107행, `## 이 턴에 하지 않는 것` 95~96행 | `spec-draft-nullable-notation-followups.md:1957-1978` (D-1/D-2/D-3 요약) | 트래커 갱신 실행 시 체크박스만 닫지 말고, 두 번째 CRITICAL 항목과 같은 형식의 인라인 각주("D-2 는 telegram 의 server-issued `issuedInboundSigning` 축에는 적용되지 않는다…")를 D-1/D-2/D-3 요약 문장 바로 아래에 추가 |
| 2 | cross_spec, rationale_continuity | 변경안 A 가 telegram carve-out 문장을 bot-token 전용 §5.4.1(제목 "Bot Token 변경 single-path 정책") 표 행에 끼워 넣음. 실제 자원은 inboundSigning 이고 그 전용 SoT 는 제목부터 "slack/discord 한정"인 §5.4.1.1 — 두 곳에 서술이 분산되면 provider별 inboundSigning 정책의 단일 진실 원칙이 흔들림 | `## 변경안` A행 | `spec/5-system/15-chat-channel.md` §5.4.1(:367-382) vs §5.4.1.1(:384-407) | telegram carve-out 서술의 정본 위치를 §5.4.1.1(제목을 "slack/discord — v1 차단, telegram — 예외"로 갱신) 또는 신설 §5.4.1.2 로 확정. §5.4.1 에는 기존 "bot token 은 안 바뀐다" 진술만 유지 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | 신설 carve-out(D-A/D-B/D-C)에 "기각한 대안" 절이 없음 — R-CC-21 자신의 기존 관례(대안 비교로 문면 반증)와 다름 | `## 결정` D-A/D-B/D-C | 변경안 B 의 carve-out 소절에 "기각한 대안" 소제목 추가, target 의 §실측·§두 갈래 다 문제다 절 내용을 그대로 흡수 (비용 낮음) |
| 2 | cross_spec | R-CC-21 제목("PATCH 는 비밀을 쓰지 않는다")이 본문을 두 축 한정으로 좁혀도 그대로 남아, 제목만 읽는 인용처(2-trigger-list.md, data-flow §1.3)에겐 여전히 blanket 으로 읽힐 여지 | R-CC-21 제목(:734) | 제목 유지 + 본문 상단에 "단, telegram 의 server-issued 축은 예외" caveat 를 눈에 띄게 배치(anchor 링크 보존을 위해 제목 자체는 불변) |
| 3 | convention_compliance | draft 의 핵심 전제(telegram server-issued vs slack/discord provider-issued, `SetupResult.issuedInboundSigning`, `SecretResolver.rotate`)가 `secret-store.md §5.5`·`chat-channel-adapter.md §2.3/§2.4` 에 이미 동일 어휘로 정본화돼 있어 draft 의 결정을 강하게 뒷받침 | `secret-store.md §5.5`, `chat-channel-adapter.md §2.3/§2.4` | 조치 불요. 선택: `15-chat-channel.md`/`data-flow` 갱신 시 이 두 conventions 문서로 상호 참조 링크 추가 |
| 4 | convention_compliance, naming_collision | DTO 명명(`ChatChannelPatchConfigDto`→`ChatChannelUpdateConfigDto`)을 draft 가 저장소의 `Create`/`Update` 컨벤션과 대조해 스스로 올바르게 정정했고, developer 턴으로 정당하게 defer. 신규 사용처 grep 0건, 충돌 없음 | "이 턴에 하지 않는 것" 2번째 항목 | 조치 불요. (선택) `swagger.md §1`에 "부분 갱신 DTO 는 `Update`, `Patch` 접두 금지"를 정식 규약으로 승격하면 다음 조사 반복을 줄임 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | 변경안이 `2-trigger-list.md` 를 빠뜨려 3파일 모순 재발(CRITICAL) + A안 배치 위치 SoT 분산(WARNING) |
| rationale_continuity | CRITICAL | 어제 커밋이 동시 이식한 3중 미러 중 `2-trigger-list.md:176` 누락 — 같은 CRITICAL 을 독립 확인 |
| convention_compliance | NONE | CRITICAL/WARNING 없음. draft 전제가 `secret-store.md`·`chat-channel-adapter.md`·`swagger.md` 와 정확히 정합 |
| plan_coherence | MEDIUM | 자매 plan 의 CRITICAL 처방문(D-1/D-2/D-3)에 telegram 예외 각주 미반영 — 재발 경로 남음 |
| naming_collision | NONE | 신규 식별자 사실상 없음(DTO 명명 1건, 기존 컨벤션과 충돌 없이 이미 정정됨) |

## 권장 조치사항

1. **(BLOCK 해소)** 변경안에 **F** 항목 신설 — `spec/2-navigation/2-trigger-list.md:176` 의 "bot token·inbound signing 값은 요청 전후로 동일" 문구에 A/B/C 와 동일한 telegram carve-out 캐비아트 반영, frontmatter `spec_impact` 에 이 파일 추가.
2. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 D-1/D-2/D-3 CRITICAL 항목 요약(1957~1959행)에, 같은 파일 두 번째 CRITICAL 항목과 동일한 형식의 telegram 예외 인라인 각주를 추가 — "트래커 갱신" 체크리스트를 체크박스만 닫는 것으로 끝내지 말 것.
3. 변경안 A 의 telegram carve-out 문장 배치를 bot-token 전용 §5.4.1 대신 §5.4.1.1(제목 갱신) 또는 신설 §5.4.1.2 로 조정해 inboundSigning 서술의 SoT 를 한 곳으로 유지.
4. (선택, 비차단) R-CC-21 본문 상단에 두 축 한정 caveat 를 눈에 띄게 추가하고, carve-out 소절에 "기각한 대안" 절을 신설해 §실측 내용을 흡수.
