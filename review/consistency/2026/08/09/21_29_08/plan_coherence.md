# Plan 정합성 검토 — spec-draft-secret-store-verification-footnote.md

## 발견사항

- **[INFO]** 자매 plan `spec-draft-auth-invariants-sync.md` 가 이미 머지됐는데 `in-progress/` 에 남아 있고, 그 문서의 diff 스니펫이 target 이 지금 철회하려는 문구를 "추가분"으로 담고 있다
  - target 위치: `plan/in-progress/spec-draft-secret-store-verification-footnote.md` 전체 (특히 "왜 이 상태가 됐나" 절의 `#1112` 인용)
  - 관련 plan: `plan/in-progress/spec-draft-auth-invariants-sync.md` 체크리스트 — 항목 1~6·원 plan 체크박스 갱신까지 `[x]`, 그러나 `- [ ] 링크 무결성 회귀` · `- [ ] commit + PR` 두 항목만 미체크로 남아 있음
  - 상세: `git log` 확인 결과 이 plan 의 산출물은 `#1112`(commit `602f677cd`)로 이미 `origin/main` 에 머지됐다(target 의 "실측" 표가 인용하는 `spec/conventions/secret-store.md:91-94` 의 "알려진 검증 공백" 문단이 바로 이 plan 의 항목 6 diff 그대로다). 즉 이 plan 문서는 완료된 작업의 체크박스만 stale 하게 남은 상태다. target 이 그 항목 6 이 써넣은 각주 문단을 정확히 철회 대상으로 지목하고 있어 사실관계 자체는 정합하지만, `spec-draft-auth-invariants-sync.md` 쪽은 자신이 쓴 문단이 곧 대체된다는 사실을 전혀 모르는 채 `in-progress/` 에 미완료로 남는다 — 나중에 이 문서를 열어보는 사람이 그 diff 를 "아직 반영해야 할 변경"으로 오독할 여지가 있다(이 저장소가 이미 학습한 "plan 체크박스 = 실제 상태" 클래스와 인접).
  - 제안: target 의 범위는 아니지만(별개 PR 의 사후 정리), target PR 을 올리는 김에 `spec-draft-auth-invariants-sync.md` 의 남은 두 체크박스를 실제 상태(둘 다 `#1112` 머지로 완료)로 정정하고 `plan/complete/` 로 옮기는 것을 권장한다. 최소한 target 의 "왜 이 상태가 됐나" 절에 그 plan 문서가 아직 `in-progress/` 에 남아 있다는 사실을 한 줄 남겨두면 추적이 쉬워진다.

## 요약

target(`spec-draft-secret-store-verification-footnote.md`)은 `plan/in-progress/backend-lint-gate-broken-on-main.md` §후속의 정확히 한 항목("`secret-store.md §2.1` 각주의 '알려진 검증 공백' 문단 철회" — planner 권한, 미체크)을 수행하는 순수 정정 턴이며, 그 plan 이 제시한 대체 문구("e2e 가 와일드카드 의미론을, 단위가 쿼리 형태를 고정한다")를 그대로 확장 구현한다. target 의 모든 사실 주장(#1112/#1113 머지 커밋, e2e 파일 존재, 단위 테스트의 쿼리 형태 단언, 현재 spec 각주 91-94행 문구)을 저장소에서 직접 대조한 결과 전부 정확했다. 미해결 결정을 우회하는 부분도, target 이 가정하는 선행조건(#1113 머지)이 미해소인 부분도 없다. 유일하게 눈에 띄는 것은 target 이 철회하려는 문단을 원래 써넣은 자매 plan(`spec-draft-auth-invariants-sync.md`)이 실제로는 이미 머지됐는데도 `in-progress/` 에 체크박스 2개만 stale 하게 남아 있다는 점이며, 이는 target 자체의 결함이 아니라 인접한 plan lifecycle 정리 누락이라 INFO 로 남긴다.

## 위험도
LOW
