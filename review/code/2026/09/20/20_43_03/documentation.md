# 문서화(Documentation) 리뷰 — dup-delete-audit (재검토, 20_43_03)

이전 라운드(`review/code/2026/09/20/20_06_26`)의 WARNING 4건(CHANGELOG 누락·`parent` 네이밍 혼동·
로그 억제 가드 테스트 공백·워크스페이스 경로 비대칭)은 `RESOLUTION.md` 가 기록한 대로 커밋
`e175489fe`·`27f488d09`·`64e4e434d`에서 전부 조치됐음을 확인했다. 이번 라운드는 그 조치들이
남긴 새 문서 표면(특히 `LockedParentTriggers.parentPresence` 리네임)이 다른 문서에도 정합하게
반영됐는지를 중심으로 다시 훑었다.

## 발견사항

- **[WARNING]** `plan/in-progress/dup-delete-audit.md` §B 의 설계 스니펫이 리네임 이전 필드명
  `parent` 를 그대로 남겨, 실제 구현(`parentPresence`)과 어긋난다 — 게다가 이 문서 자신이 그
  틀린 이름을 다른 문서에 옮겨 적으라고 지시하고 있다.
  - 위치: `plan/in-progress/dup-delete-audit.md` (§B "처방" 절) — 코드 스니펫
    `{ parent: 'present' | 'absent'; triggerIds: string[] }` 줄, 그리고 같은 절 아래
    "그 설계가 착수될 때 **이 PR 이 바꾼 반환 계약(`{ parent, triggerIds }`)을 전제로**"
    문장. (파일이 이번 diff 에서 신규 생성돼 unified diff 게이트가 원본 줄 번호와 같다 — 코드
    펜스 줄과 "그 설계가 착수될 때" 문장 줄.)
  - 상세: 같은 절 바로 아래(§B "워크스페이스 삭제" 항목의 취소선 정정문)는 이미
    `` `locked.parentPresence === 'absent'` `` 로 **새 필드명**을 정확히 쓰고 있다 — 즉 이 정정문은
    유지보수성 WARNING(#2, 리네임)이 반영된 *이후*에 작성됐는데, 같은 절 위쪽의 원 설계 코드
    스니펫과 트래커 교차 참조 예시 문구는 리네임 *이전* 텍스트 그대로 방치됐다. 실제 코드
    (`trigger-resource-release.ts` `LockedParentTriggers` 인터페이스, `trigger-resource-releaser.service.ts`
    구현, 두 호출부, 세 spec 파일)는 전부 `parentPresence` 로 일치하는 것을 직접 확인했다 —
    stale 한 쪽은 plan 문서뿐이다. 더 심각한 점은, 이 문서 자신의 §"`--impl-prep` 이 요구한 것"
    절이 "트래커의 그 칸에 한 줄 남긴다" 고 스스로 약속했고, 그 약속의 예시 문구가 바로 이 틀린
    `{ parent, triggerIds }` 형태라는 것이다 — 아직 `plan/in-progress/spec-draft-nullable-notation-followups.md`
    라인 4501 에는 반영되지 않았음을 확인했지만(체크리스트가 `- [ ]` 로 남겨둔 대로 예상된 상태),
    누군가 이 plan 문서의 문구를 그대로 복사해 그 트래커에 옮기면 틀린 필드명이 **두 번째 문서로
    전파**된다.
  - 제안: `plan/complete/` 로 이동하기 전에 §B 의 코드 스니펫과 "전제로" 문장의 `parent` 를
    `parentPresence` 로 정정한다(취소선 없이 — 이건 설계 서술이 사후에 코드와 어긋난 것이지,
    plan §자기-반증형 소정정 대상인 "예고가 실측으로 반증된 문장"이 아니다). 트래커
    (`spec-draft-nullable-notation-followups.md` :4501)에 옮길 때도 `{ parentPresence, triggerIds }`
    로 쓸 것.

## 확인함 (참고용 — 이전 WARNING 조치 검증)

- `CHANGELOG.md` `## Unreleased` 항목(원인·고친 것 3개 항목·판별력 실측)이 이 저장소의 "동시 X
  두 건" 커밋 관례(원인→고친 것→실측 3단 구성)를 정확히 따르고, 필드명(`{ parentPresence,
  triggerIds }`)도 최신 코드와 일치한다.
- `LockedParentTriggers` 인터페이스(`trigger-resource-release.ts`)의 JSDoc·필드별 주석이
  `parentPresence`/`triggerIds` 리네임 후 상태로 정확히 갱신돼 있고, 구현부
  (`trigger-resource-releaser.service.ts`)·두 호출부(`workflows.service.ts`,
  `workspaces.service.ts`)·세 spec 파일 전부 같은 이름으로 일치함을 grep 으로 확인했다 —
  코드 표면 자체에는 stale 참조가 없다.
  - 서치 근거: `grep -n "Promise<string\[\]>\|string\[\] | null" codebase/backend/src/modules/{triggers,workflows,workspaces}/*.ts` → 무관한 매치 1건(`findAdminUserIds`)만 나오고 이 헬퍼와 관련된 stale 참조는 없음.
- `workflows.service.ts` `remove()`·`workspaces.service.ts` `deleteWorkspace()` 의 신규 인라인
  주석(404 단락 근거·`.catch` 안 `NotFoundException` 조기 재던짐 근거)을 실제 코드 순서와
  대조했다 — `assertWorkspaceDeletable` 이 메서드 진입부(잠금 없음)와 트랜잭션 안(잠금)에서 두
  번 불린다는 서술, "재검사보다 먼저 `absent` 를 막는다"는 서술 모두 실제 줄 순서와 정확히
  일치한다.
- 신규 테스트(`workflows.service.spec.ts` "remove — 잠금 뒤 부모가 사라졌으면 404…",
  `workspaces.service.spec.ts` "잠금 뒤 워크스페이스가 사라졌으면(동시 삭제) 404…")의 JSDoc/인라인
  주석이 이전 라운드 WARNING(#1, #3)의 정확한 근거(어떤 리뷰가 무엇을 지적했는지)를 인용하고
  있고, 실제로 `Logger.prototype.error` 미호출을 단언해 그 WARNING 이 요구한 회귀 방지를
  충족한다.
- `RESOLUTION.md` 의 조치 항목 표·뮤테이션 실측 절이 실제 커밋(`e175489fe`/`27f488d09`/`64e4e434d`)
  및 `_resolution_state.json` 의 `commits_made` 배열과 SHA·scope 기준으로 일치한다.

## 환경 관측 (문서 결함 아님 — 투명성 고지)

- `review/code/2026/09/20/20_06_26/_resolution_log.md` 가 `git status --short` 에 `??`(untracked)로
  남아 있다 — resolution-applier 가 남긴 조치 저널(각 SUMMARY 항목의 조치 시각·커밋)로 보이며,
  내용은 `RESOLUTION.md` 와 정합하지만 `ee3fb4f75`("RESOLUTION.md + 세션 산출물 커밋") 커밋에는
  포함되지 않은 채 워킹트리에 남아 있다. 애플리케이션 문서가 아니라 harness 내부 부기 파일이라
  차단 사유는 아니지만, 다음 커밋에서 함께 추가하거나 의도적으로 제외한 이유를 남기는 편이
  좋다.

## 이미 알려진, 재차단 불필요한 항목 (참고)

아래는 이전 라운드에서 이미 INFO 로 확인·비차단 처리됐고 이번 라운드에서도 상태 변화가 없다 —
재기재하지 않고 존재만 확인한다: `spec/2-navigation/1-workflow-list.md` §2.6 이 트리거 §4.4 대칭
문구를 아직 갖지 않음(project-planner 후속), plan 이 스스로 약속한 트래커 교차 참조
(`spec-draft-nullable-notation-followups.md` :4501/:4741)가 plan 체크리스트가 예상한 대로 아직
미반영(`- [ ]`).

## 요약

이전 라운드가 지적한 CHANGELOG 누락·로그 억제 가드 테스트 공백은 정확히 조치됐고, 그 조치의
JSDoc·인라인 주석·CHANGELOG 서술은 최신 코드와 라인 단위로 일치한다. 다만 유지보수성 WARNING
(#2, `parent`→`parentPresence` 리네임)을 코드에는 반영하면서 `plan/in-progress/dup-delete-audit.md`
자신의 설계 스니펫과, 그 문서가 다른 트래커에 옮겨 적으라고 예시한 문구는 리네임 이전 상태로
방치됐다 — 아직 실제로 전파되지는 않았지만(대상 트래커 항목은 여전히 미반영), 이 plan 문서를
그대로 근거 삼아 트래커에 옮기면 잘못된 필드명이 두 번째 문서로 퍼진다. `plan/complete/` 이동
전에 정정이 필요하다(WARNING). 그 외 발견된 CRITICAL 은 없다.

## 위험도

LOW
