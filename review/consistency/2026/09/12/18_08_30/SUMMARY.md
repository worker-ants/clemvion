# Consistency Check 통합 보고서

**BLOCK: NO** — 5개 checker 전원 Critical 0건. `spec/5-system/` 스코프 델타 0(순수 코드 리팩터)이며, 응답 형태·에러 코드·RBAC·데이터 모델 모두 무변경임을 cross_spec/rationale_continuity/convention_compliance/plan_coherence/naming_collision 다섯 checker가 각자 독립적으로 실측 확인.

## 전체 위험도
**LOW** — Critical 없음. 신규 코드가 도입한 불변식 하나(DTO 클래스명 전역 유일성)가 아직 `swagger.md`에 미반영, 신규 파일 하나가 `15-chat-channel.md`의 좁은 `code:` glob 밖에 있음. 둘 다 developer 권한 밖(spec 수정 필요)이지만 이미 트래커에 등재됐거나 등재를 제안받은 상태.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음 — 이번 라운드에 Critical 발견 자체가 없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | naming_collision (cross_spec·rationale_continuity가 같은 사실을 INFO로도 보고 — 최강 등급인 WARNING으로 통합) | `15-chat-channel.md` frontmatter `code:` glob(`.../triggers/dto/chat-channel-*.dto.ts`)이 신규 파일 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts`를 못 잡음(`*`가 `/`를 안 넘음). §7 파일 트리도 이 파일을 열거하지 않음 | `spec/5-system/15-chat-channel.md` frontmatter `code:`, §7 파일 트리 | 신규 코드 파일 `codebase/backend/src/modules/triggers/dto/responses/chat-channel-rotate-bot-token-response.dto.ts` | planner 턴에서 glob을 `dto/**/chat-channel-*.dto.ts`로 확장 + §7 트리 갱신. developer 권한 밖이나 spec-link 판정 자체는 `2-trigger-list.md`의 광역 `dto/**` glob이 이미 덮고 있어(실측 확인) 게이트는 정상 작동 중 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md:3082-3095`, `:2973`에 planner 후속으로 등재됨. 추가 조치는 그 턴에서 처리 |
| 2 | convention_compliance | 이번 PR이 코드로 새로 도입한 build-blocking 불변식("DTO 클래스명은 저장소 전체에서 유일해야 한다")이 `swagger.md §5-1` 본문 어디에도 프로즈로 서술되지 않음(§5-1의 기존 "이름 충돌을 피합니다" 문단은 `*.literal.ts` 상수 한정) | `spec/conventions/swagger.md §5-1` | 신규 `codebase/backend/src/repo-guards/__tests__/dto-class-name-collision-guard.ts` + `dto-class-name-collision.spec.ts` (유일한 서술처가 테스트 JSDoc뿐) | planner 턴에서 `swagger.md §5-1`에 규칙 프로즈 추가 + frontmatter `code:` 목록에 두 신규 가드 파일 등재(현재 미등재로 확인됨, tracker에도 아직 없음 — 신규 등재 필요) |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | `chat-channel-input-rules.ts`가 입력검증+출력변환(에러 번역) 두 책임을 겸함을 §7 한 줄 설명이 반영 안 함(기존 함수, 이번 PR 신규 아님) | `spec/5-system/15-chat-channel.md §7`, `chat-channel-input-rules.ts` | 조치 불필요 — PR이 헤더 주석 확장으로 명시 대응, planner가 §7 다음 편집 시 파일 분리 여부와 함께 결정 예정(`spec-draft-nullable-notation-followups.md:2973`) |
| 2 | convention_compliance | `rotateBotToken`의 신규 `@ApiUnauthorizedResponse({description:'인증 실패'})`가 §2-4 기본 문구('인증 실패 또는 토큰 만료')와 다름(저장소 내 165 vs 6곳, 기존 소수 패턴 재사용) | `triggers.controller.ts` `rotateBotToken` | 급하지 않음 — 다음 편집 시 문구 통일 또는 `swagger.md §2-4`에 요약형 허용 명시 |
| 3 | plan_coherence | 소유 plan(`chat-channel-rules-cleanup.md`) 체크리스트가 실제 완료 상태(6라운드 리뷰·상위 트래커 `[x]` 반영됨)보다 뒤처짐 | `plan/in-progress/chat-channel-rules-cleanup.md` §체크리스트 | `plan/complete/` 이동 전 체크박스를 실제 상태로 동기화 |
| 4 | plan_coherence | `15-chat-channel.md` L379/L433의 트리거 재호출 미확정 서술은 이번 diff 범위 밖(`triggers.service.ts` 변경 5줄 전부 타입 주석) | `spec/5-system/15-chat-channel.md` L379, L433 | 조치 불필요 |
| 5 | naming_collision | 신규 식별자(`throwInvalidField`·`hasField`·`rejectBlockedField`·`ChatChannelBlockedField`·`ChatChannelRotateBotTokenDto`·`ChatChannelRotateBotIdentityDto`) 전수 grep 결과 충돌 0건 | `codebase/backend/src/modules/triggers/**` | 조치 불필요(기록용) |
| 6 | naming_collision | 이전 라운드 실제 CRITICAL(`ChatChannelBotIdentityDto` 클래스명 충돌)이 개명으로 이미 해소되고 재발방지 가드까지 포함됨을 독립 grep(256개 DTO 클래스명 uniq)으로 재확인 | `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` | 조치 불필요(기록용) |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | NONE | spec 델타 0, 응답/RBAC/데이터모델 불변 확인. self-view 파일트리 갭은 이미 트래커에 등재된 잔여 항목 |
| rationale_continuity | NONE | 모든 Rationale(R-CC-21~23, R-12) 유지. R-CC-22 narrow glob 갭은 developer가 스스로 실측·기록하고 새 근거와 함께 planner 처분으로 등재한 모범 사례 |
| convention_compliance | LOW | swagger.md §5-1/§2-4/§2-api-convention §5.3 대부분 준수. 신규 불변식(DTO 클래스명 유일성) 문서 미반영 WARNING 1건 |
| plan_coherence | NONE | 소유 plan·상위 트래커·backlog plan 전부 충돌 없음. 자체 체크리스트 stale은 plan 위생 이슈 |
| naming_collision | LOW | 신규 식별자 전수 grep 충돌 0건, 과거 CRITICAL 이미 해소·검증. glob 미포함 WARNING 1건(다른 checker와 통합) |

## 권장 조치사항
1. (다음 planner 턴) `spec/conventions/swagger.md §5-1`에 "DTO 클래스명은 저장소 전체에서 유일해야 한다" 규칙 프로즈 추가 + frontmatter `code:`에 `repo-guards/__tests__/dto-class-name-collision-guard.ts`/`.spec.ts` 등재. 아직 트래커 미등재로 확인됨 — 신규 항목으로 남길 것.
2. (다음 planner 턴, 이미 등재됨) `spec/5-system/15-chat-channel.md` frontmatter `code:` glob을 `dto/**/chat-channel-*.dto.ts`로 확장 + §7 파일 트리에 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` 반영. `spec-draft-nullable-notation-followups.md:3082-3095`, `:2973` 참고.
3. (developer, 즉시 가능) `plan/in-progress/chat-channel-rules-cleanup.md` 체크리스트를 실제 완료 상태로 동기화한 뒤 `plan/complete/`로 이동.
4. (선택, INFO) `rotateBotToken`의 `@ApiUnauthorizedResponse` 문구를 저장소 다수 패턴('인증 실패 또는 토큰 만료')과 통일하거나 `swagger.md §2-4`에 요약형 허용 명시.