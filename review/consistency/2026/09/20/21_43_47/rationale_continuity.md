# Rationale 연속성 검토 — spec/2-navigation (--impl-prep)

## 발견사항

### [INFO] §4.4 «동시 삭제 → 404» 가 여전히 미검증 사실처럼 서술됨 — 직전 PR 의 impl-done WARNING 이 spec 에 반영되지 않음

- target 위치: `spec/2-navigation/2-trigger-list.md` §4.4 결과·에러 — "동시 삭제: 두 클라이언트가 동시에
  같은 트리거를 삭제하면 두 번째는 `404 RESOURCE_NOT_FOUND`..."
- 과거 결정 출처: `plan/complete/dup-delete-audit.md` 체크리스트 — `/consistency-check --impl-done` 실행
  결과(`review/consistency/2026/09/20/21_21_21`, BLOCK: NO)가 이미 "`2-trigger-list.md` §4.4 의 «두
  번째는 404» 는 구현 검증 대기다" 를 Warning 으로 지적했고, 그 처분은 "트래커 planner 항목에 반영" 이었다.
- 상세: 같은 문서 §3(`GET /api/workflows` sort/order — `1-workflow-list.md`) · §2.1("미구현
  (Planned)")처럼, 이 spec 영역은 "코드가 아직 못 미친 서술" 에 `⚠️` 캐버트를 붙이는 관례를 여러 곳에서
  쓴다. 그런데 §4.4 의 이 문장만은 실제로는 `TriggersService.remove()` 가 advisory lock 뒤에 행 존재를
  재확인하지 않아 `[204, 204]` 로 동작하는 상태(현재 `plan/in-progress/trigger-dup-delete.md` 가 이를
  결함으로 등재·재현 예정)인데도, 캐버트 없이 확정 사실처럼 적혀 있다. 이 자체는 새로운 위반이 아니라
  이미 한 번 지적되고 "developer 권한 밖(spec 수정)" 으로 유예된 사안이 그대로 남아 있는 것이다.
- 제안: 진행 중인 `plan/in-progress/trigger-dup-delete.md` 가 이 PR 에서 그 문장을 실측대로 만드는 것을
  목표로 하므로(§B·§C, 체크리스트의 `--impl-done` 항목), 정상적으로 완결되면 이 gap 은 자연 해소된다.
  다만 그 PR 이 어떤 이유로든 중단·지연되면 spec 은 여전히 미검증 주장을 사실처럼 유지하게 되므로,
  트래커(`spec-draft-nullable-notation-followups.md`)의 planner 항목에 "이 PR 완료 여부와 무관하게
  §4.4 문구의 검증 상태를 재확인" 을 남겨 두는 편이 안전하다. 이미 developer 의 plan 이 "이 PR 이 §4.4 를
  사실로 만들면 그 caveat 자체가 불필요해진다" 고 스스로 적어 두었으므로 별도 조치를 강제하지 않는다.

## 정합성 확인 — 위반 없음으로 판정한 근거

`plan/in-progress/trigger-dup-delete.md` 가 구현하려는 방향(advisory lock 안에서 행 재조회 → 없으면
404, 있으면 delete)은 target 문서 자신의 기존 Rationale·본문 註와 다음과 같이 **정합**하며, 기각된
대안의 재도입이나 무근거 번복은 발견되지 않았다.

1. **§3 "동시 쓰기 직렬화" 註의 기존 원칙과 정확히 같은 형태다.** `2-trigger-list.md` §3 은 이미
   "락 안에서도 행 부재를 판정한다: 재읽기가 비면 쓰지 않고, 병합 쓰기가 0행에 매치되면 쓰지 못한
   것으로 취급한다(`rotate-bot-token`·`interaction/revoke-token` 은 이때 404)" 를 확정 원칙으로 적어
   두었다. 이번 plan 의 처방(§B — "락 뒤에 재조회, 없으면 404")은 이 원칙을 삭제 경로에도 적용하는
   것이며, 새 정책을 도입하는 것이 아니다.
2. **§4.4 자체가 이미 이 목표 상태(`[204, 404]`)를 사실로 서술**하고 있어, 구현이 spec 을 새로 바꾸지
   않는다 (`spec_impact: none` 과 일치).
3. **외부 자원 해제를 락 안으로 옮기지 않는 선택**은 `trigger-config-lock.ts` JSDoc 의 금지와 §3 註
   "외부 provider 호출은 락 밖이다 — 락 안은 재읽기와 쓰기뿐이다" 를 그대로 지킨다 — 위반을 피하려고
   설계를 좁힌 것이지 그 원칙을 우회하지 않는다.
4. **직접 선례가 이미 존재한다.** `plan/complete/dup-delete-audit.md` (workflow·workspace 삭제
   동시성 감사 중복 수정)가 "선례 — 트리거는 이미 «두 번째 요청은 404» 다" 를 근거로 워크플로/워크스페이스
   쪽을 트리거 spec 의 기존 서술에 맞춘 바 있다. 이번 plan 은 그 선례가 실은 트리거 자신에는 아직
   적용되지 않았음을 발견해 같은 형태로 마저 닫는 것이다 — 결정의 번복이 아니라 동일 결정의 완결이다.
5. **감사 로그 Rationale(`spec/data-flow/1-audit.md`)과도 충돌 없음.** "감사 기록은 부수 기록이며
   실패(삼감)해도 주 동작을 막지 않는다" 는 원칙과 "audit 불변 원칙상 레거시 row 는 그대로 둔다" 는
   원칙 모두, "실제로 삭제가 일어나지 않은 두 번째 요청은 애초에 감사 행을 만들지 않는다" 는 이번
   plan 의 처방과 배치되지 않는다 — 오히려 그 원칙이 요구하는 "실제 발생한 사건만 기록한다" 를
   지금 어긴 결함(중복 audit row)을 고치는 방향이다.
6. **spec/2-navigation 번들 내부 자체 정합.** `2-trigger-list.md` 의 R-1~R-17 은 각각 폐기된 결정에
   취소선 + 대체 조항 링크(R-2 → R-14)를 남기거나 "폐기가 아니라 최초 확정" 임을 명시(`1-workflow-list.md`
   Rationale §4 태그 필터)하는 등 이 저장소의 continuity 관례를 일관되게 따른다. 이번 검토에서 새로
   기각된 대안을 이유 설명 없이 되살리는 자리는 찾지 못했다.

## 요약

target(`spec/2-navigation`, 특히 `2-trigger-list.md`)은 진행 중인 트리거 동시 DELETE 감사 중복 수정
작업과 관련해 자기 자신의 Rationale·본문 註(§3 "동시 쓰기 직렬화"의 "재읽기 후 0행 판정" 원칙, §4.4
"동시 삭제 → 404")를 위반하지 않으며, 오히려 그 원칙을 그대로 확장 적용하는 방향이다. 자매 PR
(`plan/complete/dup-delete-audit.md`)이 이미 세운 "트리거 spec 의 기존 서술에 다른 삭제 경로를
맞춘다" 는 선례와도 일치해 결정의 무근거 번복이나 기각된 대안의 재도입은 발견되지 않았다. 유일한
관찰 사항은 §4.4 문구가 직전 impl-done 게이트에서 "구현 검증 대기" 로 지적된 뒤에도 캐버트 없이 남아
있다는 점인데, 이는 이번 진행 중인 PR 이 정상 완료되면 자연히 해소되도록 이미 계획돼 있어 INFO 수준
이상으로 올리지 않는다.

## 위험도

NONE
