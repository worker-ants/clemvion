### 발견사항

- **[WARNING]** `error.code` null 흡수 확인이 체크리스트 밖 prose 로만 존재 — 유실 위험
  - target 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md` 변경 제안 (4)
    "**파급 2곳**" 블록 두 번째 불릿(`15-chat-channel.md R-CC-15`)
  - 관련 plan: 같은 target 문서 자신(체크리스트에 대응 항목 없음), 그리고
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(§R17 잔여 불릿처럼
    "열린 항목" 을 명시 추적하는 관례가 이미 있는 자리)
  - 상세: (4)는 "`code: null` 이 unknown-code fallback(`executionFailedInternal`)으로
    안전 흡수되는지 **확인 후** 필요하면 R-CC-15 addendum. **확인 전에는 (4)를 완료로 보지
    말 것**" 이라는 명시적 선결 조건을 걸어 두었다. 그런데 이 조건은 (4) 절 본문의 산문
    한 줄일 뿐, 문서 하단 `## 체크리스트`(`spec 반영 — 7항목`)에는 대응 불릿이 없고, 다른
    어떤 `plan/in-progress/**` 문서도 이 확인 작업을 추적하지 않는다(`grep -rn "R-CC-15"
    plan/in-progress/` → target 문서 1건뿐). 같은 문서의 "🔴 조사 중 발견 → 처분(실제 상태)"
    절은 성격이 같은 "닫기 전 확인" 항목(예: "이미 유출된 데이터에 대한 사후 대응 — 운영
    판단 필요")을 전부 독립 체크박스로 승격해 두었는데, 이 항목만 예외로 prose 에 묻혀
    있다 — 이 plan 문서 자체가 몇 라운드째 반복 지적해 온 "체크박스 drift"(`11_02_18`
    plan_coherence W2, `10_32_29` W3 등) 와 같은 유실 패턴이 이번엔 이 항목에서 재현될
    소지가 있다. planner 가 "spec 반영 7항목" 체크박스만 보고 (4)를 완료 처리하면 이
    확인이 누락된 채 넘어갈 수 있다.
    참고로 직접 확인해보니 `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts:105`
    가 `const code = event.error?.code ?? '';` 로 `null`/`undefined` 를 빈 문자열로 정규화하고
    있어, 어떤 코드 Set 에도 매치되지 않고 그대로 `executionFailedInternal` fallback(CCH-ERR-04
    unknown-code 경로)으로 안전 흡수된다 — 확인 자체는 이미 결론이 나 있는 저비용 작업이다.
  - 제안: target 문서 `## 체크리스트`(또는 (4) 절 말미)에 독립 불릿 하나를 추가해
    "`execution-failure-classifier.ts` 의 `?? ''` fallback 이 R-CC-15 unknown-code 안전
    흡수를 이미 만족함을 확인 — addendum 불요" 로 명시적으로 닫을 것. 산문 캐비엇만으로
    남기면 다음 라운드에서 같은 유실이 재발할 수 있다.

- **[INFO]** 변경 제안 (5) 의 제목·본문이 (4)가 위임한 확장 범위를 아직 반영하지 않음
  - target 위치: `plan/in-progress/spec-draft-eia-62-waiting-payload.md`
    "### (5) `1-data-model.md` §2.14 — `Execution.error` 구조에 nullable `nodeId`"
  - 관련 plan: 없음(같은 문서 내부 정합성) — 참고로 `plan/in-progress/eia-terminal-payload.md`
    의 "함께 넘기는 spec 항목" 표도 아직 `code` 를 nullable 로 표기하지 않은 상태(`{nodeId:
    "uuid"|null, code, message, details?}`)로 남아 있어 같은 축의 stale 이 두 문서에 걸쳐 있다.
  - 상세: (4) 절은 "**(5) 의 편집 범위에 포함** — `1-data-model.md §2.14` … `{nodeId:
    "uuid"|null, code: "ERROR_CODE"|null, message, details?}` 로 함께 고칠 것. `eia-terminal-payload.md`
    의 같은 행도 동시 정정" 이라고 (5)의 스코프를 사후에 확장했다. 그런데 (5)의 제목·본문
    자체는 여전히 "nullable `nodeId`" 만 언급하고 `code` 를 언급하지 않는다. (4)를 건너뛰고
    (5)만 읽은 실행자는 `code` nullable 반영을 놓칠 수 있다.
  - 제안: (5)의 제목/본문에 `code` nullable 도 명시해 단일 절만 읽어도 전체 스코프가 보이게
    할 것. 낮은 비용의 정합화라 이번 라운드에 같이 반영해도 무리 없다.

### 요약

target 문서는 이미 plan_coherence 관점에서 다수 라운드(07_44_12·09_38_17·10_32_29·11_02_18·
12_06_21·14_55_31·15_06_43)를 거치며 미해결 결정 충돌·선행 plan 미해소 이슈를 대부분
해소했다 — `eia-terminal-payload.md`(차단 해제 조건·행 동시정정 지시)·
`spec-draft-eia-notification-payload-contract.md`(반증 각주 `7fa12301c` 실제 반영 확인)·
`spec-sync-external-interaction-api-gaps.md`(§R17 잔여 불릿 보존 지시)·
`retry-turn-terminal-guard.md`(#2 cancelledBy 교차 인지) 등 관련 plan 전부와의 교차
참조가 실측 기준으로 살아 있고 stale 하지 않았다. 이번 라운드에서 새로 찾은 것은 CRITICAL
급 충돌이 아니라, (4)가 새로 건 "닫기 전 확인" 선결 조건 하나가 이 문서 자신의 체크리스트
관행(유사 항목은 독립 체크박스로 승격)에서 벗어나 prose 로만 남아 있다는 점과, 그 확장이
(5)의 본문에는 아직 미러되지 않았다는 점이다. 둘 다 이 문서 자체의 반복된 "체크박스 drift"
패턴의 재발 소지이며, 차단 사유는 아니다.

### 위험도
LOW
