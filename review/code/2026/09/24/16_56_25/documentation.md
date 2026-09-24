# 문서화(Documentation) 리뷰

## 검토 범위

`git diff origin/main...HEAD` 기준 실제 코드/설정/plan 변경은 8개 파일이다 (476 insertions,
22 deletions):

- `PROJECT.md` (기존 정책 문장에 트리거 발화·해소 레버 추기)
- `codebase/backend/jest.config.ts` (헤더 주석 갱신 + `transformIgnorePatterns` 주석 전면 교체)
- `codebase/backend/package.json` (jest 호출 스크립트 5곳에 `--experimental-vm-modules` 도입)
- `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (신규 128줄, 불변식 가드)
- `codebase/backend/test/jest-e2e.json` (`transformIgnorePatterns` 를 기본값으로)
- `plan/in-progress/jest-esm-native-load.md` (신규, 조사·실측·근거 전문)
- `plan/in-progress/nestjs-v12-coordinated-upgrade.md` (신규 스텁, 후속 작업 선행조건 기록)
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (기존 트래커에 후속 항목 2건 추가)

나머지 85개 파일(`review/code/2026/09/24/{14_24_10,15_26_17,16_02_28,16_29_15}/**`,
`review/consistency/2026/09/24/{12_57_36,13_55_20}/**`)은 이 PR 의 이전 리뷰 라운드 산출물로,
이미 각 라운드의 RESOLUTION 사이클을 거쳤다. 이번 라운드에서 별도의 문서화 결함으로
재검토하지 않았다(이미 자기완결적 보고서이며, 이 라운드의 신규 코드 변경이 아니다).

## 발견사항

문서화 관점에서 지적할 CRITICAL/WARNING 급 결함은 찾지 못했다. 아래는 확인 결과와 함께
경미한 관찰(INFO)이다.

- **[INFO]** 코드 변경 규모(jest 설정/스크립트)에 비해 문서화 밀도가 이례적으로 높다 — 긍정적
  관찰.
  - 위치: `codebase/backend/jest.config.ts:19-41`, `codebase/backend/src/repo-guards/__tests__/esm-native-load.spec.ts` (파일 전체), `plan/in-progress/jest-esm-native-load.md` (파일 전체)
  - 상세: `jest.config.ts` 의 `transformIgnorePatterns` 주석은 게이트가 Node 버전이 아니라
    `--experimental-vm-modules` 플래그라는 점, 두 변경(허용목록 제거 + 플래그)이 "한 쌍"이며
    어느 한쪽만 되돌리면 깨진다는 실측(`uuid@13` 사례)까지 기재한다. 신규 스펙 파일
    (`esm-native-load.spec.ts`)은 각 단언마다 "무엇을 덮고 무엇을 덮지 못하는지" 경계를
    명시하고, `plan/in-progress/jest-esm-native-load.md` 는 실측표·판별실험·뮤테이션표를
    갖췄다. 세 문서(코드 주석/테스트 주석/plan) 간 서술이 서로 모순 없이 일치함을 교차
    확인했다(Node 24.20 언급, "한 쌍" 서술, `uuid` canary 근거 모두 일치).
  - 제안: 없음 — 향후 PR 의 참고 사례로 남겨도 좋다.

- **[INFO]** `PROJECT.md` 정책 문장 갱신은 인접 서술을 건드리지 않고 원문을 취소선으로
  보존하는 자기-반증형 소정정 규약을 정확히 따른다.
  - 위치: `PROJECT.md` §버전·도구 정책 (기존 "테스트 프레임워크 이원화" 불릿)
  - 상세: 취소선 처리된 원문 뒤에 "그 트리거는 2026-09-24 backend 에서 한 번 발화했고 …
    이행이 아니라 두 줄로 풀렸다"는 정정을 덧붙이고, 실측 근거(가드 스펙 헤더 참조)와
    적용 범위 한계("적용·검증된 것은 backend 뿐이고 packages/\* 에서는 아직 재지 않았다")를
    함께 명시했다. `.claude/config/doc-sync-matrix.json` 의 행 추가 대상(신규 API 엔드포인트·
    UI 문자열·노드 스키마 등)에 해당하지 않으므로 매트릭스 동기 갱신도 불필요 — 확인함.
  - 제안: 없음.

- **[INFO]** README 는 갱신이 필요 없음을 확인했다.
  - 위치: `codebase/backend/README.md:21-23`
  - 상세: README 는 `npm run test` / `test:e2e` / `test:cov` 를 스크립트 **이름과 의도**로만
    설명하고 내부 호출 형태(`node --experimental-vm-modules ...`)는 노출하지 않는다. 이번
    변경은 스크립트의 외부 인터페이스(이름·동작 결과)를 바꾸지 않고 내부 구현만 바꾸므로
    README 갱신 불필요 — 확인함.
  - 제안: 없음.

- **[INFO]** CHANGELOG 미기재는 이 PR 의 결함이 아니라 이미 트래킹된 정책 공백이다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 항목 "CHANGELOG
    「해당 없음」 판정에 성문 근거가 없다")
  - 상세: 이번 PR 은 빌드/테스트 도구만 바꾸며 `CHANGELOG.md` 항목이 없다. `CHANGELOG.md`
    최근 143개 항목이 전부 제품 동작 변경이라는 선례와 일치하므로 이 PR 자체는 누락이
    아니다. 다만 그 판정 기준이 `PROJECT.md`/`doc-sync-matrix.json` 어디에도 성문화돼
    있지 않다는 진짜 공백은 이미 이 PR 이 `spec-draft-nullable-notation-followups.md` 에
    후속 항목으로 등재해 뒀다(우선순위: 낮음). 별도로 재-flag 하지 않는다.
  - 제안: 없음(이미 처리됨).

## 관측된 이상 상태 (뮤테이션 오염 — 보고 의무)

리뷰 도중 `git status --short` 로 확인한 결과, 저장소 트리에 다음과 같은 **내가 만들지 않은**
미커밋 변경이 있었다:

```
 M codebase/backend/package.json
```

```diff
-    "test:debug": "node --experimental-vm-modules --inspect-brk -r tsconfig-paths/register -r ts-node/register ./node_modules/jest/bin/jest.js --runInBand",
+    "test:debug": "node --experimental-vm-modules --inspect-brk -r tsconfig-paths/register ./node_modules/jest/bin/jest.js -r ts-node/register --runInBand",
```

이 리뷰는 병렬 fan-out 이며 본 세션은 Read/Bash(읽기·grep·ls)만 수행했고 `Write`/`Edit` 로
저장소 파일을 건드리지 않았다. 위 변경은 `-r ts-node/register` 를 진입점(`jest.js`) 뒤로
옮긴 형태로, `esm-native-load.spec.ts` 의 "M10/M11" 계열 뮤턴트(4라운드에서 실제로 겪은
`-r` 순서 결함 재현)와 정확히 같은 모양이다 — 다른 병렬 reviewer 가 그 가드를 검증하려고
저장소 안에서 직접 뮤테이션 중인 것으로 보인다. 규약(`git checkout`/`restore` 금지, 남의
미커밋 변경을 되돌리지 말 것)에 따라 **되돌리지 않았다.** 이 리포트 작성 시점 기준 그
변경은 여전히 워킹트리에 남아 있다 — 다음 라운드/최종 병합 전에 원 소유 reviewer 가
직접 원복했는지 `git status --short` 로 재확인이 필요하다.

## 요약

실제 코드 변경(jest 설정 3파일 + 신규 가드 스펙 1파일)과 신규/갱신 plan 문서 3건은 예외적으로
높은 문서화 수준을 보인다 — 인라인 주석이 "왜" 를 설명하고, 실측·판별실험·뮤테이션 근거가
코드/plan/PROJECT.md 세 층에 걸쳐 서로 모순 없이 교차 인용된다. README·CHANGELOG·
doc-sync-matrix 는 확인 결과 갱신이 불필요하거나 이미 별도로 트래킹돼 있다. 신규로 지적할
CRITICAL/WARNING 급 문서화 결함은 없다. 다만 리뷰 도중 다른 병렬 reviewer 로 추정되는
`codebase/backend/package.json` 미커밋 뮤테이션을 관측했으며, 규약에 따라 되돌리지 않았음을
위에 명시했다.

## 위험도

NONE
