# 테스트(Testing) 리뷰 — `@workflow/masked-markers` 추출 (라운드 6, `13_34_34`)

이 PR 은 5라운드(`11_27_29`~`13_14_29`)에 걸쳐 이미 리뷰·수정이 반복됐고, 직전 라운드(`13_14_29`)
는 위험도 LOW·발견 성격이 "동작 → 문서 정확성" 으로 수렴했다고 판정했다. 이번 라운드는 그
수렴 이후 상태(커밋 `10fcc43e2`, 순수 JSDoc 정정 + 루프 불변 호이스트)를 테스트 관점에서
재검토한 결과다. 실제로 관련 스위트를 전부 로컬 실행해 GREEN 을 확인했다 —
`codebase/packages/masked-markers` jest 20/20, backend jest(미러 가드 + `sanitize-error-message`)
89/89, frontend vitest(미러 가드 + `masked-markers` 유틸) 38/38, frontend repo-guards 형제 스위트
(`internal-package-registration`/`typescript-toolchain`/`shared`) 82/82 — 전부 통과.

## 발견사항

- **[INFO]** backend `deepRedactSecrets` 의 깊이 상한 테스트가 경계값을 못박지 않는다
  — 이미 추적됨, 재확인
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts` — `describe('deepRedactSecrets …')` 안 `it('caps recursion depth …')` (해당 파일 39번째 줄 부근, 이번 diff 로 변경되지 않은 기존 파일)
  - 상세: `MAX_REDACT_DEPTH` 가 이번 PR 로 `@workflow/masked-markers` 의 `MAX_MASK_DEPTH` 별칭이 됐지만, 이 테스트는 깊이 25 중첩을 만들어 `not.toThrow()` 만 본다. 값이 실수로 바뀌어도(예: 10→1) backend 스위트만으로는 감지되지 않는다 — frontend `masked-markers.test.ts` 의 `[경계] 상한 깊이(10)에 놓인 마커는 잡는다`/`[경계] 상한보다 깊은 마커는 보지 않는다` 처럼 상한값을 양방향으로 못박는 테스트가 backend 에는 없다.
  - 이미 `plan/in-progress/masked-marker-shared-package.md` §후속(이 PR 밖) 에 등재돼 있고, 직전 라운드(`13_14_29`)에서도 "조치 불요·저위험(`codebase/packages/**` 변경은 양쪽 워크플로 모두 relevant 라 프런트 경계 테스트가 같은 PR 에서 함께 돈다)"으로 처분됐다. 이번 라운드도 같은 판정 — 새로 발견된 결함이 아니라 정상적으로 추적 중인 항목임을 재확인.
  - 제안: 조치 불요(이미 추적·저위험). backend `deepRedactSecrets` 를 직접 건드리는 다음 PR 에서 `it("[경계] MAX_REDACT_DEPTH/MAX_REDACT_DEPTH+1", …)` 형태로 값싸게 닫을 수 있다.

- **[INFO]** frontend 깊이 경계 테스트가 `MAX_MASK_DEPTH` 를 import 하지 않고 리터럴 `10`/`11` 을 그대로 쓴다
  - 위치: `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts` — `it("[경계] 상한 깊이(10)에 놓인 마커는 잡는다 …")` / `it("[경계] 상한보다 깊은 마커는 보지 않는다 …")` (해당 파일 92~105번째 줄 부근, 이번 diff 로 변경되지 않은 기존 파일)
  - 상세: 이 PR 이전엔 `MAX_MARKER_SCAN_DEPTH = 10` 이 같은 파일에 선언돼 있어 리터럴 하드코딩이 "0-hop" 이었다. 이번 PR 로 SoT 가 `@workflow/masked-markers` 패키지로 옮겨갔는데, 이 테스트는 여전히 `nest(10, …)`/`nest(11, …)` 로 값을 손으로 박아 둔 채다. `MAX_MASK_DEPTH` 가 바뀌면 이 테스트가 **RED 로 죽어서** 잡아 주긴 하지만(vacuous 아님), "두 스택이 손으로 숫자를 맞춰야 하는" 부담을 패키지 뒤로 완전히 없애지는 못했다 — 정확히 이 PR 이 없애려던 유지보수 클래스의 축소판이 테스트 코드 안에 남았다. 대조적으로 backend `reject-masked-resubmission.spec.ts`/`strip-external-only-fields.spec.ts` 는 이미 `MAX_REDACT_DEPTH` 를 import 해 값 자체를 못박지 않는다.
  - 제안: `import { MAX_MASK_DEPTH } from "@workflow/masked-markers"` 를 추가해 `nest(MAX_MASK_DEPTH, …)` / `nest(MAX_MASK_DEPTH + 1, …)` 로 바꾸면 패키지 상수가 바뀌어도 테스트를 손으로 따라가지 않아도 된다. 이번 PR 이 건드리지 않은 기존 파일이라 이번 라운드의 블로킹 사유는 아니다(값싼 후속).

- **[INFO]** backend 미러 가드 spec 의 루트 탐색이 고정 상대경로다 — 이미 추적됨, 재확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:33` (`const repoRoot = path.resolve(__dirname, '../../../../..');`)
  - 상세: frontend 쌍둥이는 `_shared.ts` 의 `repoRoot()`(`pnpm-workspace.yaml` marker 탐색)를 쓰는데, backend 사본은 `__tests__` 깊이를 고정 카운트로 가정한다. 파일이 이동하면 조용히 엉뚱한 디렉터리를 스캔할 위험이 있으나, `[캐너리] 스캔 대상 파일 목록이 비어 있지 않다`(`dirs.length >= 3` + 파일 수 `> 500`)가 완전 이탈 시 백스톱 역할을 한다. 라운드 2(`11_53_49` 항목4)에서 이미 지적·"급하지 않음"으로 판정된 항목과 동일 — 이번 라운드도 실질 변화 없음.
  - 제안: 조치 불요(백스톱 존재). 다음에 backend 사본을 고칠 기회에 marker 탐색 방식으로 통일 검토.

## 긍정적 관찰

- 신설 패키지 `codebase/packages/masked-markers/src/__tests__/index.spec.ts`(20 tests)는 상수 간
  **상호** 정합만 보는 자기참조 함정을 피하려 `it.each` 로 세 마커 리터럴을 직접 못박고
  (`[캐너리] %s 리터럴 고정`), `Object.freeze(Set)` 이 플라시보였던 과거 결함을 재발 가드로
  고정했으며(`.push()` 가 실제로 throw 하는지까지 확인), `isMaskedMarker` 의 정확 일치 경계
  (부분 포함·접두·접미·공백·빈 문자열·유사 리터럴)와 비문자열 입력(`number`/`null`/`undefined`/
  `object`/`array`)을 모두 커버한다.
- backend/frontend 쌍둥이 미러 재발 가드(`masked-marker-mirror.spec.ts`/`.test.ts`)는 각각
  vacuity 방지 캐너리(스캔 디렉터리·파생 심볼 목록이 비지 않음), 양성 탐지 캐너리(합성 fixture
  로 실제 재선언을 잡는지 확인), 오탐 회피 캐너리(재export·지역 별칭·주석/문자열 언급·무관한
  리터럴·접두 겹침 식별자)를 갖추고 있고, 임시 디렉터리 fixture 는 `try/finally` 로 정리해
  테스트 격리가 지켜진다. 실행해 보니 backend jest·frontend vitest 양쪽 다 GREEN.
- 설정 전용 변경(`test-stages.sh` `INTERNAL_PACKAGES`, `packages-checks.yml` matrix/필수체크 목록,
  `codebase/{backend,frontend}/package.json` 의존성)은 "테스트 없는 config 변경"처럼 보이지만
  실제로는 기존 `internal-package-registration-guard.ts`/`.test.ts` 회귀 스위트가 대조한다 —
  로컬 재실행 결과 82/82 GREEN 으로, 새 패키지 등록 누락이 있었다면 여기서 잡혔을 것이다.
  (단, 프로덕션 `Dockerfile` 의 `COPY` 문 완결성은 이 가드의 범위 밖이고 `scripts/
  check-e2e-playwright-config.py` 는 `Dockerfile.playwright-e2e` 만 본다 — 누락 시 docker
  build 단계에서 잡힌다는 파일 내 주석 그대로이며, 다른 8개 내부 패키지와 동일한 기존 패턴이라
  이 PR 이 새로 만든 갭이 아니다.)
- `sanitize-error-message.spec.ts`(이번 PR 로 변경되지 않은 기존 파일)는 재export 후에도
  수정 없이 그대로 통과해, "값 자체는 무변경" 이라는 이 PR 의 핵심 주장을 회귀 스위트로
  뒷받침한다.

## 요약

새 공유 패키지의 자체 테스트, backend/frontend 쌍둥이 미러 재발 가드, 그리고 SoT 이관을
소비하는 기존 회귀 스위트 모두 견고하고 vacuity·오탐·격리를 신경 쓴 설계다. 남은 발견은 전부
INFO 이고, 그중 둘(backend 깊이 경계 미고정, backend 고정 상대경로)은 이전 라운드들에서 이미
식별·저위험 판정돼 `plan/in-progress/masked-marker-shared-package.md` 에 명시적으로 추적 중이다.
새로 짚은 것은 frontend 깊이 경계 테스트가 이제 한 홉 떨어진 패키지 상수 대신 리터럴 `10`/`11`
을 계속 쓴다는 점인데, RED 로 죽는 형태라 vacuous 하지 않고 이 PR 이 건드린 파일도 아니라
블로킹 사유가 아니다. 테스트 관점에서 이 PR 은 병합 가능한 상태다.

## 위험도

LOW
