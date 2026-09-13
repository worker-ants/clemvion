# 요구사항(Requirement) 리뷰 — error-code-emission-axis (라운드 9, `22_38_36`)

## 검토 범위·방법

이 배치는 9개 커밋(`65256a109` feat → 라운드 1~8 fix, 최신 `061f5153f`)의 누적분이다.
실질 코드는 두 파일 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`
(발행 축 수집기 3종·`isMessagePrefixOnly`·`computeNonEmittedOffenders`·
`GUIDE_NON_EMITTED_VOCABULARY`)와 `guide-identifier-existence.test.ts`(그 축을 소비하는
82개 테스트) — 이고, 나머지는 문서(`CHANGELOG.md`·`PROJECT.md`·`logic{,.en}.mdx`)·
`plan/**`·`review/**`(라운드 1~8 산출물)이다.

이미 8라운드의 `/ai-review`+`--impl-done`이 매우 촘촘하게(진리표 대조군·뮤테이션 검증·
경계 fixture) 이 축을 훑었으므로, 이번 라운드는 (a) 독립 재현으로 claim 을 직접 검증하고
(b) **직전 라운드(8) 자신이 도입한 변경**에 아직 아무도 보지 못한 결함이 있는지에 집중했다
— 이 저장소가 반복해 기록한 패턴("내 수정이 다음 결함이 된다")이 실제로 8라운드 연속
재현됐기 때문이다.

### 독립 재현 (읽기 전용 — 저장소 뮤테이션 없음)

- `codebase/frontend`에서 `guide-identifier-existence.test.ts` 단독 실행 → **82 passed
  (82)**. 라운드 8 RESOLUTION/커밋 메시지가 주장한 "79 → 82"와 일치.
- `execution-engine.service.ts:7121·7125·7130`의 `CONTAINER_MISSING_EMIT`/
  `CONTAINER_MULTIPLE_EMIT` 발행 형태(템플릿 리터럴 메시지 접두, `code` 필드 없음)와
  `:8017`의 `nodeExec.error = { message }`(필드가 `message`뿐)를 직접 열어 확인 — 등록
  항목의 `where` 인용과 정확히 일치한다.
- `makeshop.handler.ts:436`의 `MAKESHOP_UNRESOLVED_PATH_PARAM` 접두를 직접 확인 — 등록
  항목의 `where`와 일치.
- `spec/conventions/user-guide-evidence.md`에 `guide-identifier`/`guide-error-code`
  문자열 0건(`grep`) — 스캐너 헤더·`PROJECT.md:300`이 적은 "§2 표에 아직 없다"는 서술과
  일치.
- `spec/5-system/3-error-handling.md §1.4`에 `CONTAINER_MISSING_EMIT`/
  `CONTAINER_MULTIPLE_EMIT` 미등재, 반면 `spec/4-nodes/1-logic/{0-common,3-loop,7-map,
  9-foreach}.md`·`spec/3-workflow-editor/{0-canvas,2-edge}.md` 6파일은 이 두 이름을
  여전히 "코드"처럼 서술 — plan/트래커가 이미 SPEC-DRIFT 로 등재·planner 위임한 것과
  실측이 일치한다(아래 SPEC-DRIFT 항목 참조. 이번 라운드에 새로 발견한 것 아님).

## 발견사항

- **[WARNING]** `[SPEC-DRIFT 아님, 순수 자기-인용 오류]` 라운드 8 자신의 커밋이 삽입한
  주석이 자기 자신을 "라운드 9 정정"이라 잘못 표기한다 — 실제로는 **라운드 8**의 fix다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts:12`
    (`// > **라운드 7 의 그 교체가 두 가지를 한꺼번에 틀렸다 (라운드 9 정정).**`)
  - 상세: `git show 061f5153f`로 확인하면 이 줄은 커밋 `061f5153f`가 새로 추가했다. 그런데
    그 커밋 자신의 메시지 제목은 `fix(guards): 라운드 8 — 이 배치가 «닫으러 온 문장» 을
    여덟 라운드 동안 안 건드렸다`이고, 본문도 "다섯 라운드 연속 LOW 였다가 MEDIUM 으로
    올라갔다"·"여덟 라운드 동안 아무도 안 본 자리"라고 스스로를 **라운드 8**로 9번 지칭한다.
    plan 파일(`plan/in-progress/error-code-emission-axis.md`)의 §L 제목도
    `## L. 라운드 8 — …`이고, 하단 라운드 표는 `22_06_10`(이 리뷰가 인용하는 그 review
    세션)을 정확히 **R8** 행에 배치하며 **R9 는 "대기"로 아직 미완**이라고 명시한다. 즉
    같은 커밋 안에서 커밋 메시지·plan 은 "라운드 8"이라 하는데, 그 커밋이 넣은 소스 주석만
    "라운드 9"라고 적어 자기모순이다.
  - 왜 문제인가: 이 저장소는 "라운드 N" 인용을 git 히스토리·plan 체크리스트·review 세션
    폴더를 잇는 추적 앵커로 매우 엄격하게 쓴다(라운드 6 항목 "숫자를 세지 않고 썼다"가
    정확히 같은 클래스의 선례다 — 그때는 `.filter()` 호출 횟수, 이번엔 라운드 번호). 지금
    이 리뷰 자신이 "라운드 9"이므로, 이번 라운드가 끝나 fix 커밋이 생기면 그 커밋도 자기를
    "라운드 9"라 부르게 되어 **동일 PR 안에 "라운드 9"를 자칭하는 서로 다른 두 지점**이
    생긴다 — 다음 사람이 `git log --grep "라운드 9"`로 추적하면 어느 쪽이 실제 라운드 9인지
    헷갈린다.
  - 기능적 영향은 없다(주석뿐, 테스트·로직 무변경) — 그래서 CRITICAL 이 아니라 WARNING.
  - 제안: `(라운드 9 정정)` → `(라운드 8 정정)`으로 1단어 수정.

- **[INFO]** `[SPEC-DRIFT, 이미 등재·판정 완료 — 재확인만]` spec 6파일이 `CONTAINER_MISSING_EMIT`/
  `CONTAINER_MULTIPLE_EMIT`을 여전히 정식 에러 코드처럼 서술한다 — 코드가 옳고 spec 이 낡음
  - 위치: `spec/5-system/4-execution-engine.md:332-333` §3.0 · `spec/3-workflow-editor/
    2-edge.md:202` §6.1 · `spec/3-workflow-editor/0-canvas.md:636` §11.2.2 ·
    `spec/4-nodes/1-logic/0-common.md:83` · `spec/4-nodes/1-logic/7-map.md:179-180` §6 ·
    `spec/4-nodes/1-logic/9-foreach.md:209-210` §6
  - 상세: 실측(`execution-engine.service.ts:7121·7125·7130`+`:8017`)으로 이 두 이름이
    `error.code`로 방출되지 않고 `Error` 메시지 접두일 뿐임을 직접 확인했다 — 이번 PR 의
    가이드 문장 정정(`logic{,.en}.mdx`)이 코드 실측과 정확히 일치한다. 반면 spec 6파일은
    여전히 코드처럼 서술해 정면으로 어긋난다. `plan/in-progress/
    spec-draft-nullable-notation-followups.md:3473`에 planner 항목으로 이미 등재돼 있고
    (`spec/4-nodes/1-logic/3-loop.md:189-191`이 발행 문자열 전문을 인용하는 올바른 선례로
    함께 지목됨), 9라운드 연속 같은 판정(코드 유지·spec 갱신은 planner 몫)이 반복 확인됐다.
    본 reviewer 도 동일하게 판정한다 — **코드 fix 대상 아님**, 새 조치 불필요.
  - 제안: 조치 불요(이미 planner 트래커 등재분). spec 반영 시 위 6파일 + `3-loop.md`
    선례 패턴을 따를 것.

- **[INFO]** 그 외 기능 완전성·엣지 케이스·에러 시나리오·반환값 관점에서 새로 지적할
  CRITICAL/WARNING 없음
  - `computeNonEmittedOffenders`의 4항 필터 체인(인용·접두-전용·카탈로그·등록)은 진리표
    5칸이 각각 독립 뮤테이션으로 검증돼 있고(라운드 5), `resolveSourceLines`의 0건/1건/
    2건 이상 3분기, `parseWhereRefs`의 정상/구분자-불일치/산문 3분기가 전부 판별 fixture로
    고정돼 있다(라운드 3·7·8). 직접 실행한 82개 테스트가 전부 GREEN 이고, 헬퍼-vs-호출부
    구분(라운드 5·7의 반복 결함 클래스)도 정본 통합(`computeNonEmittedOffenders`)으로
    해소돼 있다.
  - `where` 필드의 `hits.length !== 1`(파일 내 줄 0건/2건 이상) 분기는 실코퍼스가 항상
    1건만 만들어 아직 합성 fixture 가 없다는 점이 라운드 3부터 반복 유예돼 있다 — 새로
    발견한 것이 아니라 기존 유예의 재확인.
  - TODO/FIXME/HACK/XXX 주석 검색 결과 0건(변경 파일 전수).

## 요약

9라운드째 검토이며 실질 코드(`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`)는
진리표 대조군·뮤테이션 검증·경계 fixture 로 극히 촘촘하게 하드닝돼 있고, 82개 테스트를
독립 재현해 전부 GREEN 임을 확인했다. `CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT`이
`error.code`로 방출되지 않는다는 이번 PR 의 핵심 주장은 소스 코드를 직접 열어 실측 일치를
확인했다. spec 6파일의 서술이 낡았다는 점은 SPEC-DRIFT 로 이미 올바르게 등재·위임돼 있어
새 조치가 필요 없다. 이번 라운드에서 새로 찾은 것은 하나뿐이다 — 직전 라운드(8)의 fix
커밋이 자기 자신을 "라운드 9 정정"이라 잘못 표기한 1단어 자기-인용 오류(같은 커밋의
메시지·plan 은 정확히 "라운드 8"이라 함). 기능에 영향은 없으나, 이 저장소가 "라운드 N"을
추적 앵커로 엄격히 쓰는 관례상 다음 라운드가 진짜 "라운드 9"를 자칭하면 동일 PR 안에
중복 라벨이 생기므로 지금 정정할 것을 권한다.

## 위험도

LOW
