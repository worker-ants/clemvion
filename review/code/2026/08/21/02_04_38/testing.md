# 테스트(Testing) 리뷰 — EIA §R17 마스킹 재제출 서버측 거부 (5라운드, `02_04_38`)

## 검토 범위 및 사전 확인

이 브랜치는 이미 4라운드(`00_03_57`→CRITICAL 1 fix, `00_39_27`→WARNING 다수 fix, `01_15_47`→
0/0 수렴, `01_38_26`→WARNING 1(repo-guard 부재) fix)에 걸쳐 테스트 관점 리뷰가 수행됐다.
이번 라운드에서 origin/main 대비 실질적으로 **새로 추가된** 코드는 직전 커밋
(`54142453c`, 라운드4 처분)의 산출물 두 파일뿐이다 — 그 외 애플리케이션/테스트 코드
(`reject-masked-resubmission.ts`/`.spec.ts`, `executions.service.ts`,
`workflows.controller.ts`, `trigger-parameter.types.ts`, `sanitize-error-message.ts`,
`executions-rerun.service.spec.ts`, `workflows.controller.spec.ts`)는 라운드1~3에서 이미
심층 검토·재검증됐고 이번 diff 에서 변경되지 않았음을 `git show --stat 54142453c` /
`git show --stat 0a1e5e896` 로 확인했다.

이번 라운드가 처음 다루는 신규 파일:

- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (신규, 순수 로직)
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` (신규, 소비 spec)

위 두 파일을 `Read` 로 전문 열람했고, **뮤테이션 검증**(`findUnexpectedCallers` 의 제외
필터를 `.filter(() => false)` 로 치환 → 3개 테스트 재실행 → 결과 확인 → `git checkout --`
로 즉시 원복, `git status`/`git diff` 로 원복 확인)을 직접 수행했다.

## 발견사항

- **[WARNING]** 신규 repo-guard `findUnexpectedCallers` 의 핵심 능력("실제 위반을 탐지해
  낸다")이 어떤 커밋된 테스트로도 검증되지 않는다 — 뮤테이션으로 실측 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` 함수
    `findUnexpectedCallers` (89~94행, 특히 92행
    `.filter((rel) => !ALLOWED_DIRECT_CALLERS.includes(rel))`); 소비 spec
    `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts` 26~64행
    (`describe('resolveTriggerParameters 직접 호출부 허용목록', ...)` 세 개 `it`)
  - 상세: 이 spec 이 갖는 세 테스트는 각각 (1) 저장소 **현재 상태**엔 위반이 없다
    (`findUnexpectedCallers(...)` 가 `[]`), (2) 허용목록 항목이 죽지 않았다, (3)
    `importsBaseFn` 이 리터럴 문자열 두 개(base 사용/wrapper 사용)를 올바르게 분류한다 —
    셋뿐이다. **"진짜 위반이 있을 때 그 파일을 실제로 지목하는가"를 검증하는 테스트가
    없다.** 92행의 제외 필터(`.filter((rel) => !ALLOWED_DIRECT_CALLERS.includes(rel))`)를
    `.filter(() => false)`(= "스캔된 모든 파일을 허용된 것으로 취급 = 탐지 기능 자체를
    무력화")로 치환하고 `npx jest
    src/repo-guards/__tests__/masked-reject-callers.spec.ts` 를 실행해 확인했다 — **3개
    테스트 전부 그대로 GREEN** 이었다(뮤테이션 직후 즉시 `git checkout --` 로 원복,
    `git status`/`git diff` 로 클린 확인 완료). 즉 이 가드가 지키려는 바로 그 능력(세
    번째 Manual 경로가 base 를 잘못 import 했을 때 RED 를 내는 것)이 실패하는 방향으로
    깨져도 이 3개 테스트는 아무것도 못 잡는다. `RESOLUTION.md`(`01_38_26`)는 *"재검증(뮤테이션):
    `executions.service.ts` 에 base import 를 넣으면 가드가 그 파일을 지목하며 RED"* 라고
    적어 개발 중 수동으로 이 경로를 확인했음을 보여주지만, 그 검증은 **커밋된 자동 테스트가
    아니라 산문 기록**이다 — 다음 사람이 이 파일을 리팩터링해도 회귀를 잡아줄 게 없다. 같은
    저장소의 형제 가드(`eslint-unicorn-peer.spec.ts`)는 정확히 이 실패 모드를 겨냥해
    *"vacuity 방지 — 룰이 조용히 꺼지면(preset 미등록·off 회귀) 이 배열이 비어 통과해
    버린다"* 는 주석과 함께 **합성 위반 fixture**(`eslint-unicorn-peer-fixture.ts` +
    `bad`/`good` 텍스트로 룰이 실제로 발화하는지 직접 확인)를 갖추고 있다 — 이 신규 guard
    는 같은 저장소 관례를 따르지 않은 지점이다.
  - 제안: 임시 디렉터리(`fs.mkdtempSync`)에 `resolveTriggerParameters` 를 직접 import 하는
    가짜 소스 파일 하나를 써 놓고 `findUnexpectedCallers(tmpRoot, tmpRoot)` 가 그 파일을
    정확히 지목하는지 확인하는 캐너리 테스트를 추가한다. 예:
    `it('[캐너리] 허용목록 밖 base import 를 실제로 탐지한다', () => { /* tmp fixture 작성 →
    findUnexpectedCallers 호출 → toEqual(['<relative-path>']) */ })`. 실제 저장소를
    스캔하는 기존 테스트 1과 별도로, 통제된 fixture 로 탐지 방향(positive case)까지
    닫으면 이 가드의 세 결함 클래스(언급-매칭·한줄 import·boolean 단언) 재발 방지 목록에
    "탐지 무력화" 항목까지 채워진다.

- **[INFO]** (이월, `01_38_26` testing.md 에서 이미 등재 후 의도적 미조치 — `RESOLUTION.md`
  "미조치 INFO" 확인) `MASKED_MARKERS`/`isMaskedMarker` 의 `Object.freeze` 하드닝을 직접
  겨냥한 캐너리, `findMaskedResubmissions` 의 `rawSource` 가 **배열 자체**인 경우
  (`isRecord` 가 record-아님으로 판정하는 분기)를 직접 겨냥한 케이스가 여전히 없다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`MASKED_MARKERS`,
    150행 부근) — 대응 spec `sanitize-error-message.spec.ts` 에 `freeze`/`MASKED_MARKERS`
    문자열 grep 0건(재확인); `codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts`
    함수 `findMaskedResubmissions` (121행 `if (!isRecord(rawSource) || !isRecord(values))
    return [];`) — 대응 spec `reject-masked-resubmission.spec.ts` 의 `'null·비객체 raw 를
    안전하게 지나간다'`(313~316행)는 `null`/문자열만 다루고 배열(`[1,2,3]`) 케이스는 없음
    (재확인, grep).
  - 상세: 직전 라운드가 이미 같은 지점을 지적했고 `RESOLUTION.md`(`01_38_26`)가 "필수
    아님, 다음 기회에"로 명시적으로 처분을 미룬 항목이다. 새로 발견한 게 아니라 현재도
    유효함을 재확인해 이월 기록한다 — 실질 위험은 낮다(둘 다 저비용 방어적 보강).
  - 제안: 조치 불요(이전 처분 유지). 다음에 해당 파일을 편집할 기회에 함께 추가 고려.

- **[INFO]** webhook/schedule 경로가 마커 리터럴을 여전히 정상 값으로 수락한다는
  **의도된 제외 경계**를 직접 겨냥하는 행위 테스트가 없다 — 정적 allowlist 로만 고정됨
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts`,
    `codebase/backend/src/modules/schedules/schedule-runner.service.ts` (둘 다
    `masked-reject-callers-guard.ts` 의 `ALLOWED_DIRECT_CALLERS` 에 "외부 시스템이
    저작하는 페이로드 — 마커 리터럴이 정상 값일 수 있다" 로 등재); 대응 spec
    `hooks.service.spec.ts`/`schedule-runner.service.spec.ts` 에 `VALUE_MASK_MARKER`/
    `'***'` 트리거 파라미터 케이스 없음(grep 확인 — `schedule-runner.service.spec.ts` 의
    유일한 `'***'` 매치는 egress 마스킹 이메일 본문 검사로 이 기능과 무관).
  - 상세: 이 PR 의 설계는 "판정 기준은 출처가 아니라 페이로드 저작 주체" 이고, webhook·
    schedule 은 명시적으로 카브아웃이다(`reject-masked-resubmission.ts` 상단 docstring,
    repo-guard allowlist 주석). 이 경계는 **정적 스캔**(신규 repo-guard, base import 위치)
    으로만 고정돼 있고, "이 경로에 마커 리터럴을 넣으면 실제로 통과한다"는 **런타임 행위**
    자체를 확인하는 테스트는 없다. 지금은 문제 없지만(설계 의도가 명확하고 코드가 그대로다),
    이 경계가 향후 실수로 좁혀지거나(예: 누군가 이 두 서비스에도 무심코 wrapper 를 적용)
    넓혀지는(예: 다른 Manual 경로가 base 를 계속 쓰는) 두 방향 모두 이 특정 스펙 파일들의
    행위 테스트로는 못 잡는다 — repo-guard(정적) 쪽만 후자를 잡는다.
  - 제안: 필수 아님. 다음에 이 두 파일을 손댈 기회에 "마커 리터럴이 정상 값으로 통과한다"
    캐너리 1건씩 추가하면 의도된 제외 경계가 정적+행위 양쪽에서 고정된다.

## 관점별 평가

1. **테스트 존재 여부** — 이번 라운드 신규 코드(repo-guard) 자체에 소비 spec 이 있다.
   갭 없음. 핵심 기능(`reject-masked-resubmission.ts` 및 두 호출부)은 이전 라운드에서
   이미 충분히 다뤄졌고 이번 diff 로 변경되지 않았다.
2. **커버리지 갭** — repo-guard 의 "positive detection"(위 WARNING) 이 유일한 실질 갭.
   `listSourceFiles`/`importsBaseFn`/`findUnexpectedCallers` 세 함수 중 앞의 둘은
   간접적으로(dead-entry 캐너리, 리터럴 문자열 테스트) 커버되지만, 세 함수를 **엮는**
   최종 필터 단계는 "위반 없음" 방향으로만 exercised.
3. **엣지 케이스 테스트** — 신규 파일 자체는 죽은 허용목록 항목·접두 겹침 오탐 두 엣지를
   이름 붙은 캐너리로 다룬다(양호). 다만 "탐지 성공" 엣지가 비어 있다(위 WARNING).
4. **Mock 적절성** — repo-guard spec 은 실제 파일시스템(`fs.readFileSync`/`fs.existsSync`)
   과 실제 소스 트리를 그대로 스캔한다 — mock 없음, 실동작과 괴리 없음. 다만 그 대가로
   "위반이 실재하지 않으면 탐지 로직이 정말 동작하는지 증명 못 한다"는 특성을 갖는다(위
   WARNING 의 근본 원인).
5. **테스트 격리** — 세 테스트 모두 전역 상태·순서 의존 없음(순수 함수 + 실 파일시스템
   read-only 접근). 독립 실행 가능.
6. **테스트 가독성** — describe/it 이름과 JSDoc 이 "왜 이 테스트가 필요한가"(가드의 3단계
   자기 결함 이력)를 명시해 가독성이 높다.
7. **회귀 테스트** — 접두 겹침 오탐, 죽은 허용목록 항목 두 회귀는 캐너리로 고정됨. 다만
   "탐지 자체의 회귀"(위 WARNING)는 고정되지 않았다 — 이 가드가 막으려는 바로 그 종류의
   실패(조용한 무력화)에 대해서는 스스로 무방비다.
8. **테스트 용이성** — `findUnexpectedCallers(repoRoot, srcDir)` 가 두 경로를 인자로 받는
   구조라(하드코딩된 절대경로가 아님) 임시 디렉터리를 넣어 격리된 fixture 테스트를 추가하기
   쉽다 — 위 제안이 구조적으로 저비용인 이유.

## 요약

이번 라운드에서 새로 검토 대상이 된 코드는 직전 커밋(`54142453c`)이 추가한 repo-guard
두 파일뿐이며, 나머지 핵심 로직·호출부·기존 spec 은 라운드1~3에서 이미 충분히 검증되고
이번 diff 로 바뀌지 않았다. 신규 repo-guard 자체는 이름 붙은 캐너리(죽은 허용목록·접두
겹침 오탐)를 갖췄지만, **정작 가드가 지키려는 핵심 능력 — "실제 위반을 탐지해 RED 를
낸다" — 을 검증하는 테스트가 없다**는 점을 뮤테이션으로 직접 실증했다(제외 필터를
무력화해도 3개 테스트 전부 GREEN). 이는 같은 저장소의 형제 가드(`eslint-unicorn-peer.spec.ts`)
가 명시적으로 "vacuity 방지" 라는 이름 아래 갖추고 있는 합성 위반 fixture 패턴과 대비된다.
그 외에는 직전 라운드가 이미 등재하고 의도적으로 미조치 처분한 INFO 2건(freeze 캐너리
부재, `rawSource` 배열 케이스 부재)이 여전히 유효하고, webhook/schedule 카브아웃 경계를
런타임 행위로 직접 고정하는 테스트가 없다는 INFO 1건을 추가로 확인했다 — 셋 다 실질
위험은 낮다.

## 위험도

MEDIUM
