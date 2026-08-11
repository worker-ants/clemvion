# 변경 범위(Scope) Review

## 컨텍스트

`plan/in-progress/typescript-toolchain-followups.md` 는 이 changeset 이전에 이미 존재하는
plan 문서로, 원 리뷰(`review/code/2026/08/01/10_55_44/SUMMARY.md`)의 INFO 4건을 후속 항목
§1(공유 프리미티브 `_shared.ts` 분리)·§2(`validateWorkspacePatterns` 순수 함수 분리)·
§3(`catalog:` 마이그레이션 검토)·§4(타입·JSDoc 정리)로 명시적으로 사전 선언해 두었다. 이번
changeset 은 그 중 §1·§2·§4 를 구현하고, §3 은 코드 변경 없이 실측 조사만 plan 문서에
추가한 뒤 "미착수 유지" 로 명시적으로 defer 했다. 즉 6개 파일 전부가 사전에 문서화된 백로그
항목의 실행이며, 임의로 새로 발견한 작업이 아니다.

## 발견사항

- **[INFO]** §1(순수 이관) 범위를 넘어선 신규 동작 테스트 1건 추가
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` — 함수 `describe("listAtPath + packageDirsInPaths", …)` 안의 `it("인라인 주석을 항목에서 떼어낸다", …)` (게이트 338–351)
  - 상세: §1 의 plan 서술은 "이관 + 양쪽 재검증"이다. 그런데 이 테스트는 `listAtPath` 의
    기존 동작(인라인 주석 제거, `.replace(/\s+#.*$/, "")`)에 대한 **새 합성 fixture**를
    추가한다 — 그 로직 자체는 이번 diff 에서 한 글자도 바뀌지 않고 그대로 이관됐을 뿐이다.
    "단순 이관"의 범위를 문자 그대로 보면 신규 커버리지 추가는 범위 밖 확장이다.
    다만 checklist(파일 6, 게이트 118–121)의 "뮤테이션 8종 전부 RED (… 공유 파서 인라인
    주석 …)" 항목에 이 테스트가 명시적으로 귀속되어 있고, 주석(게이트 340–342)도 "이 축만
    합성 커버리지가 비어 있어서 뮤테이션 실측으로 발견했다"고 근거를 밝히고 있어 **은폐된
    확장이 아니라 disclosed 된 부수 발견**이다.
  - 제안: 조치 불요. 다만 향후 "순수 이관" 항목에서 새 테스트가 필요하다고 판단되면 plan
    본문의 조치 서술(§1 원문)에도 "이관 과정에서 발견한 미커버 분기 보강" 을 한 줄 추가해
    두면 사전 선언과 실행 결과 간 괴리가 더 줄어든다.

## 파일별 스코프 정합성 확인

- `_shared.ts`(신규): plan §1 이 명시한 3 심볼(`ROOT`/`repoRoot`/`PackageManifest`) + YAML
  서브셋 추출기(`blockRange`/`findKeyLine`/`listAtPath`) 만 담는다. 헤더 주석 자체가 "여기
  두는 기준"을 명문화해 향후 잡동사니화를 스스로 차단하고 있어 §1 선언과 정확히 일치한다.
- `internal-package-registration-guard.ts`: `_shared` re-export 로 소비처 계약을 유지(§1 대로).
  `fs`/`path` import 는 그대로 두어 불필요 정리·삭제가 섞이지 않았다.
- `internal-package-registration.test.ts`: import 목록 변경 없음, 신규 테스트 1건만 추가(위
  INFO 항목).
- `typescript-toolchain-guard.ts`: import 출처 변경(§1), `missingCompilerApi` JSDoc 정정(§4),
  `validateWorkspacePatterns` 추출 + `discoverWorkspaceDirs` 의 `readLines` 주입(§2),
  `loadTypescriptFrom` 반환 타입 `unknown | null` → `unknown` + 근거 주석(§4). 넷 다 plan
  체크리스트(파일 6, 게이트 97–117)에 1:1 대응되며 그 외 로직 변경은 없다.
- `typescript-toolchain.test.ts`: `validateWorkspacePatterns` 신규 describe 블록(§2) 하나만
  추가. 기존 테스트 블록은 손대지 않았다.
- `typescript-toolchain-followups.md`: plan 문서 자체 갱신(연구 결과 기록 + 체크리스트
  갱신)으로, `developer` 역할의 쓰기 권한(`plan/**`) 범위 안이고 이 작업의 산출물 그 자체다.
  §3 은 코드 변경 없이 "미착수 유지"로 명시 defer 했다 — 코드 스코프를 임의로 넓히지 않고
  결정을 문서화한 것으로, 오히려 스코프 규율의 모범례다.

포맷팅만 바뀐 줄, 불필요한 주석 삭제, 미사용 import 추가, 설정 파일 변경, 요청 밖 리팩터링은
발견되지 않았다.

## 요약

6개 파일 모두 `plan/in-progress/typescript-toolchain-followups.md` 에 사전 문서화된 백로그
항목(§1·§2·§4)의 실행이며, 각 코드 변경이 체크리스트 서술과 1:1로 대응한다. 유일한 특이점은
§1(순수 이관) 작업 중 뮤테이션 테스트로 발견한 미커버 분기(`listAtPath` 인라인 주석 제거)에
대한 신규 테스트 1건으로, 엄밀히는 "이관"의 문자적 범위를 살짝 넘지만 plan 체크리스트에 그
근거가 명시적으로 기록되어 있어 은폐된 확장이 아니다. §3(catalog 마이그레이션)은 코드를
건드리지 않고 조사 결과만 기록한 뒤 명시적으로 미착수 상태를 유지해, 스코프를 스스로 좁게
유지하려는 규율이 뚜렷하다. 드라이브바이 리팩터링·무관 파일 수정·불필요한 포맷팅/주석/임포트
변경은 없다.

## 위험도

LOW
