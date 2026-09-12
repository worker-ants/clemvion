# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. WARNING 4건 + INFO 4건.

## 전체 위험도
**MEDIUM** — Critical 은 없으나, 이 배치가 다른 in-progress tracker(`spec-draft-nullable-notation-followups.md`)의 완료 게이트를 쥐고 있는 구조적 리스크(plan_coherence WARNING)가 방치되면 그 tracker 의 `plan/complete/` 이행이 계속 막힌다. 그 외 3건은 문서 자기정합성/명명 각주 누락 수준의 경미한 WARNING.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity | item 1(`15-chat-channel.md` frontmatter `code:` glob 을 `dto/chat-channel-*.dto.ts` → `dto/**/chat-channel-*.dto.ts` 로 확장)이 같은 문서 `## Rationale` R-CC-22 의 리터럴 인용·정량 진술("좁은 glob 3개는 10개를 정확히 덮는다")을 stale 하게 만든다. 넓힌 glob 은 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 를 추가로 매칭해 실제 매칭 수가 10 이 아니라 11(이상)이 되지만 R-CC-22 본문은 갱신되지 않는다 | target §1, `spec/5-system/15-chat-channel.md ## Rationale R-CC-22` | 같은 문서 R-CC-22 자기 자신 (정량 진술·리터럴 glob 인용) | item 1 diff 에 R-CC-22 하단 인라인 캐비엇 추가: `> **(2026-09-12 확장)** 두 번째 glob 이 dto/**/chat-channel-*.dto.ts 로 넓어졌다 — swagger.md §5-1 이 응답 DTO 자리로 정한 dto/responses/ 하위를 기존 * 가 못 넘어 덮지 못했다. 매칭 수 10→11(+dto/responses/chat-channel-rotate-bot-token-response.dto.ts). 측정: §1 표.` 이 저장소의 기존 관례(R-CC-10/R-CC-21 갱신 캐비엇)를 그대로 따르면 됨 |
| 2 | plan_coherence | target `## 체크리스트`의 "트래커 항목 종결 + draft plan/complete/ 이동" 한 줄이 대상 tracker 를 특정하지 않는다. 실측 대조 결과 target 이 닫으려는 7~9건 중 7~8건이 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속` 섹션에 거의 동일 문구로 등록돼 있고, 그 tracker 의 `plan/complete/` 이행 조건이 바로 그 체크박스 전부 완료다 | target `## 체크리스트` 마지막 줄 | `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속` 8개 항목 + `## 종결 조건` | 체크리스트 줄을 구체화 — tracker 파일 경로 명시 + 대응 8개 항목 제목(줄 번호 아님, 문구로) 인용, "완료 시 `[x]` + 완료 메모로 갱신" 명문화. 항목 9(R-CC-23)는 tracker 에 없는 target 고유 발견이므로 별도 처리 |
| 3 | naming_collision | `slack.md §3.1` 이 신규 문서화하는 `token_expired` (Slack `auth.test` 응답 값, `SLACK_CREDENTIAL_REJECTED_ERRORS` 5번째 값)가 `Integration.status_reason` DB 컬럼의 동일 리터럴 `'token_expired'` (`spec/1-data-model.md:310` 이 이미 `TOKEN_EXPIRED`/`auth.token_expired` 와 "별개 네임스페이스"로 각주 처리한 전례가 있는 그 값)와 텍스트가 겹친다. 실행 경로는 완전 분리(런타임 위험 없음)이나 문서 grep 시 혼동 여지 | target §5 (`slack.md §3.1` 5값 확정) | `spec/1-data-model.md:310` §2.10 Integration 각주, `spec/2-navigation/4-integration.md` 다수 사용처 | 이번 diff 뒤 각주 1줄 추가: "이 `token_expired` 는 Slack API 응답 문자열이고 `Integration.status_reason` 의 동명 값([1-data-model.md §2.10](../../../1-data-model.md#210-integration))과 무관한 별도 네임스페이스다" — 기존 각주 관례 확장 |
| 4 | convention_compliance | (참고용, 비차단) `INVALID_BOT_TOKEN` / `BOT_TOKEN_INVALID` 두 코드가 어순만 달라 `error-codes.md §1` "이름만으로 분기 의미가 드러난다" 원칙에 완전히 부합하지 않음. 단, 둘 다 이미 wire 에 배포된 코드를 이번 턴이 카탈로그에 등재만 하는 것이라 개명은 §2 rename 금지 정책상 선택지가 아님 | target §7 (`3-error-handling.md §1.12` 신설) | `spec/conventions/error-codes.md §1` 명명 원칙, §2 rename 금지 | target 수정 불요(이미 콜아웃으로 경고 중). 향후 이 코드를 실제로 만질 기회가 오면 `error-codes.md §3` historical registry 에 사례로 등재 검토 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | convention_compliance | `swagger.md` frontmatter 신규 fixture 항목(`fixtures/dto-class-collision/*.ts`)이 기존 항목들의 접두 관용구(`fixtures/user-eager-relation*.ts`)와 표기 스타일이 다름. 매칭 자체는 정본 매처로 검증해 정확함(과잉/누락 없음) | target §3(b) | 무수정 가능. 통일 원하면 `fixtures/dto-class-collision*.ts` 형태로 바꿔도 동일 매칭 |
| 2 | naming_collision | 신규 식별자(에러 코드 6종·`CCH-NF-03`·`ChatChannelRateLimiterService`·DTO 클래스명 등) 대부분이 실제로는 이미 구현된 코드/기존 spec 값의 카탈로그 등재이며 저장소 전체 grep 결과 다른 의미로 쓰이는 기존 사용처 0건 | target 전반 | 별도 조치 불요, 기록용 |
| 3 | naming_collision | `15-chat-channel.md` glob 확장이 `2-navigation/2-trigger-list.md` 의 기존 `dto/**` 글롭과 겹치는 `dto/chat-channel-config.dto.ts` 소유권 중복을 새로 만들지 않음(diff 이전부터 이미 존재하던 전례) | target §1 | 조치 불요 |
| 4 | cross_spec | §6(`2-api-convention.md §7` rate-limit 신규 행)과 §7(`3-error-handling.md §1.12`)이 서로 다른 표(rate-limit vs 에러 카탈로그)를 채우는 것이며 `CHAT_CHANNEL_SETUP_FAILED`/502 는 §6 HTTP 상태 코드 표에 이미 별도 등재돼 있어 중복 기재가 아님을 확인 | target §6, §7 | 조치 불요, 교차검증 완료 기록 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | item 1 glob 확장이 R-CC-22 정량 진술("10개 정확히")을 stale 하게 만듦. 그 외 9개 변경안 전부 diff base·형제 spec·코드 실체와 라인 단위 일치 |
| rationale_continuity | LOW | 동일 이슈를 Rationale 리터럴 인용 관점에서 재확인 — item 1 이 R-CC-22 의 frontmatter 리터럴 인용문을 깨뜨림. 나머지 6건은 기존 Rationale·기각 대안과 정합 |
| convention_compliance | NONE | CRITICAL/WARNING 급 규약 위반 0건. INFO 2건(근접 명명, fixture 관용구 표기차)만 관찰 |
| plan_coherence | MEDIUM | target 체크리스트 "트래커 항목 종결"이 대상 tracker(`spec-draft-nullable-notation-followups.md`)를 특정하지 않아 그 tracker 의 완료 게이트 갱신이 누락될 실질적 위험 |
| naming_collision | LOW | 신규 식별자 대부분 기존 구현/값의 문서 등재라 충돌 표면 작음. `slack.md` `token_expired` 가 `Integration.status_reason` 동일 리터럴과 겹치나 각주 미비 수준 |

## 권장 조치사항
1. (최우선) target `## 체크리스트` "트래커 항목 종결" 줄을 `plan/in-progress/spec-draft-nullable-notation-followups.md` 경로 + 대응 8개 항목 제목으로 구체화한다 — 이 배치가 실제로 그 tracker 의 완료 게이트임을 명시하지 않으면 다음 세션이 이미 끝난 조사를 반복하거나 tracker 가 영구 미완료로 남는다.
2. item 1(glob 확장) diff 에 `15-chat-channel.md` R-CC-22 하단 인라인 캐비엇(2026-09-12 확장, 매칭 수 10→11)을 추가한다 — 이 저장소의 "실측 근거 수치는 갈릴 때마다 갱신한다" 관례를 이 자리에서도 지킨다.
3. item 5(`slack.md §3.1`) diff 에 `token_expired` 가 `Integration.status_reason` 의 동명 값과 무관한 별도 네임스페이스임을 밝히는 각주 1줄을 추가한다.
4. (선택) `INVALID_BOT_TOKEN`/`BOT_TOKEN_INVALID` 근접 명명은 이번 턴 수정 불요 — 향후 해당 코드를 실제로 다시 다룰 기회가 있으면 `error-codes.md §3` historical registry 등재를 고려한다.