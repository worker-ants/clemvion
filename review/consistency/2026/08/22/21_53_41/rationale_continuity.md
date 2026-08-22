# Rationale 연속성 검토 — spec/5-system/ (--impl-prep)

## 검토 범위·방법

프롬프트 번들에 전문이 포함된 target 3개 문서를 전량 정독했다 — `spec/5-system/1-auth.md`(Overview~§5 API
엔드포인트 + Rationale 전체, 약 40개 결정 항목), `spec/5-system/2-api-convention.md`(전 절 + Rationale),
`spec/5-system/3-error-handling.md`(전 절 + Rationale). 나머지 15개 `spec/5-system/*` 파일은 컨텍스트
예산 초과로 번들에서 생략되어 있었으므로("본문 생략됨" 마커), 그 부재를 "문제 없음"의 근거로 삼지
않고 세 target 문서가 **직접 인용하는** 교차 참조처를 파일시스템에서 원문으로 열어 대조했다:
`spec/data-flow/12-workspace.md`(멤버십 검증 가드·UUID 검증 강도 비대칭·workspace.deleted 감사 제외
Rationale), `spec/conventions/error-codes.md §5`(Rename 이력, `INVALID_INPUT`→`INVALID_TRIGGER_PARAMETERS`
등급 B 인수), `spec/5-system/14-external-interaction-api.md §R17`(마스킹 마커 재제출 거부),
`spec/5-system/13-replay-rerun.md §8.1/§10.2`(Re-run 마커 가드), `spec/7-channel-web-chat/4-security.md
§R6`(IP 미식별 완화 한도). 또한 이 리뷰가 결부된 실제 작업 맥락(`plan/in-progress/masked-marker-test-gaps.md`,
`spec_impact: none`)도 확인해 spec 변경 의도가 없는 테스트-전용 작업임을 검증했다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 검토 과정에서 겉보기에 모순으로 보였던 두 지점을 원문 대조로 해소했으며
(오탐 배제 기록으로 남긴다):

- **[INFO] `error-handling.md §1.7`의 "re-run 이 세 번째 소비처" vs `14-external-interaction-api.md §R17`의
  "Manual 실행 경로 두 곳"** — 얼핏 동일 대상의 소비처 수가 다르게 서술된 것처럼 보이지만, 서로 다른
  함수·다른 카운트다. 전자는 `toTriggerParameterErrorDetails`(필드별 사유 코드 발행 헬퍼)의 소비처
  3개(`execute`/`save`/`re-run`)를 세고, 후자는 마스킹 마커 **거부** 헬퍼
  `resolveTriggerParametersRejectingMasked`의 호출부 2개(`execute`/`re-run`, `save`는 거부 대상 아님)를
  센다. `plan/in-progress/masked-marker-test-gaps.md`의 "함수 1개·호출 2곳" 서술도 후자와 일치한다.
  실제 모순 아님 — 다만 두 "N소비처" 서술이 인접 문서에 함께 나타나 향후 검토자가 혼동할 여지가 있으므로,
  두 카운트가 가리키는 함수명을 §1.7 note 옆에 한 줄 더 명시하면 재발을 줄일 수 있다(제안, 비필수).
- **[INFO] `14-external-interaction-api.md §R17`의 "세 소비처가 각각 갖췄다" 문구와 바로 아래 표의
  4행 불일치** — "세 소비처"는 `Execution.inputData` 카브아웃을 정당화하는 **클라이언트측 재제출
  소비처 3개**(폼 프리필·Re-run 모달·에디터 히스토리 로드)만 가리키고, 표의 4번째 행("서버 Manual
  실행 경로")은 그 3개와 별개로 추가된 서버측 백스톱이라 "소비처" 집합 밖이다. 문맥상 의미는
  일관되나 "세 소비처" 바로 아래 4행 표가 나오는 배치가 처음 읽을 때 오독을 유발하기 쉽다 —
  표 앞에 "(아래 표의 서버 행은 소비처가 아니라 그 소비처들의 재제출을 막는 백스톱이다)" 같은
  한 구절을 추가하는 것을 제안한다(비필수).

target 3개 문서 자체는 이례적으로 촘촘하게 자기 참조·상호 참조되어 있다 — 예를 들어 `1-auth.md`
Rationale 은 각 결정에 "기각된 대안"·발견 경로(`review/consistency/2026/07/28/17_21_27` CRITICAL #1 등)를
명시하고, `error-handling.md`의 §1.3 note 는 과거 결정("`RERUN_` prefix 를 붙이지 않는 것은 의도")이
정확히 무엇을 기각했는지 재확인한 뒤 그 번복이 새 결정(3경로 통일)과 다른 축임을 구분하고
`conventions/error-codes.md §5`의 실제 항목(#1193, "등급 B — 잔여 위험 인수")으로 근거를 연결한다 —
대조 결과 그 항목은 실제로 존재하며 서술과 일치했다. `1-auth.md`가 인용하는
`data-flow/12-workspace.md`의 세 Rationale 항목(멤버십 검증 가드 단일화·UUID 검증 강도 비대칭·
workspace.deleted 감사 제외)도 원문과 문구·의도가 정확히 일치했다. `7-channel-web-chat/4-security.md
§R6`↔`1-auth.md Rationale 2.3.B`의 상호 참조도 양방향으로 일치했다.

번들에서 생략된 15개 파일(`4-execution-engine.md` 등) 안에 이 검토가 못 잡은 Rationale 충돌이
있을 가능성은 완전히 배제할 수 없다 — 다만 그 파일들은 이번 --impl-prep 의 직접 대상(위임 링크 대상)일
뿐 이번 작업(`masked-marker-test-gaps`, `spec_impact: none`)이 손대는 표면과는 거리가 있고, 그 작업이
실제로 건드리는 마스킹-재제출 관련 절(`14-external-interaction-api.md §R17`, `13-replay-rerun.md
§8.1/§10.2`, `error-handling.md §1.7`)은 위에서 원문 대조를 마쳤다.

## 요약

target 세 문서(`1-auth.md`·`2-api-convention.md`·`3-error-handling.md`) 전문과 그로부터 직접 인용되는
교차 spec Rationale 을 원문 대조한 결과, 기각된 대안의 무근거 재도입·합의 원칙 위반·무근거 결정
번복·invariant 우회 사례는 발견되지 않았다. 오히려 이 문서군은 과거 발견(CRITICAL #1, #882/#887,
#1193 등)을 각주로 남기고 후속 정정의 근거를 명시적으로 연쇄시키는 성숙한 상태다. 다만 마스킹 재제출
소비처 수를 서로 다른 두 함수 기준으로 각각 "N소비처"로 서술하는 인접 문단들이 있어(둘 다 정확하지만
개념이 다름), 향후 혼동 방지를 위한 문구 보강을 INFO 로 제안한다. 번들 예산 초과로 이번 세션에서
직접 열람하지 못한 나머지 spec/5-system 파일 15개 중, 현재 작업과 무관한 부분은 검증 범위 밖으로
남겨둔다.

## 위험도

NONE
