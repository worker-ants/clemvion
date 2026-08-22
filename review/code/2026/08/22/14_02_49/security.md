# 보안(Security) 코드 리뷰

## 리뷰 대상 개요

이번 변경은 CI 워크플로 리팩터링이다 — `masked-marker-mirror-guard`(마커 SoT 미러 재발 감지 가드)의
backend 사본을 삭제하고, 저장소 전체(`codebase/**`)를 스캔 대상으로 하는 전용 워크플로
`.github/workflows/repo-guards.yml` 을 신설해 그 안에서 frontend 쪽 사본만 돌린다. 그 외에는
하네스 테스트 레지스트리 갱신, plan 문서, consistency-check 산출물(markdown/json) 뿐이다. 애플리케이션
런타임 코드(백엔드 API, 인증, DB 쿼리, 사용자 입력 처리 경로)는 전혀 건드리지 않는다.

## 발견사항

### [INFO] `actions/checkout@v7` 가 SHA 가 아니라 태그로 고정됨
- 위치: `.github/workflows/repo-guards.yml:74` (신규 파일 — 게이트 `74|      - uses: actions/checkout@v7`), 동일 패턴이 `.github/workflows/frontend-checks.yml:67` 에도 이미 존재(변경 아님)
- 상세: GitHub Actions 서드파티(및 GitHub 공식) action 을 태그(`@v7`)로 참조하면, 해당 태그가 나중에
  다른 커밋을 가리키도록 재작성(tag mutation)될 경우 CI 러너에서 임의 코드가 실행될 수 있는 공급망
  공격 표면이 생긴다. 다만 이 워크플로는 `permissions: contents: read` 로 최소 권한이고 시크릿을
  다루지 않으며, 이미 저장소 전역에서 통용되는 기존 관례(`frontend-checks.yml` 등 다른 워크플로도
  동일하게 태그 참조)를 그대로 따른 것이라 **이 PR 이 새로 도입한 회귀는 아니다**.
- 제안: 신규 결함으로 다루지 않는다. 저장소 전체 정책으로 SHA 핀 전환을 원하면 별도 트래커 항목으로
  일괄 처리(모든 `.github/workflows/*.yml` 동시 적용)하는 편이 낫다 — 이 워크플로만 SHA 로 바꾸면
  일관성이 오히려 깨진다.

### [INFO] 신규 워크플로의 트리거·권한 구성은 안전한 패턴을 따름
- 위치: `.github/workflows/repo-guards.yml` 전체 (신규 파일)
- 상세: `on: pull_request` (fork PR 에서도 `GITHUB_TOKEN` 이 read-only 로 제한되는 안전한 트리거이며
  `pull_request_target` 이 아니다) + 명시적 `permissions: contents: read` 로 최소 권한 원칙을 지킨다.
  `run:` 스텝 어디에도 `${{ github.event.* }}` 같은 신뢰할 수 없는 PR 메타데이터(제목·브랜치명 등)를
  셸 문자열에 직접 보간하지 않아 GitHub Actions 의 대표적 커맨드 인젝션 패턴(untrusted input →
  `run:` script injection)에 해당하지 않는다. 검토 결과 조치 불필요.

### [INFO] 삭제/유지되는 `masked-marker-mirror-guard.ts` 는 dev/CI 전용 도구이며 사용자 입력 경로 없음
- 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts` (유지, 헤더 주석만 변경), 대응 backend 파일은 삭제됨(`codebase/backend/src/repo-guards/__tests__/masked-marker-mirror-guard.ts`)
- 상세: `resolveScanDirs`/`listSourceFiles`/`findRedeclaredSymbols`/`findMirrorRedeclarations` 는
  전부 로컬 저장소 경로(`repoRoot`, `ROOT` 상수)와 파일시스템 API(`fs.readFileSync`/`readdirSync`)를
  사용하는 **테스트/CI 전용 정적분석 유틸**이다. 외부·사용자 제공 입력이 경로 파라미터로 흘러들어오는
  지점이 없고(호출부는 항상 컴파일타임 상수 `ROOT` 또는 테스트의 `os.tmpdir()` 임시 디렉터리), 배포
  산출물(runtime 서버 코드)에 포함되지 않는다. 경로 탐색(path traversal)·인젝션 위험 없음.

### [INFO] 하드코딩된 시크릿 없음
- 위치: 변경분 전체(워크플로 YAML·Python 테스트·TS 가드·plan/review 문서)
- 상세: API 키·비밀번호·토큰·인증서 등 자격증명 패턴을 전수 grep 했으나 매치되는 것은 없다
  (`secret-store.md` 같은 컨벤션 문서명 언급, `MASK_SECRET`/`deepRedactSecrets` 등 마스킹 로직
  식별자뿐이며 실제 시크릿 값이 아니다).

## 요약

이번 변경분은 순수 CI 인프라·테스트 거버넌스 리팩터링으로, OWASP Top 10 이 다루는 인증/인가, 입력
검증, 인젝션, 암호화 등 런타임 공격 표면을 전혀 확장하지 않는다. 신규 워크플로(`repo-guards.yml`)는
최소 권한(`contents: read`)과 안전한 트리거(`pull_request`, 신뢰 불가 입력 미보간)를 따르고, 이관된
가드 코드는 로컬 파일시스템만 다루는 dev-time 정적분석 도구라 사용자 입력 경로가 없다. 하드코딩된
시크릿도 발견되지 않았다. 유일한 참고사항(`actions/checkout@v7` 태그 고정)은 이 PR 이 새로 도입한
문제가 아니라 저장소 전역 기존 관례이므로 이번 변경 범위에서 조치할 필요는 없다.

## 위험도

NONE
