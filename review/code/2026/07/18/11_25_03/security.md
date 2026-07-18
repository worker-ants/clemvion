# 보안(Security) 리뷰

## 리뷰 대상
1. `.claude/test-stages.sh` — 주석 추가만 (기능 변경 없음)
2. `.github/workflows/packages-checks.yml` — 주석 추가만 (기능 변경 없음)
3. `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` — 신규 vitest 드리프트 가드(내부 공유 패키지 등록 목록 4곳 ↔ 실제 패키지 집합 대조)

세 파일 모두 애플리케이션 런타임 코드가 아니라 **저장소 자체의 CI/테스트 인프라(빌드·CI 배선 검증)** 이며, 사용자 입력·네트워크 요청·인증/세션·DB 접근을 전혀 다루지 않는다.

## 발견사항

- **[INFO]** 커스텀 정규식 기반 파서지만 인젝션 표면 없음
  - 위치: `internal-package-registration.test.ts` 의 `internalPackages`, `fnBody`, `listAtPath`, `packageDirsInPaths`, `explicitFilterCalls`
  - 상세: 이 함수들은 `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`, `codebase/packages/*/package.json`, `codebase/backend/package.json` 등 **저장소 자신의 커밋된 파일**만 `fs.readFileSync`/`fs.readdirSync`로 읽어 정규식·문자열 비교를 수행한다. 사용자/네트워크로부터 오는 신뢰되지 않은 입력이 아니라 개발자가 커밋하는 설정 파일이 대상이며, `child_process`/`eval`/템플릿 실행 등 실행 경로가 전혀 없어 커맨드 인젝션·경로 탐색·SQL/XSS 인젝션 표면이 없다. 경로 조합(`path.join(ROOT, ...)`)도 전부 상수 문자열이라 path traversal 위험 없음.
  - 제안: 없음 (정상). 참고로 이 가드의 파서 정확성(휴리스틱 한계)은 별도 코드 품질 리뷰어 관점이며 보안 이슈는 아님.

- **[INFO]** JSON.parse 대상이 신뢰된 로컬 매니페스트
  - 위치: `discoverPackages()`, `backendWorkflowDeps()` — `JSON.parse(fs.readFileSync(... package.json ...))`
  - 상세: 파싱 결과는 오직 문자열 비교(`.startsWith("@workflow/")`, `Set` 멤버십)에만 쓰이고 `eval`/동적 실행/객체 병합 후 신뢰 판단에 사용되지 않는다. `{...pkg.dependencies, ...pkg.devDependencies}` 스프레드는 `__proto__`류 키가 있어도(이론상 package.json이 그런 키를 가진다 해도) `JSON.parse`+object-spread 조합에서 프로토타입 오염 경로로 이어지지 않는다(스펙상 object spread 는 own 데이터 프로퍼티만 `CopyDataProperties`로 정의). 실제 공격 표면도 없음(로컬 리포 파일이며 CI 신뢰 경계 안).
  - 제안: 없음.

- **[INFO]** 의도적으로 `js-yaml` 신규 의존 회피 — 공급망 표면 최소화
  - 위치: `internal-package-registration.test.ts` 파일 헤더 주석("범용 YAML 파서를 쓰지 않는다")
  - 상세: 새 런타임 의존을 추가하는 대신 필요한 3개 키 경로만 뽑는 좁은 라인 기반 추출기를 직접 구현했다. 이는 의존성 보안(알려진 취약점 있는 라이브러리 도입) 관점에서 표면을 늘리지 않는 선택으로 긍정적이다.
  - 제안: 없음.

- **[INFO]** GitHub Actions 워크플로 변경분은 주석뿐, 위험 패턴 없음
  - 위치: `.github/workflows/packages-checks.yml`
  - 상세: 변경은 comment-only. 전체 파일 컨텍스트를 봐도 `pull_request_target` 미사용(안전한 `pull_request`만 사용), `run:` 블록에 PR 제목/본문 등 신뢰 불가 GH 컨텍스트 값을 문자열 보간하지 않음(스크립트 인젝션 표면 없음), `matrix.pkg` 값도 워크플로 자신이 선언한 고정 리스트에서만 옴. Secrets 사용도 없음.
  - 제안: 없음.

- **[INFO]** 에러 메시지에 민감정보 노출 없음
  - 위치: `fnBody`, `repoRoot` 등의 `throw new Error(...)`
  - 상세: 에러 메시지에 파일 경로(`__dirname`)·함수명 등 저장소 내부 구조 일부가 포함되나, 이는 로컬/CI 테스트 실행 중에만 노출되는 진단 정보이며 프로덕션 사용자 대상 응답 경로가 아니다. 민감정보(자격증명·PII·내부 인프라 주소 등) 없음.
  - 제안: 없음.

## 요약
세 파일 모두 애플리케이션 런타임이 아닌 저장소 내부 CI/테스트 배선(내부 공유 패키지 등록 목록 drift 가드)에 국한된 변경으로, 사용자 입력·인증/인가·암호화·네트워크 통신을 전혀 다루지 않는다. 신규 테스트 파일은 정규식 기반 커스텀 파서를 쓰지만 파싱 대상이 전부 저장소 자체의 커밋된 설정 파일(`test-stages.sh`, `packages-checks.yml`, `package.json`)이라 인젝션·경로 탐색·프로토타입 오염 등 실질적 공격 표면이 없고, 신규 외부 의존(`js-yaml`) 도입도 의도적으로 회피해 공급망 표면을 늘리지 않았다. 하드코딩된 시크릿, 안전하지 않은 암호화, 에러 메시지를 통한 민감정보 노출도 발견되지 않았다. 보안 관점에서 이 변경은 위험이 없다.

## 위험도
NONE
