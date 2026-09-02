# 보안(Security) 코드 리뷰

## 검토 범위

이번 changeset(81개 파일, `origin/main...HEAD`)은 harness 위생(plan 체크박스 정규식 확장,
plan lifecycle 문서, 도구 아티팩트 태그 잔재 가드)·plan 트래킹 문서 갱신·`spec/conventions/error-codes.md`
1개 문단 추가·그리고 이전 라운드의 `review/code/**`·`review/consistency/**` 세션 산출물(자동 생성
markdown/JSON)로 구성된다. 실제 실행 코드 변경은 4개 파일뿐이다:

- `.claude/hooks/_lib/plan_guard.py` — `_CHECKBOX` 정규식 앵커 확장
- `.claude/tests/test_plan_guard.py` — 회귀 테스트 3건 추가
- `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` — 멀티라인 ANCHOR 케이스 보강
- `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` — 신규 파일(도구 아티팩트 태그 잔재 가드)

나머지는 `plan/**`(트래킹 문서), `review/**`(리뷰/일관성 세션의 자동 생성 산출물),
`spec/conventions/error-codes.md`(규약 문서 서술 추가)이며 사용자 입력·네트워크 경계·인증/인가·
DB 접근·암호화 코드 어디에도 손대지 않는다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 어느 등급도 발견되지 않음).

세부 확인 내역:

1. **`.claude/hooks/_lib/plan_guard.py` 정규식 변경** —
   `_CHECKBOX = re.compile(r"^\s*[-*]\s+\[(?P<mark>[ xX])\]")` →
   `re.compile(r"^[\s>]*[-*]\s+\[(?P<mark>[ xX])\]")`.
   - 인젝션 표면 없음: 저장소 내부 `plan/*.md` 파일(git 커밋으로 반영되는 콘텐츠)에만 적용되고
     외부/네트워크 입력을 받지 않는다.
   - ReDoS 없음: `[\s>]*` 뒤에 `[-*]` 로 문자 클래스가 겹치지 않게 갈리는 선형 패턴이다. 중첩
     정량자가 없다(`git diff` 원본과 대조 확인).
   - 앵커를 넓히는 방향(공백-only → 공백+`>`)이라 반대 방향 오탐(서술 인용 `[ ]` 오검출)은
     불릿 요구 조건(`[-*]\s+`)이 그대로 막는다 —
     `test_narrative_bracket_mention_is_not_a_checkbox` 로 회귀 고정됨(원본 대조 확인).

2. **`codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` (신규)** — `walkTree` 로
   `plan/`·`spec/` 하위 `.md` 파일을 읽어(`fs.readFileSync`) 정규식 `STRAY_TAG_LINE` 으로 도구
   아티팩트 태그 잔재를 탐지하는 테스트. 전문을 직접 열어 확인했다.
   - `repoRoot()` 기반 절대경로 + `walkTree(root, ["plan", "spec"], …)` 만 사용하고 사용자 입력으로
     경로를 구성하지 않아 경로 탐색(path traversal) 표면이 없다.
   - `STRAY_TAG_LINE` 정규식(`` ^\s*</?(?:${TOOL_TAGS.join("|")})\b[^>]*>\s*$ ``)은 고정된
     `TOOL_TAGS` 리터럴 배열로만 구성되고 외부 입력이 패턴에 삽입되지 않는다(정규식 인젝션 없음).
     `[^>]*` 하나뿐이라 선형이며 ReDoS 위험 없음.
   - `archive/` 스코핑 fixture 테스트가 `os.tmpdir()` 기반 `fs.mkdtempSync`(무작위 접미사) 로
     격리된 임시 디렉터리를 만들고 `finally` 에서 `fs.rmSync(tmp, { recursive: true, force: true })`
     로 정리한다 — 저장소 밖 임시 경로만 다루고 정리도 확실해 잔재 위험이 없다.
   - 테스트 코드이므로 프로덕션 런타임 경계(빌드 산출물)에 포함되지 않는다.

3. **`codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts` 보강** — 멀티라인 ANCHOR
   fixture 추가. 고정 문자열만 다루는 테스트 fixture 이고 네트워크·DB·인증 경계와 무관하다.

4. **`spec/conventions/error-codes.md`, plan 문서들, `review/consistency/**`/`review/code/**`
   산출물** — 순수 서술형 마크다운/JSON(세션 메타데이터·리뷰 산출물)이며 실행되는 코드가 아니다.

5. **하드코딩 시크릿 전수 스캔** — `git diff origin/main...HEAD` 전체를
   `api[_-]?key|secret|password|token|bearer|-----BEGIN|private[_-]?key|AKIA[0-9A-Z]{16}`
   (대소문자 무시) 로 검색했다. 유일한 매치는 `plan/in-progress/...consistency_compliance.md`
   계열 문서 안에서 **다른 선례 plan 파일명**(`spec-draft-secret-store-verification-footnote.md`)을
   인용한 것뿐 — 실제 자격증명·API 키·비밀번호·인증서는 발견되지 않았다.

6. **에러 처리/암호화/의존성** — 이번 changeset 은 에러 메시지 생성 로직, 암호화/해시 로직,
   패키지 의존성 목록(`package.json` 등)을 전혀 건드리지 않아 해당 관점의 변경 표면이 없다.

7. **인증/인가** — 이번 diff 는 backend API·미들웨어·세션·권한 검증 코드 어디에도 손대지 않는다.
   변경 표면이 harness(로컬 git hook)·frontend 테스트·문서에 국한된다.

## 요약

이번 changeset 은 harness 자체(plan 체크박스 정규식 확장, 도구 아티팩트 태그 잔재 회귀 가드)와
plan/spec/review 문서 정리, 그리고 이전 리뷰 라운드의 세션 산출물 커밋으로 구성된다. 사용자
입력·네트워크·인증/인가·데이터베이스·암호화 경계를 건드리는 실행 코드 변경이 없고, 실제 코드
변경 4건(정규식 확장 1건 + 테스트 3건)도 모두 저장소 로컬 파일에만 적용되는 선형 패턴이라
ReDoS·인젝션·경로 탐색 표면이 없다. `git diff` 전체에 대한 시크릿 패턴 전수 스캔에서도 하드코딩된
자격증명은 발견되지 않았다.

## 위험도

NONE
