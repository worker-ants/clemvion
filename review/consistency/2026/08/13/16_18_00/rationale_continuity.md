# Rationale 연속성 검토 — `spec-draft-eia-notification-payload-contract.md`

## 조사 방법 (요약)

target 이 인용하는 핵심 선례를 실제 spec 파일과 대조했다: `spec/5-system/6-websocket-protocol.md`
`## Rationale`(§4.4 wire 필드 caveat / PR #945, R16 유사 §5.4 인용은 EIA 문서 R16), `spec/5-system/
14-external-interaction-api.md` `## Rationale`(R16 "코드가 SoT", R19 `cancelledBy` 닫힌 union),
`spec/conventions/chat-channel-adapter.md` `## Rationale`(R3, bundle 에는 컨텍스트 예산으로 누락돼
있어 직접 파일을 열어 확인), `spec/conventions/redis-keys.md`(포인터-only 인벤토리 원칙), 그리고 이
target 문서 자신의 직전 3개 반려 라운드 산출물(`review/consistency/2026/08/13/15_45_53/
rationale_continuity.md`, `16_04_30/rationale_continuity.md` — 둘 다 실재 확인)을 대조했다. `git log
--all --oneline --grep="#945"` 로 PR #945 실재도 확인했다. 인용된 이력 중 지어낸 것은 발견되지 않았다.

## 발견사항

- **[INFO]** WS §4.4 "오너십 분리" 선례와의 관계 — "선례를 따른다"는 결론은 재확인됐으나, 그 결론을
  성립시키는 사실(WS 가 종결 이벤트에서 소유할 전용 필드가 없다)이 해당 절 안에서 명시적으로
  다시 연결되지 않음
  - target 위치: target `## Rationale` → "### WS §4.4 선례(PR #945)와의 관계 — 같은 원칙의 다른 얼굴"
    1번 항목("**이번 (B)가 하려는 것이 정확히 이것이다** — 선례에 반하는 게 아니라 그 원칙을 종결
    이벤트에 처음 적용하는 것이다")
  - 과거 결정 출처: `spec/5-system/6-websocket-protocol.md` `## Rationale` "§4.4 wire 필드 caveat"
    — "EIA §6.2 를 '전체 SoT' 로 격상하지 않은 이유는 그 blockquote 가 외부소비 필드만 다루는
    의도적 스코프이기 때문(WS 내부 관측 필드까지 외부 표면 문서에 싣지 않는다)". 즉 §4.4 선례는
    "한 문서를 전체 SoT 로 만드는 것"을 **채택하지 않고** 오너십을 분리한 사례다.
  - 상세: 이 항목은 직전 라운드(`16_04_30/rationale_continuity.md` WARNING 1)가 지적한 "인접
    선례(오너십 분리 vs 전체-SoT)를 구분하지 않는다"는 결함에 대한 응답으로 신설된 절이다. 새로
    추가된 "왜 caveat 이 아니라 rewrite 인가" 절은 축 2(caveat vs rewrite)는 충실히 해소하지만,
    축 1(오너십 분리를 유지할지 vs 한 문서로 전체 승격할지)에 대해서는 "이번 (B)가 하려는 것이
    정확히 이것이다"라고만 단언하고, 그 등치가 성립하는 근거("WS 는 waiting_for_input 과 달리
    종결 이벤트에서 소유할 전용 부가 필드가 없다 — 실측: `{executionId, ...payload, seq,
    timestamp}` 뿐")를 이 절 안에서 다시 진술하지 않는다. 그 사실 자체는 target 상단 "두 wire 는
    실제로 다르다" 절(L68-76)에 이미 있으나, `## Rationale` 절이 스스로 완결되지 않은 채 앞 절의
    사실을 암묵적으로 전제한다. 직전 라운드가 정확히 이 "완결된 서술"을 제안 문구로 제시했었다.
  - 왜 아직 남아있는 위험인가: 이 target 은 "인접 선례를 다루되 구분을 스스로 설명하지 않아
    재반려"된 패턴을 이미 3~4회 겪었다(§체크리스트). 이번엔 절 자체는 신설했으나 그 절의 핵심
    등치 주장이 반쪽만 자기완결적이라, 엄격한 리뷰어가 "왜 이번엔 오너십 분리가 아니라 전체
    승격을 택했는가"를 다시 물을 표면이 완전히 닫히지 않았다.
  - 제안: "### WS §4.4 선례와의 관계" 1번 항목에 한 문장 추가 — "§4.4 는 WS 가 `waitingNodeType`/
    `waitingNodeLabel`/`nodeExecutionId`/`startedAt` 이라는 자기 소유 필드를 가지므로 EIA 를 전체
    SoT 로 격상하지 않았다. 종결 이벤트는 (앞서 실측한 대로) WS 전용 부가 필드가 없으므로, 오너십
    분리는 나눌 대상이 없어 자연히 단일 SoT + 포인터로 수렴한다 — 이는 §4.4 원칙을 반증하는 게
    아니라 그 원칙이 이 케이스에서 도출하는 결과다."

- **[없음 — 검증됨]** 직전 라운드(`16_04_30`)의 WARNING("결정 (3) '코드 타입을 SoT 로'가
  `chat-channel-adapter.md` 자신의 R3 원칙과 충돌")은 이번 target 에서 명시적으로 정정돼 있다 —
  현재 target "### (3) 나머지는 포인터로" 첫 항목은 "SoT 는 EIA spec 이다"로 뒤집고 R3 원문
  ("구체 필드 갱신은 항상 EIA spec 우선")을 직접 인용하며, 정정 사실 자체를 "`16_04_30` convention
  WARNING 4. 정정한다"로 자기 문서 안에 기록했다. R3 인용문은 `spec/conventions/chat-channel-
  adapter.md` L527-529 원문("EIA spec §6 의 payload 가 SoT — 본 컨벤션은 union 만 정의. 두 spec
  간 type drift 회피. 구체 필드의 spec 갱신은 항상 EIA spec 우선.")과 정확히 일치해 지어낸 인용이
  아니다.

- **[없음 — 검증됨]** 직전 라운드(`15_45_53`)의 WARNING("§6.5 가 공유하는 `execution.ai_message` 의
  기존 '봉투 없음' 서술과 신규 `payload` 봉투 규칙이 같은 섹션에서 모순")은 이번 target 의
  "## 비목표" 절에서 "`execution.ai_message` 의 봉투 서술 — 종결 이벤트가 아니다. 후속으로 분리
  (`15_45_53` rationale WARNING 2)"로 명시적으로 범위 밖 처리됐다 — 모순 상태를 남기지 않고
  스코프를 좁혀 회피한 것으로, 반증 없는 임의 축소가 아니라 원 WARNING을 인용해 대응한 것이다.

- **[없음 — 검증됨]** 같은 라운드(`15_45_53`)의 다른 WARNING("§6.2 SSE caveat 매핑이 `payload`
  봉투 도입으로 stale 해질 위험")은 이번 target 의 실제 변경 범위(§6.3~§6.5, WS §4.1, chat-channel-
  adapter §1.2, 3-execution.md §8.1)에 §6.2 가 포함되지 않아 해당하지 않는다. target 은 이를
  "왜 (A) 가 아니라 (B) 인가" 절에서 "§6.2 SSE caveat 매핑 ... 은 아직 더 있다"고 스스로 미해결로
  명시해 완료를 참칭하지 않는다.

- **[없음 — 검증됨]** `finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId` 삭제 결정은 이 세션에서
  참조 가능한 다른 spec `## Rationale` 어디에도 이 4개 필드를 "유지해야 한다"고 못박은 선례가
  없다 — target 자신의 신규 결정이고 자체 Rationale("왜 '지킬 수 있는 약속'은 남기나")로 근거를
  제시하므로 무근거 번복(관점 3)에 해당하지 않는다.

## 요약

이번 target 은 직전 2개 라운드(`15_45_53`, `16_04_30`)가 남긴 Rationale 연속성 WARNING·INFO 를
거의 전부 흡수해 자기 문서 안에서 인용·정정했다 — chat-channel-adapter R3 인용 추가, WS §4.4
"오너십 분리" 선례와의 관계 절 신설, `execution.ai_message` 비목표 명시, §6.2 미해결 자기고지가
모두 이전 라운드의 정확한 제안과 대응한다. 명시적으로 기각된 대안을 이유 없이 재도입하거나 합의된
invariant(예: R19 `cancelledBy` 닫힌 union, R10 단일 sink, R13 표면별 코드 컨벤션)를 위반하는 지점은
발견되지 않았고, 인용된 모든 과거 결정 문구는 실제 spec 원문과 대조해 정확했다. 유일한 잔여 항목은
WS §4.4 선례와의 "관계" 절이 결론("이번이 그 원칙의 적용이다")은 진술하되 그 결론이 성립하는 핵심
근거(WS 가 종결 이벤트에서 소유할 전용 필드가 없다는 사실)를 같은 절 안에서 다시 연결하지 않는다는
완결성 공백으로, 이 문서가 이미 여러 차례 "인접 선례 설명 미완결"로 재반려된 패턴을 감안하면 짧은
문장 하나로 닫아두는 편이 다음 라운드의 재질문 리스크를 없앤다.

## 위험도

LOW
