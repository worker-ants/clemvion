# 보안(Security) 코드 리뷰

## 범위에 대한 메모

이번 changeset 92개 파일은 성격상 크게 세 그룹이다 — (1) harness 도구(`.claude/hooks/_lib/plan_guard.py` 정규식 확장 + 대응 테스트), (2) `plan/**` 위생 정리(도구 아티팩트 태그 제거, 체크박스 상태 갱신, outgoing 링크 절 추가) 및 새 build-blocking 가드 테스트(`stray-tool-tags.test.ts`), (3) 이전 리뷰 라운드 산출물(`review/**`)과 `spec/conventions/error-codes.md` 문서 갱신. 이 중 런타임에 사용자 입력을 처리하는 애플리케이션 코드(`codebase/backend`, `codebase/frontend` 의 프로덕션 소스)는 포함되어 있지 않다 — 변경된 코드는 전부 개발 시점에만 실행되는 git hook·vitest 테스트·마크다운 문서다. 아래는 이 범위를 전제로 한 점검 결과다.

## 발견사항

없음.

## 확인했으나 문제 없음 (근거 기록)

- **`.claude/hooks/_lib/plan_guard.py` `_CHECKBOX`/`_QUOTED` 정규식 확장**: `^(?P<quote>[\s>]*)[-*]\s+\[(?P<mark>[ xX])\]` 와 `>` 는 중첩 정량자가 없는 선형 패턴이라 ReDoS 위험이 없다(각 줄에 1회씩 매치, catastrophic backtracking 구조 아님). 입력은 저장소 내 `plan/**/*.md` 파일 내용이며 원격/사용자 제공 입력이 아니다. `subprocess`/`os.system`/`eval`/`shell=True` 등 인젝션 표면도 이 파일에 없다(grep 확인).
- **`codebase/frontend/.../stray-tool-tags.test.ts` (신규 파일)**: `STRAY_TAG_LINE` 정규식(`^\s*</?(?:antml|content|function_calls|invoke|parameter)\b[^>]*>\s*$`)도 고정 문자열 alternation + `[^>]*`(단일 문자 클래스, 중첩 없음) 구조라 선형이다. `walkTree`/`fs.readFileSync` 호출 대상은 `repoRoot()` 기준 `plan/`·`spec/` 하위로 고정돼 있고 외부 입력으로 경로를 구성하지 않는다 — path traversal 표면 없음. fixture 테스트는 `os.tmpdir()`/`fs.mkdtempSync` 로 격리된 임시 디렉터리만 사용하고 `finally` 에서 `fs.rmSync` 로 정리한다.
- **`codebase/frontend/.../spec-links.test.ts` 변경**: 테스트 픽스처에만 마크다운 텍스트를 추가한 것으로, 파싱 대상·검증 로직 자체(경로 해석·인젝션 표면)에는 변화가 없다.
- **하드코딩 시크릿**: 이번 diff 전체(하이라이트된 코드 블록 + 리뷰 산출물 마크다운)에서 API 키·비밀번호·토큰·인증서 패턴을 확인하지 못했다. `review/**` 산출물에 등장하는 문자열은 커밋 해시·리뷰 세션 타임스탬프·grep 명령 예시뿐이다.
- **인증/인가**: 이번 changeset 은 CI/git hook 게이트(체크박스 완료 판정)와 문서뿐이라 애플리케이션 인증/인가 경로에 해당하지 않는다. `plan_guard.py` 판정 오류(오탐/미탐)는 워크플로 정확성 문제이며 침해 가능한 인가 경계가 아니다.
- **`spec/conventions/error-codes.md` 문단 추가**: `EngineErrorCode`/`ErrorCode` 네이밍 규약 설명으로, 에러 메시지에 민감정보를 노출하는 방향의 변경이 아니다(오히려 코드 카탈로그 SoT 위임을 명확히 하는 문서 정합화).
- **의존성**: 이번 diff 에 `package.json`/`requirements`/lockfile 변경이 없다 — 신규/변경 의존성 없음.

## 요약

이번 changeset 은 harness(git hook) 정규식 확장, plan 문서 위생 정리, 신규 build-blocking 문서 가드 테스트, 그리고 에러 코드 네이밍 규약 문서 갱신으로 구성되며 프로덕션 애플리케이션 코드(인증, DB 접근, API 핸들러 등)를 전혀 포함하지 않는다. 변경된 정규식들은 모두 선형 구조라 ReDoS 위험이 없고, 파일 I/O는 저장소 내 고정 경로(`plan/`, `spec/`)에 한정돼 경로 탐색이나 사용자 입력 인젝션 표면이 없다. 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 에러 처리, 취약 의존성 도입 등 OWASP Top 10 관련 문제도 발견되지 않았다.

## 위험도

NONE
