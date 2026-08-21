# 유지보수성(Maintainability) Review — masked-marker-contract-7d2e14 (라운드 5, 13_14_29)

## 검토 방법

이 diff 는 5라운드째 리뷰다. 이전 라운드들(`11_27_29`~`12_50_37`)이 이미 지적·수정한 사항은
재등재하지 않고, 직전 라운드(`12_50_37` maintainability WARNING — backend/frontend 접두 경계
비대칭)를 해소한 최신 커밋(`4dca96cc4`, 이 라운드가 검토하는 실질 diff)을 중심으로 원본 파일을
`Read`/`git show`로 직접 대조했다.

## 발견사항

- **[WARNING]** 직전 라운드 WARNING 을 고치는 과정에서, `sot` 라는 로컬 변수가 같은 파일 상단의
  `import * as sot from "@workflow/masked-markers"` 를 **가린다(shadow)** — 이름은 같지만
  의미는 완전히 다른 두 값(패키지 네임스페이스 객체 vs 정규화된 경로 문자열)이 같은 식별자를
  공유한다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:11`
    (`import * as sot from "@workflow/masked-markers";`) 와 `:143`
    (`const sot = SOT_DIR.split(path.sep).join("/");`, `findMirrorRedeclarations` 함수 내부
    안쪽 `for` 루프 안)
  - 상세: `git show 4dca96cc4` 로 확인한 결과, 이 로컬 `const sot` 는 직전 라운드
    (`12_50_37` WARNING 1 — backend 만 접두 경계가 고쳐지고 frontend 는 안 고쳐진 비대칭)를
    해소하는 이번 라운드의 수정에서 새로 도입됐다. 문제는 두 가지가 겹친다. (1) **네이밍 충돌**
    — 이 파일이 통째로 "SoT(Source of Truth) 미러 재발 방지"를 다루는데, 정작 `sot` 라는
    이름이 함수 안에서 "가져온 패키지"에서 "정규화된 SOT_DIR 문자열"로 조용히 뜻이 바뀐다.
    현재는 이 스코프 안에서 import 된 `sot`(패키지 네임스페이스)를 쓰지 않으므로 당장 동작
    결함은 없지만, 이후 이 함수에 로직을 추가하며 `sot.MASKED_MARKERS` 같은 참조를 의도한
    사람이 있다면 조용히 로컬 문자열을 가리키게 되어 타입 에러 없이 틀린 값을 참조할 위험이
    있다(변수 타입이 둘 다 넓게 보이는 값이 아니라 바로 컴파일 에러가 나긴 하겠지만, 그 전에
    "왜 `sot` 가 여기선 문자열이지?" 라는 디버깅 비용이 먼저 든다). (2) **같은 줄이 여전히
    루프 불변 값 재계산**이다 — `SOT_DIR.split(path.sep).join("/")` 는 순회 대상(`rel`,
    `absolute`)에 의존하지 않는데 안쪽 `for` 루프(스캔 파일 500개 이상, 테스트가 하한을
    못박음) 매 반복 재계산된다. 이전 라운드(`11_27_29` maintainability)가 지적한 것과 같은
    형태의 문제가 이번 수정으로 사라지지 않고 오히려 "이름 붙은 로컬 변수"로 고정돼 더
    두드러졌다. 대조되는 backend 쌍둥이(`codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:141`)는
    `SOT_DIR` 자체를 슬래시 리터럴로 선언해 두어 이런 재계산·섀도잉이 애초에 없다 — 두 사본이
    "같은 로직"이라고 헤더에서 서로 명시하지만 실제 구현 형태가 이번에도 미묘하게 갈렸다(이
    PR 이 4라운드 연속 겪은 "쌍둥이 파일의 조용한 divergence" 패턴의 다섯 번째 사례).
  - 제안: 로컬 변수를 루프 밖으로 끌어올리고 이름을 `sot` 대신 의미가 분명한 `sotPrefix` 등으로
    바꾼다 — 섀도잉과 재계산을 한 번에 해소한다.
    ```ts
    export function findMirrorRedeclarations(repoRoot: string): MirrorRedeclaration[] {
      const sotPrefix = SOT_DIR.split(path.sep).join("/");
      const out: MirrorRedeclaration[] = [];
      for (const rel of resolveScanDirs(repoRoot)) {
        for (const absolute of listSourceFiles(path.join(repoRoot, rel))) {
          const relPath = path.relative(repoRoot, absolute).split(path.sep).join("/");
          if (relPath === sotPrefix || relPath.startsWith(`${sotPrefix}/`)) continue;
          ...
    ```
    (선택) `eslint` 의 `no-shadow` 류 규칙을 이 패키지/frontend 설정에 켜 두면 이런 종류의
    조용한 섀도잉을 기계가 다음번에 잡아 준다 — 현재 `codebase/frontend` eslint 설정에
    `no-shadow` 가 켜져 있는지는 이번 리뷰에서 확인하지 않았다.

## 미조치·기존 확인 사항 (재등재하지 않음)

이전 라운드들이 이미 INFO 로 등재·불요 판정한 항목(재export 지점 JSDoc 중복, `prepare`
스크립트 9번째 복제, `SOT_DIR` 정규화가 backend 는 리터럴/frontend 는 `split+join` 로 다른 것
자체, `pnpm-lock.yaml` 노이즈, backend `deepRedactSecrets` 깊이 경계 테스트 부재)은 이번
재검토에서도 그대로이며 새로 악화되지 않았다. 함수 길이·중첩 깊이·순환 복잡도는 두 미러 가드
파일(`masked-marker-mirror-guard.ts` 양쪽) 모두 여전히 낮다 — 가장 복잡한 함수도 `for`-`for`-`if` 3단 중첩에 그치고, 각 함수는 단일 책임(`listSourceFiles`/`findRedeclaredSymbols`/
`resolveScanDirs`/`findMirrorRedeclarations`)을 유지한다. 신규 테스트 케이스(함수 선언 재선언
캐너리, 접두 겹침 형제 캐너리)는 backend/frontend 양쪽에 구조적으로 대칭 추가되어 있다(설명
문구·fixture 형태까지 일치, `it.each` 순서도 동일) — 이번엔 테스트 자체의 쌍둥이 divergence는
없다.

## 요약

이 라운드의 실질 diff(`4dca96cc4`)는 직전 라운드 WARNING(backend 만 접두 경계가 고쳐지고
frontend 는 누락된 비대칭)을 정확히 해소했고, 그 해소를 뮤테이션으로 실증하는 캐너리 테스트도
양쪽에 대칭으로 추가했다 — 목적 자체는 완전히 달성됐다. 다만 그 수정 코드 자체가 새로운 유지
보수성 흠을 하나 남겼다: frontend 쪽 `findMirrorRedeclarations` 안에서 도입한 로컬 `const sot`
가 파일 상단의 `import * as sot` 를 섀도잉하면서 동시에 이전에 지적됐던 루프-불변 값 재계산
문제를 그대로 이어받는다. 당장 동작 결함은 아니지만, "SoT" 를 다루는 바로 그 가드 파일 안에서
`sot` 라는 이름이 두 가지 다른 뜻으로 쓰이는 것은 이 PR 이 반복해서 겪어 온 "쌍둥이 파일의
조용한 divergence" 패턴과 같은 계열의 흠이며, 다음 유지보수자의 재발견 비용을 낮추기 위해
변수명을 바꾸고 루프 밖으로 끌어올리는 값싼 수정을 권한다. 그 외 함수 길이·중첩 깊이·네이밍
컨벤션·매직 넘버·중복 코드 축에서는 이번 라운드에 새로 지적할 사항이 없다.

## 위험도
LOW
