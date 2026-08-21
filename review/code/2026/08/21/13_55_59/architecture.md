# 아키텍처(Architecture) Review — masked-marker-contract-7d2e14 (13_55_59, 라운드 7)

## 검토 방법

이 PR 은 6라운드 자체 리뷰를 거치며 backend/frontend 손 복제 마커 상수(`MASKED_MARKERS`/
`isMaskedMarker`/깊이 상한)를 `@workflow/masked-markers` 공유 패키지로 추출하고, 그 이관이
되돌려지지 않는지 지키는 "미러 소멸 가드"를 backend·frontend 양쪽에 뒀다. 이번 라운드는 직전
라운드(`13_34_34`)의 처분 커밋(`0e7b6fd4c`, "비대칭을 경고하는 문단을 한쪽에만 넣었다")이 만든
diff 를 중심으로, 핵심 소스(`codebase/packages/masked-markers/src/index.ts`, 양쪽
`sanitize-error-message.ts`/`masked-markers.ts` 재export, 양쪽 `masked-marker-mirror-guard.ts`/
`*.spec.ts`/`*.test.ts`)를 `Read` 로 직접 열어 현재 상태를 확인했고, `plan/in-progress/
masked-marker-shared-package.md` 의 백로그 절과 `git log`/`git show` 로 이전 라운드 커밋 이력을
대조했다.

추출된 값 자체(마커 3종·`isMaskedMarker`·`MAX_MASK_DEPTH`)와 재export 전략, CI/Docker 8곳 등록
표면, `resolveScanDirs`/`findRedeclaredSymbols`/`findMirrorRedeclarations` 의 책임 분리는 이전
6라운드가 이미 실측·수정까지 마쳤고 이번 재확인에서도 backend/frontend 양쪽이 로직상 대칭임을
직접 대조로 확인했다(`SOT_DIR` 접두 경계·`resolveScanDirs` 2단계 파생·`SOT_SYMBOLS` interop
필터·함수 선언 탐지 캐너리 전부 양쪽에 동일하게 존재). 새로 발견한 것은 이번 라운드가 검토
대상으로 삼은 바로 그 처분 커밋(`0e7b6fd4c`) 자신이 만든 흠 하나와, 반복적으로 미뤄진 아키텍처
결정 하나의 추적 누락이다.

## 발견사항

- **[WARNING]** 직전 라운드가 추가한 "대칭 규칙" 문단이 병합 과정에서 문장 순서가 뒤엉키고 blockquote 마크업이 깨졌다 — 하필 "비대칭을 조심하라"는 내용의 문단 자신이 다시 비대칭(이번엔 파일 간이 아니라 파일 내부 서식)을 만들었다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:36-37` (describe 블록 바로 위 JSDoc 헤더 마지막 두 줄)
  - 상세: `git show 0e7b6fd4c` 로 확인한 diff 는 기존 한 줄 `* 바뀌든 최소 하나는 실행된다. 값의 미러와 달리 탐지 로직의 중복은 **한쪽이 낡아도 반대쪽 트리거를 무력화하지 않는다**:` 를 지우고, 그 자리에 새 blockquote 문단("다만 그 안전은 조건부다"~"규칙: …")을 삽입하면서 **"값의 미러와 달리…" 문장을 새 blockquote 의 마지막 줄("규칙: …넣는다.") 끝에 그대로 붙여** 남겼다. 그 결과 현재 소스는 다음과 같다(`sed -n '36,37p' … | cat -e` 로 직접 확인, 특수문자 없음 — `$` 는 줄끝 표시):
    ```
     * > **규칙**: 판정 분기를 새로 넣거나 고칠 때는 **양쪽에 대칭 캐너리를 함께** 넣는다. 값의 미러와 달리 탐지 로직의 중복은 **한쪽이 낡아도 반대쪽 트리거를 무력화하지 않는다**:
     * 한 사본이 낡아도 다른 사본이 같은 불변식을 자기 트리거에서 계속 지킨다.
    ```
    36번째 줄은 `* >` 로 시작하는 blockquote 줄인데, 37번째 줄은 `* ` 로 시작해 blockquote 접두가 없다 — 같은 논리 문장의 후반부인데 마크다운 렌더러(JSDoc 도구) 관점에서는 blockquote 가 36줄에서 끊기고 37줄은 별개의 평문 단락으로 취급된다. 게다가 문장 순서도 형제 세 파일(backend `masked-marker-mirror-guard.ts:11-12`, frontend `masked-marker-mirror-guard.ts` 헤더, frontend `masked-marker-mirror.test.ts:39-40`)과 반대다 — 그 세 곳은 "값의 미러와 달리 탐지 로직의 중복은…" 문장이 **자기 완결된 별도 단락**으로 먼저 나오고, 그다음에 "다만 그 안전은 조건부다" blockquote 가 온다. backend spec.ts 만 이 문장이 blockquote 마지막 줄에 짓눌려 붙고 그 후반부가 blockquote 밖으로 떨어져 나온 유일한 사본이다. 이 문단은 정확히 "판정 분기를 고칠 때 양쪽을 대칭으로 맞춰라"라는, 이 PR 이 라운드3·4·6에서 반복해 어긴 규칙을 적어 둔 자리라서 — 그 규칙을 적는 동안 같은 실패 클래스(이번엔 파일 간이 아니라 문장 재배치 실수)가 또 발생했다는 점에서 아이러니가 크다. 기능적 영향은 없다(JSDoc 주석, 테스트 동작 무관).
  - 제안: 형제 세 파일과 동일한 순서·구조로 정정한다 — "값의 미러와 달리 탐지 로직의 중복은 **한쪽이 낡아도 반대쪽 트리거를 무력화하지 않는다** — 각 사본이 자기 워크플로에서 같은 불변식을 계속 지킨다." 를 그 자체로 완결된 평문 단락으로 앞에 두고, `> **다만 그 안전은 조건부다.**` blockquote 는 그 뒤에 이어지되 "규칙" 문장에서 끝나도록 정리한다(즉 36번째 줄에서 "값의 미러와 달리…" 이하를 잘라 앞으로 옮기고, 37번째 줄의 "한 사본이 낡아도…" 문구는 그 옮겨진 단락에 흡수해 중복 없이 정리). 이번엔 "고쳤다"고 쓰기 전에 `diff` 로 blockquote 4개 `>` 줄이 전부 연속인지 직접 확인할 것 — 이 PR 자신의 학습("고쳤다 를 쓰기 전에 세는 것")을 여기에도 적용한다.

- **[WARNING]** "탐지 로직 복제를 공유 패키지로 재추출"이라는 아키텍처 결정이 커밋 메시지·`RESOLUTION.md` 에만 남고 `plan/` 백로그에는 등재되지 않았다 — 이 PR 이 다른 항목에 대해서는 정확히 지키고 있는 규율을 이 항목에서만 빠뜨렸다
  - 위치: `plan/in-progress/masked-marker-shared-package.md` `## 후속 (이 PR 밖)` 절(163-172행) — 현재 항목은 `backend deepRedactSecrets 깊이 경계 테스트` 하나뿐이다. 대조 대상: 커밋 `0e7b6fd4c` 메시지 및 `review/code/2026/08/21/13_34_34/RESOLUTION.md` "미조치 INFO" 절 — "**탐지 로직 복제를 공유 패키지로 재추출** (architecture INFO 1) — 이번 PR 이 2회 비대칭 사고의 근원임을 실증했으니 검토할 가치가 있다는 지적에 동의한다 … 별건으로 남긴다."
  - 상세: 이 시리즈는 backend·frontend 양쪽에 거의 동일한 순수 로직(`resolveScanDirs`/`findRedeclaredSymbols`/`findMirrorRedeclarations`)을 유지하는 대가로, 그 중복 자체가 두 차례 실제 비대칭 결함(라운드3 `SOT_DIR` 접두 경계 backend 만 고침, 라운드6 위 blockquote 사고)의 근원이었음을 스스로 실증했다. 이를 근본적으로 없애려면 "값"뿐 아니라 "탐지 로직"까지 공유 test-utility 패키지로 재추출해야 한다는 것이 아키텍처 리뷰어의 반복 제안이었고, 개발자도 라운드6 커밋 메시지에서 "지적에 동의한다"고 명시적으로 인정하며 "별건으로 남긴다"고 결정했다. 문제는 그 결정이 기록되는 위치다 — `plan/in-progress/masked-marker-shared-package.md` 자신이 바로 두 항목 위(165-172행)에서 "backend `deepRedactSecrets` 깊이 경계 테스트"를 `## 후속 (이 PR 밖)` 에 등재하며 정확히 이 규율을 명문화하고 있다: *"`review/**` 는 SoT 가 아니라 PR 이 닫히면 사라진다. 그래서 여기 등재한다."* 즉 이 프로젝트가 반복해 겪어 스스로 규칙으로 남긴 실패 패턴(미룬 항목을 `review/**` 에만 적으면 PR 종료와 함께 유실)이, 같은 plan 파일의 같은 절 바로 옆에서 한 항목에는 적용되고 다른 항목(이번 라운드가 만든 것)에는 적용되지 않은 상태다. 이 항목은 실제 아키텍처 결합도 문제(로직 중복이 회귀의 근원이라는 실증된 사실)를 다루므로 architecture 관점에서 재발 방지 대상이지 단순 스타일 사안이 아니다.
  - 제안: `## 후속 (이 PR 밖)` 절에 항목을 추가한다 — 예: "탐지 로직(`resolveScanDirs`/`findRedeclaredSymbols`/`findMirrorRedeclarations`) 공유 test-utility 패키지 재추출 — 라운드3·6 두 차례 backend/frontend 비대칭 결함의 근원. 이 PR 은 범위 확장을 피하려 별건으로 미룸(`0e7b6fd4c` 커밋 메시지 근거)." 값(패키지 자체)의 이관은 이미 끝났으니, 이 항목은 "이관 대상이 하나 더 남아 있다"는 사실 자체를 잃지 않게 하는 것이 목적이다.

## 그 외 확인한 항목 (문제 없음)

- **DIP/의존 방향**: `@workflow/masked-markers` 는 런타임 의존 zero, backend/frontend 어느 쪽도 역참조하지 않는 단방향 의존이다. 순환 의존 없음.
- **OCP**: 마커 신규 추가 시 `SOT_SYMBOLS`(export 표면에서 파생)와 프런트 `hasMaskedMarkerLeaf`가 자동으로 그 마커를 인식한다 — 소비 코드 수정 없이 확장되는 구조.
- **레이어 분리**: `*-guard.ts`(순수 스캔·판정 로직)와 `*.spec.ts`/`*.test.ts`(소비·단언)를 분리하는 패턴이 기존 형제 가드(`internal-package-registration-guard.ts`, `typescript-toolchain-guard.ts`, `masked-reject-callers-guard.ts`)와 일관되게 유지된다.
- **backend spec.ts 의 `repoRoot` 인라인 계산**(`path.resolve(__dirname, '../../../../..')`, 공유 헬퍼 미사용)은 이 PR 이 새로 만든 스타일이 아니라 기존 backend 관행이다 — 동일 디렉터리의 선례 `masked-reject-callers.spec.ts:28` 이 문자 그대로 같은 패턴을 쓴다. 새로운 결함 아님.
- **정밀 파서 사용**: TypeScript 소스에서 식별자 선언을 탐지하는데 리터럴 문자열 매칭이 아니라 `typescript` 패키지의 AST(`ts.createSourceFile`)를 쓴다 — 오탐(주석·문자열 속 리터럴 언급)을 원천 배제하는 올바른 선택이다. `typescript` 는 backend `package.json` 에 `devDependencies`(130행)로 있고 가드 파일은 `src/repo-guards/__tests__/`(빌드 제외 경로)에 있어 production 번들 유입 위험이 없다(RESOLUTION 이 `production-build-devdep` 가드 GREEN 을 실측 확인함).

## 요약

핵심 추출(값의 SoT 이관·재export shim·CI 배선 8곳)은 6라운드에 걸쳐 검증이 끝났고 이번 라운드 재확인에서도 SOLID·결합도·레이어 분리 어느 축에서도 새로 지적할 구조적 결함이 없다. 다만 이번 라운드가 검토 대상으로 삼은 직전 처분 커밋(`0e7b6fd4c`) 자신이 두 가지 새 흠을 만들었다 — (1) "비대칭을 경고하는 문단"을 backend spec 에 옮겨 붙이는 과정에서 문장이 blockquote 안팎으로 잘못 잘려 형제 세 파일과 서술 순서·마크업이 어긋났고(이 PR 이 반복해 겪은 "고치다 만 대칭"의 문서 내부판), (2) 이번 라운드에서 개발자 스스로 동의한 아키텍처 부채("탐지 로직 자체를 공유 패키지로 재추출해야 한다")가 `review/**`(비-SoT)에만 기록되고 `plan/` 후속 절에는 등재되지 않았다 — 이 PR 이 바로 옆 항목에서 정확히 지키고 있는 "미룬 항목은 plan 에 적는다" 규율의 예외가 됐다. 둘 다 기능 동작에는 영향이 없는 문서/추적성 결함이라 병합을 막을 사유는 아니지만, 둘 다 이 PR 이 여섯 라운드 내내 겪어 스스로 문서화한 실패 클래스(한쪽만 고쳐진 채 완료형 서술이 남는다/미룬 결정이 유실된다)의 재현이라 WARNING 으로 남긴다.

## 위험도
LOW
