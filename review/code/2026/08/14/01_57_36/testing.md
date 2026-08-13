# 테스트(Testing) 리뷰

## 검증 방법

프롬프트가 크기 제한으로 여러 파일 diff 를 생략해, 다음을 `git diff origin/main...HEAD -- <path>` 로
직접 열어 전체 내용을 대조했다: `update-returning-rows.{ts,spec.ts}`, `assert-row-array.{ts,spec.ts}`,
`source-scan.{ts,spec.ts}`, `auth-oauth.service.{ts,spec.ts}`, `execution-engine.service.{ts,spec.ts}`
(관련 hunk), `knowledge-base.service.{ts,spec.ts}`, `auth-oauth-callback.e2e-spec.ts`,
`plan/in-progress/update-returning-tuple-shape.md`. 이 PR 은 이미 8차례 이상의 `/ai-review`·
`consistency-check` 라운드(`20_36_35`~`01_44_03`, `00_00_45` 등)를 거쳤고, 최신 커밋
(`6416d5bb9`)은 그 마지막 라운드(`01_44_03` maintainability W2, consistency `01_44_04` INFO 6)의
잔여 지적 2건을 조치한 것이다. 이번 라운드는 그 조치가 실제로 반영됐는지와 새 회귀가 없는지를
직접 실행·재계산으로 확인하는 데 집중했다.

- `npx jest` 로 직접 재실행 — `source-scan.spec.ts`+`assert-row-array.spec.ts`+
  `update-returning-rows.spec.ts`+`auth-oauth.service.spec.ts`: **4 suites / 41 tests passed**.
  `knowledge-base.service.spec.ts`+`execution-engine.service.spec.ts`: **2 suites / 505 tests
  passed** (일부 예상된 stderr 에러 로그는 음성 경로 테스트가 의도적으로 유발한 것).
- `npx tsc --noEmit -p tsconfig.json` 전체 재실행 — **199 errors** (repo 가 문서화한 ratchet
  baseline `199/38` 과 정확히 일치). 이 PR 이 건드린 8개 파일(`update-returning-rows.*`,
  `assert-row-array.*`, `source-scan.*`, `auth-oauth.service.*`, `execution-engine.service.*`,
  `knowledge-base.service.*`, `auth-oauth-callback.e2e-spec.ts`)은 에러 목록에 **0건** —
  신규 타입 에러 유입 없음을 직접 확인.
- 구조적 회귀 가드 fixture 를 실제 소스에 대해 손으로 재계산: `assert-row-array.spec.ts`
  `guards: 1`(execution-engine)·`guards: 1`(executions.service), `update-returning-rows.spec.ts`
  `EXPECTED = [2, 5, 1]`(execution-engine/knowledge-base/auth-oauth) — grep 결과와 일치, 드리프트 없음.
  두 가드를 합치면 raw consuming query 3+1(SELECT: `assertRowArray`) + 2+5+1(UPDATE/DELETE:
  `updateReturningRows`) = 실제 raw 소비 지점 전수를 상호보완적으로 커버한다(설계 의도대로).
- `common/__test-utils__/` 로의 디렉토리 통합(`6416d5bb9`)이 `assert-row-array.spec.ts`·
  `update-returning-rows.spec.ts` 의 import 경로(`'../__test-utils__/source-scan'`)와
  `source-scan.spec.ts` 자신의 import(`'./source-scan'`)에 정확히 반영됐는지 확인 — 일치.
  `tsconfig.build.json` 에 `__testing__` 잔여 exclude 없음, `common/__test-utils__/` 형제 파일
  (`workspace-id-fixtures.ts`)과 동일 컨벤션(순수 함수만, jest 타입 비의존) 유지 확인.

## 발견사항

- **[INFO]** (carried forward, `01_12_26`/`01_44_03` 판단 유지) `auth-oauth.service.spec.ts` 의
  `handleCallback` describe 블록에서 실측 shape(`[[row], count]` 튜플)을 mock 하는 테스트는 3건
  (`실측 shape([rows,count])로도 정상 콜백이 성공해야 한다`, `실측 shape 에서 0행…`,
  `propagates rememberMe through to token issuance`)뿐이고, 나머지 7건(`throws OAUTH_STATE_MISMATCH
  when state is missing` 등)은 여전히 이 PR 이 "4개월간 결함을 숨긴 원흉"으로 지목한 행-배열 직접
  shape(`[validState]`)을 그대로 mock 한다.
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.spec.ts` `describe('handleCallback')`
    블록 (`dataSource.query.mockResolvedValueOnce([...])` 형태, 튜플로 감싸지 않은 7곳)
  - 상세: `updateReturningRows` 가 튜플/행-배열 두 shape 를 의도적으로 모두 받아들이므로
    기능적으로는 안전하고, 헬퍼 전용 스펙과 실 드라이버 e2e(`auth-oauth-callback.e2e-spec.ts`)가
    튜플 unwrap 자체는 이미 충분히 잠그고 있다. 다만 이 파일의 다수 테스트(신규 user 생성·기존
    유저 연결·동시 unique-violation 복구 등 `handleCallback` 핵심 분기 대부분)는 계속 "틀린 현실"
    위에서만 검증되므로, 향후 이 서비스에 튜플 unwrap 과 상호작용하는 새 필드/분기가 추가돼도
    다수결 쪽 테스트는 그 축을 건드리지 않아 조용히 통과할 여지가 남는다. 이 관찰은 `01_12_26`
    testing INFO·`01_44_03` testing INFO 가 이미 반복 확인했고, plan(`update-returning-tuple-shape.md`
    §후속 "구조적 가드가 '이 3개 파일' 하드코딩이다")이 `DataSource`/`EntityManager` 래퍼 도입을
    backlog 로 이미 추적 중이다 — 새 갭이 아니라 기존 유예 판단의 재확인.
  - 제안: 즉시 조치 불요(기존 유예 유지). 신규 raw UPDATE/DELETE 소비 지점을 추가하는 다음 PR 에서
    "전용 튜플 mock 최소 1건" 을 체크리스트로 못박거나, plan 이 이미 적어 둔 얇은 래퍼를 우선순위
    있게 검토할 것.

- **[INFO]** 두 "자매" 구조적 회귀 가드(`assert-row-array.spec.ts`, `update-returning-rows.spec.ts`)가
  `SRC = join(__dirname, '..', '..')` 계산과 `readFileSync(join(SRC, rel), 'utf8')` 루프를 여전히
  각자 인라인으로 반복한다 — `countCalls`/`stripComments` 공유(이번 라운드가 완료한 부분)와 달리
  이 보일러플레이트는 통합되지 않았다.
  - 위치: `codebase/backend/src/common/utils/assert-row-array.spec.ts`(`SRC`/`CONSUMING_QUERY` 정의부),
    `codebase/backend/src/common/utils/update-returning-rows.spec.ts`(`SRC`/`CONSUMING` 정의부)
  - 상세: `22_45_24`/`23_07_11` maintainability 라운드가 이미 INFO 로 "세 번째 유사 가드가 생길 때
    추출" 판단을 내렸고, `01_44_03` testing 도 동의했다. 이번 라운드에서 상태 변화 없음을 재확인.
  - 제안: 조치 불요(기존 유예 유지).

## 요약

이 변경분(TypeORM `UPDATE`/`DELETE … RETURNING` 튜플 shape 오독 + `auth-oauth` snake_case 컬럼명
오독 수정)은 이미 8차례 이상의 리뷰 라운드를 거쳐 CRITICAL 4건·WARNING 다수가 실제로 조치됐고,
최신 커밋은 그 마지막 잔여 지적(디렉토리 컨벤션 위반·`execution-engine` cancelled-state mock 의
비현실 shape)까지 닫았다. 이번 라운드는 그 조치를 직접 재실행(546+ unit tests GREEN, `tsc --noEmit`
로 재계산한 199-에러 baseline 이 정확히 일치하고 대상 파일 신규 에러 0건)과 구조적 가드 fixture의
손 재계산으로 독립 검증했으며, 새로운 CRITICAL/WARNING 급 갭은 발견하지 못했다. 남은 것은 이미
plan(`update-returning-tuple-shape.md` §후속)이 측정된 근거와 함께 backlog 로 추적 중인 INFO 2건
(legacy 비-튜플 mock 잔존, 두 가드의 보일러플레이트 미통합)뿐이다.

## 위험도

LOW
