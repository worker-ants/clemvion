# Plan 정합성 검토 — `spec-draft-setup-error-classification.md`

## 발견사항

- **[WARNING]** `chatChannelLastError` 원문 유출 후속이 "등재돼 있다" 고 주장하지만 실측상 어디에도 없다
  - target 위치: `## 안 하는 것` 셋째 불릿 — *"`chatChannelLastError` 에 외부 원문이 저장되는
    문제 — (3)과 같은 클래스지만 다른 표면(응답 vs DB 컬럼)이고 **별 항목으로 등재돼 있다**"*
  - 관련 plan: 없음 (`grep -rln "chatChannelLastError" plan/` 전체가 이 draft 자신
    (`spec-draft-setup-error-classification.md`) 한 건만 반환 — `plan/in-progress/**` ·
    `plan/complete/**` 어디에도 별도 트래커 항목이 없다)
  - 상세: 결정 (3)이 새로 세우는 원칙("응답에 provider 원문을 싣지 않는다" — §7.5.2·R-CCA-5
    와 동일 근거)이 이 draft 자신이 **같은 클래스**라고 명시한 사례(`chat-channel.dispatcher.ts:338`
    `markDegraded()`, `chat-channel-binder.service.ts:267` 가 각각
    `chatChannelLastError: message.slice(0, 1024)` 로 provider 원문을 DB 컬럼에 그대로 적재)를
    "별 항목으로 등재돼 있다" 는 이유로 스코프 밖으로 미룬다. 그러나 그 항목은 실재하지 않는다 —
    코드에도 추적용 주석/TODO 가 없고, `plan/` 전체에 해당 필드명을 언급하는 다른 파일이 없다.
    이 draft 가 `plan/complete/` 로 봉인되면 (3)이 세운 "원문-비저장" 원칙이 **자기 draft 안에서
    조차** 완결되지 않은 채, 그 사실을 아는 유일한 문서가 사라진다 — 다음 사람은 이 관찰을
    다시 하지 않는 한 이 gap 의 존재 자체를 모른다.
  - 제안: (a) 이 draft 의 체크리스트가 이미 `spec-draft-nullable-notation-followups.md` 를
    3건 정정하도록 편집을 예정해 뒀으므로, 그 정정 목록에 **4번째 항목**으로
    `chatChannelLastError` 원문 저장(§CCH-SE-01/§2.8 인접)을 **살아있는 트래커 항목으로 신설**
    등재하거나, (b) "안 하는 것" 문구를 *"별 항목으로 등재돼 있다"* (사실 주장)에서
    *"이 턴에서 새로 트래커에 등재한다"* (행동 서술)로 정정한다. 둘 중 하나 없이 현재 문구
    그대로 `complete/` 로 넘어가면 근거 없는 "이미 추적됨" 주장이 SoT 처럼 남는다.

- **[INFO]** `2-api-convention.md §6` 은 저장소 전역 카탈로그인데 502 마이그레이션은 chat-channel 로만 스코프됐다
  - target 위치: 결정 (4) — *"502 는 이 저장소가 한 번도 낸 적이 없는 상태 코드다"* +
    §6 신규 행 *"외부 제3자 API 호출 실패"*
  - 관련 plan: `plan/in-progress/cafe24-backlog-residual.md` 등 외부 provider 호출이 있는
    다른 plan 에는 502/외부 API 실패 상태코드 관련 언급이 전혀 없음(grep 0건)
  - 상세: §6 표는 chat-channel 전용이 아니라 API 전역 규약이므로, 이 행이 신설되면 "외부
    제3자 API 를 호출하다 실패하면 502" 라는 원칙이 원리상 cafe24·http-request 노드 등 다른
    외부 연동에도 적용 대상이 된다. draft 는 chat-channel 만 마이그레이션하고 다른 호출부의
    정합 여부는 언급하지 않는다. 다만 이 저장소는 `410`/`202` 신설 때도 즉시 전수 마이그레이션을
    요구하지 않은 선례(`ws-token-expired-socket-lifetime-impl.md`, 이미 완료)가 있어 이 자체가
    결함은 아니다 — 다음 사람이 "왜 cafe24 는 아직 500 인가" 를 묻지 않도록 참고용으로만 남긴다.
  - 제안: 별도 조치 불요. 조치한다면 트래커에 "타 provider 외부 API 실패 → 502 정합 검토"
    한 줄을 INFO 로 등재하는 정도로 충분.

## 요약

`spec-draft-setup-error-classification.md` 는 `--spec` 1·2회차 CRITICAL/WARNING 을 실측으로
반영했고, 인용하는 선행 결정(§7.5.2, R-CCA-5, `#1316`, `2-trigger-list.md` §2.3.1 해소 이력),
트래커 소유 worktree 부재 판정, `2-api-convention.md §6`·`swagger.md §2-4` 의 현재 결손 상태는
모두 실측으로 재확인되어 정합하다. 유일한 실질 결함은 "안 하는 것" 절에서 `chatChannelLastError`
원문 유출 이슈를 "별 항목으로 등재돼 있다" 고 사실처럼 서술하지만 `plan/` 전체에 그런 항목이
존재하지 않는다는 점이다 — 이 draft 가 세우는 "provider 원문 비저장" 원칙과 같은 클래스의 결함이
추적 없이 유실될 위험이 있다. 그 외에는 결정 충돌·선행 미해소·후속 누락이 발견되지 않았다.

## 위험도

LOW
