# RESOLUTION — packages prepare 계약 (18_55_02)

리뷰어 14/14 성공. **CRITICAL 0 / WARNING 3 / RISK LOW.**

## W1 — 컴파일 에러 전파가 테스트로 고정되지 않았다 (requirement + testing 두 명이 독립 지적)

정당한 지적이고, **이 변경의 핵심 주장을 지키는 갭**이었다. 새 계약은 "typescript 가
해소되면 항상 tsc 를 돌리고 **컴파일 에러는 그대로 전파한다**" 인데, 스텁 tsc 가 네 조합
모두 `exit 0` 만 반환해 후자를 아무도 관측하지 않았다.

이 방향이 특히 중요한 이유는 옛 형태의 실패 양상 자체다. `[ -d dist ] || tsc` 처럼 `||` 로
엮인 형태는 **한 글자만 잘못 놓여도 실패를 성공으로 바꾼다.** 나중에 누가 `try{}catch{}` 나
`|| true` 를 덧대도 성공 경로 단언은 전부 그대로 통과한다.

**처분**: `_run()` 에 `tsc_fails` 를 추가하고 두 테스트를 넣었다 — dist 가 있을 때와 없을
때 각각. dist 유무가 실패 전파를 좌우하면 안 되는데, 옛 형태가 정확히 그 결합이었다.

검증: `execSync` 를 `try{}catch{}` 로 감싸 실패를 삼키는 뮤턴트를 7개 패키지 전부에 적용.
**새 테스트 2건만 RED**, 나머지 8건은 통과 — 갭이 실재했고 닫혔음이 실측으로 확인된다.

## W2 — 매 install 마다 비증분 전체 재컴파일 (performance)

사실이다. 다만 **실측 비용은 `pnpm install --filter "frontend..."` 기준 2.5초**(프론트엔드
클로저 5개)다. CI 는 fresh 체크아웃이라 어차피 매번 빌드하므로 회귀가 아니고, 로컬 반복
설치에서만 비용이 는다.

**미처분.** `incremental` + `tsBuildInfoFile` 은 빌드 산출물과 `.gitignore` 를 바꾸는
별도 변경이고, 2.5초를 줄이려고 이 PR 의 주제를 넓히지 않는다. 측정치와 함께 테스트
docstring 에 근거를 남겼다 — 나중에 이 트레이드오프를 재검토할 사람이 숫자부터 보게.

## W3 — 인라인 스크립트가 7개 매니페스트에 문자 그대로 중복 (maintainability + architecture)

중복 자체는 사실이나 **공유 파일 추출은 채택하지 않았다.** 리뷰어도 그 위험을 스스로 달아
두었다("배포 가능 패키지의 self-contained 요구사항이 실제 걸림돌인지 사전 확인 필요") — 확인한
결과 걸림돌이 맞다.

`prepare` 는 패키지 디렉터리를 cwd 로 돌고, **세 번째 갈래는 정확히 prune/injected 프로덕션
트리에서의 재실행을 위해 존재한다.** 그 트리에서 패키지는 워크스페이스 밖으로 복사돼 있고
(`pnpm deploy --prod` + `injectWorkspacePackages`), `../../scripts/prepare.cjs` 같은 상대
경로는 거기 없다. 즉 추출은 **이 스크립트가 살아남으려고 만들어진 바로 그 상황에서** 깨진다.

**처분**: 중복을 유지하되 그 근거를 테스트 docstring 에 명시했다. drift 는
`test_every_package_that_builds_uses_the_same_prepare` 가 막는다 —
같은 논리로 중복을 둔 `_file_mtime` 쌍에는 그 가드가 **없었고**, 오늘 살아있는 버그로
드러났다. 그 전례를 근거로 함께 적었다.

## INFO 처분

- `setUpClass` 의 `sorted(prepares)[0]` 가 빈 집합에서 `IndexError` → 명시 assert 추가.
- 클래스 간 암묵 결합(하나만 골라 행위 검증) → "그 하나가 전부를 대표한다는 보장은
  `PrepareIsUniformTest` 에 있다" 를 주석으로 명시.
- 나머지(PATH 기반 tsc 실행 · `existsSync` 의 비-디렉터리 엣지 · package.json 문서 포인터
  부재 · paths 수동 등재)는 전부 기존 패턴과 동등하거나 계약 밖이라 무처분.

## 검증

harness 스위트 **872 tests OK** (신규 10). 뮤테이션: 옛 형태 원복 3건 RED · 실패 삼킴 2건 RED.
