# 부작용(Side Effect) 리뷰 — audit-record-factory (2026-09-01 15:25:56, 3라운드)

## 검증 방법

저장소를 뮤테이션하지 않고 `Read`/`Grep`으로 현재 소스를 직접 대조했다(`audit-logs.service.ts`,
`business-metrics.service.ts`, `business-metrics.service.spec.ts`, `auth-configs.service.ts`).
쓰기는 하지 않았으므로 원복 대상 없음 — `git status --short` 확인 결과 이번 세션이 만든
변경은 `review/code/2026/09/01/15_25_56/`(이 리뷰 산출물 자신) 뿐이다.

이번 diff 는 1라운드(`14_31_12`)·2라운드(`15_10_38`) 리뷰 산출물 및 그 사이 진행된
`/consistency-check --spec`(`review/consistency/2026/09/01/15_00_54`), spec 3파일 갱신(§SD1)을
함께 포함한다. 실질 코드 변경은 1~2라운드에서 이미 다뤄졌던 파일들(`audit-logs.service.ts`,
`business-metrics.service.ts` 등)과 동일하고 이번 라운드에서 새로 diff 된 코드 라인은 없다 —
새로 추가된 것은 review/consistency 산출물(문서)과 spec 3파일(문서)뿐이다. 따라서 이번 라운드는
(a) 2라운드까지의 판정이 현재 코드 상태와 여전히 일치하는지 재확인하고, (b) 이번에 새로 늘어난
파일(review 산출물·spec 문서)에 부작용 관점의 새 표면이 있는지를 본다.

## 발견사항

- **[INFO]** 2라운드 WARNING 전량 해소 상태가 현재 코드에서도 유지됨 — 재확인
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:109-113`
    (`this.metrics?.recordAuditWriteFailed(entry.resourceType)` 을 감싸는 내부
    `try { … } catch { … }`), `codebase/backend/src/modules/metrics/business-metrics.service.ts:55-60`
    (`PROMETHEUS_LABEL_MAX_LEN`/`clampLabel` 이 클래스 JSDoc(`:62-72`) 및 `@Injectable()`(:73)
    **앞**에 위치 — 데코레이터 오적용 없음), `:159-182` (`recordAuditWriteFailed` JSDoc 이
    메서드 바로 위에 정상 귀속).
  - 상세: 1라운드 WARNING("catch 블록 안 metrics 호출이 무방비라 swallow 계약을 이 diff 자신이
    깰 수 있는 새 실패 경로")과 2라운드 WARNING(JSDoc·주석이 삽입 지점 오류로 엉뚱한 선언에
    귀속)이 모두 현재 코드에서 정정된 채로 남아 있다. `grep`으로 직접 열어 확인했다 — 재발 없음.
  - 제안: 없음(확인 목적 기재).

- **[INFO]** `AuditLogsService` 생성자 시그니처(`@Optional() metrics?`)의 호출자 영향 — 재확인
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:19`, 직접 인스턴스화
    지점 `codebase/backend/src/modules/audit-logs/audit-logs.spec.ts:93,162,215,229`,
    `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts:558`
  - 상세: `grep -rn "new AuditLogsService(" codebase/backend/src` 로 현재 저장소 전수 재확인 —
    5곳 전부 metrics 인자 생략(2곳) 또는 명시 전달(3곳)로 이미 대응돼 있어 깨지는 호출부가
    없다. DI 경로는 `MetricsModule`이 `@Global()`이라 `AuditLogsModule` 명시 import 없이도
    해석된다(2라운드 실측 유지).
  - 제안: 없음.

- **[INFO]** 이번 라운드에 새로 늘어난 파일(review/consistency 산출물, spec 3문서)은
  실행 코드가 아니라 부작용 표면이 없음
  - 위치: `review/code/2026/09/01/{14_31_12,15_10_38}/**`, `review/consistency/2026/09/01/15_00_54/**`,
    `plan/complete/spec-draft-audit-write-failed-metric.md`, `plan/in-progress/spec-sync-auth-gaps.md`,
    `spec/5-system/_product-overview.md`, `spec/data-flow/1-audit.md`, `spec/data-flow/9-observability.md`
  - 상세: 전부 마크다운/JSON 문서이고 애플리케이션 런타임에 로드되지 않는다. `spec/` 3파일
    변경은 NF-OB-07 카탈로그·`1-audit.md` 서술을 실제 구현(카운터 신설, 로그 필드 확장)에
    맞춰 갱신한 것으로, 코드 쪽 부작용을 유발하지 않는다(문서만 변경).
  - 제안: 없음.

- **[INFO]** `business-metrics.service.spec.ts` 신규 테스트 2건은 mock meter 로 완전히
  격리돼 있어 실제 OTel/네트워크 호출이 발생하지 않음
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.spec.ts:62-83`
    (`recordAuditWriteFailed` 카운터/클램핑 테스트), 상단 `makeMockMeter()`(:8-27)
  - 상세: `jest.spyOn(metrics, 'getMeter').mockReturnValue(mock.meter)` 로 전역 OTel API 를
    치환하므로, 신규 테스트도 다른 `record*` 테스트와 동일하게 실제 Exporter/네트워크에
    닿지 않는다.
  - 제안: 없음.

- **[INFO]** 신설 repo-guard(`audit-action-binding-{guard,fixture}.ts`, `.spec.ts`)의 파일시스템
  접근 범위 — 재확인, 변화 없음
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:38-57`
    (`collectSourceFiles`, `fs.readdirSync`만 사용)
  - 상세: 이번 라운드에도 `fs.writeFileSync`/`rmSync`/`mkdirSync` 등 쓰기·삭제 API 사용 없음.
    스캔 대상은 `MODULES_DIR = 'codebase/backend/src/modules'` 로 고정, `fixture.ts` 는
    파싱 대상 문자열일 뿐 스캔 범위 밖(2라운드 판정과 동일, 이번 라운드 diff 로 변경 없음).
  - 제안: 없음.

## 요약

이번 라운드에서 코드(`.ts`) 파일 자체에 새로 diff 된 라인은 없다 — 1·2라운드에서 지적된
부작용(무방비 metrics 호출, JSDoc/주석 오귀속)은 현재 코드에서 모두 정정된 채로 유지되고
있음을 재확인했다. 이번에 새로 추가된 것은 이전 라운드들의 리뷰/일관성검사 산출물(문서)과
`spec/` 3개 문서(카탈로그·서술 동기화)로, 둘 다 런타임 부작용 표면이 없다. `AuditLogsService`
생성자의 `@Optional()` 파라미터·`AuthConfigsService.recordAudit` 의 타입 좁힘은 여전히
하위 호환이며 직접 인스턴스화 지점 전수(5곳)를 재확인해 깨지는 호출부가 없다. 신설
repo-guard 는 읽기 전용을 유지한다. 전역 상태·환경 변수·네트워크 호출·이벤트/콜백 관점에서
새로 도입된 부작용은 이번 라운드에서도 발견되지 않았다.

## 위험도

NONE
