# Plan 정합성 검토 — `spec-draft-integration-dto-pointer.md`

## 검토 대상

- Target: `plan/in-progress/spec-draft-integration-dto-pointer.md` (`4-integration.md §9.1` — `IntegrationDto` 확장 필드 포인터, planner 턴)
- 대조: `plan/in-progress/**` 전체 (특히 origin 항목을 담은 `plan/in-progress/spec-draft-nullable-notation-followups.md`)

## 실측 확인 (착수 전 재판정의 사실관계 검증)

- `origin/main` HEAD = `5873b9678` (target 의 주장과 일치, 현재 워크트리 HEAD 도 동일).
- `integration-response.dto.ts:143-167` — `mallId`(144-145) · `tokenExpiresAt`(147-149) ·
  `lastRotatedAt`(151-153) · `lastUsedAt`(155-157) · `consecutiveNetworkFailures`(159-167) 5필드가
  실재하며, `consecutiveNetworkFailures` JSDoc(160-164)이 target 이 인용한 캐비엇("프런트엔드
  참조 0곳 … 별도 항목으로 트래커에 남긴다")과 동일한 문구를 이미 담고 있다. 그 5필드는
  `bfa124920`(#1291, "§5.4 스윕(4→18 DTO)이 찾아낸 유출 차단") 커밋으로 origin/main 에 들어왔다 —
  target 이 "차단 전제가 풀렸다" 고 주장한 시점과 정합한다.
- `1-data-model.md §2.10`(295행) — `mall_id`(309) · `consecutive_network_failures`(311) ·
  `token_expires_at`(312) · `last_used_at`(313) · `last_rotated_at`(314) 5/5 실재. 앵커 형태
  `#210-integration` (target 이 쓴 포인터 링크)는 헤딩 `### 2.10 Integration` 의 표준 슬러그화
  규칙과 일치하고, `spec-link-integrity.test.ts` (target 체크리스트가 지정한 가드)가 실제로
  존재해 이 주장을 사후 검증할 수 있다.
- `4-integration.md §9.1`(795행) `GET /api/integrations/:id` 행 — target 이 지목한 문장
  ("`IntegrationDto` 는 다음 두 derived 필드를 포함한다")이 그대로 있다. target 의 편집안은
  그 문장 뒤에 이어 붙이는 것이라 원문을 훼손하지 않는다.

## 미해결 결정과의 충돌 검토

- Origin 항목(`spec-draft-nullable-notation-followups.md:1562-1567`, 아직 `[ ]`)의 유일한
  전제("5필드가 origin/main 에 없다")를 target 이 실측으로 반증하고 그 위에서 처방을 정밀화한
  것이지, 그 항목이 미해결로 남겨 둔 별도 결정을 가로채는 것이 아니다.
- `consecutiveNetworkFailures` 노출 중단은 별도 developer 결정 항목(`:1264-1267`, `[ ]`,
  "노출 중단 **검토**")으로 여전히 열려 있다. target 의 §9.1 캐비엇 문구
  ("노출 중단이 별도 항목으로 추적 중 … 새 소비자를 만들지 말 것")는 그 열린 결정을 대신
  내리지 않는다 — "제거할지" 는 여전히 미정으로 두고 "지금 새 소비자를 만들지 말라" 는
  중립적 안전장치만 추가한다(제거/보존 어느 쪽으로 결정되어도 유효). 표현("제거 후보로 별도
  추적 중")도 origin 항목이 이미 쓴 문구(`:1706-1708`)를 그대로 재사용해 새 뉘앙스를
  주입하지 않았다. **충돌 없음.**

## 선행 plan 미해소 검토

- target 이 가정하는 유일한 선행 조건("5필드 선언이 origin/main 에 있다")은 위 실측대로 이미
  해소돼 있다.
- `cafe24-backlog-residual.md` C-6(같은 §9.1 행의 `appUrl`/`autoRefresh` derived 필드 일반화)은
  `[x] RESOLVED` 로 닫혀 있고, target 의 편집은 그 두 필드의 서술을 건드리지 않고 뒤에
  이어 붙이기만 하므로 그 선행 작업과 충돌하지 않는다.
- `plan/in-progress/**` 전체에서 `spec/2-navigation/4-integration.md` 를 `spec_impact` 로 잡은
  다른 진행 중 plan 은 없다(`spec-draft-eia-62-waiting-payload.md`·
  `spec-update-node-cancellation-shutdown-classification.md` 는 `1-data-model.md` 를 잡지만
  §2.10/Integration 영역과 무관). **미해소 선행 조건 없음.**

## 후속 항목 누락 검토

- target 의 체크리스트(127-130행)가 이미 자매 트래커 갱신을 명시한다 — origin 항목 플립
  + `consecutiveNetworkFailures` 항목에 "제거 시 §9.1 문장도 함께 지운다" 한 줄 보강. 이
  저장소가 반복 겪은 "이중 등재"·"한쪽만 갱신" 클래스(예: `secret-store.md`/
  `14-external-interaction-api.md` 노출 창 서술, "두 검증자" 문구 이중 등재)를 이미 인지하고
  선반영한 형태다.
- `IntegrationDto`/"두 derived 필드" 인벤토리 주장을 복제하는 다른 spec 자리가 있는지 전수
  확인했다(`grep -rn "IntegrationDto\|derived 필드" spec/`) — §9.1 자신과 §4.2/§10.3/§C-6
  참조뿐이고, 전부 "이 필드가 존재한다" 는 개별 서술이지 "전수 목록" 주장을 반복하지 않는다.
  즉 이번 편집이 무효화하거나 함께 고쳐야 할 **숨은 사본은 없다.**

### INFO — §9.1 관행과의 사소한 불일치

같은 표 행(§9.1 `GET /:id`)의 인접 서술은 `appUrl`/`autoRefresh` 관련 후속 작업을
`[cafe24 백로그 C-6](../../plan/in-progress/cafe24-backlog-residual.md)` 로 **직접 하이퍼링크**하는
관행을 이미 쓰고 있다. target 의 새 캐비엇 문장("노출 중단이 별도 항목으로 추적 중")은 어느
트래커인지 링크 없이 산문으로만 적는다. 체크리스트가 자매 트래커 갱신을 실행하므로 실질
피해는 없지만, 같은 절 안에서 한쪽은 링크·한쪽은 무링크로 갈리면 다음 독자가 "추적 중"이
어디인지 찾아야 한다. 편집 시 `plan/in-progress/spec-draft-nullable-notation-followups.md`
링크를 붙이는 편이 같은 문서의 기존 관행과 맞다.

## 요약

target 은 자신이 이어받는 origin 항목(`spec-draft-nullable-notation-followups.md`)의 유일한
차단 전제를 실측으로 검증했고(5필드가 origin/main·`1-data-model.md §2.10` 양쪽에 실재), 그
항목이 열어 둔 별도 결정(`consecutiveNetworkFailures` 노출 중단 여부)을 가로채지 않으면서
문제의 형태를 한 겹 더 정밀화했다(단순 포인터가 아니라 "인벤토리 주장을 좁히는" 처방으로
교정). 체크리스트가 자매 트래커 플립·보강을 이미 계획해 이 저장소가 반복 겪은 이중 등재·
편측 갱신 클래스를 선제 차단한다. 전수 grep 으로 확인한 결과 이번 편집이 무효화하거나 새로
반영해야 할 다른 plan 의 후속 항목·숨은 인벤토리 사본은 발견되지 않았다. 발견된 유일한
사항은 인접 관행(직접 하이퍼링크)과의 사소한 스타일 불일치(INFO)뿐이다.

## 위험도

LOW
