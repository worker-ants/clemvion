# 문서화(Documentation) 리뷰 — audit-record-factory (2026-09-01 14:31:12)

## 발견사항

- **[WARNING]** 신규 OTel 커스텀 메트릭 `clemvion.audit.write_failed` 가 spec 의 공식 "메트릭 카탈로그" SoT 에 등재되지 않았다.
  - 위치: `spec/5-system/_product-overview.md:77-88` (`### NF-OB-07 메트릭 카탈로그` 표, 현재 6행 — `clemvion.execution.total`/`.errors`/`.queue.depth`/`.llm.tokens`/`.node.duration`/`.redis.fail_open` 만 등재), `spec/data-flow/9-observability.md:202-207` (같은 목록을 요약 인용하는 blockquote — SoT 를 명시적으로 `_product-overview.md` NF-OB-07 로 지정)
  - 상세: `codebase/backend/src/modules/metrics/business-metrics.service.ts` (게이트 92-96, 147-172) 에서 신설한 `auditWriteFailed` Counter/`recordAuditWriteFailed()` 가 이 카탈로그에 없다. 이 표는 장식이 아니라 명시적 SoT다 — `9-observability.md:207` 이 "SoT: … NF-OB-07(메트릭 카탈로그)" 라고 못 박고 있고, 바로 인접한 `spec/data-flow/9-observability.md` 의 `### clemvion.redis.fail_open 의 component 를 실제 배선된 값만 열거하는 이유` Rationale 문단이 "새 소비자를 배선할 때 유니온과 NF-OB-07 카탈로그 표를 **동시에** 넓히는 것이 규칙이다" 라고 **명문 규칙**으로 적어 두었다. 실제로 `clemvion.redis.fail_open` 도입 시에는 `plan/complete/spec-draft-nf-ob-07-redis-fail-open.md` 라는 전용 planner 턴으로 이 카탈로그를 갱신한 선례가 있다. 이번 PR 은 그 선례와 같은 계급의 신규 인스트루먼트(새 Counter, 새 라벨)를 추가했는데 카탈로그·요약 문장 어느 쪽도 갱신하지 않았다.
  - 제안: `developer` 는 `spec/` 을 직접 고칠 권한이 없으므로(자기-반증형 소정정 예외 대상 아님 — 이 카탈로그 문장은 developer 가 쓴 예고가 아니라 제품 계약형 SoT), `plan/in-progress/spec-sync-auth-gaps.md` 에 "NF-OB-07 카탈로그에 `clemvion.audit.write_failed` 등재 필요" 항목을 남기고 project-planner 턴으로 `_product-overview.md` NF-OB-07 표 + `9-observability.md` 요약 문장을 함께 갱신할 것.

- **[WARNING]** `CHANGELOG.md` 에 이번 변경의 "Unreleased" 서술이 없다 — 같은 클래스의 선행 변경들과 관례가 어긋난다.
  - 위치: `CHANGELOG.md` (이번 diff 에 포함되지 않음). 선례: `CHANGELOG.md:781` `## Unreleased — 멱등 캐시 fail-open 을 알람 걸 수 있게 만든다 (clemvion.redis.fail_open)`
  - 상세: `git log --oneline -20 -- CHANGELOG.md` 로 확인한 결과, 보안/관측성 성격의 fix 커밋은 거의 예외 없이 같은 커밋에서 `CHANGELOG.md` 에 "왜" 중심의 Unreleased 섹션을 추가해 왔다(예: fail-open 관측 추가, egress 마스킹, 트랜잭션 보장 등 20건 이상). 특히 `clemvion.redis.fail_open` 도입 PR 이 정확히 이 커밋과 같은 패턴(경고 로그뿐이던 실패를 카운터로 승격)이었고 CHANGELOG 항목을 남겼다. 이번 커밋(`9a2e860dc`)은 동일한 결함 클래스("경고 로그뿐이라 알람을 못 건다")를 감사 로그에도 적용했고, 추가로 `auth_config` 의 실제 타입 안전성 구멍(맨 `AuditAction` union — 다른 리소스의 액션을 잘못된 resourceType 으로 기록해도 컴파일러가 못 잡던 결함)까지 고쳤음에도 `CHANGELOG.md` 에는 흔적이 없다. 커밋 본문에는 이 서사가 이미 잘 쓰여 있으므로 실질 작업은 아니고 옮겨 적는 수준이지만, 이 저장소에서 CHANGELOG 는 git log 와 별도로 사람이 읽는 큐레이션 문서로 기능하고 있어 갭이 실질적이다.
  - 제안: `## Unreleased — 감사 로그 적재 실패를 알람 걸 수 있게 + auth_config 액션 타입 구멍` 정도의 섹션을 추가하고, 커밋 본문의 핵심 서사(`recordRedisFailOpen` 과 같은 결함 클래스 · `auth-configs` 의 맨 union 실측 구멍 · 가드로 대체한 이유)를 옮겨 적을 것.

- **[INFO]** `AuditLogsService.record()` 의 공개 독스트링이 이번에 추가된 관측 동작(메트릭 카운터 증가·풍부해진 실패 로그)을 언급하지 않는다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:72-75` (JSDoc), 대비 대상 변경은 게이트 104-110
  - 상세: 현재 독스트링은 `"Record an audit event. Failures are swallowed — audit logging must never break the primary action."` 로, "삼킨다" 는 절반의 계약만 서술한다. 이번 PR 이 추가한 나머지 절반 — 실패 시 `metrics?.recordAuditWriteFailed()` 로 카운터가 오르고, `logger.warn` 메시지에 `action`/`resourceType`/`resourceId`/`workspaceId` 가 실린다는 것 — 은 spec(`data-flow/9-observability.md`)·plan·테스트 헤더에는 정성껏 서술돼 있는데 정작 메서드 바로 위 JSDoc 에는 없다. `auth-configs.service.ts` 의 여러 메서드가 `{@link AuditLogsService.record}` 로 이 독스트링을 참조해 계약을 위임하고 있어(예: `create()` 게이트 151-158), 이 진입점 자체가 "swallow 계약의 나머지 절반(관측 가능성)" 을 요약하면 참조하는 쪽에서 왕복 조사가 줄어든다. 오류는 아니고 불완전함이라 severity 는 낮게 잡는다.
  - 제안: JSDoc 에 한 줄 추가 — 예: `* On failure, increments {@link BusinessMetricsService.recordAuditWriteFailed} and logs action/resourceType/resourceId/workspaceId for diagnosis.`

## 우수 사례 (참고)

- `BusinessMetricsService.recordAuditWriteFailed` 의 JSDoc(게이트 147-172)은 "왜 클램핑인가(닫힌 유니온이 아니라)" 섹션까지 포함해 설계 근거·대안·향후 전환 조건을 명시하는 모범적인 문서화다. `resourceType` "실측 12종" 주장도 `grep` 으로 재확인한 결과 정확했다(리터럴 9종 + 상수 식별자 3종 신규 = 12).
- `repo-guards/__tests__/audit-action-binding-{guard,fixture}.ts`, `audit-action-binding.spec.ts` 는 가드의 존재 이유·판정 방식(형태 vs 값)·fixture 를 라이브 소스가 아닌 별도 파일에 둔 이유까지 문서화해 자기반증 테스트 함정을 피했다는 근거가 뚜렷하다.
- `plan/in-progress/spec-sync-auth-gaps.md` 의 이번 diff 는 원 plan 서술이 옳았음을 실측(대조군 tsc 에러 유무)으로 검증하고, 처방을 바꾼 이유·뮤테이션 축(예측/실측)까지 남겨 plan 문서 품질 관례를 잘 따른다.

## 요약

핵심 코드·테스트·인라인 주석의 문서화 품질은 이 리포지토리 평균보다 높다(특히 `business-metrics.service.ts`와 신규 가드 3파일). 다만 새로 추가된 프로덕션 관측 지표(`clemvion.audit.write_failed`)가 spec 의 명문화된 "NF-OB-07 메트릭 카탈로그" SoT 규칙("새 소비자를 배선할 때 카탈로그 표를 동시에 넓히는 것이 규칙")을 어기고 등재되지 않았고, 같은 결함 클래스의 선례가 지켜온 `CHANGELOG.md` Unreleased 서술 관례도 이번엔 빠졌다. 둘 다 기능적 결함은 아니지만, 하나는 project-planner 턴이 필요한 SoT 갭이고 다른 하나는 반복적으로 지켜진 저장소 관례에서의 이탈이라 후속 조치가 필요하다. `AuditLogsService.record()` 의 독스트링 불완전성은 경미한 INFO 다.

## 위험도

MEDIUM
