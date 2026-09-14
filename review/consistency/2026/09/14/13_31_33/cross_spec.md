# Cross-Spec 일관성 검토 — trigger-canary-hardening

## 검토 범위 및 전제

- target 영역: `spec/conventions/` (impl-done, diff-base=`origin/main`)
- **scope 델타 0개** — 이 브랜치는 `spec/conventions/` 를 포함해 `spec/**` 어디도 수정하지 않았다. 확인: `git diff origin/main...HEAD --stat -- spec/` (결과 없음).
- 실 구현 diff는 `codebase/` 6개 파일(테스트·가드 코드)뿐이며, 절대경로 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-canary-hardening-a71e04`)에서 `git diff origin/main...HEAD -- codebase/` 로 전문을 직접 확인했다(프롬프트 번들의 diff 섹션은 예산 절단으로 생략돼 있었음).
- 변경 내용 요약: ① `trigger-secret-columns-guard.ts` + `.spec.ts` 신설 — 트리거 응답에서 지워야 할 비밀 컬럼 목록(`TRIGGER_RESPONSE_STRIP_COLUMNS` 정본 vs 테스트 헬퍼 2곳의 `TRIGGER_SECRET_COLUMNS` 사본)의 3중 정합을 정적(AST)으로 가드. ② `trigger-workflow-ref.spec.ts` 헤더 주석 정리(가드 번호 표기 통일, 자리 수 이중 서술 제거). ③ `schedule-trigger.e2e-spec.ts`·`trigger-workflow-ref.e2e-spec.ts`·`chat-channel-trigger-create.e2e-spec.ts` 에 `TriggerDto.workflow` 양성 e2e 단언 3곳 추가 + 註 보강. 전부 테스트/가드 코드이며 신규 endpoint·필드·상태·권한을 도입하지 않는다.

## 교차 검증 — 코드가 언급하는 spec 주장의 정합성 확인

diff 주석이 여러 spec 문서를 직접 인용하므로, "코드가 spec 을 정확히 반영하는가" 를 확인했다(spec 자체는 미변경이므로 CRITICAL/WARNING 대상은 아니고 정합성 검증 목적).

1. **`TriggerDto.workflow` 키 생략(§5.4 (b))** — `schedule-trigger.e2e-spec.ts` 신규 단언 3곳(목록 C-2, PATCH G·H)의 근거로 인용한 [`5-system/2-api-convention.md §5.4`](spec/5-system/2-api-convention.md#54-부재-표현--null-vs-키-생략) 와 [`2-navigation/3-schedule.md`](spec/2-navigation/3-schedule.md) 를 대조 — `3-schedule.md` 는 이미 "부재는 생성 응답에만 있고 목록·상세·수정에는 채워지며, e2e 가 **양성 3 + 생성 음성 대조 1**로 고정한다" 고 명시하고 있다. 신규 단언 3곳(목록·PATCH cron·PATCH 재활성)이 정확히 이 "양성 3" 자리와 일치 — **정합**.
2. **`secret_store` 고아 row 무해성과 `secret-store.md §R4`** — `trigger-workflow-ref.e2e-spec.ts` 신규 註는 "고아 row 방치는 테스트 인프라 한정 판단이며 R4 와 충돌하지 않는다"고 주장. [`secret-store.md §R4`](spec/conventions/secret-store.md#r4-trigger-fk-미설정) 원문("명시적 cleanup 책임은 `TriggersService.delete()` 가 진다 … implicit DB 동작과 explicit application 동작이 섞이면 안 된다")과 대조 — R4 가 규율하는 것은 **프로덕션 삭제 경로**(`remove()`→`deleteByPrefix`)이고 이 코드는 그대로 유지된다. e2e teardown 이 raw SQL 로 지우는 것은 별개 축(테스트 인프라)이라는 diff 의 스코프 한정이 R4 문언과 모순되지 않음 — **정합**.
3. **비밀 컬럼 목록의 정본** — 신규 가드가 정본으로 지목하는 `triggers.service.ts` 의 `TRIGGER_RESPONSE_STRIP_COLUMNS` 는 [`1-data-model.md`](spec/1-data-model.md) §"값을 읽는다 / 응답 경계에서 지운다" 표, [`14-external-interaction-api.md`](spec/5-system/14-external-interaction-api.md) §7.1, [`secret-store.md`](spec/conventions/secret-store.md) 가 이미 언급하는 동일 상수 — 신규 명명이 아니라 기존 SoT 참조. 이번 diff 는 그 상수 자체를 변경하지 않았다(`triggers.service.ts` 는 diff 대상 파일 목록에 없음) — **정합**.
4. **감사 액션 taxonomy와의 관계** — 가드가 다루는 3개 비밀 컬럼(`notification_secret_v2`/`chat_channel_token_v2`/interaction 토큰)의 sub-channel 접두는 [`audit-actions.md §3`](spec/conventions/audit-actions.md) 레지스트리(`notification_secret_rotated`/`chat_channel_bot_token_rotated`/`interaction_token_revoked`)와 일치하는 접두 체계를 쓰고 있다 — 신규 액션 ID 도입 없음, 충돌 없음.

## 발견사항

없음.

## 요약

이번 diff 는 `spec/conventions/` 를 포함해 `spec/**` 전체를 건드리지 않는 순수 코드(테스트·정적 가드) 변경이며, 신규 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임을 하나도 도입하지 않는다. 코드 주석이 근거로 인용하는 기존 spec 문구(§5.4 부재 표현, secret-store §R4, `TRIGGER_RESPONSE_STRIP_COLUMNS`, audit-actions 레지스트리)를 대조 확인한 결과 모두 기존 SoT 와 정합하며, 신설된 e2e 양성 단언 3곳도 `3-schedule.md` 가 이미 선언한 "양성 3 + 생성 음성 대조 1" 카디널리티와 정확히 일치한다. Cross-Spec 관점에서 충돌 소지는 확인되지 않았다.

## 위험도

NONE
