# Rationale 연속성 Check 결과

대상: `spec/7-channel-web-chat/1-widget-app.md`(§2·§3.1) · `spec/7-channel-web-chat/_product-overview.md`(§2) ·
`spec/conventions/conversation-thread.md`(§2.1) — `plan/in-progress/widget-presentation-restore.md`(commit
`28a358375`)가 도입한 3개 spec 편집. 본 checker 는 이번 라운드(22_41_55)가 직전 라운드(22_27_45)의
WARNING 1건·INFO 4건에 대한 후속 조치인지, 그 조치 자체가 새로운 Rationale 위반을 만들지 않았는지를 검증했다.

## 검증한 사실관계 (원본 spec 직접 대조)

- 직전 라운드(`review/consistency/2026/07/10/22_27_45/`)의 WARNING 1(SoT 컨벤션 미등록)·INFO 1(백로그 목록 누락)·
  INFO 3(로드맵 미러 등재 여부 미명시)·INFO 4(§3.1 상호참조 누락) 4건 모두 이번 커밋에서 `git diff main` 기준으로
  실제 반영을 확인했다:
  - `spec/conventions/conversation-thread.md` §2.1 에 "표시물(`{config,output}` envelope)은 thread 에 영속되지
    않는다" 단락 신설(WARNING 1 해소) — 위치는 `## Rationale`(§8)이 아니라 본문 §2.1(자동 누적 컨트랙트)로, "본문 =
    latest-only 사실, Rationale = 왜" 분리 원칙([0-overview.md Rationale 헤더](../../../../../../spec/0-overview.md)와
    동형 관례)과 정합 — 이는 신규 *결정*이 아니라 기존 자료구조 정의(§1.1 5-source enum·§1.2 `presentations?` 필드가
    `source:'ai_assistant'` 한정)의 명문화이므로 Rationale 절 신설 대상이 아니다.
  - `_product-overview.md` §2 "비목표(v1→백로그)"에 표시-전용 presentation 노드 복원 항목 추가(INFO 1 해소).
  - plan `## Rationale` R2-a 신설로 "§6.3 루트 로드맵에 미러하지 않음(cross-cutting 아님, 영역 백로그로 충분)"을
    명시적으로 결정(INFO 3 해소).
  - `1-widget-app.md` §3.1 "페이지 새로고침/이동" 행 말미에 "단 thread 에 영속되지 않는 표시-전용 presentation
    *노드* 표시물은 예외 — §2" 상호참조 추가(INFO 4 해소).
- R2-a 의 "루트 미러 비대상" 판단을 `spec/0-overview.md §6.3`(로드맵 목록: 크로스워크스페이스 조직 공유·이커머스
  통합 확장·EH-DETAIL-12 cross-node thread view)과 대조 — §6.3 은 cross-cutting 대형 항목만 수록하고 각 영역의
  세부 백로그(예: presentation truncation, 폼 file-upload 등)는 올리지 않는 기존 패턴과 일치한다. `execution-history.md`
  R-6 선례(EH-DETAIL-12 미러)는 그 갭이 영역 횡단(실행 이력 화면이 여러 노드 유형을 가로지름)이라는 점에서 본
  갭(웹채팅 위젯 국지적 렌더 제약)과 성격이 다르다는 plan 의 구분도 타당하다 — 새 원칙을 만드는 게 아니라 기존
  §6.3 편입 기준(cross-cutting)을 그대로 적용한 것.
- `spec/5-system/14-external-interaction-api.md` R17(2026-07-09 재조정)·R18(2026-06-25 결정)을 재대조 —
  R17 은 "durable thread(`Execution.conversation_thread`)는 이미 무손실 영속돼 있는데도 노출 표면이 없어 복원
  불가였다"고 명시하고, R18 은 "표시-전용 presentation 노드는 `execution.message` **SSE 전용** 이벤트로만 발행"을
  결정 사항으로 고정한다. target 3개 편집이 주장하는 "durable thread 에는 AI `render_*` 표시물만 영속, standalone
  노드 표시물은 라이브 SSE 한정"은 이 두 Rationale 항목과 정확히 일치하며, 새로 만들어내는 제약이 아니라 기존
  결정의 소비 측(위젯) 반영이다.
- `spec/conventions/conversation-thread.md` §8.4("Execution.conversation_thread 컬럼 채택 — durable park resume")의
  "무손실 복원" 주장은 `conversationThread`(turn 목록) 자체에 대한 것이며, standalone 노드의 `{config,output}`
  envelope 을 포함한다고 약속한 적이 없다 — §2.1 신설 문구가 §8.4 의 "무손실" 범위를 재정의하거나 축소하지 않는다
  (범위가 애초부터 겹치지 않음, 충돌 아님).
- `1-widget-app.md` §2 presentation 행이 제거한 옛 "알려진 제약(Planned) … 위젯 렌더러가 graceful 하게 무시(빈
  렌더)" 문구는 (직전 라운드에서 `git log -S` 로 이미 확인했듯) PR #874 가 도입한 inline 서술일 뿐 그 문서의
  `## Rationale`(R4~R6) 항목으로 합의된 결정이 아니었다 — 따라서 이번 편집은 "기각된 대안의 재도입"도 "합의
  원칙 위반"도 아니라, 근거 없이 남아있던 부정확한 서술의 정정이다.

## 발견사항

없음 — CRITICAL/WARNING 급 Rationale 연속성 위반을 발견하지 못했다.

- **[INFO]** `_product-overview.md` §2 "목표(v1)" 문구와 신규 "비목표" 항목의 축 구분을 한 번 더 명확히 할 여지
  - target 위치: `spec/7-channel-web-chat/_product-overview.md` §2 "목표(v1)" — "**EIA 인터랙션 전체 렌더**: …
    presentations(carousel/table/chart/template) inline"
  - 과거 결정 출처: 없음(신규 Rationale 위반 아님 — 표현 명확성 관점의 제안)
  - 상세: "목표" 절의 "전체 렌더"는 **라이브 렌더**(모든 타입을 인라인 렌더)를 뜻하고, 새로 추가된 "비목표"
    항목은 **새로고침 복원**(다른 축: persistence)에 한정된 제약이라 논리적으로 모순은 아니다. 다만 두 문장이
    같은 §2 안에 나란히 있어 "전체 렌더"를 "복원까지 포함한 완전성"으로 오독할 여지가 이론적으로 남는다(직전
    라운드 INFO 2 — §3.1/§2 병치 오독 여지 — 와 동일 계열의 우려).
  - 제안: 필수 아님. 원한다면 "목표" 항목 말미에 "(새로고침 복원 범위는 §2 비목표 참조)" 1구 추가로 완전 해소 가능.

## 요약

이번 라운드는 직전 라운드(22_27_45)가 남긴 WARNING 1건과 INFO 4건 중 checker 소관 3건(WARNING 1·INFO 3·INFO 4)이
모두 반영됐음을 커밋 diff 로 확인했고, 그 반영 방식(conversation-thread.md §2.1 본문 신설·plan Rationale R2-a
신설·§3.1 상호참조 추가·_product-overview.md 백로그 등재)이 기존 Rationale 체계(EIA §R17·§R18, conversation-thread
§1.1/§1.2/§8.4, 본문/Rationale 분리 관례, §6.3 cross-cutting 편입 기준)와 전부 정합함을 원본 재대조로 검증했다.
기각된 대안의 재도입, 합의 설계 원칙 위반, 근거 없는 결정 번복은 발견되지 않았다 — 오히려 이번 편집은 정식
Rationale 로 합의된 적이 없던 부정확한 inline 서술(#874 도입 "Planned" 문구)을 제거하고, 기존에 이미 확정된
아키텍처 경계(R17/R18, §1.1 5-source enum)를 소비 문서에 정확히 반영하는 정정이다. 남은 것은 표현 명확성
차원의 INFO 1건뿐이며 차단 사유가 아니다.

## 위험도
NONE
