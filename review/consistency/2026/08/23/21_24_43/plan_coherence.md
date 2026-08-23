# Plan 정합성 검토 — `plan/in-progress/spec-text-fixes.md`

## 검토 방법

- target frontmatter 의 `spec_impact` 3파일(`15-chat-channel.md`, `14-external-interaction-api.md`,
  `data-flow/15-external-interaction.md`)과 정본 트래커
  `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 대응 항목(724~734행)을 대조.
- `plan/in-progress/` 전체(43개 파일, 번들 밖 63개 포함)를 `grep -rn` 으로
  `InteractionRequestContext` · `in_process_trusted` · `EIA-AU-08` · `EIA-AU-09` 전수 검색해
  target 변경이 건드리는 텍스트를 참조하는 다른 진행 중 항목이 있는지 확인.
- `spec/5-system/15-chat-channel.md:315-317, 508` · `spec/5-system/14-external-interaction-api.md:331`
  · `spec/data-flow/15-external-interaction.md:119` 원문을 직접 열어 target 의 "착수 전 재확인"
  표(1~3행)가 실측과 일치하는지 재검증.

## 발견사항

- **[INFO]** ③ 검증 시 `EIA-AU-09` 리터럴 grep 이 함정임을 target 이 명시적으로 이어받지 않음
  - target 위치: `plan/in-progress/spec-text-fixes.md` §"처분 방침" ③, §"작업" 체크박스 ③
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:1322-1323`
    ("`EIA-AU-09` — data-flow/15-…md 가 아직 참조. **주의**: 문서에 `EIA-AU-08/09` 로 적혀
    있어 `grep 'EIA-AU-09'` 는 **0건을 낸다**")
  - 상세: `data-flow/15-external-interaction.md:119` 의 실제 문자열은 독립된 `EIA-AU-09` 가 아니라
    `EIA-AU-08/09` 로 결합된 참조다(직접 확인). 이 정확한 문자열 함정은 같은 트래커가 이미
    한 번 기록해 둔 교훈인데, target 의 처분 문구("③은 숫자를 지운다 … `08` 만 참조하도록
    좁힌다")는 결과적으로 올바른 방향이지만 그 근거인 "08/09 결합 표기" 사실 자체는 target
    문서 어디에도 적혀 있지 않다. 실행 단계에서 `grep 'EIA-AU-09'` 로 "이미 없음"을 확인하고
    조기 종료하면 실제 편집(`/09` 제거)을 건너뛸 위험이 있다.
  - 제안: target 문서 ③ 처분 방침 또는 검증 절에 "실제 표기는 `EIA-AU-08/09` 결합형 — `/09`
    부분만 제거" 한 줄을 추가해 트래커의 기존 경고를 상속시킨다. 사소한 실행 위험이라
    spec 합의 자체를 막을 사안은 아니다.

## 정합성 확인 (문제 없음, 기록 목적)

- target 이 다루는 3항목(①`InteractionRequestContext` union stale, ②EIA §5.1 legacy webhook
  대비 문구, ③data-flow `EIA-AU-09` 참조)은 전부 정본 트래커
  `spec-sync-external-interaction-api-gaps.md` 724~734행의 **미체크 항목 그대로**이며, target
  frontmatter/체크리스트가 "트래커 3항목 종결"을 명시해 해당 plan 으로 되먹임하는 것까지
  계획돼 있다 — 이 저장소가 이미 겪은 "자기를 닫은 PR 이 자기 이름을 부르지 않으면 영영
  미체크로 남는다"(같은 트래커 1410행)를 피하는 형태.
- 세 항목 모두 "미해결 결정" 이 아니라 **문서 stale 사실 확인**이며, 트래커 자체도 "내 diff
  밖이라 등재만 한다" 로 분류해 둔 순수 정정 항목이다. target 이 일방적으로 내리는 신규
  결정은 없음(①은 EIA §3.3.1 을 SoT 로 지정하는 것뿐이고 그 SoT 지위는 이미 코드·spec 양쪽에서
  기정사실).
- `plan/in-progress/` 전수 grep(`InteractionRequestContext`/`in_process_trusted`/`EIA-AU-08`/
  `EIA-AU-09`) 결과 target 변경 대상 텍스트를 전제로 삼거나 그 라인 번호를 인용하는 다른 진행
  중 항목은 없음(`backend-lint-gate-broken-on-main.md` 의 `in_process_trusted` 언급은 dedup
  주제로 무관, 이미 `[x]` 종결).
- EIA `EIA-AU-*` 카탈로그는 `01`~`08` 까지만 정의돼 있고, 어떤 진행 중 plan 도 신규
  `EIA-AU-09` 항목을 도입할 계획이 없음(전수 확인) — target 의 "번호를 지운다"(예약이 아니라
  삭제) 처분과 충돌 없음.
- ②의 "legacy `statusCode/errors` shape" 문구가 위치한 EIA §5.1 은 다른 여러 완료된 plan
  (에러코드 401/403/410 세분, ack body 정정 등)이 최근까지 편집해 온 절이지만, 그 편집들은
  전부 `[x]` 종결된 과거 이력이고 target 이 건드리는 "legacy 대비" 문장과 겹치는 활성 항목은
  없음.

## 요약

Target(`spec-text-fixes.md`)이 다루는 3건은 정본 트래커의 미체크 항목을 정확히 1:1로 승계하고,
착수 전 재확인 표가 spec 원문과 실측 일치하며, 처분(포인터화·취소선·번호 삭제) 방식도 트래커의
서술과 다른 진행 중 plan 어디와도 충돌하지 않는다. 유일한 흠은 트래커 자신이 남긴 "`EIA-AU-08/09`
결합 표기라 리터럴 grep 이 함정" 경고를 target 이 텍스트로 이어받지 않은 점으로, 실행 단계의
검증 절차 오독 위험만 있고 spec 합의 자체를 저해하지 않는 INFO 수준이다.

## 위험도

LOW
