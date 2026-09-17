# Cross-Spec 일관성 검토 — `spec/2-navigation/` (impl-done, diff-base=origin/main)

## 검토 범위 요약

- scope(`spec/2-navigation/`) 델타: **0개 파일** — 이번 PR 은 spec 을 바꾸지 않았다(실측: `git diff origin/main...HEAD --stat -- spec/` 무출력).
- 구현 diff: 5개 파일 / 484줄, 전부 `codebase/backend/src/modules/triggers/**` + 신규 e2e 1개 — `TriggersService.update()` 의 PATCH 저장을 "재읽은 엔티티 통째 저장" 에서 "이 요청이 바꾸는 필드만 담은 부분 객체 저장" 으로 바꾸고, 그 근거(FK CASCADE 창 + 락 밖 컬럼 경합)를 `trigger-update-save-window.e2e-spec.ts` 로 실측 고정했다.
- 코드 자체는 `Read`/`git show HEAD:...` 로 절대경로 확인했다 (`triggers.service.ts:580-734`).
- 이 브랜치엔 이미 같은 세션의 코드 리뷰 산출물(`review/code/2026/09/17/14_34_56/`)과 별도 `--impl-prep` 산출물(`13_04_39`)이 존재해, 아래 발견의 상당수는 **이미 3라운드 연속 지적되고 `plan/in-progress/spec-draft-nullable-notation-followups.md`(4505~4535줄)에 planner 후속으로 등재돼 있다.** 독립적으로 재확인한 결과를 아래에 정리한다 — 새 발견이 아니라 **Cross-Spec 관점에서의 확증**이다.

---

## 발견사항

- **[WARNING]** `2-trigger-list.md §3` 의 "실측되지 않은 잔여" 註가 이번 PR 로 이중으로 낡았는데, 그 낡음이 **다른 spec 영역(`5-system/15-chat-channel.md`)의 에러 계약 표에도 파급된다**
  - target 위치: `spec/2-navigation/2-trigger-list.md` §3, 마지막 블록 "⚠️ **실측되지 않은 잔여**: PATCH 의 기본 저장 경로(엔티티 통째 저장)는 ① 재읽기와 저장 사이의 CASCADE 창에서의 실패 방식, ② 락 밖 컬럼 한정 갱신과의 경합이 확인되지 않았다"
  - 충돌 대상: (a) 같은 문서 §3 상단 "동시 쓰기 직렬화" 註 자체 — "병합 쓰기가 0행에 매치되면 쓰지 못한 것으로 취급한다(`rotate-bot-token` 은 이때 404)" / (b) `spec/5-system/15-chat-channel.md §5.4` Bot Token Rotation API 응답 계약의 404 행 — `| 404 | RESOURCE_NOT_FOUND | trigger 미존재 또는 워크스페이스 권한 없음 (triggers.service.ts:122 findById) |`
  - 상세:
    1. **전제 자체가 깨졌다.** 註가 "PATCH 의 기본 저장 경로(엔티티 통째 저장)" 라고 부르는 그 경로가, 바로 이 diff 로 더 이상 "엔티티 통째 저장" 이 아니다 (`triggers.service.ts:672` 부근 `const patch = {...defined, config: mergedConfig}; const written = await m.save(Trigger, {id: target.id, ...patch})`).
    2. **"확인되지 않았다" 던 것이 이번 PR 의 신규 e2e(`codebase/backend/test/trigger-update-save-window.e2e-spec.ts`)로 실제 Postgres+TypeORM 위에서 확정 실측됐다** — ① FK CASCADE 창은 "시끄러운 실패"(`QueryFailedError` 23503/23502, 롤백, 되살아나지 않음)로, ② 락 밖 컬럼 경합은 "조용한 lost update" 실결함으로 확인되고 부분 객체 `save` 로 수정됐다. 즉 §3 의 두 미확인 항목이 **이 PR 안에서 둘 다 답이 났는데, 註 문구는 여전히 "확인되지 않았다"** 고 말한다.
    3. **크로스 스펙 파급** — §3 상단 註는 rotate-bot-token 이 "병합 쓰기 0행 매치" 로 404 를 낼 수 있다고 이미 서술하는데, 그 404 원인이 `chat-channel.md §5.4` 의 404 행에는 **`findById` 실패(사전 조회 단계) 한 가지만** 등재돼 있다. CASCADE 창에서 트리거가 사라진 뒤 벌어지는 "병합 쓰기 0행 매치 → 404" 는 findById 통과 이후에 발생하는 **별개의 원인**인데, chat-channel.md 쪽 에러 계약 표는 이를 반영하지 않는다 — 같은 endpoint 의 같은 error.code(404 `RESOURCE_NOT_FOUND`)에 대해 두 spec 영역이 서로 다른 사유 집합을 열거하는 셈이다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 4529~4531줄에 이미 정리된 대로,
    1. `2-trigger-list.md §3` 의 註를 "① 재읽기 뒤 FK CASCADE 는 시끄러운 실패로 실측(23503/23502, 롤백·부활 없음) · ② 락 밖 컬럼 경합은 실결함이었고 부분 객체 `save` 로 수정됨" 으로 교체
    2. 같은 문서 frontmatter `code:` 에 `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` 등재 (이 spec 이 스스로 정한 "e2e 가 보장을 고정하면 `code:` 에 올린다" 관례, 선례 `trigger-workflow-ref.e2e-spec.ts`)
    3. `5-system/15-chat-channel.md §5.4` 404 행에 "CASCADE 창의 병합 쓰기 0행" 사유 한 줄 추가
    이 세 항목은 **developer 권한 밖**(spec 문장을 developer 자신이 쓴 것이 아니므로 CLAUDE.md 의 자기-반증형 소정정 예외에도 해당하지 않는다 — planner 턴 필요)이라 이번 PR 의 `spec_impact: none` 은 정당하다. **이 WARNING 은 이번 PR 을 막을 사유가 아니라, 이미 등재된 planner 후속을 재확인·촉구하는 것이다.**

- **[INFO]** 위 WARNING 과 같은 뿌리 — Chat Channel `provider` 불변성 관련 R-12/§5.4.1.2 등 인접 註들은 이번 diff 의 영향 범위 밖임을 확인
  - target 위치: `spec/2-navigation/2-trigger-list.md` §2.3.1 Chat Channel `provider`/`botToken` 행, R-12
  - 충돌 대상: `spec/5-system/15-chat-channel.md §5.4.1`, `§5.4.1.2`, R-CC-10, R-CC-21
  - 상세: 이번 diff 는 `update()` 의 저장 대상 구성(어떤 컬럼을 `save` 에 실을지)만 바꿨고, `chatChannel`/`provider`/`botTokenRef` 값 자체의 검증·차단 로직(`assertChatChannelAlreadySetUp` 등, `triggers.service.ts:580-586`)은 그대로다. `defined`(변경 필드) 구성과 `mergedConfig` 산출은 이 diff 이전과 동일 지점에서 이뤄지므로, R-12/§5.4.1.2 가 보장하는 provider 불변성·botTokenRef 보존 계약에는 이번 diff 가 새 리스크를 만들지 않는다.
  - 제안: 조치 불요 — 확인 목적의 negative 기록.

---

## 요약

이번 PR 은 spec 파일을 건드리지 않는 순수 백엔드 diff(`TriggersService.update()` 저장 경로를 "통째 엔티티" 에서 "부분 객체" 로 좁히고, 그 근거를 실제 Postgres+TypeORM e2e 로 고정)다. 데이터 모델(`1-data-model.md §2.8` 의 `notification_secret_v2`/`chat_channel_token_v2` 등)·API 계약(`2-trigger-list.md §3` PATCH body 키)·RBAC·계층 책임 관점에서 새로 도입된 모순은 찾지 못했고, 코드가 보호하는 컬럼 집합·CASCADE 처리 방향은 오히려 `1-data-model.md §2.9.1`·`data-flow/10-triggers.md §1.4` 가 이미 요구하는 동기화 불변식과 더 잘 맞아떨어진다. 다만 이 diff 가 정확히 실측·해소한 그 사실(§3 "실측되지 않은 잔여" 註)이 target 문서 자신 안에서, 그리고 이웃 spec 영역인 `5-system/15-chat-channel.md §5.4` 의 404 에러 계약 표에서 아직 갱신되지 않은 채 남아 있다 — 이는 이미 세 라운드 연속 코드 리뷰(`13_44_39`·`14_11_48`·`14_34_56`)와 `--impl-prep` 컨시스턴시 체크(`13_04_39`)가 지적했고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속 3건으로 구체적으로 등재돼 있어, developer 범위 밖(`spec_impact: none` 정당)이며 이번 PR 을 막을 사유는 아니다. 다음 planner 턴에서 그 3건을 반영하면 이 WARNING 은 해소된다.

## 위험도

LOW
