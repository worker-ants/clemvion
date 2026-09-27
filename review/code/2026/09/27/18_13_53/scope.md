# 변경 범위(Scope) 리뷰 — patch-null-validation (2R)

## 검증 방법

- `git diff origin/main...HEAD --stat` 로 브랜치 전체 diff(43개 파일)를 프롬프트 번들과 대조 — 누락·불일치 없음.
- 1R(`review/code/2026/09/27/17_47_49`) 이후 새로 추가된 커밋 `e5de5226c`(fix, W1·W2)·`3eec5f8be`(docs, RESOLUTION/SUMMARY 커밋)를 `git show`로 직접 열어 1R scope 판정(`review/code/2026/09/27/17_47_49/scope.md`, 위험도 NONE) 이후에 새로 들어온 변경분만 별도 검증.
- `plan/in-progress/patch-null-validation.md` §범위·§전수가 선언한 "43필드"를 14개 DTO 파일 diff에서 필드명 단위로 직접 합산(4+2+2+1+8+4+5+2+3+3+1+3+3+2=43)해 선언과 실제 diff가 정확히 일치하는지 재확인.

## 발견사항

- **[INFO]** `e5de5226c`(1R WARNING 조치 커밋)는 선언된 두 항목(W1 모델 설정 PATCH 유효 값 e2e, W2 `endpointPath` JSDoc/Swagger 갱신) 외 다른 파일·다른 코드 영역을 건드리지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/dto/update-trigger.dto.ts`(JSDoc 3줄 + Swagger description 1문장 추가), `codebase/backend/test/patch-null-rejection.e2e-spec.ts`(테스트 1건, 파일 끝에 추가)
  - 상세: `git show e5de5226c` 기준 변경 파일은 정확히 이 2개, 삽입 30줄·삭제 1줄이며 RESOLUTION.md 표(SUMMARY # W1·W2)가 약속한 내용과 1:1 대응한다. import 재정렬·무관한 리팩토링·포맷팅 잡음 없음.
  - 제안: 조치 불요.

- **[INFO]** `3eec5f8be`(문서화 커밋)는 `review/code/2026/09/27/17_47_49/**` 13개 파일만 추가하는 순수 리뷰 산출물 커밋이다.
  - 위치: `review/code/2026/09/27/17_47_49/*.md`, `meta.json`, `_retry_state.json`
  - 상세: `git show --stat 3eec5f8be` 기준 코드베이스(`codebase/**`) 변경 0건 — CLAUDE.md가 요구하는 "코드 리뷰 산출물은 `review/code/**`" 규약을 그대로 따르는 부수 산출물이며 스코프 침범이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 브랜치 전체(43파일)를 1R scope 리뷰(위험도 NONE)와 대조한 결과, 이번 2R에서 새로 지적할 스코프 이탈이 없다.
  - 위치: 14개 DTO 파일(`alert-rule.dto.ts` 등) — 각 파일은 import 1줄 + `@IsOptional()` → `@IsOptionalNonNull()` 교체뿐, 재배열·무관한 필드 변경 없음(1R scope.md와 동일 결론, 재확인).
  - 상세: 43필드 합계가 plan §범위 선언과 정확히 일치(alerts 4·auth-configs 2·folders 2·integrations 1·knowledge-base 8·model-config 4·nodes 5·schedules 2·triggers 3·users 3·workflow-assistant 1·workflow-test-datasets 3·workflows 3·workspaces 2=43). nullable 로 남겨야 할 필드(`description`·`parentId`·`authConfigId`·`ipWhitelist`·`avatarUrl` 등)는 diff에 등장하지 않는다.
  - 제안: 조치 불요.

- **[INFO]** `plan/in-progress/spec-draft-nullable-notation-followups.md` 갱신(트래커 항목 체크·후속 항목 신설·`spec_impact` 목록에 `spec/2-navigation/9-user-profile.md` 추가)은 이 PR이 조사 중 발견한 갭을 즉시 구현하지 않고 백로그로만 등재한 것 — 스코프 확장이 아니라 오히려 스코프를 좁게 지킨 증거다.
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(항목 체크박스, "PATCH null 후속" 신규 항목, 프런트매터 `spec_impact` 배열)
  - 상세: (B) 8필드 nullable 선언 누락·JSONB 안의 null 의미·`languageHints` 미측정·교차 워크스페이스 참조 의심 등 조사 중 발견한 4갈래를 이번 PR이 직접 고치지 않고 트래커에만 등재했다. `spec_impact` 목록 추가는 트래커 문서 자신의 메타데이터일 뿐 `spec/9-user-profile.md` 본문을 이 PR이 쓴 것이 아니다(developer의 `spec/` 쓰기 권한 경계 유지).
  - 제안: 조치 불요.

## 저장소 상태

리뷰 중 저장소 파일을 수정하지 않았다 — `Read`/`Bash`(git show, git diff --stat)만 사용, 뮤테이션 없음.

## 요약

2R 스코프 리뷰는 1R(`review/code/2026/09/27/17_47_49/scope.md`, 위험도 NONE)의 결론을 재확인하는 동시에, 1R 이후 새로 추가된 두 커밋(`e5de5226c` fix, `3eec5f8be` docs)을 직접 열어 검증했다. `e5de5226c`는 정확히 RESOLUTION.md가 약속한 W1·W2 두 항목만 조치했고, `3eec5f8be`는 리뷰 산출물 커밋으로 코드 변경이 없다. 브랜치 전체 43개 파일을 plan이 선언한 스코프(43필드 데코레이터 교체 + 공용 헬퍼 1개 + 테스트/CHANGELOG/plan/리뷰 산출물)와 대조해도 의도 이상의 변경·불필요한 리팩토링·기능 확장·무관한 파일 수정·포맷팅 잡음·불필요한 주석/임포트·설정 변경 어느 것도 발견되지 않았다. 조사 중 발견한 스코프 밖 항목들(선언 누락 8필드, JSONB null 의미, 교차 워크스페이스 참조 등)은 구현하지 않고 트래커에만 등재해 오히려 스코프 규율을 지킨 사례로 평가한다.

## 위험도

NONE
