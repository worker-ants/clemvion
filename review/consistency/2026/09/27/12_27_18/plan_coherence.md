# Plan 정합성 검토 — `spec/2-navigation/` (impl-done, diff-base=origin/main)

## 발견사항

- **[WARNING] 새 공용 헬퍼 `omit-undefined.ts`가 두 spec 어느 `code:` 에도 등재되지 않음 — 같은 문서가 이미 경고한 실패 모드의 재발**
  - target 위치: `spec/2-navigation/1-workflow-list.md` frontmatter `code:` (line 4-9, `codebase/backend/src/modules/folders/**` 글로브) · `spec/2-navigation/2-trigger-list.md` frontmatter `code:` (line 7-40)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` line 6293-6298 「`spec/2-navigation/` 목록 API 둘의 응답 형태 · 완료된 `pending_plans`」 항목의 2026-09-27 보강 (4)(5) — item (5)가 "신설 e2e `folder-crud.e2e-spec.ts` 를 `1-workflow-list.md` frontmatter `code:` 에 올리는 것 — `2-trigger-list.md` 처럼 자기 도메인의 1차 시행 e2e 를 등재하는 관행" 이라고 그 문서 자신의 관행을 모델로 인용한다.
  - 상세: 이번 diff(`692f1e8fd`)가 `folders.service.ts`·`triggers.service.ts` 양쪽에 있던 undefined-필터 관용구를 `codebase/backend/src/common/utils/omit-undefined.ts` 공용 헬퍼로 추출했다 — 이제 이 파일이 두 spec 이 각자 §3.1/§3 에서 기술하는 PATCH 부분 본문 응답 계약의 실제 "정본"(canonical logic + JSDoc rationale)이다. 그런데 `1-workflow-list.md`·`2-trigger-list.md` 어느 frontmatter `code:` 글로브도 `codebase/backend/src/common/utils/**`를 포함하지 않는다(둘 다 `codebase/backend/src/modules/**` 아래만 나열). `2-trigger-list.md` 자신의 frontmatter 주석(line 33-36)이 정확히 이 상황을 경고한다 — "헬퍼도 등재 — 단언의 정본이 헬퍼에 있어 e2e 만 넣으면 그 정본이 `code:` 밖에 남는다." item (5)는 이 관행을 인용하면서도 **e2e 파일 등재만 반영**했고, 관행의 다른 절반(헬퍼 자체 등재)은 포함하지 않았다. `omit-undefined.ts`는 build 가드(`spec-code-paths.test.ts`, ≥1 매치 요구)를 이미 다른 글로브로 통과하므로 CI 를 깨지는 않지만, 두 spec 이 표방하는 "이 문서가 약속한 surface 의 구현 경로" 완전성 원칙을 어긴다 — 특히 이 헬퍼는 폴더·트리거 두 도메인이 공유해 한쪽 문서만 등재해도 부분적으로만 맞다.
  - 제안: 같은 planner 턴(위 항목 (4)(5)가 예정된 턴)에서 (6)을 추가 — `codebase/backend/src/common/utils/omit-undefined.ts`(+ `.spec.ts`)를 `1-workflow-list.md`와 `2-trigger-list.md` 양쪽 `code:`에 등재하고, 두 도메인이 공유하는 이유를 인라인 주석으로 남긴다(이미 두 문서 모두 이런 "시행 코드 — 왜 이 문서가 무는지" 주석 관행을 갖고 있다). `spec_impact: none`(이 PR 자신) 자체는 그대로 두되, 트래커의 `spec_impact` 목록(line 67-75)에 두 파일이 이미 있으므로 새 항목 신설은 불필요 — 기존 (4)(5) 옆에 (6)만 붙이면 된다.

## 요약

`plan/in-progress/folders-contract-e2e.md`는 impl-prep 단계에서 지적된 미해결 사항(auth 권한 매트릭스 Folder 행 부재·신규 e2e frontmatter 미등재·인접 planner 항목 미인지)을 developer 가 spec 을 직접 못 고치는 제약 안에서 `spec-draft-nullable-notation-followups.md` 트래커의 기존 항목에 (4)(5)로 정확히 보강했고, 이 PR 이 새로 만든 후속 작업("남은 세 곳 `Object.assign`" — `workflows`/`nodes`/`auth-configs`)도 같은 트래커에 새 항목으로 등재해 후속 누락 없이 처리했다. 다만 이 PR 이 신설한 공용 헬퍼 `omit-undefined.ts` 자체는, item (5)가 모델로 인용한 `2-trigger-list.md` 의 "헬퍼도 등재" 관행을 절반만(e2e 만) 반영해 어느 spec `code:` 에도 오르지 못했다 — CI 를 깨는 CRITICAL 은 아니지만 같은 문서가 이미 명문화한 실패 모드의 재발이라 WARNING 으로 남긴다. 그 밖에 미해결 결정과의 충돌이나 선행 plan 미해소는 발견하지 못했다 — `spec_impact: none` 근거(§5.4 규약 소급 미적용)는 impl-prep 검증과 일치하고, 스윕 2차 후보 목록도 이미 닫힌 4개를 함께 정리해 stale 이 남지 않았다.

## 위험도

LOW
