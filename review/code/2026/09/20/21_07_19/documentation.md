# 문서화(Documentation) 리뷰 — dup-delete-audit (3라운드, 21_07_19)

이전 두 라운드(`20_06_26`, `20_43_03`)의 documentation WARNING 은 모두 조치됐다고 `RESOLUTION.md` 들이
기록하고 있다. 이번 라운드는 그 "조치 완료" 선언이 실제로 맞는지, 그리고 이번 diff 에 새로 추가된
`workspace-delete-concurrency.e2e-spec.ts` 이후 `CHANGELOG.md` 서술이 여전히 최신 상태인지를
직접 `Read`/`grep` 으로 재검증하는 데 집중했다.

## 발견사항

- **[WARNING]** `plan/in-progress/dup-delete-audit.md` 가 2라운드 WARNING(`parent`→`parentPresence`
  리네임 stale 참조)에서 지적된 **두 자리 중 한 자리만** 고쳐졌다 — 나머지 한 자리는 여전히 옛 필드명
  `{ parent, triggerIds }` 를 쓴다.
  - 위치: `plan/in-progress/dup-delete-audit.md:69` (`### \`--impl-prep\` 이 요구한 것` 절, "(W2)" 항목 —
    "그 설계가 착수될 때 **이 PR 이 바꾼 반환 계약(`{ parent, triggerIds }`)을 전제로**" 문장).
  - 상세: 2라운드 documentation 리뷰(`review/code/2026/09/20/20_43_03/documentation.md` WARNING)는
    이 문서에서 옛 필드명이 남은 자리를 **정확히 두 곳**으로 지목했다 — (1) §B 의 설계 코드 스니펫,
    (2) 바로 이 W2 문장("그 설계가 착수될 때 … 전제로"). 후속 커밋 `c3607d907`
    (`git show c3607d907 -- plan/in-progress/dup-delete-audit.md`로 직접 확인)은 (1)만 `parentPresence`
    로 고치고 인용구까지 덧붙였지만, (2)는 손대지 않은 채로 남았다. 같은 커밋의
    `review/code/2026/09/20/20_43_03/RESOLUTION.md`(SUMMARY#2 행: "스니펫을 `parentPresence` 로 고치고
    … 한 줄로 남겼다")도 "스니펫" 만 언급해 이 문서 자체가 부분 조치를 완전 조치처럼 기록하고 있다.
    이 W2 문장은 하필 "다음 사람이 이 문구를 트래커(`spec-draft-nullable-notation-followups.md:4501`)로
    옮겨 적을 때" 를 겨냥한 경고문 바로 그 문장이라, 2라운드가 우려한 "틀린 필드명이 두 번째 문서로
    퍼진다" 는 위험이 **아직 그대로 열려 있다** — 실측: `spec-draft-nullable-notation-followups.md:4501`
    은 여전히 이 PR 의 반환 계약을 반영하지 않은 상태(plan 체크리스트가 예상한 대로 미착수)이므로 아직
    실제 전파는 없었지만, 트래커 반영이 이 plan 문서를 그대로 베끼면 옛 이름이 옮겨 붙는다.
  - 제안: `plan/complete/` 로 이동하기 전에 69번째 줄의 `{ parent, triggerIds }` 도
    `{ parentPresence, triggerIds }` 로 정정한다. 트래커(`:4501`)에 옮겨 적을 때도 새 이름으로 쓸 것.

- **[WARNING]** `CHANGELOG.md` 의 "판별력 실측" 절이 워크스페이스 경로에 대해 **단위 뮤테이션 검증만**
  서술하고, 그 검증 방식이 구조적으로 불충분하다고 이 저장소 스스로 결론 낸 뒤 추가한 **e2e 실측**
  (`workspace-delete-concurrency.e2e-spec.ts`)은 언급하지 않는다.
  - 위치: `CHANGELOG.md:25-31`(`## Unreleased — 동시 DELETE 두 건이 …` 항목의 "**판별력 실측**" 문단,
    특히 27-28번째 줄 "워크스페이스 경로는 뮤테이션으로 확인했다 …").
  - 상세: 이 문단은 커밋 `64e4e434d`(20:33, 1라운드 조치)가 작성했고 그 시점엔 워크스페이스 경로
    검증이 실제로 단위 mock 뿐이었다. 그런데 2라운드 리뷰(`review/code/2026/09/20/20_43_03/RESOLUTION.md`
    WARNING 1)가 "단위 mock 은 `parentPresence: 'absent'` 를 직접 주입하므로 «이긴 쪽이 멤버 행까지
    지운다» 는 현실을 재현하지 못한다" 고 지적했고, 실제로 그 e2e 를 실 DB 에 붙이자 "리뷰어가 읽기로
    지적한 403 이 값으로 재현됐다"(`RESOLUTION.md` "이 한 건이 2라운드에서 가장 값졌다" 문단) — 즉
    프로젝트 자신이 "단위 뮤테이션만으로는 이 결함군을 구조적으로 볼 수 없다" 는 것을 실측으로
    확인한 셈이다. 이후 커밋 `c3607d907` 이 그 e2e 를 추가했지만 `CHANGELOG.md` 는 갱신되지 않아,
    지금 CHANGELOG 만 읽는 다음 사람은 "워크스페이스 경로는 (구조적으로 불충분하다고 판명 난) 단위
    뮤테이션으로만 검증됐다" 는 낡은 인상을 받는다 — 이 저장소가 지켜온 "원인·고친 것·판별력 실측"
    3단 관례의 세 번째 단이 실제로 가장 신뢰도 높은 증거(실 DB 403→404 재현)를 빠뜨린 채 약한
    증거만 남긴 상태다.
  - 제안: `CHANGELOG.md` 의 워크스페이스 판별력 실측 문장에 "이후 실 DB e2e(`workspace-delete-concurrency
    .e2e-spec.ts`)로 재검증 — 404 단락을 지운 뮤턴트에서 기대 404 자리에 실제로 403 이 재현됨을
    확인했다" 를 추가한다. 코드 결함은 아니므로 병합을 막을 사유는 아니다.

## 확인함 (참고용 — 이전 WARNING 조치 검증)

- 1라운드 WARNING(CHANGELOG 누락)은 조치됨 — `CHANGELOG.md` 에 원인·고친 것·판별력 실측 3단 항목이
  실제로 추가돼 있다(위 두 번째 WARNING 은 그 문단이 **불완전**하다는 것이지 **없다**는 것이 아니다).
- 1라운드 WARNING(`Logger.error` 미호출 단언 누락)은 조치됨 — `workflows.service.spec.ts`(신규 테스트
  "remove — 잠금 뒤 부모가 사라졌으면…")와 `workspaces.service.spec.ts`(신규 테스트 "잠금 뒤
  워크스페이스가 사라졌으면…") 둘 다 `Logger.prototype.error` spy 로 미호출을 단언한다.
- 코드 표면(`trigger-resource-release.ts`, `trigger-resource-releaser.service.ts`, 두 호출부, 세
  spec 파일)에는 옛 필드명 `parent:`/`{ parent, triggerIds }` 잔존이 **없음**을 직접
  `grep -rn "{ *parent *,\|{ parent:\|parent: 'present'\|parent: 'absent'" codebase/backend/src/modules/{triggers,workflows,workspaces}`
  로 재확인했다 — stale 참조는 plan 문서에만 남아 있다.
- 신규 인라인 주석·JSDoc(`LockedParentTriggers`, `lockParentAndListTriggerIds` 구현부, 두 서비스의
  `absent` 분기·`.catch` 가드)은 실제 코드 순서·조건과 라인 단위로 일치한다.

## 요약

이전 라운드들이 남긴 WARNING(4개)은 대부분 실제로 조치됐지만, 재검증 결과 두 가지가 "완전 조치"로
잘못 기록돼 있었다. 첫째, `plan/in-progress/dup-delete-audit.md` 의 옛 필드명 stale 참조는 2라운드가
지목한 두 자리 중 한 자리(트래커 교차 참조를 약속한 바로 그 문장)가 아직 고쳐지지 않았다 — 아직 실제
전파는 없었으나 위험은 열려 있다. 둘째, `CHANGELOG.md` 의 판별력 실측 문단이 워크스페이스 경로에 대해
프로젝트 스스로 "구조적으로 불충분" 하다고 판명한 단위 뮤테이션 증거만 남긴 채, 그 뒤에 확보한 더 강한
실 DB e2e 증거(403→404 재현)를 반영하지 않았다. 둘 다 코드 결함이 아니고 병합을 막을 사유는 아니지만,
`plan/complete/` 이동 전에 정정이 필요하다. 그 외 코드·테스트의 독스트링·인라인 주석·CHANGELOG 관례
준수는 양호하다.

## 위험도

LOW
