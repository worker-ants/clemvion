# 보안(Security) 코드 리뷰 — masked-marker-contract-7d2e14

## 검토 범위

`@workflow/masked-markers` 공유 패키지 추출: egress 마스킹 마커(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)와
깊이 상한(`MAX_MASK_DEPTH=10`)을 backend `sanitize-error-message.ts` / frontend `masked-markers.ts` 양쪽이
손으로 복제하던 것을 신규 워크스페이스 패키지로 이관하고, 양쪽은 재export/지역 별칭만 남긴다. 값·로직
자체는 동작 무변경(pure move)이며, 그 외 diff는 등록 8표면(test-stages.sh · packages-checks.yml ·
Dockerfile 3곳 · package.json 2곳 · pnpm-lock.yaml)과 미러 소멸 회귀 가드(신규 vitest 테스트), plan/
consistency 산출 문서다.

## 발견사항

이번 diff에서 CRITICAL/WARNING 급 보안 결함은 발견되지 않았다. 참고용 INFO만 남긴다.

- **[INFO]** 프런트 `MASKED_MARKERS`가 이번 변경으로 런타임 불변성을 실제로 획득했다(퇴행 아님, 개선)
  - 위치: `codebase/frontend/src/lib/utils/masked-markers.ts:22-26` (import 후 재export), 대조군
    `codebase/packages/masked-markers/src/index.ts:43-47`
  - 상세: 변경 전 프런트 구현은 `MASKED_MARKERS: ReadonlySet<string> = new Set([...])`로 **타입 레벨 readonly**만
    가진 채 `Object.freeze` 호출이 없어, 같은 프로세스 내 코드가 `.add()`로 실제 변형할 수 있었다(TS의 `ReadonlySet`은
    컴파일 타임 체크일 뿐 런타임 봉인이 아님). 신규 공유 패키지는 `Object.freeze([...])`(배열)를 쓰고, 새 캐너리
    테스트(`packages/masked-markers/src/__tests__/index.spec.ts:32-38`)가 `Object.freeze(new Set(...))`이
    플라시보임을(`Set` 데이터는 own property가 아니라 내부 슬롯에 있어 freeze가 안 닿음) 명시적으로 규명하고
    `.push()` 시도가 `TypeError`를 던지는지 단언한다. 재제출 거부 가드와 egress 마스킹 판정기가 이 집합을
    공유하므로, 런타임 변형 가능성을 없앤 것은 이 리팩터가 부수적으로 좁힌 공격면이다.
  - 제안: 조치 불요 — 개선 사항으로 기록.

- **[INFO]** 마커 SoT 이관으로 "깊이 상한 크로스스택 drift" 라는 실제 보안 관련 실패 모드가 구조적으로 닫힌다
  - 위치: `codebase/packages/masked-markers/src/index.ts:81` (`MAX_MASK_DEPTH = 10`), 소비처
    `codebase/backend/src/shared/utils/sanitize-error-message.ts:128`(`MAX_REDACT_DEPTH = MAX_MASK_DEPTH`),
    `codebase/frontend/src/lib/utils/masked-markers.ts:101`(`depth >= MAX_MASK_DEPTH`)
  - 상세: 마스커가 치환하는 깊이와 프런트 스캐너가 닿아야 하는 깊이가 어긋나면(예: 한쪽만 값을 늘리는 편집)
    가드가 "조용히 fail-open"한다 — 마스킹된 값이 프리필/재제출되어 이미 가려진 자격증명이 실제 입력값처럼
    취급될 위험(재노출은 아니지만 게이트 우회). 이관 전에는 두 스택이 서로 다른 상수명(`MAX_REDACT_DEPTH` vs
    `MAX_MARKER_SCAN_DEPTH`)으로 같은 값을 손으로 복제했고, 두 CI 워크플로(`frontend-checks`/`backend-checks`)가
    서로의 변경 시 검사를 생략하는 pathspec 게이팅 때문에 계약 테스트로는 이 drift를 막을 수 없었다(plan 문서에
    실측 기재). 값 자체를 단일 패키지로 옮겨 두 워크플로 모두 `codebase/packages/**`를 relevant로 잡게 한
    구조는 이 특정 fail-open 클래스를 근본적으로 제거한다. 값(10)·비교 연산자(`>=`)는 이관 전후 동일함을
    diff에서 직접 확인했다 — 동작 변경 없이 리스크만 줄었다.
  - 제안: 조치 불요 — 설계가 올바른 방향으로 리스크를 줄였음을 기록.

- **[INFO]** `isMaskedMarker` 정확-일치 판정 의미는 이관 전후 동일하게 유지됨(부분 포함 미탐 허용은 의도된 트레이드오프)
  - 위치: `codebase/packages/masked-markers/src/index.ts:55-57`
  - 상세: `typeof v === "string" && MASKED_MARKERS.includes(v)` — 부분 포함(`a***b`)은 매치하지 않는다. 이는
    기존에도 동일했고 문서화된 의도(오탐 비용 > 미탐 비용, 미탐 쪽은 이미 마스킹된 값이라 실질 노출 없음)다.
    리팩터가 이 경계를 넓히거나 좁히지 않았음을 신규 패키지 테스트(`index.spec.ts:51-60`, 부분 포함/접두/접미
    케이스 전부 `false` 단언)로 확인했다.
  - 제안: 조치 불요.

- **[INFO]** 신규 devDependency 버전은 CVE 자동 스캔 도구로 검증하지 못함(런타임 프로덕션 의존성 아님)
  - 위치: `codebase/packages/masked-markers/package.json:13-22`(`eslint`/`jest`/`ts-jest`/`typescript`/
    `typescript-eslint` 등)
  - 상세: 전부 build/test 전용 devDependency이며 버전대(`^9.18.0`/`^30.0.0`/`^8.65.0` 등)가 저장소의 다른
    패키지들과 동일 라인이라 신규 위험 표면이 아니다. 다만 이 리뷰는 오프라인 정적 diff 검토라 실제
    advisory DB 대조(`pnpm audit` 등)는 수행하지 못했다.
  - 제안: 정기 `pnpm audit`/Dependabot 파이프라인(이미 저장소에 별도 인프라로 존재)에 맡긴다 — 이 PR 범위의
    조치는 불요.

- **[INFO]** `package.json`의 `prepare` 스크립트는 인젝션 표면이 없는 고정 문자열
  - 위치: `codebase/packages/masked-markers/package.json:9`
  - 상세: `node -e "..."`의 인라인 스크립트가 외부/사용자 입력을 보간하지 않는 고정 로직(typescript 존재 여부
    확인 후 `tsc` 실행 또는 `dist/` 존재 확인)이라 커맨드 인젝션 표면이 없다. 저장소 내 다른 내부 패키지와
    동일 패턴.
  - 제안: 조치 불요.

- **[INFO]** 신규 미러 재발 가드(`masked-marker-mirror-guard.ts`)는 CI/개발 전용 정적 분석 도구 — 런타임
  공격면 아님
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts`
  - 상세: `fs.readdirSync`/`fs.readFileSync`로 저장소 내 고정된 3개 디렉터리(`SCAN_DIRS` — backend/src,
    frontend/src, channel-web-chat/src)를 순회하며 TypeScript AST로 심볼 재선언을 탐지한다. 경로는 전부
    하드코딩된 상대 경로 조합(`path.join(repoRoot, rel)`)이고 외부/네트워크 입력이 관여하지 않으므로 경로
    탐색·임의 파일 읽기 위험이 없다. 이 파일은 애플리케이션 런타임에 포함되지 않는 `__tests__/` 전용
    가드/헬퍼다.
  - 제안: 조치 불요.

## 요약

이번 diff는 egress 마스킹 마커 집합·판정 로직·깊이 상한을 backend/frontend 양쪽이 손으로 복제하던 것을
`@workflow/masked-markers` 단일 패키지로 추출하는 순수 리팩터다. 마스킹 마커 문자열(`'***'`/`'[REDACTED]'`/
`'[REDACTED_DEPTH]'`) 자체와 정확-일치 판정, 깊이 상한 값(10)·비교 연산자는 이관 전후 diff에서 동일함을
직접 확인했고, 하드코딩된 실제 시크릿·자격증명·인증 우회·인젝션 벡터는 발견되지 않았다. 오히려 이
리팩터는 두 가지 실제 보안 관련 실패 모드(런타임 불변성이 없던 프런트 `Set`, CI pathspec 게이팅으로 인해
막을 수 없었던 크로스스택 깊이 상한 drift)를 구조적으로 닫는 방향으로 작용한다. 나머지 변경(CI 워크플로
pathspec·Dockerfile COPY·package.json 의존성 등록·pnpm-lock.yaml)은 전형적인 내부 워크스페이스 패키지
등록 보일러플레이트이며 보안 관점의 신규 표면을 만들지 않는다. `review/consistency/**` 산출 문서들은
plan 프로세스 정합성 검토 결과(빌드 가드 RED, spec stale 서술 등)이며 전부 문서 동기화 성격으로, 이미
convention_compliance/plan_coherence 등 별도 checker가 다뤘고 보안 리뷰 관점의 신규 이슈는 없다.

## 위험도
NONE
