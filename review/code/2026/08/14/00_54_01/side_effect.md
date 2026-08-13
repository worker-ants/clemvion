# 부작용(Side Effect) 리뷰 결과

## 사전 확인

이 diff(`origin/main...HEAD`)는 `codebase/backend` 10개 파일(신규 유틸 1 + spec 4 + 소비 지점 3
+ 신규 e2e 1) 로 구성된 `UPDATE`/`DELETE … RETURNING` 튜플 shape 오인 버그 수정이며, 나머지는
plan 문서·`review/**` 산출물(과거 리뷰·RESOLUTION)이다. 이번 세션은 이미 5라운드
(`20_36_35`→`23_46_00`→`00_00_44`)를 거쳐 CRITICAL 이 전부 조치된 누적 diff이므로, 새 부작용이
있는지와 함께 기존에 발견된 "의도된 동작 변화"가 부작용 관점에서 올바르게 인지·기록됐는지를
확인했다. `git diff --stat origin/main...HEAD -- codebase` 로 실제 변경 파일 10개를 실측 대조했다.

## 발견사항

- **[INFO]** 이 PR 의 실질 내용은 "이벤트/콜백" 관점에서 의도적이지만 광범위한 동작 재활성화다 —
  프로덕션에서 ~2개월간(`1657c0435` 2026-06-14 ~ `8332d9a20` 2026-08-13) 죽어 있던 분기가 배포
  즉시 다시 살아난다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `admitExecutionOrDefer`(`admitted` 판정부 약 2913~2949행, 소비부 2950~2961행 —
    `recordRunningSegmentStart`·`ExecutionEventType.EXECUTION_STARTED` emit) 및
    `updateExecutionStatus`(`persisted` 판정부 약 8507~8550행, 8552행
    `recordRunningSegmentStart` 재호출·이후 `emitTerminalExecutionMetrics(..., persisted)`
    분기). `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 의 CAS 락
    2곳(346행 `KB_REEXTRACT_IN_PROGRESS`, 729행 `KB_REEMBED_IN_PROGRESS` — 둘 다 HTTP 409)과
    "빈 KB 즉시 idle 복귀" 분기(751행 `resetRows.length === 0`).
  - 상세: 수정 전에는 `rows.length`/`acquired.length`/`updated.length` 가 항상
    `[rows, rowCount]` 튜플의 길이(2)를 봤기 때문에, admission cap 거절·동시 cancel 선점·KB CAS
    락 거절·빈 KB idle 복귀 분기가 **한 번도 실행되지 않았다**. 이번 수정으로 이 5개 분기가
    배포 즉시 실제로 타기 시작한다 — 매 admission 의 2초 지연 소멸, workspace/workflow cap 이
    실제로 실행을 defer, 동시 재추출/재임베딩 요청에 대한 409 응답, 빈 KB 의 정상 idle 복귀.
    이 자체는 이번 diff 의 의도된 목적(버그 수정)이고, `plan/in-progress/exec-intake-followups.md`·
    `plan/in-progress/update-returning-tuple-shape.md` §후속에 "배포 후 관측" 항목으로 이미
    등재돼 있어 은폐되지 않았다. 다만 side-effect 체크리스트의 "이벤트/콜백 발생 변경" 항목에
    정확히 해당하므로, 배포 담당자가 이 목록을 미리 인지하고 있어야 함을 명시적으로 남긴다.
  - 제안: 조치 불요(이미 plan 에 관측 계획 등재됨). 배포 직후 위 5개 분기의 실제 발동 로그를
    확인하는 짧은 모니터링 윈도우를 두는 것을 권장(이미 plan 서술과 일치).

- **[INFO]** 공개 API 응답 필드 `graphRequeued`/`embeddingRequeued` 의 값 의미가 이번 수정으로
  실질적으로 바뀐다 — "인터페이스 변경이 기존 사용자에 미치는 영향" 관점에서 기록.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:523`
    (`requeueFailedDocuments` 반환 타입 `{ embeddingRequeued: number; graphRequeued: number }`),
    `:557`(`embeddingRequeued = enqueued`), `:582`(`graphRequeued = rowsOut.length`) —
    소비처는 `codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts:260-265`.
  - 상세: 수정 전에는 `rows`/(암묵적) 원본이 튜플이라 `rows.map(r => r.id)` 가
    `[undefined, undefined]` 를 만들어 **가짜 job 2개가 큐잉**됐고(주석 543행 부근에 명시),
    `graphRequeued = rows.length` 는 항상 2(고정값)에 가까웠다(이후 실패분 차감). 즉 이 API
    필드는 실제 재큐 문서 수와 무관한 값을 반환해 왔다. 수정 후에는 `rowsOut.length` 로 실제
    RETURNING 행 수를 정확히 반영한다 — 이 필드를 소비하는 프론트엔드/대시보드/로그 파서가
    "항상 작은 고정값" 이라는 이전의 (버그였던) 값 범위를 암묵적으로 가정하고 있었다면 그
    가정이 깨진다. 새 값이 정답이므로 이 자체는 결함이 아니라 수정이 의도한 결과다.
  - 제안: 조치 불요. 다만 이 필드를 프론트엔드가 소비하는 곳이 있다면(재큐 완료 토스트 메시지
    등) 배포 후 표시되는 숫자가 커질 수 있음을 릴리스 노트/CHANGELOG 에 한 줄 남겨두면
    사용자 혼란을 줄일 수 있다(`RESOLUTION.md` 는 CHANGELOG 항목을 "배포 영향 서술과 함께" 넘긴
    상태라 이 관찰이 그 판단에 참고될 수 있다).

- **[INFO]** 신규 헬퍼 `updateReturningRows` 자체는 순수 함수이고 전역 상태·파일시스템·환경변수·
  네트워크에 부작용이 없음을 확인.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` 전체(1~57행).
  - 상세: 인자로 받은 `result` 를 검사해 값을 반환하거나 `Error` 를 throw할 뿐, 모듈 스코프에
    새 전역/공유 변수를 만들지 않는다. 세 소비 지점(`execution-engine.service.ts`,
    `knowledge-base.service.ts`, `auth-oauth.service.ts`) 모두 기존 함수의 시그니처(인자·반환
    타입)는 그대로 유지하고 함수 **본문의 shape 해석 로직**만 교체했다 — 외부 호출자(컨트롤러,
    큐 워커, 다른 서비스)가 이들 메서드를 호출하는 방식은 변경되지 않는다.

- **[INFO]** `auth-oauth.service.ts` 의 `handleCallback` 반환값 `rememberMe` 필드가 이제 실제
  DB 값을 반영하지만, 클라이언트에 노출되는 JSON payload 는 없다 — 인터페이스 파급 범위가
  제한적임을 확인.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` (신규 `AuthOAuthStateRow`
    인터페이스, `rememberMe` 계산부·반환부 — diff `@@ -154,16 +187,19 @@` 구간),
    소비처 `codebase/backend/src/modules/auth/auth.controller.ts:580-593`
    (`this.authOauthService.handleCallback(...)` → `setRefreshTokenCookie(res, ...,
    { rememberMe: result.rememberMe })`).
  - 상세: 이전에는 `record.rememberMe`(항상 `undefined`, falsy)로 인해 refresh 쿠키 Max-Age 가
    항상 7일로 고정됐다. 수정 후에는 실제 `remember_me` 값에 따라 30일/7일로 갈린다. 이 값은
    HTTP 응답 바디로 직렬화되지 않고 `Set-Cookie` 헤더의 `Max-Age` 산정에만 쓰이므로, API 계약
    (JSON 스키마) 변경은 없다 — 다만 **관측 가능한 클라이언트 동작**(로그인 유지 체크박스가
    이제 실제로 작동)이 바뀐다는 점은 위 admission/CAS 항목과 같은 성격의 "의도된 재활성화"다.
  - 제안: 조치 불요(security.md·RESOLUTION 에 이미 동일 취지로 기록됨).

- **[INFO]** 신규 e2e(`codebase/backend/test/auth-oauth-callback.e2e-spec.ts`)는 고정 컨테이너
  주소(`E2E_BASE_URL` 기본값 `http://backend-e2e:3011`)로 실제 HTTP 호출 + `auth_oauth_state`
  테이블에 직접 INSERT 하는 방식이라 "네트워크 호출"·"파일시스템/DB 부작용" 항목에 해당하지만,
  이 저장소의 기존 e2e 스위트가 쓰는 동일한 헬퍼(`./helpers/db` `createDbClient`)와 컨벤션을
  그대로 따른다 — 새로운 외부 서비스 호출 패턴이나 신규 인프라 의존성이 아니다. OAuth 콜백은
  `code: 'stub-code'` 로 스텁 모드를 전제하므로 실제 Google/GitHub 같은 외부 서드파티에 대한
  네트워크 호출도 없다.

## 요약

이번 diff 는 신규 유틸 `updateReturningRows` 를 통해 TypeORM 이 `UPDATE`/`DELETE …
RETURNING` 에서 돌려주는 실제 shape(`[rows, rowCount]` 튜플)을 8개 소비 지점에서 올바르게
처리하도록 고치는 버그 수정으로, 새 전역 변수·환경변수 읽기/쓰기·파일시스템 부작용·신규 외부
네트워크 호출·기존 함수 시그니처 파괴적 변경은 발견되지 않았다. 다만 이 수정의 본질 자체가
"부작용" 체크리스트의 이벤트/콜백·인터페이스 항목에 정면으로 해당한다 — 프로덕션에서 오랫동안
죽어 있던 admission cap 거절, 동시 cancel 종결 이벤트, KB CAS 락 409 거절, 빈 KB idle 복귀,
그리고 API 응답 필드 `graphRequeued`/`embeddingRequeued` 의 정확한 값이 배포와 동시에 전부
"처음으로" 실제 발동한다. 이는 은폐된 부작용이 아니라 이번 PR 이 의도적으로 고치는 대상 자체이며,
plan 문서(`update-returning-tuple-shape.md`, `exec-intake-followups.md`,
`ie-resume-turn-boundary-cancel.md`, `retry-turn-terminal-guard.md`)에 "배포 후 관측" 항목으로
명시적으로 등재돼 있어 추적 가능하다. 새로 도입되는 부작용 표면은 확인되지 않았다.

## 위험도

LOW
