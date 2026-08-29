# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** `NotificationEventType` 개명(`InAppNotificationEventType`)의 disambiguation 이 한쪽 방향에만 있다
  - 위치: `codebase/backend/src/modules/triggers/dto/notification-config.dto.ts` (동명 `NotificationEventType` 선언부, 개명 대상 diff 밖 파일이라 게이트 없음 — 리포에서 직접 확인)
  - 상세: 이번 개명으로 WS 쪽(`websocket-events.types.ts`)의 JSDoc 은 "`triggers/dto/notification-config.dto.ts` 의 `NotificationEventType` 과 다른 것이다" 라고 상대를 명시 인용하도록 갱신됐다. 반대 방향인 `notification-config.dto.ts` 의 `NotificationEventType` 선언에는 `InAppNotificationEventType` 을 향한 대응 인용이 없다(현재 "Outbound notification webhook 의 구독 가능한 이벤트 type. [Spec EIA §3.1 EIA-NX-02]." 뿐). 개명 자체가 자동완성 충돌을 이름으로 해소했기 때문에 실질적 오import 위험은 이미 낮아졌고, 이번 diff 의 스코프(WS 쪽) 밖의 파일이라 반드시 고쳐야 하는 결함은 아니다.
  - 제안: 후속으로 `notification-config.dto.ts` 쪽에도 "WS 인앱 알림 벨의 `InAppNotificationEventType` 과는 무관" 한 줄을 대칭으로 추가하면 두 파일만 봐도 관계가 완결된다. 차단 사유는 아님.

검증 결과, 아래 항목들은 이번 diff 에서 실제로 잘 처리되어 있음을 확인했다(발견사항 아님, 검증 근거로 기록):

- `grep -rn "NotificationEventType" spec/` → 0건. 개명이 spec 문서를 stale 하게 만들지 않는다는 plan 의 주장이 실측과 일치한다.
- 코드베이스 전수 grep 결과 옛 이름 `NotificationEventType` 이 남아있는 곳은 (a) 의도적으로 이름이 같은 자매 타입 `triggers/dto/notification-config.dto.ts`, (b) `plan/complete/**` 의 시점 기록(이 저장소 규약상 옛 경로/이름 유지가 정상), (c) 현재 리뷰 대상인 `ws-event-types-extract.md` 자신의 서사적 인용(과거형 설명)뿐이다. frontend·e2e·Swagger/OpenAPI 산출물에는 참조가 전혀 없다.
- `websocket-events.types.ts` 의 `InAppNotificationEventType` JSDoc 이 인용하는 `EIA §3.1 EIA-NX-02`(구독 화이트리스트 `execution.*` 5값)를 `spec/5-system/14-external-interaction-api.md:71` 과 `notification-config.dto.ts` 의 `NOTIFICATION_EVENT_TYPES` 배열(정확히 5값)에 대조해 정확함을 확인했다.
- `hasDefaultExport()` 신설 함수의 JSDoc 표(세 AST 형태: `ExportAssignment` / modifier `default` / `NamedExports` 의 `as default` 별칭)가 구현 로직과 1:1 로 일치한다.
- `{@link NotificationEventType.NOTIFICATION_NEW}` → `{@link InAppNotificationEventType.NOTIFICATION_NEW}` 로 JSDoc cross-reference 도 함께 갱신되어 있어 낡은 링크가 남지 않는다.
- `websocket-events.types.ts` 의 JSDoc 블록이 이번 diff 로 +7줄 순증가했지만, 이 파일의 절대 줄 번호를 인용하는 spec/plan 문서는 diff 범위 밖에 있는 `data-flow/0-overview.md:110`("R10 문구는 `websocket-events.types.ts:26`") 하나뿐이고, 그 줄은 diff 대상 구간(약 210~235행) 이전이라 shift 의 영향을 받지 않는다 — stale 인용 없음.
- `websocket-events.types.spec.ts` 를 절대 줄 번호로 인용하는 외부 문서는 0건 — 신설 헬퍼로 인한 줄 이동이 문서 stale 을 만들지 않는다.
- CHANGELOG.md 미갱신은 정당하다 — 이 PR 은 순수 내부 심볼 개명 + 테스트 헬퍼 리팩터이고 wire/enum 값(`'notification.new'` 등)은 불변이라 행동 변화가 0 이다. plan 문서 자체가 이 근거를 명시하고 있고 실측과 일치한다.
- `plan/in-progress/ws-event-types-extract.md` 의 2026-08-29 추가분은 `git diff --stat origin/main -- spec/` 가 왜 빈 결과를 내는지, `spec_impact` 후보 7개 파일이 무엇인지, `plan/complete/` 이동이 `spec/conventions/egress-masking.md:89` 의 죽은 링크로 막히는 이유를 실측(명령 실행 결과·`git blame`)과 함께 매우 상세히 기록했다. `git blame -L 85,92 spec/conventions/egress-masking.md` 로 대상 문장이 `bdcfdc514c`(planner 턴 커밋)에서 왔음을 직접 확인했고, plan 의 주장과 정확히 일치한다 — "developer 가 자기반증형 소정정 예외를 쓸 수 없다"는 결론이 근거대로 옳다.

## 요약

이번 diff(`NotificationEventType` → `InAppNotificationEventType` 개명, `hasDefaultExport()` 헬퍼 신설 및 JSDoc, plan 문서 갱신)는 문서화 관점에서 매우 높은 완성도를 보인다. JSDoc cross-reference(`{@link}`)가 개명과 함께 정확히 갱신됐고, 개명으로 남을 수 있는 stale 참조를 spec/코드/plan 전수 grep 으로 검증했으며 실제로 남은 것이 없다(자매 타입·frozen 역사문서 제외). 신설 헬퍼의 JSDoc 은 구현과 정확히 1:1 대응하는 표를 포함해 근거가 탄탄하고, EIA 스펙 인용(§3.1 EIA-NX-02, 5값)도 실측과 일치했다. CHANGELOG 미갱신·README 미갱신도 "행동 변화 없음"이라는 근거가 실측과 부합해 정당하다. plan 문서는 남은 차단 사유(`egress-masking.md` 죽은 링크, `plan/complete/` 이동 보류)를 `git blame`·명령 실행 결과와 함께 투명하게 기록해, 다음 사람이 같은 조사를 반복할 필요가 없게 해 두었다. 유일한 개선 여지는 개명의 반대편(`notification-config.dto.ts`)에 대칭적인 disambiguation 한 줄이 없다는 것인데, 이는 개명 자체가 이름 충돌을 실질적으로 해소했으므로 선택적 개선이지 결함이 아니다.

## 위험도
NONE
