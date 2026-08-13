# 부작용(Side Effect) 리뷰 결과

## 발견사항

- **[INFO]** 배포 후 프로덕션 이벤트·메트릭 발동 패턴이 실질적으로 바뀐다 — 의도된 부작용이며 plan 에 이미 추적돼 있음.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2950-2961`(`admitExecutionOrDefer` — `if (admitted)` 블록의 `recordRunningSegmentStart`·`EXECUTION_STARTED` emit), `:8545-8556`(`updateExecutionStatus` — `persisted` 가 `emitTerminalExecutionMetrics` 게이트), `:8565-8577`(`emitTerminalExecutionMetrics` 의 `if (!persisted) return;`)
  - 상세: `updateReturningRows` 도입 전에는 `admitted`(admission gate)·`persisted`(종결 이벤트 게이트) 두 값이 튜플 shape 버그로 **항상 고정값**(`admitted` 는 사실상 항상 실패, `persisted` 는 항상 `true`)이었다. 그 결과 admission gate 의 `recordRunningSegmentStart`/`EXECUTION_STARTED` emit 블록은 4개월간 프로덕션에서 한 번도 타지 않았고(대신 "stalled 재배달" 폴백 경로가 같은 부기를 대신 처리), `emitTerminalExecutionMetrics` 는 동시 cancel 레이스에서 실제로 쓰기가 적용되지 않은 경우에도 항상 발화했다. 이번 수정으로 두 값이 실제 DB 쓰기 결과를 반영하게 되므로, 배포 직후 이벤트 발화 시점·빈도, `clemvion.execution.total`/`clemvion.execution.errors` 메트릭 카운트가 관측 가능하게 달라진다(과거는 undercounted/mistimed 였던 것이 정확해지는 방향). 이는 이 PR 의 의도된 핵심 결과이고 이중 발화(admission-gate 경로와 기존 "stalled 재배달" 폴백 경로가 같은 실행에 대해 동시에 `recordRunningSegmentStart`/`EXECUTION_STARTED` 를 중복 호출할 가능성)를 코드 흐름으로 확인했으나 발견되지 않았다 — `runExecutionFromQueue` 의 RUNNING 분기(재배달)와 admission-gate 분기(PENDING)는 `execution.status` 로 상호 배타적이다. `plan/in-progress/update-returning-tuple-shape.md:201-207` §후속에 "배포 후 관측" 항목((a)~(e))으로 이미 명시 등재돼 있다.
  - 제안: 조치 불요 — 이미 plan 에 배포 관측 항목으로 등재됨. 배포 시점에 대시보드·이벤트 볼륨 변화를 운영팀에 공유하는 절차만 확인.

- **[INFO]** KB 재추출/재임베딩 CAS 락의 409 거절 분기와, 실패 문서 재큐의 실제 `documentId` 전달이 이번에 처음으로 "라이브"가 된다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` `reExtractAll`(약 343-350행, `updateReturningRows(...).length === 0` → `KB_REEXTRACT_IN_PROGRESS` 409), `reEmbedAll`(약 730-737행, `KB_REEMBED_IN_PROGRESS` 409, 및 745-753행 `resetRows` 0건 idle 복귀 분기), `retryFailedDocuments` embedding 분기(약 539-548행, `rowsOut.map((r) => r.id)`)
  - 상세: 튜플 버그로 인해 두 CAS 락(`reExtractAll`/`reEmbedAll`)의 `acquired.length === 0` 판정이 항상 거짓이었으므로 동시 재추출/재임베딩 요청을 한 번도 거절하지 못했다(중복 실행 허용). 또한 `retryFailedDocuments` 의 embedding 재큐는 `rows.map(r => r.id)` 를 튜플에 바로 적용해 `[undefined, undefined]` 를 큐에 넣어 왔다(실제 문서가 아니라 매번 고정된 "가짜 job 2개"). 이번 수정으로 클라이언트는 동시 재추출/재임베딩 요청 시 처음으로 409 `ConflictException` 을 받을 수 있고, embedding 재큐는 이제 실제 대상 문서 ID 로 job 을 적재해 큐 볼륨·워커 처리량이 실질적으로 달라진다. 둘 다 `plan/in-progress/update-returning-tuple-shape.md:200`(CHANGELOG 서술 항목: "재큐 documentId: undefined")·`:206`(§후속 관측 (d) "KB 재추출/재임베딩 동시 요청이 처음으로 409 거부")에 명시 추적돼 있다.
  - 제안: 조치 불요 — 문서화·추적 완료. 짧은 간격으로 재추출/재임베딩을 재시도하는 기존 클라이언트가 있다면 배포 노트 공유를 plan 체크리스트대로 진행할 것.

- **[INFO]** 신규 헬퍼 `updateReturningRows` 자체는 순수 함수이며 부작용 없음 — 확인 완료.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts:36-57`
  - 상세: 전역 변수·모듈 레벨 상태 도입 없음, 환경 변수 읽기/쓰기 없음, 파일시스템·네트워크 호출 없음(grep 으로 diff 전체에서 `process.env`/`globalThis`/`fs.`/`fetch`/`axios`/`http.request` 미검출). 던지는 예외 타입도 자매 헬퍼 `assertRowArray`(`codebase/backend/src/common/utils/assert-row-array.ts:17-21`)와 동일하게 plain `Error`(NestJS `HttpException` 아님)라 호출부의 에러 핸들링 계약이 바뀌지 않는다. 새로 export 된 함수라 기존 시그니처를 깨는 변경은 없다(순수 추가).
  - 제안: 없음.

- **[INFO]** 커밋된 리뷰 산출물(`_retry_state.json`, `meta.json` 등)에 로컬 워크트리 절대경로(`/Volumes/project/private/clemvion/...`)가 그대로 기록돼 있다.
  - 위치: `review/code/2026/08/13/20_36_35/_retry_state.json`(및 동형의 `22_45_24`/`23_07_11`/`23_46_00`, `review/consistency/2026/08/13/20_36_36/_retry_state.json`) — `session_dir`/`prompt_file`/`output_file` 필드
  - 상세: harness 재시도 상태 매니페스트가 세션 디렉터리의 절대경로(로컬 사용자명·머신 디렉터리 구조 포함)를 담은 채 커밋된다. 시크릿은 아니지만 로컬 환경 정보가 저장소 히스토리에 영구히 남는다. 이 저장소의 기존 관행(`code-review-agents`/`consistency-checker` SKILL 이 세션 산출물 커밋을 표준으로 규정)과 일치하는 것으로 판단되며, 이번 diff 가 새로 도입한 패턴이 아니라 기존에도 반복돼 온 것이라 신규 결함으로 보지 않는다.
  - 제안: 조치 불요(기존 저장소 관행). 향후 이 매니페스트 스키마를 바꿀 기회가 있다면 상대경로화를 고려할 수 있으나 이번 PR 범위 밖.

## 요약

핵심 코드 변경(`updateReturningRows` 신규 헬퍼 + `auth-oauth`/`execution-engine`/`knowledge-base` 8개 소비 지점 교체)은 TypeORM `UPDATE`/`DELETE … RETURNING` 튜플 오인 버그를 고치는 순수한 버그 수정이다. 헬퍼 자체는 전역 상태·환경 변수·파일시스템·네트워크에 관여하지 않는 순수 함수이고, 기존 함수 시그니처를 깨는 변경도 없다. 다만 이 버그 수정의 본질적 결과로 그동안 프로덕션에서 사문화돼 있던 이벤트/메트릭 발동(`EXECUTION_STARTED`, `recordRunningSegmentStart`, `emitTerminalExecutionMetrics`)과 KB CAS 락 409 거절·재큐 `documentId` 정상화가 배포 직후 "처음으로 라이브"가 된다 — 이는 의도된 핵심 효과이며 이중 발화 위험도 코드 흐름상 확인되지 않았고, `plan/in-progress/update-returning-tuple-shape.md` §후속에 배포 관측 항목으로 이미 명시 추적돼 있어 새로운 미인지 부작용은 아니다. CRITICAL/WARNING 급 의도치 않은 부작용은 발견되지 않았다.

## 위험도

LOW
