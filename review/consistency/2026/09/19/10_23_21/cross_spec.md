# Cross-Spec 일관성 검토 — `plan/in-progress/spec-draft-code-guards-and-change-summary.md`

## 발견사항

- **[WARNING]** §8.1 정정문이 겨냥하는 사실을, 같은 기능을 설명하는 사용자 가이드 문서(mdx)가 정면으로 반박한다
  - target 위치: §2 (`0-canvas.md` §8.1 정정문) — "에디터의 수동 저장 · 실행 직전 저장은 이 값을 보내지 않아 비어 있다"
  - 충돌 대상: `codebase/frontend/src/content/docs/05-run-and-debug/version-history.mdx` (18행 "저장 요청에 `changeSummary` 메모를 넣으면 버전 이력에 그대로 표시돼요", 72행 "작업 전에 `Save`로 버전을 만들고 의미 있는 `changeSummary`를 남겨요") 및 그 영문 짝 `version-history.en.mdx`(9행, 72행). 이 mdx 는 frontmatter `spec: ["spec/3-workflow-editor/5-version-history.md"]` 로 target 이 함께 정정하는 도메인(캔버스 저장 · `changeSummary`)에 직접 걸려 있다.
  - 상세: target 이 코드로 직접 확인한 사실(`saveCanvas` 요청 타입에 `changeSummary` 필드 자체가 없고, `saveWorkflow()` 스토어 액션도 인자를 받지 않음 — `codebase/frontend/src/lib/api/workflows.ts:163-187`, `codebase/frontend/src/lib/stores/editor-store.ts:1208`)과 달리, 이 사용자 가이드는 "저장 요청에 `changeSummary` 메모를 넣으면" · "의미 있는 `changeSummary` 를 남겨요" 라고 서술해 **사용자가 저장 시 changeSummary 를 직접 입력할 수 있는 UI 가 있다**고 명시적으로 약속한다. 그런 입력 필드는 에디터 어디에도 없다(그레핑상 `changeSummary` 는 응답 타입·표시 컴포넌트에만 등장한다는 target 자신의 조사와 일치). 이는 `spec/conventions/user-guide-evidence.md` 서문이 명시한 정확히 그 결함 유형("가이드 본문이 약속한 UI 표면이 실제 코드에 없다" — 텔레그램 chat-channel 사례와 동형)이며, `<ImplAnchor>` 로 감싸지 않은 자유 서술(prose)이라 어떤 build-time 가드도 잡지 않는다. target 이 §2 Rationale 에서 "같은 사실을 적는 다른 자리" 를 `5-version-history.md`·`data-flow/11-workflow.md`·`1-data-model.md` 로 전수 확인했다고 적었지만, 이 두 mdx 파일은 그 전수 확인 대상에 들지 않았다 — grep 범위가 `spec/` 로 한정돼 `codebase/frontend/src/content/docs/**` 를 놓쳤을 가능성이 있다. target 의 정정문이 반영되면 이 가이드의 오기술이 spec 과 더 뚜렷하게 어긋나게 된다(현재의 틀린 §8.1 문장 "자동 생성된 change_summary" 은 최소한 "자동" 이라 사용자 입력 서술과 방향이 달라 우연히 덜 충돌해 보였다).
  - 제안: 이 draft 의 스코프(spec 두 파일)를 넓히지 않고, 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)나 새 항목으로 "가이드 `version-history.mdx`/`.en.mdx` 의 changeSummary 입력 서술 정정" 을 등재해 후속 처리할 것을 권한다. §8.1 을 고치면서 이 가이드를 방치하면 spec 은 실제에 맞지만 사용자 가이드는 존재하지 않는 기능을 계속 약속하는 상태가 굳어진다.

- **[INFO]** frontmatter `code:` 주석 생략은 선례와 다르지만 결함은 아님
  - target 위치: §1 "(주석은 draft 설명용 — spec frontmatter 에는 경로만 적는다.)"
  - 충돌 대상: `spec/2-navigation/2-trigger-list.md` frontmatter (`code:` 목록 뒤에 "# 시행 코드 — §3 «동시 쓰기 직렬화»..." 인라인 주석으로 선정 근거를 남김), `spec/conventions/spec-impl-evidence.md` §2.1 (2026-09-06 이후 `_parse_frontmatter_code` 가 빈 줄·`#` 주석을 건너뛰도록 고쳐져 인라인 주석이 안전하다고 명시)
  - 상세: target 은 왜 이 셋만 넣고 나머지 여섯은 빼는지에 대한 근거가 풍부하다(§1 본문 전체). 그런데 실제 spec 파일에는 경로만 남기기로 해, 다음에 이 frontmatter 를 보는 사람은 "왜 이 셋인지" 를 알려면 이 draft(plan/complete 이관본)를 따로 찾아야 한다. 선례(`2-trigger-list.md`)는 정확히 이런 선정 근거를 인라인 주석으로 frontmatter 에 직접 남겨, 가드가 안전하다고 확인된 지금은 그렇게 할 수 있다.
  - 제안: 강제 사항은 아니나, 셋 중 최소 `entity-schema-declarations.e2e-spec.ts`(가장 넓은 범위) 옆에 한 줄 주석("엔티티 선언↔DB 대조 — 나머지 기능 e2e 는 제외" 정도)을 남기면 선례와 형식이 맞고 향후 재질문을 줄인다.

## 검증 완료 (충돌 없음)

- §2 §8.1 정정문 vs 코드: `workflows.service.ts:725`(복원만 `Restored from v${version}`) · `save-canvas.dto.ts:214`(`changeSummary?: string` 그대로 저장) · frontend 어디서도 저장 요청에 `changeSummary` 를 싣지 않음 — 모두 target 서술과 일치.
- §2 정정문 vs `5-version-history.md` §7.4(148행)·§9(172행), `data-flow/11-workflow.md`(44·52·66·160행), `1-data-model.md` §2.15(589행) — 전부 일치, 모순 없음.
- §1 `code:` 신규 3개 파일(`deletion-cascade-indexes` · `trigger-endpoint-path-dedupe` · `entity-schema-declarations`) — 다른 어떤 spec 의 `code:` 에도 아직 없어 glob 충돌 없음. 각 파일의 docstring SoT 인용이 실제로 `spec/1-data-model.md`(§3 FK 인덱스, Rationale «Webhook endpoint_path 전역 유일»)를 가리켜 target 의 귀속이 정확함.
- "카탈로그 단언 파일 8개" 셈 — grep 재현 결과 정확히 8개(`deletion-cascade-indexes` · `entity-schema-declarations` · `background-monitoring` · `notifications-dismiss` · `schedule-trigger` · `terminal-duration-sql` · `trigger-deletion-releases-resources` · `webhook-trigger`), 그중 `schedule-trigger`→`3-schedule.md`·`2-trigger-list.md`, `trigger-deletion-releases-resources`→`2-trigger-list.md` 로 이미 등재돼 target 의 "둘은 이미 있다" 진술과 일치. 나머지 넷은 어떤 spec `code:` 에도 없어 "비대상" 처리가 타당.
- `spec_code_patterns`/`_spec_linked_changes`(review_guard.py) 매칭 방식(정확 경로 문자열) 확인 — 3개 신규 경로는 리터럴 파일 경로라 선례(`2-trigger-list.md` 등)와 같은 형태로 안전하게 매칭됨.
- 진행 중 plan 대조 — `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 항목(§`0-canvas.md` §8.1 · `1-data-model.md` code: 관련)이 이 draft 가 닫으려는 항목과 정확히 일치, 다른 in-progress plan 중 `0-canvas.md` §8.1 이나 `1-data-model.md` frontmatter `code:` 를 다르게 건드리는 항목 없음(전수 grep).

## 요약

target 이 다루는 두 정정(캔버스 §8.1 서술, 데이터 모델 `code:` 3파일 추가) 은 코드·`5-version-history.md`·`data-flow/11-workflow.md`·`1-data-model.md`·convention(`spec-impl-evidence.md`)·기존 `code:` 선례 어느 것과도 모순되지 않고, 진행 중인 다른 plan 과도 겹치거나 충돌하지 않는다. 다만 target 이 "같은 사실을 적는 다른 자리" 를 spec 안으로만 한정해 확인한 탓에, 정확히 같은 도메인(저장 시 `changeSummary`)을 다루는 사용자 가이드 mdx 두 개(`version-history.mdx`/`.en.mdx`)가 존재하지 않는 UI 입력 기능을 계속 약속하는 상태를 놓쳤다 — target 의 정정이 적용되면 이 모순이 이전보다 뚜렷해진다. 이 draft 자체를 막을 사안은 아니나 후속 트래커 등재를 권한다.

## 위험도

LOW
