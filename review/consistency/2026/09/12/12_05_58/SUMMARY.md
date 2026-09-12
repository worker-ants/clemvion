# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 전문 확보, CRITICAL 발견 0건. WARNING 5건·INFO 다수는 채택을 막을 정도는 아니나 반영 전 정리 권고.

## 전체 위험도
**MEDIUM** — 502/503 판정 축의 기존 Rationale 과의 불일치(cross_spec·rationale_continuity 중복 지적)와 developer 갈래 백로그 인용문 무효화가 가장 무거운 항목.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 전원 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

(없음 — CRITICAL 자체가 없어 인계 대상 없음. 참고로 본 target 은 이미 `project-planner` 소관인 `spec/` draft 이므로 해당 시나리오도 아니다.)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | 신설 502 판정 축("외부 3rd-party vs 우리 인프라")이 `4-execution-engine.md` 기존 502/503 Rationale(C-1, "응답 유효성 vs 일시 가용성" 축)과 다른 기준을 쓰는데 상호 참조가 없다 | 결정 (4) `2-api-convention.md §6` 502 행 신설, `R-CC-23` | `spec/5-system/4-execution-engine.md` Rationale (C-1·M-7, "Redis 장애=503, 502 아님") | `R-CC-23`에 `4-execution-engine.md §7.5.2 Rationale(C-1)` 명시 인용 + "소유 축 vs 유효성/가용성 축이 현재 사례들에서는 같은 결론에 도달한다"를 한 줄 명시. provider 타임아웃처럼 두 축이 갈릴 수 있는 경계 사례를 각주로 인지 |
| 2 | cross_spec | 이 결정의 실질 동기(Slack `invalid_auth`, HTTP 200+`{ok:false}`)가 provider-level spec(`slack.md §3.1`)에 문서화돼 있지 않다 — draft가 `plan/complete/`로 이동하면 근거가 spec 트리에서 사라짐 | 결함① 표 Slack 행, "구현 위임" 6 | `spec/4-nodes/7-trigger/providers/slack.md §3.1` (성공 응답만 서술) | `slack.md §3.1`에 실패 응답 형태(`{ok:false,error}`+HTTP 200) 및 "자격 증명 거부 신호" 라벨 한 줄 추가하고 `chat-channel-adapter.md §1.1.2`로 링크. 유지한다면 트래커에 갭으로 명시 등재 |
| 3 | rationale_continuity | 이번에 기각한 대안("adapter가 status를 message에 싣게 통일")이 다른 살아있는 백로그에서는 아직 "근본 처방"으로 명시돼 있어, 다음 사람이 그 문서를 SoT로 읽고 기각된 접근을 재도입할 위험 | 결정 (2), 체크리스트 "트래커 항목 재기술" | `plan/in-progress/spec-draft-nullable-notation-followups.md:2766-2775` ("(b)가 근본이다") | 해당 백로그 항목에 취소선/정정 각주로 "근본 처방은 typed `code`(R-CCA-9 §1.1.2)로 대체됨"을 명시. 체크리스트의 "재기술"을 이 구체 조치로 좁혀 기재 |
| 4 | convention_compliance | 프로젝트 최초로 502를 실사용으로 도입하는데 API 문서 도구 규약(`swagger.md §2-4`)의 상태 코드 표에 502/5xx 행이 없고, `@ApiBadGatewayResponse` 데코레이터 반영이 결정·구현위임 어디에도 명시 안 됨 (`BadGatewayException`/`@ApiBadGatewayResponse` 저장소 전체 사용례 0건 실측) | `## 결정 (4)`, `## 구현 위임` 1번 | `spec/conventions/swagger.md §2-4` 상태 코드 표 | 구현위임 1번에 컨트롤러 `@ApiBadGatewayResponse` 부착 명시 추가, 또는 `swagger.md §2-4`에 502(5xx) 행 신설 여부를 이 draft/후속 트래커 항목으로 결정 |
| 5 | plan_coherence | 결정(5)가 `2-trigger-list.md`의 "401/403에서 드러난다" 문장을 §5.4 링크로 축약·삭제하는데, 그 문장을 다른 백로그(botToken 형식검증 developer 갈래, MDX·i18n 4곳)가 "정답 텍스트"로 인용 예정이라 갱신이 필요 | `## 결정` (5), 결함③ 표 `2-trigger-list.md` 행 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2697-2722` ("developer 갈래는 존속한다") | target의 "구현 위임" 또는 "안 하는 것"에 "그 백로그 착수 시 참조할 정답 문장은 이제 §5.4의 원인-기반 서술(신호 방식 무관)이지 '401/403'이 아니다"를 명시, 해당 백로그(:2720-2722) 옆에도 동일 문구 기록 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `spec_impact`에 같은 메커니즘(discord verify_key mismatch → `BOT_TOKEN_INVALID`)을 서술하는 `providers/discord.md`가 누락 | frontmatter `spec_impact`, 결함③ 목록 | 등재하거나 "확인함 — 편집 불요" 한 줄 기록 |
| 2 | cross_spec | 신설 `code`(§1.1.2, setupChannel 자격증명 판별)와 기존 `event.error.code`(§3.1, EIA 실행실패 분류)가 같은 파일 안 이름은 같지만 별개 네임스페이스 | `chat-channel-adapter.md` 신규 §1.1.2 | §1.1.2 서두에 "§3.1의 `event.error.code`와 무관한 별개 네임스페이스" 한 줄 명시 |
| 3 | cross_spec | fallback으로 남기는 메시지 401/403 정규식이 R-CCA-5/CCH-ERR-02의 "message 원문 배제" 원칙과 정신적으로 긴장 (문자 그대로 위반은 아님) | 결정 (2) "fallback은 남긴다" | §1.1.2에 "R-CCA-5/CCH-ERR-02에 대한 의도적·한시적 예외(3개 adapter 모두 code 확보 시 제거)" 명시 |
| 4 | rationale_continuity | `R-CCA-5` 인용이 실제로는 위임처(`R-CC-15`)가 정의하는 화이트리스트 세부를 가리킴 — 출처 오류 | 결정 (2) 본문 | 인용을 `R-CC-15`(화이트리스트 정의)+`R-CCA-5`(층 분리 이유)로 분리 또는 "R-CCA-5(→R-CC-15 위임)"로 정정 |
| 5 | convention_compliance | §6 신설 행이 blockquote+backtick 문장이라 실제 markdown 표 문법이 아님 (초안 표기) | 결정 (4) 인용 블록 | spec 반영 커밋에서 정상 표 행으로 변환 |
| 6 | convention_compliance, plan_coherence | `3-error-handling.md §1` 중앙 카탈로그에 `BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 미등재 — 기존 갭이며 스코프아웃 명시했으나 추적할 살아있는 `plan/in-progress/` 항목이 없어 draft가 `complete/`로 이동하면 유예 근거가 봉인됨 | `## 안 하는 것` 3번째 항목 | `spec-draft-nullable-notation-followups.md` 또는 신규 항목에 한 줄 등재, 또는 `complete/` 이동 커밋 메시지에 후속 위치 명시 |
| 7 | naming_collision | 신규 식별자(`R-CC-23`/`R-CCA-9`/§1.1.2/502 행) 전수 실측 결과 충돌 없음(NONE). 표기 명확화 수준 제안 2건: (a) §1.1.2 제목에 "실패 판별"류 대조어로 §1.1.1(멱등)과 구분 (b) 신설 502 행에 노드 output `statusCode`(§3.2 예시, 다른 네임스페이스)와의 구분 각주 | §1.1.2 헤딩, §6 502 행 | 제목/각주 1줄씩 추가 (CRITICAL 아님) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | 502/503 판정 축 불일치(상호 참조 없음), Slack invalid_auth 근거가 provider spec에 미문서화 |
| rationale_continuity | MEDIUM | 같은 502/503 축 문제(중복 지적) + 기각된 대안이 다른 백로그에서 아직 "근본 처방"으로 살아있음 |
| convention_compliance | LOW | swagger.md §2-4가 502 데코레이터 반영을 다루지 않음(프로젝트 최초 502 실사용) |
| plan_coherence | LOW | 결정(5)의 문서 축약이 developer 갈래 백로그가 인용 예정인 정답 문장을 갱신 안 함 |
| naming_collision | NONE | 신규 식별자 전수 충돌 없음, 표기 명확화 제안만 |

## 권장 조치사항
1. (WARNING 1) `R-CC-23`에 `4-execution-engine.md` C-1 Rationale 상호 인용 + 축 정합 한 줄 추가
2. (WARNING 5) `spec-draft-nullable-notation-followups.md:2697-2722` developer 갈래 옆에 "정답 문장이 §5.4로 바뀌었다" 각주 추가
3. (WARNING 3) 같은 백로그 파일 `:2766-2775` "(b)가 근본이다" 문장에 취소선+정정
4. (WARNING 4) 구현위임 1번에 `@ApiBadGatewayResponse` 데코레이터 반영 명시 또는 `swagger.md §2-4` 갱신 여부 결정
5. (WARNING 2) `slack.md §3.1`에 실패 응답 형태(`{ok:false,error}`) 한 줄 추가
6. INFO 항목들(discord.md spec_impact 등재, R-CCA-5→R-CC-15 인용 정정, §6 표 문법 정리, 중앙 카탈로그 갭 등재)은 시간 허용 시 함께 정리
