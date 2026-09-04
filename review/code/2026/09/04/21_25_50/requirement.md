# 요구사항(Requirement) 리뷰 — `AlertRuleDto.threshold` wire 타입 정정 + `findNumericAsNumber` 가드 (5라운드 누적 최종)

## 범위 확정

`git diff --stat origin/main...HEAD` 로 실측한 실질 변경은 6개 파일이다:

1. `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` — `AlertRuleDto.threshold: number → string`
2. `CHANGELOG.md` — 위 정정을 서술하는 신규 Unreleased 항목
3. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` — `findNumericAsNumber`(제3의 계약 검증 축) 신설 + 정규식→AST 전환 이력
4. `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` — 위 술어의 저장소 전수 테스트 + 대조군(위음성 4형태 + 포지셔널 인자 2형태 + 명명 한계 캐너리 + 리터럴-훑기 캐너리)
5. `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` — `POST → GET → PATCH` 실 HTTP 응답으로 wire 타입 고정 (신규)
6. `plan/in-progress/spec-draft-nullable-notation-followups.md` — planner 트래커 갱신

나머지 59개 파일(`review/code/.../19_43_18/*`, `20_16_17/*`, `20_39_25/*`, `21_10_30/*`,
`review/consistency/.../20_05_42/*`)은 이전 4라운드 리뷰의 산출물이 신규 파일로 커밋된
메타 문서이며, 이번 요구사항 검토의 코드 대상이 아니다. 다만 그 안의 실측 주장이 **지금
시점의 저장소와 여전히 일치하는지**는 아래에서 독립 재검증했다.

## 독립 재검증 (저장소를 직접 열어 확인, 뮤테이션 없음)

- `alert-rule.entity.ts:34-35` — `@Column({ type: 'numeric', precision: 12, scale: 4 }) threshold: string;` 확인. 저장소 전체에서 `numeric`/`decimal` `@Column` 은 정확히 2곳(`alert_rule.threshold`, `llm_usage_log.cost_usd`) — 독립 grep 으로 재확인, 세 번째 인스턴스 없음.
- `alerts.controller.ts` — `list`/`create`/`update` 세 핸들러 모두 반환 타입 애노테이션 없음. `alerts.service.ts:30`(`create`) · `:53`(`update`, `dto.threshold !== undefined` 가드로 PATCH 부분 갱신 의미 보존) 둘 다 `String(dto.threshold)` 로 저장 — CHANGELOG·JSDoc 의 "읽기/쓰기 비대칭은 의도" 서술과 일치.
- `alerts.service.ts` `list()` 는 `repository.find()`(DB 재조회) 인 반면 `create`/`update` 는 `repository.save(entity)`(in-memory 값 반환, PG 는 non-generated 컬럼을 RETURNING 하지 않음) — e2e 스펙이 GET 에만 `/^\d+\.\d{4}$/` scale 정합 단언을 걸고 POST/PATCH 엔 값만 단언하는 설계가 이 비대칭과 정확히 맞는다.
- `ClassSerializerInterceptor`/`plainToInstance(AlertRuleDto...)` 저장소 전체 0건(독립 grep) — DTO 가 런타임 직렬화에 관여하지 않는다는 CHANGELOG 주장 확인.
- `codebase/frontend/src/lib/api/alerts.ts` — 읽기 `threshold: string` / 쓰기 `threshold: number` 로 이미 손수 분리돼 있음 확인.
- `codebase/backend/test/helpers/db.ts`(`createDbClient`/`uniqueEmail`/`uniqueName`) · `helpers/auth.ts`(`registerAndLogin`/`createTeamWorkspace`) — e2e 스펙이 import 하는 헬퍼 시그니처 전부 실재.
- `swagger-dto-contract-guard.ts` — `readColumnType` 이 `@Column('numeric', {...})` 포지셔널 형태와 `@Column({ type: 'numeric' })` 옵션 형태를 모두 읽음(이전 라운드 `20_39_25` W1 지적이 실제로 닫혔음을 코드로 확인). `scanNumericExposure` 가 `numericColumns`/`responseDtoClasses` 를 별도로 반환해 "스캔이 실제로 뭔가를 집었다" 는 전제를 분리 단언하는 설계도 확인.
- `plan/.../spec-draft-nullable-notation-followups.md` — 분류 표가 `46+6+4+3=59` 로 본문 "불일치 59건" 과 정확히 합치(직전 `19_43_18` W4 산술 불일치가 실제로 정정됨).
- `spec/2-navigation/9-user-profile.md:406` — `POST /api/alerts` body 의 `threshold(number, ≥0, ...)` 서술은 **쓰기 DTO**(`CreateAlertRuleDto`, 이번 diff 로 불변) 대상이라 이번 응답 DTO 변경과 충돌하지 않음.
- `spec/conventions/swagger.md` — `numeric`/`decimal` grep 0건(성문화 미완료, plan 체크리스트가 미완료로 정확히 반영 중 — 허위 done 없음).
- `spec/1-data-model.md:873` — 여전히 `threshold | Float` 로 라벨링, DB 는 `NUMERIC(12,4)`. 코드/wire 는 이제 명확히 `string` 이라 라벨 불일치가 남아 있으나 diff 범위 밖이고 planner 트랙에 이미 등재됨.
- backend jest 회귀 가드(`swagger-dto-contract.spec.ts`) 소스를 직접 읽어 대조군 3방향(잡음·`string`이면 안 잡음·`numeric` 아닌 컬럼은 안 잡음) + 위음성 6형태(정규식 4형태 + 포지셔널 2형태) + `<Entity>Dto` 명명 한계 캐너리 + `readOption` "리터럴까지 계속 훑기" 캐너리(`21_10_30` W1 조치분)가 전부 실재함을 확인.
- `_test_logs/` — `unit-20260904-212355.log`(9,338/9,339 GREEN), `lint-20260904-212255.log`, `build-20260904-212545.log` 모두 최신 커밋 이후 재실행분으로 존재. **e2e 는 리뷰 시점에 백그라운드 프로세스가 진행 중이었다** — `ps aux` 로 `make e2e-test-full` 이 활성 프로세스임을 확인했고, `_test_logs/e2e-20260904-212820.log` 는 534줄에서 최종 `Tests:`/`Test Suites:` 요약 없이 끊겨 있었다(5개 스위트만 PASS 로 나열, `alerts-threshold-wire-type.e2e-spec.ts` 는 그 시점까지 로그에 미등장). 이는 **로그가 실행 중간 스냅샷이라는 뜻이지 결함의 증거는 아니다** — `jest-e2e.json` 의 `testRegex: ".e2e-spec.ts$"` 가 `rootDir` 전체를 훑으므로 신규 파일은 명명 규칙만으로 자동 포함되고, `maxWorkers: 1`(순차 실행)이라 아직 차례가 안 왔을 뿐일 가능성이 높다. 저장소를 뮤테이션하지 않고 관찰만 했으므로 **완주 여부는 확인 못 했다는 사실 자체를 보고**한다.

## 발견사항

- **[INFO]** e2e 검증이 리뷰 시점에 미완주 상태로 관측됨 (결함 아님, 관측 사실 보고)
  - 위치: `_test_logs/e2e-20260904-212820.log` (534줄, `Tests:`/`Test Suites:` 요약 줄 없음), 신설 대상 `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts`
  - 상세: 리뷰 수행 시점에 `ps aux` 로 확인한 결과 `make e2e-test-full` 가 여전히 실행 중이었고, 로그는 `execution-park-resume`·`external-interaction`·`workspace-rbac`·`webhook-trigger`·`workflow-crud` 5개 스위트의 PASS 만 기록한 채 끊겨 있어 `alerts-threshold-wire-type.e2e-spec.ts` 자체의 PASS/FAIL 여부를 이 로그만으로는 판정할 수 없었다. `jest-e2e.json` 설정과 신규 파일명 패턴(`*.e2e-spec.ts`)을 대조하면 자동으로 스캔 대상에 포함되는 것은 확인했다 — 즉 설정 누락 같은 구조적 문제는 아니다.
  - 제안: 없음(조치 불요) — 이 발견은 순수 관측 보고다. e2e 완주 후 별도 확인이 필요하면 최신 `_test_logs/e2e-*.log` 에서 `alerts-threshold-wire-type` 를 grep 해 PASS 확정할 것.

- **[INFO]** `spec/1-data-model.md:873` 의 `threshold | Float` 라벨이 이번 정정으로 명확해진 "wire·엔티티는 string" 사실과 여전히 어긋남 — 재확인, 새 결함 아님
  - 위치: `spec/1-data-model.md:873`
  - 상세: 4개 이전 라운드(`19_43_18` INFO#6 → `20_39_25` → `21_10_30` INFO#1)에 걸쳐 반복 확인된 사항으로, diff 범위 밖(파일 미변경)이고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 트랙 항목으로 정확히 등재돼 있다(중복 등재 아님, 미완료 상태 정확).
  - 제안: 조치 불요 — planner 트랙에서 처리 (spec 직접 수정은 이 reviewer 권한 밖).

## 그 외 확인된 사항 (결함 아님)

- TODO/FIXME/HACK/XXX 없음 — 6개 대상 파일 전수 확인.
- `AlertRuleDto.threshold` 타입 변경은 엔티티·DB 컬럼(`NUMERIC(12,4)`)·서비스 저장 로직(create/update 양쪽 `String(...)`)·프런트엔드 기존 소비 패턴·CHANGELOG 서술 전부와 line-level 로 정합. 런타임 wire 불변(`ClassSerializerInterceptor` 부재 확인).
- `findNumericAsNumber` 가드는 이전 4라운드가 지적한 위음성 6형태(정규식 시절 3형태 + AST 초판 누락 4형태 중 포지셔널 인자 2형태 재분류) 전부를 대조군으로 고정했고, `<Entity>Dto` 명명 관례 한계도 음성 대조군으로 문서화·고정돼 있다. 현재 저장소에 이 한계로 인한 실질 갭 없음(`StatisticsResponseDto` 는 서비스가 이미 `Number(...)` 명시 변환).
- 쓰기 DTO(`CreateAlertRuleDto`/`UpdateAlertRuleDto`, `threshold: number`)는 이번 diff 대상이 아니며 읽기/쓰기 비대칭이 의도적으로 유지됨 — spec §6.3(`9-user-profile.md:406`) 서술과 계속 일치.
- `plan/.../spec-draft-nullable-notation-followups.md` 의 산술 불일치(59 vs 57)는 `19_43_18` RESOLUTION 에서 실제로 재측정·정정됐고(46+6+4+3=59), 이번 diff 의 최종 상태가 그 정정을 반영하고 있음을 재확인.
- CHANGELOG 의 "영향" 문단(codegen 클라이언트 고지)과 "list·create·update 세 응답 모두" 서술은 초기 라운드(`19_43_18`)가 지적한 두 WARNING 을 모두 반영한 상태로 최종 diff 에 이미 포함돼 있다.

## 요약

핵심 코드 변경(`AlertRuleDto.threshold: number → string` + `findNumericAsNumber` 회귀 가드 + e2e 계약 테스트)은 엔티티·DB 컬럼·서비스 저장 로직(create/update 비대칭 처리 포함)·프런트엔드 기존 소비 패턴·CHANGELOG·plan 문서 전부와 line-level 로 재검증해 정합함을 확인했다. 5라운드에 걸쳐 누적 지적된 WARNING(회귀 테스트 부재·영향범위 축소 서술·codegen 고지 누락·plan 산술 불일치·정규식/AST 위음성 6형태·경로 정규화·명명 한계·리터럴-훑기 캐너리 부재)이 전부 코드·문서 양쪽에서 실제로 닫혔음을 독립 재확인했다. 신규 발견은 기능 결함이 아니라 리뷰 시점 관측 사실(e2e 전체 실행이 백그라운드에서 진행 중이라 신규 e2e 스펙의 PASS 를 이 로그만으로 확정 못 함) 하나이며, 이는 구조적 설정 누락이 아니라 타이밍 문제로 판단된다. `spec/1-data-model.md:873` 의 `Float` 라벨 불일치는 기존에 정확히 planner 트랙 등재된 이슈로 새 결함이 아니다. spec fidelity 관점에서 요청 DTO(§6.3, `spec/2-navigation/9-user-profile.md:406`)와 응답 DTO 사이 충돌 없음을 확인했다.

## 위험도

LOW
