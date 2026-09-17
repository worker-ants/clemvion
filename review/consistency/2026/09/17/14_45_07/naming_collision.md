# 신규 식별자 충돌 검토 — spec/2-navigation/ (impl-done)

## 검토 범위 확인

- **scope(`spec/2-navigation/`) 델타: 0개 파일** — 이 브랜치는 해당 spec 영역을 변경하지 않았다. `plan/in-progress/trigger-save-partial-patch.md` frontmatter 도 `spec_impact: none` 으로 명시한다. 정상이며, spec 텍스트가 새로 도입하는 식별자는 없다.
- **실제 신규 식별자 후보는 구현 diff(5개 파일 / 484줄)** 뿐이다. 아래는 그 diff 를 전수 확인한 결과다.

| 파일 | 성격 |
|---|---|
| `codebase/backend/jest.config.ts` | 기존 주석 정정(구 handle 정책 예외 한 줄 추가) — 신규 식별자 없음 |
| `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` | 기존 mock 동작 강화(`save` 를 async 로) + 주석 정정 — 신규 식별자 없음 |
| `codebase/backend/src/modules/triggers/triggers.service.spec.ts` | 기존 테스트 교체 + 신규 테스트 2건 추가(제목 문자열만, 식별자 아님) |
| `codebase/backend/src/modules/triggers/triggers.service.ts` | `update()` 내부 저장 로직을 부분 객체로 좁힘 — 신규 export·DTO·엔드포인트 없음 |
| `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` | **신규 파일** — 유일한 "새 이름" 후보 |

## 항목별 점검

1. **요구사항 ID 충돌** — 신규 ID 부여 없음(해당 없음). PR 은 기존 트래커 `spec-draft-nullable-notation-followups.md` developer 항목 7 을 닫을 뿐, 새 요구사항 ID 를 발급하지 않는다.
2. **엔티티/타입명 충돌** — 신규 엔티티·DTO·인터페이스 없음. diff 에 등장하는 `notificationSecretV2` · `chatChannelTokenV2` · `lastTriggeredAt` · `TRIGGER_RESPONSE_STRIP_COLUMNS` 등은 모두 `origin/main` 에 이미 존재하는 기존 컬럼/상수다(`git grep` 로 `trigger.entity.ts:105,149` 확인). 새로 도입된 이름이 아니다.
3. **API endpoint 충돌** — 신규 endpoint 없음. `PATCH /api/triggers/:id` 내부 구현만 바뀌었고 method+path 는 그대로다.
4. **이벤트/메시지명 충돌** — 신규 webhook/queue/SSE 이벤트 없음.
5. **환경변수·설정키 충돌** — 신규 e2e spec 이 쓰는 `E2E_BASE_URL` · `DB_HOST` · `DB_PORT` · `DB_USERNAME` · `DB_PASSWORD` · `DB_DATABASE` 는 `trigger-config-lost-update.e2e-spec.ts` · `schedule-trigger.e2e-spec.ts` 등 기존 e2e 전반이 이미 쓰는 관례적 env var 다(동일 기본값 `http://backend-e2e:3011`). 신규 키 없음.
6. **파일 경로 충돌** — 신규 파일은 `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` 하나. 같은 디렉터리의 기존 트리거 e2e 파일 목록과 대조:

   ```
   chat-channel-trigger-create.e2e-spec.ts
   manual-trigger-default-param.e2e-spec.ts
   schedule-trigger.e2e-spec.ts
   trigger-config-lost-update.e2e-spec.ts
   trigger-expression.e2e-spec.ts
   trigger-update-save-window.e2e-spec.ts   ← 신규
   trigger-workflow-ref.e2e-spec.ts
   webhook-trigger.e2e-spec.ts
   ```

   `<topic>.e2e-spec.ts` 명명 컨벤션을 그대로 따르고, 기존 어떤 파일과도 이름이 겹치지 않는다. 인접한 `trigger-config-lost-update.e2e-spec.ts` 와는 다루는 경합 축이 다르며(전자는 `config` JSONB 병합 경합, 신규 파일은 `config` 밖 컬럼 + FK CASCADE 창), 새 파일 자신의 JSDoc 이 그 경계를 명시적으로 적어 혼동을 방지한다 (plan `--impl-prep` INFO#5 처분과 일치). spec `code:` frontmatter 미등재는 plan 의 "이 PR 이 안 하는 것" §2 에 planner 후속으로 명시적으로 이연되어 있어 이번 diff 자체의 결함이 아니다.

## 발견사항

없음. 해당 diff·target 범위에서 CRITICAL/WARNING/INFO 급 신규 식별자 충돌을 찾지 못했다.

## 요약

이번 변경은 `spec/2-navigation/` 문서 자체를 건드리지 않는 순수 백엔드 구현 PR(트리거 PATCH 저장 시 락 밖에서 커밋된 컬럼이 되돌아가는 TOCTOU 수정)이며, diff 전체(5파일/484줄)를 확인한 결과 새로 도입된 요구사항 ID·엔티티/DTO명·API endpoint·이벤트명·환경변수·설정키가 없다. 유일한 신규 식별자는 e2e 테스트 파일 `trigger-update-save-window.e2e-spec.ts` 이며, 기존 `<topic>.e2e-spec.ts` 명명 컨벤션을 따르고 동일 디렉터리의 어떤 기존 파일과도 겹치지 않으며 인접 파일과의 책임 경계도 JSDoc 에 명시돼 있어 충돌 소지가 없다. diff 내 컬럼/상수명(`notificationSecretV2` 등)은 모두 `origin/main` 에 이미 존재하는 식별자의 재사용이다.

## 위험도

NONE
