# Cross-Spec 일관성 검토 — cross_spec

검토 대상: `spec/5-system/` (impl-done, diff-base `origin/main`, scope 델타 0파일 — 이 브랜치는
spec 을 건드리지 않았다). 실제 변경은 `codebase/` 10파일 / 829줄 — `chatChannel` PATCH 검증
에러의 `details[].code` 배선 + `botToken` 빈 문자열 차단(`@MinLength(1)`). 아래는 그 코드 변경이
`spec/5-system/**` 내부 다른 문서·같은 문서 다른 절과 충돌하는지에 집중했다(요청 관점 2·6 중심 —
데이터 모델/RBAC/상태 전이 축은 이번 diff 범위에 해당 사항 없음).

## 발견사항

- **[WARNING] `15-chat-channel.md` §5.4.1.2 의 "아직 안 실린다" 서술이 이번 코드 변경으로 거짓이 됐다**
  - target 위치: `spec/5-system/15-chat-channel.md` 411~416행 (§5.4.1.2 `chatChannel` 필드 존재성 · `provider` 불변성, 닫는 문단)
  - 충돌 대상: `codebase/backend/src/modules/triggers/triggers.service.ts` 734행·745행 (이번 diff), 그리고 그 상위 규약 `spec/5-system/2-api-convention.md` §5.3 「field 를 실으면 code 도 싣는다」
  - 상세: §5.4.1.2 는 "`details[].code` 는 **현재** 두 항목(`chatChannel`·`provider`) 모두 서비스 가드 갈래라 싣지 않는다 … 두 항목의 배선은 **뒤따르는 developer PR 이 한다**. 그 PR 이 머지되기 전까지 이 문단은 *"아직 안 실린다"* 를 서술할 뿐" 이라고 적는다. 그런데 이번 diff(`triggers.service.ts`)가 정확히 그 두 항목에 `details: { field: 'chatChannel', code: ErrorCode.INVALID_FIELD }` / `details: { field: 'provider', code: ErrorCode.INVALID_FIELD }` 를 배선했다(`triggers.service.spec.ts` 에도 대응 단언 추가됨). 즉 "뒤따르는 PR" 이 이미 머지됐는데 문서는 여전히 미래형 서술이다. `2-api-convention.md §5.3`(API 계약 SoT)과 `15-chat-channel.md`(도메인 spec)가 같은 5-system 영역 안에서 서로 다른 "현재 상태"를 주장하는 상태.
  - 이미 추적 중: `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 항목 제목 "`15-chat-channel.md` 의 「배선 전 관측값」 서술 3곳이 배선 완료로 stale 해졌다") 이 이 정확한 drift 를 planner 턴 필요 항목(②, "명백히 거짓") 으로 이미 등재해 뒀고, `--impl-done 12_18_21` W1 · `/ai-review 12_00_40` W2 에서도 지적된 재발 항목이다. developer 자기-반증형 소정정 예외는 **적용 불가**로 이미 판정됨(그 문장을 planner 턴 `#1316` 이 썼고, 조건 1 role 이 diff-스코프상 developer 가 아니라서) — 그래서 여전히 `[ ]` 미해결로 남아 있다.
  - 제안: 신규 발견 아님 — 상태 유지. planner 가 `15-chat-channel.md` §5.4.1.2 닫는 문단을 "배선 완료" 로 정정(취소선 + 정정 병기)하는 별도 PR 이 필요하며, 이번 developer PR 로는 고칠 수 없다(권한 경계). 병합 차단 사유는 아님 — 이미 알려진 문서 후속 작업.

- **[WARNING] `authConfigId` 자리의 top-level 특화 코드 + `details.code` 병기가 §5.3 "겹쳐 쓰지 않는다" 문면과의 정합성 미확정**
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 1005~1024행 (`assertAuthConfigInWorkspace`, 이번 diff 로 `details.code: ErrorCode.INVALID_FIELD` 추가)
  - 충돌 대상: `spec/5-system/2-api-convention.md` §5.3 "둘을 겹쳐 쓰지 않는다 — top-level 을 특화 코드로 바꾸면서 같은 사유를 `details[].code` 에도 넣으면 소비자가 어느 쪽으로 분기할지 갈린다"
  - 상세: 이 자리는 top-level `code: 'AUTH_CONFIG_NOT_FOUND'`(도메인 특화) 이면서 동시에 `details.code: 'INVALID_FIELD'`(generic) 를 싣는다 — `details[].code` 를 실은 13자리 중 이 1곳만 이런 이중 구조다(나머지 12곳은 top-level 이 상태 기본값 `VALIDATION_ERROR`). §5.3 자체가 "겹쳐 쓰지 않는다" 는 것이 "같은 사유를 양쪽에" 를 금지하는 것인지, 아니면 도메인 코드+generic 필드-표지 병기까지 금지하는 것인지 문면이 판정하지 않는다.
  - 이미 추적 중: 같은 diff 안에 판정 보류 사유가 앵커 주석으로 남아 있고(`triggers.service.ts` 해당 자리), `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "`authConfigId` 자리가 top-level 특화 코드 + generic `details.code` 를 병기한다 — §5.3 판정 필요" 로 planner 결정 항목 등재돼 있다(`--impl-done 12_18_21` W2 · `/ai-review 12_00_40` W1).
  - 제안: 신규 아님. planner 가 §5.3 에 "top-level 이 이미 특화 코드인 경우" carve-out 을 명시하는 결정이 선행돼야 한다. 코드는 유지 근거(제거 시 `authConfigId` 만 generic 표지 없는 특례가 됨)로 현행 유지 상태 — 결정 전까지 병합 차단 사유 아님.

- **[INFO] `details.code` 배선이 인접 spec 문서 3곳의 예시에는 아직 반영되지 않음**
  - target 위치: `spec/4-nodes/7-trigger/providers/slack.md` 275행, `spec/4-nodes/7-trigger/providers/discord.md` 297행, `spec/2-navigation/2-trigger-list.md` 176~178행·334행 (모두 `details.field='inboundSigningPlaintext'` / `'provider'` 등 예시가 `code` 없이 인용)
  - 충돌 대상: `spec/5-system/2-api-convention.md §5.3` (SoT, `code` 병기 규약) · 실제 코드(이번 diff 로 해당 검증 경로들이 `code: ErrorCode.INVALID_FIELD` 를 이미 싣는다)
  - 상세: 세 문서 모두 SoT(`2-api-convention.md §5.3`, `15-chat-channel.md §5.4.1`)를 포인터로 인용하는 미러 문서라 오독 위험은 낮지만, 예시 문면만 보면 `code` 가 빠진 것으로 오해할 수 있다.
  - 이미 추적 중: `plan/in-progress/spec-draft-nullable-notation-followups.md` "`details.code` 배선을 다른 spec 문서 3곳이 예시에서 누락한다" 항목(코드 변경 불요, 문서 동기화만).
  - 제안: 신규 아님 — 위 트래커 항목 처리 시 함께 갱신.

## 요약

이번 세션의 실제 변경은 `spec/5-system/**` 파일을 하나도 건드리지 않은 codebase-only PR(`chatChannel` 검증 에러의 `details[].code` 배선 + `botToken` 빈 문자열 차단)이다. 신규 데이터 모델·API 엔드포인트·요구사항 ID·상태 전이·RBAC 충돌은 발견되지 않았고, 코드가 참조하는 `ErrorCode.INVALID_FIELD` 값·명명도 `spec/conventions/error-codes.md`·`2-api-convention.md §5.3` 과 정합한다. 유일한 실질 이슈는 이 코드 변경이 `15-chat-channel.md §5.4.1.2` 가 "아직 미배선(뒤따르는 PR 이 처리)" 이라고 서술한 바로 그 배선을 완료시켜, 도메인 spec 문서(15-chat-channel.md)와 API 계약 SoT(2-api-convention.md) 사이의 "현재 상태" 서술이 어긋나게 됐다는 점이다 — 다만 이 drift 는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 상세 판정과 함께 planner-턴 필요 항목으로 정확히 등재돼 있고, 여러 라운드(3·4라운드 종결 커밋)를 거쳐 "codebase 수정 0, 신규 발견은 planner 결정 사안" 으로 이미 수렴된 상태다. 따라서 병합을 막을 새로운 CRITICAL 은 없으며, 남은 항목들은 모두 후속 planner PR 로 처리될 문서 동기화 성격이다.

## 위험도

LOW
