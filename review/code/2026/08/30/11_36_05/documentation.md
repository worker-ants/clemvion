# 문서화(Documentation) Review

## 발견사항

- **[WARNING]** 완료로 옮기는 바로 그 항목에서, 인접해 고친 링크 옆에 "재측정으로 이미 틀렸다고 판정된" 옛 수치가 그대로 남았다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1389` (diff 컨텍스트 줄, 게이트 1389)
  - 상세: 이 PR 이 같은 리스트 항목의 바로 위 줄(1385~1387)을 고쳐 `ws-event-types-extract` 완료 링크를
    `../complete/ws-event-types-extract.md` 로 갱신했다. 그런데 그 바로 아래(1389)에 남아 있는
    "타입만 가져가던 곳 **0**" 이라는 문장은, 이 PR 이 함께 완료 처리하는
    `plan/complete/ws-event-types-extract.md:82` 에서 스스로 취소선으로 무효화한 수치다 —
    `~~타입만 가져가는 곳 0~~ → 이 숫자가 틀렸다. TS 파서 전수(1,230 파일) 재측정 결과 1곳이며,
    그건 re-export facade 를 검증하는 websocket.service.spec.ts 라 의도된 커버리지다.`
    (`websocket.service.spec.ts` 는 바로 이 PR 이 file 1 에서 커버리지를 채운 그 파일이다.)
    같은 PR 안에서 두 plan 문서가 같은 수치에 대해 서로 다른 값(0 vs 1)을 주장하는 상태가 된다.
  - 제안: 1389번 줄도 함께 정정하거나(예: "타입만 가져가던 곳 0 → 재측정 1(의도된 facade 예외,
    상세는 `ws-event-types-extract.md` 참고)"), 최소한 정정된 문서로의 포인터를 단다.

- **[WARNING]** `complete/` 로 확정 이동한 문서에, 이미 이 커밋에서 해소된 조건을 "아직 안 됐다"는
  현재형으로 서술하는 문장이 정리되지 않고 남았다
  - 위치: `plan/complete/ws-event-types-extract.md:409-411` (새 파일, 게이트 409~411 — 체크리스트 항목
    `plan/complete/ 이동 시 spec_impact 갱신` 의 말미)
  - 상세: 해당 체크박스 항목은 `>` 인용으로 여러 차례의 상태 갱신(①②③, `### 2026-08-29`,
    `### ✅ planner 턴 진행 (2026-08-30)`)을 누적해 왔고, 각 갱신은 이전 서술을 취소선/명시
    "완료"로 갱신해 왔다. 그런데 그 블록 맨 끝(인용 밖, 들여쓰기만 유지)에 다음 원문이 그대로
    남아 있다: *"frontmatter 가 `none` 인데 실제로는 … 완료 이동 시점에 실제 변경 파일 목록으로
    갱신해야 Gate C 를 통과한다."* 이 문장은 frontmatter 가 아직 `none`이라는 전제로 쓰여
    있는데, 바로 이 파일(`plan/complete/ws-event-types-extract.md`)의 frontmatter 는 이미
    `spec_impact:` 7개 파일 목록으로 갱신되어 있다(diff 1~15줄). 즉 이 문장이 요구하는 조치는
    같은 커밋에서 이미 실행됐는데, 문장 자체는 그 사실을 반영하지 않은 채 "아직 지켜야 할 미래
    지침"처럼 읽힌다. 같은 항목의 다른 갱신들은 전부 `~~취소선~~` 이나 "✅ 완료" 로 명시했는데
    이 문장만 그 처리를 안 받았다.
  - 제안: 이 문장 앞에 짧은 "✅ 완료 — frontmatter 는 위 7개 목록으로 갱신됐다(2026-08-30)"
    한 줄을 붙이거나, 문장을 과거형으로 바꾼다.

- **[INFO]** (diff 밖, 사전 존재 서술 — 참고용) `egress-masking.md` 캐비엇의 "유지" 판정이
  같은 PR 의 다른 커밋으로 이미 뒤집혔는데 동기화되지 않았다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:376` (이번 diff 의 게이트에는
    없음 — `Read`/`Grep` 으로 실제 파일을 직접 열어 확인한 실제 줄 번호)
  - 상세: 이 줄은 2026-08-24 시점에 "`egress-masking.md` 의 `ws-event-types-extract.md` 관련
    미해결 캐비엇은 **유지**(`13_30_49` plan INFO 4)" 라고 적어 뒀다. 그런데 이번 리뷰 대상
    changeset 의 앞선 커밋(`98563ef0a`, `plan/complete/spec-draft-followups-drain-2026-08-30.md`
    §3 이 기술하는 바로 그 작업)이 `spec/conventions/egress-masking.md` 에서 그 캐비엇 문단을
    통째로 걷어냈다(실측: 현재 `spec/conventions/egress-masking.md` 에서
    `ws-event-types-extract` grep 0건). 즉 "유지" 판정의 전제가 이미 무너졌는데 그 줄은
    갱신되지 않았다. 이 diff 의 파일 목록(file 5)에는 포함되지 않은 줄이라 이번 PR 의 결함은
    아니지만, 같은 changeset 이 원인 제공자이므로 후속으로 남겨둔다.
  - 제안: 다음에 이 트래커 파일을 여는 사람이 §3(캐비엇 회수) 처분과 함께 이 줄도 정리하도록
    plan 안에 표시(취소선 등)를 남긴다.

## 확인했지만 결함이 아닌 것 (오탐 방지용 기록)

- `plan/complete/spec-draft-egress-masking-convention.md:118,138` 의
  `[`ws-event-types-extract.md`](../in-progress/ws-event-types-extract.md)` 링크 2건은 이번 PR 이
  `ws-event-types-extract.md` 를 `in-progress/` → `complete/` 로 옮기면서 DEAD 가 된다(대상 파일이
  더 이상 그 경로에 없음, 실측 확인). 처음엔 결함으로 보였으나, `spec-links.ts` 의
  `findBrokenPlanLinks()` 자체가 "`plan/complete/**` 는 의도적으로 스캔 범위에서 제외한다 —
  `plan-lifecycle.md §3` 이 point-in-time 기록은 옛 경로를 유지하도록 정하고 있어, 거기서 깨진
  링크는 **문서화된 정상 상태**다" 라고 명시한다(주석 원문: *"the broken links there are the
  documented-normal state"*). `plan/complete/ws-event-types-extract.md:378` 도 같은 근거
  ("`plan/complete/**` 4건은 시점 기록이라 옛 경로 유지가 규약이다")를 스스로 적고 있어, plan
  문서·CI 가드 주석·이 저장소 관례가 삼중으로 일치한다. **결함 아님 — 오탐 방지를 위해 기록만
  남긴다.**
- `codebase/backend/src/modules/websocket/websocket.service.spec.ts` 에 추가된 JSDoc
  (게이트 1449~1461)과 `describe('re-export facade', …)` 블록(게이트 1462~1470)은 실제 코드와
  대조해 정확했다 — `InAppNotificationEventType` 이 facade(`./websocket.service`)에서만
  import 되고 이 한 테스트에서만 소비된다는 주장(grep 확인), `websocket-events.types.spec.ts`
  가 `WebsocketService` re-export 를 "유일한 예외"로 문서화하고 이 facade 테스트의 존재 자체를
  캐너리로 검증한다는 주장(해당 파일 65·389줄 확인) 모두 실측과 일치한다. 인라인 주석
  (게이트 1464~1465)도 정확하다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1948-2018` (§R8 statusCode,
  §4 Redis 각주 두 항목)은 file 2 §5 가 요구한 "체크박스 동기화"가 실제로 반영되어 있음을
  확인했다(둘 다 `[x]` + "완료 (2026-08-30, planner 턴 spec-followups-drain)" 처분 문구 존재).
  이번 diff 의 file 5 hunk 에는 안 보이지만(다른 커밋에서 처리) 디스크 상 정합성은 맞다.
- CHANGELOG 미갱신은 결함이 아니다 — 순수 테스트 추가(행동 변화 0)이고, 이 판단의 근거 자체는
  이미 `plan/complete/ws-event-types-extract.md` 말미에 기록되어 있다.
- README·API 문서·신규 설정값 문서화는 해당 없음(신규 기능·엔드포인트·env var 없음).

## 요약

핵심 코드 변경(`websocket.service.spec.ts` 의 facade 재수출 테스트 1건)은 JSDoc·인라인 주석
모두 실측과 정확히 일치해 문서화 품질이 좋다. 반면 plan 문서 4건의 `in-progress` → `complete`
정리 과정에서, 같은 PR 이 "이 수치는 틀렸다"고 스스로 정정한 문서(`ws-event-types-extract.md`)와
그 정정을 반영하지 않은 자매 문서(`spec-sync-external-interaction-api-gaps.md`) 사이에 수치
불일치가 남았고, `complete/` 로 봉인되는 문서 자체에도 이미 완료된 조치를 "미완"처럼 서술하는
잔여 문장이 정리되지 않은 채 남았다. 둘 다 기능·CI 게이트에 영향은 없고 plan 문서 내부의
사후 정합성 문제이지만, 바로 "문서 정확성을 바로잡는" 것이 이 PR 의 목적이라는 점에서 지적할
가치가 있다. 반대로, 처음에는 결함으로 보였던 `plan/complete/**` 문서의 dead link(2건)는
저장소의 명시된 관례(및 CI 가드 코드 주석)와 정확히 일치하는 의도된 상태로 확인되어 오탐을
피했다.

## 위험도

LOW
