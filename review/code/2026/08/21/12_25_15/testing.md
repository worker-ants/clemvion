# 테스트(Testing) 리뷰 — masked-marker-contract-7d2e14 (라운드 `12_25_15`)

## 검증 방법

diff 29개 파일을 `Read`로 직접 열어 확인했고, 프롬프트에서 diff가 생략된 신규/기존 파일
(`masked-marker-mirror-guard.ts` backend/frontend, `masked-marker-mirror.test.ts`,
`sanitize-error-message.spec.ts`, `masked-markers.test.ts`, `internal-package-registration-guard.ts`)은
저장소에서 직접 열어 실제 줄 번호로 대조했다. 이전 두 라운드(`11_27_29`, `11_53_49`)의
`testing.md`/`requirement.md` 산출물과 대조해 이미 지적·처분된 항목을 재지적하지 않도록
걸렀다 — 현재 `HEAD`(`1f63bbbef`)가 `11_53_49` 라운드 처분 커밋과 동일함을 `git log`로 확인했으므로
그 라운드 이후 코드 변경은 없다.

## 발견사항

- **[INFO]** backend `deepRedactSecrets`의 깊이 상한(`MAX_MASK_DEPTH`=10) 정밀 경계 테스트가
  여전히 없다 — 공유 패키지 추출로 이 값의 cross-stack 결합이 더 강해졌는데 두 라운드째
  "선존 갭"으로만 기록되고 plan 트래커에는 아직 등재되지 않았다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.spec.ts:239-244`
    (`it('caps recursion depth (deep nesting is masked wholesale, no stack blowup)', ...)` —
    25단계 중첩을 만들어 `not.toThrow()`만 확인). 대조군:
    `codebase/frontend/src/lib/utils/__tests__/masked-markers.test.ts:91-97`
    (`it("[경계] 상한 깊이(10)에 놓인 마커는 잡는다 ...")`) 및 `:111-114`(배열 분기 동일 보폭
    확인)는 `nest(10, "***")` → `true`, `nest(11, "***")` → `false`를 **정확히** 못박는다.
  - 상세: `MAX_REDACT_DEPTH`는 이제 로컬 리터럴이 아니라 `@workflow/masked-markers`의
    `MAX_MASK_DEPTH`를 그대로 쓴다(`sanitize-error-message.ts:128`,
    `export const MAX_REDACT_DEPTH = MAX_MASK_DEPTH;`). 패키지 자신의
    `codebase/packages/masked-markers/src/__tests__/index.spec.ts:91-94`는 의도적으로 값이
    아니라 "정수·양수"라는 타입만 고정한다(주석: "여기서는 타입·부호만 고정한다") — 이건
    합리적 설계다(패키지 테스트가 "backend와 frontend가 같은 값을 본다"를 자기참조적으로
    증명할 수 없으므로). 문제는 그 값의 **실제 소비 지점**에서도 어느 쪽에서도 정확한 경계가
    안 잠긴다는 점이다: frontend `hasMaskedMarkerLeaf`는 위 대조군처럼 리터럴 10/11로 정밀
    고정하지만, backend `deepRedactSecrets`는 "언젠가는 멈춘다"만 검증하고 **정확히 depth
    10에서 치환되는지, depth 9는 그대로 남는지**는 아무 테스트도 보지 않는다. 이 비대칭은
    `MAX_MASK_DEPTH`가 실수로(예: 오타로 `10`→`1`) 바뀌었을 때 **backend 스위트만으로는
    전혀 감지되지 않는다**는 뜻이다. 다행히 `codebase/packages/**` 변경은
    `frontend-checks.yml:44`/`backend-checks.yml:62` 양쪽 모두 relevant라 프런트 스위트가
    사실상 백스톱 역할을 하므로(같은 PR에서 최소 한쪽은 반드시 RED가 난다) 현재 실질 위험은
    낮다. 다만 이 정확한 갭은 `11_53_49` 라운드 `testing.md`에서 이미 "미해소, 의도적 이월"로
    지목되며 "plan 트래커에 한 줄 옮겨 적는 편이 안전하다"고 명시적으로 권고됐는데,
    `plan/in-progress/masked-marker-shared-package.md`·
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 어디에도 이 항목이
    후속 작업으로 등재되지 않았다(`grep -n "deepRedactSecrets\|경계 테스트" plan/in-progress/*.md`
    로 재확인 — 등재 없음). `review/**`는 SoT가 아니므로 이 권고가 산출물 안에만 두 번째로
    묻히는 형태다.
  - 제안: (a) `sanitize-error-message.spec.ts`에 frontend와 대칭인 `it.each`형 경계 테스트
    ("depth 9까지는 원 구조 보존, depth 10에서 `[REDACTED_DEPTH]`로 치환")를 값싸게 추가한다
    (frontend `nest`/`nestArr` 헬퍼 패턴을 그대로 이식 가능). (b) 이번 기회에 이 항목을
    `plan/in-progress/masked-marker-shared-package.md`의 후속 작업 절이나
    `spec-sync-external-interaction-api-gaps.md`에 한 줄 등재해, 세 번째 라운드에서도
    "이월"로만 남지 않게 한다.

- **[INFO] (확인 — 조치 불요, 재확인 낭비 방지용 기록)** `findMirrorRedeclarations`의 `SOT_DIR`
  자기 제외 분기가 여전히 도달 불가능한 죽은 분기다 — 새 리스크 없음, 기존 처분 유지
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:44-53`
    (`resolveScanDirs`)·`:132`(`if (relPath.startsWith(SOT_DIR)) continue;`) /
    `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:39-48`·`:134`.
    실측: `codebase/packages/src`는 존재하지 않으므로(`packages/`는 하위에 개별 패키지
    디렉터리를 두는 구조) `resolveScanDirs`가 만드는 스캔 대상은 항상
    `codebase/backend/src`·`codebase/frontend/src`·`codebase/channel-web-chat/src` 셋뿐이고
    `codebase/packages/**` 전체(=masked-markers 자신뿐 아니라 `ai-end-reason` 등 나머지
    6개 형제 패키지도)가 스캔에서 빠진다. `SOT_DIR` 배제 분기는 이 세 트리 어디에도
    걸리지 않으므로 실행되지 않는다.
  - 상세: 이 정확한 갭은 `11_27_29`(architecture/maintainability)와 `11_53_49`
    (`testing.md`·`requirement.md`) 두 라운드에서 이미 각각 "도달 불가·실질 위험 0(방어적
    no-op)"으로 판정되고 `RESOLUTION.md` "미조치 INFO"로 명시 보류됐다. 이번 라운드에서
    관련 파일에 diff가 없음(HEAD가 `11_53_49` 처분 커밋과 동일)을 확인했으므로 상태 변화가
    없다 — 재지적하지 않는다.
  - 제안: 조치 불요(이미 트래킹됨). 참고로만 남긴다: 향후 `codebase/packages/**` 자체를
    스캔 범위에 넣는 변경이 생기면 `startsWith` 대신 경계(`/`) 포함 비교로 바꿔야
    `codebase/packages/masked-markers-old` 같은 형제 디렉터리 오배제를 막을 수 있다는 점은
    이미 두 라운드 전에 기록됐다.

## 확인했으나 문제 없음

- 신규 backend/frontend 미러 가드 테스트(`masked-marker-mirror.spec.ts`/`.test.ts`) 둘 다
  vacuous 방지(스캔 파일 수 하한 500)·파생 vacuous 방지(`SOT_SYMBOLS` 길이·필수 심볼 포함)·
  탐지력(합성 fixture로 실제 재선언 지목)·오탐 방지(재export·지역 별칭·주석·문자열·무관
  리터럴·접두 겹침 식별자 7종)의 4축을 대칭으로 갖춘다. `fs.mkdtempSync` + `finally`의
  `fs.rmSync`로 완전히 격리돼 있어 테스트 간 의존성이 없고, mock 없이 실제 파일시스템으로
  검증해 실제 동작과의 괴리가 없다.
- `codebase/packages/masked-markers/src/__tests__/index.spec.ts`는 리터럴 3종을 `it.each`로
  직접 `toBe`(자기참조 아님) 고정하고, `Object.freeze(new Set(...))`가 플라시보라는 이전
  구현의 실제 함정을 `.push()` 시도 → `TypeError` 단언으로 회귀 고정한다 — 이전
  구현이 실제로 겪은 결함을 캐너리로 만든 좋은 사례.
- 기존 소비처 회귀 테스트(`sanitize-error-message.spec.ts` 등 backend, `masked-markers.test.ts`
  등 frontend)는 이번 두 커밋에서 전혀 수정되지 않았음을 구조로 재확인했다 — re-export shim이
  기존 export 이름(`MASKED_MARKERS`/`isMaskedMarker`/`MAX_REDACT_DEPTH`/`VALUE_MASK_MARKER`
  등)을 그대로 유지하므로 회귀 위험 없이 유효하다.
- `internal-package-registration-guard.ts`/`.test.ts`가 `codebase/packages/*`의 실제 디렉터리를
  실측으로 파생해 `.claude/test-stages.sh`·`packages-checks.yml` 등록 여부를 대조하므로,
  이번에 추가된 `@workflow/masked-markers`의 CI 플러밍 등록 누락은 이 가드가 별도로 잡는다 —
  본 리뷰에서 새로 검사할 필요가 없는 영역이다.
- 테스트 가독성: 각 테스트 앞에 "왜 이 단언이 필요한가"를 설명하는 JSDoc이 일관되게 붙어
  있고(vacuous 방지 이유, 캐너리가 잡았던 실제 실패 사례 등), 프로젝트가 반복 강조하는
  "왜"가 테스트 코드 자체에 남아 있어 후속 유지보수자가 삭제/약화하기 어렵게 설계돼 있다.
  구조적으로도 순수 판정 로직(`-guard.ts`)과 소비 테스트(`.test.ts`/`.spec.ts`)를 분리해
  테스트 용이성이 높다(형제 가드 `internal-package-registration-guard.ts`와 동일 패턴).

## 요약

이번 라운드에서 코드 자체는 `11_53_49` 처분 커밋 이후 변경이 없고(HEAD `1f63bbbef`), 새로
발견된 결함은 없다. 신규 backend/frontend 미러 가드와 패키지 자신의 테스트는 vacuous 방지·
탐지력·오탐 방지 세 축을 대칭적으로 갖춘 높은 품질이며, 기존 소비처 회귀 테스트는 re-export
shim 덕분에 무수정으로도 여전히 유효하다. 남은 발견은 전부 INFO다 — 하나는 이미 두 라운드
전부터 "저위험·조치 불요"로 굳어진 항목(`SOT_DIR` 죽은 분기, `codebase/packages/*` 형제
패키지 미스캔이지만 CI 트리거 설계상 실질 노출 없음)이라 재확인만 기록했고, 다른 하나는
backend `deepRedactSecrets`의 깊이 경계(10/11) 정밀 테스트 부재가 이번 공유 패키지 추출로
결합도가 더 커졌음에도 두 라운드째 plan 트래커에 등재되지 않은 채 이월되고 있다는 점이다 —
실질 위험은 CI 경로 설계(양쪽 워크플로 모두 `codebase/packages/**`를 relevant로 잡음)가
낮춰 주지만, "약속했는데 안 옮겨 적힌" 패턴이 반복되고 있어 이번에 한 줄이라도 트래커에
남기는 것을 권한다. 차단할 결함은 없다.

## 위험도
LOW
