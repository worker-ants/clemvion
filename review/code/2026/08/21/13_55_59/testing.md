# 테스트(Testing) 리뷰 — `@workflow/masked-markers` 추출 (7번째 라운드, `13_55_59`)

## 검토 범위와 방법

이 PR 은 `origin/main` 대비 누적 diff 로 이미 6라운드(`11_27_29`~`13_34_34`) 리뷰·수정을
거쳤다. 이번 라운드에서 새로 얹힌 변경은 직전 라운드(`13_34_34`) WARNING 1건("대칭 캐너리
규칙 문단이 frontend spec 에만 있고 backend spec 에는 없다")을 해소한 커밋 `0e7b6fd4c`
하나뿐이다 — `git show HEAD --stat` 로 확인한 결과 실질 diff 는
`codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` 의 **JSDoc 헤더
문단 추가**뿐이고, 나머지는 이전 라운드들의 `review/**` 산출물이다. 즉 이번 라운드는 테스트
**동작**에 영향을 주는 변경이 없다.

테스트 대상 핵심 파일을 직접 `Read` 로 전문 대조했다 —
`codebase/packages/masked-markers/src/{index.ts,__tests__/index.spec.ts}`,
`codebase/{backend,frontend}/src/**/masked-marker-mirror{-guard,}.{ts,spec.ts,test.ts}`,
`sanitize-error-message.ts`/`masked-markers.ts` 재export shim. 직전 라운드(`13_34_34`
`testing.md`)가 남긴 INFO 3건이 이번 diff 로 상태가 바뀌었는지도 재확인했다.

## 발견사항

이번 라운드에서 새로 발견된 CRITICAL/WARNING 급 테스트 결함은 없다. 직전 라운드가 남긴 INFO
3건은 이번 diff(comment-only)로 상태 변화가 없어 **재확인만** 하고 반복 등재하지 않는다 —

- backend `deepRedactSecrets` 깊이 상한 테스트가 `not.toThrow()` 만 보고 경계값(10/11)을
  못박지 않음(`sanitize-error-message.spec.ts`) — `plan/in-progress/masked-marker-shared-package.md`
  에 이미 등재, 저위험(frontend 가 같은 PR 트리거에서 정밀 경계를 커버).
- frontend 깊이 경계 테스트(`masked-markers.test.ts`)가 `MAX_MASK_DEPTH` 를 import 하지 않고
  리터럴 `10`/`11` 을 그대로 씀 — RED 로 죽는 형태라 vacuous 는 아니고, 이번 PR 이 건드리지
  않은 기존 파일이라 블로킹 사유 아님.
- backend 미러 가드 spec 의 `repoRoot` 가 `path.resolve(__dirname, '../../../../..')` 고정
  상대경로(frontend 는 `pnpm-workspace.yaml` marker 탐색) — vacuity 캐너리(`dirs.length >= 3`
  + 파일 수 `> 500`)가 완전 이탈 시 백스톱 역할을 해 급하지 않음.

- **[INFO]** 이번 라운드가 고친 JSDoc 문단이 한 문장에 두 개의 서로 다른 주장을 이어 붙여
  가독성이 떨어진다 (테스트 코드 자체가 아니라 테스트 파일의 문서 정확성 축 — documentation
  리뷰어 스코프와 겹치므로 여기서는 참고만)
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:36`
    (`* > **규칙**: 판정 분기를 새로 넣거나 고칠 때는 **양쪽에 대칭 캐너리를 함께** 넣는다. 값의 미러와 달리 탐지 로직의 중복은 **한쪽이 낡아도 반대쪽 트리거를 무력화하지 않는다**:`)
  - 상세: `git show HEAD -- .../masked-marker-mirror.spec.ts` 로 확인한 diff 를 보면, 새 "규칙"
    문장이 기존에 있던 "값의 미러와 달리 탐지 로직의 중복은…" 문장 **끝에 그대로 이어 붙었다**.
    frontend 쌍둥이(`masked-marker-mirror.test.ts:39-40`)는 같은 두 주장을 별도 문단으로
    나눠 적었는데, backend 쪽은 한 줄(168바이트, 파일 내 다른 줄의 약 1.3배)에 뭉쳐 있다.
    테스트 실행이나 판정 로직에는 영향이 없고(JSDoc 주석), 이 PR 이 다섯 라운드째 반복
    지적해 온 "네 파일 정보량 대칭" 원칙에서 아주 미세하게 벗어난 형태를 가진다.
  - 제안: 문장 중간에서 줄바꿈해 frontend 와 동일한 문단 구조로 맞춘다. 기능 영향이 없어
    테스트 관점에서는 비차단.

## 긍정적 관찰 (재확인)

- 신설 패키지 스펙(`index.spec.ts`, 20 tests)은 상수 간 **상호** 정합만 보는 자기참조 함정을
  피해 `it.each` 로 세 마커 리터럴을 직접 못박고, `Object.freeze(Set)` 플라시보 회귀를
  `.push()` 가 실제로 throw 하는지까지 확인하는 캐너리로 고정했으며, `isMaskedMarker` 의
  정확 일치 경계(부분 포함·접두·접미·공백·빈 문자열·유사 리터럴)와 비문자열 입력 5종을
  전부 커버한다.
- backend/frontend 쌍둥이 미러 재발 가드는 vacuity 방지(스캔 디렉터리·파생 심볼 비지 않음),
  양성 탐지(합성 fixture), 오탐 회피(재export·지역 별칭·주석/문자열 언급·무관한 리터럴·심볼
  접두 겹침·**경로** 접두 겹침), 함수 선언 형태 재선언 탐지까지 갖춰 6라운드에 걸쳐 실제로
  났던 회귀(스캔 범위 축소·경계 비대칭·함수 선언 미탐지)를 전부 캐너리로 잠갔다. 임시
  디렉터리 fixture 는 `try/finally` 로 정리돼 격리가 지켜진다.
- `resolveScanDirs`/`findMirrorRedeclarations`/`findRedeclaredSymbols` 모두 `repoRoot`/`source`
  를 매개변수로 받아 순수 함수이고, 전역 상태나 `__dirname` 하드코딩에 의존하지 않아(backend
  의 고정 상대경로 계산 자체는 예외) 테스트 용이성이 높다 — 실제로 임시 디렉터리를 만들어
  `repoRoot` 를 주입하는 방식으로 합성 fixture 를 검증할 수 있다.
- 소비처 재export shim(`sanitize-error-message.ts`/`masked-markers.ts`)은 시그니처·리터럴 값이
  전부 동일해 기존 회귀 스위트(`sanitize-error-message.spec.ts` 등, 이번 PR 로 미변경)가 수정
  없이 그대로 통과한다 — "값 자체는 무변경" 이라는 이 PR 의 핵심 주장을 회귀 테스트가
  실증한다.

## 요약

이번 라운드(7번째)의 실질 diff 는 backend 미러 가드 spec 의 JSDoc 문단 추가 하나뿐이며 테스트
동작에는 영향이 없다. 직전 라운드가 남긴 INFO 3건(backend 깊이 경계 미고정, frontend 리터럴
10/11, backend 고정 상대경로)은 전부 이미 추적 중이거나 저위험으로 재확인됐고 상태 변화가
없다. 이번 라운드에서 새로 짚은 것은 그 JSDoc 문단 자체가 두 주장을 한 줄에 욱여넣어 frontend
쌍둥이와 문단 구조가 미세하게 다르다는 점인데, 코드 동작·테스트 판정에 영향이 없는 문서
가독성 문제라 INFO 로만 남긴다. 신규 공유 패키지 테스트·양쪽 미러 재발 가드 테스트 모두
vacuity·오탐·격리·경계값을 신경 쓴 성숙한 설계이고, 6라운드에 걸쳐 실제로 발생한 회귀 형태
(스캔 범위 축소, 심볼/경로 접두 겹침, 함수 선언 미탐지, 섀도잉)를 전부 캐너리로 고정했다.
테스트 관점에서 이 PR 은 병합 가능한 상태다.

## 위험도

NONE
