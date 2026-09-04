# 변경 범위(Scope) 리뷰

## 검토 방법

`git diff --stat origin/main...HEAD`(11개 커밋, `a65a4f85e`~`1a18446f9`)로 실제 diff 를
확인했다 — 78개 파일, `+6564/-15`. 저장소 트리에는 아무것도 쓰지 않았다(`git show`/`git log`/
`git diff` 만 사용, `git status --short` 로 최종 확인 — `review/code/2026/09/04/21_45_58/`
디렉터리(이번 라운드 산출물, 아직 미커밋)만 untracked로 남아 있고 그 외 잔여물 없음).

코드/문서(비-리뷰 산출물) 변경은 정확히 6개 파일이다:

- `CHANGELOG.md` (+38)
- `codebase/backend/src/modules/alerts/dto/responses/alert-rule-response.dto.ts` (+13/-3, 누적)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts` (+245, 순수 append)
- `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract.spec.ts` (+227, 순수 append)
- `codebase/backend/test/alerts-threshold-wire-type.e2e-spec.ts` (신규 + 2차 보강)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (+64/-4, 트래커 항목 1개 국한)

나머지 72개 파일은 전부 `review/code/2026/09/04/{19_43_18,20_16_17,20_39_25,21_10_30,21_25_50}/**`
와 `review/consistency/2026/09/04/20_05_42/**` — 이번 changeset 을 만든 이전 리뷰 라운드들의
`RESOLUTION.md`/`SUMMARY.md`/`meta.json`/`_retry_state.json`/각 관점 리포트다. 이는 이
저장소의 명시 컨벤션(`CLAUDE.md` 정보 저장 위치 표 — 코드 리뷰 산출물 = `review/code/**`,
gitignore 대상 아님)과 developer SKILL 의 "구현 완료 후 자동 review/fix" 워크플로를 그대로
따른 것이다.

## 서사 일관성 확인

11개 커밋 전부가 **단일 서사**를 이어간다 — `git log --oneline origin/main..HEAD` 로 확인:

1. `a65a4f85e` — `AlertRuleDto.threshold` OpenAPI 타입 정정(`number`→`string`) + CHANGELOG +
   plan (검증자 옵션 (a) 반증 결과 반영)
2. `5a7de8ab1` — 이 결함을 되잡는 가드 세 번째 축(`findNumericAsNumber`) 신설 + 테스트
3. `dc83c0312` — 리뷰(`20_05_42`, consistency)가 지적한 JSDoc→공개 OpenAPI description 유출
   문제 정정(서사를 CHANGELOG 로 이동, JSDoc 축약)
4. `c15489e61` — 리뷰(`20_16_17` W1)가 지적한 신규 가드의 정규식 위음성을 AST 로 교체
5. `b5d5210cf` — 리뷰(`20_39_25`)가 지적한 포지셔널 `@Column` 인자 미대응 + 스캔-무동작 은폐
   전제 테스트 보강
6. `40005a6e0` — 리뷰(`21_10_30` W1)가 지적한 `readOption` 순회 분기의 캐너리 테스트 추가
7. `4e7a52bc9` — 리뷰(`21_25_50` INFO#2)가 지적한 e2e 입력값이 정수라 정밀도 손실을 못
   가르는 문제를 소수부 4자리 값으로 교체
8. 나머지 4개 커밋(`9ba0991c8`/`0ac45dfad`/`f213266a4`/`1a18446f9`)은 각 라운드의 리뷰
   산출물(`review/**`)만 커밋 — `codebase/**`/`CHANGELOG.md`/`plan/**` 변경 없음
   (`git show --stat` 로 각각 확인).

각 코드 커밋은 **직전 리뷰 라운드가 지적한 것만** 고친다 — 커밋 메시지에 인용된 라운드
번호(`20_16_17`, `20_39_25`, `21_10_30`, `21_25_50`)와 실제 diff 내용이 1:1 대응함을
`git show --stat`/`git show <파일>` 로 개별 확인했다.

## 항목별 확인

1. **의도 이상의 변경**: 없음. 6개 비-리뷰 파일 전부가 "`AlertRuleDto.threshold` wire 타입
   계약 거짓 정정 + 재발 방지 가드 + 그 가드 자체의 결함 라운드별 시정 + 검증 e2e 강화"라는
   하나의 사슬에 속한다.
2. **불필요한 리팩토링**: 없음. `readBooleanOption`→`readOption` 제네릭화는 신규
   `readStringOption`(포지셔널 `@Column` 타입 인자 판별에 필요)을 추가하며 중복을 피하려는
   목적이고, 곧바로 이 changeset 안에서 소비된다(drive-by 아님). `swagger-dto-contract-guard.ts`
   의 기존 `findSwaggerContractMismatches` 등 기존 함수는 한 줄도 수정되지 않았다(순수 append,
   `@@ -183,3 +218,201 @@` 헝크로 확인).
3. **기능 확장**: 새 정적분석 축(`findNumericAsNumber`/`scanNumericExposure`, ~84줄)은 신규
   기능처럼 보이지만 이 저장소가 반복해 온 패턴(결함 발견 → 해당 필드 정정 + 같은 결함
   클래스를 잡는 전역 가드 신설, 예: `e55b3a74a`)과 동일하며, `AlertRuleDto.threshold` 결함
   재발 방지라는 이번 changeset 의 명시 목적에 직결된다. over-engineering 으로 보기 어렵다.
4. **무관한 수정**: 없음. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 diff
   범위도 §5.4 drift 2단계 검증자 (a)/(b) 항목 및 그 직속 planner 후속 항목 3개에 국한되고,
   문서의 다른 절은 무변경. `spec/**`, `nest-cli.json`, `package.json` 등 설정/스펙 파일은
   diff 목록에 전혀 등장하지 않는다(`git diff --name-only` 로 확인).
5. **포맷팅 변경**: `swagger-dto-contract-guard.ts` 상단 import 가 한 줄 임포트에서 멀티라인
   구조분해로 바뀐 것은 `toPosixPath` 신규 임포트 추가에 따른 기계적 결과이지 별도 포맷팅
   드리프트가 아니다. 그 외 순수 공백/줄바꿈만 바뀐 헝크는 발견되지 않았다.
6. **주석 변경**: `alert-rule-response.dto.ts` JSDoc 변경은 이번 changeset 내 `dc83c0312`
   커밋이 스스로 만든 "내부 서사가 공개 OpenAPI description 으로 유출된다"는 리뷰 지적에
   대한 직접 대응이다(경위 서술을 JSDoc 밖 `//` 주석 + CHANGELOG 로 이동). 무단 주석
   추가/삭제가 아니다.
7. **임포트 변경**: `swagger-dto-contract-guard.ts` 의 `toPosixPath` 추가, `.spec.ts` 의
   `withFiles`/`findNumericAsNumber`/`scanNumericExposure` 추가 모두 같은 파일 내에서 즉시
   소비된다(각각 `scanNumericExposure` 경로 정규화, 신규 대조군 픽스처, 신규 assertion). 미사용
   임포트 없음.
8. **설정 변경**: 없음. diff 대상에 설정 파일 전무.

## 발견사항

발견된 범위 이탈 없음.

- **[INFO]** 이번 changeset 은 "DTO 필드 타입 1건 정정"이라는 표면적 크기에 비해 11개 커밋·
  78개 파일·6564줄 추가로 매우 크다.
  - 위치: 전체 changeset (`origin/main...HEAD`)
  - 상세: 다만 이는 scope 이탈이 아니라 이 프로젝트의 명시된 워크플로(구현 → `/ai-review` →
    Critical/Warning fix → 재검토 → RESOLUTION 커밋, 5라운드 반복) 가 그대로 누적된 결과다.
    각 라운드가 정확히 직전 라운드의 지적사항만 좁게 고쳤음을 커밋별로 확인했고, 리뷰
    산출물 자체도 `review/code/**`(gitignore 대상 아님, 정식 SoT)이므로 "무관한 파일"로
    분류할 근거가 없다.
  - 제안: 없음 — 조치 불요, 참고용 기록.

- **[INFO]** 자매 라운드(`21_25_50` RESOLUTION #1)가 이미 "프롬프트 페이로드가 실제 HEAD
  보다 1커밋 stale"이라는 scope 카테고리 지적을 자체적으로 무해 판정하며 닫은 바 있다
  (`0ac45dfad` 는 `review/**` + planner 항목 1건만 포함, `codebase/**` 무변경임을 리뷰어가
  `git show` 로 직접 확인).
  - 위치: `review/code/2026/09/04/21_25_50/RESOLUTION.md` (조치 항목 #1)
  - 상세: 이번 라운드에서도 동일한 하네스 타이밍 특성(프롬프트 조립 시점과 커밋 시점의
    간극)이 재발할 수 있는 구조이지만, 실제 코드 결함이 아니라 리뷰 하네스의 경합 윈도우이며
    이번 diff 재확인 결과 코드 영역(`codebase/**`)에는 영향이 없다.
  - 제안: 없음 — 하네스 개선은 이 PR 범위 밖(자매 라운드 판정과 동일하게 유지).

## 요약

`git diff origin/main...HEAD` 실측 결과 실질 코드/문서 변경은 정확히 6개 파일로,
`AlertRuleDto.threshold` OpenAPI 타입 계약 거짓 정정과 그 재발을 막는 가드 신설·라운드별
결함 시정(정규식→AST, 포지셔널 `@Column`, 순회 분기 캐너리, e2e 입력값 정밀도)이라는 단일
서사를 11개 커밋에 걸쳐 정확히 나눠 맡는다. 나머지 72개 파일은 프로젝트 컨벤션에 따라 커밋된
리뷰 라운드 산출물(`review/code/**`, `review/consistency/**`)로 무관한 영역이 아니다.
불필요한 리팩토링·기능 과잉확장·무관한 파일 수정·포맷팅 뒤섞임·불필요한 주석/임포트/설정
변경 어느 항목도 관측되지 않았다. 유일하게 눈에 띄는 특성은 표면적 결함 크기(필드 1개)
대비 changeset 규모가 크다는 점인데, 이는 다라운드 review-fix 루프가 정직하게 누적된
결과이지 scope 이탈이 아니다.

## 위험도

NONE
