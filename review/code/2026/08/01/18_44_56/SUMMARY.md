# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 코드 결함(CRITICAL)은 0건이나, 이번 audit-logging PR 이 목표로 하는 "보안 사건 추적성" 관점에서 가장 민감한 세 작업(webhook 시크릿·per-trigger 토큰·봇 토큰 회전)이 감사 로그 대상에서 빠져 있다(WARNING, security). 그 외 발견은 4건의 SPEC-DRIFT(코드가 spec 을 앞서감, developer 권한 밖·planner 턴 인계 대상)와 1건의 유지보수성 개선 여지뿐이다. 강제(forced) 화이트리스트 6개 reviewer(`maintainability, requirement, scope, security, side_effect, testing`) 전원 결과가 정상 확보되어 있어 화이트리스트 미이행에 의한 판정 누락은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `TriggersService` 의 시크릿/토큰 회전 3개 메서드(`rotateNotificationSecret`, `revokePerTriggerToken`, `rotateBotToken`)가 `recordAudit` 를 전혀 호출하지 않음. Editor+ 권한만 있으면 호출 가능한 특권 작업(응답에 새 시크릿/토큰 평문 1회 반환)인데도 감사 흔적이 남지 않아, 계정 탈취 후 조용한 시크릿 교체를 사고 대응 시 audit_log 만으로 재구성할 수 없음 | `codebase/backend/src/modules/triggers/triggers.service.ts:902`(rotateNotificationSecret), `:938`(revokePerTriggerToken), `:983`(rotateBotToken) | 각 메서드에 신규 audit action(예: `trigger.notification_secret_rotated`, `trigger.interaction_token_revoked`, `trigger.chat_channel_bot_token_rotated`) 추가 후 `recordAudit` 호출. 의도적 스코프 제외라면 `audit-action.const.ts` 상단에 `workflow.executed` 와 동일 수준의 명시적 배제 근거를 남길 것 |
| 2 | SPEC-DRIFT | `[SPEC-DRIFT]` spec/5-system/1-auth.md §4.1 "현재 구현된 액션" 표에 workflow/trigger/schedule/model_config 13개 액션이 없고, 반대로 "Planned(미구현)" 표에는 여전히 나열됨. 코드는 정확히 spec 이 예고한 대로 구현됐고 spec 의 구현 상태 표만 갱신 안 됨. documentation reviewer 도 동일 갭을 독립적으로 재확인 | `spec/5-system/1-auth.md:414-438` | 코드 유지 + spec 반영. 13개 액션을 구현됨 표로 이동, `workflow.executed` 만 Planned 잔류. `model_config.service.ts 는 AuditLogsService 를 호출하지 않는다`(L438) 노트도 정정. planner 턴(`plan/in-progress/spec-sync-auth-gaps.md:18-22`) |
| 3 | SPEC-DRIFT | `[SPEC-DRIFT]` spec/data-flow/1-audit.md §1.1 writer 표에 4개 리소스 행이 없고, 커버리지 갭 문단(82-88행)이 "workflows/triggers/alerts/schedules 모듈에는 AuditLogsService import 가 전혀 없다"고 서술하나 실제로는 4개 서비스 모두 주입해 사용 중. documentation reviewer 도 동일 갭 재확인 | `spec/data-flow/1-audit.md:45-92` | 코드 유지 + writer 표 13행 추가, 갭 문단을 "workflow.executed·saveCanvas/restoreVersion 만 잔여 갭"으로 재작성. 동일 planner 트랙 |
| 4 | SPEC-DRIFT | `[SPEC-DRIFT]` spec/conventions/audit-actions.md §3 상태 컬럼에서 workflow/trigger/schedule/model_config 4행이 전부 `미구현` 으로 남음. `workflow` 행은 created/updated/deleted/executed 를 한 셀에 묶어 나열해 단순 "구현" 전환 시 executed 까지 구현된 것으로 오독 위험 | `spec/conventions/audit-actions.md:56-59` | 코드 유지 + planner 턴. `workflow` 행만 created/updated/deleted(구현) vs executed(미구현) 분리, 나머지 3행 상태를 구현으로 갱신 |
| 5 | SPEC-DRIFT | `[SPEC-DRIFT]` spec/2-navigation/2-trigger-list.md 가 audit action 명을 permission 문자열과 혼동 — L182 `trigger.delete`(실제 audit action은 `trigger.deleted`), L252 `trigger.update`(실제는 `trigger.updated`) | `spec/2-navigation/2-trigger-list.md:182, 252` | 코드 유지 + planner 턴. 두 위치를 `trigger.deleted`/`trigger.updated` 로 정정, permission 문자열과 audit action 문자열이 다른 어휘임을 명시. 이미 `plan/in-progress/spec-sync-auth-gaps.md:18-22` 가 추적 중 |
| 6 | Maintainability | `AuditActionFor<'...'>` 프리픽스 리터럴과 같은 파일의 `*_RESOURCE_TYPE` 상수가 같은 문자열을 타입 연결 없이 두 곳에 수동 중복 — 리소스 어휘가 바뀌어도 컴파일러가 못 잡음 | `model-config.service.ts:31,245`, `schedules.service.ts:26,147`, `triggers.service.ts:64,215`, `workflows.service.ts:62,180` | `AuditActionFor<typeof MODEL_CONFIG_RESOURCE_TYPE>` 처럼 제네릭 인자를 로컬 `*_RESOURCE_TYPE` 상수의 `typeof` 로 유도해 단일 소스에서 파생되게 할 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `recordAudit` 호출에 방어적 격리(try/catch)가 없음. `AuditLogsService.record()` 자체가 내부에서 예외를 삼키는 것으로 확인되어 실질 위험은 낮으나, 이 계약이 서비스 코드 자체엔 문서화돼 있지 않음 | `model-config.service.ts:242-257` 등 4개 서비스 `recordAudit` 호출부 전반 | `AuditLogsService.record()` 오류 처리 전략(fire-and-forget vs 전파)을 SoT 문서에 명문화하고 전 서비스에 일관 적용 |
| 2 | Requirement | `saveCanvas`/`restoreVersion` 은 여전히 감사 미기록 — 카디널리티/보존정책 논거로 의도된 범위 보류(`audit-action.const.ts` 주석 + `plan/in-progress/spec-sync-auth-gaps.md:26-29` 에 명시) | `workflows.service.ts` saveCanvas(~595행), restoreVersion(~659행) | 확인만, 조치 불요(이번 PR 범위 밖) |
| 3 | Side Effect | `audit_log` INSERT 신규 부작용 — `AuditLogsService.record()` 의 try/catch 로 완전 격리되어 mutation 성공/실패에 영향 없음을 코드로 확인 | `audit-logs.service.ts:72`, 호출부 다수 | 없음(현행 유지). 향후 audit_log 보존정책/pruner 결정 시 4개 리소스도 포함 대상 |
| 4 | Side Effect | 4개 서비스 공개 메서드에 `userId` 파라미터 추가(breaking change) — 컨트롤러 전수 조사 결과 orphaned caller 없음 확인 | `model-config/schedules/triggers/workflows.service.ts` 각 write 메서드 | 없음(검증 완료) |
| 5 | Side Effect | `userId` 파라미터 위치가 서비스/메서드 간 비일관(create 는 앞, update/remove 는 뒤) — 전부 `string` 타입이라 인접 인자 swap 을 컴파일러가 못 잡음. 현재는 6차 리뷰 테스트로 안전 확인됨 | `workflows.service.ts:194,232,257` 등 4개 서비스 | 필수 아님. 여유 시 `userId` 위치를 서비스 간 통일(예: 항상 마지막) 고려 |
| 6 | Side Effect | DI 배선 확인 — `AuditLogsModule` 은 leaf 모듈이라 4개 신규 import 가 순환 의존을 만들지 않음 | `audit-logs.module.ts`, 4개 feature module | 없음(확인용 기록) |
| 7 | Maintainability | `workflows.service.spec.ts` 의 "트랜잭션 순서 추적 mock + finally 복원" 보일러플레이트가 4회(이번 라운드 3회 추가) 반복 | `workflows.service.spec.ts` (766, 844, 876, 960, 988행 등) | `mockOrderedTransaction`/`mockFailingTransaction` 같은 로컬 테스트 헬퍼 추출 검토(필수 아님) |
| 8 | Architecture | `recordAudit` private 래퍼가 4개 서비스(model_config/schedule/trigger/workflow)에 거의 동일한 형태로 중복 구현됨 | 4개 서비스 `recordAudit` 정의부 | `AuditActionFor<P>` 기반 제네릭 팩토리(`makeResourceAuditRecorder`)로 추출 검토 |
| 9 | Architecture | Schedule↔Trigger 1:1 페어 리소스가 서로의 리포지토리를 직접 주입해 우회 접근하는 기존 결합 위에 audit 경계 규칙("호출된 엔드포인트 리소스만 기록")이 얹힘 — 새로 도입된 결합은 아님 | `schedules.service.ts`(triggerRepository 직접 사용), `triggers.service.ts`(scheduleRepository 직접 사용, syncScheduleActivation) | 이번 diff 범위 밖. 장기적으로 공개 메서드 경계로 좁히는 방안 고려 |
| 10 | Architecture | `TriggersService` 가 이미 다중 책임(CRUD + 3채널 어댑터 lifecycle + 2종 secret rotation + DTO sanitize)을 지는데 audit 책임까지 추가로 흡수 | `triggers.service.ts` 전체(1300+ 줄) | 즉시 조치 불요. 향후 chat-channel lifecycle / secret rotation 분리를 리팩터링 후보로 남김 |
| 11 | Testing | 신규 `AuditActionFor<P>` 타입 제약 자체를 지키는 실행형 회귀 테스트가 코드베이스에 없음(1회성 수작업 `tsc` 검증만 존재). `nest build` 가 실질 방어선이라 즉시 위험은 낮음 | `audit-action.const.ts` `AuditActionFor` 정의부 | 선택적: `@ts-expect-error` 컴파일-타임 가드를 서비스 spec 파일에 1곳 추가 고려 |
| 12 | Documentation | `ModelConfigService.create()` 의 `recordAudit` 호출에 "커밋 후 기록" 근거 주석이 없음(동일 파일 `setDefault()`·다른 3개 서비스 create/update/remove 는 모두 있음). 코드 배치 자체는 이미 커밋 후라 동작은 정상 — 순수 문서 일관성 갭, 7차 리뷰부터 미조치 잔존 | `model-config.service.ts` `create()` recordAudit 호출부(282-293행) | `setDefault()`/`remove()` 와 동일한 1줄 주석 추가 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | 시크릿/토큰 회전 3개 엔드포인트 감사 누락(WARNING), recordAudit 방어적 격리 부재(INFO) |
| requirement | LOW | 기능 요구사항 완전 충족, 4건 SPEC-DRIFT(문서만 stale) + saveCanvas/restoreVersion 의도적 보류(INFO) |
| scope | NONE | 범위 이탈·불필요한 리팩토링·무관한 파일 수정 없음, 커밋 목적과 diff 정확히 일치 |
| side_effect | LOW | audit_log INSERT 는 격리됨, userId breaking change 는 orphaned caller 없음, 위치 비일관은 INFO |
| maintainability | LOW | AuditActionFor 리터럴-RESOURCE_TYPE 이중 하드코딩(WARNING), 테스트 보일러플레이트 반복(INFO) |
| testing | NONE | 신규 테스트 3건 뮤턴트로 실제 방어 확인, 타입 제약도 재현 검증. 유일 갭은 타입 제약 자체의 회귀 테스트 부재(INFO) |
| architecture | LOW | 설계 견고(타입 레벨 정합성 강제, 실패 격리, 일관된 기록 시점). 중복·기존 결합·TriggersService 다중책임은 모두 기존 구조상 개선 여지(INFO) |
| documentation | LOW | CHANGELOG/README/API 문서 적절. spec drift(WARNING, requirement 와 동일 사안) + 주석 누락 1건(INFO) |

## 발견 없는 에이전트

없음 — 8개 reviewer 전원이 최소 1건 이상(WARNING 또는 INFO)을 보고했다. 다만 `scope`(NONE)와 `testing`(NONE)은 실질적 문제 없음으로 판정.

## 권장 조치사항

1. **(WARNING #1, security)** `TriggersService.rotateNotificationSecret`/`revokePerTriggerToken`/`rotateBotToken` 에 대응 audit action 을 추가하고 `recordAudit` 호출을 배선한다. 의도적 제외라면 그 근거를 `audit-action.const.ts` 에 명시한다 — 이번 audit-logging PR 의 취지(사고 대응 추적성)에 가장 직접적으로 부합하는 잔여 갭이다.
2. **(WARNING #2~5, SPEC-DRIFT)** `developer` 권한 밖 — 다음 project-planner 턴에서 `plan/in-progress/spec-sync-auth-gaps.md` 의 "spec SoT 4곳 동기화" 체크박스를 실행해 `spec/5-system/1-auth.md §4.1`, `spec/data-flow/1-audit.md §1.1`, `spec/conventions/audit-actions.md §3`, `spec/2-navigation/2-trigger-list.md`(L182/L252) 를 한 커밋에서 동시 갱신한다. 코드는 이미 spec 의도와 일치하므로 revert 불필요.
3. **(WARNING #6, maintainability)** 여유가 되면 `AuditActionFor<typeof *_RESOURCE_TYPE>` 형태로 리소스 리터럴 이중 하드코딩을 단일 소스로 통합한다.
4. **(INFO, architecture/maintainability)** 필수는 아니나 다음 라운드에 `recordAudit` 공용 팩토리 추출과 `workflows.service.spec.ts` 트랜잭션 mock 헬퍼화를 함께 검토할 수 있다.

## 라우터 결정

- `routing_status=skipped` — "라우터 미사용(forced whitelist 전원 강제 포함). 전체 reviewer 실행."
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, architecture, documentation` (8명)
  - **제외**: 없음
  - **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` (6명, 전원 결과 확보됨 — 화이트리스트 미이행 없음)