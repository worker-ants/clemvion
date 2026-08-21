# 보안(Security) 코드 리뷰 — masked-marker-contract-7d2e14

## 검토 범위

이번 diff 는 egress 마스킹 마커(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)와 재귀 깊이 상한
(`MAX_MASK_DEPTH=10`)을 backend `sanitize-error-message.ts` / frontend `masked-markers.ts` 양쪽이
손으로 복제하던 것을 신규 워크스페이스 패키지 `@workflow/masked-markers` 로 추출하는 **순수 리팩터**다.
그 외 diff 는 등록 배선 8곳(`test-stages.sh` · `packages-checks.yml` · Dockerfile 3곳 ·
`package.json` 2곳 · `pnpm-lock.yaml`), 미러 소멸 회귀 가드 신설(backend jest + frontend vitest
양쪽), spec/plan 문서, 그리고 이전 리뷰 라운드(`11_27_29`)의 산출물이다.

실제 보안 로직(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`/`deepRedactSecrets` 계열)이 이번
diff 로 바뀌었는지 확인하기 위해 `codebase/backend/src/shared/utils/sanitize-error-message.ts`
전문을 `Read` 로 직접 열어 대조했다 — 정규식 패턴·비교 연산자(`depth >= MAX_REDACT_DEPTH`)·
값(`10`) 전부 이관 전후 동일하며, 바뀐 것은 마커 상수/깊이 상한의 **선언 위치**(공유 패키지 →
import → 재export)뿐이다.

## 발견사항

이번 diff 에서 CRITICAL/WARNING 급 보안 결함은 발견되지 않았다. 참고용 INFO만 남긴다.

- **[INFO]** 프런트 `MASKED_MARKERS` 가 이번 변경으로 런타임 불변성을 실제로 획득했다 (개선, 회귀 아님)
  - 위치: `codebase/packages/masked-markers/src/index.ts:43` (`Object.freeze([...])`, 신규 SoT) ·
    대조군(구현 부재 확인용) `codebase/packages/masked-markers/src/__tests__/index.spec.ts:46-52`
    (`[캐너리] MASKED_MARKERS 는 실제로 불변이다` — `.push()` 시도가 `TypeError` 를 던지는지 단언)
  - 상세: 변경 전 프런트 구현(`codebase/frontend/src/lib/utils/masked-markers.ts`, 삭제됨)은
    `MASKED_MARKERS: ReadonlySet<string> = new Set([...])` 로 **타입 레벨 readonly** 만 가진 채
    런타임 봉인이 없어, 같은 프로세스 내 코드가 `.add()` 로 실제 변형할 수 있었다. 신규 공유
    패키지는 `Object.freeze` 된 배열을 쓰고, 캐너리 테스트가 `Object.freeze(new Set(...))` 이
    플라시보(`Set` 데이터는 own property 가 아니라 내부 슬롯이라 freeze 가 안 닿음)라는 점까지
    명시적으로 규명한다. 이 집합은 egress 마스킹 판정기와 재제출 거부 가드(EIA §R17)가 공유하므로
    런타임 변형 가능성을 없앤 것은 공격면을 부수적으로 좁힌 것이다.
  - 제안: 조치 불요 — 개선 사항으로 기록.

- **[INFO]** 마커/깊이 상한 SoT 이관으로 "크로스스택 drift → 조용한 fail-open" 실패 모드가 구조적으로 닫힌다
  - 위치: `codebase/packages/masked-markers/src/index.ts:81`(`MAX_MASK_DEPTH = 10`), 소비처
    `codebase/backend/src/shared/utils/sanitize-error-message.ts:128`
    (`export const MAX_REDACT_DEPTH = MAX_MASK_DEPTH;`, 실측: 비교 로직은 같은 파일 270행
    `if (depth >= MAX_REDACT_DEPTH) return VALUE_MASK_MARKER;` 로 이관 전후 불변),
    `codebase/frontend/src/lib/utils/masked-markers.ts:101`(`if (depth >= MAX_MASK_DEPTH) return false;`)
  - 상세: 마스커가 치환하는 깊이와 프런트 스캐너가 닿아야 하는 깊이가 어긋나면 마스킹된 값이
    프리필/재제출되어 게이트를 조용히 우회할 위험이 있었다(자격증명 재노출은 아니지만 이미
    마스킹된 값이 실제 입력처럼 취급됨). 두 스택이 서로 다른 상수명(`MAX_REDACT_DEPTH` vs
    `MAX_MARKER_SCAN_DEPTH`)으로 값을 손으로 복제하고 있었고, `frontend-checks`/`backend-checks`
    CI 워크플로가 서로의 변경 시 검사를 생략하는 pathspec 게이팅 때문에 계약 테스트로는 이
    drift 를 막을 수 없었다(양쪽 워크플로 모두 `codebase/packages/**` 는 relevant 로 잡는다는
    점을 실측 근거로 값 자체를 이관). 값(10)·비교 연산자는 diff 에서 직접 확인한 대로 불변이다.
  - 제안: 조치 불요 — 설계가 올바른 방향으로 리스크를 줄였음을 기록.

- **[INFO]** 미러 소멸 회귀 가드가 backend/frontend 양쪽에 배치되어, 이전 리뷰 라운드가 지적한 CI 경로 게이팅 사각지대가 이번 diff 안에서 해소됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts:32-36`
    (`SCAN_DIRS` = `codebase/backend/src`/`codebase/frontend/src`/`codebase/channel-web-chat/src`
    3곳 전부 스캔, backend jest 트리거) + `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:33-36`
    (동일 3곳, frontend vitest 트리거)
  - 상세: `review/code/2026/08/21/11_27_29/architecture.md` (이전 라운드 산출물, 이번 diff 에 포함)
    가 지적한 대로, 미러 소멸 가드를 frontend vitest 에만 두면 `frontend-checks` 가
    `codebase/backend/**` 변경 시 검사를 생략(skip=통과 보고)하므로 backend-only PR 이 마커
    심볼을 재선언해도 가드가 실행되지 않는다는 것이 실제 보안 관련 회귀(egress 마스킹 우회
    감시 무력화)였다. 이번 diff 는 그 지적에 대응해 backend 사본(`masked-marker-mirror.spec.ts`)을
    신설했고, 두 사본 모두 저장소 전체(세 스택)를 훑으므로 backend/frontend 어느 쪽이 바뀌어도
    최소 하나는 자기 워크플로에서 실행된다 — 탐지 로직 자체의 중복은 값의 미러와 달리 fail-open
    을 만들지 않는다(한 사본이 낡아도 다른 사본이 불변식을 계속 지킴).
  - 제안: 조치 불요 — 이전 라운드 WARNING 이 이번 diff 안에서 해소됐음을 확인 기록.

- **[INFO]** 신규 패키지 `devDependencies` 가 caret(`^`) 범위를 사용해 부동 버전을 허용한다 (기존 저장소 관행과 일치, 신규 리스크 아님)
  - 위치: `codebase/packages/masked-markers/package.json:13-21`
    (`"typescript": "^5.7.3"`, `"eslint": "^9.18.0"`, `"jest": "^30.0.0"`, `"ts-jest": "^29.2.5"` 등)
  - 상세: 전부 빌드/테스트 시점에만 쓰이는 devDependency 로 런타임 번들에 포함되지 않으며,
    `pnpm-lock.yaml` 이 실제 설치 버전을 고정한다. 이 범위 지정 방식은 `codebase/packages/`
    하위 기존 7개 패키지와 동일한 패턴이라 이번 PR 이 새로 도입한 리스크가 아니다.
  - 제안: 조치 불요 — 참고용.

## 요약

이번 diff 의 핵심은 backend/frontend 에 손으로 복제되던 egress 마스킹 마커 상수·깊이 상한을
`@workflow/masked-markers` 공유 패키지로 추출하는 순수 리팩터이며, 실제 마스킹 로직
(`SECRET_LEAK_PATTERNS`/`CREDENTIAL_KEY_PATTERN`/`deepRedactSecrets` 계열, 정확 일치 판정
`isMaskedMarker`)은 값·비교 연산자·호출 순서(값 검사 우선 → 깊이 검사) 모두 이관 전후 동일함을
소스 대조로 확인했다. 인젝션·하드코딩된 시크릿·인증/인가 우회·안전하지 않은 암호화·에러 메시지의
민감정보 노출 관점에서 새로 도입된 결함은 없다. 오히려 (1) 프런트 마커 집합이 `ReadonlySet`(런타임
비봉인)에서 `Object.freeze` 된 배열로 바뀌어 같은 프로세스 내 변형 가능성이 닫혔고, (2) 값 자체가
단일 SoT 로 합쳐지면서 크로스스택 drift → 조용한 fail-open 클래스가 구조적으로 제거됐으며,
(3) 이전 리뷰 라운드가 지적한 "미러 소멸 가드의 CI 경로 게이팅 사각지대"도 backend 사본 신설로
이번 diff 안에서 해소됐다. 신규 repo-guard 스크립트(`findMirrorRedeclarations` 등)는 CI/테스트
시점에 저장소 자신의 소스만 정적 파싱하며 외부 입력을 다루지 않아 인젝션 표면이 아니다. 의존성
관점(caret 범위 devDependency)은 기존 관행과 일치하는 INFO 수준일 뿐이다.

## 위험도
NONE
