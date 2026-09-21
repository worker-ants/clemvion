# 변경 범위(Scope) 리뷰 — `member-dup-remove`

## 검토 방법

`origin/main...HEAD` 전체 diff(13개 파일, `codebase/` 3 + `plan/` 2 + `review/consistency/2026/09/21/12_23_48/` 8)를
prompt 번들 + `Read`/`Bash`(`git log`, `git diff --stat`, `git show --stat`)로 직접 대조했다. 코드 diff(`codebase/`)는
`origin/main...HEAD -- codebase/` 로 재확인했고, 정확히 프롬프트에 실린 3개 파일(`workspaces.service.ts`,
`workspaces.service.spec.ts`, `member-remove-concurrency.e2e-spec.ts`)과 359줄 삽입/2줄 삭제로 일치했다 — 프롬프트 밖에
숨은 코드 변경은 없다.

## 발견사항

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 fix 와 무관한 신규 백로그 항목 3건
  (`auth-configs.service.ts:287`, `model-config.service.ts:404`, `webauthn.service.ts:532`)이 추가됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 라인 4816~4872, diff 게이트 기준)
  - 상세: 이번 PR 의 요청 범위는 `removeMember()` 하나의 동시 DELETE 감사 중복 수정이다. 그런데 착수 전 전수 조사
    과정에서 같은 결함 클래스의 미해결 자리 3곳을 더 찾아 트래커에 등재했다. 코드는 건드리지 않고 두
    plan 문서(`member-dup-remove.md` §A, 이 트래커)에 "발견·기록" 만 했을 뿐, 실제 수정은 하지 않았다.
  - 근거: `plan/in-progress/member-dup-remove.md` 자체가 §A 에서 "이번엔 어떻게 세는가"를 명시적 주제로 삼고,
    직전 두 자매 PR(#1371, #1372)이 "마지막"을 잘못 판단해 재발했던 이력을 밝히며, 형제 PR 5건
    (#1368~#1372) 모두 동일하게 "전수 조사 → 남은 자리는 코드 수정 없이 트래커 등재"하는 패턴을 반복해 왔다.
    `git log`(`9d7e0b588 chore(plan): 멤버 제거 동시 요청 감사 중복 착수 — 전수 조사로 남은 세 자리 등재`)도 이
    변경을 code 변경 커밋과 분리된 별도 chore 커밋으로 두어, 코드 스코프와 뒤섞지 않았음을 보여준다.
  - 판단: 코드 스코프 확장은 전혀 아니며(diff 상 `codebase/` 변경은 3파일로 한정), plan 트래커에 발견 사실을
    적바림하는 것은 이 프로젝트가 반복 채택해 온 관례(형제 5건 전부 동일)와 일치한다. Scope 위반으로 보지 않음.
    다만 다음에 이 트래커를 읽는 사람이 "이 PR 이 3개 자리도 고쳤다"고 오독하지 않도록, 실제로 코드가 손대지
    않았다는 점만 재확인해 둔다(diff 로 확인: `auth-configs.service.ts`·`model-config.service.ts`·
    `webauthn.service.ts` 는 이번 diff 어디에도 등장하지 않음).
  - 제안: 조치 불요(참고용 기록).

- **[INFO]** `workspaces.service.ts` 의 신규 주석 블록이 매우 길다(약 17줄, 코드 본문 9줄보다 큼)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `removeMember()`, 게이트 라인
    805~821 (`// 위 findOne 은 잠그지 않으므로…` ~ `// affected === 0 의 의미가 둘로 늘어나…`)
  - 상세: 새 주석은 (a) 동시성 문제의 재현 근거, (b) 판정 규칙(`affected === 0` 명시 비교) 이유, (c) 이번
    PR 이 owner-TOCTOU 를 의도적으로 남겨 둔 이유까지 함께 담고 있어 코드 대비 주석 비율이 높다.
  - 판단: 같은 파일의 다른 메서드(`deleteWorkspace`, `assertWorkspaceDeletable` 등)도 이미 이와 비슷한 밀도의
    Korean 산문 rationale 주석을 갖고 있고, 형제 PR(#1369~#1372) 4건도 같은 패턴으로 각 fix 지점에 실측·근거를
    남겨 왔다(`plan_impact`·rationale 컨벤션과 일치). 이 저장소의 기존 스타일과 일관되므로 "불필요한 주석
    추가"로 보지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `review/consistency/2026/09/21/12_23_48/**` (SUMMARY.md, meta.json, 5개 checker 산출물,
  `_retry_state.json`) 8개 파일 신규 추가
  - 위치: `review/consistency/2026/09/21/12_23_48/`
  - 상세: 이 파일들은 developer 워크플로가 구현 착수 직전에 의무로 돌리는 `/consistency-check --impl-prep` 의
    표준 산출물이며, `CLAUDE.md` 의 정보 저장 위치 표가 지정한 `review/consistency/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`
    규약을 그대로 따른다. 코드 변경이 아니고, 해당 turn 의 실제 작업(`member-dup-remove`)에 대한 사전 검토
    기록으로 정확히 부합한다.
  - 판단: Scope 이탈 아님 — 오히려 이 위치에 남기지 않는 쪽이 컨벤션 위반이 된다.
  - 제안: 조치 불요.

## 요약

`codebase/` 변경은 정확히 3개 파일(`workspaces.service.ts`, 대응 unit spec, 신규 e2e spec)로, 요청된 작업
("`removeMember()` 동시 DELETE 감사 중복 수정")에 정밀하게 대응한다 — 삭제된 유일한 주석(`remove() 는 in-memory
id 를 지우므로…`)도 그 줄 바로 아래 코드(`remove(member)` 호출)가 이번 PR 에서 `delete()` 호출로 대체되며 더 이상
사실과 맞지 않게 된 것이라 함께 제거된 것으로, 무관한 주석 편집이 아니다. 임포트 추가(`DeleteResult`)·mock 필드
추가(`delete: jest.Mock`)도 모두 변경된 코드 경로가 요구하는 최소 추가다. 포맷팅 전용 변경, 사용하지 않는
임포트, 설정 파일 변경, 기능 확장(over-engineering)은 발견되지 않았다. plan 트래커에 남은 백로그 3건 등재와
consistency-check 8개 산출물은 코드 스코프를 넓히지 않으며, 이 프로젝트가 형제 PR 5건에서 반복해 온 확립된
관례(전수 조사 결과는 트래커에 기록하되 그 자리의 코드는 별도 PR 로 미룬다)와 정확히 일치한다.

## 위험도

NONE
