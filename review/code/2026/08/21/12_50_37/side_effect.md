STATUS=success ISSUES=1
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — masked-marker-contract (라운드4, 12_50_37)

## 검토 방법

전체 diff(38개 파일) 대상. 앞선 세 라운드(`11_27_29`, `11_53_49`, `12_25_15`)가 이미 side_effect
관점에서 WARNING 0건(전부 LOW)으로 수렴해 뒀으므로, 이번 라운드는 (a) 그 판정을 `Read`/`grep` 으로
직접 재확인하고 (b) 신규 backend 사본(`masked-marker-mirror-guard.ts`/`.spec.ts`, `11_27_29`
WARNING 1 대응으로 추가된 "쌍둥이 가드")이 frontend 원본과 **정말 동일한 판정 로직**을 갖는지
바이트 단위로 대조하는 데 집중했다. 그 대조에서 이전 세 라운드 어디에서도 지적되지 않은 실질
차이를 하나 발견했다.

## 발견사항

- **[WARNING]** "동일한 탐지 로직의 쌍둥이 사본" 이어야 할 두 가드의 SoT 자기 제외 경계 판정이 실제로는 다르다 — frontend 쪽만 슬래시 경계 없는 접두 문자열 비교
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:143` (함수 `findMirrorRedeclarations` 내부) — 대조 대상: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:141` (동일 함수, 같은 PR 에서 신설)
  - 상세: frontend 는 `if (relPath.startsWith(SOT_DIR.split(path.sep).join("/"))) continue;` 로 SoT 패키지 자신을 재선언 탐지 대상에서 제외하는데, `SOT_DIR = "codebase/packages/masked-markers"` 와 `startsWith` 비교라 **뒤에 `/` 경계가 없다**. 반면 같은 PR 에서 새로 만든 backend 사본은 `if (relPath === SOT_DIR || relPath.startsWith(\`${SOT_DIR}/\`)) continue;` 로 정확 일치 또는 `/` 경계 포함 접두만 인정한다 — 형제 파일이 이미 올바른 형태로 작성돼 있다. 두 파일의 헤더 주석은 "탐지 로직의 중복은 구멍을 만들지 않는다 — 한 사본이 낡아도 다른 사본이 같은 불변식을 자기 트리거에서 계속 지킨다" 고 명시적으로 전제하는데, 그 전제가 성립하려면 두 사본이 **같은 불변식**(같은 경계 판정)을 지켜야 한다. 실제로는 frontend 사본이 한 칸 더 느슨하다 — 향후 `codebase/packages/masked-markers-legacy` 처럼 `SOT_DIR` 문자열을 **접두어로 포함하지만 다른 패키지**가 생기면, frontend 사본은 그 디렉터리를 "SoT 내부"로 오인해 재선언 탐지를 건너뛴다(=`continue`), backend 사본은 정확히 별개 경로로 취급해 계속 탐지한다. `find*` 계열 함수는 순수 함수라 상태 변경·파일 쓰기는 없지만, "이 파일을 스캔 대상에서 뺄지" 를 결정하는 조건 판정 자체가 이 가드의 유일한 산출물이므로, 이 비대칭은 가드의 탐지 표면(무엇을 읽고 무엇을 건너뛰는지)에 대한 실질적 side effect 차이다. 실사용 영향은 완화 요인이 있다 — 이 PR 의 설계 전제상 `codebase/packages/**` 변경은 `frontend-checks.yml`·`backend-checks.yml` 양쪽 모두 relevant 로 잡으므로(파일 2/3 diff, 두 워크플로 모두 `codebase/packages/**` pathspec 보유), 신규 `masked-markers*` 형제 패키지를 추가하는 PR 은 어차피 backend 사본도 함께 실행돼 결국 탐지된다. 다만 이는 **현재 CI pathspec 설정에 우연히 의존하는 완화**이지, 가드 자체의 불변식은 아니다 — 두 워크플로의 pathspec 이 독립적으로 갈리면(이 PR 이 정확히 그 시나리오 때문에 존재한다) frontend 사본만 도는 경로가 생길 수 있고, 그 경로에서는 이 느슨한 경계가 그대로 사각지대가 된다.
  - 제안: frontend 사본의 143행을 backend 사본과 동일하게 `relPath === SOT_DIR || relPath.startsWith(\`${SOT_DIR}/\`)` 형태로 맞춘다(공유 헬퍼로 뽑아 양쪽이 import 하면 이런 드리프트 자체가 재발하지 않는다 — `_shared.ts` 가 이미 그런 목적의 파일이다).

## 재확인 후 문제 없음으로 판정한 항목 (이전 라운드 판정 유지, 직접 재검증)

- **`MASKED_MARKERS` 재export 타입 변경(`ReadonlySet<string>` → `readonly string[]`)**: `grep -rn "MASKED_MARKERS" codebase/frontend/src`(프로덕션+테스트 전수)로 재확인 — 소비처는 `dynamic-form-ui.test.tsx`·`lib/utils/__tests__/masked-markers.test.ts` 둘뿐이고 전부 `[...MASKED_MARKERS]` 스프레드만 사용. `.has(...)` 호출부 없음. 파손 없음.
- **시그니처 불변**: `isMaskedMarker(v: unknown): boolean` 값·이름·시그니처가 backend/frontend 재export 지점 모두에서 이관 전후 동일. `MAX_REDACT_DEPTH`/`MAX_MARKER_SCAN_DEPTH` 는 `MAX_MASK_DEPTH`(=10)의 지역 별칭으로 값 불변.
- **전역 변수**: `MASKED_MARKERS`(`Object.freeze` 된 배열)·`SOT_SYMBOLS`(모듈 최상위 상수, `sot` export 표면에서 파생)는 모듈 스코프 상수이고 런타임 재할당되지 않는다. `index.spec.ts` 가 `.push()` 시도를 `toThrow(TypeError)` 로 직접 캐너리 검증.
- **환경 변수·네트워크**: 신규/변경 파일 전체(`grep -n "process\.env\|fetch(\|axios\.\|http.*request"`)에서 매치 0건.
- **파일시스템 부작용**: 신규 repo-guard 두 쌍(backend/frontend) 은 전부 read-only 스캔(`fs.readdirSync`/`fs.readFileSync`)이고, 캐너리 테스트("실제 재선언을 지목한다")만 `os.tmpdir()` 아래 임시 디렉터리를 만들고 `finally { fs.rmSync(..., { recursive: true, force: true }) }` 로 정리한다 — 단언 실패해도 정리됨. 저장소 소스 트리 안에는 어떤 파일도 새로 만들거나 지우지 않는다.
- **CI 트리거 확장**: `frontend-checks.yml` pathspec 에 `codebase/channel-web-chat/**` 추가는 그 워크플로의 트리거 조건을 넓히는 부작용이지만, 이 PR 의 목적(가드가 세 번째 스택에서도 최소 한 번 실행)과 정확히 일치하고 방향이 "더 많이 실행됨"이라 안전하다.
- **`pnpm-lock.yaml`**: `masked-markers` 문자열 포함 5줄 외 나머지는 `eslint-config-next` peer-dep 해석 그래프 재구성(버전 불변) — PR 의도와 무관하지만 `pnpm install` 의 통상적 부산물이고 이전 세 라운드가 이미 동일 판정.
- **backend 신규 가드의 `typescript` import**: `src/repo-guards/__tests__/**` 는 프로덕션 빌드에서 제외되므로(11_27_29 RESOLUTION 이 `production-build-devdep` 가드 36/36 GREEN 으로 실측 확인) 번들에 새지 않는다.

## 요약

이번 변경(마스킹 마커 상수·깊이 상한을 `@workflow/masked-markers` 공유 패키지로 추출 + backend/frontend 재export shim + 미러 소멸 감시용 신규 repo-guard 쌍)은 값 자체의 시그니처·타입·전역 상태·환경변수·네트워크 축에서 새 부작용을 들여오지 않는다는 이전 세 라운드의 판정을 직접 재확인했다. 다만 이번 라운드에서 처음으로, "탐지 로직 중복은 구멍을 만들지 않는다"는 이 PR 의 핵심 설계 전제 — 즉 backend/frontend 두 가드 사본이 **동일한 불변식**을 지킨다는 전제 — 가 실제로는 깨져 있음을 발견했다. frontend 사본의 SoT 자기 제외 판정이 슬래시 경계 없는 `startsWith` 라 접두 문자열이 겹치는 미래의 형제 패키지를 오탐 없이(=탐지 누락으로) 통과시킬 수 있는 반면, 같은 PR 에서 새로 작성된 backend 사본은 이미 정확한 경계 판정을 쓴다. 현재는 두 워크플로 모두 `codebase/packages/**` 를 relevant 로 잡는 CI 설정 덕에 실사용 위험이 완화돼 있지만, 그 완화는 가드 자체의 불변식이 아니라 우연한 CI 설정 일치에 기댄 것이라 WARNING 으로 기록한다. 그 외 발견은 전부 이전 라운드 판정의 직접 재검증이며 새로운 회귀는 없다.

## 위험도
LOW
