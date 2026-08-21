# 요구사항(Requirement) 리뷰 — masked-marker-contract-7d2e14

## 검토 방법

diff 46개 파일(코드 19개 + CI/등록 8곳 + plan/spec 문서 + 이전 리뷰 라운드(`11_27_29`)와 consistency-check
라운드(`10_45_52`, `10_58_25`) 산출물)을 전수 대조했다. 코드 부분은 diff 만으로 판단하지 않고 실제
worktree 파일을 `Read`/`Grep`으로 열어 확인했고, 다음을 **실행**해 동작을 실측했다:
`@workflow/masked-markers` 패키지 jest(20/20), backend `masked-marker-mirror.spec.ts`(16/16),
frontend `masked-marker-mirror.test.ts`(16/16), `internal-package-registration.test.ts`(48/48),
기존 소비처 테스트(`sanitize-error-message.spec.ts` 69/69, `reject-masked-resubmission.spec.ts` +
`strip-external-only-fields.spec.ts` 등 47/47, frontend `masked-markers.test.ts` +
`dynamic-form-ui.test.tsx` 44/44), `scripts/check-e2e-playwright-config.py`(OK), pnpm workspace
symlink 존재 확인(`@workflow/masked-markers` → `codebase/packages/masked-markers/dist/index.js`).
전부 GREEN.

이 PR은 `plan/in-progress/spec-sync-external-interaction-api-gaps.md`의 두 이월 항목("마커 미러
계약 테스트"·"마커 리터럴 cross-stack 계약 테스트 부재")을 "계약 테스트"가 아니라 backend/frontend에
손으로 복제되던 마커 상수·판정 함수·깊이 상한을 `@workflow/masked-markers` 공유 패키지로 **추출**하는
방식으로 닫는다. 순수 값 이동(동작 무변경)이고, 직전 코드 리뷰 라운드(`11_27_29`)에서 CRITICAL 0 ·
WARNING 3이 나왔고 `RESOLUTION.md`가 그 3건을 전부 수정했다고 주장하는데, 이번 진짜 diff에서
그 수정이 실제로 반영됐는지를 중점적으로 대조했다.

## 발견사항

- **[정보 확인 — WARNING 아님] 직전 라운드 WARNING 3건이 실제로 반영돼 있음을 코드로 확인**
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts` (신규, backend
    사본) · `codebase/packages/masked-markers/src/__tests__/index.spec.ts:22-28` (리터럴 pin
    `it.each`) · `spec/5-system/14-external-interaction-api.md:1624-1631`(R17 SoT 서술 갱신) +
    frontmatter `code:` 목록에 `codebase/packages/masked-markers/src/index.ts` 추가(같은 파일
    상단).
  - 상세: (1) backend CI 경로 게이팅 사각지대 — `backend-checks.yml`의 pathspec(`:60-64`)에
    `codebase/frontend/**`가 없고 `frontend-checks.yml`의 pathspec(`:42-47`)에
    `codebase/backend/**`가 없음을 직접 열어 확인했다. 신설된 backend 사본
    (`masked-marker-mirror.spec.ts`/`-guard.ts`)이 이 갭을 닫는다 — backend jest
    `testRegex: '.*\.spec\.ts$'`(`jest.config.ts`)가 이 파일을 실제로 실행하고(16/16 통과),
    `tsconfig.build.json`의 `exclude`에 `src/repo-guards/**`가 있어(주석에 이 정확한 패턴의
    직전 사고 — devDependency `typescript`가 프로덕션 dist로 샜던 사고 — 가 기록됨) 프로덕션
    번들 오염도 없다. `typescript`는 backend `devDependencies`에 있다. (2) 리터럴 pin —
    `it.each([["VALUE_MASK_MARKER", VALUE_MASK_MARKER, "***"], ...])`가 상수 세 개를 실제
    문자열과 직접 대조해, 이전 "상수들끼리만 비교하는 자기참조적 단언"의 vacuous 위험을 없앴다.
    (3) spec R17 — "backend가 SoT, 프런트가 미러" 서술을 "SoT는 공유 패키지, 양쪽은 재export
    shim" 으로 정정했고 `code:` frontmatter도 패키지 경로를 추가했다. 이 3건 모두 diff에 실재함을
    확인했다(`RESOLUTION.md`의 주장이 허언이 아님).
  - 결론: 발견사항이 아니라 검증 결과 — 조치 불필요.

- **[INFO] 미러 소멸 가드의 `SOT_DIR` 자기 제외 분기가 애초에 도달 불가능하고, 도달 가능해지더라도
  경계 없는 prefix 비교라 형제 디렉터리를 오배제할 수 있다 (이미 직전 라운드에서 인지·의도적 보류)**
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:115`
    (`if (relPath.startsWith(SOT_DIR)) continue;`, `SOT_DIR` 은 같은 파일 `:19` `'codebase/packages/masked-markers'`)
    및 `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:122`
    (`if (relPath.startsWith(SOT_DIR.split(path.sep).join("/"))) continue;`)
  - 상세: `SCAN_DIRS`(같은 파일 `:32-36`/`:32-36`)는 `codebase/backend/src` ·
    `codebase/frontend/src` · `codebase/channel-web-chat/src` 세 트리만 순회한다.
    `SOT_DIR`(`codebase/packages/masked-markers`)은 이 세 트리 어디에도 속하지 않으므로,
    `listSourceFiles`가 만드는 `relPath`는 이론상 `SOT_DIR`로 시작할 수 없다 — 즉 이 `continue`
    분기는 현재 **절대 실행되지 않는 죽은 코드**다. 설령 향후 `SCAN_DIRS`에 `codebase/packages`가
    추가돼 분기가 살아나더라도, `startsWith`는 경계(`/`) 없는 순수 문자열 prefix 비교라
    `codebase/packages/masked-markers-old` 같은 형제 디렉터리도 함께 오배제한다(이 프로젝트가
    반복 지적해 온 "prefix 문자열은 정규화·경계 확인 후에 묻는다" 패턴). 다만 이건 **새로 발견한
    결함이 아니다** — 직전 리뷰 라운드의 `RESOLUTION.md`(`review/code/2026/08/21/11_27_29/RESOLUTION.md`
    "미조치 INFO" 절)가 정확히 "`SOT_DIR` 자기 제외 분기가 현재 도달 불가(방어적 no-op)"로 이미
    인지·기록하고 의도적으로 보류했다. 현재 시점 실질 위험은 0이다(분기 자체가 안 돈다).
  - 제안: 조치 불요(이미 트래킹됨). 재발 방지 차원에서만, 향후 `SCAN_DIRS`에 `codebase/packages`류
    경로가 추가되는 시점엔 `startsWith(SOT_DIR + '/')` 형태로 경계를 명시하는 편이 안전하다.

- **[INFO] spec R17 신규 SoT 서술이 동일 저장소의 선례(`@workflow/ai-end-reason`)가 쓰는 마크다운
  링크 형식을 따르지 않음 (스타일 불일치, 기능 결함 아님)**
  - 위치: `spec/5-system/14-external-interaction-api.md:1625` (`마커 집합과 깊이 상한의 SoT 는
    **공유 패키지 `@workflow/masked-markers`** 다`) — 대조군
    `spec/4-nodes/3-ai/1-ai-agent.md:463` (`SoT 는 [`@workflow/ai-end-reason`](../../../codebase/packages/ai-end-reason/)`
    — 상대경로 마크다운 링크로 패키지 디렉터리를 직접 가리킴).
  - 상세: 두 서술 모두 "SoT는 공유 패키지"라는 사실 자체는 정확히 전달하지만, 선례는 클릭 가능한
    상대경로 링크로 패키지 위치를 명시하는 반면 이번 R17 문구는 backtick 텍스트만 쓴다. 순수 문서
    스타일 차이이고 코드/동작에 영향 없음.
  - 제안: 조치 불요(선택 사항). 향후 편집 기회에 `[@workflow/masked-markers](../../codebase/packages/masked-markers/)`
    형태로 통일하면 두 추출 선례의 일관성이 높아진다.

## 요약

`@workflow/masked-markers` 공유 패키지 추출은 순수 값 이동으로, 마커 3종(`'***'`/`'[REDACTED]'`/
`'[REDACTED_DEPTH]'`)·`isMaskedMarker`·`MAX_MASK_DEPTH`(=10) 값·시그니처가 이관 전후 완전히 동일하고
5곳 이상의 기존 backend/frontend 소비처(재제출 거부 가드·strip-external-only-fields·
interaction.service·dynamic-form-ui 등)가 전부 실측 테스트 통과로 무손상임을 확인했다. 직전 코드
리뷰 라운드가 지적한 WARNING 3건(backend CI 경로 게이팅 사각지대 재도입, 리터럴 미고정 테스트,
spec R17 SoT 서술 stale)은 `RESOLUTION.md`의 주장대로 이번 diff에 실제로 반영돼 있음을 코드·spec
양쪽에서 직접 확인했다. 등록 표면(test-stages.sh·packages-checks.yml·Dockerfile 3곳·package.json
2곳·pnpm-lock.yaml)도 관련 가드(`internal-package-registration.test.ts`,
`check-e2e-playwright-config.py`)가 실측 GREEN이라 누락이 없다. TODO/FIXME/HACK/XXX 잔존 없음,
반환값·에러 경로(non-string/null/undefined/object/array 입력에 대한 `isMaskedMarker` false 반환,
빈 문자열 등)도 캐너리 테스트로 고정돼 있다. 남은 발견은 전부 INFO — 하나는 이미 직전 라운드가
"도달 불가·의도적 보류"로 트래킹한 방어적 no-op 분기의 잠재 취약성을 재확인한 것(신규 결함 아님),
다른 하나는 spec 문서 스타일(마크다운 링크 형식) 사소 불일치다. 기능 완전성·엣지 케이스·spec
line-level 일치 어느 관점에서도 CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도
NONE
