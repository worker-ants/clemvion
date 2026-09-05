# Rationale 연속성 검토 — `spec-draft-notification-secret-storage.md`

## 발견사항

- **[CRITICAL]** `notification_secret_v2` 를 "미해결 이탈"로 재정의하는 target 결정이, 같은 컬럼을 이미 "해소·의도된 설계"로 정착시킨 두 개의 **살아있는** Rationale 을 인용도 갱신도 하지 않고 지나간다
  - target 위치: `plan/in-progress/spec-draft-notification-secret-storage.md` §② 결정("설계는 처음부터 ref 였고, notification 쪽 구현만 그 설계를 따르지 않았다" / "(b) 코드측 ref 화를 요구") 및 `## Rationale` → "기각한 대안 — (a) 예외 등재"
  - 과거 결정 출처:
    1. `spec/data-flow/15-external-interaction.md` `## Rationale` → **"§1.5 구현 갭 — 해소 이력 (C3 fix)"** (2026-06-10 결정) — "현행 동작은 §1.5 '승격 경로' note 가 SoT" 라고 명시. 그 note(§1.5 본문, L217-227)와 §2.1 표(L250)는 `trigger.notification_secret_v2` 를 **"(평문 컬럼)"** 이라고 그대로 못 박고 있다 — grace 24h 동안 평문 저장, 매시 cron 이 승격 시에만 ref 로 전환되는 것이 **설계 그 자체**로 기술돼 있다.
    2. `spec/5-system/15-chat-channel.md` `## Rationale` → **"R-K. `chat_channel_token_v2` 컬럼 명명의 semantic 비대칭"** — `notification_secret_v2` 를 "**HMAC signing secret 의 v2** (신규 secret 그 자체)", `chat_channel_token_v2` 를 "**외부 provider bot token reference 의 v2**" 로 명시 대비하며 "두 컬럼은 **의미상 직교**" 라고 결론짓는다. 즉 "왜 자매 컬럼끼리 ref 여부가 갈리는가" 라는 target 의 바로 그 질문에 이미 답이 나 있었다.
  - 상세: 코드 확인 결과도 이 두 문서와 정확히 일치한다 — 엔티티 JSDoc(`trigger.entity.ts` L97-105)은 `notificationSecretV2` 를 "24h grace 기간 동안 신규 secret" 이라고만 적고 "ref" 라는 단어를 쓰지 않는 반면, `chatChannelTokenV2` (L144-146)은 "secret store ref … plaintext 아님" 이라고 명시한다. `plan/complete/security-fixes-audit-guard-secret-rotation.md` (C3 의 원 계약서)를 보면 2026-06-10 에 실제로 고친 것은 **승격(promote) 단계가 legacy `config.signing.secret` 평문 키에 쓰던 버그**였고, 회전(rotate) 시점에 `notification_secret_v2` 컬럼 자체에 평문을 쓰는 부분은 애초에 손대는 범위가 아니었다 — 즉 "평문 rotate → 24h 후 ref 로 승격"은 그 PR 로 **의도적으로 그대로 남겨진** 현재 진행형 설계다.
    target 의 §① 실측("쓰는 쪽이 SecretResolver 미경유")은 사실관계로는 맞다. 그러나 §②의 결론("**알려진 이탈**" — 즉 언젠가 코드가 고쳐져야 할 버그)은 이미 위 두 Rationale 이 내린 "**이건 자매 컬럼과 의미가 다른, 그 자체로 완결된 설계**" 라는 판정을 소리 없이 뒤집는다. target 은 `secret-store.md §1` 의 "선례 남용 금지" 경고는 정확히 인용하면서(이 부분은 근거가 견고하다), 정작 **notification_secret_v2 자신에 대해 이미 내려진 판정**은 검색조차 하지 않았다 — `spec_impact` 목록에 두 문서 모두 없다.
    이것이 왜 "결정 번복" 인지: target 이 (b)를 실행해 코드가 언젠가 항상 ref 만 보관하도록 바뀌면, `data-flow/15-external-interaction.md` 의 "현행 동작은 §1.5 '승격 경로' note 가 SoT" 라는 서술과 R-K 의 "두 컬럼은 의미상 직교" 라는 결론이 **둘 다 거짓**이 된다. 그런데 target 은 이 두 파일을 갱신 대상에 넣지 않았으므로, 병합되는 순간 EIA §7.1(정정본, "알려진 이탈")·data-flow §1.5("해소됨, 평문은 설계")·chat-channel R-K("의도된 비대칭") 세 문서가 **서로 다른 이야기**를 하는 상태가 만들어진다 — target 이 고치려던 "spec 간 불일치" 문제를 다른 자리에 새로 만드는 셈이다.
  - 제안: 두 가지 중 하나를 택하고 그 선택을 Rationale 에 명시해야 한다.
    - **(i) target 의 (b) 방향을 유지**한다면 — `data-flow/15-external-interaction.md §1.5`(rotate 단계 서술 + "구현 갭 해소 이력" 항)와 `chat-channel.md R-K`(비대칭이 "의도"가 아니라 "잔존 이탈"이었다는 재평가)를 **함께 갱신**하고, C3 가 "일부만 해소" 했다는 사실과 남은 부분(rotate 시점 평문 저장)을 새 후속 항목으로 명문화한다. `spec_impact` 에도 두 파일을 추가한다.
    - **(ii) 두 문서의 기존 판정(평문-그레이스는 의도된 설계)을 존중**한다면 — target §②의 "알려진 이탈" 프레이밍을 접고, EIA §7.1 을 data-flow §1.5 와 **정합**하도록("24h grace 동안 평문, 승격 후 ref — 자매 컬럼과 의도적으로 다른 패턴, 근거는 R-K") 고쳐 쓴다. 이 경우 secret-store.md §1 예외 목록에 `notification-signing.v2` 를 **grace window 한정** 예외로 등재하는 (a) 안이 오히려 근거를 갖게 된다 — 다만 이는 target 이 "기각한 대안" 으로 이미 표시한 안이므로, 택할 경우 그 기각 사유를 재검토해야 한다.
    - 어느 쪽이든, 지금 상태(두 문서를 인용하지 않고 침묵)로 병합하면 세 문서가 서로 다른 사실을 주장하는 상태가 고착된다.

- **[WARNING]** `spec_impact` frontmatter 가 이번 결정이 실질적으로 건드리는 문서 2건을 누락
  - target 위치: frontmatter `spec_impact:` (L29-33)
  - 과거 결정 출처: 위 CRITICAL 항목과 동일 — `spec/data-flow/15-external-interaction.md`, `spec/5-system/15-chat-channel.md`
  - 상세: 위 CRITICAL 이 해소되면(어느 방향이든) 두 파일 중 최소 하나는 반드시 갱신돼야 하는데, 현재 `spec_impact` 목록은 `14-external-interaction-api.md` / `secret-store.md` / `2-api-convention.md` / `4-integration.md` 4건뿐이다. `--impl-done` 게이트가 diff-scope 로 spec-linked 파일을 판정하는 저장소 관례([`.claude/docs/plan-lifecycle.md §6.2`] 계열)상, 미등재 파일은 향후 감사에서 "터치 안 된 파일" 로 오인되어 이 CRITICAL 이 조용히 묻힐 위험이 있다.
  - 제안: CRITICAL 해소안 확정 후 `spec_impact` 에 두 파일을 추가.

- **[INFO]** `chat-channel.md` R-K 는 secret-store 전환(#264, 2026-05-22) **하루 전**(2026-05-21) 작성돼 본문이 "ref 전환 이후의 현실"을 아직 모르는 상태로 남아 있다
  - target 위치: 없음(target 이 다루지 않음) — 참고용
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `## Rationale` R-K, 최초 도입 커밋 `534158722`(2026-05-21) / 제목의 날짜 접미사만 이후 제거(본문 미변경, `git log -p -S` 확인)
  - 상세: R-K 작성 시점엔 `chat_channel_token_v2` 도 아직 "ref 만 보관"으로 확정되기 전이었다(그 확정은 다음날 #264). 즉 R-K 의 "의미상 직교" 결론은 두 컬럼이 **둘 다 아직 덜 정리된 상태**에서 내려졌고, #264 이후 `chat_channel_token_v2` 만 ref 로 굳어지면서 R-K 문구는 그 변화를 반영하지 않은 채 남았다. 이는 위 CRITICAL 의 근본 원인 중 하나 — R-K 가 최신 상태로 재검토됐다면 이번 target 논의가 "처음 발견한 사실"이 아니라 "R-K 갱신 누락의 연장"으로 프레이밍됐을 것이다.
  - 제안: CRITICAL 해소 작업에서 R-K 본문도 함께 재검토 대상에 포함.

- **[INFO]** W2(`2-api-convention.md` frontmatter) / W3(`4-integration.md` §9.1) 수정안 자체는 기존 Rationale 과 충돌 없음 — 확인 완료
  - target 위치: `## ③ 변경안` → `spec/5-system/2-api-convention.md` (W2), `spec/2-navigation/4-integration.md` (W3)
  - 상세: (1) W2 — 직전 커밋 `21182db02`(§5.4 검증자 양쪽 등재) 확인 결과, `swagger.md` frontmatter 는 이미 `swagger-dto-contract*.ts` 를 포함하지만 `2-api-convention.md` frontmatter 는 누락(§5.4 "검증 층" 표 본문엔 이미 인용되어 있음) — target 의 "그 원칙을 세운 문서가 자기 짝을 빠뜨렸다" 서술은 실측과 일치, 기존 원칙을 완성하는 보완이지 번복이 아니다. (2) W3 — `secret-store.md §1` 의 "이 블록을 선례로 인용하면 안 된다"는 경고를 target 이 정확히 인용해 (a) 안을 기각한 근거로 쓴 것도 원문과 정확히 일치(자구 단위로 대조 완료). 두 항목 모두 Rationale 연속성 문제 없음.

## 요약

target 의 핵심 실측("primary 는 SecretResolver 경유, secondary(`notification_secret_v2`)는 평문 직접 사용")과, `secret-store.md §1` 의 "예외 선례 남용 금지" 경고를 근거로 (a) 안(규약에 세 번째 예외 등재)을 기각한 논리는 자구 단위로 검증했을 때 견고하다. 그러나 그 위에 세운 결론 — "설계는 처음부터 ref, 지금 구현만 이탈했다" — 은 사실 절반만 맞다. `spec/data-flow/15-external-interaction.md` 의 "§1.5 구현 갭 — 해소 이력 (C3 fix)" Rationale(2026-06-10)과 `spec/5-system/15-chat-channel.md` 의 R-K Rationale은, 정확히 이 컬럼(`notification_secret_v2`)에 대해 "24h grace 동안은 평문, 승격 후에만 ref" 를 이미 **설계·해소된 상태**로 기술하고 있고, 코드·엔티티 JSDoc 도 그 서술과 일치한다. target 은 이 두 문서를 인용도 검색도 하지 않은 채 `spec_impact` 에서도 빠뜨렸다 — 그 결과 target 의 결정이 실행되면 EIA §7.1(정정본)·data-flow §1.5·chat-channel R-K 세 문서가 이 컬럼의 "정상 상태가 무엇인가"에 대해 서로 다른 주장을 하는 상태가 새로 생긴다. 이는 target 이 애초에 해소하려던 "spec 간 불일치" 문제를 다른 세 파일 사이로 옮겨 놓는 것과 같다. W2/W3 두 부수 항목은 기존 Rationale 과 충돌 없이 정합하다.

## 위험도
CRITICAL
