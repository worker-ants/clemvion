# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker(cross_spec / rationale_continuity / convention_compliance / plan_coherence / naming_collision) 전원이 전문을 반환했고, CRITICAL 판정은 하나도 없다(전원 WARNING 이하). 재시도 필요 checker 없음.

## 전체 위험도
**LOW** — 이번 PR(`impl-details-code-wiring`, `spec/5-system/` 델타 0·codebase 10파일/829줄, `chatChannel` PATCH 검증 에러 `details[].code` 배선 + `botToken` 빈 문자열 차단)은 이미 `origin/main` 에 병합된 spec 규약(`2-api-convention.md §5.3` "field 를 실으면 code 도 싣는다")을 코드에 배선하는 후속 구현이며, 새 CRITICAL 위반·기각된 대안 재도입·명명 충돌은 발견되지 않았다. 유일한 실질 사안은 이 PR 이 스스로 예고했던 spec 문서 stale화(`15-chat-channel.md §5.4.1.2`)를 실제로 발생시켰다는 점인데, 이는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner-턴 필요 항목으로 정확히 등재돼 있다.

## Critical 위배 (BLOCK 사유)

(없음 — 5개 checker 모두 CRITICAL 0건)

## planner 인계 (권한 밖 Critical)

> CRITICAL 이 없으므로 해당 없음.

| # | 권한 밖인 이유 | 인계 대상 | planner 가 고칠 것 (파일·섹션) | 추적 위치 |
|---|---------------|----------|------------------------------|----------|
| — | (없음) | — | — | — |

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec, convention_compliance | `15-chat-channel.md §5.4.1.2` 닫는 문단이 "`details[].code` 는 아직 안 실린다 · 뒤따르는 PR 이 배선한다" 는 미래형 서술을 유지 중인데, 정확히 이번 PR 이 그 배선(`chatChannel`·`provider` 두 자리)을 완료해 문단이 실측상 거짓이 됨 | `spec/5-system/15-chat-channel.md` §5.4.1.2 닫는 문단 | `codebase/backend/src/modules/triggers/triggers.service.ts` 734·745행(이번 diff) + `spec/5-system/2-api-convention.md §5.3` | developer 는 `spec/` 쓰기 권한 없음(그 문장은 이전 planner 턴이 작성, 자기-반증형 소정정 요건 불성립) → planner 턴에서 문단을 "배선 완료" 시제로 정정(취소선+정정 병기). **이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner-턴 필요 항목(②, "명백히 거짓")으로 등재됨** — 신규 발견 아님, 병합 차단 사유 아님 |
| 2 | cross_spec(WARNING) / rationale_continuity·convention_compliance·naming_collision(INFO) → 최강 등급 채택 | `authConfigId` 검증 실패 응답이 top-level 특화 코드(`AUTH_CONFIG_NOT_FOUND`)와 generic `details.code`(`INVALID_FIELD`)를 동시에 실어, §5.3 "top-level 을 특화 코드로 바꾸면서 같은 사유를 details 에도 넣으면 겹쳐 쓰는 것" 문면과의 정합이 미확정 | `codebase/backend/src/modules/triggers/triggers.service.ts` `assertAuthConfigInWorkspace` 부근(~1005~1024행, 이번 diff) | `spec/5-system/2-api-convention.md §5.3` | planner 결정 선행 필요(§5.3 에 "도메인 특화 코드 + generic INVALID_FIELD 병기는 겹쳐 쓰는 것으로 보지 않는다" 류 carve-out 명시). **이미 코드 주석 + `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 판정 대기로 등재됨** — 신규 위반 아니라 개발자가 스스로 발견해 등재한 미결 사안. 현행 코드 유지 근거 있음(제거 시 이 자리만 generic 표지 없는 특례가 됨) |
| 3 | plan_coherence | 이번 PR 이 실제로 해소한 4개 선행 트래커 항목(`:2219` botToken minLength, `:2224` 메시지 리터럴 복붙, `:2237` details.code 미배선, `:2278` swagger.md 줄번호 stale)이 `spec-draft-nullable-notation-followups.md` 에서 여전히 `[ ]` 미체크 상태 | `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 4개 항목) | 이번 PR 커밋(`0710021f0` A/B/C/D 등) | 리뷰-only 마무리 커밋에서 4개 항목을 `[x]` 로 전환 + 완료 각주 부기 |
| 4 | plan_coherence | `impl-details-code-wiring.md` 가 "## 3라운드 리뷰 처분 — 종결" 로 끝나 있으나 실제로는 4라운드(`9fcce3f47`, `a81e9bdf9`)가 진행됨 — 문서 자체의 "최대 3라운드, 초과 시 사용자 보고" 정지 규칙 초과 사유·궤적이 plan 본문에 없음(커밋 메시지에만 존재) | `plan/in-progress/impl-details-code-wiring.md` (라운드 이력 섹션) | git 커밋 이력 `9fcce3f47`·`a81e9bdf9` | `## 4라운드 리뷰 처분 (…) — 종결` 섹션을 추가해 실제 라운드 수·초과 사유·수렴 궤적(R1 5개→R2 2개→R3 2개→R4 2개, CRITICAL 0 유지) 기록. `complete/` 이동 전 필수 — 이동 후엔 git log 에만 남고 plan 이력에서 사라짐 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `details.code` 배선이 인접 spec 문서 3곳(`slack.md`, `discord.md`, `2-trigger-list.md`)의 예시 문면에는 아직 반영되지 않음(오독 위험은 낮음, SoT 포인터 인용 문서) | `spec/4-nodes/7-trigger/providers/slack.md:275`, `discord.md:297`, `spec/2-navigation/2-trigger-list.md:176-178,334` | `spec-draft-nullable-notation-followups.md` 트래커 항목 처리 시 함께 갱신 |
| 2 | rationale_continuity | `common/`(`password.util.ts`, 리터럴 `'INVALID_FIELD'`) vs `modules/**`(`triggers.service.ts`, canonical `ErrorCode.INVALID_FIELD`) 간 상수 사용 비대칭에 대한 spec Rationale 부재(근거는 코드 주석에 있으나 spec 미반영) | `codebase/backend/src/common/utils/password.util.ts` | 다음 spec 갱신 시 `error-codes.md` 또는 `2-api-convention.md §5.3` 에 "common/ 레이어는 리터럴 유지" 한 줄 보강 |
| 3 | convention_compliance | 신규 파일 `chat-channel-rejection-messages.const.ts` 가 `15-chat-channel.md` frontmatter `code:` 목록에 없음(빌드 가드 강제 대상 아님, `/spec-coverage` standing audit 로 보완 예정인 알려진 갭 클래스) | `spec/5-system/15-chat-channel.md` frontmatter | 완전성을 위해 `code:` 리스트에 신규 경로 추가 권장(비차단) |
| 4 | convention_compliance | 차단 5필드 거부 메시지의 문체 혼재(`botTokenRef`/`inboundSigningRef`/`inboundSigning`=합니다체, `botToken`/`inboundSigningPlaintext`=해요체) — `i18n-userguide.md` Principle 6 스코프가 API 에러 메시지까지 포함하는지 자체가 불명확 | `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` | 선존 문구를 그대로 상수화한 것뿐(이번 PR 신규 아님). 스코프 확정 후 처리할 planner 결정 후보로만 등재 |
| 5 | plan_coherence | `botToken` 형식 정규식의 provider 무자격(planner)·provider별 형식 검증 미구현 항목이 developer plan(`impl-details-code-wiring.md`)에만 있고 durable 트래커(`spec-draft-nullable-notation-followups.md`)에 미이관 | `plan/in-progress/impl-details-code-wiring.md:153-155` | 리뷰-only 마무리 커밋에서 `spec-draft-nullable-notation-followups.md` 로 이관(유실 방지) |
| 6 | naming_collision | 신규 식별자 4개(`CHAT_CHANNEL_BLOCKED_FIELDS`/`ChatChannelBlockedField`/`CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`/`chat-channel-rejection-messages.const.ts`) 전수 grep 대조 — 기존 사용처와 이름·의미 충돌 없음, 재사용된 `'INVALID_FIELD'` 값도 spec 카탈로그와 정확히 일치 | `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` | 조치 불요 (정합 확인 기록) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | `15-chat-channel.md §5.4.1.2` stale 서술(이미 트래킹 중) · `authConfigId` §5.3 판정 미확정(WARNING) |
| rationale_continuity | LOW | 과거 기각 대안(rotate 빈값가드, PATCH-rotate 분리) 재도입 없음 확인. `authConfigId`·layering 비대칭은 이미 등재된 INFO |
| convention_compliance | LOW | `§5.3` 출력 포맷 정확 준수 확인. `15-chat-channel.md` stale 문단(WARNING) · frontmatter 완전성·문체 혼재는 INFO |
| plan_coherence | LOW | 코드-plan 대조 촘촘. 완료 항목 체크박스 미갱신·라운드 이력 뒤처짐(WARNING 2건) — 내용 손실 아닌 표시 지연 |
| naming_collision | NONE | 신규 식별자 4개 전수 검토, 충돌 0건 |

## 권장 조치사항
1. planner 턴에서 `15-chat-channel.md §5.4.1.2` 닫는 문단을 "배선 완료" 시제로 정정(취소선+정정 병기) — `spec-draft-nullable-notation-followups.md` 에 이미 등재된 항목 처리.
2. planner 턴에서 `2-api-convention.md §5.3` 에 `authConfigId` 류(도메인 특화 top-level code + generic `details.code` 병기) carve-out 명시.
3. 리뷰-only 마무리 커밋에서 `spec-draft-nullable-notation-followups.md` 의 이미 해소된 4개 항목(`:2219`·`:2224`·`:2237`·`:2278`)을 `[x]` 로 전환.
4. 같은 커밋에서 `impl-details-code-wiring.md` 에 "4라운드 리뷰 처분 — 종결" 섹션 추가(실제 라운드 수·초과 사유·수렴 궤적 기록) 및 `botToken` 형식검증 항목을 durable 트래커로 이관.
5. INFO 항목(인접 spec 문서 예시 3곳 미반영, frontmatter `code:` 리스트 보강, layering Rationale 보강, 문체 혼재 스코프 확정)은 다음 spec 갱신 턴에 일괄 처리.
