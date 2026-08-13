# 신규 식별자 충돌 검토 — `spec-draft-eia-notification-payload-contract.md`

## 발견사항

- **[WARNING]** EIA §6.5 헤딩 재서술 시 기존 앵커 4곳이 끊긴다
  - target 신규 식별자: EIA §6.4/§6.5 를 "참조로 축약"(체크리스트 5번째 항목) — 즉 두 섹션의 서술(및 사실상 헤딩)을 재작성
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md` 의 현재 §6.5 헤딩은 `### 6.5 페이로드 — \`execution.cancelled\` / \`execution.ai_message\`` 이며, 이 정확한 문구에서 파생된 앵커 `#65-페이로드--executioncancelled--executionai_message` 를 아래 4곳이 이미 참조 중:
    - `spec/5-system/15-chat-channel.md:76`
    - `spec/conventions/chat-channel-adapter.md:145`
    - `spec/conventions/chat-channel-adapter.md:354`
    - `codebase/backend/src/modules/chat-channel/types.ts:378`
  - 상세: target 의 "(3) 나머지는 포인터로 — 필드 열거를 없앤다" 및 체크리스트 "`§6.4/§6.5 를 참조로 축약`" 는 §6.5 본문(및 사실상 헤딩 문구)을 바꾸는 작업이다. 마크다운 앵커는 헤딩 문구에서 결정적으로 파생되므로, 헤딩 텍스트가 "페이로드 — `execution.cancelled` / `execution.ai_message`" 에서 다른 문구(예: "요약" · "참조")로 바뀌면 위 4곳의 `#65-...` 앵커가 깨진다. 이는 저장소의 `spec-link-integrity` 가드(codebase 소스까지 스캔, `plan/complete/eia-context-schema-followups.md` 이력 참조)가 잡아내겠지만, 잡히는 시점은 구현 단계이고 이 draft 자체가 "규칙을 일부 절에만 적용" 반려 3회를 근거로 쓰는 문서라는 점에서, 착수 전에 갱신 대상으로 명시해 두지 않으면 4번째 부분반영이 될 위험이 크다.
    - 참고로 §6.4(`execution.failed`) 앵커(`#64-...`)는 저장소 내 외부 참조가 0건이라 헤딩 문구를 바꿔도 앵커 파손 위험은 없다. §6.3 앵커(`#63-...`) 도 외부 참조 0건 — "신설" 표현이 실제로는 §6.3 헤딩 재작성이지만 안전하다.
  - 제안: 체크리스트에 "§6.5 헤딩 문구를 유지(번호+타이틀 그대로)하고 **본문만** 참조로 축약" 또는 "위 4개 참조처의 앵커 문자열을 함께 갱신" 을 명시적으로 추가한다.

- **[WARNING]** 봉투 서술용 신설 섹션 "EIA §6.x" 의 번호가 미확정 — 인접 번호 재사용/재넘버링 캐스케이드 위험
  - target 신규 식별자: "(2) 봉투는 채널별로 각 한 번만 서술" 의 `EIA §6.x`(webhook/SSE 봉투 서술 위치)
  - 기존 사용처: 현재 `14-external-interaction-api.md` §6 하위는 6.1(헤더)·6.2(waiting_for_input)·6.3(completed)·6.4(failed)·6.5(cancelled/ai_message)·6.6(재시도) 로 이미 번호가 꽉 차 있다.
  - 상세: target 본문은 이 신설 섹션을 실제 번호 대신 자리표시자 `§6.x` 로만 지칭한다. 체크리스트도 "EIA §6.3 신설(필드 집합) + §6.x 봉투 1회 + §6.4/§6.5 를 참조로 축약" 이라 §6.4/§6.5 번호는 유지한 채 별도로 `§6.x` 를 끼워 넣는 것처럼 읽히는데, 어디에 삽입하느냐(6.3 과 6.4 사이 서브섹션인지, 6.6 뒤 신설인지)에 따라 ① 6.3~6.6 사이 삽입 시 뒤 섹션 전부(6.4→6.5, 6.5→6.6, 6.6→6.7) 재넘버링이 발생해 위 §6.5 앵커 파손 위험이 배가되거나, ② 6.6 뒤에 6.7 로 신설하면 "재시도"(6.6) 뒤에 "봉투 서술" 이 와서 §6.2 의 "SSE 스트림 wire 형태 주의" blockquote(§6.2 안에 이미 유사 내용 존재)와 위치가 멀어져 탐색성이 떨어진다. 어느 쪽이든 draft 는 확정하지 않은 채 구현자에게 위임하고 있다.
  - 제안: `(1)`/`§6.x` 를 실제 확정 번호(예: `§6.3.1` 서브섹션 또는 `§6.6` 앞에 삽입해 재시도를 `§6.7` 로 미는 등)로 못박고, 재넘버링이 발생하면 그로 인해 깨지는 내부/외부 참조(§6.3 self-ref, §6.5 외부 앵커 4곳)를 체크리스트에 함께 등재한다.

- **[INFO]** 동일 파일(`spec/5-system/14-external-interaction-api.md`)을 동시에 건드리는 활성 plan 이 하나 더 있다
  - target 신규 식별자: 없음(참고 정보)
  - 기존 사용처: `plan/in-progress/spec-draft-eia-r8-alignment.md`(worktree `eia-spec-r8-alignment-fff754`, `spec_impact: spec/5-system/14-external-interaction-api.md` 의 §R8 idempotency 캐시 서술)가 같은 파일을 대상으로 별도 in-progress 상태다.
  - 상세: 두 draft 가 건드리는 절(§6.x 종결 payload vs §R8 idempotency)은 겹치지 않아 직접적 식별자 충돌은 없다. 다만 같은 파일을 서로 다른 worktree 에서 동시 편집 중이므로, 두 PR 이 순서 없이 머지되면 diff 충돌 또는 한쪽의 heading 번호 변경이 다른 쪽의 line 앵커/컨텍스트를 스치는 정도의 마찰이 있을 수 있다.
  - 제안: 별도 조치 불요 — 머지 순서만 인지하고 진행(병렬 세션 충돌 확인 관행에 따라 착수/머지 직전 재확인).

## 요약

target 이 신설하는 필드 집합(`§6.3`)·요구사항 ID·API endpoint·이벤트명·ENV/설정키 자체는 기존과 다른 의미로 재사용되는 사례가 없다 — 모두 이미 spec 에 존재하던 필드(`result.outputs`, `result.cancelledBy`, `durationMs`, `error`)를 한 곳으로 모으는 통합이며, 진짜 신규 표면(엔드포인트·이벤트·ENV·파일 경로)은 도입하지 않는다. 다만 그 통합 방식이 **기존 섹션 헤딩을 재작성**하는 형태라, 헤딩 텍스트에서 파생되는 마크다운 앵커가 바뀌면 이미 4곳에서 살아있는 `EIA §6.5` 크로스레퍼런스(`spec/5-system/15-chat-channel.md`, `spec/conventions/chat-channel-adapter.md`(2곳), `codebase/backend/src/modules/chat-channel/types.ts`)가 끊길 수 있고, 봉투 서술용 신설 섹션 번호(`§6.x`)가 draft 안에서 확정되지 않아 실제 구현 시점에 재넘버링 캐스케이드가 발생할 여지가 있다. 둘 다 spec-link-integrity 가드가 최종적으로 잡아낼 성격이지만, 이 draft 자체가 "부분 반영 3회 반려"를 근거로 구조 전환을 정당화하는 문서이므로 착수 전에 앵커 갱신 대상과 번호를 체크리스트에 명시해 4번째 부분반영을 막는 편이 이 draft 의 취지에 부합한다.

## 위험도

MEDIUM
