# 부작용(Side Effect) 리뷰 — audit-record-factory (2026-09-01 16:29:11, 5라운드)

## 검증 방법

저장소를 뮤테이션하지 않고 `Read`/`Bash(grep, git show, git diff --stat)` 로 현재 소스를
직접 대조했다. 쓰기는 하지 않았다 — `git status --short` 결과 이번 세션이 만든 변경은
`review/code/2026/09/01/16_29_11/`(이 리뷰 산출물 자신) 뿐이다.

`git log`·`git show a09b4aee6` 로 4라운드(`15_49_24`, LOW·수렴 판정) 이후 새로 추가된 커밋을
확인했다 — 이번 라운드의 유일한 신규 커밋(`a09b4aee6`)은 `business-metrics.service.ts` 의
JSDoc 주석(“실측 12종” → “distinct 10종” + 세는 대상 구분) 9줄과 `plan/`·`spec/`·`review/`
문서뿐이며, `codebase/**` 의 실행 코드 diff 는 **0줄**이다(`git diff a09b4aee6^ a09b4aee6 --
codebase/` 로 대조 가능). 즉 1~4라운드가 이미 검증한 부작용 표면(§side_effect.md
`14_31_12`/`15_10_38`/`15_25_56`/`15_49_24`)에서 코드 쪽으로는 변화가 없다. 아래는 그 위에서
직접 재검증한 결과다.

## 발견사항

- **[INFO]** `AuditLogsService` 생성자 시그니처 변경(`@Optional() metrics?`)은 하위 호환 —
  전수 재확인
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:14-20`
  - 상세: `grep -rn "new AuditLogsService("` 로 저장소 전수 재검색한 결과 직접 인스턴스화 지점은
    `audit-logs.spec.ts`(4곳) · `executions-rerun.service.spec.ts:558`(1곳) 뿐이며, 전부
    metrics 인자를 생략하거나 명시 전달하는 형태로 이미 대응돼 있다. `MetricsModule` 이
    `@Global()`(`metrics.module.ts:8`)이라 DI 경로에서 `AuditLogsModule` 이 별도 import 없이도
    주입받는다 — 프로덕션 조립 경로에서 깨지는 호출자 없음.
  - 제안: 없음(확인 목적).

- **[INFO]** swallow chokepoint(`AuditLogsService.record()`) catch 블록 안 관측 호출이 여전히
  자체 `try`/`catch` 로 무방비 노출을 막고 있음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:109-113`
    (`try { this.metrics?.recordAuditWriteFailed(entry.resourceType); } catch { … }`)
  - 상세: 1라운드 WARNING(“관측이 새 실패 경로가 되면 본말전도”)의 수정이 현재 코드에도 그대로
    있다. `entry.resourceType` 을 넘기므로 알림 도메인 값(`workspace_invitation`·`alert_rule`)이
    아니라 감사 producer 가 넘긴 문자열만 라벨에 실린다 — 새로 열린 부작용 표면 아님.
  - 제안: 없음.

- **[INFO]** 신설 repo-guard 3파일은 이번 라운드에도 파일시스템 읽기 전용 — 재확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts:42`
    (`fs.readdirSync`), `audit-action-binding.spec.ts:58`(`fs.readFileSync`)
  - 상세: 세 파일 전체를 `writeFile|rmSync|mkdirSync|unlink|appendFile|process\.env` 로 grep —
    0건. 쓰기·삭제·환경변수 접근 없음. 스캔 범위는 `MODULES_DIR =
    'codebase/backend/src/modules'` 로 고정.
  - 제안: 없음.

- **[INFO]** 이번 라운드 신규 커밋(`a09b4aee6`)은 코드 실행 경로를 바꾸지 않는 순수 문서·주석
  정정
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts:174-179`
    (`recordAuditWriteFailed` JSDoc "왜 클램핑인가" 절)
  - 상세: `git show a09b4aee6 -- codebase/…business-metrics.service.ts` 로 직접 대조 — 변경은
    JSDoc 텍스트뿐이고 `recordAuditWriteFailed(resourceType: string)` 본문(`clampLabel` 호출)은
    바이트 단위로 동일하다. 카운터 라벨 클램핑 동작(런타임)에는 영향 없음. 같은 커밋이 함께
    건드린 `spec/5-system/_product-overview.md`·`spec/data-flow/1-audit.md` 도 서술(숫자) 정정이며
    코드가 참조하는 계약(엔드포인트·스키마)을 바꾸지 않는다.
  - 제안: 없음.

- **[INFO]** `plan/complete/spec-draft-audit-write-failed-metric.md` 등 봉인된 `complete/`
  문서에 사후 정정 노트를 추가 — 문서 내용 변경이며 코드/런타임 부작용 없음
  - 위치: `plan/in-progress/spec-draft-audit-resource-type-count.md` §"동반 정정"
  - 상세: `complete/` 로 이동된 draft 를 원문 삭제 없이 각주로 정정하는 것은 이 저장소의
    `plan-lifecycle.md` 보존 관례와 일치한다(원문 취소선/각주 유지, `.claude` 메모리
    `feedback_planner_draft_is_an_artifact.md` 와 같은 원칙). 실행 코드에 영향 없음.
  - 제안: 없음 — 문서 성격 지적은 documentation/maintainability 리뷰어의 관점.

## 요약

4라운드(`15_49_24`)가 LOW 로 수렴 판정한 이후 이번 라운드에 추가된 유일한 변경(`a09b4aee6`)은
`business-metrics.service.ts` JSDoc 9줄 + `plan/`·`spec/`·`review/` 문서이며, `codebase/**` 실행
코드 diff 는 0줄임을 `git show`/`git diff --stat` 으로 직접 확인했다. 1~4라운드가 식별·수정한
부작용(무방비 metrics 관측 호출, `AuditLogsService` 생성자 시그니처의 호출자 영향, 신설
repo-guard 의 파일시스템 쓰기 여부)을 현재 소스에서 직접 재대조한 결과 전부 안전한 상태로
유지되고 있다. 전역 상태·전역 변수·환경 변수 읽기/쓰기·의도치 않은 네트워크 호출·이벤트/콜백
변경 관점에서 이번 라운드에 새로 도입된 부작용은 없다. 저장소 트리에도 이번 리뷰 세션 산출물
외 예기치 않은 뮤테이션이 없다(`git status --short` 확인).

## 위험도

NONE
