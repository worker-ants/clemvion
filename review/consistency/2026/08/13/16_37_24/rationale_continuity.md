# Rationale 연속성 검토 — spec-draft-eia-notification-payload-contract.md

## 검토 범위·방법

target(`plan/in-progress/spec-draft-eia-notification-payload-contract.md`)이 인용하는 과거
Rationale 항목(WS §4.4 PR #945, EIA R3/R10/R14/R16/R19, chat-channel-adapter R3, redis-keys.md
"포인터만" 원칙)을 실제 spec 파일(`spec/5-system/14-external-interaction-api.md`,
`spec/5-system/6-websocket-protocol.md`, `spec/conventions/chat-channel-adapter.md`,
`spec/conventions/redis-keys.md`)과 대조하고, 인용된 과거 리뷰 라운드(`review/consistency/
2026/08/13/14_18_42`~`16_18_00`)의 실제 산출물, `git log -S`/`git show`(PR #228 `9ed6e6305`)로
사실관계를 검증했다.

## 발견사항

- **[INFO]** WS §4.4 Rationale(PR #945)의 "EIA §6.2 blockquote" 앵커 서술이 이번 재구성 후에도
  정확히 유효한지 재확인 필요
  - target 위치: `## 결정` (2) "SSE: ... §6.2 L615 blockquote 와 같은 사실이므로, 그 서술을
    도입부로 끌어올려 5종 이벤트 전체에 걸리게 한다 (§6.2 에는 waiting 고유 필드 예시만
    남긴다)"
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` → "§4.4 wire 필드
    caveat — 직접 재작성 대신 caveat + 오너십 분리 (2026-07-14, PR #945)" — "외부 클라이언트
    소비 매핑의 SoT = **EIA §6.2 blockquote**(위젯 파서 `eia-events.ts` 정합)"
  - 상세: PR #945 의 오너십 분리 Rationale 은 "EIA §6.2 blockquote" 라는 특정 위치를 SoT 앵커로
    명시적으로 지목한다. target 은 그 blockquote 안에서 **일반 사실**(SSE 는 webhook 처럼
    `payload` 로 재래핑하지 않는다)만 §6 도입부로 승격시키고, waiting_for_input 고유 필드
    매핑(`node.id → waitingNodeId` 등)은 §6.2 에 남긴다고 명시했다 — 분리 원칙 자체는 깨지
    않는다. 다만 실행 단계에서 §6.2 blockquote 문구를 실제로 쪼갤 때, WS Rationale 이 "EIA
    §6.2 blockquote" 라는 단일 지점을 가리키는 서술이 여전히 정확히 성립하는지(= 남는 부분이
    "위젯 파서 정합" 매핑을 충분히 담고 있는지) 편집 직후 확인이 필요하다. Rationale 원칙
    위반은 아니고, 편집 실행 시 앵커 정확성 확인 항목으로 남겨둘 사안이다.
  - 제안: target 의 실행 체크리스트(§6.2 blockquote 이관 항목)에 "WS §4.4 Rationale 의 'EIA
    §6.2 blockquote' 서술이 이관 후에도 여전히 정확한 위치를 가리키는지 확인" 한 줄을 추가.
    필요하면 WS Rationale 문구를 "EIA §6 도입부 + §6.2 blockquote" 로 소폭 갱신.

## 검증 결과 (문제 없음으로 확인된 항목)

target 은 이례적으로 촘촘하게 과거 Rationale 을 인용하며 자기 결정을 정당화한다. 아래는 실제
검증을 통과한 항목들이다 — 별도 조치 불필요:

- **`chat-channel-adapter.md` R3** 인용("구체 필드 갱신은 항상 EIA spec 우선") — 실제 파일
  527-529행과 일치. target 의 §1.2 축약 결정은 이 원칙을 처음으로 실질 집행하는 것이지 위반이
  아니다.
- **WS §4.4 PR #945 Rationale**("오너십 분리로 3중 복제·재-drift 회피") — 실제 336-341행과
  일치. target 은 "종결 이벤트에는 WS 전용 부가 필드가 없다" (waitingNodeType 류에 대응하는
  필드가 종결 이벤트엔 없음 — WS §4.1 실제 필드 표로 확인됨: `duration`/`nodeCount`/
  `failedNodeId` 뿐, WS-only 부가 식별자 없음)는 사실을 근거로 같은 오너십 분리 원칙을 "단일
  SoT + 포인터" 형태로 적용한다 — 반하는 것이 아니라 동일 원칙의 다른 경우라는 target 자신의
  주장이 사실관계로 뒷받침된다.
- **EIA R16**("코드가 SoT, spec 이 낡음" — `/cancel` 2필드 정정) 인용 및 "§6.3 은 같은 PR
  (#228)의 같은 초안에서 나왔다" 주장 — `git show 9ed6e6305`(PR #228, 2026-05-21)로 확인:
  §6.3 의 `finalNodeId`/`finalPort` 는 실제로 그 최초 spec 커밋에서부터 존재했고 구현 emit
  코드는 현재도 0건(`grep -rn "finalNodeId|finalPort" codebase/backend/src` → 미사용 타입
  잔재 1곳뿐). target 이 "삭제(약속 철회)"로 판단한 것은 R16 과 같은 전례를 다른 필드에
  일관되게 적용한 것.
- **redis-keys.md "포인터만" 원칙** 인용 — 실제 20-21행과 정확히 일치.
- **EIA §6.2 L615 blockquote**("SSE 스트림은 notification envelope 재구성 없이 fanout wire 를
  그대로 전송") 인용 — 실제 614행 근처와 일치. target 이 "'두 wire' 전제가 틀렸다"(라운드
  `16_18_00` cross_spec CRITICAL)를 3-wire 로 정정한 것은 그 CRITICAL 지적을 정확히 반영한
  결과이며, 인용된 반려 이력(`14_18_42`~`16_18_00`) 6개 세션 폴더 전부 실존 확인.
  `naming_collision.md`(`16_18_00`)의 `duration`/`durationMs` WARNING, `line 536` 6곳 지적도
  실제 파일 대조로 정확함(§6.5 실제 위치 675행, `line 536` 텍스트 spec 3곳 + 코드 3곳 확인).
- **`retry-turn-terminal-guard.md` #2** 참조("cancelledBy 닫힌 union"에 의존) — 실제 plan 파일
  §코드 표 #2 "EXECUTION_CANCELLED payload 에 spec §4.1 필수 cancelledBy 추가" 항목과 일치.
  target 이 WS §4.1 필드 열거를 축약하면서도 `cancelledBy` 닫힌 union·`error.code` 매핑 등
  **행동 계약**은 별도로 (1) 도입부에 이관 보존하겠다고 명시한 것은 이 의존 관계를 인지한
  타당한 안전장치다.
- 삭제 대상 필드(`finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`)에 대해 이들을 의도적
  설계로 명시한 별도 Rationale 은 어느 spec 에도 없음(§6.3 payload 예시의 인라인 주석뿐) —
  삭제가 기존 명시적 결정을 뒤집는 것이 아니라 애초에 근거 Rationale 없이 표류하던 미구현
  약속을 정리하는 것.

## 요약

target 은 5회의 `--spec` 반려 이력을 포함해 이례적으로 상세하게 과거 Rationale(WS PR #945,
EIA R3/R10/R14/R16/R19, chat-channel-adapter R3, redis-keys.md)을 인용·재해석하며 자기 결정을
정당화하는 문서다. 인용된 모든 과거 Rationale 문구·라인 번호·PR 이력을 실제 spec 파일과
git 이력으로 대조 검증한 결과 왜곡이나 기각된 대안의 무단 재도입은 발견되지 않았다. 결정 번복
(예: `finalNodeId` 류 필드 삭제, WS §4.1/`chat-channel-adapter.md` §1.2 필드 열거 축약)은 모두
새 Rationale 항목("왜 caveat 이 아니라 rewrite 인가", "왜 '지킬 수 있는 약속'은 남기나" 등)을
동반하며, 기존 오너십 분리·단일 sink·pointer-only 원칙과 정합하는 방향으로 그 원칙을 확장
적용한다. 유일한 관찰 사항은 WS Rationale 이 앵커로 삼는 "EIA §6.2 blockquote" 문구가 편집
실행 후에도 정확히 유효한지 재확인이 필요하다는 INFO 수준 권고뿐이다.

## 위험도

NONE
