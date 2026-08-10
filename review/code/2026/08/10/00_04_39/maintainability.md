# 유지보수성(Maintainability) 리뷰

## 리뷰 대상
- `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`
- `codebase/frontend/src/lib/docs/__tests__/spec-links.ts`

## 발견사항

- **[WARNING]** `plan/in-progress` 스캔 로직이 같은 파일 안에서 이미 import 된 함수를 두고 재구현됨(중복 코드)
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts:45-59` (`collectTopLevelPlans`)
  - 상세: `plan-frontmatter.test.ts` 는 6번째 줄에서 이미 `spec-links.ts` 의 `collectLivePlanMarkdown` 을 import 하고 있다(`import { collectLivePlanMarkdown, findBrokenPlanLinks } from "./spec-links";`). 그런데 `collectTopLevelPlans` 는 `plan/in-progress` 를 `readdirSync` 로 다시 읽고, `.md` 필터·경로 조립·정렬을 처음부터 재구현한다. 두 함수는 스캔 대상 디렉터리(`plan/in-progress`)가 완전히 동일하고, 차이는 `0-`/`_` 프리픽스 제외 필터 하나뿐이다. 이 저장소는 바로 이 파일의 최상단 주석(줄 21-38)에서 "두 곳이 조용히 틀어졌다"(status 필드 2회 누락)는 교훈을 직접 기록해 둔 상태라, 같은 성격의 파일-시스템 스캔 로직을 두 곳에 따로 두는 것은 재발 위험이 특히 크다. 한쪽 필터 로직(예: 신규 예외 프리픽스 추가)이 바뀌면 다른 쪽은 grep 으로 찾지 않는 한 drift 된다.
  - 제안: `collectTopLevelPlans` 를 `collectLivePlanMarkdown(root)` 결과에 `0-`/`_` 프리픽스 필터만 얹어 파생시킨다.
    ```ts
    function collectTopLevelPlans(root: string): string[] {
      return collectLivePlanMarkdown(root)
        .filter((f) => {
          const name = path.basename(f.absPath);
          return !name.startsWith("0-") && !name.startsWith("_");
        })
        .map((f) => f.absPath);
    }
    ```
    이러면 디렉터리 읽기·정렬 로직은 단일 소스(`spec-links.ts`)만 남는다.

- **[INFO]** 디렉터리 트리 순회 로직이 두 파일에 걸쳐 5곳에서 각각 손으로 재구현됨
  - 위치: `plan-frontmatter.test.ts:45-59`(`collectTopLevelPlans`, flat), `plan-frontmatter.test.ts:62-78`(`collectCompletedPlans`, 재귀 `walk`), `spec-links.ts:268-282`(`collectLivePlanMarkdown`, flat), `spec-links.ts:130-150`(`collectSpecMarkdown`, iterative stack), `spec-links.ts:331-355`(`collectCodebaseSources`, iterative stack + skip-dir 집합)
  - 상세: 다섯 함수 모두 "디렉터리를 읽고, 파일 확장자/프리픽스로 필터링하고, 상대경로를 만들고, 정렬한다"는 동일한 뼈대를 갖지만, 순회 스타일이 재귀(`collectCompletedPlans`)와 반복 스택(`collectSpecMarkdown`, `collectCodebaseSources`) 두 가지로 혼재한다. 각자 스코프가 달라(archive 제외, node_modules/dist 제외 등) 완전 통일이 항상 정답은 아니지만, 순회 스타일 자체가 파일마다 갈리는 것은 향후 유지보수자가 "이 저장소의 표준 순회 패턴이 뭔지" 판단하기 어렵게 만든다.
  - 제안: 최소한 순회 스타일(재귀 vs 스택)만이라도 통일하거나, `walkDir(root, { skipDirs, fileFilter }): string[]` 형태의 공통 저수준 유틸을 두고 각 `collect*` 함수는 필터 콜백만 주입하는 방식을 고려. 강제 리팩터는 아니고 향후 여섯 번째 스캐너가 추가될 때 우선 검토할 사항.

- **[INFO]** `findBrokenLinksInFiles` 내부에 동일 shape 의 violation 객체 생성이 3회 반복
  - 위치: `spec-links.ts:205-212`(same-file ANCHOR), `spec-links.ts:225-232`(DEAD), `spec-links.ts:236-243`(cross-file ANCHOR)
  - 상세: 세 블록 모두 `{ kind, source: f.relPath, line: link.line, target }` 형태를 그대로 반복한다. `kind` 값만 다르다.
  - 제안: `const push = (kind: LinkViolationKind) => violations.push({ kind, source: f.relPath, line: link.line, target });` 같은 로컬 헬퍼로 3곳을 1곳으로 줄이면 향후 필드 추가 시 갱신 지점이 하나로 줄어든다.

- **[INFO]** `isExternal` 의 앞 두 `startsWith` 분기가 뒤따르는 일반 스킴 정규식과 중복
  - 위치: `spec-links.ts:106-115`
  - 상세: 마지막 조건 `/^[a-z][a-z0-9+.\-]*:\/\//.test(t)` 는 `scheme://` 형태를 전부 매치하므로 `http://`/`https://` 를 이미 포함한다. 앞의 두 `startsWith` 체크는 죽은 중복 로직이다(동작에는 영향 없지만 읽는 사람이 "왜 http/https 만 따로 특별 취급하지?"라고 오해할 수 있음).
  - 제안: `mailto:`/`tel:` 체크와 일반 스킴 정규식만 남기고 `http://`/`https://` 개별 분기는 제거해 의도를 명확히 한다.

- **[INFO]** 테스트 임계값(매직 넘버)이 세 곳에 흩어져 있고 성격이 다름
  - 위치: `plan-frontmatter.test.ts:142`(`toBeGreaterThan(5)`, in-progress plan 수), `plan-frontmatter.test.ts:199`(`toBeGreaterThan(20)`, completed plan 수), `plan-frontmatter.test.ts:228`(`toBeGreaterThan(5)`, live plan markdown 수)
  - 상세: 각 숫자는 바로 위 주석으로 근거가 설명돼 있어 완전한 매직 넘버는 아니지만("discovery 가 살아있는가"의 하한선), 세 개의 서로 다른 컬렉션에 대해 각기 다른 하한이 인라인 리터럴로 박혀 있다. 향후 grooming 으로 plan 수가 줄어들며 다시 발화할 가능성(파일 자체가 이미 그 이력을 기술함)이 있는 값들이므로, 이름 있는 상수(`MIN_INPROGRESS_PLANS` 등)로 모으면 재발 시 한눈에 어떤 하한이 문제인지 알기 쉽다.
  - 제안: 필수는 아니나 우선순위 낮은 개선. 강제하지 않음.

## 요약
두 파일 모두 가독성 자체는 높다 — 함수는 짧고 단일 책임에 가깝고, 비자명한 결정마다 근거 주석이 충실히 달려 있어 "왜 이렇게 했는가"를 코드만 보고 추적할 수 있다. 다만 `plan-frontmatter.test.ts` 의 `collectTopLevelPlans` 가 같은 파일에서 이미 import 한 `spec-links.ts` 의 `collectLivePlanMarkdown` 과 거의 동일한 파일시스템 스캔 로직을 별도로 재구현하고 있는 점은, 이 파일 자신이 상단 주석에서 경고하는 "두 곳이 조용히 틀어진다"는 패턴과 정확히 같은 모양의 위험을 새로 만들고 있어 눈에 띈다. `spec-links.ts` 의 `findBrokenLinksInFiles` 는 분기가 많지만 guard-clause(`continue`) 스타일 덕에 중첩이 깊어지지는 않았고, violation 객체 생성 3중복·`isExternal` 의 죽은 중복 분기는 사소한 개선 여지다. CRITICAL 급 이슈는 없다.

## 위험도
LOW
