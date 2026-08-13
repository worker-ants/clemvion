# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 이번 diff 는 지금까지 **사실상 죽어 있던 프로덕션 분기(이벤트 발행·메트릭 기록·409 거절·복구 UPDATE)를 실제로 살려낸다** — 배포 즉시 관측 가능한 부작용의 blast radius 가 크다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `admitExecutionOrDefer`(`if (admitted)` 블록의 `recordRunningSegmentStart` + `EXECUTION_STARTED` emit) 및 `updateExecutionStatus`(`persisted` 가 `enteringRunning && persisted` → `recordRunningSegmentStart`, `emitTerminalExecutionMetrics(execution, newStatus, persisted)` 를 가름). `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 의 `reExtractAll`/`reEmbedAll` CAS 락(`ConflictException` 409)과 `reEmbedAll` 의 `resetRows.length === 0` 분기(빈 KB 즉시 idle 복귀용 추가 `UPDATE`).
  - 상세: `UPDATE … RETURNING` 이 `[rows, rowCount]` 튜플로 오는 것을 행 배열로 오인해 위 네 갈래가 프로덕션에서 한 번도 발동한 적이 없었다. `updateReturningRows` 로 튜플을 올바르게 언랩하면서 배포 직후부터 실제로 실행되기 시작한다 — (a) `EXECUTION_STARTED` 를 구독하는 하류 리스너가 처음 이벤트를 받고, (b) admission 의 2초 재큐 지연이 사라지며, (c) 동시 재추출/재임베딩 요청이 처음 409 를 받고, (d) 실패율/메트릭 대시보드가 실제 증가 없이 급변할 수 있다.
  - 확인: 새로 발견한 미문서화 결함이 아니다 — `CHANGELOG.md`(Unreleased 항목 + 기존 항목 1·5·6·7 소급 정정), `plan/in-progress/update-returning-tuple-shape.md` §후속(배포 후 관측 (a)~(e) 5항목, e2e 로 (a) 는 이미 실측 4191→2242ms), `exec-intake-followups.md`·`ie-resume-turn-boundary-cancel.md`·`retry-turn-terminal-guard.md` 소급 배너에 모두 "관측 필요" 로 명시 등재되어 있다. 직전 라운드(`01_44_03` side_effect WARNING)에서 이미 같은 항목으로 지적됐고 그 이후 diff(디렉토리 정리·mock 정합)는 이 결론에 영향을 주지 않는다.
  - 제안: 조치 불요(이미 plan 에 관측 항목으로 등재) — 배포 시점에 위 4갈래를 한 체크리스트로 묶어 롤아웃 직후 모니터링할 것을 권장(이미 계획된 바와 일치).

- **[INFO]** 직전 라운드(`01_44_03` maintainability W2)가 지적한 `tsconfig.build.json` 의 `**/__testing__/**` exclude 항목은 이번 라운드에서 완전히 되돌려졌다 — `source-scan.ts`/`source-scan.spec.ts` 를 기존 `common/__test-utils__/`(자매 `workspace-id-fixtures.ts` 와 동일 디렉토리)로 옮기고 exclude 를 제거해 `codebase/backend/tsconfig.build.json` 이 `origin/main` 대비 **순 변경 0**(`git diff origin/main -- codebase/backend/tsconfig.build.json` 무출력)으로 수렴했다. `dist/common/__test-utils__/source-scan.js` 생성도 확인돼 자매 헬퍼와 동일하게 build 에 실린다 — 새로운 빌드/배포 표면 변경 없음.
  - 위치: `codebase/backend/tsconfig.build.json`, `codebase/backend/src/common/__test-utils__/source-scan.ts`
  - 상세: 참고용 INFO — 조치 불요.

- **[INFO]** `execution-engine.service.spec.ts` 의 0행 admission mock 이 bare `[]` 에서 실 드라이버 shape `[[], 0]` 로 정정됨(마지막 커밋). `updateReturningRows` 를 거치면 두 형태 모두 length 0 이라 테스트 결론 자체는 바뀌지 않으며, 프로덕션 코드·인터페이스에 영향 없는 test-only 변경이다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`(`ExecutionStatus.CANCELLED` 분기 mock)

- 그 외 확인 사항: 전역 변수 도입·환경 변수 신규 read/write·의도치 않은 파일시스템 쓰기·기존 공개 함수 시그니처 변경(신규 `updateReturningRows`/`countCalls` 는 모두 신설 함수이며 기존 호출자를 깨지 않음)·신규 외부 네트워크 호출은 발견되지 않았다. `execution-engine.service.ts` 의 `assertRowArray` import 는 세 번째 SELECT 지점(`lockNonTerminalExecutionRow`, `:8223`)에서 여전히 사용되어 dead import 가 아니다. 신규 e2e(`auth-oauth-callback.e2e-spec.ts`)의 토큰 교환은 기존 `isOAuthStubModeAllowed()` 스텁 게이팅(이번 diff 로 변경되지 않음)으로 실제 Google/GitHub 네트워크 호출 없이 동작함을 확인했다. `updateReturningRows` 가 비-배열 입력에 평문 `Error` 를 던지는 것은 자매 헬퍼 `assertRowArray` 와 동일한 기존 관용구다.

## 요약

이번 변경의 핵심 부작용은 "버그 수정 자체가 부작용" 이라는 역설적 성격이다 — TypeORM 튜플 shape 오인으로 침묵 상태였던 이벤트 발행·메트릭 기록·KB CAS 락 409·admission 2초 지연 소멸 등 네 갈래가 배포 직후부터 실제로 발동하기 시작한다. 이는 CHANGELOG·복수 plan 문서에 이미 "배포 후 관측" 항목으로 명시 기록돼 있어 미문서화된 위험은 아니지만 blast radius 가 커 가시성 확보 차원에서 WARNING 을 유지한다(직전 라운드와 동일 결론, 그 이후 diff 는 새로운 side effect 를 추가하지 않았다). 직전 라운드가 지적한 tsconfig exclude 부작용은 이번 라운드에서 순 변경 0 으로 완전히 해소됐다. 그 외 전역 상태·환경변수·파일시스템·네트워크·기존 시그니처 측면에서 신규 미검토 부작용은 없다.

## 위험도

MEDIUM
