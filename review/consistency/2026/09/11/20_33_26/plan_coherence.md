# Plan 정합성 검토 — `spec-draft-chat-channel-binder-drift.md`

## 검토 범위

- Target: `plan/in-progress/spec-draft-chat-channel-binder-drift.md` (T1 `#1319`/T2 `#1320` 이동 후 SoT drift 정정 — ① `code:` glob 3개 ② §7 5파일 ③ 귀속 3곳)
- 대조 대상: `plan/in-progress/**` 전체 (bundle) + 컨텍스트 예산 초과로 생략된 61개 파일 중 chat-channel 연관 파일은 `Read`로 직접 열어 확인 (`chat-channel-discord-gateway.md` · `chat-channel-slack-socket-mode.md` · `chat-channel-visual-ssr-png.md` · `spec-draft-nullable-notation-followups.md`)
- 실측: `review_guard._glob_to_regex` 매칭 대상 파일을 `find`/`ls`로 직접 재현, `15-chat-channel.md`/`secret-store.md`/`chat-channel-adapter.md`/`data-flow/14-chat-channel.md` 현행 본문을 target 의 "편집 대상 원문" 인용과 대조

## 발견사항

- **[INFO]** 트래커의 co-located 세 번째 하위 항목이 이미 해소됐는데 미주석
  - target 위치: (target 은 이 항목을 다루지 않음 — 체크리스트 "트래커 항목 2건 종결" 이 언급하는 두 항목 밖)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2233-2235` — `[x]` 로 닫힌 "spec 10곳이 `store()` 라 적는데 실제 호출은 `rotate()`" 항목(L2177) 안에 **같이 얹혀 있는** 별개 하위 지적: *"신규 검증 분기 2건(`chatChannel` 최초 부착 차단 → `details.field='chatChannel'` · provider 전환 차단 → `details.field='provider'`)이 §5.4.1 표와 `2-trigger-list.md` PATCH 에러 표에 미등재"*
  - 상세: 실측 결과 이 지적은 이미 해소돼 있다 — `spec/5-system/15-chat-channel.md` §5.4.1.2(L391-419, 최근 커밋 `f947b49f4` "신규 §5.4.1.2"로 추가)가 두 필드(`chatChannel`/`provider`) 모두 `details.field`+`INVALID_FIELD` 로 표에 싣고 있고, `spec/2-navigation/2-trigger-list.md`(L176 인용문)도 두 항목을 동일하게 서술한다. 그런데 트래커 쪽에는 다른 co-located 하위 항목들이 받은 것과 같은 형태의 `> ✅ … 해소` 주석이 이 항목에는 없다 — 다음 사람이 "미등재"로 다시 실측할 위험이 남는다.
  - 제안: target 이 어차피 같은 트래커 파일에서 "code: 등재"·"귀속 표기" 두 항목을 `종결` 처리하는 턴이므로, 같은 편집에서 이 co-located 항목에도 `✅ 해소` 주석(§5.4.1.2 추가 커밋 인용)을 함께 남기는 쪽이 다음 재실측 낭비를 막는다. 차단 사유는 아니다.

## 정합성이 확인된 부분 (참고)

- **① `code:` glob 결정은 트래커가 명시적으로 열어 둔 "planner 판단" 을 정확히 집행한다** — 트래커(`spec-draft-nullable-notation-followups.md:2224-2227`)는 "세 번째 관측이므로 구조를 바꾸는 쪽을 권한다 … 그 트레이드오프는 planner 판단" 이라고 결정을 유보해 뒀고, target 은 `modules/triggers/**`(27건, 무관 17개) 대 좁은 glob 3개(10건, 차집합 0)를 **정본 매처로 직접 실측**해 선택했다. `find codebase/backend/src/modules/triggers -type f | wc -l` 로 27건, `ls .../triggers/*chat-channel*` 로 8개 미등재를 각각 재현 확인 — target 의 수치가 실측과 일치한다. 미해결 결정을 우회한 것이 아니라 그 결정을 내리는 턴이다.
- **③ 귀속 표기 3곳도 트래커 항목(`:2335-2355`)과 스코프·처방이 정확히 일치** — "드리프트 범위는 3곳뿐, 나머지 6곳은 대상 아님"(주어 확인)이라는 트래커의 판별 결과를 target 이 그대로 이어받았고, (a)(b)(c) 세 파일의 "현행" 인용부(`secret-store.md:146`, `chat-channel-adapter.md:367-371`, `data-flow/14-chat-channel.md:29`)를 직접 열어 대조한 결과 target 의 "편집 대상 원문" 이 실제 현행 본문과 **완전히 일치**한다(줄 단위 대조, drift 없음).
- **② §7 5파일 누락도 실측이 일치** — `spec/5-system/15-chat-channel.md:508-542` §7 블록을 직접 읽어 target 의 "편집 대상 원문"(ⓔ) 과 대조한 결과 완전 일치하며, 실제 `codebase/backend/src/modules/triggers/` 에 `chat-channel-binder.service.ts` 등 8개 chat-channel 관련 파일이 존재하는데 §7 목록엔 1개(`chat-channel-token-rotator.service.ts`)만 있다는 target 의 실측도 재확인됐다.
- **pending_plans 비충돌** — `15-chat-channel.md` frontmatter `pending_plans:` 가 가리키는 3개 backlog plan(`chat-channel-discord-gateway.md`/`chat-channel-slack-socket-mode.md`/`chat-channel-visual-ssr-png.md`)을 직접 열어 확인한 결과 모두 `status: backlog`·미착수 상태이고 v2 범위(Gateway/Socket Mode/SSR PNG)라 이번 T1/T2 이동(triggers 내부 구조 재배치)과 무관 — target 이 이 필드를 건드리지 않는 것도 타당하다.
- **선행 조건 완비** — target 이 전제하는 T1(`#1319`)·T2(`#1320`) 이동은 각각 `plan/complete/impl-chat-channel-binder.md`·`plan/complete/impl-chat-channel-binder-t2.md` 로 이미 머지·완료돼 있고, target 이 인용하는 실제 소스 파일 10개(`chat-channel-binder.service(.spec).ts` 등)가 저장소에 실재함을 `ls` 로 확인 — target 이 아직 오지 않은 코드를 전제로 spec 을 쓰는 상황이 아니다.
- **`/consistency-check --spec` 대상 4개 spec 파일 외 다른 in-progress plan 과의 충돌 없음** — `chat-channel-adapter.md:354/359/367`·`15-chat-channel.md:200/201/373/377/380/390` 등 다른 in-progress plan 이 줄 번호로 인용하는 지점을 전수 grep 했으나 전부 target 의 편집 지점(§2.4 JSDoc L366-377, §7 L508-542, frontmatter `code:`)보다 앞이거나 무관한 위치이며, 편집으로 인한 줄 밀림이 그 인용들을 새로 깨뜨릴 위험은 실측상 없다.

## 요약

Target 은 `spec-draft-nullable-notation-followups.md` 트래커가 명시적으로 열어 둔 두 항목(`code:` glob 결정·귀속 표기 3곳)을 정본 매처·직접 파일 대조로 실측해 정확히 닫는 턴이며, 다른 in-progress plan 의 미해결 결정과 충돌하거나 선행 조건을 건너뛰는 지점은 발견되지 않았다. 유일한 지적은 같은 트래커 안에 co-located 돼 있는 이미 해소된 세 번째 하위 항목(§5.4.1/2-trigger-list.md 검증 분기 미등재)에 완료 주석이 빠져 있다는 INFO 수준의 위생 사항으로, target 자체의 정합성을 해치지 않는다.

## 위험도

LOW
