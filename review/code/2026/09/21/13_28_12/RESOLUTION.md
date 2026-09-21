# RESOLUTION — 13_28_12 (라운드 2)

> 사후 작성. 이 라운드는 조치가 **커밋 `6f1113a70` 하나**로 끝나 RESOLUTION 을 남기지 않았는데,
> 라운드 3(`13_53_04`) INFO 10 이 «이 세션의 다른 라운드와 형식이 다르다» 고 지적해 채운다.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| WARNING 1 (concurrency/database, owner 승격 TOCTOU) | 등재 | — (무수정) | 이번 PR 이 만든 결함이 아니고, 실측 재현(`status=200`, `rows_remaining=0`)·재현 레시피·후보 처방과 함께 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재돼 있다. 유예 사유는 비용이 아니라 **`affected === 0` 판별자 오염** — 이 PR 이 세우는 것이 바로 그 판별자다. |
| WARNING 2 (security/requirement, 권한 검사 순서 오라클) | 등재 | `942d14b61` | 라운드 1 에서 발견돼 이미 등재·커밋됨. 올바른 처방이 «`assertAdmin` 을 맨 앞으로» 가 아니라(자가 탈퇴는 비-admin 경로이고, 비-admin 이 owner 를 지목했을 때 코드가 `CANNOT_REMOVE_OWNER` → `ADMIN_REQUIRED` 로 바뀐다) 에러 코드 계약 변경이라 별 PR 이 필요하다. |
| WARNING 3 (documentation, 트래커 문구 stale) | 코드(plan) | `6f1113a70` | 내가 등재한 e2e frontmatter 항목이 «다섯» 과 `*-delete-concurrency` 글롭으로 적혀 있어, **등재한 그 PR 이** 여섯 번째 파일을 `-remove-` 라는 다른 이름으로 추가하며 착지 즉시 stale 이 됐다. 집행 시 재열거하도록 고쳤다 — 개수도 글롭도 고정하지 않는다. |
| WARNING 4 (api_contract, 204 vs 200) | 등재 | `6f1113a70` | `workspaces.controller.ts` 만 삭제 성공에 `200 {ok:true}` 를 써 `api-convention.md §6` 와 어긋난다. **실측**: 형제 넷은 `HttpCode(204)` 각 1개, workspaces 는 0개·`ok: true` 5곳. diff 밖(컨트롤러 미변경)이라 planner 항목으로 등재했다. |
| INFO 8 (documentation, 내가 쓴 거짓 서술) | 코드 | `6f1113a70` | e2e JSDoc·plan 의 «형제 다섯은 전부 204» 가 **틀렸다**. 성공 코드는 라우트별이 아니라 **컨트롤러별**로 갈리며, 같은 클래스의 `workspace-delete-concurrency.e2e-spec.ts`(#1369)가 이미 `[200, 404]` 를 단언하고 있었다 — 반증 자료를 갖고 있으면서 틀리게 적은 것이다. 원문은 취소선으로 남기고 실측을 함께 실었다. |
| INFO 7 (maintainability, e2e 오케스트레이션 중복) | 유예 | — | 헬퍼 추출은 이 결함 클래스의 e2e **여섯 파일**에 걸친 사안이다. 한 파일만 손대면 형제 다섯과 비대칭이 된다. 라운드 3 이 «반복 3회부터 정당화» 로 같은 판단을 재확인했다. |
| SPEC-DRIFT 1 (`§3` DELETE 멱등성) | 등재 | — (무수정) | 코드가 옳고 spec 각주가 낡았다. planner 소유·등재 완료. |

## TEST 결과

- lint  : 통과
- unit  : 통과
- build : 통과 (타입체크 ratchet 포함)
- e2e   : 통과 (374/374)

## 보류·후속 항목

이 라운드에서 새로 보류한 것은 없다. 위 표의 «등재» 행은 전부 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 실재 항목을 가리킨다(무수정 사유는 각 행에 적었다).
