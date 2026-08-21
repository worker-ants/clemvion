# 부작용(Side Effect) Review — masked-marker-contract-7d2e14 (13_55_59, 7라운드)

## 검토 방법

이 PR 은 origin/main 대비 누적 diff 로 이미 6라운드 코드 리뷰(`11_27_29`~`13_34_34`)를 거쳤고,
그중 5개 라운드에 side_effect 리뷰가 독립적으로 포함돼 있다(전부 위험도 NONE/LOW, INFO만 잔존).
이번 라운드는 그 수렴 상태를 전제로, 최신 HEAD(`0e7b6fd4c`)의 실제 소스를 직접 `Read` 해
"부작용" 관점 8개 축(의도치 않은 상태 변경·전역 변수·파일시스템·시그니처·인터페이스·환경변수·
네트워크·이벤트/콜백)을 재확인했다. 프롬프트에서 diff 가 생략된 파일(6·7·12·13·21번)은 원본을
직접 열어 대조했다:

- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` (전문)
- `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` (전문)
- `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` (전문)
- `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror.test.ts` (전문)
- `codebase/frontend/src/lib/repo-guards/__tests__/_shared.ts` (전문, `ROOT` 출처 확인)
- `codebase/packages/masked-markers/src/index.ts`, `package.json`
- `git log --oneline -15` 로 라운드1~6 처분 커밋이 실제로 HEAD 에 반영돼 있음을 확인

## 발견사항

새로 발견된 CRITICAL/WARNING 급 부작용은 없다.

- **[INFO]** repo-guard 가 매 테스트 실행마다 `codebase/` 전체를 파일시스템 스캔·읽기(쓰기 아님)한다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` (`listSourceFiles`/`findMirrorRedeclarations`) · 동형 `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`
  - 상세: `findMirrorRedeclarations` 는 `resolveScanDirs` 가 파생한 모든 `codebase/<stack>/src` + `codebase/packages/<pkg>/src` 를 재귀 탐색(`fs.readdirSync`)하고 `.ts`/`.tsx` 전부를 `fs.readFileSync` 로 읽는다. backend jest 와 frontend vitest 양쪽에서 **각자** 이 전수 스캔을 수행하므로(둘 다 `git diff` 확인 결과 같은 로직) 매 테스트 스위트 실행마다 두 번의 저장소 전체 읽기 I/O 가 발생한다. 다만 이는 (a) **읽기 전용**이라 상태 변경 부작용이 아니고, (b) 이 저장소에 이미 존재하는 형제 가드(`internal-package-registration-guard.ts`/`typescript-toolchain-guard.ts`)와 동일한 패턴이며, (c) 직전 라운드(`12_25_15` RESOLUTION)가 "스캔 I/O 2배는 의도된 트레이드오프"로 이미 판단·기록했다. 새로운 위험이 아니라 재확인 기록이다.
  - 제안: 조치 불요.

- **[INFO]** repo-guard 테스트 캐너리 2건이 `os.tmpdir()` 밑에 디렉터리·파일을 생성한다 — 격리·정리 정상 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` (`"[캐너리] 실제 재선언을 지목한다"`, `"[캐너리] SoT 와 접두가 겹치는 형제 패키지는 탐지 대상이다"`) · 동형 frontend `masked-marker-mirror.test.ts`
  - 상세: 두 파일 각각 두 개 캐너리가 `fs.mkdtempSync(os.tmpdir())` → `fs.mkdirSync`/`fs.writeFileSync` → 단언 → `finally { fs.rmSync(tmp, { recursive: true, force: true }) }` 구조다. 저장소 소스 트리 밖에서만 쓰고 단언 실패 시에도 `finally` 가 정리하므로 실제 남는 파일시스템 부작용이 없다. 총 4개 캐너리(양쪽 각 2개) 모두 동일 패턴임을 직접 대조 확인했다.
  - 제안: 조치 불요(기록용 재확인).

- **[INFO]** 신규 `_shared.ts` 소비가 아니라 **기존** `_shared.ts` 의 모듈 로드-시 부작용을 새 파일이 상속한다
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:18` (`import { ROOT } from "./_shared";`) → `_shared.ts` 의 `export const ROOT = repoRoot();`
  - 상세: `_shared.ts` 자체는 이번 diff 의 변경 대상이 아니다(diff 에 없음, 기존 형제 가드 두 개가 이미 공유하던 파일). `repoRoot()` 는 모듈 로드 시점에 즉시 실행되어 `pnpm-workspace.yaml` 을 marker 로 상위 디렉터리를 최대 12단계 탐색하고, 못 찾으면 `throw` 한다 — 이는 import-time side effect 이지만 기존 두 가드(`internal-package-registration-guard.ts`/`typescript-toolchain-guard.ts`)가 이미 이 파일을 import 하고 있어 vitest 스위트 실행 시 어차피 발생하던 것이다. 새 파일이 세 번째 소비처가 됐을 뿐 새 부작용 표면을 만들지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `MASKED_MARKERS` (frontend) 의 타입이 `ReadonlySet<string>` → `readonly string[]` 로 바뀐 인터페이스 변경 — 소비처 재확인 결과 파손 없음
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts` (`export { isMaskedMarker, MASKED_MARKERS };`, 패키지 재export)
  - 상세: 이전 라운드(`11_27_29` side_effect)가 이미 지적·확인한 항목을 이번 라운드에서 `grep -rln "MASKED_MARKERS" codebase/frontend/src`(테스트·가드 자기 자신 제외)로 재실측했다 — `.has()` 를 호출하는 소비처가 여전히 없다(매치 0건). `isMaskedMarker`/`hasMaskedMarkerLeaf` 시그니처(`(v: unknown) => boolean`)는 이관 전후 동일하다.
  - 제안: 조치 불요.

- **[INFO]** CI 워크플로 트리거 확장은 의도된 부작용이며 diff 주석에 명시돼 있다
  - 위치: `.github/workflows/frontend-checks.yml` (`pathspecs` 에 `codebase/channel-web-chat/**` 추가)
  - 상세: 이 변경은 `frontend-checks` 잡의 트리거 범위를 넓혀 `channel-web-chat` 단독 PR 에서도 마커 미러 가드가 돌게 만드는 **의도된** 부작용이다(diff 인접 주석이 근거를 명시: web-chat 전용 워크플로는 해당 가드를 못 돌리므로 대신 여기서 넓힘). 부작용의 성격(다른 팀/PR 의 CI 실행 시간 소폭 증가)은 인지·문서화돼 있어 "의도치 않은" 항목이 아니다.
  - 제안: 조치 불요.

## 재확인만 하고 반복 등재하지 않은 항목 (이전 라운드 결론 유지)

- `pnpm-lock.yaml` 의 `eslint-config-next` peer-dep 재해석 — 이 PR 과 무관, 버전 불변, 6라운드 연속 동일 판정.
- `codebase/packages/masked-markers/package.json` `prepare` 스크립트가 `child_process.execSync('tsc')` 를 실행하는 것 — 기존 8개 형제 패키지와 문자 그대로 동일한 관행(9번째 사본)이며 이 PR 이 새로 만든 부작용이 아니다.
- backend `src/repo-guards/**` 가 production 빌드에서 제외됨(`11_27_29` RESOLUTION 확인, production-build-devdep 가드 36/36 GREEN) — 이번 라운드에서 코드 변경 없음, 재실측 불요.

## 요약

이번 diff 의 실질 부작용 표면은 (1) 신규 공유 패키지 `@workflow/masked-markers` 추출(순수 값·함수, 부작용 없음), (2) backend/frontend 재export shim 화(시그니처·타입 거의 동일, `MASKED_MARKERS` 만 `Set`→배열로 바뀌었으나 소비처 재확인 결과 무해), (3) 신규 repo-guard 테스트 2벌(읽기 전용 파일시스템 스캔 + `os.tmpdir()` 격리 캐너리, 정상 cleanup 확인), (4) CI/Docker/package.json 8곳의 기계적 등록, (5) `frontend-checks.yml` 트리거 범위 확장(의도 명시)이다. 전역 상태 변경·의도치 않은 파일 생성/삭제·호출자에 영향을 주는 시그니처 파괴·예상 밖 환경변수·네트워크 호출·이벤트/콜백 변경 어느 것도 발견되지 않았다. 이미 6라운드에 걸쳐 여러 리뷰어가 동일 스코프를 반복 검증했고, 이번 라운드에서 직접 소스를 재열람해도 새로 등재할 CRITICAL/WARNING 이 없다 — 발견은 전부 기존 결론을 재확인하는 INFO 다.

## 위험도
LOW
