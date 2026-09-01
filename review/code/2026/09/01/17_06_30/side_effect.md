# 부작용(Side Effect) 리뷰

## 검토 방법

이번 changeset(감사 적재 실패 관측성 추가 + `auth_config` `recordAudit` 액션 타입 바인딩 + 정적 AST
가드 신설)은 이미 6라운드 리뷰를 거쳐 수렴했고, 매 라운드 side_effect 관점 리뷰가 반복됐다
(`review/code/2026/09/01/{14_31_12,15_10_38,15_25_56,15_49_24,16_29_11,16_53_16}/side_effect.md`,
전부 위험도 NONE/LOW). 이번 7라운드에서는 그 결론을 재검증하되, 직접 소스를 다시 열어 다음을
독자적으로 실측했다.

## 발견사항

- **[INFO]** `AuditLogsService` 생성자 시그니처 변경 — 하위호환 재확인
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` (`constructor`, `@Optional() private readonly metrics?: BusinessMetricsService` 추가)
  - 상세: `grep -rn "new AuditLogsService(" codebase/backend/src`로 직접 재확인한 결과, 실제 호출부는
    `audit-logs.spec.ts`(4곳) · `executions-rerun.service.spec.ts:558` 전부 단일/positional 인자
    호출이라 새 두 번째 파라미터는 `undefined` 로 안전하게 폴백한다. `BusinessMetricsService` 는
    `metrics.module.ts` 에서 `@Global()` 로 등록돼 있어(`app.module.ts`) `AuditLogsModule` 이 별도
    `imports` 없이 자동 주입받는다 — 순환 의존도 없다(`metrics` 모듈은 `audit-logs` 를 참조하지
    않음). 기존 6라운드 결론(INFO, 안전)과 일치.
  - 제안: 조치 불필요.

- **[INFO]** 신규 정적 가드가 `codebase/backend/src/modules` 전체를 파일시스템 재귀 스캔 (읽기 전용)
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts` (`collectSourceFiles()`)
  - 상세: `grep`으로 재확인 — `writeFileSync`/`mkdirSync`/`process.env` 쓰기 등 부수 파일시스템
    쓰기·환경변수 조작은 없다(`fs.readdirSync`/`fs.readFileSync` 읽기만). 형제 가드
    `engine-error-code-anchor-guard.ts` 와 동일한 기존 컨벤션이라 신규 리스크는 아니다.
  - 제안: 조치 불필요.

- **[INFO]** `AuthConfigsService.recordAudit` 의 `action` 파라미터 타입 좁힘은 컴파일 타임 전용
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` (`recordAudit`, private 메서드)
  - 상세: `AuditAction`(전체 union) → `AuditActionFor<typeof AUTH_CONFIG_RESOURCE_TYPE>`. `private`
    메서드이고 클래스 내부 호출부 5곳 모두 named-object 리터럴로 호출되어(런타임 인자 순서·값
    변경 없음), 런타임 동작에 영향이 없다.
  - 제안: 조치 불필요.

- **[INFO]** `record()` catch 내부 관측 호출은 자체 `try`/`catch` 로 격리 — 단, **검토 중 워킹트리에서
  이 격리가 일시적으로 제거된 상태를 관측**했다 (프로세스 이상 상태 보고, 코드 결함 아님)
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts` 의 `record()` catch 블록
  - 상세: 이 리뷰가 대상으로 받은 프롬프트(diff)에는
    ```
    try {
      this.metrics?.recordAuditWriteFailed(entry.resourceType);
    } catch {
      // best-effort — 관측 실패는 관측 실패로 끝낸다.
    }
    ```
    형태로 관측 호출이 이중으로 격리돼 있고(1라운드 W2에서 도입, RESOLUTION.md 뮤턴트 X5로
    "제거 시 RED" 검증됨), 이 형태를 기준으로 위 판정을 내렸다. 그런데 리뷰 도중 `git status --short`
    로 확인한 결과 워킹트리의 실제 파일이 다음으로 바뀌어 있었다(이 리포트 작성 시점의 순간
    스냅샷):
    ```
    -      try {
    -        this.metrics?.recordAuditWriteFailed(entry.resourceType);
    -      } catch {
    -        // best-effort — 관측 실패는 관측 실패로 끝낸다.
    -      }
    +      this.metrics?.recordAuditWriteFailed(entry.resourceType);
    ```
    즉 안쪽 `try`/`catch` 가 제거된 상태다. 이는 이 세션이 저지른 편집이 아니다 — 본 리뷰는 파일을
    한 번도 쓰지 않았고(Read 전용), RESOLUTION.md 들이 기록한 "X5/뮤턴트 try 제거" 실험과 정확히
    같은 모양이라 **다른 병렬 프로세스(동시 실행 중인 리뷰어 또는 뮤테이션 검증 스크립트)가 같은
    워킹트리를 수정 중**인 것으로 보인다. 프롬프트 규약(§검증용 뮤테이션 규약)이 경고한 "병렬
    fan-out 중 저장소 오염" 사례 그대로다. 이 세션은 `git checkout`/`git restore` 를 쓰지 않았고
    이 파일을 되돌리지도 않았다 — 그 원복은 원 변경 주체(다른 리뷰어/스크립트)의 책임이며, 내가
    되돌리면 그쪽의 진행 중 검증을 방해할 수 있다.
  - 제안: 이 항목은 **코드 결함이 아니라 프로세스 관측**이다. push/커밋 전 오케스트레이터가
    `git status --short` 로 이 세션(리뷰 라운드) 종료 시점의 워킹트리가 clean 한지, 또는 diff 가
    프롬프트가 보여준 것과 일치하는지 재확인할 것을 권한다. 안쪽 `try`/`catch` 가 최종적으로
    제거된 채 커밋되면 W2(1라운드)에서 이미 지적·수정된 "관측이 swallow 계약을 역행하는 새 실패
    경로가 된다" 결함이 재발한다 — OTel `Counter.add()` 가 실측상 non-throwing 이라 발동 가능성은
    낮지만, 이 자리는 12개+ 특권 CRUD producer 가 지나는 chokepoint 라 재발 시 파급이 넓다.

- **[INFO]** 신규 카운터(`clemvion.audit.write_failed`) 추가는 `BusinessMetricsService` 싱글턴의
  상태 없는(stateless) `Counter.add()` 호출뿐 — 기존 인스턴스 필드·전역 변수 변경 없음
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` (`auditWriteFailed` 필드, `recordAuditWriteFailed()`)
  - 상세: `clampLabel()`/`PROMETHEUS_LABEL_MAX_LEN` 공유화(기존 `recordExecutionError` 리팩터)는
    동작이 동일함을 확인(`.substring(0, 64)` → `clampLabel()` 이 같은 상한 64 사용). 새 전역 변수
    도입 없음, 모듈 스코프 상수 하나(`PROMETHEUS_LABEL_MAX_LEN`)만 추가.
  - 제안: 조치 불필요.

## 요약

핵심 변경(감사 적재 실패 관측성 추가, `auth_config` `recordAudit` 타입 바인딩, AST 기반 바인딩
가드 신설)에서 CRITICAL/WARNING 급 부작용은 발견되지 않았다 — 6라운드에 걸친 기존 결론과
일치한다. 유일하게 새로 적을 만한 것은 코드 결함이 아니라 **리뷰 진행 중 워킹트리에서 관측한
프로세스 이상**이다: `record()` catch 안의 관측 호출을 감싸는 내부 `try`/`catch`(1라운드 W2 수정
사항)가 리뷰 도중 워킹트리에서 사라진 상태로 관측됐다 — 이 세션이 만든 변경이 아니며, 프롬프트가
제시한 diff 는 여전히 격리된 형태다. 병렬 리뷰/뮤테이션 세션이 같은 워킹트리를 동시에 건드리고
있을 가능성이 높으므로, 최종 커밋 전 이 파일의 실제 상태를 재확인할 것을 권한다. 그 외 시그니처
변경(`AuditLogsService` 생성자 `@Optional` 파라미터)은 호출부 전수 확인으로 하위호환이 실측됐고,
`AuthConfigsService.recordAudit` 타입 좁힘은 private 메서드의 컴파일 타임 전용 변경이며, 신규
정적 가드는 파일시스템 읽기 전용이다. 새 전역 변수·환경 변수 읽기/쓰기·네트워크 호출·이벤트/콜백
계약 변경은 diff 전체에서 발견되지 않았다.

## 위험도
LOW
