# API 계약(API Contract) 리뷰

## 검증 방법 (요약)

이 라운드(`review/code/2026/09/11/15_57_42`)의 실제 코드 변경분은 `git diff 2ae81077c 6dc2b7d60`
(직전 커밋 `2ae81077c` → 이번 커밋 `6dc2b7d60`)로 확인했다. `codebase/**` 아래 변경 파일은
신규 `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` **단 1개**뿐이다.
프롬프트에 포함된 `chat-channel-input-rules.ts` · `triggers.service.ts` 는 이번 커밋에서
**변경되지 않았다** — 이전 라운드(`15_31_54`)에서 이미 API 계약 관점 NONE 으로 검토된 상태
그대로다(`git diff 2ae81077c 6dc2b7d60 -- codebase/backend/src/modules/triggers/chat-channel-input-rules.ts codebase/backend/src/modules/triggers/triggers.service.ts` 출력 없음, 저장소 트리는 건드리지 않고 읽기 전용으로 확인).

나머지 변경분은 `plan/in-progress/impl-chat-channel-binder.md`(정정) ·
`plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 등재) ·
`review/code/2026/09/11/15_31_54/**`(이전 라운드 리뷰 산출물 커밋 반영)로, 전부 문서/프로세스
산출물이며 DTO·컨트롤러·라우트·에러 봉투 어느 것도 접촉하지 않는다.

## 발견사항

- **[INFO]** 순수 함수로 이동한 검증 로직에 처음으로 전용 계약 테스트가 붙었다
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-input-rules.spec.ts` (전체, 특히 `:42-81` 내부 필드 차단 봉투 검증, `:145-173` provider 분기 검증)
  - 상세: 신규 spec 이 `BadRequestException` 페이로드의 `{code: 'VALIDATION_ERROR', message, details: {field, code: 'INVALID_FIELD'}}` 형태를 `it.each` 로 6개 필드/분기에 대해 직접 단언한다. 종전에는 이 봉투 형태가 `TriggersService` 메서드에 갇혀 있어 서비스 전체를 mock 해야만 검증할 수 있었고 실제로 그렇게 테스트된 적이 없었다(파일 docstring 이 밝히듯 `translateSetupChannelError` 는 이동 전 테스트 0건). 이는 API 계약(에러 응답 형식) 관점에서 순증 — 향후 회귀를 컴파일이 아니라 테스트가 잡아줄 표면이 늘었다.
  - 제안: 없음(순증이므로 조치 불필요).

- **[INFO]** 캐너리 테스트가 고정한 기존 상태-코드 불일치는 이번 diff 가 만든 것이 아니며, 수정 대상도 아니다
  - 위치: `chat-channel-input-rules.spec.ts:163-184` (`[캐너리] discord verify_key 불일치는 지금은 502 로 떨어진다`) — 대상 로직은 `chat-channel-input-rules.ts:304-318` (`translateSetupChannelError`, 이번 커밋에서 미변경)
  - 상세: `translateSetupChannelError` 의 판별식 `/\b(401|403)\b/` 이 discord adapter 가 던지는 `'BOT_TOKEN_INVALID: Discord verify_key 가 등록된 public key 와 불일치'` (숫자 없음)를 못 잡아 의도한 400 `BOT_TOKEN_INVALID` 대신 502 `CHAT_CHANNEL_SETUP_FAILED` 로 응답한다. 이는 "관점 4: 에러 응답 형식 일관성·HTTP 상태 코드 적절성" 에 해당하는 실재하는 계약 결함이지만, (a) 이동 전부터 존재했고 이 diff 가 만든 회귀가 아니며, (b) 캐너리 테스트로 현재 동작이 명시적으로 고정됐고, (c) `plan/in-progress/spec-draft-nullable-notation-followups.md:2536-2545` 에 근본 처방 후보(adapter 가 status 를 메시지에 싣도록 통일)까지 등재되어 유실 위험이 낮다. 이번 diff 를 근거로 새로 차단할 사안은 아니다.
  - 제안: 트래커 항목을 planner/developer 후속 턴에서 처리(이미 등재됨, 추가 조치 불요). 재발 방지를 위해서만 남긴다 — 이 항목을 "이번 PR 의 신규 결함"으로 재분류하지 말 것.

- **[INFO]** `spec_impact: none` 과 spec 심볼 귀속 drift 정정은 API 계약(와이어 스키마) 자체와는 무관하다
  - 위치: `plan/in-progress/impl-chat-channel-binder.md:7`(`spec_impact: none`), `spec-draft-nullable-notation-followups.md:2523-2534`(귀속 정정 항목 신규 등재)
  - 상세: 이번 라운드가 고친 것은 `spec/4-nodes/7-trigger/providers/{slack,discord}.md` 가 인용하는 **심볼 경로**(`TriggersService.assertInboundSigningPlaintextByProvider` → module-level 함수로 이동) 표기 오류를 트래커에 정식 등재한 것이다. 실제 HTTP 요청/응답 계약(검증 규칙·에러 코드·필수/금지 필드)은 이동 전후 동일하며, 이는 이전 라운드에서 6개 함수 본문을 텍스트 단위로 대조해 이미 확인된 사실이다. 즉 이번 정정은 "문서가 가리키는 구현 위치"의 정확성 문제이지 API 계약 자체의 변경이 아니다.
  - 제안: 없음 — documentation/architecture reviewer 영역이며 이미 적절히 트래커에 반영됨.

점검 관점 1~8 대조:

1. 하위 호환성 — 접촉 없음. Breaking change 없음.
2. 버전 관리 — 해당 없음.
3. 응답 형식 — 접촉 없음(신규 테스트가 기존 형식을 검증만 함).
4. 에러 응답 — 접촉 없음. 단, 위 INFO 로 기재한 기존 discord 상태 코드 불일치는 참고용으로 남김(이번 diff 유발 아님).
5. 요청 검증 — 접촉 없음(로직 무변경, 테스트만 추가).
6. URL/경로 설계 — 접촉 없음(컨트롤러·라우트 파일이 changeset 밖).
7. 페이지네이션 — 무관 영역.
8. 인증/인가 — 접촉 없음.

## 요약

이번 라운드의 `codebase/**` 변경은 신규 단위 테스트 파일 1개뿐이며, API 계약을 구성하는 DTO·컨트롤러·라우트·에러 봉투·검증 로직은 이번 커밋에서 전혀 수정되지 않았다(직전 커밋 대비 diff 없음, 읽기 전용으로 확인). 나머지 변경은 plan/tracker 문서 정정 및 이전 리뷰 라운드 산출물 커밋 반영으로, API 계약 표면에 영향을 주지 않는다. 신규 테스트는 오히려 에러 봉투 형태(`code`/`message`/`details.field`/`details.code`)에 대한 회귀 감지력을 높이는 순증이다. 캐너리로 고정된 discord 상태 코드 불일치는 실재하는 계약 결함이지만 이번 diff 가 만든 것이 아니고 이미 트래커에 등재돼 유실 위험이 낮으므로 이번 라운드의 차단 사유로 삼지 않는다.

## 위험도

NONE
