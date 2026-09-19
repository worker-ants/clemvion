# Rationale 연속성 검토

대상: `plan/in-progress/spec-draft-code-guards-and-change-summary.md` (spec_impact: `spec/1-data-model.md`, `spec/3-workflow-editor/0-canvas.md`)

## 발견사항

- **[WARNING]** `code:` 명시 나열 방식이 "증가가 예정된 집합은 술어로 잡는다" 원칙과 거리가 있다
  - target 위치: `## 1. spec/1-data-model.md frontmatter code:` (plan 41~72행), 특히 68~72행("넷은 데이터 모델 전용 가드가 아니다 … 넣지 않는다")
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `## Rationale` **R-CC-22**("`triggers/` 안의 chat-channel 구현 경로를 `code:` 에서 glob 으로 잡는다") — "원인은 사람의 부주의가 아니라 **술어의 형태**다 — 명시 나열은 새 파일을 자동으로 포함하지 않고 … **증가가 예정된 집합은 열거가 아니라 술어로 잡는다.**" (계기: `#1317`·`#1319`·`#1320` 이 새 파일을 3회 연속 `code:` 밖에 만들었고, 그중엔 R-CC-21 검증 규칙 정본도 있었다.)
  - 상세: target 은 DB 카탈로그(`pg_index`·`pg_constraint`·`information_schema` 등)를 단언하는 e2e 를 **전수로 grep** 해 8개를 찾았고, 그중 4개는 이미 어느 spec 의 `code:` 에도 없다는 사실 — 즉 "카탈로그-대조 e2e 가 spec 링크 없이 만들어질 수 있다" 는 바로 R-CC-22 가 고친 실패 유형과 같은 클래스의 증거를, target 스스로 눈앞에 들고 있다. 그런데도 처방은 **이번 3개를 명시 경로로 등재**하는 것뿐이고, "다음에 데이터 모델 사실을 확인하는 새 카탈로그 e2e 가 생기면 또 등재를 놓칠 수 있다" 는 재발 가능성은 다루지 않는다. R-CC-22 가 세운 일반 원칙(§2.1 필드 정의에도 반영: "넓은 트리 글롭으로 가드만 통과시키는 것은 아무것도 가리키지 않는 것과 같다" — 즉 좁은 glob/술어와 명시 나열 사이의 선택은 "그 집합이 느는가" 로 갈린다) 을 적용하면, 이 네 파일이 발견된 사실 자체가 "카탈로그-대조 e2e" 라는 클래스가 산발적으로 늘어난다는 관측 증거다.
  - 제안: (a) 명시 나열을 유지하기로 한다면 그 판단(왜 이 집합은 R-CC-22 의 "증가 예정" 조건에 해당하지 않는다고 보는지)을 target 의 `## Rationale` 에 한 문장 추가하거나, (b) `codebase/backend/test/*-schema-declarations.e2e-spec.ts` · `*-cascade-indexes.e2e-spec.ts` 처럼 접두 패턴이 뚜렷한 좁은 glob 을 검토한다(R-CC-22 가 "통짜 글롭 기각, 좁은 glob 채택" 을 정본 매처로 실측한 것과 같은 절차). 최소한 `/spec-coverage` standing audit 로 이 클래스의 향후 누락을 잡을 수 있는지 한 줄 언급을 권한다(R-CC-22 의 "남는 위험" 절이 같은 방식으로 backstop 을 명시했다).

- **[WARNING]** §8.1 정정이 spec 자체의 `## Rationale` 에 새 항목으로 반영되는지 draft 에 없다
  - target 위치: `## 2. spec/3-workflow-editor/0-canvas.md §8.1` (plan 74~90행) 및 `## Rationale`(99~106행)
  - 과거 결정 출처: `spec/3-workflow-editor/0-canvas.md` `## Rationale` **R-3**("§8 저장 모델·ED-SP-05 정정 — 타이머 자동 저장·즉시 반영은 미제공") — 같은 문서 §8 영역에서 "spec 이 약속했지만 구현에 없는 동작" 을 발견했을 때 본문만 고치지 않고 **R-3 이라는 전용 Rationale 항목**을 만들어 "왜 옛 서술이 틀렸는지 · 왜 구현이 아니라 spec 을 고치는지" 를 남긴 선례. 같은 클래스의 `spec/1-data-model.md` `## Rationale`("WorkflowVersion.snapshot 구성 서술 정정")도 동일 패턴(본문 정정 + 전용 Rationale 항목)이다.
  - 상세: target 이 고치려는 §8.1 의 "버전에는 자동 생성된 `change_summary` 포함" 문장은 사실상 **R-3 이 이미 처리했어야 할 같은 부류의 드리프트**(§8 영역의 "미구현 자동화 약속")인데 R-3 정정 당시 이 한 줄만 남았다. target 의 `## 1.`~`## 2.` 본문은 §8.1 **문장 교체안**만 제시하고, plan 의 `## Rationale`(99~106행)은 이 plan 문서 자체의 근거 절일 뿐 — "이 교체를 `0-canvas.md` 의 `## Rationale` 에도 R-3 연장 항목(또는 신규 R-#)으로 남길지" 가 명시돼 있지 않다. 본문만 조용히 고치면 "과거에 이미 한 번 놓친 드리프트를 다시 놓칠 뻔했다" 는 사실 자체가 기록에서 사라지고, 다음 사람은 R-3 를 읽고도 이 잔여 한 줄이 왜 남아 있었는지 알 수 없다.
  - 제안: spec 반영 시 §8.1 본문 교체와 함께 `0-canvas.md` `## Rationale` 에 R-3 를 참조하는 짧은 후속 항목(또는 R-3 본문에 "정정 (2026-09-19): §8.1 의 `change_summary` 자동 생성 서술도 같은 드리프트였다" 형태의 추기)을 넣을 것을 plan 체크리스트에 명시한다.

- **[INFO]** `code:` 신규 엔트리에서 설명 주석을 뺴는 결정이 인접 spec 관례와 다르다
  - target 위치: plan 59행("(주석은 draft 설명용 — spec frontmatter 에는 경로만 적는다.)")
  - 과거 결정 출처: `spec/2-navigation/3-schedule.md` `code:`(`# 응답 형태 시행 — §4 註가 주장하는 …` 등)와 `spec/2-navigation/2-trigger-list.md` `code:`, `spec/5-system/15-chat-channel.md` R-CC-22 는 모두 새 e2e/시행 코드 항목 옆에 "왜 이 파일이 이 spec 을 문는가" 주석을 남기는 관례를 쓰고, `spec/conventions/spec-impl-evidence.md` §2.1 도 이 주석 패턴이 "2026-09-06 이후로 안전"함을 명시해 사실상 권장한다.
  - 상세: `1-data-model.md` 기존 `code:` 두 줄(엔티티 glob·마이그레이션 glob)은 원래 주석이 없어 이 파일 자체의 기존 스타일과는 어긋나지 않지만, 이번에 추가되는 세 항목은 스스로도 draft 안에서 "이 e2e 가 §3 FK 인덱스를", "Rationale «Webhook endpoint_path 전역 유일» 의 V131 중복 정리를" 이라는 근거 주석을 달아 두고 최종 반영에서는 지우겠다고 명시한다 — 파일명이 상당히 자기서술적이라 심각한 정보 손실은 아니나, 다른 spec 들이 정착시킨 "e2e 항목 옆에 어느 Rationale 을 지키는지 주석으로 고정" 관례와는 반대 방향이다.
  - 제안: 최소한 `trigger-endpoint-path-dedupe.e2e-spec.ts` 처럼 "카탈로그 키워드가 없어 grep 에 안 걸린다" 고 스스로 지적한 항목만이라도 한 줄 주석(예: `# Rationale "Webhook endpoint_path 전역 유일" 의 V131 정리 전용`)을 남겨 인접 spec 관례와 맞춘다.

## 요약

target 의 두 결정 모두 실제로는 기존 Rationale 과 정면 충돌하지 않는다 — `change_summary` 정정은 `0-canvas.md` R-3("타이머 자동 저장·즉시 반영 미제공, spec 을 실제에 맞춘다")이 세운 원칙을 그대로 연장하는 것이고, `code:` 명시 경로 추가·글로브 미채택도 `spec-impl-evidence.md` R-1("글로브 허용" 이지 강제 아님)과 `2-trigger-list.md`/`3-schedule.md` 의 "명시 e2e 경로 + 설명 주석" 선례를 그대로 따른다. 다만 (1) `code:` 명시 나열이 `spec/5-system/15-chat-channel.md` R-CC-22 가 정립한 "증가 예정 집합은 술어로 잡는다" 원칙과 거리가 있는데도 그 거리감을 새 Rationale 로 다루지 않았고, (2) §8.1 정정이 R-3 의 연장선임을 spec 자체의 `## Rationale` 에 남길지 불명확해 — 두 지점 모두 CRITICAL 은 아니지만 "원칙과의 거리감·후속 Rationale 미기재" 로 WARNING 처리했다.

## 위험도

MEDIUM
