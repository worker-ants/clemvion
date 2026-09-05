# Plan 정합성 검토 — §5.4 스윕 4라운드 (create/update 대칭 복구 + 미검증 분기 4건)

검토 대상: HEAD 최신 커밋 `67881bbd4`(fix(backend): `create()` 를 고치고 자매 `update()` 를
두었다 — 대칭 복구 + 미검증 분기 4건). target 문서 `spec/5-system/` 자체의 델타는 0(정상 —
코드 전용 PR)이므로, 이 diff 가 `plan/in-progress/**` 의 진행 중 결정·후속 항목과 정합한지를
중심으로 검토했다. 이 커밋은 직전 라운드(`review/consistency/2026/09/05/20_45_39`)의
WARNING 1건·INFO 7건에 대한 응답 커밋이라 그 RESOLUTION.md 를 1차 대조 기준으로 삼고,
`plan/in-progress/spec-draft-nullable-notation-followups.md`(이 diff 가 직접 수정하는 SoT
트래커)와 자매 문서 `spec-draft-api-convention-verifier-registration.md` 를 교차 확인했다.

## 발견사항

없음.

이전 3라운드(`18_23_03`→`19_08_19`→`20_45_39`)가 순차로 지적한 WARNING 은 이번 커밋 시점
기준 전부 해소가 확인된다:

- `18_23_03` WARNING(하단 `## 종결 조건` 표의 stale 수치) — 현재 표는 구체 수치를 빼고
  "본문 「스윕 1차」 참조"로만 가리키는 상태로 유지되고 있다(재발 없음, 라인 ~730 부근).
- `19_08_19` WARNING(`cb17f0870` 의 §5.4 금지 조합 자기반박·정정·78건 래칫이 plan 에
  미반영) — "스윕 1차의 자기 반박" 절로 이미 반영되어 있다(라인 ~397~427).
- `20_45_39` WARNING(§5.4 래칫 canary fixture 가 어느 spec `code:` glob 에도 안 걸림) —
  이번 커밋이 정확히 `RESOLUTION.md` 가 명시한 처리("plan 에 planner 후속으로 등재")대로
  `spec-draft-nullable-notation-followups.md` 에 새 체크박스("§5.4 래칫 canary fixture 를
  `code:` 에 등재", planner 소유, `20_45_39` W1 인용)를 신설했다(라인 742-756). 등재 대상
  glob(`repo-guards/__tests__/fixtures/**`)도 `review_guard._glob_to_regex` 의 `**` 가 `/`
  를 넘는다는 실측과 일치해 기술적으로 유효하다.
- `20_45_39` INFO#5(메모이제이션 서술이 "미착수"/"완료" 로 갈려 읽힘) — 같은 커밋이 해당
  단락을 "메모이제이션은 스윕 1차에서 끝났다(2026-09-05 정정)" 으로 고쳐 자기모순을
  해소했다(라인 273-279). 부수로 "여전히 2곳이 아니다" 를 덧붙여, 헬퍼 추출을 스윕 완료
  시점까지 유예한다는 기존 결정(라인 266 체크박스, `- [ ]` 미완 유지)과도 충돌 없이
  정합한다.

이번 커밋 자체가 새로 도입한 내용(스케줄 `update()` 트리거 키 대칭 복구, 메모이제이션
실패축출·`allowMissing` 중첩 경로·`isActive` 2축 테스트 보강, `appUrl` CHANGELOG 선언 형태
정정, `POST` 응답 `trigger` 3키/`GET` 4키 구분)은 모두 같은 커밋 안에서 자기완결적으로
문서화됐고(커밋 메시지 + CHANGELOG + 코드 주석), `plan/in-progress/**` 의 다른 미해결
결정(예: `User` 엔티티 컬럼 수준 방어, `CanvasSaveResultDto`, `IntegrationDto.
consecutiveNetworkFailures`, `6-websocket-protocol.md` 도입 산문, Flyway `mixed=true`)과
직접 상호작용하는 지점이 없다 — 스케줄/트리거 컨트롤러·서비스·DTO·e2e 파일만 건드렸고 그
범위는 전부 이번 트래커가 이미 소유·추적 중인 "§5.4 drift 배치" 워크스트림 안에 있다.

## 요약

이 4라운드 진행 상황은 건강하다. 이전 세 라운드가 지적한 plan-vs-diff 불일치(stale 종결
조건 표 수치·미반영 정정·미등재 canary fixture·자기모순 서술)가 이번 커밋에서 정확히 그
라운드의 RESOLUTION 이 예고한 방식대로 순차 해소됐다 — 코드로 고칠 것은 코드로, `spec/`
쓰기가 필요한 것(fixture 등재)은 planner 트랙 체크박스로 정확히 위임했다. 미해결 결정과
충돌하는 일방적 판단이나, target 이 가정하는 미해소 선행 조건, 반영되지 않은 후속 항목은
발견되지 않았다. `spec-draft-api-convention-verifier-registration.md`(다른 worktree 소유,
`status: in-progress`)와의 동시 작업 여부는 본 검토 범위(동시 작업 충돌은 병렬 세션/머지
조율의 책임) 밖이라 판정하지 않았다.

## 위험도

NONE
