# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** CRUD 뮤테이션 경로마다 감사 로그 INSERT 1회가 동기적으로 추가됨 (요청 지연 소폭 증가)
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.ts` (`create` 285-291행, `update` 337-343행, `setDefault` 385-391행, `remove` 402-408행) / `codebase/backend/src/modules/schedules/schedules.service.ts` (`create` 188-193행, `update` 246-251행, `remove` 273-278행) / `codebase/backend/src/modules/triggers/triggers.service.ts` (`create` 262-268행, `update` 342-348행, `remove` 876-882행) / `codebase/backend/src/modules/workflows/workflows.service.ts` (`create` 220-225행, `update` 245-250행, `remove` 257-262행, `duplicate` 397-403행, `importWorkflow` 582-588행)
  - 상세: 각 `recordAudit()` 호출이 `AuditLogsService.record()`(`codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 72-97행)를 `await` 하며, 이는 매번 `audit_log` 테이블에 동기 INSERT 왕복 1회를 추가한다. 루프 안에서 호출되는 곳은 없어 N+1 은 아니며(모두 단건 호출), 트랜잭션 커밋 뒤 위치도 의도적으로 고정돼 있어(주석에 근거 명시 — 롤백 시 허위 감사 방지, 외부 호출 실패 시 감사 유실 방지) 정확성 목적의 순서 제약이지 최적화 여지가 있는 순차 대기는 아니다. `AuditLogsService.record()` 자체는 실패를 삼키므로(try/catch) 응답을 막지는 않지만 지연은 그대로 더해진다. 이 패턴은 이미 auth-configs/workspace/member 등 기존 코드베이스 전반에 쓰이던 동일 관례(주석의 "auth-configs W-1 과 동일 근거")를 그대로 확장한 것이라 신규 안티패턴은 아니다.
  - 제안: CRUD 빈도는 낮아(실행 이벤트가 아님) 별도 조치가 시급하지 않지만, 향후 이 기록을 조회 경로(`findAll`/`findById` 등 고빈도 read)까지 확장할 계획이 있다면 fire-and-forget(예: 이벤트 큐 offload)로 전환할지 검토할 가치가 있다. 현재 범위(CRUD write 만)에서는 조치 불필요.

- **[INFO]** `audit_log` 무제한 테이블에 CRUD 액션 13종이 추가되며 보존/prune 정책 부재가 계속 확대됨
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 32-37행 (파일 헤더 주석, `workflow/trigger/schedule/model_config` CRUD 13종 추가 근거)
  - 상세: 해당 파일 자체 주석(46-51행)이 이미 `audit_log` 이 "보존 정책 미정·pruner 없음"이라는 사실과, 그래서 고빈도 `workflow.executed` 는 의도적으로 제외했다는 근거를 명시하고 있다. 이번 diff 로 추가된 13개 액션은 모두 CRUD(생성/수정/삭제/기본값 지정) 저빈도 이벤트라 이 트레이드오프의 리스크 프로파일을 크게 바꾸지 않지만, 누적 테이블이 무기한 커진다는 근본 이슈는 여전히 미해결로 남아 있다.
  - 제안: 이번 PR 범위 밖(코드 주석에도 "별도 항목으로 분리했다"고 명시)이므로 조치 불필요 — 보존 정책 결정 시점에 함께 다룰 사안으로 재확인만 한다.

- **[INFO]** `AuditLogDto.action` 의 Swagger `description` 이 컴파일타임 문자열 연결로 확장됨
  - 위치: `codebase/backend/src/modules/audit-logs/dto/responses/audit-log-response.dto.ts` 28-40행
  - 상세: `+` 로 이어붙인 긴 문자열이지만 클래스 데코레이터 인자로 모듈 로드 시 1회만 평가되며 요청 경로와 무관하다. 성능 영향 없음.

## 요약

이번 diff 는 `workflow.*`/`trigger.*`/`schedule.*`/`model_config.*` CRUD 경로에 감사 로그 기록을 추가하는 순수 부가(additive) 변경이다. 모든 `recordAudit()` 호출은 루프 밖 단건 호출이며 N+1 패턴이나 비효율적 알고리즘, 불필요한 대규모 객체 할당은 발견되지 않았다. 각 뮤테이션 요청에 동기 INSERT 왕복이 하나씩 추가되어 지연이 소폭 늘지만, 이는 기존 auth-configs/workspace/member 감사 기록과 동일한 이미 확립된 패턴이며 저빈도 CRUD 경로에 국한되어 있어(실행(execution) 이벤트는 의도적으로 제외) 성능 리스크는 낮다. `audit_log` 무제한 성장 이슈는 코드 주석에서 이미 인지·분리 처리된 기존 이슈로, 본 diff 가 새로 유발한 문제는 아니다.

## 위험도
NONE
