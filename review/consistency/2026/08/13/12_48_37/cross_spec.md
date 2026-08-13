# Cross-Spec 일관성 검토 — spec/4-nodes/ (impl-done)

## 검토 대상

- diff-base: `origin/main` → HEAD (worktree `eia-r8-cache-scope-4ae434`)
- 실제 diff: `spec/4-nodes/4-integration/4-cafe24.md`(§4.4 신설 + §9.8 갱신), `spec/2-navigation/4-integration.md:1294`, `spec/5-system/15-chat-channel.md`(CCH-SE-02), `spec/conventions/redis-keys.md:64`, `codebase/backend/.../public-webhook-quota.service.ts`(docstring)
- 커밋: `b6d5c40b0`(fix: fixed-window docstring + §4.4 신설 + CCH-SE-02 축약), `adc444c58`(docs: 2-navigation/4-integration.md:1294 자매 참조 정정)

이 diff 자체가 "SoT 이관 시 자매 참조 누락"을 두 차례(웹훅 docstring, cafe24 §9.8→§4.4) 잡아낸 후속 정정 PR이다. 아래는 이 PR이 놓친 **세 번째 인스턴스**를 spec/4-nodes/ 범위 안에서 찾은 결과다.

## 발견사항

- **[WARNING]** chat-channel dedup 의 SoT 이관이 spec/4-nodes/ provider 문서 3곳에 반영되지 않음
  - target 위치: `spec/4-nodes/7-trigger/providers/discord.md:324`, `slack.md:301`, `telegram.md:235` (모두 "SoT: [chat-channel CCH-SE-02](../../../5-system/15-chat-channel.md)" 문구로 종결)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` CCH-SE-02 행 (본 diff 에서 변경) / `spec/data-flow/14-chat-channel.md#22-redis` (실제 SoT)
  - 상세: 이번 diff(커밋 `b6d5c40b0`)가 CCH-SE-02 요구사항 행에서 메커니즘 리터럴(`Redis SET NX EX 30`, 키 `cc:dedup:<triggerId>:<idempotencyKey>`)을 걷어내고 "키·TTL·게이트 순서 상세는 [data-flow/14 §2.2](../data-flow/14-chat-channel.md#22-redis) (SoT)" 로 위임했다. 그런데 spec/4-nodes/7-trigger/providers/ 아래 discord·slack·telegram 세 문서는 여전히 같은 리터럴(`SET NX EX 30`, `cc:dedup:<triggerId>:<...>`)을 각자 인라인해두고, 그 아래 "SoT: chat-channel CCH-SE-02" 라고 못박는다. 이제 CCH-SE-02 자신은 상세를 갖지 않고 data-flow/14 §2.2 를 SoT 로 지목하므로, 세 provider 문서의 "SoT" 포인터가 한 칸 어긋났다 — 정확히 이 PR이 `spec/2-navigation/4-integration.md:1294`(cafe24 §9.8→§4.4)에서 이미 한 번 고친 것과 동일한 "SoT 이관 후 자매 참조 누락" 패턴의 세 번째 재발이다. 현재는 리터럴 값 자체(30초 TTL, 키 포맷)가 data-flow/14 §2.2 와 일치해 즉시 기능 문제는 없지만, 향후 data-flow/14 §2.2 가 변경돼도 이 세 provider 문서와 자체 SoT 주장은 갱신 신호를 받지 못해 조용히 stale 해진다 (redis-keys.md 인벤토리는 이미 data-flow/14 §2.2 를 정확히 가리키고 있어 대조 시 드러남).
  - 제안: 세 provider 문서의 "SoT: chat-channel CCH-SE-02" 를 "요구사항: CCH-SE-02 / 상세(키·TTL·게이트 순서) SoT: [data-flow/14 §2.2](../../../data-flow/14-chat-channel.md#22-redis)" 형태로 분리 — 이번 diff 가 `2-navigation/4-integration.md:1294` 에 적용한 것과 동일한 패턴. project-planner 소관의 spec 문서 정정.

- **[INFO]** `spec/data-flow/5-integration.md:156` 의 "상세: Cafe24 노드 §9.8" 참조는 §4.4 신설을 반영하지 않은 채 남아 있음
  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md#44` (신설 SoT)
  - 충돌 대상: `spec/data-flow/5-integration.md:156` ("엔드포인트 보안 계층 요약 (상세: [Cafe24 노드 §9.8]...)")
  - 상세: 직전 리뷰 라운드(`review/code/2026/08/13/12_37_46/documentation.md`)에서 이미 포착되어 "급하지 않지만 같은 정리 타이밍에 훑어볼 가치는 있음"으로 명시적으로 유예된 항목이다. 이 표는 리터럴 TTL·상수 값을 인용하지 않는 요약이라 즉시 모순은 없으나, "상세"라는 문구가 실제로는 §4.4(키 구성/TTL/degradation)와 §9.8(알고리즘/상수/근거) 양쪽에 걸쳐 있어 정확도가 떨어진다.
  - 제안: 우선순위 낮음 — 별도 조치 불요. 후속 spec 정리 시 "상세: §4.4(키)·§9.8(알고리즘)" 로 분리 권장.

## 확인했으나 이상 없음 (재확인 완료)

- `spec/2-navigation/4-integration.md:664, :808, :858` 의 "§9.8" 인용 3곳 — HMAC 알고리즘·Rate limiting 서술 자체를 가리켜 §4.4 신설과 무관하게 여전히 유효 (직전 리뷰 12_37_46 이 이미 전수 확인, 재검증 결과 동일).
- `spec/conventions/redis-keys.md:64` — cafe24 install 키 인벤토리 포인터가 `§4.4` 로 정확히 갱신됨.
- `spec/2-navigation/4-integration.md:1294` — "키 구성·TTL·degradation → §4.4(normative)" / "상수 값·설계 근거 → §9.8" 로 정확히 분리 갱신됨 (`adc444c58`).
- `spec/4-nodes/4-integration/4-cafe24.md` §4.4 vs §9.8 — 상수 값(10, 600)을 §4.4 표에 인라인하지 않고 이름으로만 참조해 이중 SoT 재발을 스스로 방지함.
- `codebase/.../public-webhook-quota.service.ts` docstring 정정("fixed-window") — `spec/5-system/12-webhook.md` §6 표(`60초 fixed-window`, `3600초 fixed-window`)와 이제 일치. `spec/5-system/15-chat-channel.md` R-CC-19 의 "fixed-window(sliding 아님)" 서술과도 일치.
- `spec/5-system/15-chat-channel.md` CCH-SE-02(축약) vs `spec/data-flow/14-chat-channel.md#22-redis`(TTL 30초, 키 `cc:dedup:{triggerId}:{idempotencyKey}`, rate-limit 앞 게이팅) — 값·순서 모두 일치.
- 요구사항 ID(`CCH-SE-02`), Redis 키(`cafe24:install:*`, `cc:dedup:*`) 어디에도 다른 의미로 재사용된 흔적 없음.
- API 계약·데이터 모델·상태 전이·RBAC 영역에는 이번 diff 가 영향을 주지 않음 (변경 범위가 문서 SoT 포인터 재배치 + 주석 정정에 한정).

## 요약

이번 diff 는 "SoT 를 옮기면서 자매 참조를 놓쳤다"는 동일 클래스의 결함을 이미 두 번(웹훅 docstring, cafe24 §9.8→§4.4→2-navigation:1294) 스스로 잡아낸 정정 PR이지만, chat-channel dedup(CCH-SE-02) 의 SoT 를 data-flow/14 §2.2 로 옮기면서 spec/4-nodes/7-trigger/providers/ 아래 discord·slack·telegram 세 문서의 "SoT: chat-channel CCH-SE-02" 인용을 갱신하지 않아 동일 패턴이 한 번 더 재발했다. 값 자체는 현재 일치해 즉시 기능 영향은 없는 문서 포인터 수준의 WARNING 이며, 그 외 cafe24 §4.4 신설·redis-keys.md·2-navigation:1294 갱신은 전수 재확인 결과 일관성이 확보됐다. API 계약·데이터 모델·상태 전이·RBAC 충돌은 발견되지 않았다.

## 위험도

LOW
