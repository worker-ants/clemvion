# 요구사항(Requirement) Review

대상: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py` (`_named_in` 경계 고정 매치),
`.claude/tests/test_consistency_bundle_priority.py` (신규 boundary 테스트),
`plan/complete/consistency-named-in-substring-match.md` (완료 plan)

요구사항: "무관한 파일이 이름 부분 문자열로 on-topic 티어에 승격되지 않게 한다."

## 재현 결과 (직접 호출로 검증)

`_named_in` 을 실제 모듈에서 로드해, plan 본문의 그 줄(오늘 트리거였던
`plan/in-progress/harness-review-gate-followups.md:44-53`, `conventions/secret-store.md` 등
5개 파일을 나열한 실제 리스트)을 그대로 넣고 실행했다.

```
cafe24-api-catalog/store.md   -> False  (오매치 대상 — 기대대로 차단)
conventions/secret-store.md   -> True   (실제 언급 — 정상 매치)
conventions/swagger.md        -> True   (실제 언급 — 정상 매치)
5-system/1-auth.md            -> True   (실제 언급 — 정상 매치)
conventions/error-codes.md    -> False  (미언급 — 정상)
```

plan 이 주장한 재현 결과("store.md → False, secret-store.md·swagger.md·1-auth.md → True,
error-codes.md → False")와 정확히 일치한다. 요구사항의 핵심 — "무관한 파일이 부분 문자열로
승격되지 않는다" — 는 실측으로 충족을 확인했다. `test_consistency_bundle_priority.py` 를
로컬에서 실행해 35 passed / 4 subtests 도 확인했다(plan 이 주장한 3개 파일 합산 "66 passed /
33 subtests" 는 이 파일 하나만으로는 검증 범위 밖이라 재확인하지 않음).

## 엣지 케이스 전수 점검

| 케이스 | 결과 | 판정 |
| --- | --- | --- |
| `auth.md` rel, 언급은 `auth-config.md` 만 | `False` | 의도대로. 단 이 쌍은 애초에 부분 문자열 관계가 아니다(`"auth.md"` 는 `"auth-config.md"` 의 리터럴 substring 이 아님 — `.` vs `-` 위치 불일치) — 실제 접두 충돌 예시로는 성립하지 않는 케이스였다 |
| `auth-config.md` rel, 언급은 `auth.md` 만 | `False` | 의도대로 |
| 확장자 없는 언급 (`4-execution-engine` bare) | `False` | `_named_in` 은 `.md` 포함 전체 basename 을 needle 로 쓰므로 확장자 없는 언급은 원래부터(구코드 때도) 매치 대상이 아니었다 — 이번 변경으로 인한 회귀 아님 |
| 대소문자 차이 (`STORE.MD` vs `store.md`) | `False` | 구코드도 대소문자 구분(`in`)이었으므로 동일 — 회귀 아님 |
| 경로 구분자 `\` (Windows 스타일) | `True` | `rel`(정방향 슬래시) 매치는 실패하지만 **basename 폴백**이 구분자를 포함하지 않아 항상 성공 — 실사용상 문제 없음 |
| Korean 조사 직접 결합 (`store.md파일을`, 공백 없음) | `True` | 경계 클래스가 ASCII `[A-Za-z0-9_.\-]` 만 배제하므로 한글 문자는 경계로 인정돼 정상 매치 — 이 저장소 산문 관용구에 안전 |
| 문장 끝 마침표 (`store.md.`) | `True` | 설계 의도대로(주석·plan 에 명시) |

## 발견사항

- **[WARNING]** 후행 경계(`_NAME_END`)가 `.` 을 배제 클래스에 넣지 않아, `X.md` 뒤에 곧바로
  `.<추가토큰>` 이 붙는 형태(예: `store.md.bak`, `x.md.orig` 류의 이중 확장자 언급)가 오면
  **여전히 부분 문자열로 오매치**된다. 실측:
  ```
  _named_in("spec/conventions/store.md", "참고로 store.md.bak 백업 파일을 확인하라") -> True
  ```
  이는 이번 fix 가 닫으려던 것과 **같은 결함 클래스**(무관한 `.md` 파일이 다른 파일명 언급에
  올라타 승격됨)이고, `_named_in`/`_NAME_END` 위의 주석("트레일링 `.` 은 평범한 산문이라 배제
  않는다")은 문장 종결 마침표만 고려했지 이중 확장자 형태는 검토한 흔적이 없다. 다만 `spec/`·
  `plan/` 전체를 grep 한 결과 현재 저장소에는 `*.md.*` 형태의 파일이나 그런 언급이 전혀 없어
  (`find`/`grep` 0건) **잠재적이며 지금 당장 트리거되지는 않는다**. 회귀는 아니다 — 구코드
  (bare `in`)도 이 형태에 똑같이 취약했다. Fix 의 완결성을 100%로 두지 말고 인지해 둘 가치는
  있음.
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:289-293`
    (`_NAME_END = r"(?![A-Za-z0-9_\-])"` 및 그 위 rationale 주석)
  - 제안: 당장 코드를 고칠 필요는 없다(현재 무해·pre-existing). 다만 plan 의 "후속(등재만)"
    항목에 이 형태(이중 확장자 트레일링)도 한 줄 추가해 두면, 나중에 이 gap 이 실제로
    트리거됐을 때 "이미 알려진 잔여 결함"으로 빠르게 판별 가능하다.

- **[INFO]** `_named_in` 은 `.claude/` 하위 harness 내부 스크립트이고, 관련 spec 문서는 없다
  (`spec/`, `.claude/skills/consistency-checker/SKILL.md`, `.claude/docs/` 어디에도
  `_named_in`/`prioritize_bundle_files`/"boundary-anchored" 언급 없음). CLAUDE.md 규약상
  `.claude/` 도구는 `spec/` 대상이 아니므로 spec 누락은 정상이며 결함이 아니다.

- **[INFO]** plan 의 "후속(등재만)" 항목 — `--impl-done` code diff 에 예산 바닥(floor)을
  까는 별도 방어 — 은 **이번 요구사항과 별개 결함**이다. 이번 fix 가 닫은 것은 "무관한 파일이
  부분 문자열로 오매치돼 승격되는 것"이고, 후속 항목이 다루는 것은 "브랜치가 **정당하게** 여러
  대형 spec 파일을 편집해 diff 가 밀려나는 것" — 원인이 다르다. plan 의 Rationale 에 그
  구분 근거가 명시돼 있고("원인을 먼저 닫는다"), 완료된 plan 파일에 미체크 항목(`- [ ]`)으로
  등재돼 유실 없이 추적되고 있다. 이번 PR 이 했어야 할 일을 미룬 것이 아니라 실제로 별개
  스코프다.

- TODO/FIXME/HACK/XXX 주석: diff 범위에 없음(grep 0건).
- 반환값: `_named_in` 은 `plan_text` 가 falsy(`None`/`""`)일 때도 `False` 를 명시 반환하며
  모든 경로에서 `bool` 반환 — 누락 없음.
- 양방향 뮤테이션 검증(plan 기재: 경계 제거 2건 RED, 과잉 조임 4건 RED)은 이번 세션에서 재실행하지
  않았으나, 로컬 재실행한 35 passed 결과와 plan 의 재현 케이스 실측 일치로 볼 때 신뢰할 만하다.

## 요약

핵심 요구사항("무관한 파일이 이름 부분 문자열로 on-topic 티어에 승격되지 않는다")은 실제
`_named_in` 호출과 오늘 트리거였던 실제 plan 본문으로 재현·검증했고, 관측된 실패 케이스
(`cafe24-api-catalog/store.md` 오매치)가 정확히 닫혔으며 정당한 언급(4가지 형태: frontmatter·
markdown 링크·백틱 basename·문장 끝 bare)은 전부 보존됨을 확인했다. 요청받은 엣지 케이스
(접두 충돌·확장자 없는 언급·대소문자·백슬래시 구분자)는 전수 점검한 결과 전부 의도대로거나
사전부터 있던 동일 동작이라 회귀가 아니다. 유일한 실질 발견은 후행 경계가 `.` 을 배제하지
않아 생기는 이중 확장자(`X.md.bak` 류) 오매치 잠재 gap인데, 현재 저장소에는 트리거 조건이
전혀 없고 구코드에도 있던 pre-existing 약점이라 이번 PR 의 결함이 아니다. plan 이 명시적으로
남긴 "diff 예산 바닥" 후속 항목은 근거가 분명한 별개 스코프이며 등재 상태로 정상 추적되고
있다.

## 위험도
LOW

STATUS: OK
