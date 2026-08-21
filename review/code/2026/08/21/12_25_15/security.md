# 보안(Security) 코드 리뷰 — masked-marker-contract-7d2e14 (라운드3, 12_25_15)

## 검토 범위

이번 diff 는 egress 마스킹 마커(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)와 재귀 깊이 상한
(`MAX_MASK_DEPTH=10`)을 backend `sanitize-error-message.ts` / frontend `masked-markers.ts` 양쪽이
손으로 복제하던 것을 신규 워크스페이스 패키지 `@workflow/masked-markers` 로 추출하는 **순수 리팩터**
누적본이다. 앞선 두 라운드(`11_27_29`, `11_53_49`)에서 지적된 WARNING(가드 배치의 CI 경로 게이팅
사각지대·감시 목록 자체의 손 복제·세 번째 스택 `channel-web-chat` 무방비)이 이번 diff 안에서 이미
수정 커밋(`bf0618a7d`, `1f63bbbef`)으로 반영돼 있어, 그 수정이 실제로 유효한지를 중심으로 재검증했다.

핵심 마스킹 로직(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`/`deepRedactSecrets` 계열,
`isMaskedMarker` 정확-일치 판정, `MAX_REDACT_DEPTH`/`MAX_MASK_DEPTH` 비교 연산자와 값)을
`codebase/backend/src/shared/utils/sanitize-error-message.ts`·
`codebase/frontend/src/lib/utils/masked-markers.ts`·
`codebase/packages/masked-markers/src/index.ts` 전문을 직접 `Read` 로 열어 대조했다 — 정규식 패턴,
`depth >= MAX_REDACT_DEPTH`/`depth >= MAX_MASK_DEPTH` 비교, 값 검사를 깊이 검사보다 먼저 하는 순서
모두 이관 전후 동일하다. 바뀐 것은 마커 상수·깊이 상한의 **선언 위치**(공유 패키지 → import →
재export)뿐이다.

## 발견사항

이번 diff 에서 CRITICAL/WARNING 급 보안 결함은 발견되지 않았다. 참고용 INFO만 남긴다.

- **[INFO]** 재발 방지 가드의 CI 경로 게이팅 사각지대(직전 라운드 WARNING)가 이번 diff 로 해소됨 — 검증 기록
  - 위치: `.github/workflows/frontend-checks.yml:44-48`(pathspec 에 `codebase/channel-web-chat/**`
    추가) · `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`(신규,
    backend jest 트리거) · `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:39-48`(`resolveScanDirs` 가 `codebase/` 하위 디렉터리를 **실측으로 파생**해
    `channel-web-chat/src` 도 자동 포함)
  - 상세: 이 PR 의 핵심 위험은 "egress 마스킹 마커/깊이 상한이 backend·frontend 어느 한쪽에서만
    바뀌면 반대쪽 재발 방지 가드가 CI 상에서 아예 실행되지 않아 조용히 fail-open 한다"는 것이었다
    (마스킹된 값이 프리필/재제출되어 게이트를 우회하는 데이터-무결성 위험, EIA §R17 재제출 거부
    가드와 같은 판정기를 egress 마스킹이 공유하므로 이 판정기가 뚫리면 두 방어선이 동시에 약해진다).
    실측: backend 가드(`masked-marker-mirror.spec.ts`)와 frontend 가드(`masked-marker-mirror.test.ts`)
    가 각각 자기 워크플로(`backend-checks.yml`/`frontend-checks.yml`)에서 저장소 전체(현재
    `codebase/backend/src`·`codebase/frontend/src`·`codebase/channel-web-chat/src` 세 곳,
    `resolveScanDirs` 가 하드코딩이 아니라 `codebase/` 하위 디렉터리를 순회해 파생하므로 스택이
    늘어도 자동 포함)를 스캔한다. `frontend-checks.yml` pathspec 에 `codebase/channel-web-chat/**`
    가 추가되어, backend-only PR 은 backend 가드가, frontend/web-chat PR 은 frontend 가드가 최소
    하나는 반드시 실행된다 — 탐지 로직의 중복은 값의 미러와 달리 한쪽이 낡아도 구멍을 만들지
    않는다(다른 사본이 같은 불변식을 자기 트리거에서 계속 지킴).
  - 제안: 조치 불요 — 이전 라운드 WARNING 이 이번 diff 안에서 실제로 해소됐음을 확인 기록.

- **[INFO]** 가드의 감시 대상(`SOT_SYMBOLS`)이 손 목록에서 패키지 export 표면의 실측 파생으로 바뀜 — vacuous 표면은 캐너리로 닫혀 있음
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:35-38`,
    `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:30-33`
    (`Object.keys(sot).filter(...)`) / 캐너리: `masked-marker-mirror.spec.ts:58-67`,
    `masked-marker-mirror.test.ts:69-78`(`SOT_SYMBOLS.length` 하한 + 핵심 심볼 3종 포함 단언)
  - 상세: `import * as sot from '@workflow/masked-markers'` 가 비거나(빌드 실패·import 경로 오류)
    export 표면이 줄어들면 `SOT_SYMBOLS` 가 `[]` 가 되어 재선언 탐지가 **조용히 무력화**될 수 있는
    구조적 위험이 있으나, 두 캐너리 테스트가 `SOT_SYMBOLS.length >= 6` 및 `MASKED_MARKERS`/
    `isMaskedMarker`/`MAX_MASK_DEPTH` 포함을 직접 단언해 이 vacuous 경로를 막아 둔다. 모듈 interop
    산물(`default`/`__esModule`)과 식별자가 아닌 키는 정규식(`/^[A-Za-z_$][A-Za-z0-9_$]*$/`)으로
    걸러 vitest(ESM)·jest(CJS) 양쪽에서 동일 결과(17건)를 내도록 맞춰져 있음을 RESOLUTION 기록으로
    확인했다.
  - 제안: 조치 불요 — 참고용.

- **[INFO]** 신규 미러 재발 가드는 `__tests__/`/`repo-guards/` 전용 CI 정적 분석 도구 — 런타임 공격면 아님, 경로 입력은 전부 저장소 내부 고정값
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`,
    `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`
    (`listSourceFiles`/`resolveScanDirs`/`findMirrorRedeclarations`)
  - 상세: `fs.readdirSync`/`fs.readFileSync` 가 순회하는 경로는 전부 `path.join(repoRoot, ...)` 로
    구성되며 `repoRoot` 는 테스트 소비처에서 `path.resolve(__dirname, ...)` 로 고정된다 — 외부/
    네트워크/사용자 입력이 경로 구성에 관여하지 않아 경로 탐색이나 임의 파일 읽기 위험이 없다.
    `ts.createSourceFile` 로 파싱하는 소스도 저장소 자신의 `.ts`/`.tsx` 파일이며 신뢰 경계를
    넘는 입력이 아니다. 이 디렉터리는 `production-build-devdep` 가드로 프로덕션 번들 제외가
    검증돼 있다(직전 라운드 RESOLUTION, 36/36 GREEN).
  - 제안: 조치 불요.

- **[INFO]** 프런트 `MASKED_MARKERS` 가 `Object.freeze` 된 배열로 바뀌어 런타임 불변성을 실제로 획득함(개선, 회귀 아님) — 앞선 두 라운드에서 이미 확인된 사항, 이번 diff 에서도 유지됨을 재확인
  - 위치: `codebase/packages/masked-markers/src/index.ts:43-47`(`Object.freeze([...])`), 캐너리
    `codebase/packages/masked-markers/src/__tests__/index.spec.ts:46-52`(`.push()` 시 `TypeError`
    단언)
  - 상세: 이전 프런트 구현(`ReadonlySet<string> = new Set([...])`)은 타입 레벨 readonly 뿐이라
    같은 프로세스 내 코드가 `.add()` 로 실제 변형할 수 있었다. 이 집합은 egress 마스킹 판정기와
    EIA §R17 재제출 거부 가드가 공유하므로, 런타임 변형 가능성 제거는 공격면을 부수적으로 좁힌다.
  - 제안: 조치 불요 — 개선 사항으로 기록.

- **[INFO]** 신규 패키지 devDependency 는 CVE 자동 스캔으로 별도 검증하지 못함(런타임 프로덕션 의존성 아님, 기존 관행과 동일 라인)
  - 위치: `codebase/packages/masked-markers/package.json:13-21`
  - 상세: `eslint`/`jest`/`ts-jest`/`typescript`/`typescript-eslint` 등 전부 build/test 전용이고
    버전대가 저장소 내 기존 7개 패키지와 동일하다. `pnpm-lock.yaml` 대조 결과 이번 diff 로 도입된
    신규 **외부** npm 패키지·버전 상향은 없음(workspace 링크 추가와 `eslint-config-next` peer 축
    재해석뿐, `git diff origin/main..HEAD -- pnpm-lock.yaml` 로 직접 확인).
  - 제안: 정기 `pnpm audit`/Dependabot 파이프라인에 맡긴다 — 이 PR 범위의 조치는 불요.

## 요약

이번 diff 는 backend/frontend 에 손으로 복제되던 egress 마스킹 마커 상수·판정 로직·깊이 상한을
`@workflow/masked-markers` 공유 패키지로 추출하는 순수 리팩터이며, 실제 마스킹 로직(정규식 패턴·
비교 연산자·값 검사 우선 순서)은 이관 전후 완전히 동일함을 소스 대조로 재확인했다. 인젝션·
하드코딩된 시크릿·인증/인가 우회·안전하지 않은 암호화·에러 메시지의 민감정보 노출 관점에서 새로
도입된 결함은 없다. 오히려 이 리팩터가 실제로 존재했던 보안 관련 실패 모드(크로스스택 마커/깊이
drift → egress 마스킹 및 §R17 재제출 거부 가드의 조용한 fail-open)를 구조적으로 닫았고, 그 재발
방지 가드 자체가 앞선 두 라운드에서 겪었던 것과 **같은 클래스**의 CI 경로 게이팅 사각지대(가드를
frontend vitest 에만 둠 → backend-only PR 무방비, `channel-web-chat` 세 번째 스택 무방비, 감시
목록 자체의 손 복제)에 두 차례 빠졌었으나, 이번 diff 시점에는 두 스택 각자의 워크플로에서 도는
독립 사본 + 실측 기반 `resolveScanDirs`/`SOT_SYMBOLS` 파생 + vacuous 방지 캐너리로 모두 수정돼
있음을 직접 코드를 열어 검증했다. 남은 것은 전부 참고용 INFO(개선 기록·devDependency 감사는 별도
파이프라인 소관)이며 차단 사유가 될 만한 항목은 없다.

## 위험도
NONE
