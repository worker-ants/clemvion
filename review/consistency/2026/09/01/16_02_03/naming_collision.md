# 신규 식별자 충돌 검토 — `spec/5-system/` (`--impl-done`)

## 검토 방법

프롬프트 번들의 `## 구현 변경 사항` 섹션은 예산 초과로 비어 있었다(diff 본문 부재 확인 —
`diff --git` 0건). 규약에 따라 프롬프트 판정을 보류하고, 워킹트리
(`/Volumes/project/private/clemvion/.claude/worktrees/audit-record-factory`, 현재 세션 CWD 와
동일)에서 `git diff origin/main..HEAD` 를 직접 실측했다.

- scope(`spec/5-system`) 델타: `spec/5-system/_product-overview.md` 1개 파일 (+7/-1)
- 구현 diff: `codebase/` 8개 파일(595줄) — `audit-logs.service.ts`, `audit-logs.spec.ts`,
  `auth-configs.service.ts`, `business-metrics.service.ts`, `business-metrics.service.spec.ts`,
  `repo-guards/__tests__/audit-action-binding-{fixture,guard}.ts`,
  `repo-guards/__tests__/audit-action-binding.spec.ts`
- 연관 spec: `spec/data-flow/1-audit.md`, `spec/data-flow/9-observability.md` (동일 PR, 같은
  신규 식별자를 참조)
- 연관 plan: `plan/in-progress/spec-sync-auth-gaps.md`, `plan/complete/spec-draft-audit-write-failed-metric.md`

target 이 도입하는 신규 식별자를 전수 열거하고, 각각을 저장소 전체(`spec/`, `codebase/`)에서
grep 하여 기존 사용처와의 의미 충돌 여부를 확인했다.

## 발견사항

없음 — 신규 식별자 전수(아래)에서 CRITICAL/WARNING 급 충돌을 발견하지 못했다.

### 신규 식별자 목록 및 충돌 검사 결과

| 구분 | 신규 식별자 | 검사 결과 |
|---|---|---|
| 메트릭 | `clemvion.audit.write_failed` (Counter) | `spec/5-system/_product-overview.md`·`spec/data-flow/9-observability.md` 전체에서 유일. 기존 `clemvion.*` 카탈로그(6종)와 이름 겹침 없음 |
| 라벨 | `resource_type` (위 메트릭의 라벨) | 기존 `audit_log.resource_type`(spec/1-data-model.md:669, spec/data-flow/1-audit.md:217) · `notification.resource_type`(spec/data-flow/8-notifications.md 다수) 과 **동일한 의미**(리소스 종류 식별자)의 재사용. 새 의미 부여가 아니므로 충돌 아님 — 오히려 기존 SoT 컬럼명과 일관 |
| 요구사항 ID | (신규 없음) | NF-OB-07 은 기존 ID 재사용(설명 문구·카탈로그 행만 추가). 새 ID 미도입 |
| TS 심볼 | `BusinessMetricsService.recordAuditWriteFailed()`, `auditWriteFailed`(private field), `clampLabel()`, `PROMETHEUS_LABEL_MAX_LEN` | `business-metrics.service.ts` 정의 외 타 파일에서 미사용 (grep 전수) — 충돌 없음 |
| TS 심볼 | `MODULES_DIR`, `AUDIT_HELPER_NAMES`, `BOUND_TYPE_NAME`, `AuditHelperSite`, `collectSourceFiles`, `findAuditHelpers`, `findUnboundHelpers` | `repo-guards/__tests__/audit-action-binding-guard.ts` 신설 export. 저장소 전체에서 동명 export 미발견(형제 가드 `engine-error-code-anchor-guard.ts` 등과도 이름 겹침 없음) |
| 파일 경로 | `codebase/backend/src/repo-guards/__tests__/audit-action-binding-{fixture,guard}.ts`, `audit-action-binding.spec.ts` | 디렉터리 내 기존 컨벤션(`<topic>-guard.ts`/`-fixture.ts`/`.spec.ts` — `engine-error-code-anchor-*`, `eslint-unicorn-peer-*` 와 동형)을 그대로 따름. 기존 파일과 경로 중복 없음 |
| 파일 경로 | `plan/complete/spec-draft-audit-write-failed-metric.md` | `git ls-tree -r HEAD -- plan` 전수 확인, 동명 파일 1개(자신)뿐 |
| API endpoint | (신규 없음) | 이 델타는 REST endpoint 를 추가하지 않음 |
| 이벤트/큐 | (신규 없음) | webhook·queue·SSE 이벤트 신설 없음 |
| 환경변수 | (신규 없음) | 신규 `process.env`/ENV 참조 없음(diff 전수 grep 0건). 기존 `OTEL_ENABLED` 재사용뿐 |

### 참고 — 이미 선행 검토된 사안

동일 신규 식별자(`clemvion.audit.write_failed`, `resource_type`)는 이 PR 의 앞선
`--spec` 단계 consistency-check(`review/consistency/2026/09/01/15_00_54/naming_collision.md`)
에서도 "전수 검색 결과 타 도메인과 충돌 없음, 코드 선행 구현과 이름 일치" 로 NONE 판정을
받았다. 본 `--impl-done` 검토는 그 이후 실제 구현 코드(8개 파일)까지 포함해 재확인했고
동일 결론에 도달했다.

## 요약

target 델타가 도입하는 신규 식별자는 메트릭명 `clemvion.audit.write_failed`, 라벨
`resource_type`, 그리고 이를 뒷받침하는 TS 심볼(`recordAuditWriteFailed`·`clampLabel`·
`audit-action-binding-*` 가드 3종) 및 신규 plan 파일 1개다. 라벨 `resource_type` 은 새
의미가 아니라 기존 `audit_log`/`notification` 테이블의 동명 컬럼과 같은 의미를 재사용한
것이라 오히려 명명 일관성을 강화한다. 메트릭명·TS export·파일 경로 전수를 저장소
전체에서 grep 했을 때 기존 사용처와 의미가 다른 재사용 사례는 없었고, 새 테스트 파일
경로도 `repo-guards/__tests__/` 의 기존 3-파일(`-guard`/`-fixture`/`.spec`) 명명 컨벤션을
정확히 따른다. 요구사항 ID·API endpoint·이벤트명·환경변수 축에서는 신규 도입 자체가 없어
검토 대상이 없었다.

## 위험도

NONE
