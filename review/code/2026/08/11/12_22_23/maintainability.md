# 유지보수성(Maintainability) 리뷰 — trigger 회전/폐기 감사 3종 추가

## 발견사항

- **[INFO]** `recordAudit` 호출부 반복은 이번 PR 이 만든 새 중복이 아니고, W4(`recordAudit` 공통 팩토리)가 겨냥하는 것과는 다른 층위다 — 지금 추출할 근거 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:212`(`private recordAudit` 헬퍼 정의, PR 이전부터 존재) / `:265`,`:345`,`:879`(기존 `TRIGGER_CREATED`/`UPDATED`/`DELETED` 호출부, PR 이전부터 존재) / `:925`,`:973`,`:1113`(이번 PR 이 추가한 신규 3개 호출부) / `plan/in-progress/spec-sync-auth-gaps.md:52`(W4 항목 원문)
  - 상세: `TriggersService` 안에는 이미 `create`/`update`/`delete` 세 메서드가 `await this.recordAudit({ workspaceId, userId, action, resourceId, type })` 형태의 6줄 호출을 갖고 있었다(PR 이전 코드, `:265`/`:345`/`:879` 확인). 즉 "named param 객체로 감사 헬퍼를 호출하는" 패턴은 이번 PR 이전에 이미 이 파일 안에서 한 번 DRY 되어 있었다 — `recordAudit` 자체가 그 추출 결과다. 이번 PR 은 그 **이미 추출된 헬퍼**를 3번 더 호출한 것이지, 헬퍼 로직 자체를 복제한 게 아니다. 함수 호출부의 인자 나열(6줄)이 서로 비슷해 보이는 것은 이름 있는 매개변수를 쓰는 함수를 여러 곳에서 부르면 항상 생기는 형태이지, 로직 중복이 아니다(추출할 "로직"이 이미 `recordAudit` 본문 하나에 있다).
    반면 plan 의 W4 항목(`plan/in-progress/spec-sync-auth-gaps.md:52`)이 말하는 "공통 팩토리"는 **서비스 5곳**(`workflows`/`triggers`/`schedules`/`model-config`/`auth-configs`)에 흩어진, 서로 `details` 계약이 다른(passthrough / `{type}` / 없음 / `{kind}` / `ipAddress`) **개별 `recordAudit` 사설 헬퍼들을 하나로 묶을지**의 문제다. plan 자신이 "추출해도 타입 있는 per-service 래퍼는 남는다"며 근거를 이미 접었다 — 즉 W4 는 미착수가 아니라 **현재는 낮은 가치로 재평가되어 보류된 항목**이다. 이번 PR 은 그 5개 서비스 중 하나(`triggers`)의 **기존 로컬 헬퍼**를 재사용했을 뿐이라 W4 의 스코프에 해당하지 않고, W4 미착수 상태와도 모순되지 않는다.
  - 제안: 지금 추출 불필요. 굳이 개선한다면 6줄 호출 형태 자체보다는 (a) `type: trigger.type` 처럼 3개 신규 호출이 전부 동일한 `resourceId`/`type` 원천(같은 `trigger` 변수)에서 값을 뽑는다는 점을 살려 각 메서드 말미에서 반복되는 4-라인 필드셋을 유지하되, W4 는 plan 서술대로 "5번째 리소스가 아니라 실제 5개 계약이 수렴할 때" 재검토하는 편이 낫다.

- **[INFO]** 신규 액션 상수명(`TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED`, 39자)은 규약 위반이 아니며 근거 있는 트레이드오프 — 다만 파일 내 최장 키다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:87` (대조: `:60` `WORKSPACE_TRANSFER_OWNERSHIP` 28자, `:59` `INTEGRATION_SCOPE_CHANGED` 25자 — 이번 PR 이전 최장 키들)
  - 상세: 새 키는 파일에서 가장 긴 상수명이다(기존 최장 대비 +11자). 그러나 `spec/conventions/audit-actions.md:76`(신규 Rationale, 같은 PR 에서 추가)이 명시하듯 `chat_channel_` 접두는 자의적 장식이 아니라 엔티티 컬럼(`chatChannelTokenV2`)·스케줄러(`ChatChannelTokenRotatorService`)·HTTP 경로(`/chat-channel/rotate-bot-token`)가 이미 쓰는 용어와 대칭을 맞추기 위한 것이다(naming_collision 검토가 별도로 지적해 확정된 이름, `review/consistency/2026/08/11/11_48_48/SUMMARY.md` 참고). `spec/conventions/audit-actions.md §1`(구조 규약)은 길이 상한을 두지 않고, 이 코드베이스에도 ESLint `max-len` 류 강제 규칙이 없다(`.eslintrc*` 부재 확인). 짧게 줄이면(`TRIGGER_BOT_TOKEN_ROTATED` 등) `notification_secret_rotated`/`interaction_token_revoked` 형제 상수와의 sub-channel 표기 대칭이 깨져 오히려 세 액션을 나란히 읽을 때 "이건 왜 접두가 빠졌나"라는 새 질문을 만든다.
  - 제안: 현행 유지 권장. 향후 트리거에 sub-channel 이 더 늘어 액션명이 계속 길어지는 패턴이 보이면 그때 `details.subChannel` 로 흡수하는 대안(convention_compliance 리뷰가 이미 대안 1로 제시)을 재검토하되, 지금 3개 시점에서는 가독성보다 명확성 손실이 더 크다.

- **[INFO]** `audit-action.const.ts` 신규 주석은 실질 정보를 담고 spec Rationale 과 정합한다 — 다만 파일 내 문서화 배치 컨벤션이 하나 더 생겼다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:82-85`(3분리 근거·spec 인용), `:88-89`(`revoked` 선택 이유) / 대응 spec: `spec/conventions/audit-actions.md:72-80`(같은 PR 에서 추가된 Rationale)
  - 상세: 두 코멘트는 "무엇"이 아니라 "왜"를 설명한다 — ① 왜 CRUD 와 별도 액션인지(특권 작업 + 평문 자격증명 1회 노출) ② 왜 3개로 나눴는지(폭발 반경) ③ 왜 하나만 `revoked`인지(유예 컬럼 유무). 인용한 `spec/conventions/audit-actions.md §3` Rationale 이 실제로 같은 PR 에서 추가돼 있어(`:72-80` 확인) 참조가 허상(dangling)이 아니다 — 흔한 실패 모드인 "가리키는 spec 문단이 아직 없다"에 해당하지 않는다.
    다만 이 파일은 지금까지 모든 설계 결정 서술을 **파일 최상단의 단일 header docblock**(`:1-52`)에 몰아넣는 방식을 써왔다(예: `workspace.deleted` 미기록 이유, 1:1 결합 리소스 규칙, `workflow.executed` 유예 등이 전부 거기 있다). 이번 PR 은 그 관행과 별개로 **object 리터럴 내부, 해당 키 바로 위**에 직접 주석을 붙이는 첫 사례다. 근접성 면에서는 오히려 낫지만(설명이 코드 옆에 있음), 이미 52줄짜리 header 가 있는 상태에서 두 번째 배치 지점이 생기면 다음 기여자가 "새 액션의 근거는 header 에 적나, 인접 주석으로 적나"를 판단해야 한다.
  - 제안: 지금 당장 되돌릴 필요는 없다(오히려 근접 배치가 header 비대화를 막는 합리적 선택). 다만 header docblock 서두에 "개별 액션군의 설계 근거는 groups 옆 인라인 주석에, 파일 전체에 걸친 교차 규칙만 여기(header)에 남긴다" 같은 한 줄 메타 규칙을 추가해두면, 다음 액션 추가 시 배치 판단이 흔들리지 않는다.

- **[INFO]** `rotateBotToken` 은 이미 ~130줄짜리 "6단계 오케스트레이션" 메서드였고, 이번 PR 이 감사 기록 단계를 얹어 소폭 더 늘렸다 (회귀 아님, 참고용)
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:999`(`async rotateBotToken(` 시작) ~ `:1128`(메서드 종료) / 신규 블록: `:1113-1119`
  - 상세: 메서드는 PR 이전에도 6단계로 문서화된 대형 오케스트레이션이었고, 전용 `describe('TriggersService.rotateBotToken — 6단계 오케스트레이션'`) 스펙으로 별도 검증된다. 이번 PR 은 여기에 7번째에 가까운 단계(감사 기록, `:1113-1119`)를 컬럼 갱신 **직후**에 추가했는데, 위치 선정 근거(실패 시 거짓 기록 방지, `:1111-1112` 주석)는 명확하다. 길이 자체는 이 PR 이 만든 문제가 아니라 기존 설계의 연장이다.
  - 제안: 지금 조치 불필요. 다만 이 메서드에 단계가 더 늘어난다면(예: 향후 알림·웹훅 트리거 추가) 6~7단계를 각각 `private` 헬퍼로 쪼개는 리팩터링을 별도 항목으로 고려할 시점이 될 수 있다.

## 요약

이번 diff 는 3개 트리거 회전/폐기 메서드에 `userId` 배선과 감사 기록을 추가하는 좁고 잘 절제된 변경이다. 지적하신 세 판정 포인트를 검증한 결과, `recordAudit` 6줄 호출 반복은 이 파일 안에서 PR 이전부터 존재하던 패턴(이미 추출된 private 헬퍼를 재사용)이라 새 중복이 아니며, plan 의 W4(서비스 5곳을 아우르는 더 큰 스코프의 공통 팩토리) 항목과는 층위가 달라 이 PR 이 W4 를 방치했다고 볼 근거가 없다 — 지금 W4 를 착수하는 것도 정당화되지 않는다. 신규 액션 상수명은 파일 내 최장이지만 3개 형제 상수 간 sub-channel 표기 대칭과 엔티티/스케줄러/HTTP 경로 용어 일치를 우선한 의도적 선택으로, 규약·가독성 균형이 맞다. `audit-action.const.ts` 의 신규 주석은 spec Rationale(같은 PR 에서 함께 추가됨)과 정합하는 실질적 "왜" 설명이라 값을 하지만, 이 파일에 처음 등장하는 "인라인 근접 주석" 배치 방식이 기존 "단일 header docblock" 관행과 공존하게 된 점은 향후 기여자를 위해 한 줄 메타 규칙으로 명문화해두면 좋다. 전반적으로 차단 사유는 없다.

## 위험도

LOW
