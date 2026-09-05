# Rationale 연속성 검토 — `spec-draft-notification-secret-storage.md` (2차 라운드)

## 배경 — 실측 확인

이 target 은 `review/consistency/2026/09/05/19_40_29/rationale_continuity.md` 가 낸 **CRITICAL**
("살아있는 두 Rationale 을 인용·갱신 없이 뒤집는다")을 자기 진단 반증으로 뒤집은 2차 draft다.
아래는 그 반증과 실제 커밋(`790487f34`)이 서로 일치하는지 파일시스템에서 직접 대조한 결과다.

- `spec/5-system/15-chat-channel.md` **R-K**(L640-642): "`notification_secret_v2` 는 HMAC signing
  secret 의 v2, `chat_channel_token_v2` 는 bot token reference 의 v2 … 두 컬럼은 **의미상 직교**"
  — target 의 인용과 원문이 자구 단위로 일치.
- `spec/data-flow/15-external-interaction.md` §1.5(L215-233) + "§1.5 구현 갭 — 해소 이력(C3 fix)"
  (L359-364): "승격은 `secrets.rotate(canonical ref, v2)` 로 store 내용을 교체" / "현행 동작은
  §1.5 '승격 경로' note 가 SoT" — target 의 §1.5 인용과 일치. C3 가 해소한 것은 **승격 단계**의
  legacy 키 버그뿐이고, **회전(rotate) 시점의 평문 컬럼 저장 자체는 처음부터 의도된 설계**였다는
  target 의 재구성이 §1.5 원문과 정확히 부합한다.
- `spec/conventions/secret-store.md` §1: 실제로 세 번째 비대상 예외("`Trigger.notification_secret_v2`
  (결정 2026-09-05)")가 등재돼 있고, `itk_*` 문단의 (a)~(c) 를 인용하지 않은 채 4개의 독립 근거
  (경유지/노출창/1회노출/primary 불변)로 자립해 있다. `notification-signing.v2` ref 행에도 "현행
  구현은 이 ref 를 쓰지 않는다" 가 실제로 명기됐다.
- `spec/5-system/14-external-interaction-api.md` §7.1: "정정 이력(2026-09-05)" 블록이 실제로
  존재하며, 이전 거짓 문장("ref 만 보관")을 취소선 없이 후속 문단으로 대체하고 R-K·§1.5·secret-store
  §1 세 곳에 상호 링크한다. `EIA-NX-12`("rotate 응답 1회 평문")와의 혼동 방지 문장도 실제로 있다.
- `spec/5-system/2-api-convention.md` frontmatter: `swagger-dto-contract*.ts` 가 실제로
  `code:` 목록에 추가됨(W2 반영 확인).
- `plan/in-progress/spec-draft-notification-secret-storage.md` frontmatter `spec_impact`:
  `chat-channel.md`·`data-flow/15-external-interaction.md` 두 파일이 실제로 추가돼 있음(W1 반영
  확인) — 두 문서는 **갱신은 안 하되 등재는 한다**는 선택과 일치.

## 발견사항

없음 — 이번 라운드에서 새로 도입된 Rationale 연속성 위반을 찾지 못했다.

이전 라운드의 CRITICAL 은 "설계는 처음부터 ref, 구현만 이탈했다"(→ 코드측 ref화 요구, 두 살아있는
Rationale 을 침묵 속에 뒤집는 안)를 겨냥한 것이었다. 이번 target 은 그 결론을 스스로 반증하고
정반대 결론("§7.1 문장 하나만 이탈, 코드는 두 Rationale 대로 옳다")으로 갈아탔다. 이 번복 자체는
③번 점검 관점("결정의 무근거 번복")이 요구하는 조건 — **번복 시 새 Rationale 동반** — 을 충족한다:
target 의 `## Rationale`은 "기각한 대안 — (b) 코드측 ref 화 요구"를 R-K·§1.5 원문 인용으로 근거
세우고, "이 기각은 위험 인수가 아니라 이탈 부재 판정" 이라 성격까지 명시해 향후 재검토 조건("R-K 를
다시 여는 별도 결정")을 열어 둔다. `itk_*` 문단 재사용 금지 경고(secret-store §1 Overview 의 "각각
자기 근거를 갖는다")도 실제로 지켜 새 예외를 4개 독립 근거로 세웠다.

이전 라운드의 WARNING("`spec_impact` 누락")도 실측대로 해소됐다(위 배경 참조).

이전 라운드의 INFO(R-K 가 secret-store 전환 하루 전 작성돼 낡았을 가능성)에 대해 target 은 INFO#4 로
확인 후 "R-K 본문은 유효 — semantic 직교 판정(무엇의 v2 인가)은 전환 시점(저장 정책)과 무관"이라
답했다. 이 구분(semantic vs storage policy)은 target 자신이 §②에서 이미 세운 축("R-K 는 semantic 을
결정했지 저장 정책을 등재한 것이 아니다")과 일관되며, 독립 결함이 아니라 같은 근거의 재적용이다.

- **[INFO]** R-K/§1.5 → 신규 secret-store 예외로의 **역방향** 상호 링크 부재
  - target 위치: 없음(target 이 다루지 않은 사소한 잔여)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` R-K, `spec/data-flow/15-external-interaction.md`
    "§1.5 구현 갭 — 해소 이력"
  - 상세: `EIA §7.1` → R-K·§1.5·secret-store §1 로 가는 링크는 이번에 갖춰졌으나, 반대 방향(R-K 본문
    또는 §1.5 "해소 이력" 문단에서 secret-store §1 의 신규 비대상 예외로 가는 링크)은 없다. target 이
    "두 문서는 갱신하지 않는다"를 명시적으로 택했으므로(§②·`--spec 반영` 표 결정) 이는 의도된 범위
    밖이지 결함은 아니다 — 다음 사람이 R-K 를 먼저 읽고 secret-store 의 저장 정책 예외를 못 찾을
    수 있다는 navigability 관점의 참고 사항일 뿐이다.
  - 제안: 강제 아님. 후속 소정정 시 R-K 말미 또는 §1.5 "해소 이력" 문단에 secret-store.md §1 앵커
    한 줄 추가를 고려할 수 있다.

## 요약

target 의 1차 진단("설계는 ref, 구현만 이탈")은 R-K·§1.5 두 살아있는 Rationale 을 인용 없이 뒤집는
실제 CRITICAL 이었으나, target 은 그 두 문서를 직접 읽고 자기 진단을 반증한 뒤 정반대 결론으로
갈아탔다. 파일시스템 실측으로 대조한 결과 이 2차 결론(§7.1 한 문장만 오류, 코드·R-K·§1.5 는 처음부터
정합)은 세 문서 원문과 정확히 일치하고, 실제 커밋도 그 결론대로 §7.1 정정 + secret-store §1 신규
예외 등재(4개 독립 근거, `itk_*` 재사용 금지 경고 준수) + `spec_impact` 보정만 반영했을 뿐 R-K·§1.5
자체는 건드리지 않았다 — target 이 스스로 선택한 (ii) 안과 정확히 일치한다. 새로 도입된 Rationale
연속성 위반은 없다.

## 위험도
NONE
