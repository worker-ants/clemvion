# 문서화(Documentation) 리뷰 — member-owner-toctou (3라운드, `09_10_41`)

## 배경 확인

이 diff 는 1라운드(`08_09_57`, Critical 0·Warning 6, 전부 조치)와 2라운드(`08_46_47`,
Critical 0·Warning 2, 1건 조치·1건 스코프 밖)를 모두 거친 뒤의 상태다. 2라운드 documentation
리뷰(`08_46_47/documentation.md`)는 CHANGELOG 신규 항목·전방 참조 정정·JSDoc 일치 여부를
검증하고 "발견사항 없음"으로 닫았다. 이번 라운드는 그 이후 커밋(`44d5dc429` RESOLUTION 문서화,
`24f7a1ddf` 중복 단위 테스트 제거)과, **2라운드가 검증하지 않고 넘어간 CHANGELOG 신규 항목의
개별 문장**을 다시 대조했다.

## 발견사항

- **[WARNING]** `CHANGELOG.md` 새 항목의 "남는 것" 서술이 **어느 문서가 정정됐는지를 잘못
  기술**한다 — 트래커가 좁게 적혀 있었다고 말하지만, 실제로는 트래커가 아니라 developer 자신의
  plan 문서가 좁았고 트래커는 손대지 않았다.
  - 위치: `CHANGELOG.md:32` (`그 블라스트 반경이 트래커에 실제보다 좁게 적혀 있던 것을 이 PR
    이 정정했다 —`)
  - 상세: 이 문장은 "권한 검사 순서 오라클의 블라스트 반경이 **트래커에** 실제보다 좁게
    적혀 있었고 이 PR 이 그것을 고쳤다"고 읽힌다. 그런데 같은 PR 이 만든 두 문서가 정반대로
    말한다.
    - `review/code/2026/09/24/08_09_57/RESOLUTION.md:10` (조치 #2): *"지적 대상 문서가
      틀렸다. 트래커 항목은 이미 '요청자가 그 워크스페이스 멤버가 아니어도' 로 정확하고
      13/17 라우트 분석까지 담고 있다 — **좁게 적힌 것은 내가 이번 턴에 쓴
      `plan/in-progress/member-owner-toctou.md` §F 였고 그쪽을 고쳤다**."*
    - `plan/in-progress/member-owner-toctou.md:163`: *"(**트래커는 고칠 것이 없다** — 확인하고
      손대지 않았다.)"*, 같은 파일 `:183`: *"W2 는 지적 대상 문서가 틀렸다 — **좁게 적힌 것은
      트래커가 아니라 이 plan §F 였다**."*
    - 실측으로 직접 대조해도 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md:4871-4906`)
      항목은 이미 "요청자가 그 워크스페이스 멤버가 아니어도" · "17개 중 13개" 로 넓게, 정확하게
      적혀 있고 이번 diff 에서 그 파일의 해당 항목은 변경되지 않았다(`git diff` 대상 아님).
    - 즉 CHANGELOG 문장의 "트래커에 좁게 적혀 있던 것" 은 사실이 아니다 — 좁았던 것은 이
      PR 이 스스로 이번 턴에 쓴 plan 문서였고, 트래커는 원래부터 옳았다. CHANGELOG 는
      영구 이력으로 남는 문서이고 이 저장소는 "전방 참조 취소선 + 해소 각주" 관례를 CHANGELOG
      자체에서 반복 지켜 왔는데(`:224-227` 의 `#1373` backfill 각주가 같은 파일 안의 선례),
      이번엔 반대로 **정확했던 문서(트래커)를 부정확했던 것처럼** 새로 기술해 버렸다. 다음
      사람이 이 CHANGELOG 문장만 보고 트래커 항목을 의심하거나 재확인하러 갈 근거가 된다.
    - 2라운드 documentation 리뷰(`08_46_47/documentation.md:17-30`)는 CHANGELOG 항목의
      "구조"(신규 항목 + 취소선 + 해소 각주)만 검증했고, 이 개별 문장의 사실관계는 대조하지
      않아 이번까지 통과했다.
  - 제안: `CHANGELOG.md:32` 를 "트래커에 좁게 적혀 있던 것"이 아니라 "**이 plan 문서(§F)에
    좁게 적혀 있던 것**"으로 정정한다 — 트래커는 원래부터 정확했고 이번 PR 이 건드리지
    않았다는 사실을 반영해야 한다. 예: "그 블라스트 반경을 좁게 적었던 것은 이 plan 문서
    자신이었다(트래커 항목은 처음부터 정확했다) — 이 PR 이 plan 쪽을 정정했다."

## 확인된 양호 사항 (참고)

- `24f7a1ddf` 의 단위 테스트 중복 제거는 남긴 블록 JSDoc 에 "왜 중복이 생겼는지"(정정 하나가
  곧바로 다음 중복을 만든 경위)와 "그 블록이 맡는 역할 둘"을 정확히 적었다 —
  `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` 의 `진 쪽은 404` 블록
  JSDoc 이 실제로 지워진 블록(`DELETE 시점에 행이 사라졌으면 404 다`)의 존재·삭제 이유까지
  서술해 다음 사람이 git blame 없이도 경위를 재구성할 수 있다.
- `plan/in-progress/member-owner-toctou.md` §F 의 자기 정정("노출 대상은 «비-admin 멤버» 가
  아니라 **임의 인증 사용자**다")과 `data-flow/12-workspace.md:141,188,189` 인용은 실제
  파일과 대조한 결과 정확하다.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이번 턴 등재된 planner
  항목 3건(owner 보호 메커니즘 spec 명문화 · 에러 코드 3종 카탈로그 누락 · RBAC 표 GFM
  분절)을 각각 `spec/data-flow/12-workspace.md`, `spec/5-system/3-error-handling.md`,
  `spec/5-system/1-auth.md` 실물과 대조 확인했고 모두 정확하다(`CANNOT_ASSIGN_OWNER` 만
  등재돼 있고 `CANNOT_REMOVE_OWNER`/`OWNER_ROLE_PROTECTED`/`SOLE_OWNER_CANNOT_LEAVE` 는
  미등재, §3.2 표는 실제로 각주 때문에 366~391행 사이에서 렌더가 끊긴다).
- `test/helpers/concurrency.ts` 의 `VACUITY_GUARD_MS` export 사유 JSDoc(`raceUnderHeldLock`
  이 "요청 하나 + 락 안 mutate" 형태를 못 덮는다)은 실제 함수 시그니처(`fires` 2개 이상의
  thunk 배열만 받고 락 안 mutate 콜백이 없음)와 일치한다.
- README/설정 문서: 신규 환경변수·엔드포인트·설정 옵션 없음 — 갱신 대상 아님(재확인).
- API 문서: 응답 코드·엔드포인트 시그니처 변경 없음 — 갱신 불요(재확인).

## 요약

이번 라운드에서 실제로 새로 바뀐 코드(`workspaces.service.spec.ts` 중복 테스트 제거)의 문서화는
양호하다 — 경위·역할을 JSDoc 에 명확히 남겼다. 다만 직전 라운드(1·2)를 거치며 CHANGELOG 에
새로 쓰인 "남는 것" 문장 하나가, 같은 PR 이 만든 RESOLUTION.md·plan §F 와 정반대의 사실
(어느 문서가 좁게 적혀 있었는지)을 기술하고 있다 — 트래커는 원래 정확했고 손대지 않았는데
CHANGELOG 는 트래커가 좁았다가 이 PR 이 고쳤다고 적는다. 두 라운드의 documentation 리뷰가
CHANGELOG 항목의 "구조"만 보고 이 개별 문장의 사실관계를 대조하지 않아 지금까지 남아 있었다.
그 외에는 JSDoc·인라인 주석·plan/트래커 인용이 실제 파일과 정확히 일치함을 직접 대조로
확인했고, README/API/설정 문서 갱신 대상도 없다.

## 위험도

LOW
