# 테스트(Testing) 리뷰 — 내부 패키지 등록 목록 drift 가드

대상: `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`,
`codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` (신규)

## 검증 방법

정적 코드 리딩 외에, 실제로 `pnpm --filter frontend test` 경로로 신규 테스트를 실행했고(12/12 pass),
가드의 핵심 주장("실제 drift 를 잡는다")을 **작업 트리를 임시로 mutate 한 뒤 즉시 원복**하는 방식으로
3가지 현실적 회귀 시나리오에 대해 직접 검증했다 (매 회 `git status --short` 로 완전 원복 확인):

1. `.claude/test-stages.sh` 의 `INTERNAL_PACKAGES` 에서 항목 1개 제거 → `cmd_unit`/`cmd_build` 테스트
   2건이 정확한 패키지명과 함께 즉시 실패 (`@workflow/node-summary` 누락 리포트).
2. `.github/workflows/packages-checks.yml` 의 `matrix.pkg` 에서 항목 1개 제거 → 해당 테스트가
   기대/실제 diff 를 정확히 출력하며 실패.
3. `codebase/packages/` 에 등록되지 않은 새 패키지 디렉터리(`package.json` 포함)를 추가 →
   `cmd_lint`/`cmd_unit`/`cmd_build` 3건 모두 그 신규 패키지명을 누락으로 정확히 리포트.

세 시나리오 모두 가드가 의도대로 동작함을 확인했다 — PR #968 이 실제로 겪은 결함 클래스(신규 패키지가
어떤 손 목록에도 안 걸린 채 조용히 무검증)를 이 가드는 실제로 차단한다.

## 발견사항

- **[WARNING]** 가드 자신의 "실패해야 할 때 실제로 실패하는가"(true-positive)를 증명하는 자동화된
  테스트 케이스가 스위트 안에 없다
  - 위치: `internal-package-registration.test.ts` 전체 — vacuity 방지 describe 블록(파싱이 빈 값이
    아님을 확인)은 있으나, 의도적으로 어긋난 합성 입력(fixture)을 넣어 "이 경우엔 반드시 실패해야
    한다"를 못박는 `it()` 은 없다.
  - 상세: 같은 저장소의 자매 가드 테스트 `src/lib/__tests__/eslint-layering-guard.test.ts` 는 정확히
    이 패턴을 따른다 — "위반으로 잡혀야 하는 형태"/"위반으로 잡히면 안 되는 형태" 를 합성 코드로
    직접 linter 에 먹여 `it.each` 로 고정한다("mutation 이 테스트를 통과해버린다"는 코멘트까지 명시).
    반면 본 파일은 **실제 저장소의 현재(=이미 정렬된) 상태**만 읽어 대조하므로, 비교 로직 자체(예:
    `missing` 계산·`Set` 멤버십·`.toEqual` 방향)에 회귀가 생겨도 — 이 스위트 안에서는 — 아무것도
    잡아내지 못한다. 본 리뷰에서 위 3가지 시나리오를 수동으로 mutate 해 실제로는 정상 동작함을
    확인했지만, 그 검증이 이 테스트 스위트 자체에 코드로 박혀 있지 않다.
  - 제안: `internalPackages(sh)`, `fnBody(sh, fn)`, `listAtPath(lines, keys)` 등은 이미 문자열/배열을
    인자로 받는 순수 함수라 파일 I/O 를 건드리지 않고도 합성 입력으로 유닛 테스트 가능하다. 예:
    `internalPackages("INTERNAL_PACKAGES=(\n  \"@workflow/x\"\n)")` 처럼 최소 fixture 로 "누락 시
    반드시 detect" 케이스 2~3개를 추가해 회귀 방지를 스위트 안에 고정할 것.

- **[WARNING]** `fnBody` 의 자기점검(self-check)이 방어한다고 주장하는 범위보다 실제 방어 범위가 좁다
  (heredoc 등으로 인한 조용한 조기 절단은 미검출)
  - 위치: `internal-package-registration.test.ts:423-437` (`fnBody`)
  - 상세: 코드 주석은 "본문에 라인 시작 블록 `{` 가 있으면 throw 한다"고 명시하지만, 실제 위험은
    "라인 시작에 `}` 단독 문자열이 (브레이스가 아니라) 나타나는 모든 경우"다. 예를 들어 `cmd_build`
    본문에 `cat <<MARKER ... } ... MARKER` 형태의 heredoc 이 들어가고 그 heredoc 본문에 우연히
    `}` 한 줄이 있으면, 닫는 브레이스 정규식(`/^\}$/m`)이 그 줄을 함수의 실제 종료로 오인해 본문을
    조기 절단한다. 이때 자기점검 정규식(`^\s*(\{|...)\s*$`)은 라인 시작 `{` 만 찾으므로 이 케이스는
    **throw 없이 조용히 통과**한다 — 절단된 이후에 등록된 패키지는 아무 에러 없이 "실행되지 않는
    패키지 목록"에서 누락된다. 이는 파일 자신의 설계 목표("조용히 틀리느니 깨지게 만든다", #968 이
    막으려던 바로 그 실패 유형)를 정확히 재현하는 사각지대다. 격리된 재현으로 실측: 합성
    `cmd_build() { ...; cat <<MARKER\n}\nMARKER\n pnpm --filter frontend build\n}` 입력에 대해
    `fnBody` 가 `frontend` 등록을 포함한 뒷부분을 자른 본문을 **에러 없이** 반환함을 직접 확인했다
    (현재 `.claude/test-stages.sh` 의 `cmd_lint`/`cmd_unit`/`cmd_build` 는 heredoc 을 쓰지 않으므로
    지금 당장 이 경로가 트리거되지는 않는다 — 잠재적 사각지대).
  - 제안: 자기점검 조건을 "라인 시작에 `{` 또는 `}` 단독으로 나타나는 모든 줄"로 확장하거나(더 보수적
    이고 안전), 최소한 주석에 "heredoc 등 line-start `}` 리터럴은 이 self-check 의 범위 밖" 임을
    명시해 향후 이 파일을 신뢰하는 사람이 실제보다 넓은 보장을 오해하지 않도록 할 것.

- **[INFO]** `explicitFilterCalls` 가 `pnpm --filter <pkg> <script>` 를 한 줄(연속 공백)로만 가정 —
  백슬래시 줄바꿈 연속에 취약하나 fail-safe (loud) 하게 깨짐
  - 위치: `internal-package-registration.test.ts:440-444` (`explicitFilterCalls`)
  - 상세: 정규식 `pnpm\s+--filter\s+"?([^\s"$]+)"?\s+"?([\w:-]+)"?` 은 `--filter` 다음 토큰이
    개행 없는 연속 공백으로 이어진다고 가정한다. `pnpm --filter \` 뒤 다음 줄에 패키지명이 오는
    스타일(가독성을 위한 흔한 bash 관례)로 재포맷되면, `\` 문자 자체가 이름 캡처 그룹에 걸려
    (`[^\s"$]+` 는 `\` 를 허용) 실제 패키지명이 아닌 `"\\"` 를 이름으로 오인식한다. 격리 재현으로
    확인: `"pnpm --filter \\\n    backend lint"` 입력 시 `{name: "\\", script: "backend"}` 를
    반환(의도된 `{name:"backend", script:"lint"}` 가 아님). 이 경우 실제로는 정상 등록된 패키지가
    "누락"으로 오탐 실패하므로 **silent 실패는 아니다**(fail loud) — 다만 `.claude/test-stages.sh`
    를 줄 길이 등 이유로 재포맷하면 실제 drift 없이도 이 가드가 노이즈성으로 깨질 수 있다. 이
    저장소엔 shellcheck/shfmt 자동 포맷 강제가 없어(`.github/workflows/*.yml` grep 확인) 수동
    재포맷 가능성이 남아 있다.
  - 제안: 현재로선 실질적 리스크가 낮음(현재 3개 cmd_* 함수 모두 한 줄 스타일 유지). 주석에 "각
    `pnpm --filter` 호출은 한 줄 안에 있어야 한다"는 전제를 명시해 두면 향후 재포맷 시 이 가드가
    깨지는 이유를 빠르게 추적할 수 있다.

- **[INFO]** 로직 자체는 sibling 가드 테스트(`eslint-layering-guard.test.ts`, `spec-link-integrity.test.ts`)와
  동일하게 "가드 로직을 테스트 파일 안에 인라인"하는 이 저장소의 확립된 패턴을 따른다 — 별도
  lib 모듈로 분리하라는 일반적 테스트 용이성 지적은 이 저장소 컨벤션에 반하므로 적용하지 않음.

- **[INFO]** Mock 미사용, 완전히 실제 파일을 읽는 통합 스타일 — 이 가드의 목적(실제 저장소 상태
  drift 검출)에 정확히 부합하는 선택이며 부적절한 mock 사용 없음. 테스트 격리도 문제 없음(읽기
  전용, 다른 테스트와 공유 mutable 상태 없음, describe 블록 최상단 1회 계산으로 파일 재독 최소화).

- **[INFO]** 가독성 우수 — 각 `describe`/`it` 제목과 실패 메시지가 원인·조치법·배경 이슈(#968)를
  모두 담아, 실패 시 원인 파악에 추가 조사가 거의 필요 없다. 함수 docstring 도 각 휴리스틱의
  안전 조건을 명시적으로 서술한다(위 WARNING 은 그 서술이 실제 코드 커버리지보다 넓게 주장된 지점).

## 요약

신규 drift 가드 테스트는 실제로 동작한다 — 본 리뷰에서 3가지 현실적 회귀 시나리오(INTERNAL_PACKAGES
누락, yml matrix 누락, 완전 신규 미등록 패키지)를 작업 트리에 직접 mutate 해 재현했고, 매 회 정확한
실패 메시지와 함께 가드가 즉시 red 로 전환됨을 확인했다(이후 전부 원복, 저장소에 잔여 변경 없음).
vacuity 방지 스위트도 잘 갖춰져 있어 파싱 실패가 조용한 PASS 로 이어지는 것을 막는다. 다만 이
검증이 스위트 자신의 코드로는 고정돼 있지 않다 — 같은 저장소의 성숙한 자매 가드
(`eslint-layering-guard.test.ts`)가 갖춘 "합성 fixture 기반 true-positive/negative 고정" 패턴이 이
파일엔 없어, 비교 로직 자체의 향후 회귀를 스위트 내부에서 잡지 못한다. 또한 정규식 기반 파서 2곳
(heredoc 으로 인한 조용한 조기 절단·백슬래시 줄바꿈으로 인한 이름 오인식)에 현재는 트리거되지
않는 잠재 사각지대가 있으며, 특히 heredoc 케이스는 이 파일이 막으려는 "조용한 무검증" 실패 클래스를
파서 자신 안에서 재현할 수 있다는 점에서 주목할 가치가 있다. 전반적으로 실질적 방어력은 높고
당면 리스크는 낮으나, 위 갭들을 좁히면 "가드를 가드하는" 이 파일의 신뢰도가 한 단계 더 올라간다.

## 위험도

LOW
