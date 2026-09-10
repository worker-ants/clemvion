# 부작용(Side Effect) 리뷰 — 3라운드

대상 diff: `c696ace07`(2라운드) → `64334e708`(HEAD, 3라운드). 초점은 프롬프트 지시대로
`trigger-workflow-ref.ts` 의 docstring→`//` 파일 스코프 註 이동 1건으로 좁혔다. 이전 라운드가
등재한 가드 사각지대(감지 가드 부재)·`secret_store` 관례는 재지적하지 않는다.

## 검증 방법

저장소에는 아무것도 쓰지 않았다. `git show c696ace07:<path>` / `git show 64334e708:<path>` 로 두
버전을 각각 scratch(`/private/tmp/.../scratchpad/{old,new}_full.ts`)에 받아 `sed`+`diff -u` 로
주석 마커(`* `, `// `, `> `)를 벗겨낸 정규화 텍스트를 문장 단위로 대조했다.

## 발견사항

- **[INFO]** 이동된 서술은 **세 갈래 기술 주장 전부 문자 그대로 보존**됐다 — 변형 없음
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts:16-22` (신규 `//` 註,
    "exclude 는 root 후보만 거른다" · "import 하면 tsc 가 dist/ 로 emit" · "`@types/jest` 가
    ambient 라 컴파일 에러 없음, 호출 시에만 `ReferenceError`" · "현재 import 0건, 감지 가드
    없음")
  - 상세: 이 네 문장은 이전 커밋(`c696ace07`)의 orphaned `/** */` 안에 있던 동일 문장과 `diff -u`
    정규화 대조 결과 **완전 일치**(문자 단위, 코드 스팬 포함)한다. 이동 과정에서 내용이 추가·삭제·
    약화된 곳이 없다. 프롬프트가 지목한 "저자 주장(내용은 그대로 유지)"은 이 네 문장에 한해 **실측
    확인**됐다.
  - 변경된 것은 이 네 문장을 감싸는 앞뒤 대명사·서식뿐이다(전부 의미 보존 범위):
    - 헤더: `## 왜 test/helpers/ 가 아니라 여기인가` → `─── 이 파일이 test/helpers/ 가 아니라
      src/shared/testing/ 에 있는 이유 (파일 스코프) ───` (더 구체화, 의미 동일)
    - `이 절의 전제는...` → `이 판단의 전제는...`, `이 서술이` → `이 註가`, `이 절 자신도` →
      `이 註 자신도` — "절(section)"이 더 이상 JSDoc `## ` 섹션이 아니라 독립 `//` 註가 됐으므로
      지시어를 그에 맞게 바꾼 것. 지시 대상(자기 자신)은 동일하다.
    - `production 빌드 유출도` → `production 빌드 유출은` — 조사(도→은) 변경. 같은 문장 뒤쪽에
      이미 "그것 역시 과장이었다"의 "역시"가 있어 "도"가 중복이었던 것을 정리한 것으로 읽힌다.
      의미 축소·과장 방향 어느 쪽으로도 치우치지 않는다.
  - 결론: 제안할 수정 없음 — 이 항목은 결함이 아니라 확인 결과다.

- **[INFO]** `//` 註 전환이 현재 이 저장소의 **어떤 도구 동작도 바꾸지 않는다** — 대상 도구 부재 확인
  - 위치: `codebase/backend/eslint.config.mjs`(jsdoc 관련 규칙 없음), `codebase/backend/package.json`
    (`typedoc`/`compodoc` 등 문서 생성기 의존성 없음), `.claude/tools`·`.claude/hooks`(orphaned-JSDoc
    또는 doc-comment 를 파싱하는 repo-guard 없음 — grep 결과 0건)
  - 상세: 검사 관점 8번("이벤트/콜백")과 무관하지만 이 라운드의 초점 2번("`//` 註로 바뀐 것이 어떤
    도구의 동작을 바꾸는지")에 대한 직접 답으로, 이 파일을 대상으로 doc comment 를 소비하는 lint
    플러그인·문서 생성기·CI 가드가 이 저장소에 **하나도 없다.** 즉 `/** */` → `//` 전환은 순수
    가독성/구조 목적이며 부작용(다른 파이프라인의 침묵 동작 변화)을 만들 표면이 현재는 없다. 코드
    자체가 명시한 "이 註 자신을 감지할 가드는 아직 없다"(후속 등재, side_effect 재지적 대상 아님)와
    일관된다.
  - 제안: 없음(정보성 확인).

- **[INFO]** self-spec 재배열은 모듈 스코프 가변 상태를 도입하지 않아 순서 의존성이 없다
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.spec.ts` 전체 `describe`
    블록(가드 1~10 재배치 + `id: 42` fixture 를 `id: { toString: () => WF_ID }` 로 교체)
  - 상세: `WF_ID`·`WITH_WORKFLOW`·`WITHOUT_WORKFLOW` 는 모두 `describe` 스코프 `const` 객체
    리터럴이고, 모든 `it()` 은 이들을 스프레드(`{ ...WITH_WORKFLOW, ... }`)로만 사용해 새 객체를
    만든다 — 원본을 직접 변형(mutate)하는 대입이 없다. `let`/공유 mutable 컨테이너·`beforeEach`
    부작용도 없다. 따라서 `it()` 블록을 헬퍼의 가드 실행 순서(dto not-null → 비밀 컬럼 → present
    → 키셋 → id 타입 → id UUID → name 타입 → name 길이 → identity)에 맞춰 재배치한 것은 각
    테스트를 독립적으로 유지하며, 실행 순서를 바꿔도(jest `--testSequencer` 등) 결과가 달라지지
    않는다.
  - `trigger-workflow-ref.ts` 쪽에서도 `TRIGGER_SECRET_COLUMNS`/`WORKFLOW_REF_KEYS` 선언이 파일
    앞쪽(신규 `//` 註 바로 다음)으로 이동했지만, 두 값 모두 `expectTriggerWorkflowRef` 함수 **본문
    안**에서만 참조되고 함수는 나중에 호출되므로(모듈 최상위 평가 시점이 아님) 선언 순서 이동이
    TDZ·초기화 순서 문제를 일으키지 않는다.
  - 제안: 없음(정보성 확인).

- **[INFO] (관측 보고 — 판정 대상 아님)** 리뷰 도중 동일 파일에 다른 프로세스의 미커밋 뮤테이션 관측
  - 위치: `codebase/backend/src/shared/testing/trigger-workflow-ref.ts` (working tree, 커밋 아님)
  - 상세: 리뷰 중 `git status --short` 로 확인한 결과, 이 커밋(`64334e708`)의 파일에 대해 다음
    미커밋 diff 가 관측됐다 — `expect(workflow).not.toBeNull();` 한 줄이 지워진 상태다. 이 리뷰가
    대상으로 하는 커밋(`64334e708`)에는 없는 변경이며, 프롬프트가 사전 경고한 "병렬 fan-out 중 다른
    reviewer 가 뮤테이션 검증을 진행 중"인 상황과 정확히 일치한다(`plan/in-progress/
    harness-review-gate-followups.md` §N 이 같은 패턴을 이미 등재했다 — `testing` reviewer 가
    가드 3 검증을 위해 이 정확한 줄을 지우는 뮤턴트를 쓴 이력이 있다). 이 리뷰는 저장소에 아무것도
    쓰지 않았고 `git restore`/`checkout` 도 실행하지 않았다 — 규약대로 관측만 보고한다.
  - 제안: 오케스트레이터가 다른 reviewer 의 원복 완료 여부를 확인할 것. 이 리포트의 판정에는
    영향 없음(이 상태는 이 리뷰가 분석한 `64334e708` 스냅샷의 일부가 아니다).

## 요약

이번 라운드의 좁은 초점 4가지를 모두 확인했다. (1) docstring→`//` 이동에서 핵심 세 갈래 기술
주장(exclude=root 후보만·import 시 emit·ambient 라 컴파일 에러 없음·현재 import 0건)은 문자
단위로 보존됐고 주변 지시어·조사만 comment 형식에 맞춰 자연스럽게 바뀌었다 — 내용 왜곡 없음. (2)
이 저장소에는 `/** */` 를 `//` 와 다르게 취급하는 lint 플러그인·문서 생성기·repo-guard 가 존재하지
않아, 형식 전환 자체가 어떤 도구의 동작도 바꾸지 않는다. (3) self-spec 재배열은 스프레드로만
객체를 다루는 순수 `const` 픽스처 위에서 이뤄져 테스트 간 상태 공유·순서 의존성을 만들지 않는다.
부작용 관점에서 이번 커밋이 새로 만든 결함은 없다. 다만 리뷰 도중 동일 파일에 대한 다른 프로세스의
미커밋 뮤테이션(한 줄 삭제)을 관측했으며, 이는 이 리뷰가 손대지 않은 병렬 활동이므로 그대로
보고한다.

## 위험도

NONE

STATUS: success
