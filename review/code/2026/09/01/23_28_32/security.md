# 보안(Security) 코드 리뷰

## 검토 범위

이번 changeset(112개 파일, `origin/main...HEAD`)은 4번째 리뷰 라운드다. 실제 실행 코드 변경은
여전히 4개 파일뿐이고, 그 외에는 harness 정책 문서(`plan-lifecycle.md`)·plan 트래킹 문서
갱신·`spec/conventions/error-codes.md` 문단 보강·그리고 앞선 3개 리뷰/일관성 라운드
(`review/code/2026/09/01/{22_25_37,22_44_29,23_09_35}`, `review/consistency/2026/09/01/**`)의
자동 생성 세션 산출물(markdown/JSON)이다.

- 실행 코드: `.claude/hooks/_lib/plan_guard.py`(체크박스 정규식 비대칭 확장 — 열린 항목만
  blockquote `>` 접두를 넘김), `.claude/tests/test_plan_guard.py`(회귀 테스트),
  `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`(멀티라인 anchor fixture 보강),
  `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규 — 도구 아티팩트 태그
  잔재 가드)
- JSDoc-only 변경: `codebase/backend/src/nodes/core/error-codes.ts`(직접 `git diff` 로 재확인 —
  주석 문단 추가뿐, enum 멤버·런타임 동작 변경 없음)
- 문서/plan/리뷰 산출물: `.claude/docs/plan-lifecycle.md`, `plan/**`, `review/**`,
  `spec/conventions/error-codes.md`

이 범위는 사용자 입력·네트워크 경계·인증/인가·DB 접근·암호화 코드 어디에도 손대지 않는다.
프로덕션 애플리케이션 코드(`codebase/backend`/`codebase/frontend` 의 요청 처리 경로) 변경은 0건.

## 발견사항

없음 (CRITICAL/WARNING/INFO 어느 등급도 없음).

## 확인했으나 문제 없음 (근거 기록 — 소스 직접 대조)

1. **`.claude/hooks/_lib/plan_guard.py` — `_CHECKBOX`/`_QUOTED` 정규식** (`Read` 로 현재 파일
   60~100행 직접 확인).
   `_CHECKBOX = re.compile(r"^(?P<quote>[\s>]*)[-*]\s+\[(?P<mark>[ xX])\]")`,
   `_QUOTED = re.compile(r">")`.
   - 입력은 저장소 내 `plan/**/*.md` 파일(git 커밋 콘텐츠)뿐이고 외부/네트워크 입력을 받지
     않는다 — 인젝션 표면 없음.
   - `subprocess`/`os.system`/`eval`/`shell=True` 등 커맨드 인젝션 표면이 이 파일에 없다.
   - ReDoS 없음: `[\s>]*` 뒤에 `[-*]` 로 문자 클래스가 겹치지 않게 갈리는 선형 패턴. 중첩
     정량자 없음.
   - 이번 라운드의 신규 변경(비대칭 카운팅 — `_all_checkboxes_done()` 에서 열린 항목은
     인용문 안이어도 세고, 닫힌 항목은 `_QUOTED.search(quote)` 가 없을 때만 센다)도 판정
     로직일 뿐 신뢰 경계를 넘는 입력을 다루지 않는다. 오판정(허위 완료/거짓 미완료)의
     최악 결과는 push 하드블록이 아니라 Stop nudge 소프트 문구 오표시로 국한됨(2R
     `side_effect.md` 분석과 코드 추적 일치 — `evaluate_plan()` 의 `complete_pending` 은
     `complete_but_in_progress` 소프트 넛지에만 쓰인다).

2. **`codebase/frontend/.../stray-tool-tags.test.ts` (신규, 전문 `Read` 로 확인)**.
   - `repoRoot()` 기준 절대경로 + `walkTree(root, SCAN_ROOTS, …)` 만 사용, 사용자 입력으로
     경로를 구성하지 않는다 — path traversal 표면 없음.
   - `STRAY_TAG_LINE` 정규식은 고정 리터럴 배열 `TOOL_TAGS`(alternation)로만 구성되고
     외부 입력이 패턴 문자열에 삽입되지 않는다(정규식 인젝션 없음). `[^>]*` 단일 문자
     클래스뿐이라 선형, ReDoS 없음.
   - `archive/` fixture 테스트는 `os.tmpdir()` + `fs.mkdtempSync`(무작위 접미사)로 저장소
     밖 격리 디렉터리만 쓰고 `finally` 블록에서 `fs.rmSync(..., { recursive: true, force:
     true })` 로 확실히 정리한다.
   - 테스트 코드이므로 프로덕션 빌드/런타임 경계에 포함되지 않는다.

3. **`codebase/frontend/.../spec-links.test.ts` 보강** — 멀티라인 ANCHOR 링크 fixture(고정
   문자열)만 추가. 파싱 로직·경로 해석 자체는 변경되지 않았다.

4. **`codebase/backend/src/nodes/core/error-codes.ts`** — JSDoc 문단 추가뿐(직접 diff 재확인).
   enum 값·에러 코드 카탈로그·직렬화 로직 변경 없음 → 에러 처리 노출 관점 영향 없음.

5. **하드코딩 시크릿 전수 스캔** — `git diff origin/main...HEAD` 전체를
   `api[_-]?key|secret|password|token|bearer|-----BEGIN|private[_-]?key|AKIA[0-9A-Z]{16}`
   (대소문자 무시)로 직접 재검색. 매치는 전부 `review/**` 산출물 안에서 앞선 라운드가 이미
   확인한 것과 동일한 무해한 문자열이다 — grep 명령 예시 자체, 그리고 다른 plan 파일명
   (`spec-draft-secret-store-verification-footnote.md`)을 텍스트로 인용한 것뿐. 실제
   자격증명·API 키·비밀번호·인증서·PEM 블록은 0건.

6. **인증/인가** — 이번 diff 는 backend API·미들웨어·세션·권한 검증 코드 어디에도 손대지
   않는다. 변경 표면은 로컬 git hook(`plan_guard.py`)·frontend 문서 무결성 테스트·문서에
   국한된다. `plan_guard.py` 오판정은 워크플로 정확성 문제이지 침해 가능한 인가 경계가
   아니다.

7. **암호화/의존성** — 해시·암호화 로직, `package.json`/lockfile 변경 없음. 신규/변경
   의존성 없음.

8. **에러 처리 노출** — 이번 changeset 은 에러 메시지 생성·직렬화 로직을 건드리지 않는다
   (`error-codes.ts` 는 주석뿐).

## 요약

이전 3개 라운드(22_25_37, 22_44_29, 23_09_35)의 보안 리뷰가 이미 NONE 으로 수렴했고, 이번
4라운드에서 실제 소스 파일(`plan_guard.py`, `stray-tool-tags.test.ts`, `error-codes.ts`)을
직접 `Read`/`git diff` 로 재확인한 결과도 동일하다. 프로덕션 애플리케이션 코드(인증, DB 접근,
API 핸들러 등) 변경이 전혀 없고, 유일한 로직 변경(체크박스 정규식의 비대칭 blockquote 확장)도
저장소 로컬 markdown 파일에만 적용되는 선형 정규식이며 커맨드 인젝션·ReDoS·경로 탐색 표면이
없다. 신규 테스트 파일도 고정 경로·격리된 임시 디렉터리만 사용해 부수효과가 없다. 하드코딩된
시크릿도 diff 전체 재스캔에서 발견되지 않았다.

## 위험도

NONE
