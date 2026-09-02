# 보안(Security) 코드 리뷰

## 검토 범위

이번 changeset(125개 항목)은 성격상 harness/문서 위생에 국한된다.

- 실행 코드(로직 변경): `.claude/hooks/_lib/plan_guard.py`(체크박스 정규식 `_CHECKBOX`/`_QUOTED` 확장),
  `.claude/tests/test_plan_guard.py`(대응 테스트), `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts`(신규
  vitest 가드), `codebase/frontend/src/lib/docs/__tests__/spec-links.test.ts`(픽스처 보강),
  `codebase/frontend/src/lib/docs/__tests__/tree-walk.ts`(`bases` 파라미터 타입만 `string[]` →
  `readonly string[]`)
- 주석/문서만: `codebase/backend/src/nodes/core/error-codes.ts`(JSDoc 6줄 추가, 런타임 로직 무변경),
  `.claude/docs/plan-lifecycle.md`, `spec/conventions/error-codes.md`
- plan 트래킹 문서(`plan/**`) 7건, 리뷰 세션 산출물(`review/code/**`, `review/consistency/**`) 다수 —
  전부 harness 가 생성한 markdown/JSON 기록이며 실행되지 않는다.

프로덕션 애플리케이션 코드(백엔드 API 핸들러·DB 접근·인증/인가·프론트엔드 컴포넌트)는 이 changeset
에 없다. 실제 로직이 바뀐 두 파일(`plan_guard.py`, `stray-tool-tags.test.ts`)은 원본을 직접 `Read`
로 열어 diff 표시 내용과 대조했다.

## 발견사항

없음 (CRITICAL/WARNING/INFO 어느 등급도 발견되지 않음).

## 세부 확인 내역

1. **`.claude/hooks/_lib/plan_guard.py` — `_CHECKBOX`/`_QUOTED` 정규식 확장**
   (`^\s*[-*]\s+\[(?P<mark>[ xX])\]` → `^(?P<quote>[\s>]*)[-*]\s+\[(?P<mark>[ xX])\]` + 보조
   `_QUOTED = re.compile(r">")`형).
   - **ReDoS 없음**: 두 패턴 모두 중첩 정량자·모호한 alternation 이 없는 선형 패턴이다.
     `[\s>]*` 뒤에 `[-*]` 로 문자 클래스가 배타적으로 갈리고, 별도 백트래킹 폭발 지점이 없다.
   - **인젝션 표면 없음**: 입력은 저장소 로컬 `plan/*.md` 파일(git 커밋으로만 반영, 외부/네트워크
     입력 아님)이고, `eval`/`subprocess`/`os.system`/`shell=True` 등 명령 실행 경로가 이 모듈에
     없다(파일 상단부 import 확인, 순수 정규식·파일 읽기(`open`)만 수행).
   - **거부권 비대칭 설계는 보안이 아니라 워크플로 정확성 문제**: 열린 체크박스는 인용문 안이어도
     세고(거부권), 닫힌 체크박스는 자기 것만 센다. 오판(잘못된 "완료" 넛지)의 최악 결과는
     `guard_review_before_stop.py` 의 소프트 넛지 문구 오표시뿐이며, push 하드블록(`untouched`)은
     `handled` 여부로만 결정돼 이 정규식 확장과 무관하다 — 인가 우회로 이어지지 않는다(코드
     추적으로 확인: `evaluate_plan()` 내 `push_blocks` 산정 경로가 `_all_checkboxes_done()` 을
     참조하지 않음).

2. **`codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` (신규)** — 직접 `Read` 로
   전문 확인.
   - `walkTree(root, ["plan", "spec"], { skipDir, includeFile })` 로 스캔 대상을 수집하고
     `fs.readFileSync` 로 내용을 읽는다. `root` 는 `repoRoot()`(저장소 루트, 하드코딩된 상대
     세그먼트 `"plan"`/`"spec"`)로만 구성되고 사용자/외부 입력으로 경로를 조립하지 않는다 —
     경로 탐색(path traversal) 표면 없음.
   - `STRAY_TAG_LINE` 정규식은 고정 리터럴 배열 `TOOL_TAGS`(`antml`/`content`/`function_calls`/
     `invoke`/`parameter`)로만 alternation 을 구성하고, `[^>]*` 하나만 사용해 선형이다 —
     정규식 인젝션·ReDoS 없음.
   - fixture 테스트는 `fs.mkdtempSync(os.tmpdir())` 로 격리된 임시 디렉터리만 쓰고
     `finally` 블록에서 `fs.rmSync(..., { recursive: true, force: true })` 로 정리한다 — 저장소
     트리를 건드리지 않는다.

3. **`codebase/frontend/src/lib/docs/__tests__/tree-walk.ts`** — `walkTree` 의 `bases` 파라미터가
   `string[]` → `readonly string[]` 로 넓어진 것뿐이며, 함수 본체는 `bases` 를 순회만 하고
   변형하지 않는다(직접 확인). 보안에 영향 없는 순수 타입 변경.

4. **`codebase/backend/src/nodes/core/error-codes.ts`** — diff 전체가 JSDoc 주석 추가(엔진도 이
   enum 을 일부 emit 한다는 설명 + `spec/conventions/error-codes.md` 참조)이고 런타임 코드·enum
   멤버 값은 변경되지 않았다. 에러 코드 문자열 자체에 민감정보가 없고, 이 파일은 값 그대로
   `output.error.code` 에 실려 응답에 노출되는 표면이지만 이번 diff 는 그 표면을 넓히지도
   좁히지도 않는다.

5. **하드코딩 시크릿 전수 확인** — diff 전체(코드·plan·spec·review 산출물 포함)에서
   API 키/비밀번호/토큰/인증서/AWS 액세스 키 패턴을 정규식으로 스캔했으나 0건. `_retry_state.json`,
   `meta.json` 류는 세션 경로·타임스탬프·subagent 이름만 포함한다.

6. **인증/인가·에러 처리·암호화·의존성** — 이번 changeset 은 인증/인가 경로, 에러 메시지 생성
   로직, 해시/암호화 코드, `package.json`/lockfile 어디도 건드리지 않는다. `plan_guard.py` 판정
   오류는 (1)에서 다룬 대로 워크플로 정확성 문제이며 침해 가능한 인가 경계가 아니다.

## 교차 확인 — 동일 changeset 이전 4라운드 리뷰

같은 changeset 을 다룬 이전 4라운드 보안 리뷰(`review/code/2026/09/01/{22_25_37,22_44_29,23_09_35,
23_28_32}/security.md`) 모두 CRITICAL/WARNING/INFO 0건, 위험도 NONE 으로 수렴했고, 그 사이 라운드의
`RESOLUTION.md` 가 보고한 조치 항목들(체크박스 비대칭 카운팅 보강, 전제 테스트 강화, `readonly`
타입 확장, 줄번호 인용 → 앵커 문구 전환 등)은 전부 정확성/유지보수성/테스트 축의 결함이었고 보안
축에 새 표면을 열지 않았다 — 이번 라운드의 독립 재확인 결과와 일치한다.

## 요약

이번 changeset 은 harness git-hook 정규식 확장, 신규 build-blocking 문서 가드 테스트, plan/spec
문서 위생 정리, 그리고 에러 코드 네이밍 규약 JSDoc 보강으로 구성되며 사용자 입력·네트워크 경계·
인증/인가·DB 접근·암호화 코드를 전혀 건드리지 않는다. 실제 로직이 바뀐 두 파일을 직접 열어
대조한 결과 정규식은 모두 선형(ReDoS 없음)이고 파일 I/O 는 저장소 로컬 고정 경로에만 한정돼
경로 탐색 표면이 없다. 하드코딩된 시크릿도 발견되지 않았고, 이전 4라운드 독립 리뷰와 결론이
일치한다.

## 위험도

NONE
