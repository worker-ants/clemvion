# Consistency Check 통합 보고서

**BLOCK: YES** — cross_spec 이 제기한 `spec_impact` 누락(CRITICAL)이 살아있다: §5.4 재작성이 반증한 옛 "401/403 판별" 서술이 편집 대상에서 빠진 문서 3곳(같은 파일 §4.1 포함)에 그대로 남아, 착지 직후 SoT 가 자기 자신과 모순한다.

## 전체 위험도
**HIGH** — target 자체의 핵심 결정(원인-기반 분류로 전환)은 건전하지만, 그 반영 범위가 좁아 같은 문서군 안에 신·구 서술이 공존하는 상태로 착지할 위험이 실측으로 확인됨.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, rationale_continuity, naming_collision (3개 checker 가 다른 각도에서 동일 결함 지적 — 최강 등급 CRITICAL 로 통합) | `spec_impact` 목록이 2개 파일로 좁게 선언됐는데, §5.4 재작성이 반증한 옛 "401/403 에서 드러난다" 라는 transport-기반 서술이 편집 대상에서 빠진 3곳에 그대로 복제돼 있다. §5.4 만 고치면 (a) 같은 파일 안에서 §4.1 과 §5.4 가 즉시 모순하고, (b) 나머지 두 문서는 §5.4 를 "SoT" 로 명시 인용하면서 그 SoT 가 바뀐 뒤에도 옛 문장을 들고 있게 되며, (c) 그 옛 문장은 정확히 이 PR 의 동기(Slack 이 401/403 을 주지 않음)를 반증하는 문장이라 "고쳤다고 선언한 결함이 문서 3곳에 남는" 상태가 된다 | target frontmatter `spec_impact`(2건만 등재) + 편집 계획 (1) `15-chat-channel.md §5.4` 두 행 교체 | `spec/5-system/15-chat-channel.md:203`(§4.1, **같은 파일**) · `spec/2-navigation/2-trigger-list.md:120` · `spec/data-flow/14-chat-channel.md:161-162` (세 곳 모두 §5.4 를 SoT 로 인용하며 "401/403 에서 드러난다" 문장을 자기 본문에 복제) | `spec_impact` 에 `2-navigation/2-trigger-list.md`·`data-flow/14-chat-channel.md` 를 추가하고, 이 두 파일 + `15-chat-channel.md:203`(§4.1) 세 자리를 (1)과 같은 원인-기반 서술로 동시 개정(또는 "§5.4 참조" 로 축약해 중복 서술 자체를 없앰). 체크리스트 (1)을 "두 행 교체"에서 "세 자리 동기화"로 확장 |

## planner 인계 (권한 밖 Critical)

(없음) — target 은 `plan/in-progress/spec-draft-*.md` (spec draft, `--spec` 모드)이며 호출자는 project-planner다. 위 CRITICAL 의 근본 원인(spec_impact 범위·spec 본문 동기화)은 project-planner 권한 안의 `spec/` 편집으로 그 자리에서 바로 해소 가능하다 — 다른 역할로의 인계가 필요하지 않다.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 2 | rationale_continuity | 신설하는 message-prefix 판별(`Error.message` 에 `BOT_TOKEN_INVALID:` 접두 → 호출자 `startsWith()` 파싱)이 여전히 "문자열 메시지 파싱으로 제어흐름을 가르는" 형태라, 이 저장소가 같은 문제(내부 예외→client 경계 분류)에 이미 세워 둔 두 원칙과 반대 방향이다: `4-execution-engine.md §7.5.2`(plain Error/unknown 은 message 를 client 에 전달 금지, typed `ExecutionError` 요구)와 `chat-channel-adapter.md R-CCA-5`(`error.code`+`details.statusCode` 화이트리스트만 입력, `error.message` 원문 배제). 게다가 target 이 그대로 두는 기존 구현이 `details.reason: message.slice(0,256)` 로 provider 원문을 이미 client 응답에 echo 하고 있어 두 원칙이 우려하는 leak 벡터와 정확히 겹친다 | `## 결정` (2) `chat-channel-adapter.md §1.1.2`, `## 구현 위임` 1~2번 | `spec/5-system/4-execution-engine.md §7.5.2`, `spec/conventions/chat-channel-adapter.md R-CCA-5` | R-CCA-9 에 ① 이 채널이 client 경계 typed-error 요구 밖(내부 adapter↔caller 계약)이라는 스코프 한정 근거를 명시하거나, ② 구조적 discriminator(`Error` 서브클래스 또는 `code` 프로퍼티)로 설계를 §7.5.2/R-CCA-5 방향에 맞춰 전환. `details.reason` 원문 echo 유지 여부도 위협모델 근거 한 줄과 함께 명시 |
| 3 | convention_compliance | frontmatter `worktree:` 값이 전체 경로(`.claude/worktrees/spec-setup-error-classification-5e5a82`)로, `plan-lifecycle.md §4` 가 명시한 표기(디렉토리 이름만)와 동일 스키마의 자매 draft 3건(`spec-draft-eia-62-waiting-payload.md` 등) 관행에서 벗어남 | frontmatter `worktree:` | `.claude/docs/plan-lifecycle.md §4`, 자매 `spec-draft-*.md` 3건 | `worktree: spec-setup-error-classification-5e5a82` 로 정정(디렉토리 이름만) |
| 4 | convention_compliance, cross_spec (겹치는 관측을 최강 등급 WARNING 으로 통합) | 재확정하는 `502 CHAT_CHANNEL_SETUP_FAILED` 가 `2-api-convention.md §6` HTTP 상태 코드 표에 미등재된 값이고, target 이 그대로 인용한 현재 구현(ⓒ)은 해당 분기에서도 `BadRequestException`(항상 400)만 던져 502 가 실제로 발생한 적이 없다 — 관련 테스트도 `code` 만 단언하고 `getStatus()` 는 검증하지 않아 "502" 라벨이 미실증 상태다. "구현 위임" 목록에 이 불일치 확인 항목이 없다 | 편집 대상 (1) §5.4 표, ⓒ 인용, "구현 위임" 1~5 | `spec/5-system/2-api-convention.md §6`, 현재 구현 `translateSetupChannelError`(`chat-channel-input-rules.ts`), `chat-channel-input-rules.spec.ts` | (a) `2-api-convention.md §6` 에 502 행 신설 또는 §5.4 예외 명시(project-planner), (b) "구현 위임"에 "`translateSetupChannelError` fallback 분기가 실제로 `BadGatewayException`(502)을 던지는지 확인·정정" 항목 추가(developer) |
| 5 | plan_coherence | "구현 위임" 항목 4(캐너리 뒤집기 — `chat-channel-input-rules.spec.ts` 재작성)가 정확히 같은 테스트 파일·같은 함수(`translateSetupChannelError`)를 대상으로 하는 인접 백로그(`spec-draft-nullable-notation-followups.md:2792-2802` (d)·(e))를 인지·교차참조하지 않아, developer 가 같은 블록을 두 번 건드리거나 (d)·(e) 가 조용히 stale 해질 위험 | `## 구현 위임` 항목 4 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2792-2802` (d)(e) | "구현 위임" 항목 4(또는 신규 항목)에 두 백로그 항목을 같은 커밋에서 함께 처리하거나, 처리 안 한다면 캐너리 뒤집기 이후에도 유효한지 재확인하라는 문구를 명시 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | chat-channel rotate 에러 코드 그룹(`BOT_TOKEN_INVALID` 등)이 다른 모든 도메인과 달리 `3-error-handling.md §1` 중앙 카탈로그에 등재 자리가 없음(기존 갭, target 범위 밖) | 해당 없음 | 이번 턴 또는 후속으로 `3-error-handling.md §1.12`(가칭) 신설 고려. 필수 아님 |
| 2 | rationale_continuity | "4xx/5xx 경계 = 누가 고칠 수 있는가" 인용이 `3-error-handling.md` 의 축자 인용이 아니라 두 개별 사례(`VALIDATION_ERROR`·`FILE_REQUIRED`)의 일반화 재진술(방향은 정합, 과잉 확정) | `## 왜 그게 틀린 분류인가` | R-CC-23 본문에서 두 구체 사례 중 하나를 앵커로 걸어 표현 조정 |
| 3 | convention_compliance | `[CCA §R-CCA-N]` cross-file 인용 포맷을 아직 prose 에 반영하지 않음(draft 단계라 위반 아님) | `## Rationale` 문단 | 실제 spec 반영 커밋에서 R-CC-23↔R-CCA-9 상호 인용 시 포맷 준수 |
| 4 | plan_coherence | 트래커 항목 재기술 대상 plan(`spec-draft-nullable-notation-followups.md`)의 소유 worktree(`plan-in-progress-items-b0c80b`)가 실측상 부재 — 처리 자체는 선례(패턴 동일)상 타당하나 근거 기록 필요 | `## 체크리스트` | 재기술 시점에 "worktree 부재(실측) → 본 세션이 대신 처리" 한 줄을 문서 또는 커밋 메시지에 남길 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | `spec_impact` 누락으로 §4.1·2-trigger-list.md·data-flow 3곳에 반증된 옛 서술이 잔존 (CRITICAL) |
| rationale_continuity | MEDIUM | message-prefix 판별이 §7.5.2/R-CCA-5 의 typed-error 원칙과 반대 방향 (WARNING) |
| convention_compliance | LOW | frontmatter `worktree:` 표기 오류 + 미등재·미실증 502 상태코드 (WARNING 2건) |
| plan_coherence | LOW | 인접 백로그 교차참조 누락(WARNING) + 트래커 재기술 근거 기록 필요(INFO) |
| naming_collision | LOW | 신규 식별자 3건 충돌 없음. 기존 식별자 판별기준 변경의 미러 문서 미동기화(cross_spec CRITICAL 과 동일 결함, 통합 반영) |

## 권장 조치사항
1. (BLOCK 해소) `spec_impact` 에 `spec/2-navigation/2-trigger-list.md`·`spec/data-flow/14-chat-channel.md` 를 추가하고, 이 두 파일 + `15-chat-channel.md:203`(§4.1) 세 자리를 §5.4 신규 원인-기반 서술로 동시 개정(또는 "§5.4 참조" 로 축약). 체크리스트 (1)을 "세 자리 동기화"로 확장.
2. R-CCA-9 에 message-prefix 판별과 `4-execution-engine.md §7.5.2`/`R-CCA-5` typed-error 원칙의 관계를 명시(스코프 한정 근거 또는 구조적 discriminator 로 설계 전환) + `details.reason` 원문 echo 유지 여부 근거 기록.
3. frontmatter `worktree:` 를 `spec-setup-error-classification-5e5a82` (디렉토리 이름만)로 정정.
4. `2-api-convention.md §6` 에 502 행 신설 또는 §5.4 예외 명시(planner) + "구현 위임"에 `translateSetupChannelError` fallback 이 실제 `BadGatewayException`(502) 을 던지는지 확인 항목 추가(developer).
5. "구현 위임" 항목 4에 `spec-draft-nullable-notation-followups.md` §5(d)·(e) 교차 참조 추가(같은 커밋 처리 또는 유효성 재확인 문구).
6. (선택) `3-error-handling.md §1.12` 신설 검토, Rationale 인용 앵커 보정, cross-file 인용 포맷 준수, 트래커 재기술 근거 기록.
