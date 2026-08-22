# 아키텍처(Architecture) 리뷰 — egress 마스킹 좌표계 conventions 승격

## 스코프 확인

본 PR 은 **소스 코드 변경이 없다**. 24개 대상 파일 전부가 `plan/**`(작업 추적)·
`review/consistency/**`(consistency-check 세션 산출물, `_retry_state.json`/`meta.json`/
checker 리포트)·`spec/**`(신설 conventions 1개 + 기존 3개 spec 문서에 3~4줄 포인터 추가)다.
즉 이번 변경은 이미 구현되어 있는 egress 마스킹 불변식(4개 backend/frontend 파일, PR
#1188~#1193 에서 정착)을 **문서 레이어로 승격**하는 작업이지, 런타임 코드의 모듈 구조를
바꾸는 작업이 아니다. 따라서 SOLID·순환 의존성·레이어 책임 같은 관점은 "소프트웨어 모듈"이
아니라 **spec 문서 간의 소유권(SoT) 경계와 상호 참조 그래프**에 대해 적용했다.

이 PR 은 이미 `/consistency-check --spec` 2라운드(`18_14_45` BLOCK:YES → 정정 →
`18_27_11` BLOCK:NO)를 거쳤고, 그 라운드에서 나온 WARNING 3건(코드 `1`↔`10` 오독 CRITICAL,
`code:` frontmatter exhaustive-consumer 이탈, W4 트리거 상호참조 누락, `toFanoutEnvelope`
범위 caveat)이 최종 `spec/conventions/egress-masking.md`(파일 23)에 전부 반영된 상태를
직접 확인했다(`code:` 6파일로 확장·§3 stale 트리거 명시·§2 범위 caveat 명시). 아래는 그
5개 checker(cross_spec/rationale_continuity/convention_compliance/plan_coherence/
naming_collision)가 다루지 않는 **아키텍처 전용 관점**에서의 추가 소견이다.

## 발견사항

- **[INFO]** 신설 문서의 SoT 분리 표는 "정책 vs 구현 좌표계" 라는 유효한 인터페이스 분리를
  구현하지만, 결과적으로 `spec/conventions/egress-masking.md` 가 `spec/5-system/*.md` 2개
  (EIA, WS Protocol)와 **양방향 참조**를 갖는다.
  - 위치: `spec/conventions/egress-masking.md:26`(SoT 분리 표 "마스킹 정책·적용 범위·잔여
    갭 | EIA §R17"), `spec/5-system/14-external-interaction-api.md:1397`("구현 좌표계는
    별도 규약이 소유한다"), `spec/5-system/6-websocket-protocol.md:198`("좌표계 SoT 는
    egress-masking 규약")
  - 상세: 일반적으로 `spec/conventions/**` 는 시스템 독립적인 횡단 규칙이고 `spec/5-system/**`
    가 그것을 참조하는 단방향 의존이 기대된다. 여기서는 conventions 문서가 "정책"의 소유권을
    시스템 문서 쪽에 명시적으로 위임하면서 자신은 "구현 좌표계"만 좁게 소유해, 사실상
    양방향 포인터 쌍이 생겼다. CRITICAL 은 아니다 — 이 저장소에는 `node-cancellation.md` ↔
    `execution-context.md` 라는 동일 패턴의 기존 선례가 있고, 두 문서 모두 "무엇을 소유/
    소유하지 않는지"를 표로 명시해 진짜 순환 권위(같은 사실을 두 곳이 각자 정의)는 아니다.
    다만 이런 양방향 포인터 쌍이 늘어날수록 "이 conventions 문서는 시스템 문서 없이는
    읽을 수 없다"는 결합이 누적되므로, 향후 3번째 유사 문서를 만들 때는 단방향으로 충분한지
    먼저 검토할 가치가 있다.
  - 제안: 조치 불요(선례 일치). 다음에 같은 패턴의 conventions 문서를 또 만들 때는 양방향
    참조가 정말 필요한지(정책 문서가 구현 좌표계를 몰라도 되는지) 먼저 확인.

- **[INFO]** 좌표계 표가 인코딩하는 실제 코드 구조는 "같은 값(10)을 우연히 공유하는 4개의
  독립 선언"이며, 이를 하나의 공유 상수로 묶지 않기로 한 결정이 이 문서의 존재 이유다. 이는
  전형적인 "암묵적 결합(값은 같아야 하지만 참조로 강제되지 않음)"이고, 이 문서 자체가 그
  결합을 검증할 기계적 수단이 없다는 것을 §3 에서 스스로 인정한다.
  - 위치: `spec/conventions/egress-masking.md:38`~`60`(1. 좌표계 표, 특히 4행
    `MAX_SANITIZE_DEPTH` — "독립 선언"), `spec/conventions/egress-masking.md:79`~`83`
    (§3 "이 문서는 기계가 지키지 않는다")
  - 상세: 4개 선언(`MAX_MASK_DEPTH` SoT, `MAX_REDACT_DEPTH` 재export, 프런트 직접 import,
    `MAX_SANITIZE_DEPTH` 독립 선언) 중 앞 3개는 결국 같은 상수를 참조/재export 하므로 실제
    코드 결합이 있지만, `MAX_SANITIZE_DEPTH` 는 값만 우연히 같고 참조 관계가 없다. 즉 코드
    수준에서 "값의 일치"를 지키는 것은 순전히 사람의 규율이고, 표 자체도 §3 이 명시하듯
    기계 검증이 없다. 이것은 코드 아키텍처 결정(합치지 않는다)의 필연적 부산물이며 이번
    PR 범위(문서화)가 그 결정을 바꾸는 것은 아니므로 코드 변경을 요구할 사안은 아니다.
    다만 리뷰어로서 "표가 최신인지"는 리뷰 시점의 스냅숏일 뿐이라는 점을 남긴다 — §3 이
    이미 "알려진 stale 트리거"(트래커 W4)를 명시했으므로 향후 갱신 경로는 마련되어 있다.
  - 제안: 조치 불요. 자동 가드(AST 파서로 표↔소스 대조)는 이미 Rationale 에서 "유한한
    문제를 무한한 문제와 바꾸지 말 것" 근거로 명시적으로 기각되었고, 이 저장소의 기존
    harness 가드 설계 결론과 일치한다.

- **[INFO]** `plan/in-progress/spec-draft-egress-masking-convention.md`(파일 1)와 최종
  `spec/conventions/egress-masking.md`(파일 23)가 거의 동일한 좌표계 표를 이중으로
  보유하게 된다.
  - 위치: `plan/in-progress/spec-draft-egress-masking-convention.md:86`~`97`
    (`## 실측한 좌표계` 표) vs `spec/conventions/egress-masking.md:38`~`50`(`## 1. 좌표계` 표)
  - 상세: 이 시리즈가 4개 PR 을 들여 없앤 것이 정확히 "같은 사실을 여러 파일이 따로 적는"
    미러 패턴인데, plan 초안과 최종 spec 이 표를 그대로 복제한 모양새라 표면적으로는 같은
    패턴처럼 보인다. 그러나 `plan/in-progress/**` 는 이 저장소 컨벤션상 완료 후
    `plan/complete/`(필요 시 `archive/`)로 이동하는 **의사결정 이력** 문서지 살아있는 SoT
    가 아니므로(`plan-lifecycle.md`), 두 표는 "같은 사실의 병존 SoT"가 아니라 "결정 과정
    스냅숏 vs 최종 산출물"의 정상적 관계다. 코드 JSDoc 미러(계속 갱신되어야 하는 두 개의
    살아있는 진실)와는 다른 성격이라 이번 항목은 CRITICAL/WARNING 대상이 아니라고 판단했다.
  - 제안: 조치 불요. 다만 plan 문서가 `plan/complete/` 로 이동한 뒤에도 좌표계 표가 남아
    있으므로, 향후 이 표가 실제로 갱신될 때(예: W4 통합) 최종 spec 만 갱신하고 완료된 plan
    스냅숏은 갱신하지 않는 것이 맞다는 점을 팀이 암묵적으로 공유하고 있는지 확인 가치는 있음
    (강제 아님, `plan-lifecycle.md` 가 이미 이 구분을 규정).

## 요약

이번 변경은 소스 코드 구조에 영향을 주지 않는 문서 전용(spec/plan) PR 이며, 실질적으로는
이미 코드에 흩어져 있던 cross-file 불변식(3~4개의 독립적인 깊이 상한·비교 연산자·마커
소비처)에 처음으로 단일 소유권 문서를 부여하는 작업이다. SoT 분리 표를 통해 정책(EIA)·
구현 좌표계(신설 conventions)·echo 규칙(node-output)·에러 코드(error-codes)의 경계를
명시적으로 나눴고, `node-cancellation.md`/`execution-context.md`, `secret-store.md`
"비대상" 콜아웃 등 기존 선례를 정확히 재사용했다. 순환 권위(같은 사실을 두 문서가 각자
정의)나 진짜 순환 의존은 발견되지 않았고, consistency-check 2라운드에서 나온 아키텍처
인접 WARNING(값 표기 오독, `code:` frontmatter 범위, W4 staleness 트리거, 순서 계약 범위
caveat)은 최종본에서 모두 반영이 확인됐다. 남은 소견은 전부 INFO 수준 — (1) conventions
문서가 시스템 문서와 양방향 참조를 갖는 결합 누적 경향, (2) 4개 독립 선언 중 1개
(`MAX_SANITIZE_DEPTH`)가 코드 수준에서 참조 없이 값만 일치하는 암묵적 결합을 문서가
대신 감시한다는 점, (3) plan 초안과 최종 spec 의 표 중복 — 이며 셋 다 이 저장소의 기존
컨벤션·선례와 정합하고 즉시 조치를 요구하지 않는다.

## 위험도

NONE
