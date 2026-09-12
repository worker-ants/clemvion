# 문서화(Documentation) 코드 리뷰

## 발견사항

- **[WARNING]** CHANGELOG 새 항목 안에서 spec 경로 표기 스타일이 한 문단 안에서 섞여 있다
  - 위치: `CHANGELOG.md:23` (`> 모르는데, \`3-error-handling.md §1\` 이 …`)
  - 상세: 바로 위 문장(`CHANGELOG.md:21`)은 `spec/data-flow/12-workspace.md §"UUID 검증 강도
    비대칭"` 처럼 저장소 루트 기준 전체 경로를 쓰는데, 같은 항목의 인용구(`:23`)는
    `3-error-handling.md §1` 처럼 디렉터리 없이 파일명만 쓴다. `CHANGELOG.md` 의 기존 관행은
    이 파일을 항상 `spec/5-system/3-error-handling.md` 전체 경로로 인용한다(예: 기존
    `SoT: … spec/5-system/3-error-handling.md §1.3 …`, `… spec/5-system/3-error-handling.md
    §3.2` 항목). 같은 근거의 원문인 `plan/in-progress/keyset-cursor-uuid-validation.md` §A
    (`- \`spec/5-system/3-error-handling.md §1\` (\`VALIDATION_ERROR\` 행):`)에서는 전체
    경로로 적혀 있어, CHANGELOG 로 옮기며 접두사만 빠졌음을 알 수 있다. 파일 자체는 저장소에
    유일해 실제로 못 찾을 위험은 낮지만, 같은 문단 안에서 표기 스타일이 갈리는 것은 이 문서가
    스스로 세운 관행과 어긋난다.
  - 제안: `3-error-handling.md §1` → `spec/5-system/3-error-handling.md §1` 로 통일.

- **[WARNING]** 이 diff 가 만든 두 번째 관측 가능한 동작 변화(우선순위 역전으로 404→400)가
  CHANGELOG 의 "배포 시 확인" 절에서 빠졌다
  - 위치: `CHANGELOG.md:17`–`20` (`⚠️ 배포 시 확인` 절) — 근거는
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:657`–`679`
    (신규 테스트 `'커서 검증이 소유권 검사보다 먼저 돈다 — 타 워크스페이스 + 잘못된 커서는 400
    (404 아님)'`) 및
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:174`–`177`
    (`decodeCursor` 의 "호출 순서 주의" 주석).
  - 상세: `decodeCursor` 가 `verifyExecutionAccess`(워크스페이스 소유권 검사)보다 먼저 도는
    것 자체는 기존 관행이지만, 이번 diff 로 `i`(id 성분) 검증이 `decodeCursor` 안에 추가되면서
    **"다른 워크스페이스 + 형태가 잘못된 커서"** 조합의 응답 코드가 실제로 바뀌었다 — 종전에는
    `decodeCursor` 가 `i` 를 보지 않아 그대로 통과시켰고, 그 뒤 `verifyExecutionAccess` 가
    워크스페이스 불일치를 먼저 잡아 **404** 를 반환했다. 지금은 `decodeCursor` 가 그 값을 먼저
    거부해 **400 `INVALID_CURSOR`** 가 된다. 신규 테스트의 주석이 이를 스스로
    "**이 diff 가 만든 관측 가능한 우선순위 변화**"(`review/code/2026/09/13/00_13_51`
    testing W1 지적에 대한 처분)라고 명시하고, 서비스 코드 주석도 같은 사실을 적어 둔다.
    그런데 CHANGELOG 의 `⚠️ 배포 시 확인` 절 — 정확히 이런 배포 영향을 알리기 위해 존재하는
    절 — 은 id 검증에 따른 500→200/400 전환만 언급하고, 같은 엔드포인트·같은 PR 안에서 함께
    일어난 이 우선순위 역전은 언급하지 않는다. cross-workspace IDOR 방어를 "ownership
    mismatch 는 항상 404" 로 전제하는 클라이언트나 모니터링·e2e 스위트가 있다면 이 변화도
    확인 대상이다.
  - 제안: CHANGELOG 항목에 한 줄 추가. 예: "타 워크스페이스 요청이 형태가 잘못된 커서를 함께
    보내면 종전 404 대신 400 이 된다(정보 누설 아님 — 커서는 리소스를 조회하기 전에 형태만으로
    거부되므로 존재 여부를 구별해 주지 않는다)."

## 참고 — 확인했으나 문제 없음

- `codebase/backend/src/common/utils/uuid.spec.ts`·`uuid.ts`·`login-history.service.ts`·
  `background-runs.service.ts` 의 근거 주석은 3라운드 리뷰(`00_13_51` W2)가 지적한 "세 곳
  복제"를 실제로 해소했다 — 상세 근거는 `uuid.ts` JSDoc 한 곳(SoT)에만 있고 호출부 2곳은 짧은
  참조로 압축돼 있다.
- `uuid.spec.ts` docstring 이 SoT 로 지정한 grep 명령
  (`grep -rn 'isUuidShaped(' … | grep -v '\.spec\.ts' | grep -v 'shared/testing/' | grep -v
  'utils/uuid.ts:'`)을 직접 실행해 실측했다 — 정확히 문서가 claim 한 3곳
  (`workspace-context.util.ts:74` · `login-history.service.ts:61` ·
  `background-runs.service.ts:178`)만 나온다. 3라운드에서 지적된 "필터 누락 시 4줄" 결함은
  고쳐져 있다.
- `session-revocation.e2e-spec.ts`·`background-monitoring.e2e-spec.ts` 의 새 테스트 주석이
  인용하는 선례 `webhook-trigger.e2e-spec.ts` B4 를 직접 열어 대조했다 — 인용 문구
  ("단위 테스트가 mock 하는 드라이버 에러 형태가 실제와 같은지는 이 케이스만 확인한다")가
  실제 B4 테스트의 주석과 정확히 일치한다.
- `plan/in-progress/keyset-cursor-uuid-validation.md`·`spec-draft-nullable-notation-followups.md`
  가 인용하는 6개 review 디렉터리(`21_20_01`·`22_03_45`·`23_19_03`·`23_40_57`·`00_13_51`·
  consistency `22_51_25`)가 전부 실재한다 — 조작된 인용 없음.
- `spec-draft-nullable-notation-followups.md` 의 종결 처리(`GlobalExceptionFilter` 항목)는
  원문을 취소선으로 남기고 각주로 근거를 다는 자기-반증형 소정정 관례를 지켰고, 취소선
  스팬 안에 빈 줄이 없어 마크다운 렌더링 문제도 없다.
- `plan/in-progress/keyset-cursor-uuid-validation.md` frontmatter `spec_impact: none` 은
  bare scalar 형식으로 정확하다(리스트도 `[]` 도 아님).

## 요약

이번 변경은 문서화 규율이 전반적으로 높다 — JSDoc 중복을 SoT 한 곳으로 수렴시켰고, plan
문서의 회귀 캐너리 개수·grep 재현 명령을 직접 실행해 실측했더니 정확했으며, 리뷰 이력·근거
인용이 전부 실재하는 파일을 가리킨다. 다만 CHANGELOG 항목 자체에서 두 가지 결함을 찾았다:
(1) 같은 문단 안에서 spec 경로 표기 스타일이 갈리고, (2) 이 diff 가 실제로 만든 두 번째
관측 가능한 동작 변화(cross-workspace + 잘못된 커서 조합의 404→400 전환)가 "배포 시 확인"
절에 빠져 있다 — 이 절의 존재 이유가 정확히 이런 변화를 잡아내는 것이라 공백이 두드러진다.
둘 다 CHANGELOG 텍스트 수정만으로 해소 가능하며 코드·테스트 변경은 필요 없다.

## 위험도

LOW
