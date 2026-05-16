# 정식 규약 준수 검토 결과

대상: `plan/in-progress/spec-draft-cafe24-cleanup.md`
검토 모드: spec draft 검토 (--spec)

---

## 발견사항

- **[WARNING]** CHANGELOG 초안이 드롭된 변경 3 을 적용된 것으로 기술
  - target 위치: `## CHANGELOG 추가 (§10)` 블록 (L73-75)
  - 위반 규약: CLAUDE.md §프로젝트 스펙 문서 — "spec 문서는 제품의 최종 상태를 정의한다. history 가 아닌 latest 에 대한 기술"; 단일 진실 원칙
  - 상세: CHANGELOG 초안 텍스트에 "§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3)" 가 포함되어 있다. 그러나 동일 문서 `## 변경 3` 절(L56-69)은 해당 변경을 명시적으로 **드롭**하고 "의도된 컨벤션을 위반하지 않기 위해 변경 3 은 적용하지 않는다"고 결론 내렸다. CHANGELOG 초안이 실제 반영 결정과 불일치하는 상태로 작성되어, 이 내용 그대로 spec 에 기재될 경우 존재하지 않는 변경이 이력으로 굳어진다.
  - 제안: CHANGELOG 초안에서 "§5 Case 번호 연속화 (5.1·5.3·5.8 → 5.1·5.2·5.3). 출처: ... INFO 3·4." 부분을 제거하고, INFO 번호 목록도 "INFO 1·2" 로 수정한다. 변경 3 이 false positive 판정으로 드롭되었다는 사실은 `## 변경 3` 절에 이미 충분히 기록되어 있으므로 CHANGELOG 에 별도 언급이 불필요하다.

- **[INFO]** 작업 항목에 `git mv` 를 사용해 `complete/` 로 이동한다는 명시 없음
  - target 위치: `## 작업 항목` (L83-91)
  - 위반 규약: CLAUDE.md §PLAN 문서 라이프사이클 — "이동 시 `git mv` 사용 — 단순 복사·삭제가 아니라 `git mv` 로 옮겨 history를 보존"
  - 상세: `[ ] 위임 plan + 본 draft plan/complete/ 로 이동` 항목이 있으나, `git mv` 사용 요건이 체크리스트에 명시되어 있지 않다. 관례 지식 없이 실행자가 단순 복사·삭제로 처리할 여지가 있다.
  - 제안: 항목을 `[ ] 위임 plan + 본 draft plan/complete/ 로 git mv 이동` 으로 수정해 의도를 명확히 한다.

- **[INFO]** 신규 §9.9 Rationale 출처 참조가 nested ISO 경로를 사용하고 있음 — 양호
  - target 위치: `신규 §9.9` 블록 내 출처 주석 (L40)
  - 위반 규약: 해당 없음 (준수 확인)
  - 상세: `review/consistency/2026/05/16/09_03_04/` 는 CLAUDE.md 의 nested ISO 형식(`review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)을 정확히 따른다. flat 경로(`review/consistency/<timestamp>/`) 를 사용하지 않은 것이 올바르다.
  - 제안: 변경 불필요.

---

## 요약

대상 문서(`plan/in-progress/spec-draft-cafe24-cleanup.md`)는 plan frontmatter(worktree · started · owner), 파일 위치(`plan/in-progress/` 내 flat 명명), worktree 명칭(`cafe24-fields-spec-update-e7a3f2`) 모두 CLAUDE.md 정식 규약을 준수한다. 금지된 옛 경로(`prd/`, `memory/`, `user_memo/`) 참조도 없다. 단, CHANGELOG 초안 텍스트가 같은 문서 내에서 명시적으로 **드롭 결정된** 변경 3(§5 Case 번호 연속화)을 마치 적용된 것처럼 기술하고 있어, 이 내용이 spec 본문에 그대로 복사될 경우 존재하지 않는 변경 이력이 영구적으로 굳어지는 위험이 있다. CHANGELOG 초안 수정이 spec 반영 전에 필요하다. 그 외 사항은 사소한 형식 제안 수준이다.

---

## 위험도

LOW
