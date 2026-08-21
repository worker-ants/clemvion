# 유지보수성(Maintainability) Review — masked-marker-contract-7d2e14 (라운드 9, 14_39_29)

## 검토 범위

이 PR 은 9라운드째 리뷰다. `11_27_29`~`14_19_12` 8개 라운드가 순서대로 실질 결함(가드 배치의
경로 게이팅 사각지대 · 감시 목록 자체가 미러 · 스캔 범위가 "전수처럼 보이지만 아님" ·
완료형 서술이 거짓 · 문서 비대칭 · 편집 잔존물 · 이미 닫힌 항목을 다시 열게 만드는 stale
서술)을 순서대로 닫아 왔고, 직전 라운드(`14_19_12`)는 위험도 **NONE**(architecture 관점
신규 지적 0건)으로 수렴했다. 이번 라운드는 마지막 처분 커밋(`85197720e`, 라운드8 —
`masked-markers.test.ts` JSDoc/테스트명 정정) 이후 현재 소스 상태를 다시 직접 `Read` 로
열어 재검증했다 — 핵심 파일 전부(`@workflow/masked-markers/src/index.ts`, 양쪽
`masked-marker-mirror-guard.ts`/`.spec.ts`/`.test.ts`, backend
`sanitize-error-message.ts`, frontend `masked-markers.ts`, frontend
`masked-markers.test.ts`, `plan/in-progress/masked-marker-shared-package.md`).

## 발견사항

새로 발견한 CRITICAL/WARNING 은 없다. 과거 라운드가 이미 INFO 로 확인·처분한 항목 중 현재도
남아 있는 것만 재확인 목적으로 기록한다 — 전부 기능 무영향이고 이번 라운드의 새 발견이 아니다.

- **[INFO]** (carried forward, `14_19_12`) "쌍둥이" 미러 가드 두 파일의 `SOT_DIR` 선언 방식이
  여전히 서로 다르다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:29`
    (`export const SOT_DIR = 'codebase/packages/masked-markers';` — 슬래시 리터럴) vs
    `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:21`
    (`export const SOT_DIR = path.join("codebase", "packages", "masked-markers");` —
    `path.join`, 그 결과 `:144` 에서 `SOT_DIR.split(path.sep).join("/")` 로 별도 정규화)
  - 상세: 동작은 POSIX(CI) 환경에서 동일하며, 두 파일 모두 "판정 분기를 고칠 땐 양쪽을
    함께 고치라"는 규약을 헤더에 명시해 뒀다. 이 지점은 로직 차이가 아니라 선언 스타일
    차이지만, "쌍둥이는 대칭이어야 한다"를 요구하는 이 가드 쌍 자체에 처음부터 있던
    비대칭이라 대조하는 사람에게 잠깐의 판단 비용을 요구한다. 직전 라운드가 이미 이
    정확한 근거로 INFO 처리했고 이번 라운드에서도 변화가 없다.
  - 제안: 다음 편집 기회에 frontend 쪽도 슬래시 리터럴로 통일(`path.join`/사후 정규화
    제거)하는 것을 고려. 이번 PR 을 막을 사유는 아니다.

- **[INFO]** (carried forward, `13_55_59`) frontend 미러 가드 spec 파일에만 이중 빈 줄이
  두 곳 남아 있다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts:69`-`70`,
    `:86`-`87` (각각 "[캐너리] 스캔 대상 파일 목록이 비어 있지 않다" / "[캐너리] SoT 심볼
    파생이 비지 않는다" 테스트 다음)
  - 상세: backend 쌍둥이(`masked-marker-mirror.spec.ts`)에는 연속 빈 줄이 없다. 순수
    포맷 드리프트이고 빌드·테스트에 영향 없음. 두 라운드 연속 미반영이지만 매 라운드
    "비차단"으로 명시 처분됐다.
  - 제안: 선택 사항. 빈 줄 하나씩 제거해 backend 쌍둥이와 형태를 맞춘다.

- **[INFO]** (carried forward, `14_19_12`) 패키지 `src/index.ts` 모듈 JSDoc 과
  `README.md` 가 "왜 공유 패키지인가" 서사를 거의 동일하게 손으로 중복 서술하며, 이를
  대조하는 기계적 가드는 없다
  - 위치: `codebase/packages/masked-markers/src/index.ts:1`-`24` vs
    `codebase/packages/masked-markers/README.md:18`-`28`
  - 상세: 둘 다 사람이 읽는 산문이라 값이 갈려도 정오답이 바뀌지 않아 실질 위험은 낮다.
    이번 라운드에서도 두 서술이 여전히 병존하며 변화가 없다.
  - 제안: 다음 편집 기회에 한쪽으로 요약/위임을 고려. 차단 사유 아님.

- **[INFO]** (carried forward, 여러 라운드) `masked-markers/package.json` 의 `prepare`
  스크립트가 저장소 내 8개 다른 내부 패키지와 동일한 인라인 JS 문자열을 그대로 복제한다
  (9번째 사본)
  - 위치: `codebase/packages/masked-markers/package.json:9` (`scripts.prepare`)
  - 상세: 이 PR 이 새로 만든 결함이 아니라 기존 저장소 관행을 그대로 답습한 것이고,
    여러 라운드에서 "지금 손대지 않는다"고 명시적으로 처분됐다.
  - 제안: 이번 PR 범위 아님. 10번째 이상 패키지가 추가되기 전에 공유 스크립트 추출을
    검토할 가치는 여전히 유효하다.

`plan/in-progress/masked-marker-shared-package.md` 는 체크리스트가 실제 상태와 일치하고
(`[ ] /ai-review` 만 미체크 — 이 실행 자체가 그 항목이다), "후속(이 PR 밖)" 섹션에 탐지
로직 재추출·backend 깊이 경계 테스트 두 항목이 정확한 근거와 함께 등재돼 있어 `review/**`
휘발 문제가 재발하지 않았다.

## 요약

이 PR 은 backend/frontend 에 손 복제돼 있던 마스킹 마커 상수·판정 로직·깊이 상한을
`@workflow/masked-markers` 공유 패키지로 추출하고, 그 이관이 되돌아가지 않도록 두 스택에
AST 기반 미러 소멸 가드를 신설하는 리팩터다. 9라운드에 걸친 리뷰-수정 루프를 거치며 실질
결함(경로 게이팅 사각지대·감시 목록 자체가 미러·스캔 범위 누락·완료형 서술의 거짓·문서
비대칭·편집 잔존물)이 순서대로 전부 해소됐고, 이번 라운드에서 현재 소스를 직접 재검증한
결과 새로운 CRITICAL/WARNING 은 없다. 핵심 로직(`resolveScanDirs`/`listSourceFiles`/
`findRedeclaredSymbols`/`findMirrorRedeclarations`, `deepRedactCore`,
`hasMaskedMarkerLeaf`/`scanForMarker`)은 함수가 짧고 책임이 하나씩이며 중첩도 최대
3~4단(for-for-if)에 그친다. 네이밍은 `MAX_MASK_DEPTH` 라는 중립 이름으로 기존 두 이름의
혼선을 정리했고, "왜 리터럴이 아니라 심볼만 보는가", "왜 두 스택에 탐지 로직을
중복하는가", "언제 안전이 조건부로 바뀌는가" 같은 설계 결정이 코드 인접 주석에 근거·실측과
함께 남아 재발견 비용이 낮다. 남은 발견은 전부 INFO 이고 이전 라운드에서 이미 동일 근거로
비차단 처분된 항목의 재확인(carried forward)이며, 기능 동작에 영향이 없다. 유지보수성
관점에서 병합을 막을 사유는 없다.

## 위험도
NONE
