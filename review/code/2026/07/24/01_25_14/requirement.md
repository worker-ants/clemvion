# 요구사항(Requirement) 충족 리뷰

## 검증 방법

diff 로 제시된 세 곳의 env-value 정규식 변경(`_MUTATING` in `guard_default_branch_bash.py`,
`_GIT_PUSH` in `guard_review_before_push.py`, `_BLIND_PATTERN` in `test_push_guard_allowlist.py`)
을 실제 워크트리에서 직접 실행/재현했다:

- `.claude/tests/test_guard_default_branch_bash_mutating.py` + `test_push_guard_allowlist.py`
  pytest 실행 → **69 passed, 214 subtests passed**.
- 세 변경 지점이 정확히 일치(`grep`)하고, 다른 은닉 사본이 남아있지 않음을 확인.
- `plan/complete/harness-push-guard-subcommand-detection.md` 가 실제로 `plan/complete/`에
  존재함을 `git log --follow`로 확인 — SoR 주석 경로 수정(`in-progress`→`complete`)이 정확함.
- 새 fallback(`\S+`)이 따옴표 문자와 겹치면서(overlap) 발생할 수 있는 파국적 백트래킹을
  직접 adversarial 페이로드(미종료 따옴표 3만 회 반복, 따옴표 문자 10만 개 연속 등)로
  양쪽 훅에 대해 재현 — 모두 수 ms 내 종료, ReDoS 없음을 재확인(기존 `BacktrackingTest` 밖의
  추가 케이스로도 검증).
- `A='x mkdir foo"`, `'A="unclosed git commit -m x'`, `"A=' git commit -m x"` 등 신규 assertTrue
  케이스와 `"VAR= git commit -m x"` assertFalse 케이스를 정규식 엔진 동작으로 수동 트레이스해
  테스트 기대값과 일치함을 확인.
- §L canary(`A="a b"c git push` 류)가 여전히 미탐지(`assertFalse`)로 남아있는지, 그리고 넛지 훅
  (`_MUTATING`)도 동일 갭을 공유하는지(`A="a b"c mkdir foo` → `False`) 별도로 실행해 확인.

## 발견사항

- **[INFO]** 관련 spec 문서 없음 (spec 부재)
  - 위치: `spec/` 전체
  - 상세: `spec/` 하위에 `guard_review_before_push`, `guard_default_branch_bash`, `_GIT_PUSH`,
    `_MUTATING` 등을 언급하는 문서가 전무함(grep 확인). 이 변경은 `.claude/` 하네스 개발 도구이며
    제품 코드(`codebase/**`)가 아니므로 `spec/`의 통제 대상이 아니다. 대신 `plan/in-progress/
    harness-guard-followups.md`가 사실상의 요구사항 기록(SoR) 역할을 하며, 본 diff 는 그 문서의
    Overview·체크리스트·신규 섹션(§J-후속/§L)과 line-level 로 정확히 일치한다(아래 참고).
  - 제안: 조치 불요 — 이 영역은 spec 커버리지 대상 밖(harness 도구)이라는 판단 근거를 기록.

- **[INFO]** plan 문서와 코드 상태의 정합성 — 문제 없음, 근거 기록용
  - 위치: `plan/in-progress/harness-guard-followups.md` §J-후속/§L, 체크리스트
  - 상세: §J-후속 항목의 체크박스 3개는 모두 `[x]`이며 실제로 (1) 두 훅 + 1개 테스트 미러
    (`_MUTATING`/`_GIT_PUSH`/`_BLIND_PATTERN`) 총 3곳에 `\S+` fallback 이 반영됐고, (2)
    `GeneratedFloorTest`(push 가드)·`OldEnvPrefixSupersetTest`(넛지 훅)가 실제로 추가돼 생성
    입력으로 무손실(superset)을 기계적으로 검증하며, (3) 넛지 훅의 기존 테스트(`test_malformed_
    env_values_stay_unmatched`)가 버그를 "의도된 갭"으로 고정하던 것을 교체했다는 서술도 실제
    diff 와 일치. §L 항목은 `[ ]`(미해결) 상태 그대로이고, 코드도 실제로 그 버그 동작을 그대로
    유지한 채 canary(`KnownFalseNegativeTest`)만 추가돼 있어 "고쳤다"는 과장이 없다. 체크박스가
    실제 코드 상태를 왜곡 없이 반영한다.
  - 제안: 조치 불요.

- **[INFO]** 커밋 메시지/plan 표의 "생성 입력 168건, #1002 대비 28건 손실·12건 획득" 수치를
  현재 `GeneratedFloorTest` fixture(`_VALUES`×`_TEMPLATES`)로 재현 시 정확히 일치하지 않음
  (직접 재현 시 도출된 총 케이스·손실/획득 수가 다름 — 재현 스크립트의 정확한 값/템플릿 조합을
  알 수 없어 어떤 차이인지 특정은 못 함)
  - 위치: `plan/in-progress/harness-guard-followups.md` (J-후속 섹션의 표), 커밋 메시지
    (`11a94fe9b`)
  - 상세: 정성적 결론("§L 미포함 상태에서 새 패턴은 legacy 대비 0건 손실, 여러 건 획득 —
    엄밀한 상위집합")은 여러 방식의 재구성으로 독립 검증되어 **참**이다. 다만 "168/28/12"라는
    정확한 숫자 자체는 어떤 정확한 값·템플릿 조합에서 나왔는지 diff 만으로 역산되지 않아, 서술과
    정확히 같은 스크립트로 재현하지는 못했다. 코드 동작에는 영향 없는 서술 정밀도 이슈.
  - 제안: 조치 불요(낮은 우선순위). 필요하다면 향후 plan 갱신 시 표의 수치를 산출한 스크립트를
    각주로 남기면 재현성이 높아진다.

- **[INFO]** 넛지 훅(`_MUTATING`)에는 §L(닫는 따옴표에 문자가 붙는 값) 전용 canary 테스트가
  없음 — push 가드에만 `KnownFalseNegativeTest` 추가
  - 위치: `.claude/tests/test_guard_default_branch_bash_mutating.py` (해당 클래스 부재)
  - 상세: 직접 실행 확인 결과 `guard._is_mutating('A="a b"c mkdir foo')` 도 `False`로, 넛지
    훅이 push 가드와 동일한 §L 갭을 실제로 공유한다. plan 문서도 "넛지 훅 `_MUTATING`도 같은
    갭을 공유한다(넛지라 영향은 작음)"이라고 명시적으로 인지하고 있어 은폐된 누락은 아니며,
    이 훅은 애초에 절대 차단하지 않는(soft reminder) 설계라 영향이 실질적으로 작다는 설명도
    타당하다.
  - 제안: 조치 불요/선택적 — 향후 §L 해소 시 두 훅 모두에 대칭적으로 canary 를 맞추는 정도로
    충분.

## 점검 결과 (문제 없음으로 확인된 항목)

- **기능 완전성**: 이번 diff 의 명시적 스코프(§J-후속: `\S+` fallback 원복으로 미종료 따옴표
  FN 제거)는 완전히 구현·검증됨. 별도로 발견된 §L 은 의도적으로 범위 밖에 두고 canary 로만
  고정 — "고쳤다"는 과장 없이 plan 에 `[ ]`로 정직하게 남겨둠(스코프 판단 자체가 합리적).
- **엣지 케이스**: 빈 값(`VAR=`), 미종료 단일/이중 따옴표, 따옴표 시작 직후 공백(`A=' git
  commit`), 여러 env 할당 체인, 대용량 adversarial 입력(backtracking) 모두 테스트 + 직접
  재현으로 커버됨.
- **의도-구현 일치**: 주석이 주장하는 "quoted 대안이 먼저 소비하므로 `\S+`는 그것들이 못 잡는
  것만 받는 엄밀한 상위집합"이라는 설계 논증이 `OldEnvPrefixSupersetTest`/`GeneratedFloorTest`
  로 기계적으로 검증되고, 직접 재현으로도 무손실(0건 lost)임을 재확인.
- **에러 시나리오/반환값**: 순수 정규식 분류 함수(`_is_mutating`/`_is_git_push`)로 항상 bool
  반환, 모든 분기에서 값 존재. 새 예외 경로 없음.
- **비즈니스 로직**: "블라인드 패스는 결코 false negative 를 늘려선 안 된다"는 이 프로젝트의
  핵심 설계 불변식이 두 훅 모두에서 정확히 유지·강화됨(과거보다 더 넓게 잡되, 잃는 것은 없음).
  넛지 훅의 "실수는 nudge 쪽으로"·push 가드의 "실수는 block 쪽으로" 라는 서로 다른 안전 방향
  정책도 그대로 보존.
- **회귀 방지**: 새 `GeneratedFloorTest`/`OldEnvPrefixSupersetTest`는 큐레이션 코퍼스가 놓친
  정확한 원인(값 형태 × 할당 개수의 조합 공간을 사람이 다 상상 못 함)을 생성 기반으로 메꿔,
  "왜 기존 방어가 이 회귀를 못 잡았는가"에 대한 근본 대응이 됨(재발 방지 설계로 타당).
- **TODO/FIXME**: 코드 내 신규 TODO/FIXME/HACK/XXX 주석 없음. plan 의 `- [ ] L`은 프로젝트
  컨벤션상 정식 백로그 항목이지 코드 내 미완성 표식이 아님.

## 요약

이번 diff 는 §J(따옴표 env 접두 우회)를 고치는 과정에서 새로 들여온 §J-후속 회귀(미종료 따옴표
env 값이 접두 그룹을 0회로 붕괴시켜 push/mutating 탐지를 통째로 무력화하던 FN)를 정확히
겨냥해 수정하며, 세 곳(두 훅 + 테스트 미러)의 fallback 대안을 `[^\s'"]\S*` → `\S+`로 원복하는
최소 변경이다. 직접 pytest 실행(69 passed / 214 subtests)과 정규식 수동 트레이스, 그리고
adversarial 백트래킹 재현으로 "엄밀한 상위집합이며 선형 시간"이라는 주석의 핵심 주장을 모두
독립적으로 재확인했다. 함께 발견된 별개 갭(§L, 닫는 따옴표에 문자가 붙는 값)은 파국적 정규식
위험 때문에 의도적으로 스코프 밖에 두고 canary 로만 고정했으며, plan 체크리스트·Overview·
커밋 메시지가 실제 코드 상태와 과장 없이 line-level 로 일치한다. `spec/`가 커버하는 영역이
아니므로(harness 개발 도구) spec fidelity 항목은 INFO 로 처리했고, 그 외 발견사항은 모두 낮은
우선순위의 서술 정밀도 문제뿐이다.

## 위험도
NONE
