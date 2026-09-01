# 유지보수성(Maintainability) 리뷰 — audit-record-factory (2026-09-01 15:25:56, 3라운드)

## 사전 확인

이 changeset 은 이미 두 라운드(`14_31_12`, `15_10_38`)의 유지보수성 리뷰·수정을 거쳤다.
1라운드 WARNING(클램핑 상한 `64` 매직넘버 중복)과 2라운드 WARNING 2건(클래스 JSDoc·테스트
설명 주석이 새 코드 삽입으로 원래 선언/테스트에서 물리적으로 분리됨)이 이번 diff 에 실제로
반영됐는지 소스를 직접 열어 재검증했다.

- `business-metrics.service.ts:48-60` — `PROMETHEUS_LABEL_MAX_LEN` 상수 + `clampLabel()` 이
  `RedisFailOpenReason` 타입 아래·클래스 JSDoc(`:62-72`) 위에 있다. 클래스 JSDoc 은
  `@Injectable() export class BusinessMetricsService`(`:73-74`) 바로 위에 다시 인접해
  귀속이 정상 복구됐다. `recordExecutionError`(`:132-134`)·`recordAuditWriteFailed`(`:180-182`)
  모두 `clampLabel()` 을 공유한다 — 1라운드 WARNING 은 해소 확인.
- `business-metrics.service.spec.ts:85-89` — `recordRedisFailOpen` 을 설명하던 주석이 다시
  그 테스트(`:90`) 바로 위에 있다. 신설된 `recordAuditWriteFailed` 주석(`:62-66`)은 "아래
  `recordRedisFailOpen` 주석" 으로 정방향 참조한다 — 2라운드 WARNING 2건 모두 해소 확인.

두 라운드가 이미 다룬 항목을 재차 WARNING 으로 올리지 않는다. 이번 라운드는 (a) 그 해소를
실측 확인하고, (b) 아직 다루지 않은 관점(중첩·복잡도)과 (c) 여전히 미반영 상태로 남은 기존
INFO 항목의 현재 상태만 갱신해 보고한다.

## 발견사항

- **[INFO]** (신규 관점) `AuditLogsService.record()` 의 catch 블록에 이중 `try`/`catch` 가
  생겨 이 함수의 중첩 깊이가 한 단계 늘었다
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` — `record()` 메서드
    (바깥 `try`/`catch` 는 함수명, 안쪽 `try { this.metrics?.recordAuditWriteFailed(...) } catch {}` 는
    `record()` 본문 중 `this.metrics?.recordAuditWriteFailed(entry.resourceType);` 를 감싸는 블록)
  - 상세: 종전엔 `try { save } catch { logger.warn }` 1단 중첩이었는데, 이번 diff 로 catch
    내부에 관측 호출을 보호하는 두 번째 `try`/`catch` 가 들어가 `record()` 안에 중첩 2단(바깥
    try/catch 안에 또 try/catch)이 생겼다. 안쪽 catch 는 본문이 주석 한 줄뿐인 사실상 빈
    블록이라 그 자체로 읽기 어렵지는 않지만, "관측이 새 실패 경로가 되면 안 된다"는 의도를
    다음 사람이 한 번에 읽으려면 바깥 catch 전체(약 25줄, 주석 포함)를 같이 읽어야 한다.
    security.md/side_effect.md 가 이미 이 블록을 "왜 필요한가"(계약 보호) 관점에서, RESOLUTION.md
    가 뮤테이션(X5, try 제거 → RED)으로 검증했음을 확인했다 — 여기서는 그 필요성 자체가 아니라
    **중첩이 늘었다는 순수 가독성 사실**만 기록한다.
  - 제안: 조치 불필요 수준(단일 chokepoint 라 함수 분리보다 인라인이 오히려 문맥 유지에
    유리하다는 트레이드오프가 이미 문서화돼 있다). 다음에 `record()` 에 세 번째 보호 대상이
    생기면 안쪽 `try { X } catch {}` 패턴을 `safeguard(() => X)` 같은 이름 있는 헬퍼로 뽑는 것을
    고려할 만하다 — 지금은 1곳뿐이라 추출이 이르다.

- **[INFO]** (이전 두 라운드에서 이미 지적, 여전히 미반영) 동일 목적의 조립 헬퍼 이름·형태가
  두 벌 — `makeService` / `build`
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:89-94`(`makeService`),
    `:154-167`(`build`)
  - 상세: 둘 다 mock repo(+`build` 는 metrics mock 도)로 `AuditLogsService` 를 조립하는 같은
    역할인데 이름과 인자 스타일이 다르다(`build(true/false)` 는 boolean flag argument 라
    호출부(`build(true)`, `build(false)`, 각 4곳)만 봐서는 "save 가 reject 하는지" 가 바로
    안 드러난다). `entry` 객체 리터럴도 필드·값이 완전히 동일한 채 두 곳(`:96-102`,
    `:146-152`)에 중복 선언돼 있다.
  - 제안: 1·2라운드와 동일 — 급하지 않다(내용이 서로 어긋나 있지 않음을 재확인). 다음에 이
    파일을 만질 계기가 있으면 `makeService` 를 재사용하도록 통합하거나 `build({ saveRejects })`
    named-option 형태로 정리.

- **[INFO]** (이전 두 라운드에서 이미 지적, 여전히 미반영) 가드의 바인딩 판정이 타입 텍스트
  접두 문자열 비교(`startsWith`)에 의존
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:121-125`
    (`findUnboundHelpers` — `!s.actionType?.startsWith(\`${BOUND_TYPE_NAME}<\`)`)
  - 상세: `member.type.getText()` 로 얻은 소스 텍스트 그대로 접두 비교한다. `AuditActionFor <T>`
    (공백)·괄호로 감싼 형태처럼 서식이 달라지면 오탐 여지가 있다. fixture 가 커버하는 5가지
    형태에는 정확히 동작하므로 즉시 조치 대상은 아니다.
  - 제안: `ts.isTypeReferenceNode(member.type) && member.type.typeName.getText() === BOUND_TYPE_NAME`
    처럼 AST 노드 종류로 판정하면 서식 독립적인 검사가 된다.

- **[INFO]** (이전 두 라운드에서 이미 지적, 여전히 미반영) rationale 주석 비중이 실제 로직
  대비 크다 — 같은 plan 이 이미 등재해 둔 패턴의 확장
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:97-108`(catch 블록:
    주석 약 12줄 vs 코드 약 6줄), `codebase/backend/src/modules/metrics/business-metrics.service.ts:159-179`
    (`recordAuditWriteFailed` JSDoc 약 21줄 vs 함수 본문 3줄)
  - 상세: `plan/in-progress/spec-sync-auth-gaps.md` 가 다른 파일(`audit-action.const.ts`)에
    대해 이미 "서술형 논거는 spec 이 SoT" 라는 결론을 INFO 로 남겨 뒀는데, 이번 diff 의 코드
    주석도 같은 내용을 `plan/in-progress/spec-sync-auth-gaps.md`·
    `plan/complete/spec-draft-audit-write-failed-metric.md`·`CHANGELOG.md` 네 곳에 거의 동일한
    문장으로 반복해 SoT 가 갈린다.
  - 제안: 즉시 조치 불필요(팀 관례상 유예됨, 3라운드 연속 동일 판단). 이 파일들을 다음에 확장할
    계기가 있으면 plan 항목 범위를 넓혀 정리 대상에 포함.

## 요약

핵심 코드(`audit-logs.service.ts`, `auth-configs.service.ts`, `business-metrics.service.ts`,
신규 `audit-action-binding-*` 가드 3종)의 네이밍은 목적을 명확히 드러내고(`recordAuditWriteFailed`,
`AuditActionFor`, `findUnboundHelpers`, `clampLabel`), 함수 길이·순환 복잡도는 전반적으로
양호하다. 1라운드가 지적한 매직넘버 중복(`64`)과 2라운드가 지적한 JSDoc/주석 분리 결함 2건은
소스를 직접 열어 실측한 결과 모두 정상 복구돼 있다 — 신규 회귀 없음. `record()` 의 관측 보호용
이중 `try`/`catch` 로 중첩이 한 단계 늘었지만 뮤테이션으로 검증된 필요한 방어이고 함수 자체가
짧아 즉시 조치 대상은 아니다. 남은 항목은 전부 1·2라운드에서 이미 INFO 로 등재된 채 3라운드
연속 "저우선순위로 유예" 로 판정된 것들(테스트 헬퍼 명명 불일치, `entry` 픽스처 중복, 가드의
문자열 접두 비교, rationale 주석 비대화)이며 구조적 결함이나 차단 사유는 없다.

## 위험도

LOW
