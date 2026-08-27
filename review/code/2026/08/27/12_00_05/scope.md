### 발견사항

- **[WARNING]** masking-egress 작업과 무관한 "doc-link 검사기" 전제 정정이 같은 커밋에 곁다리로 섞였다
  - 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:771-793` (`⚠️ **전제 정정 (2026-08-27 실측, C 작업 중)**` 블록)
  - 상세: 이 diff 는 커밋 `23e1c91a0`("fix(docs): 스윕을 닫았다는 커밋에서 스윕이 또 갈렸다 (`11_25_15` W1~W4)")를 포함한다. 그 커밋의 제목·본문 W1~W4·INFO 4·INFO 6 는 전부 `masking-expression-egress-split` 의 mirror-sweep 잔여(경 config echo 마스킹 정정 4곳)를 닫는 내용이다. 그런데 같은 커밋이 **"doc-link 검사기가 CLAUDE.md·.claude/** 를 안 훑는다"** 라는 완전히 다른 백로그 항목(D 항목)에 `check-doc-links.py` 미배선·`origin/main` 기존 exit 1·`spec-link-integrity.test.ts` 오탐 2건이라는 별도 실측 결과를 추가했다. 커밋 메시지 스스로 이 부분을 **"곁다리 실측 — D 항목(doc-link)의 전제가 틀렸다"** 라는 별도 섹션으로 분리해 인지하고 있다 — 즉 작성자 자신도 이것이 W1~W4(마스킹 mirror-sweep)와 다른 작업임을 알고 있었다. 내용 자체(배선 여부·오탐 판정)는 정확해 보이지만, 이 PR(`masking-residuals-0b195b`)의 스코프는 "config echo 마스킹을 어댑터→egress 로 옮긴다" 이고 doc-link 검사기 하네스는 그와 무관한 별개 트랙(코드 리뷰 CRITICAL/WARNING 대응이 아니라 우연히 같은 세션에서 곁가지로 조사한 것)이다.
  - 제안: doc-link 검사기 전제 정정은 별도 커밋(및 이상적으로는 별도 plan 항목의 독립 diff)으로 분리한다. 이미 머지된 이력이라면 소급 분리는 불요하지만, 향후 "이 세션에서 곁가지로 발견한 것"이라는 자기인지가 있을 때는 같은 파일이라도 **다른 커밋**으로 나눠 이 PR 의 diff 가 "config echo 마스킹" 단일 목적에서 벗어나지 않도록 한다.

- **[INFO]** 위 항목을 제외한 나머지 43개 파일은 전부 "config echo 마스킹을 어댑터→egress 로 이관" 이라는 단일 목적에 귀속된다
  - 위치: 해당 없음 (아래 근거 참조)
  - 상세: 핵심 코드 5개(`mask-sensitive-fields.util.{ts,spec.ts}`, `handler-output.adapter.{ts,spec.ts}`, `ai-turn-executor.ts`)는 마스킹 제거·포함관계 캐너리 재작성·주석/JSDoc 정정만 담고 있고 기능 무관 리팩토링은 없다. `handler-output.adapter.ts` 의 타입 단언 제거(`126609555`)는 `maskSensitiveFields` 제거로 반환 타입이 이미 `Record<string, unknown>` 이 되어 `as` 캐스트가 lint 상 불필요해진 **직접 파생 결과**다(drive-by 리팩토링 아님). `CHANGELOG.md`·`plan/in-progress/masking-expression-egress-split.md`(신규)·spec 6개(`14-execution-history.md` R-5, `4-ai-assistant.md`, `1-ai-agent.md`, `4-execution-engine.md`, `egress-masking.md`, `node-output.md`)는 이 변경이 무효화한 보안 Rationale(R-5)을 정정하는 것으로, `19_26_06` consistency-check CRITICAL 이 지시한 범위와 정확히 일치한다(별도 "planner 턴" 커밋 `57fb83592` 로 developer 권한 경계도 지켰다). `review/code/2026/08/27/{10_53_52,11_25_15}/**` 와 `review/consistency/2026/08/24/19_26_06/**` 산출물 19개는 이 저장소 컨벤션상 리뷰/일관성 검토 산출물이 `review/**` 에 커밋되는 표준 절차이며 gitignore 대상이 아니다 — 스코프 이탈이 아니다. `spec-sync-external-interaction-api-gaps.md` 의 나머지 편집(자매 트래커 2건 종결, 신규 백로그 2건 등재)도 이 PR 이 만든 트레이드오프(크로스-노드 릴레이·safe-by-convention·chatChannel 정규식 비대칭)를 자매 트래커에 동기화하는 정상 절차다. `plan/in-progress/masking-expression-egress-split.md` 체크리스트는 실제 완료 상태와 일치(`/ai-review` 만 미체크, 정확)한다.
  - 제안: 없음 (양호).

### 요약

이번 diff(`origin/main` 대비 44개 파일)는 "노드 `config` echo 마스킹을 어댑터 boundary 에서 egress 전용으로 옮긴다"는 단일 목적의 코드 변경(핵심 5개 파일) + 그로 인해 무효화된 보안 Rationale 을 정정하는 spec 6개 + 3라운드에 걸친 코드/일관성 리뷰 산출물 19개 + plan 트래커 갱신으로 구성되며, 대부분은 그 목적에 정확히 귀속되고 불필요한 리팩토링·기능 확장·포맷팅 잡음은 발견되지 않았다. 다만 커밋 `23e1c91a0`(마스킹 mirror-sweep W1~W4 를 닫는 커밋)이 스스로 "곁다리 실측"이라 표시한, 이 PR 과 무관한 "doc-link 검사기(`check-doc-links.py`) 전제 정정" 한 블록(`spec-sync-external-interaction-api-gaps.md:771-793`)을 같은 커밋에 섞어 넣었다 — 이 저장소가 반복 겪어 온 "결합 항목을 한 커밋으로 닫으면 다른 것도 딸려 들어온다" 류의 경미한 스코프 혼입이다. 기능·보안 회귀는 아니며 차단 사유는 아니다.

### 위험도
LOW
