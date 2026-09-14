# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 요약

- target scope: `spec/conventions/` — `origin/main` 대비 **델타 0개 파일**. 이 브랜치
  (`trigger-canary-hardening`)는 spec 문서를 전혀 수정하지 않았다. `plan/in-progress/trigger-canary-hardening.md`
  frontmatter 의 `spec_impact: none` 및 본문 "하지 않는 것" 절의 `spec/ 편집(권한 밖)` 명시와
  일치한다. 델타 0 자체는 CRITICAL 근거가 아니다 (코드 전용 PR 이면 정상).
- 실제 구현 diff: HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/trigger-canary-hardening-a71e04`)에서
  `git diff origin/main...HEAD -- codebase/` 를 직접 재확인했다 (prompt 번들의 diff 섹션은 예산
  절단으로 비어 있었음). 대상은 6개 파일 — 신규 2개(`trigger-secret-columns-guard.ts`,
  `trigger-secret-columns.spec.ts`), 수정 4개(`trigger-workflow-ref.spec.ts` 는 docstring 번호
  표기만, `chat-channel-trigger-create.e2e-spec.ts`/`schedule-trigger.e2e-spec.ts`/
  `trigger-workflow-ref.e2e-spec.ts` 는 주석 보강 + 기존 export `expectTriggerWorkflowRef` 호출
  추가). 전부 `codebase/backend` 테스트·정적 가드 코드다.
- 그 외 diff: `plan/in-progress/trigger-canary-hardening.md`(신규) ·
  `plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 갱신) · `review/**` 산출물 —
  둘 다 신규 요구사항 ID·엔티티·endpoint·이벤트·ENV 키를 부여하지 않는, 작업 추적/리뷰 산출물이다.

## 신규 식별자 전수 목록과 충돌 검사

| 신규 식별자 | 종류 | 충돌 검사 방법 | 결과 |
|---|---|---|---|
| `CANONICAL_SOURCE` / `CANONICAL_CONST` | exported const (경로/상수명 문자열) | `grep -rn` 저장소 전체 | 신규 파일 밖 정의 0건 |
| `MIRROR_SOURCES` / `MIRROR_CONST` | exported const | 상동 | 상동 |
| `readStringArrayConst` / `readAllTriggerSecretColumnLists` | exported 함수 | 상동 | 동명 함수·재정의 없음 |
| `trigger-secret-columns-guard.ts` / `trigger-secret-columns.spec.ts` | 신규 파일 경로 | `ls codebase/backend/src/repo-guards/__tests__/` (27→29개 전체 목록 확인) | 기존 파일과 겹치지 않음. `<주제>-guard.ts` + `<주제>.spec.ts` 짝 관례(`redis-fail-open-catalog-*`, `masked-reject-callers-*`, `dto-class-name-collision-*` 등)를 그대로 따름 |

`TRIGGER_RESPONSE_STRIP_COLUMNS`(정본, `triggers.service.ts:104`)와 `TRIGGER_SECRET_COLUMNS`
(사본, `schedule-trigger-ref.ts:24` / `trigger-workflow-ref.ts:45`)는 이 PR 이 새로 도입한
식별자가 **아니다** — `git diff origin/main...HEAD` 에 두 파일의 변경 이력이 전혀 없음을
확인했다(두 상수는 diff-base 시점에 이미 존재). 신규 가드(`trigger-secret-columns-guard.ts`)는
이 두 이름을 `CANONICAL_CONST`/`MIRROR_CONST` 문자열 값으로 **참조**할 뿐 재선언하지 않는다.

## 6개 관점별 점검

1. **요구사항 ID 충돌** — 신규 요구사항 ID 없음. plan 내부의 `C-2`/`G`/`H` 라벨은 기존 e2e
   케이스를 가리키는 plan 서술 표기이지 신규 ID 발급이 아니다.
2. **엔티티/타입명 충돌** — 신규 DTO·엔티티·interface 없음. 위 표의 6개 식별자는 전부
   `trigger-secret-columns-guard.ts` 모듈 스코프이며, 저장소 전체 grep 결과 동일 이름의 다른
   정의가 없다.
3. **API endpoint 충돌** — 신규 endpoint 없음. e2e 에 추가된 `expectTriggerWorkflowRef(...)`
   호출 3곳(schedule 목록/PATCH×2)은 기존 `GET/PATCH /api/triggers` 응답을 검증할 뿐이며, 이
   헬퍼 자체도 diff-base 시점에 이미 export 되어 있던 기존 API 다.
4. **이벤트/메시지명 충돌** — webhook·queue·sse 이벤트 신설 없음.
5. **환경변수·설정키 충돌** — 신규 ENV/config key 없음.
6. **파일 경로 충돌** — 위 표 참고. `repo-guards/__tests__/` 디렉토리의 기존 `-guard.ts`/
   `.spec.ts` 짝 명명 관례를 그대로 따르며 컨벤션 이탈·경로 중복 없음. spec 쪽 신규 파일은
   없음(델타 0).

## 부가 확인 — spec 쪽 기존 참조와의 정합

`grep -rn "TRIGGER_SECRET_COLUMNS\|TRIGGER_RESPONSE_STRIP_COLUMNS" spec/` 결과
`spec/conventions/secret-store.md`, `spec/5-system/14-external-interaction-api.md` 두 곳이
`TRIGGER_RESPONSE_STRIP_COLUMNS`(`TriggersService` 소속)를 언급하며, 신규 가드의
`CANONICAL_CONST` 값·소속 파일(`modules/triggers/triggers.service.ts`)이 이 서술과 정확히
일치한다. 새 식별자가 spec 이 이미 알고 있는 이름을 다른 의미로 재정의하는 사례는 없다.

## 발견사항

없음. target(`spec/conventions/`)이 spec 신규 식별자를 도입하지 않았고(델타 0), 구현 diff 가
새로 만든 6개 식별자·2개 파일 모두 기존 이름을 값으로만 참조하거나 파일 스코프에 국한돼 기존
사용처와 의미 충돌이 없다. 이 세션에서 새로 추가된 plan 트래커 항목 6건(`spec-draft-nullable-notation-followups.md`
갱신분 — `secret-store.md §R4` 오탈자, `2-trigger-list.md code:` 누락, repo-guard 등재 관례,
단건 조회 커버리지, `--impl-prep` 번들 절단, `__` 구분자 표기 미정의)도 전부 **기존 spec
문서·기존 코드 파일**을 가리키는 정정 항목이며 새 식별자를 발급하지 않는다.

## 요약

이번 변경은 spec/conventions 에 신규 식별자를 도입하지 않았고(diff 0), 실제 코드 변경도 트리거
비밀 컬럼 목록 3중 사본을 정적으로 대조하는 신규 repo-guard 1쌍 + 기존 e2e 확장(기존 export
`expectTriggerWorkflowRef` 호출 3곳 추가)에 그친다. 신규 export(`CANONICAL_SOURCE`/
`CANONICAL_CONST`/`MIRROR_SOURCES`/`MIRROR_CONST`/`readStringArrayConst`/
`readAllTriggerSecretColumnLists`)는 모두 새 파일 로컬 스코프이며, 값으로 참조하는 기존
상수명(`TRIGGER_RESPONSE_STRIP_COLUMNS`, `TRIGGER_SECRET_COLUMNS`)은 diff-base 이전부터 존재하고
spec 문서(`secret-store.md`, `14-external-interaction-api.md`)의 기존 서술과 정확히 일치한다.
신규 파일 경로 2개도 같은 디렉토리의 기존 `<주제>-guard.ts`/`.spec.ts` 분리 관례를 그대로
따르며 기존 파일과 겹치지 않는다. 요구사항 ID·API endpoint·이벤트명·환경변수 축에서도 신규
도입이 없어 충돌 표면 자체가 존재하지 않는다. (직전 4라운드 — 10:44/11:27/11:52/12:17 — 의
독립 검토와 판정이 일치한다.)

## 위험도

NONE
