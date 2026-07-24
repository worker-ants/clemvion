# 유지보수성(Maintainability) 리뷰 — presentation-thread-optout-drift

## 범위 메모

이번 changeset 은 **애플리케이션 코드가 없다** — 변경된 11개 파일 전부 Markdown(spec/plan) 또는
JSON(consistency-check 산출 상태 파일)이다: `plan/in-progress/node-output-redesign/form.md`(각주 추가),
`plan/in-progress/presentation-thread-optout-drift.md`(신규 plan), `review/consistency/2026/07/23/19_48_09/**`
(checker 5종 + SUMMARY + meta/retry-state, 전부 신규 생성된 감사 기록), `spec/4-nodes/6-presentation/0-common.md`
§4.6, `spec/conventions/conversation-thread.md` §2.4. 따라서 "함수 길이·중첩 깊이·순환 복잡도·매직 넘버"
같은 코드 전용 지표는 대상이 없어 해당 없음(N/A)으로 처리하고, 문서 편집의 유지보수성(가독성·SoT 중복·
네이밍 일관성·구조 일관성) 관점으로 조정해 리뷰했다.

### 발견사항

- **[INFO]** 헤딩 레벨 불일치를 알면서도 그대로 두고 본문만 재작성
  - 위치: `spec/4-nodes/6-presentation/0-common.md:153` (`## 4.6 Conversation Thread opt-out (공통)`)
  - 상세: 같은 diff 가 §4.6 본문을 표+각주 2단 구조로 대폭 재작성했으나, 이 절 자체가 `## 4.6`(h2)로
    선언돼 있어 형제 서브섹션 `### 4.1`/`### 4.2`(h3, gate `105|`/`109|`)와 위계가 어긋난 채로 남는다.
    (동봉된 consistency-check `convention_compliance.md` 도 동일 사실을 INFO 로 이미 지적했다.) 이 절을
    이번 턴에 실질적으로 다시 쓰는 김에 `### 4.6` 로 맞추거나 독립 `## 5.`로 승격하는 편이, 향후 이 문서를
    다시 열 사람이 "왜 소수점 넘버링인데 h2 인가"를 다시 추적하지 않게 한다. 차단 사유는 아님(plan 의
    INFO 미조치 목록에 이미 "헤딩 레벨: 선재 구조 흠, 앵커 파손 위험이 이득보다 큼"으로 의도적 보류 기록됨).
  - 제안: 지금 당장 고칠 필요는 없으나, §4.6 이 다시 편집될 다음 기회(예: 향후 schema 선언이 실제로
    추가될 때)에 함께 정정할 항목으로 plan 체크리스트에 남겨두는 편이 유지보수 관점에서 유리하다(이미
    plan 본문에 이 판단 근거가 기록돼 있어 실질적으로는 의도적 defer — 재차 확인만).

- **[INFO]** 같은 규범 문장이 두 spec 파일에 근접 중복 서술 — 동기화 부담
  - 위치: `spec/4-nodes/6-presentation/0-common.md:167` (`| **런타임 opt-out 동작** | **구현됨 (전 노드 공통)** | ... 노드 종류를 가리지 않으므로 ...`)
    / `spec/conventions/conversation-thread.md:190-191` (`> ... 노드 종류를 가리지 않는다 ...`)
  - 상세: 두 파일이 "`appendInternal` 게이트는 노드 종류 무관 공통 적용"이라는 같은 사실을 각자의 표현으로
    다시 서술한다. 서로 교차 링크는 걸려 있어(0-common.md → conversation-thread.md, 그 역방향도) 완전한
    맹목적 중복은 아니지만, 만약 이 게이트의 적용 범위가 나중에 바뀌면(예: 특정 노드 카테고리만 예외 처리)
    두 파일을 **양쪽 다** 손으로 동기화해야 하며 실제로 이번 plan 자체가 그런 종류의 비대칭 drift(§2.4 vs
    구 §4.6)를 정정하는 작업이었다는 점을 감안하면, 같은 계열의 재발 여지를 완전히 없애지는 못했다.
  - 제안: 강한 조치는 불요(사실관계 방향이 같고 교차 링크가 있어 즉각적 drift 위험은 낮음). 다만 두 문장
    중 한쪽을 "SoT는 저쪽, 여기는 요약만" 형태로 명시적으로 낮춰 단방향 참조로 정리하면 향후 유지보수
    시 "어느 쪽을 먼저 고쳐야 하는가"에 대한 판단 비용이 줄어든다.

- **[INFO]** 신규 plan 파일명이 선행 plan 의 명명 패턴과 접미사가 다름
  - 위치: `plan/in-progress/presentation-thread-optout-drift.md` (파일명 자체)
  - 상세: 같은 계보로 명시 인용되는 선행 plan `plan/in-progress/presentation-previousoutput-spec-drift.md`
    (PR #997)는 `presentation-<필드>-spec-drift.md` 패턴(`-spec-` 포함)인데, 신규 파일은 `-spec-`이 빠진
    `presentation-<필드>-drift.md` 패턴이다. 기능적 충돌은 없으나(경로 유일), 동일 계열 문서군의 명명
    일관성이 깨진다. (`naming_collision.md` INFO #3 과 동일 사실 — target 스스로도 인지하고 "강제 아님,
    세 번째 발생 시 통일 고려"로 명시적 defer한 상태.)
  - 제안: 이미 의도적으로 보류됐으므로 지금 조치 불요. 다만 향후 세 번째 `presentation-*-drift.md` 가
    생기면 이번 결정(접미사 통일 재검토)을 잊지 않도록 plan 자체에 남겨진 기록(§비목표/INFO 미조치 목록)을
    유지할 것.

- **[INFO]** 형제 목록(Principle 0–11) 중간에 콜아웃이 삽입돼 순번 흐름이 시각적으로 끊김
  - 위치: `plan/in-progress/node-output-redesign/form.md:156-161` (Principle 7 항목과 Principle 11 항목
    사이에 삽입된 `> ⚠️ **D1 재검토 필요 ...** ` blockquote)
  - 상세: 원 문서는 "Principle 0: … / Principle 1.1: … / Principle 4: … / Principle 5: … / Principle 7: …
    / Principle 11: …" 순으로 원칙 번호를 따라가는 목록인데, 그 사이에 번호 없는 경고 블록이 끼어들어
    Principle 7 결론(가장 충실한 raw echo 구현)과 실제로는 상반되는 재평가(D1 위반)가 목록 항목이 아닌
    별도 콜아웃으로 존재한다. 내용 정확도 자체는 문제없고(오히려 정정 목적의 의도된 삽입), 이후 이 문서를
    다시 훑는 사람이 Principle 7 리스트 항목만 읽고 지나칠 경우 바로 아래 경고를 놓칠 여지가 약간 있다.
  - 제안: 경미한 가독성 이슈로 차단 대상 아님. 후속 편집 때 Principle 7 항목 본문 안에 직접
    "(2026-07-23 D1 재검토로 상충 — 아래 각주 참조)" 정도의 인라인 backref 를 추가하면 콜아웃을 놓칠
    가능성이 더 낮아진다.

### 요약

애플리케이션 코드 변경이 없는 순수 문서(spec/plan) + 감사 산출물(review/consistency) changeset 이라
전통적 코드 유지보수성 지표(함수 길이·중첩·복잡도·매직 넘버)는 적용 대상이 없다. 문서 편집 자체는 표
구조(2층위 상태 표)가 명확하고, 기존 spec 의 테이블/각주 스타일과 일관되며, 실측 근거(라인 인용·코드
경로)가 촘촘해 가독성이 좋다. 발견된 항목은 전부 INFO 수준 — (1) `0-common.md §4.6` 헤딩 레벨 불일치를
알면서 이번에도 정정하지 않고 넘어감(이미 plan 이 의도적으로 defer 기록), (2) 같은 게이트-무관 서술이
두 spec 파일에 근접 중복돼 향후 동기화 부담 소지, (3) plan 파일명 접미사 패턴이 선행 plan 과 다름(이미
"강제 아님"으로 defer), (4) `form.md` 콜아웃 삽입이 원칙-번호 목록 흐름을 살짝 끊음. 넷 다 이미 동봉된
consistency-check 산출물이 부분적으로 포착했거나 target plan 자신이 인지·defer 한 사안이라 신규 위험은
아니며, 실행을 막을 수준이 아니다.

### 위험도

LOW
