# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** 이관(move)이 남긴 stale 상대경로 링크 — diff 밖 파일이지만 이 diff 의 "in-progress → complete" 이동 자체가 유발
  - 위치: `plan/complete/node-cancellation-infrastructure.md:70`, `:83`, `:90` (diff 대상 아님, 직접 `Read` 로 확인한 실제 소스 줄번호)
  - 상세: 이 세 줄은 `[node-cancellation-inflight-followups.md](../in-progress/node-cancellation-inflight-followups.md)` 형태의 상대경로 링크다. 이번 diff 가 `plan/in-progress/node-cancellation-inflight-followups.md` 를 삭제하고 `plan/complete/node-cancellation-inflight-followups.md` 로 재작성했으므로, `node-cancellation-infrastructure.md` (이미 `plan/complete/` 소속) 기준 `../in-progress/...` 상대경로는 더 이상 존재하지 않는 파일을 가리키는 dangling link 가 된다. `spec-link-integrity.test.ts` 의 코드 주석에 따르면 이 가드는 `spec/**.md` → `plan/**` 링크만 검사하고, "plan/** 문서 내부의 링크 위생은 plan-coherence-checker 소관"이라 명시돼 있어 build 는 이 깨짐을 잡지 못한다.
  - 제안: 이번 diff 범위에서 함께 `../complete/node-cancellation-inflight-followups.md` 로 3곳을 갱신하거나, 최소한 후속 plan-coherence 체크에서 반드시 잡히도록 남겨두지 말 것. 이동(move)을 수행한 diff 의 책임 범위로 보는 것이 합리적.

- **[INFO]** 요청 범위(§3 "다단계 cancel 전파 e2e") 밖의 세 번째 테스트 케이스 추가 — 기존 커버리지와 부분 중복
  - 위치: `codebase/backend/test/node-cancellation-propagation.e2e-spec.ts:297` (`it('취소된 실행은 재-stop 을 거부한다 (terminal 재진입 방지)', ...)`)
  - 상세: plan 의 수용 기준은 "다단계 cancel 전파 e2e 가 signal → cancelled 상태 확정을 잠금"이다. 이 세 번째 테스트는 다단계 전파가 아니라 "이미 취소로 terminal 이 된 실행에 재-stop 하면 400" 이라는 별개의 API 멱등성/전이 방지 계약을 검증한다. 같은 계열의 계약은 이미 `codebase/backend/test/workflow-execution.e2e-spec.ts:169` (`it('D. terminal 상태 실행에 stop → 400 (이미 완료된 실행)')`)가 커버 중이라 완전히 신규 표면은 아니고("정상 completed 로 terminal" vs "cancelled 로 terminal" 차이만 있음), harness 를 재사용한 자연스러운 확장으로 보이나, 엄밀히는 요청된 §3 acceptance criteria 를 넘어서는 기능 확장이다.
  - 제안: 해를 끼치지 않으므로 반드시 제거할 필요는 없음. 다만 plan 문서의 완료 서술("3건, e2e 259 green")에 이 항목이 §3 acceptance criteria 범위 밖임을 한 줄 명시하거나, 별도 항목으로 분리 기록하면 향후 grooming 시 "이 3번째 테스트가 왜 여기 있는지" 재추적 비용을 줄일 수 있다.

- **[INFO]** 참고 (검증됨, 결함 아님) — 이 diff 는 `spec/conventions/node-cancellation.md` 의 `status: partial → implemented` 전환과 `pending_plans` 필드 제거를 포함한다. 이는 `spec/conventions/spec-impl-evidence.md` §3.1 규약("partial → implemented: 마지막 pending_plans 가 complete/ 로 이동한 commit 안에서 승격")을 정확히 그대로 따른 것으로, 범위 이탈이 아니라 plan 완료에 따른 기계적 의무 준수다. `spec/conventions/node-cancellation.md` §6 표에 여전히 남아있는 다른 "— (Planned)" 행(chat-channel/MakeShop/Cafe24 signal 전파, workflow-timeout 노드 abort 통합)은 애초에 이 diff 의 유일한 `pending_plans` 항목(`node-cancellation-inflight-followups.md`)이 추적하던 범위가 아니었으므로, 이번 상태 승격이 그 항목들의 완료를 함의하지는 않는다 — 다만 "implemented" 라는 라벨이 §6 표의 잔여 Planned 행과 의미적으로 긴장 관계에 있을 수 있어 consistency-checker(`plan-coherence`/`convention_compliance`) 영역에서 한 번 더 볼 가치는 있다. Scope 리뷰 관점에서는 이 diff 자체의 결함이 아니라 정보 공유용 메모다.

## 요약

전체적으로 이 변경은 하나의 목표 — `node-cancellation-inflight-followups.md` §3 (다단계 cancel 전파 e2e) 구현과 그에 따른 plan lifecycle 완료 처리(in-progress→complete 이동, `spec/conventions/node-cancellation.md` frontmatter 승격) — 에 잘 정렬돼 있다. 신규 e2e 파일의 import·타입·헬퍼는 전부 사용되고, `CanvasNode` 로컬 인터페이스 중복은 같은 파일군의 기존 관행과 일치하며, status 전환은 자체 spec 컨벤션이 요구하는 기계적 의무를 그대로 따른 것이라 스코프 이탈이 아니다. 다만 (1) plan 이동이 유발한 `node-cancellation-infrastructure.md` 내 3곳의 상대경로 링크 깨짐이 diff 밖에 방치돼 있고, (2) 3번째 테스트 케이스(재-stop 거부)가 §3 acceptance criteria 를 다소 벗어나 기존 테스트(`workflow-execution.e2e-spec.ts` D)와 부분 중복되는 점은 경미하지만 기록해 둘 가치가 있다.

## 위험도

LOW
