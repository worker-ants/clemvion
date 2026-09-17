# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** CHANGELOG 가 "실측으로 확정한 것"에 실제로는 측정하지 않은 케이스(`workspace` 삭제)를 끼워 넣었다
  - 위치: `CHANGELOG.md` (게이트 24번째 줄, `- 재읽기 뒤 \`workflow\`·\`workspace\` 삭제(FK CASCADE)가 끼어들면 저장은 **시끄럽게 실패**하고 롤백된다`)
  - 상세: 이 항목의 제목 자체가 "이론적 TOCTOU 가 아니었다"— 즉 "추정이 아니라 실제로 쟀다"는 것이 이
    CHANGELOG 전체의 핵심 주장이다. 그런데 "**함께 실측으로 확정한 것**" 절에서 `workflow`·`workspace`
    두 테이블의 CASCADE 삭제를 나란히 "실측"으로 적었지만, 신규 e2e
    `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` 의 `① 재읽기 뒤 workflow 삭제`
    섹션은 **`workflow` 행만** `DELETE FROM workflow WHERE id = $1` 로 지운다. `workspace` 를 지우는
    쿼리는 이 파일에도, 저장소의 다른 e2e 스펙에도 없다(`grep -rl "DELETE FROM workspace" test/*.ts`
    0건). `plan/in-progress/trigger-save-partial-patch.md` 의 실측 표(① 행)도 `workflow` 만 적어
    두었고 `workspace` 는 언급하지 않는다 — 즉 plan 은 정확한데 CHANGELOG 만 범위를 넓혔다.
    `trigger.entity.ts` 를 보면 `workspaceId` 도 `@ManyToOne(() => Workspace, { onDelete: 'CASCADE' })`
    라 **같은 메커니즘일 가능성은 높다**(대칭적 추정으로는 타당하다) — 하지만 이 프로젝트가 반복
    지적해 온 "실측했다"는 말이 실제로는 측정 안 한 대칭적 추정을 가리키는 패턴 그대로다. 코드
    동작 자체에는 영향이 없고 심각한 결함도 아니지만, 이 CHANGELOG 항목이 "이론이 아니라 쟀다"를
    신뢰의 근거로 내세우는 문서이기 때문에 그 신뢰를 갉아먹는 자리다.
  - 제안: 둘 중 하나. (a) `workspace` 삭제 케이스를 실제로 e2e 에 추가해 측정한 뒤 그대로 두거나,
    (b) 문장에서 "`workspace`"를 빼고 "`workflow` 삭제(FK CASCADE, `workspace` 삭제도 같은
    `onDelete: 'CASCADE'` 구조라 동일할 것으로 추정하나 별도 실측은 하지 않았다)"처럼 추정과 실측을
    구분해 적는다.

- **[INFO]** 1라운드 documentation 리뷰(`review/code/2026/09/17/13_44_39/documentation.md`)가 지적한
  두 건(주석 stale·뮤턴트 재측정 미기록)은 이번 라운드에서 정확히 고쳐졌다 — 회귀 없음
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:658`(머리말 정정),
    `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts:62`~`69`
    (53→60 재측정 기록)
  - 상세: `git show 6d845d8a2`(1라운드 처분 커밋)로 직접 대조했다. 658번 줄 머리말은 "재읽은 행을
    저장 대상으로 쓴다"에서 "재읽은 행이 저장의 **기준**이다 — 저장 대상 자체는 아래에서 부분
    객체로 좁힌다"로 바뀌어 아래 679~717번 줄의 실제 코드(`const patch = {...defined, config:
    mergedConfig}; const written = await m.save(Trigger, { id: target.id, ...patch }); Object.assign(target,
    patch);`)와 더 이상 모순되지 않는다. mock JSDoc 은 "53"을 "2026-09-17 재측정, 321건 중 60"으로
    갱신했고 "시점 의존" 각주도 이번 재측정 이력을 반영해 갱신했다. 조치 불요.

## 요약

핵심 코드 변경(`TriggersService.update()` 의 저장 대상을 통째 엔티티에서 부분 객체로 좁힌 lost-update
수정)에 딸린 문서화는 전반적으로 촘촘하고 정확하다 — CHANGELOG·서비스 코드 인라인 주석·plan·신규
e2e 특성 테스트 docstring 이 근본 원인·재현 절차·PR 안에서 낸 자체 회귀까지 서로 정합하게 서술하며,
1라운드 리뷰가 잡은 낡은 주석과 미재측정 뮤턴트 카운트 두 건도 이번 라운드에서 실제로 고쳐졌다(직접
`git show` 로 대조 확인). 다만 CHANGELOG 의 "함께 실측으로 확정한 것" 절이 `workflow` 삭제만 실제로
테스트한 것을 `workflow`·`workspace` 둘 다 측정한 것처럼 적어, 이 문서 전체가 강조하는 "이론이 아니라
쟀다"는 신뢰 기준에 스스로 못 미치는 자리가 하나 남아 있다. 기능적 영향은 없다.

## 위험도

LOW
