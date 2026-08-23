### 발견사항

이번 diff(`masking-gate-consolidation`, `origin/main...HEAD`)는 `codebase/backend/src/modules/executions/executions.service.ts` · `.../background-runs/background-runs.service.ts` 의 마스킹 호출부 4곳을 신규 `codebase/backend/src/shared/utils/redact-stored-error.ts` 의 헬퍼 2개(`redactStoredFieldsForResponse` · `redactNodeExecutionRow`)로 흡수한 **순수 내부 리팩터**이며, `spec/conventions/egress-masking.md §3` 의 자기-예고("표 2·5행이 낡는다")를 실측으로 정정한 문서 변경 하나를 동반한다. 아래는 6개 관점 각각의 판정이다.

- **[INFO]** developer 가 `spec/conventions/egress-masking.md §3` 을 직접 편집(권한 경계 이슈)
  - target 위치: (target=`spec/5-system/`) 이 아니라 diff 상 `spec/conventions/egress-masking.md` 정정
  - 충돌 대상: CLAUDE.md 권한표 — `developer` 는 `spec/` read-only, spec 변경 필요 시 `project-planner` 위임 의무
  - 상세: 이 편집은 자신이 남긴 예고("그 항목 착수 시 표를 동반 갱신")를 같은 작업자가 실측으로 반증·정정한 것으로, 내용은 이미 5개 consistency checker + 9개 code reviewer(2라운드 포함)가 타당 판정했고 코드-스펙 모순은 없다. 다만 `--spec` 게이트를 거치지 않아 절차상 예외 소지가 있다.
  - 제안: 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 신규 planner 항목(*"developer 의 자기-예측 반증형 spec 소정정 — 권한 경계를 정한다"*)으로 등재돼 있으므로 별도 조치 불요 — cross-spec 내용 충돌은 아니고 프로세스 결정 대기 항목임을 확인만 한다.

다른 5개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC)에서는 충돌을 찾지 못했다. 근거:

- **데이터 모델**: `Execution`/`NodeExecution` 엔티티 필드·타입 변경 없음. `redactStoredFieldsForResponse` 반환 shape(`{inputData, outputData, error}`, 부재는 `null`)과 `redactNodeExecutionRow` 반환 shape(입력과 동일 shape, 부재 보존) 모두 리팩터 이전과 동일 — `spec/1-data-model.md §2.14`("`Execution.error` 는 최초 failed `NodeExecution` 에러의 복사")와 모순 없음.
- **API 계약**: 응답 필드·타입·null 처리 정책 무변경(코드 diff 확인). `spec/5-system/14-external-interaction-api.md` §R17 의 "적용 범위는 총칭이 아니라 열거다 — 표면 여섯" 목록(①`findById` ②`getChain` ③`stop` ④`toExecutionDto` ⑤`nodeExecutions[]` ⑥`BackgroundRunsService.toNodeExecutionDto`)과 코드의 `toResponseExecution` JSDoc "읽기 표면 목록" 표(같은 6행, 5행만 `redactNodeExecutionRow` 로 갱신)가 정확히 일치함을 grep 으로 실측 확인(`toResponseExecution` 호출부 = `findById`/`getChain 경로`/`stop`, `toExecutionDto` 는 별도 1곳).
- **요구사항 ID**: 신규 ID 부여 없음. 기존 EIA §R17 잔여 갭 서술("`redactStoredErrorForResponse`/`redactStoredDataForResponse` 는 `shared/utils/redact-stored-error.ts`")은 심볼명·파일 경로가 리팩터 후에도 그대로 export 돼 있어(내부 구현으로 유지, `redactStoredFieldsForResponse`/`redactNodeExecutionRow` 가 그 위에 얹힘) spec 인용이 stale 화되지 않았다.
- **상태 전이**: 대상 없음(마스킹은 응답 egress 단계, 상태 머신과 무관).
- **RBAC**: `@Roles` 게이트·워크스페이스 스코핑 변경 없음. §R17 이 근거로 드는 "viewer 포함 전원 조회 가능이므로 마스킹 필요" 전제도 무변경.

- **layer 책임(관점 6) 판정**: `redact-stored-error.ts` 를 `codebase/backend/src/shared/utils/` (기존 `sanitize-error-message.ts`·`strip-external-only-fields.ts` 와 동일 위치)에 둔 것은 이 마스킹이 REST 응답 조립에만 쓰이고 프런트와 공유할 필요가 없다는 기존 결정과 일치한다 — `codebase/packages/masked-markers`(프런트·백엔드 공유 마커 *값* 계약, PR #1190/#1191) 로 승격해야 할 대상이 아니다. `egress-masking.md` 의 `code:` frontmatter 에는 `redact-stored-error.ts` 가 여전히 없으나, 이는 이 PR 이 만든 갭이 아니라 `origin/main` 부터 있던 상태(확인함)이고 문서 §1 표가 "마스커(함수) 좌표계"만 다루도록 스스로 스코프를 좁혀 뒀으므로(§3 정정문) 불일치로 보지 않는다.

### 요약
diff 는 4개 호출부의 마스킹 로직을 헬퍼 2개로 흡수하는 순수 리팩터이고, spec 정정(`egress-masking.md §3`)은 이미 반증된 자기-예고를 바로잡은 것으로 spec 내부·코드 양쪽과 모두 일치함을 실측(grep/diff)으로 확인했다. `spec/5-system/14-external-interaction-api.md §R17` 의 "표면 여섯" 열거·심볼명·파일 경로는 리팩터 후에도 문자 그대로 유효해 spec-code 어긋남이 없다. 유일한 이슈는 데이터/API/RBAC 충돌이 아니라 **developer 의 spec 편집 권한 경계** 프로세스 문제이며, 이는 이미 정본 트래커에 planner 결정 대기 항목으로 등재돼 있어 이 검토 시점에 새로 열 필요가 없다.

### 위험도
NONE
