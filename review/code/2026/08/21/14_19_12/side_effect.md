# 부작용(Side Effect) Review — masked-marker-contract-7d2e14 (통합 라운드, 14_19_12)

## 검토 방법

`git diff origin/main...HEAD` 기준 137개 변경 파일 중 실제 코드/설정 변경 23개(나머지는 이전
7개 리뷰 라운드의 `review/**` 산출물 + spec 1파일)를 대상으로, 소스를 직접 `Read` 해 최종
상태를 확인했다(프롬프트 diff 가 여러 파일에서 절단·생략돼 있어 신뢰할 수 없었다). 이 PR 은
이미 `11_27_29`~`13_55_59` 7라운드 리뷰를 거쳐 Critical 0·모든 WARNING 이 수정 처리된 상태다 —
이번 라운드는 그 최종 코드에 대한 독립 재검증이다.

## 발견사항

- **[INFO]** frontend `MASKED_MARKERS` 의 타입이 `ReadonlySet<string>` → `readonly string[]` 로
  바뀌었다 (재검증 — 실 파손 없음 확인)
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:24` (`@workflow/masked-markers` 로부터
    import), `:56` (`export { isMaskedMarker, MASKED_MARKERS };`)
  - 상세: 이전엔 `export const MASKED_MARKERS: ReadonlySet<string> = new Set([...])` 였으나 이제
    `@workflow/masked-markers` 의 `readonly string[]`(`Object.freeze([...])`, 패키지
    `codebase/packages/masked-markers/src/index.ts:43`)를 그대로 재export 한다. `.has()` 를 호출하는
    소비처가 있었다면 컴파일 타임에 깨졌을 것이나, `grep -rn "MASKED_MARKERS" codebase/frontend/src`
    로 전수 확인한 결과 남은 소비처(`dynamic-form-ui.test.tsx:601`,
    `lib/utils/__tests__/masked-markers.test.ts:27,34`) 는 전부 `[...MASKED_MARKERS]` 스프레드만
    사용해 `Set`/배열 양쪽에서 동일하게 동작한다. import 경로(`@/lib/utils/masked-markers`)는
    보존됐다. 실 소비 함수들(`isMaskedMarker`/`hasMaskedMarkerLeaf`)의 시그니처(`(v: unknown) =>
    boolean`)도 변경되지 않았다 — 확인: `rerun-modal.tsx:124,128`, `dynamic-form-ui.tsx:334,429`,
    `editor-toolbar.tsx:117`.
  - 제안: 조치 불요. 이미 다수 라운드가 동일 결론에 도달했고 이번 재검증도 일치한다.

- **[INFO]** 신규 repo-guard 테스트가 **테스트 실행 시마다** 저장소 전체(`codebase/**/src`)를
  파일시스템 순회하며 `.ts`/`.tsx` 500개 이상의 내용을 읽는다
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts` 의
    `findMirrorRedeclarations`(139-162행, 내부에서 `listSourceFiles`→`fs.readFileSync` 반복 호출) —
    frontend 쌍둥이 `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`
    의 동일 함수(140-163행)도 동형.
  - 상세: `backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:42-44` 와 frontend
    `lib/repo-guards/__tests__/masked-marker-mirror.test.ts:50-53` 가 각각 `it('SoT 패키지 밖에서
    마커 심볼을 재선언하지 않는다', () => expect(findMirrorRedeclarations(repoRoot)).toEqual([]))`
    를 두어, `jest`/`vitest` 스위트가 돌 때마다 `codebase/<stack>/src` + `codebase/packages/<pkg>/src`
    전부를 재귀 순회(`node_modules`/`dist` 만 제외)하고 각 파일을 `readFileSync` 로 읽어 TS AST 를
    파싱한다(자체 캐너리 `masked-marker-mirror.spec.ts:57` 가 "500개 초과"를 하한으로 못박음).
    이는 **파일을 쓰거나 지우지 않으므로** 파괴적 부작용은 아니지만, 매 테스트 실행마다 전체
    저장소 소스 트리에 대한 비트리비얼한 I/O 부하를 추가하는 관측 가능한 부작용이다. 이미 직전
    라운드(`13_55_59` RESOLUTION 미조치 INFO "가드 spec 내 스캔 중복 호출(CI 전용 낭비)")가 같은
    성격을 인지·기록했고 의도된 트레이드오프로 수용됐다.
  - 제안: 조치 불요(이미 알려지고 수용된 설계 결정). 스캔 비용이 유의미하게 커지면(수천 개
    파일 단위) 메모이제이션이나 스캔 범위 축소를 별건으로 검토할 가치는 있다.

- **[INFO]** `frontend-checks.yml` 의 트리거 pathspec 이 `codebase/channel-web-chat/**` 를
  새로 포함해, 그 스택 단독 PR 도 이제 `frontend-checks` 잡을 유발한다
  - 위치: `.github/workflows/frontend-checks.yml:48` (`codebase/channel-web-chat/**` 신규 추가,
    주석이 `codebase/frontend/**` 항목(:43) 과 `codebase/packages/**` 항목(:49) 사이에 근거를 남김)
  - 상세: 이 잡이 마커 SoT 미러 가드(`codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-*`)
    를 호스팅하므로, web-chat 이 마커 심볼을 재선언해도 이 가드가 실행되도록 트리거 범위를 넓힌
    것이다(`11_53_49` RESOLUTION WARNING 1 근거와 일치). 부작용은 이 PR 자체가 명시적으로 의도한
    것이고 커밋 시점 코드에 diff 로 정확히 반영돼 있어 은폐된 변경이 아니다. 다만 실질적 효과로,
    `channel-web-chat` 만 건드리는 향후 PR 은 이전보다 무거운 CI 잡(`frontend-checks`: lint/type
    체크·build 등)을 추가로 돈다 — CI 실행 시간 증가라는 부작용이 명시적으로 트레이드오프됐다.
  - 제안: 조치 불요. 근거가 코드 인접 주석에 남아 있어 향후 리뷰어가 재발견 비용을 치르지
    않는다.

- **[INFO]** 신규 캐너리 테스트 2건이 `os.tmpdir()` 밑에 파일을 생성 — 저장소 트리 밖, cleanup
  확인됨 (재검증 — 문제 아님)
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror.spec.ts:94-115`(합성
    fixture) 및 `:140-165`(접두 겹침 fixture) / frontend 쌍둥이
    `masked-marker-mirror.test.ts:109-130`, `:153-172`.
  - 상세: `fs.mkdtempSync(path.join(os.tmpdir(), ...))` → `fs.mkdirSync`/`writeFileSync` →
    단언 → `finally { fs.rmSync(tmp, { recursive: true, force: true }) }` 구조. 단언 실패 시에도
    `finally` 가 실행돼 임시 디렉터리가 남지 않는다. 저장소 소스 트리 밖에서만 쓰고 지운다.
  - 제안: 없음(확인 목적 기록).

## 확인 완료 — 부작용 없음으로 판정한 항목

- **함수 시그니처 보존**: `isMaskedMarker(v: unknown): boolean`, `MAX_REDACT_DEPTH`(값 10, 이제
  `@workflow/masked-markers` 의 `MAX_MASK_DEPTH` 지역 별칭), 마커 리터럴 값(`'***'`·
  `'[REDACTED]'`·`'[REDACTED_DEPTH]'`) 모두 이관 전후 동일함을
  `codebase/backend/src/shared/utils/sanitize-error-message.ts` 전체 diff 와
  `codebase/packages/masked-markers/src/index.ts` 를 대조해 직접 확인했다. 이 값들을 소비하는
  backend 4개 지점(`websocket.service.ts`, `reject-masked-resubmission.ts`,
  `interaction.service.ts`, `strip-external-only-fields.ts` 참조 주석)은 전부 로컬 재export
  경로(`../../shared/utils/sanitize-error-message`)를 그대로 import 해 시그니처·값 변경으로 인한
  호출자 영향이 없다.
- **전역 가변 상태**: `MASKED_MARKERS` 는 `Object.freeze([...])` — 배열이라 freeze 가 실제로
  요소 변형을 막는다(이전 `Object.freeze(new Set(...))` 는 `Set` 내부 슬롯에 freeze 가 닿지 않는
  placebo 였다는 사실이 패키지 테스트 `index.spec.ts:38-52` 로 문서화·캐너리화됨). 새 전역
  가변 상태는 도입되지 않았고, 오히려 기존의 불변성 결함이 이번에 고쳐졌다.
- **환경 변수·네트워크 호출**: diff 전체에서 `process.env` 읽기/쓰기, `fetch`/`axios`/외부 API
  호출이 신규로 도입된 곳이 없다(CI 워크플로·Dockerfile·package.json 변경은 전부 등록/배선
  성격이고 런타임 코드가 아니다).
  - `codebase/packages/masked-markers/package.json` 의 `prepare` 스크립트가 `pnpm install` 시점에
    `tsc` 를 실행하지만, 이는 저장소 내 8개 형제 패키지가 공유하는 기존 패턴을 그대로 복제한
    것이라 새로운 부작용 클래스가 아니다(로컬 빌드일 뿐 네트워크 호출 없음).
- **이벤트/콜백**: 이 diff 는 이벤트 발행·구독·콜백 등록 지점을 건드리지 않는다(egress 마스킹
  판정 로직 자체는 무변경, 호출 경로만 재배선).
- **CI 필수 체크(branch protection) 미갱신**: `packages-checks.yml:68` 주석이 "required check 로
  등록할 때 6개를 전부 등록해야 한다"고 명시하지만 실제 GitHub 저장소 설정(코드 밖)은 이 diff
  범위가 아니다. 이는 이 파일이 이미 갖고 있던 기존 손-유지 지점(신규 패키지 추가 시 매번
  반복)이지, 이번 PR 이 새로 만든 은폐된 부작용이 아니다.

## 요약

핵심 diff(backend `sanitize-error-message.ts`, frontend `masked-markers.ts`, 신규 패키지
`@workflow/masked-markers`)는 마스킹 마커 상수·판정 함수·깊이 상한을 값·시그니처 불변으로
공유 패키지로 이관하는 순수 리팩터이며, 직접 재검증한 결과 기존 호출자에 대한 파손적 부작용은
없다. 신규로 추가된 미러 재발 방지 repo-guard(backend `masked-marker-mirror.spec.ts` / frontend
`masked-marker-mirror.test.ts` + 각 `-guard.ts`)는 파일을 쓰거나 지우지 않고 읽기 전용으로
저장소를 스캔하며, 유일하게 파일을 생성하는 캐너리 2건은 `os.tmpdir()` 밑에서 `finally` 로
확실히 정리된다. CI 워크플로 변경(패키지 매트릭스 추가, `frontend-checks` 트리거 확장)은 모두
의도가 코드 인접 주석에 명시돼 있고 실행 범위를 넓히는 방향의 알려진 트레이드오프다. 발견된
4건은 전부 INFO 이며 실질적 위험 없이 기록 목적이다 — 이 PR 은 이미 7라운드 리뷰를 거치며 값
자체에는 단 한 번도 지적이 없었고, 이번 부작용 관점 재검증도 그 결론과 일치한다.

## 위험도
LOW
