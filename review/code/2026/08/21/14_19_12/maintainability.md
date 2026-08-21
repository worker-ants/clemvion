# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** "쌍둥이" 가드 두 파일이 `SOT_DIR` 을 서로 다른 형태로 선언한다 — 문법 스타일이 어긋난 채 대칭 유지 규약을 요구한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:29` (`export const SOT_DIR = 'codebase/packages/masked-markers';` — 슬래시 리터럴) vs `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:21` (`export const SOT_DIR = path.join("codebase", "packages", "masked-markers");` — `path.join`, 그 결과 `:144` 에서 `SOT_DIR.split(path.sep).join("/")` 로 별도 정규화가 필요)
  - 상세: 두 파일 모두 파일 헤더에 "판정 분기를 새로 넣거나 고칠 때는 backend 쌍둥이와 함께 고치고, 양쪽에 대칭 캐너리를 넣는다" 는 명시적 규약을 걸어 뒀고, 실제로 이 PR 은 그 규약이 깨졌던 사고(라운드3 `SOT_DIR` 접두 경계 backend 만 수정)를 직접 겪었다. 그런데 정작 `SOT_DIR` 을 만드는 방식 자체가 두 파일에서 처음부터 다르다 — backend 는 이미 정규화된 슬래시 리터럴을 직접 쓰고, frontend 는 플랫폼 의존 `path.join` 을 쓴 뒤 소비 지점에서 별도로 정규화한다. 두 파일을 나란히 대조하며 "대칭인지" 확인하는 사람에게는 이 지점이 실제 로직 차이(버그)인지 의도된 스타일 차이인지 즉시 구분되지 않는다 — 이 시리즈가 반복해 겪은 "한쪽만 고쳐진 채 완료형 서술" 사고의 재발 지점이 될 수 있다. 기능적으로는 POSIX(CI) 환경에서 `path.sep === '/'` 라 현재는 동일하게 동작한다.
  - 제안: 둘 중 한 형태로 통일한다 — 가장 단순한 선택은 frontend 도 backend 처럼 슬래시 리터럴로 선언해 `path.join`/사후 정규화 자체를 없애는 것(두 스캐너 모두 `path.relative(...).split(path.sep).join('/')` 로 실제 경로를 이미 정규화하므로 `SOT_DIR` 쪽도 굳이 `path.join` 을 거칠 이유가 약하다).

- **[INFO]** 패키지 최상단 JSDoc(`index.ts`)과 `README.md` 가 "왜 공유 패키지인가" 서사를 사실상 동일하게 중복 서술하며, 이를 대조하는 기계적 가드는 없다
  - 위치: `codebase/packages/masked-markers/src/index.ts:1`-`24` (module JSDoc, `## 왜 공유 패키지인가`) vs `codebase/packages/masked-markers/README.md:18`-`28` (`## 왜 패키지인가`)
  - 상세: 두 곳 모두 "CI 경로 게이팅에 막혀 계약 테스트 대신 추출로 갔다"는 동일한 근거를 문장 단위로 거의 그대로 반복한다(`frontend-checks`/`backend-checks` 상호 경로 생략, `codebase/packages/**` 만 양쪽에서 relevant). 이 패키지 자체가 "손 복제 미러는 한쪽만 갱신되면 조용히 어긋난다"는 교훈에서 출발했는데, 정작 그 교훈을 설명하는 문서 두 벌이 같은 형태(손 복제, 대조 가드 없음)로 존재한다. 코드 미러처럼 `findMirrorRedeclarations` 가 지켜주는 대상이 아니라서 한쪽만 갱신돼도 아무 것도 실패하지 않는다.
  - 제안: 실질적 위험은 낮음(둘 다 사람이 읽는 산문이라 값이 달라져도 정오답이 갈리지 않는다). README 를 `index.ts` JSDoc 인용/요약으로 짧게 줄이거나, 반대로 `index.ts` 는 세부 서사를 README 로 위임하고 링크만 남기는 방향을 다음 편집 기회에 고려할 만하다. 이번 PR 범위를 막을 사유는 아니다.

- **[INFO]** (carried forward, 이미 여러 라운드에서 "조치 불요" 로 처분됨) `masked-markers/package.json` 의 `prepare` 스크립트가 저장소 내 8개 다른 패키지와 문자 그대로 동일한 인라인 JS 문자열을 또 한 번 복제한다
  - 위치: `codebase/packages/masked-markers/package.json:9` (`scripts.prepare`)
  - 상세: `grep -rl '"prepare": "node -e' codebase/packages/*/package.json` 기준 이미 8개 패키지가 동일 문자열을 갖고 있다(이 패키지 포함). 이 PR 이 새로 만든 결함이 아니라 기존 저장소 관행을 그대로 답습한 것이고, 직전 라운드(`11_27_29`/`12_25_15`)에서 이미 INFO 로 지적되고 "지금 손대지 않는다"고 명시적으로 처분됐다. 재확인 목적으로만 기록.
  - 제안: 이번 PR 범위 아님. 9번째 이상 패키지가 추가되기 전에 공유 스크립트 추출을 검토할 가치는 여전히 유효하다.

## 요약

이 diff 는 `MASKED_MARKERS`/`isMaskedMarker`/깊이 상한을 손 복제 미러에서 `@workflow/masked-markers` 공유 패키지로 추출하고, 그 이관이 되돌아가지 않도록 backend·frontend 양쪽에 AST 기반 미러 소멸 가드를 신설하는 리팩터다. 9라운드에 걸친 사전 리뷰-수정 루프(`11_27_29`~`13_55_59`)를 거치며 경로 게이팅 사각지대·파생 스캔 범위 누락·접두 경계 비대칭 같은 실질적 결함이 이미 전부 수정·캐너리로 고정됐고, 최종 상태의 함수들은 길이가 짧고 책임이 하나씩이며(`resolveScanDirs`/`listSourceFiles`/`findRedeclaredSymbols`/`findMirrorRedeclarations` 분리) 중첩도 최대 3~4단에 그쳐 과도하지 않다. 네이밍은 `MAX_MASK_DEPTH` 라는 중립 이름으로 기존 두 이름(`MAX_REDACT_DEPTH`/`MAX_MARKER_SCAN_DEPTH`)의 혼선을 정리했고, 설계 결정("왜 리터럴이 아니라 심볼만 보는가", "왜 두 스택에 탐지 로직을 중복하는가")이 코드 인접 주석에 근거·실측과 함께 남아 있어 재발견 비용이 낮다. 이번 라운드에서 새로 발견한 것은 모두 INFO 급이며 실동작에 영향이 없다 — "쌍둥이" 가드 파일이 대칭을 요구하면서도 `SOT_DIR` 선언 형태 자체는 처음부터 어긋나 있는 점, README 와 패키지 JSDoc 이 대조 가드 없이 같은 서사를 손으로 중복하는 점, 그리고 이미 여러 라운드에서 "조치 불요"로 처분된 `prepare` 스크립트 9번째 사본이다. 차단할 만한 가독성·복잡도·중복 문제는 없다.

## 위험도
NONE
