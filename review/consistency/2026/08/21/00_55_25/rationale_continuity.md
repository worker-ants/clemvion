# Rationale 연속성 검토 — `plan/in-progress/spec-update-masked-reject-framing.md`

## 발견사항

- **[INFO]** 정정 1 의 "왜 2단계인지 한 줄 근거" 를 §6 표 캐비엇이 아니라 `1-manual-trigger.md`
  자체 `## Rationale` 섹션의 정식 항목으로 승격 제안
  - target 위치: target 문서 "정정 1" 절 (`→ 시점을 … 정정하고, 왜 2단계인지 한 줄 근거를
    단다`)
  - 과거 결정 출처: 실제 SoT 는 코드
    (`codebase/backend/src/modules/execution-engine/utils/reject-masked-resubmission.ts` JSDoc
    "## 왜 resolve 를 감싸는가 — 검사 시점이 정확성을 가른다")이며, spec 쪽 대응 결정 기록은
    `spec/4-nodes/7-trigger/1-manual-trigger.md` 의 `## Rationale` 이 관례상 SoT
    (CLAUDE.md "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`"). 같은 파일에
    `restoreVersion` 게이트 skip 처럼 표 안 캐비엇이 아니라 독립 `### ` 항목으로 근거를 남긴
    선례가 이미 있다.
  - 상세: target 자신이 "이 문장을 그대로 두면 다음 사람이 이것만 보고 검사를 '직후' 한 곳으로
    되돌린다 — 같은 CRITICAL 이 재발한다" 고 명시적으로 회귀 위험을 인지하고 있다. 그런데
    처방은 "표 캐비엇에 한 줄" 로 한정돼 있다. 이 결정은 실제로 CRITICAL 보안 버그
    (`boolean` 마커 우회, 커밋 `50f799efd`)를 낳았던 시퀀싱 오류의 수정이라, 코드 쪽은
    JSDoc 에 60줄 넘는 표·반례를 남겨 방어했다. spec 쪽에 남는 근거가 표 셀 안 한 줄뿐이면
    다음 사람이 grep 으로 "왜 두 번 보는가" 를 찾을 때 `## Rationale` 이 아니라 표 셀을 뒤져야
    하고, 이는 이 문서가 스스로 지적한 "표 행만 고치고 근거는 생략" 기각 사유와 정확히 같은
    형태의 위험(근거 소실)을 규모만 줄여 재현한다.
  - 제안: 실제 spec 편집 시 "왜 2단계인지" 근거를 표 캐비엇 한 줄 + `## Rationale` 하위 신규
    항목(예: `### masked_value_resubmitted 검사 시점 — raw 우선 + resolve 후 재검사`) 둘 다로
    남긴다. `restoreVersion` 항목과 같은 위치·형식이면 향후 검토자가 `## Rationale` 을 훑는
    것만으로 발견한다.

- **[INFO]** W3 (developer 턴의 spec 직접 수정)는 본 검토 범위(Rationale 연속성) 밖의
  절차 위반이나, 정정 2 의 대상 파일과 인과적으로 얽혀 있어 참고로 남김
  - target 위치: target 문서 "⚠️ 절차 위반을 먼저 적는다 (W3)" 절
  - 상세: `50f799efd`(developer 턴)이 `spec/5-system/14-external-interaction-api.md` 의
    §R17 표 행 라벨(`서버 (재제출 API)` → `서버 (Manual 실행 경로)`)만 고쳤고, 같은 문구를 쓰던
    자매 두 곳(`3-error-handling.md:193`, `12-webhook.md:312`)은 그대로 남았다 — 이번 target
    문서의 정정 2 가 바로 그 자매 갭이다. 이는 Rationale 내용의 문제가 아니라 "누가 spec 을
    고칠 권한이 있는가" 문제이므로 본 checker 등급 기준(기각 대안 재도입/원칙 위반/무근거
    번복/invariant 우회) 밖이다.
  - 제안: 없음 — target 문서가 이미 사후 정규 경로로 흡수하겠다고 명시했으므로 별도 조치
    불요. (참고용 기록)

## 정합성 확인 (충돌 없음으로 판정한 근거)

- **정정 1 (시점 "직후"→"전후")**: `reject-masked-resubmission.ts` 실제 구현을 확인한 결과
  정확히 raw 우선 검사 → `resolveTriggerParameters` → resolve 후 재검사의 2단계이며, 커밋
  `50f799efd`(`00_03_57` CRITICAL 수정)가 그 근거다. `1-manual-trigger.md:170` 를 제외하면
  이 타이밍을 언급하는 다른 spec 자리가 없어(grep 전수 확인) 정정 범위 누락도 없다. 과거
  `1-manual-trigger.md` 의 `## Rationale` 에 "resolve 직후 검사" 를 못박은 명시적 결정은
  없었다 — 즉 기각된 결정의 재도입이 아니라 단순 stale 서술 정정이다.
- **정정 2 ("재제출 경로 한정" → "Manual 실행 경로 한정")**: `git log -S"재제출 경로 한정"`
  으로 확인한 결과 이 프레이밍은 `3e96f4b44` 에서 도입된 뒤 두 파일(`3-error-handling.md`,
  `12-webhook.md`)에서 한 번도 갱신되지 않았고, 후속 결정 `871d3fcb0`(2026-08-20, "판정
  기준을 '출처' 에서 '저작 주체' 로 정정")이 `14-external-interaction-api.md` §R17 만
  갱신하고 이 두 자매 파일을 놓친 실제 drift 다. 현재 `14-external-interaction-api.md` §R17
  본문은 이미 "가드의 범위 — Manual 실행 경로 전체다 (재제출만이 아니다)" 로 확정돼 있어,
  target 의 정정 2 는 **이미 확립된 canonical Rationale 에 자매 문서를 맞추는 것**이지 새로운
  결정도, 기각된 대안의 재도입도 아니다. grep 전수 확인 결과 이 프레이밍을 쓰는 자리는 정확히
  두 곳뿐이라 target 의 스코프 누락도 없다.
- 두 정정 모두 "기각된 대안" 서술(target 자체 `## Rationale`)이 실제 커밋 이력으로 뒷받침되며
  지어낸 이력이 아님을 `git log`/`git show` 로 확인했다.
- §R17 이 명시한 원칙("공유 프리미티브(`resolveTriggerParameters`)를 넓히면 무관한 경로가
  오염된다" → webhook/schedule 은 별도 경로 유지, "정확 일치만 감지" 등)을 target 의 두 정정
  모두 위반하지 않는다.

## 요약

target 문서의 두 정정(§6 검사 시점 "직후"→"전후", 자매 두 곳의 "재제출 경로 한정"→"Manual
실행 경로 한정")은 모두 기각된 결정의 재도입이 아니라, 이미 `14-external-interaction-api.md`
§R17 에 확립된 canonical Rationale("가드의 범위는 Manual 실행 경로 전체다", "판정 기준은
저작 주체다")과 실제 코드 구현(raw→resolve→재검사 2단계)에 자매 spec 문서를 뒤늦게 정렬시키는
작업이다. `git log -S`/커밋 diff 로 대조한 결과 이력 서술도 정확했다. 다만 target 이 스스로
지적한 "재발 위험"(다음 사람이 표 캐비엇만 보고 되돌린다)에 대한 처방이 표 셀 한 줄에 그쳐,
그 자신이 방금 "표 행만 고치고 근거는 생략" 을 기각 대안으로 적은 것과 같은 형태의 근거 소실
위험을 소규모로 남긴다 — 이는 INFO 수준의 보완 제안이다. Rationale 원칙·invariant 위반이나
기각된 대안의 무근거 재도입은 발견되지 않았다.

## 위험도

LOW
