# 보안(Security) 코드 리뷰

## 검토 범위

68개 변경 파일 중 실행 코드는 5개뿐이고 나머지 63개는 `plan/**`·`review/consistency/**` 문서/JSON
산출물이다.

- 실행 코드: `.claude/hooks/_lib/plan_guard.py`(정규식 앵커 확장), `.claude/tests/test_plan_guard.py`,
  `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`,
  `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규 테스트)
- 문서/plan/리뷰 산출물: `.claude/docs/plan-lifecycle.md`, `plan/**`, `review/consistency/**`,
  `spec/conventions/error-codes.md`

이 변경셋은 harness 위생(plan 체크박스 앵커 확장, 도구 아티팩트 태그 잔재 가드, spec 문서
정정)이며 사용자 입력·네트워크 경계·인증/인가·DB 접근·암호화 코드 어디에도 손대지 않는다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 어느 등급도 발견되지 않음).

세부 확인 내역:

1. **`.claude/hooks/_lib/plan_guard.py` 정규식 변경** — `_CHECKBOX = re.compile(r"^[\s>]*[-*]\s+\[(?P<mark>[ xX])\]")`.
   - 인젝션 표면 없음: 이 정규식은 저장소 내부 `plan/*.md` 파일(공격자가 아닌 프로젝트 참여자가
     git 커밋으로 반영하는 콘텐츠)에만 적용되고, 외부/네트워크 입력을 받지 않는다.
   - ReDoS 가능성 없음: `[\s>]*`, `\s+` 는 중첩 정량자·모호한 문자 클래스 중첩이 없는 선형 패턴이다
     (`[\s>]*` 뒤에 `[-*]` 로 문자 클래스가 겹치지 않게 갈라진다). 커밋 코멘트도 "blockquote 접두는
     유한한 문법" 이라고 스스로 근거를 남겼고 실측과 일치한다.
   - 앵커를 넓히는 방향(공백-only → 공백+`>`)이라 오탐 방향(서술 인용 `[ ]` 오검출)은 불릿 요구
     조건(`[-*]\s+`)이 그대로 막는다 — `test_narrative_bracket_mention_is_not_a_checkbox` 로
     회귀 고정됨.

2. **`codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` (신규)** — `walkTree` 로
   `plan/`·`spec/` 하위 `.md` 파일을 읽어(`fs.readFileSync`) 정규식 `STRAY_TAG_LINE` 으로 도구
   아티팩트 태그 잔재를 탐지하는 테스트.
   - `repoRoot()` 기반 절대경로만 사용하고 사용자 입력으로 경로를 구성하지 않아 경로 탐색(path
     traversal) 표면이 없다.
   - `STRAY_TAG_LINE` 정규식(`` `^\\s*</?(?:${TOOL_TAGS.join("|")})\\b[^>]*>\\s*$` ``)도 고정된
     `TOOL_TAGS` 리터럴 배열로만 구성되고 외부 입력이 패턴에 삽입되지 않는다(정규식 인젝션 없음).
     `[^>]*` 하나뿐이라 선형이며 ReDoS 위험 없음.
   - 테스트 코드이므로 프로덕션 런타임 경계에 영향 없음.

3. **`spec/conventions/error-codes.md`, plan 문서들, `review/consistency/**` 산출물** — 순수 서술형
   마크다운/JSON(세션 메타데이터·리뷰 산출물)이며 실행되는 코드가 아니다. 하드코딩된 시크릿·API
   키·자격증명 패턴을 전수 확인했으나 없음(`_retry_state.json`, `meta.json` 은 세션 경로·타임스탬프만
   포함).

4. **하드코딩 시크릿 전수 스캔** — 이번 diff 전체에서 API 키/비밀번호/토큰/인증서 형태의 문자열은
   발견되지 않았다. `userEmail` 등 개인 식별 정보도 diff 에 등장하지 않는다.

5. **에러 처리/암호화/의존성** — 이번 changeset 은 에러 메시지 생성 로직, 암호화/해시 로직, 패키지
   의존성 목록(`package.json` 등)을 전혀 건드리지 않아 해당 관점의 변경 표면이 없다.

## 요약

이번 changeset 은 harness 자체(plan 체크박스 정규식 확장, 도구 아티팩트 태그 잔재 회귀 가드)와
plan/spec/review 문서 정리에 국한된다. 사용자 입력·네트워크·인증/인가·데이터베이스·암호화 경계를
건드리는 실행 코드 변경이 없고, 유일한 코드 변경(정규식 확장)도 저장소 로컬 문서에만 적용되는
선형 패턴이라 ReDoS·인젝션 표면이 없다. 하드코딩된 시크릿도 발견되지 않았다.

## 위험도

NONE
