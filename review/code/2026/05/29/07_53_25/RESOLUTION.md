# RESOLUTION — 07_53_25

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #3 (requirement CRITICAL — openFormModal vs spec) | spec | resolved-by-spec 6b1194a7 | steering note 1: spec amendment 가 openFormModal? 설계를 공식 승인. 코드 변경 없음. |
| #1 (security CRITICAL — channelUserKey open_form_modal) | 코드 | bd6c65ce | open_form_modal 분기에 state.channelUserKey vs update.channelUserKey 불일치 시 logger.warn + 'ignored' 반환 |
| #2 (security CRITICAL — channelUserKey form_submission) | 코드 | bd6c65ce | form_submission 분기 동일 guard 추가 |
| #4 (requirement CRITICAL — pendingFormModal not cleared) | 코드 | bd6c65ce | dispatcher else 분기(form_prompt)에 `state.pendingFormModal = undefined` 추가 |
| #5 (requirement CRITICAL — Discord validation-fail re-noise) | 코드 | bd6c65ce | form_submission catch에서 best-effort sendMessage로 form_modal 버튼 재발송 (§4.1 step 5) |
| #6 (security WARNING — fields allowlist) | 코드 | bd6c65ce | form_submission에서 update.command.fields를 pendingFormModal.fields names로 allowlist 필터링 |
| #7 (security WARNING — extractFormFields name regex) | 코드 | bd6c65ce | extractFormFields에 `/^[a-zA-Z0-9_-]{1,64}$/` 정규식 검증 추가 |
| #8 (frontend WARNING — formMode type+default+i18n) | 코드 | bd6c65ce | trigger-detail-drawer formMode 타입 확장 + formModeLabel 함수, page.tsx 기본값 "auto", KO/EN dict 키 추가 |
| #9 (testing SHOULD FIX — 4개 test 추가) | 코드 | 078fb550 | hooks.service.spec catch path + channelUserKey mismatch, hooks.controller.spec.ts 신규, telegram.adapter.spec form_modal throw + supportsNativeForm |
| #10 (testing SHOULD FIX — trigger-dto-validation) | 코드 | 078fb550 | native_modal/auto 통과 + invalid_mode reject 케이스 |
| #11 (user_guide_sync WARNING — MDX docs) | 코드 | 078fb550 | slack.{mdx,en.mdx} + discord.{mdx,en.mdx} Form 노드 native modal 절 KO/EN 추가 |

**NICE 항목 (maintainability):**
- discord.adapter: `slice(0, 5)` → `slice(0, NATIVE_MODAL_MAX_FIELDS)` 상수 참조 (bd6c65ce 포함)
- NativeFormAdapter 서브인터페이스 리팩토링 + distributed-lock 동시성 항목은 후속 작업으로 보류 (아래 §보류)

## TEST 결과

- lint  : 통과
- unit  : 통과 (5054 passed — backend + frontend)
- build : 통과
- e2e   : 통과 (127/127)

## 보류·후속 항목

- NICE — NativeFormAdapter 서브인터페이스 분리 리팩토링: openFormModal/buildFormSubmissionResponse를 별도 인터페이스로 추출하는 아키텍처 개선. 기능 영향 없음 → 별도 PR 권장.
- NICE — distributed-lock 동시성 (concurrency review): pendingFormModal 상태 읽기/쓰기 간 race condition 방어. Redis-level lock 또는 낙관적 버전 필드 도입 → 별도 spec/plan 작성 필요.
- INFO — `form_submission.fields` 키별 타입 검증 (pattern/email/숫자 범위): 현재 EIA `submit_form`에 raw string map을 전달하며 Form 노드 내부 서버 검증에 의존. 이번 allowlist 필터로 key injection은 차단됨. 값 타입 검증은 Form 노드 구현 영역 → 별도 추적.
- INFO — `private_metadata` 평문 전송 위험 수용 문서화 (Slack): 위험 모델 SoT spec에 명시 권장 → project-planner 위임.
