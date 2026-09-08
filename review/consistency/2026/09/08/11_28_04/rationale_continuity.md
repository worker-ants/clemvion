# Rationale 연속성 검토 — `spec-draft-followups-batch-a.md`

## 방법

target 의 6개 항목(A-1~A-6)이 인용하는 과거 `## Rationale` 항목을 프롬프트 번들과 실제 spec
파일(`git`/`grep`/`sed`)로 직접 대조했다. 특히 truncated 처리된 `14-external-interaction-api.md`·
`15-chat-channel.md`·`spec/conventions/secret-store.md`·`spec/conventions/swagger.md` 는 번들에
없어 리포지토리에서 직접 열어 확인했다.

## 발견사항

- **[INFO]** A-1 — 신설 규칙이 역사적 관행과 반대임을 target 스스로 인정하고 있으나, `CLAUDE.md`/
  `SKILL.md` 는 `## Rationale` 섹션이 없는 거버넌스 문서라 이 규칙을 뒷받침할 근거가 흩어진 산문
  (본문 "왜 거버넌스 문서는 planner 로 가르나")으로만 남는다.
  - target 위치: `plan/in-progress/spec-draft-followups-batch-a.md` A-1 "왜 '거버넌스 문서는
    planner' 로 가르나" 절
  - 과거 결정 출처: 없음(target 이 명시하듯 `a36395f5c`·`fed994b6b` 두 `fix(harness)` 커밋이
    실제로 `.claude/docs/**` 를 코드·테스트와 함께 고쳤음을 `git show --stat` 로 확인 — 즉
    **선례는 이 신설 규칙과 반대 방향**이다)
  - 상세: target 은 이 사실을 숨기지 않고 "이력이 그 경계를 지지하지 않는다 … 신설 규칙" 이라고
    명시한다. Rationale 연속성 관점에서 가장 위험한 패턴(거짓 선례 소급 부여)은 피했다. 다만
    이 신설 경계를 강제할 게이트가 없다는 점도 target 이 자인한다("harness 변경은 리뷰 게이트가
    물지 않는다") — 관례가 계속 선례와 반대로 흐르면 이 신설 규칙 자체가 다음 라운드에 다시
    "선언 vs 관례" 불일치로 재등장할 소지가 있다.
  - 제안: 현행 처리(사실을 숨기지 않고 명시)로 충분하나, 후속 PR 에서 harness 커밋이 다시
    `.claude/docs/**` 를 함께 건드리면 이번 신설 규칙을 되돌릴지 강제할지 재확인이 필요하다는
    점을 plan 체크리스트에 한 줄 남겨두면 다음 세션이 판단 근거를 잃지 않는다.

- **[INFO]** A-2-1 — R-2 "폐기" 처리 자체는 방법론적으로 건전하다(원문 취소선 보존 + R-14 로의
  대체를 명시 + `15-chat-channel.md` R-CC-10 인용 앵커까지 동반 갱신). 다만 target 이 스스로
  지적하듯 앵커 slug 변경(`#r-2-…` → `#r-2-…-폐기`)이 성공적으로 적용됐는지는 이 검토 시점엔
  아직 코드에 반영되지 않은 draft 상태라 사후 검증이 필요하다.
  - target 위치: A-2-1 변경안 블록 + "앵커가 바뀐다" 경고문
  - 과거 결정 출처: `2-trigger-list.md` R-2(§2.3.1 hmacSecret) · R-14(authConfigId v1) ·
    `15-chat-channel.md` R-CC-10
  - 상세: 실측 확인 결과 인입 링크는 `15-chat-channel.md:610` 1건뿐이라는 target 의 `grep` 결과가
    현재 저장소 상태와 일치한다(직접 재확인함). R-2 의 TBD 세 항목(응답 shape·grace 기간·경로
    세그먼트)이 실제로 "결정할 대상이 없어졌다"는 target 의 판단도, §3 하단 blockquote(*"과거
    v1.1 예약 행 … 은 신설되지 않은 채 폐기됐다"*, 실측 확인함)와 정합한다. Rationale 을 뒤집는
    것이 아니라 이미 다른 Rationale(R-14)에 의해 사실상 대체된 상태를 문서에 반영하는 것이므로
    "무근거 번복"에 해당하지 않는다.
  - 제안: 적용 후 `--impl-done` 또는 링크 무결성 가드로 앵커 재확인 1회 권장(target 체크리스트에
    이미 포함되어 있음 — 추가 조치 불요).

- **[INFO]** A-5 — `select: false` 기각 논거와 `Notification.background_run_id` 반례 배치는
  기존 Rationale 패턴(과잉 일반화 방지 캐비엇을 같은 문단에 명시)과 일치하며, 사실 검증 결과도
  모두 정확했다(`user.entity.ts` 에 `select:false`·`@Exclude()` 0건, `notification.entity.ts`
  `background_run_id` 는 `select:false`+WHERE-only 소비, `triggers.service.ts` 의
  `notificationSecretV2` 는 값을 직접 읽음). SoT 배치(`1-data-model.md §2.1` 에 규범 신설,
  `secret-store.md §1.1` 은 상호참조만)도 기존 AuthConfig 마스킹 정책의 SoT 분배 방식
  (`1-data-model.md §2.17.2` 이 소유, `secret-store.md`·`6-config.md` 는 참조만)과 동형이라
  구조적으로 선례를 따른다 — Rationale 위반 소지가 없다.
  - target 위치: A-5 변경안 (a)(b)(c)
  - 과거 결정 출처: `1-data-model.md §2.17.2`(AuthConfig 마스킹 SoT 배치 선례), `secret-store.md
    §1.1`(응답 경계 금지 규범, 2026-09-05 신설)
  - 상세: 별도 조치 불필요. 참고로 남긴다.

- **[INFO]** A-6 — "노출 창이 아직 닫혀 있지 않다" 두 자리를 "정정 이력" 콜아웃으로 덮어쓰는
  방식은 같은 파일(`14-external-interaction-api.md §7.1`)이 이미 쓰고 있는 append-only 정정
  패턴(2026-09-05 이력)을 그대로 재사용한다. 실측(`TRIGGER_RESPONSE_STRIP_COLUMNS` 존재, 186행
  스트립 루프)도 직접 확인해 정확했다. 규범(§1.1) 자체는 건드리지 않는다고 명시해 invariant 를
  보존한다 — 이 항목은 Rationale 을 번복하는 것이 아니라 사실 진술을 최신화하는 것이다.
  - target 위치: A-6 전체
  - 과거 결정 출처: `secret-store.md §1`(69~78행, 실측 확인) · `14-external-interaction-api.md
    §7.1`(934~936행, 실측 확인)
  - 상세: 문제 없음. 참고로 남긴다.

CRITICAL/WARNING 등급에 해당하는 항목은 발견하지 못했다 — target 이 인용하는 모든 "과거 결정"은
실제 spec 본문·git 이력과 대조해 정확했고, 결정을 뒤집는 자리(A-2-1, A-6)는 예외 없이 새 근거를
명시하거나 이미 존재하는 대체 Rationale(R-14, `#1291`)을 인용하며, 규범 자체(§1.1 금지)는
어디서도 우회되지 않는다.

## 요약

target 문서는 Rationale 연속성 관점에서 이례적으로 방어적이다 — 인용하는 모든 과거 Rationale
항목(R-2/R-14/R-CC-10/§7.1/§1.1/AuthConfig 마스킹 SoT 배치 등)을 실제 spec 본문과 대조한 결과
전부 정확했고, 결정을 뒤집거나 폐기 표시하는 자리(A-2-1, A-2-2, A-6)마다 원문을 취소선으로
보존하며 새 근거 또는 기존 대체 Rationale 을 명시적으로 인용해 "무근거 번복"을 피했다. 유일하게
소급 근거가 없는 것은 A-1 의 거버넌스 문서 소유권 분리 규칙인데, target 은 이것이 신규 규칙이며
기존 관행(두 커밋의 `.claude/docs/**` 동시 수정)과 반대 방향임을 스스로 명시해 은폐하지 않았다 —
이는 Rationale 연속성이 요구하는 최소 기준(허구의 선례를 지어내지 않음)을 충족한다.

## 위험도

LOW
