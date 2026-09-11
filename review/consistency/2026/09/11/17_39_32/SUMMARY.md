# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 결과 확보 완료, CRITICAL 없음.

## 전체 위험도

**MEDIUM** — CRITICAL 없이 착수 가능하나, `plan_coherence` 가 지적한 두 WARNING(신규 파일의 spec frontmatter 미등재 + 소유 클래스 현재형 서술 stale화)이 이번 T2 diff 자체가 직접 만드는 결과이므로 완료 커밋 전에 처리 권장.

## Critical 위배 (BLOCK 사유)

없음.

## planner 인계 (권한 밖 Critical)

(없음) — CRITICAL 발견 자체가 없어 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | plan_coherence | T2가 신설하는 `chat-channel-binder.service.ts`·`trigger-callback-url.ts` 2개 파일이 `15-chat-channel.md` frontmatter `code:`(명시 경로 나열, glob 아님)에 자동 등재되지 않음 — T1이 `chat-channel-input-rules.ts`로 이미 만든 같은 결함 클래스의 재발이며 그 갭은 아직도 열려 있음(3라운드 연속 관측) | `spec/5-system/15-chat-channel.md` frontmatter `code:` | T1(`plan/complete/impl-chat-channel-binder.md`)이 만든 선행 미등재 갭, `spec-draft-nullable-notation-followups.md:2199-2214` | T2 체크리스트에 frontmatter `code:` 갱신 항목 추가(2개 파일 등재), 또는 `triggers/` 하위를 glob 패턴으로 전환해 재발 자체를 차단 |
| 2 | rationale_continuity + plan_coherence (동일 결함, 양쪽 독립 지적 — 통합) | `secret-store.md:146`, `chat-channel-adapter.md:369`, `data-flow/14-chat-channel.md:29` 세 곳이 `setupChatChannel`을 `TriggersService`/`triggers.service.ts` 소유로 **현재형** 서술 — T2가 계획대로 `ChatChannelBinderService`로 이동하면 존재하지 않는 클래스/파일을 가리키는 사실 오류가 됨 | `spec/conventions/secret-store.md:146`, `spec/conventions/chat-channel-adapter.md:369`, `spec/data-flow/14-chat-channel.md:29` (+ `15-chat-channel.md` §7 구현 파일 구조 다이어그램, rationale_continuity INFO) | T2 plan 의 "새 파일 2개" 설계(`ChatChannelBinderService.setupChatChannel`) | T2 완료 후 `--impl-done` 라운드에서 3곳을 `ChatChannelBinderService.setupChatChannel`로 갱신(또는 클래스 비특정 서술로 완화) — T1이 `assertInboundSigningPlaintextByProvider`에 적용한 것과 동일 절차(전수 재실측 + `spec-draft-nullable-notation-followups.md` 등재)를 반복 적용 |
| 3 | convention_compliance | `rotate-bot-token` endpoint(`POST /api/triggers/:id/chat-channel/rotate-bot-token`)에 spec §5.4가 문서화한 API 계약(성공 응답 DTO·요청 DTO·6종 에러 코드)에 대응하는 OpenAPI 데코레이터가 전혀 없음(`@ApiOkResponse`/`@ApiBody`/`@ApiBadRequestResponse` 등 부재, 형제 endpoint `revokePerTriggerToken`은 갖춤) | `spec/5-system/15-chat-channel.md` §5.4 vs `codebase/backend/src/modules/triggers/triggers.controller.ts` `rotateBotToken`(245~283행) | swagger.md §1/§2-4/§5 의무 조항 | 응답 DTO(`rotate-bot-token-response.dto.ts`) 신설 + `RotateBotTokenDto` 요청 DTO 승격 + 에러 데코레이터 추가. **T2 diff 범위 밖의 사전 존재 갭** — 이번 작업을 막을 사유 아님, 별도 plan 항목으로 등록 권장 |
| 4 | naming_collision | 신규 `buildTriggerCallbackUrl`이 캡슐화하는 `APP_URL` 기본값(`http://localhost:3011`) fallback 로직이 `common/utils/app-base-url.ts`의 `getAppBaseUrl()`("단일 표준 fallback"으로 명시 설계됨)과 이름만 다르고 개념은 동일 — 이름 충돌은 아니지만 두 진입점이 조용히 divergence 할 위험 | `codebase/backend/src/modules/triggers/trigger-callback-url.ts` (신규) vs `codebase/backend/src/common/utils/app-base-url.ts` | 기존 `getAppBaseUrl()` "단일 표준" 설계 원칙 | 이번 PR 은 순수 이동이라 통합 불필요(정당한 범위 제한). `trigger-callback-url.ts` docstring에 "이 fallback 리터럴은 `getAppBaseUrl()`과 중복, 통합 대상" 한 줄 포인터 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | rationale_continuity | `15-chat-channel.md` §7(본문, Rationale 아님) "구현 파일 구조" 다이어그램이 신규 파일 2개를 반영하지 않아 이동 후 stale | `spec/5-system/15-chat-channel.md` §7 | 위 WARNING #1·#2와 같은 후속 트래커 등재에 병기 |
| 2 | convention_compliance | `ChatChannelConfigDto`의 `botTokenRef`/`inboundSigningRef`/`inboundSigning`에 붙은 `readOnly: true`가 swagger.md §1-5 정의("응답에 나가는 서버 발급 필드")와 어긋남 — 실제로는 응답에서도 strip됨. 현재 응답 스키마(`config: Record<string,unknown>`)엔 영향 없으나 향후 SDK 코드젠 오해 소지 | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:196-251` | 급하지 않음. 다음 편집 시 주석 보강 또는 `writeOnly` 대안 검토 |
| 3 | plan_coherence | `spec-draft-nullable-notation-followups.md:2216-2226`의 lost-update(동시 PATCH) 후속 항목이 `TriggersService` 내부 호출을 전제한 서술 — T2 이후 호출이 서비스 경계를 건너 락 설계 시 인터페이스가 하나 더 필요해짐 | `plan/in-progress/spec-draft-nullable-notation-followups.md:2216-2226` | T2 완료 시점에 "호출부가 `ChatChannelBinderService`로 이동함" 각주 추가 |
| 4 | naming_collision | 신규 파일명(`chat-channel-binder.service.ts`, `trigger-callback-url.ts`)은 `triggers/` 기존 명명 컨벤션(서비스=`.service.ts`, 순수 함수=접미사 없음)에 정확히 부합, 전역 grep 이름 충돌 없음. `setupChatChannel`/`teardownChatChannel`은 신규 도입이 아니라 소유 클래스만 바뀌는 이동. `buildTriggerCallbackUrl`은 OAuth `buildOAuthCallbackUrl` 계열과 바운디드 컨텍스트가 달라 혼동 없음 | 해당 없음 | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | `15-chat-channel.md` 축 cross-spec 정합 완전 일치(데이터모델·API계약·상태전이·권한모델 전부 대조, 모순 없음). §3.4.3 앵커 오류는 intra-doc 이슈로 스코프 밖 참고만 |
| rationale_continuity | LOW | R-CC-21 등 Rationale invariant 준수 확인. 유일 간극은 Rationale 절이 아닌 SoT 코드-포인터 3곳(WARNING #2로 통합) |
| convention_compliance | LOW | 에러코드·감사액션·Redis키·secret ref·DTO명명 등 5관점 대부분 합치. 유일 실질 격차는 코드 표면(OpenAPI 데코레이터 부재, T2 diff 범위 밖) |
| plan_coherence | MEDIUM | T2 diff가 직접 만드는 두 결함 클래스(frontmatter 미등재 재발 + SoT 현재형 서술 stale화)를 T2 plan이 아직 인수하지 않음 |
| naming_collision | LOW | 신규 식별자 4개 전수 grep, 리터럴 충돌 없음. 유일 관찰은 이름 다른 개념 중복(fallback 로직) |

## 권장 조치사항

1. T2 체크리스트에 `15-chat-channel.md` frontmatter `code:` 갱신 항목 추가 — 신규 파일 2개(`chat-channel-binder.service.ts`, `trigger-callback-url.ts`) 등재, 또는 `triggers/` 하위 glob 전환으로 재발 차단 (WARNING #1)
2. T2 완료 후 `--impl-done` 라운드에서 `secret-store.md:146`·`chat-channel-adapter.md:369`·`data-flow/14-chat-channel.md:29` 및 `15-chat-channel.md` §7 다이어그램의 `TriggersService.setupChatChannel` 현재형 서술을 실제 이동 결과에 맞게 정정 (WARNING #2, INFO #1)
3. 위 1·2 항목을 `spec-draft-nullable-notation-followups.md`에 이월 등재해 T1 갭과 같은 방식으로 추적
4. (범위 밖, 별도 plan) `rotate-bot-token` endpoint OpenAPI 데코레이터 보강 — 응답/요청 DTO + 에러 데코레이터 (WARNING #3)
5. (선택) `trigger-callback-url.ts`에 `getAppBaseUrl()` 중복 포인터 코멘트 (WARNING #4), lost-update 후속 항목에 서비스 경계 이동 각주 (INFO #3)
