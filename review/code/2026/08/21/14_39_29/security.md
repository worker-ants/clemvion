# 보안(Security) Review — masked-marker-contract

## 검토 방법

`@workflow/masked-markers` 공유 패키지 신설 + backend/frontend 소비처의 재export 전환을 중심으로,
값/판정 로직(`isMaskedMarker`, `MASKED_MARKERS`, `MAX_MASK_DEPTH`), 신규 CI 배선(pathspec·matrix·Dockerfile
COPY·workspace 의존), 신규 repo-guard(미러 재발 탐지) 를 실제 소스(diff 가 생략된 항목 포함) 를 직접 `Read` 로
열어 대조했다. 대상: `codebase/backend/src/shared/utils/sanitize-error-message.ts`,
`codebase/frontend/src/lib/utils/masked-markers.ts`, `codebase/packages/masked-markers/src/index.ts`,
`codebase/{backend,frontend}/src/**/repo-guards/__tests__/masked-marker-mirror-guard.ts`,
`codebase/packages/masked-markers/package.json`, CI workflow/Dockerfile diff.

## 발견사항

없음 (CRITICAL/WARNING 없음).

### 참고로 확인한 항목 (문제 아님, 기록용)

- **값·판정 로직 무변경 확인** — `VALUE_MASK_MARKER`(`'***'`) · `KEY_MASK_MARKER`(`'[REDACTED]'`) ·
  `DEPTH_MASK_MARKER`(`'[REDACTED_DEPTH]'`) · `MAX_MASK_DEPTH`(`10`) · `isMaskedMarker`(정확 일치만
  판정) 모두 이관 전후 리터럴·동작이 동일하다. `sanitize-error-message.ts` 의 `SECRET_LEAK_PATTERNS`
  (OAuth bearer·client-secret·bare JWT·URI userinfo 마스킹 regex 등 실제 시크릿 마스킹 로직)는 이 diff
  에서 **손대지 않았다** — import 출처만 로컬 상수에서 공유 패키지로 바뀌었을 뿐, 마스킹 자체의
  보안 표면(어떤 패턴을 잡는지)은 그대로다. 각 정규식은 앵커·경계가 있어 중첩 정량자로 인한 ReDoS
  형태가 아니다(`[A-Za-z0-9_-]*token` 류는 단일 star, 겹치는 문자클래스 중첩 없음).
- **`isMaskedMarker`/`MASKED_MARKERS` 는 마스킹 마커 상수이지 시크릿이 아니다** — `'***'` 같은 리터럴을
  패키지 README/JSDoc 에 평문으로 문서화해도 하드코딩된 시크릿 노출에 해당하지 않는다(이 문자열들은
  "가려졌다"는 표식이지 자격증명 값 자체가 아님).
- **CI 경로 게이팅 갭이 이 PR 의 존재 이유** — 종전엔 `frontend-checks`/`backend-checks` 가 서로의
  변경에 대해 검사를 생략해, 한쪽 스택 전용 PR 이 마커 상수를 조용히 발산시켜도(fail-open) 잡히지
  않는 구조였다(`RESOLUTION.md` WARNING 1 에 자체 문서화). 공유 패키지 추출로 대조할 미러 자체가
  없어지므로, 순수 리팩터임에도 오히려 이 보안 경계의 취약 지점 하나를 제거하는 방향이다.
  `frontend-checks.yml` pathspec 에 `codebase/channel-web-chat/**` 를 추가해 세 번째 스택까지
  미러 가드 트리거 범위에 포함시킨 것도 같은 목적(WARNING 이었다가 이전 라운드에서 수정 완료).
- **신규 repo-guard(`masked-marker-mirror-guard.ts` + `.spec.ts`/`.test.ts`)** 는 저장소 로컬 파일을
  `fs.readdirSync`/`readFileSync` 로 순회하는 CI 테스트 전용 코드다. 경로는 `repoRoot`(고정된 저장소
  루트)에서 파생되며 외부/사용자 입력을 받지 않아 경로 탐색(path traversal) 표면이 없다. AST 파싱은
  `typescript` 컴파일러 API 로 신뢰 가능한 로컬 소스 파일만 대상으로 하며 `eval`/동적 코드 실행 없음.
  프로덕션 번들에는 포함되지 않는다(`src/repo-guards/**` 빌드 제외, RESOLUTION.md 에서 devdep 가드로
  확인됨).
- **`package.json` `prepare` 스크립트의 `child_process.execSync('tsc', ...)`** — 리터럴 고정 명령이라
  사용자/외부 입력이 섞이지 않는 커맨드 인젝션 안전 패턴이다. 이 저장소의 기존 8개 내부 패키지와
  문자 그대로 동일한 관행(복제)이며 이번 PR 이 새로 도입한 패턴이 아니다.
- **CI workflow 변경(`frontend-checks.yml`/`packages-checks.yml`)** 은 `pathspecs`/`matrix` 리스트에
  문자열 항목을 추가하는 것뿐이고, PR 제목/본문 등 신뢰할 수 없는 GitHub 이벤트 값을 `run:` 셸
  문자열에 보간하는 스크립트 인젝션 패턴(전형적인 `pull_request_target` 오남용류)은 없다.
  `.claude/test-stages.sh`/Dockerfile 변경도 배열/COPY 한 줄 추가뿐, 셸 인젝션 표면 없음.
- **신규 devDependencies**(`@eslint/js`, `@types/jest`, `eslint`, `globals`, `jest`, `ts-jest`,
  `typescript`, `typescript-eslint`) — 형제 패키지와 동일 버전 라인이고 typosquat 의심 패키지명 없음.
  `package.json` 에 `private: true` 가 없는 점은 이 저장소의 다른 워크스페이스 패키지(`ai-end-reason`
  등)와 동일한 기존 관행이라 이번 PR 이 새로 만든 편차가 아니다.
- **재export 전환으로 인한 타입 변경**(`MASKED_MARKERS`: `ReadonlySet<string>` → `readonly string[]`,
  frontend) — 동결 방식이 `Object.freeze(new Set(...))`(placebo — freeze 가 Set 내부 슬롯에 닿지 않아
  `.add()` 가 성공하던 결함)에서 `Object.freeze([...])`(실제 불변, 배열 own-property 는 freeze 로 막힘)
  로 바뀐 것은 오히려 무결성이 강화된 방향이며, 패키지 자체 테스트(`index.spec.ts` "MASKED_MARKERS 는
  실제로 불변이다")가 `TypeError` 를 단언해 회귀를 고정한다.

## 요약

이번 변경은 backend/frontend 에 손으로 복제돼 있던 egress 마스킹 마커 상수·판정 함수·깊이 상한을
`@workflow/masked-markers` 내부 워크스페이스 패키지로 추출하는 순수 리팩터다. 시크릿 탐지/마스킹
정규식(`SECRET_LEAK_PATTERNS`, `CREDENTIAL_KEY_PATTERN`)과 마커 판정 로직(`isMaskedMarker` 정확 일치,
`MAX_MASK_DEPTH` 깊이 경계)은 이 diff 에서 값·동작 모두 무변경이며, import 출처만 바뀌었다. 새로
추가된 repo-guard 는 CI 전용 로컬 파일 스캐너로 사용자 입력이나 네트워크 표면을 갖지 않고, CI
workflow/Dockerfile/package.json 변경도 전부 기계적 등록(pathspec·matrix·COPY·workspace 의존)이라
인젝션·인증 우회·시크릿 하드코딩·안전하지 않은 암호화 등 어떤 항목에서도 새 취약점을 도입하지
않는다. 오히려 이 PR 이 대체한 "손 복제 미러"는 한쪽 스택 전용 PR 이 마커 확장을 조용히 놓치는
CI 경로 게이팅 갭(사실상 보안 가드의 fail-open 경로)이었고, 공유 패키지 추출과 3-스택 미러 가드로
그 갭을 닫았다(이전 리뷰 라운드 `11_27_29`/`11_53_49` 에서 WARNING 으로 지적·수정 완료, 본 라운드
diff 에 반영되어 있음을 확인). 이 diff 자체에서 신규로 도입된 CRITICAL/WARNING 급 보안 결함은
없다.

## 위험도
NONE
